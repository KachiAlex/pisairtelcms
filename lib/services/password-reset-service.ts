import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

export interface PasswordResetToken {
  id: string
  userId: string
  token: string
  expiresAt: Date
  used: boolean
  createdAt: Date
}

export class PasswordResetService {
  /**
   * Generate a secure random token
   */
  private static generateToken(): string {
    return crypto.randomBytes(32).toString('hex')
  }

  /**
   * Create a password reset token for a user
   */
  static async createToken(userId: string): Promise<PasswordResetToken> {
    // Invalidate any existing unused tokens for this user
    await prisma.passwordResetToken.updateMany({
      where: { userId, used: false },
      data: { used: true },
    })

    // Create new token (expires in 1 hour)
    const token = this.generateToken()
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 1)

    const record = await prisma.passwordResetToken.create({
      data: { userId, token, expiresAt },
    })

    return record as PasswordResetToken
  }

  /**
   * Validate and get token
   */
  static async validateToken(token: string): Promise<PasswordResetToken | null> {
    const record = await prisma.passwordResetToken.findFirst({
      where: { token, used: false, expiresAt: { gt: new Date() } },
    })
    return (record as PasswordResetToken) ?? null
  }

  /**
   * Mark token as used
   */
  static async markAsUsed(tokenId: string): Promise<void> {
    await prisma.passwordResetToken.update({
      where: { id: tokenId },
      data: { used: true },
    })
  }

  /**
   * Clean up expired tokens (can be run as a scheduled job)
   */
  static async cleanupExpiredTokens(): Promise<void> {
    await prisma.passwordResetToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    })
  }
}
