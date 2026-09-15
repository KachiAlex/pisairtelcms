'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { signIn, getSession } from 'next-auth/react'
import { useTenantBrand } from '@/lib/branding/useTenantBrand'

function slugifyPreview(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

type CredentialsLoginFormProps = {
  slug?: string
  churchName?: string
}

export default function CredentialsLoginForm({ slug, churchName }: CredentialsLoginFormProps) {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const isRegistered = searchParams?.get('registered') === 'true'
  const { brand } = useTenantBrand(slug ? { slug } : undefined)

  const contextName = churchName || brand?.name || 'pi-CMS'
  const slugLabel = slug || ''

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        churchSlug: slugLabel || undefined,
        redirect: false,
      })

      if (result?.error) {
        setError('Invalid email or password')
        setLoading(false)
        return
      }

      const session = await getSession()
      const role = (session?.user as any)?.role
      window.location.href = role === 'SUPER_ADMIN' ? '/superadmin' : '/dashboard'
    } catch (err) {
      setError('An error occurred. Please try again.')
      setLoading(false)
    }
  }

  const fallbackSlugExample = useMemo(() => slugifyPreview(contextName || 'your-church'), [contextName])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f5] px-4 py-12">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
      </div>

      <div className="relative z-10 max-w-md w-full">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-primary-600 to-primary-700 rounded-xl flex items-center justify-center shadow-lg">
              <img src={brand.logo} alt={contextName} className="w-10 h-10 object-contain" />
            </div>
            <span className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-primary-700 bg-clip-text text-transparent">
              {contextName}
            </span>
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{slug ? 'Church Login' : 'Sign in to pi-CMS'}</h1>
          <p className="text-gray-600">
            {slug
              ? 'Use your church email and password to access the tenant dashboard.'
              : brand?.tagline || 'Welcome back! Please sign in to continue.'}
          </p>
          {slug && (
            <div className="mt-4 inline-flex flex-col items-center gap-1 rounded-2xl border border-gray-100 bg-white px-4 py-2 text-sm shadow-sm">
              <span className="text-xs uppercase tracking-[0.3em] text-gray-400">Login slug</span>
              <span className="font-mono text-base text-gray-900">/{slug}</span>
              <span className="text-xs text-gray-500">Share this URL: pisairtel.app/login/{slug}</span>
            </div>
          )}
        </div>

        {isRegistered && (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-green-800">
            Account created successfully. Sign in to continue.
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent pr-10 text-gray-900"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
              >
                {showPassword ? (
                  <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268-2.943 9.543-7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {slug && (
            <div className="rounded-2xl bg-primary-50 border border-primary-100 px-4 py-3 text-sm text-primary-900">
              <p className="font-semibold">What is a church slug?</p>
              <p className="mt-1 text-primary-800">
                It is the short identifier for your church (e.g. <span className="font-mono text-primary-900">/{fallbackSlugExample}</span>)
                that we generated during registration. Share <span className="font-mono">pisairtel.app/login/{slug}</span> with your leaders so they log in on the right tenant.
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl font-semibold hover:from-primary-700 hover:to-primary-800 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Need to create a tenant?{' '}
          <Link href="/auth/register" className="font-semibold text-primary-600 hover:text-primary-700 transition-colors">
            Start free trial
          </Link>
        </p>

        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}
