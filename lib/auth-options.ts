import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { UserService } from '@/lib/services/user-service'
import { ChurchService } from '@/lib/services/church-service'
import { ChurchMembershipService } from '@/lib/services/church-membership-service'
import { UserRole } from '@/types'
import bcrypt from 'bcryptjs'
import { logger } from '@/lib/logger'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        churchSlug: { label: 'Church Slug', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          logger.warn('auth.authorize.missing_credentials')
          return null
        }

        const user = await UserService.findByEmail(credentials.email)

        if (!user) {
          logger.warn('auth.authorize.user_not_found', { email: credentials.email })
          return null
        }

        if (!user.password) {
          logger.warn('auth.authorize.no_password', { userId: user.id, email: user.email })
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          logger.warn('auth.authorize.invalid_password', { email: credentials.email })
          return null
        }

        if (user.isSuspended) {
          logger.warn('auth.authorize.suspended', { userId: user.id, email: user.email })
          return null
        }

        // If churchSlug is provided, verify user belongs to that church.
        // Membership is authoritative (users may belong to many churches);
        // user.churchId is kept as a fallback for rows not yet backfilled.
        // SUPER_ADMIN users are multi-tenant and do not belong to a specific church.
        if (credentials.churchSlug && user.role !== 'SUPER_ADMIN') {
          const church = await ChurchService.findBySlug(credentials.churchSlug)

          if (!church) {
            // Church not found
            return null
          }

          let membership = await ChurchMembershipService.findByUserAndChurch(user.id, church.id)
          if (!membership && user.churchId === church.id) {
            // Belongs via legacy pointer but no membership row — backfill it.
            membership = await ChurchMembershipService.attach({
              userId: user.id,
              churchId: church.id,
              role: user.role as UserRole,
              branchId: user.branchId ?? null,
            })
          }

          if (!membership) {
            // User does not belong to this church
            return null
          }

          // Activate this church context: the per-church role/branch from the
          // membership become the user's active pointers for this session.
          if (
            user.churchId !== church.id ||
            user.role !== membership.role ||
            (user.branchId ?? null) !== membership.branchId
          ) {
            await UserService.update(user.id, {
              churchId: church.id,
              role: membership.role,
              branchId: membership.branchId,
            })
            user.churchId = church.id
            user.role = membership.role
            user.branchId = membership.branchId
          }
        }

        // Update last login
        await UserService.updateLastLogin(user.id)

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          role: user.role as UserRole,
          churchId: user.churchId,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.churchId = (user as any).churchId
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).id = token.id
        ;(session.user as any).role = token.role
        ;(session.user as any).churchId = token.churchId

        // Refresh tenant pointers from the DB so church switching and role
        // changes take effect without forcing re-login.
        try {
          const fresh = await UserService.findById(String(token.id))
          if (fresh) {
            ;(session.user as any).role = fresh.role
            ;(session.user as any).churchId = fresh.churchId
            ;(session.user as any).branchId = fresh.branchId
          }
        } catch {
          // fall back to the JWT copy if the lookup fails
        }
      }
      return session
    },
    async redirect({ url, baseUrl }) {
      // If the url is relative, prepend the baseUrl
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`
      }
      // Allow relative URLs
      if (url.startsWith(baseUrl)) {
        return url
      }
      // Default to baseUrl
      return baseUrl
    },
  },
  pages: {
    signIn: '/auth/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
}

