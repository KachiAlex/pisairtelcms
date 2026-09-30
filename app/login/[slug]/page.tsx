import Link from 'next/link'
import { ChurchService } from '@/lib/services/church-service'
import CredentialsLoginForm from '@/components/auth/CredentialsLoginForm'
import { AlertCircle, ArrowLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

function formatLoginUrl(slug: string) {
  return `pisairtel.app/login/${slug}`
}

export default async function TenantSlugLoginPage({ params }: { params: { slug: string } }) {
  const slug = params.slug?.toLowerCase()
  let church = null
  let error = null

  // Only try to fetch church if slug is provided
  if (slug) {
    try {
      church = await ChurchService.findBySlug(slug)
    } catch (err) {
      console.error('[login] Error fetching church by slug:', err)
      error = 'Unable to load church information. Please try again.'
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="fixed inset-0 -z-10">
        <img src="/home-bg.svg" alt="Pisairtel background" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-[#faf9f5] via-[#faf9f5]/90 to-primary-50" />
      </div>

      <nav className="relative z-10 border-b border-gray-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 blur-sm opacity-40" />
              <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 shadow-lg shadow-primary-500/20">
                <img src="/logo.svg" alt="Pisairtel CMS" className="h-8 w-8" />
              </div>
            </div>
            <span className="text-2xl font-bold tracking-tight text-gray-900">Pisairtel</span>
          </Link>
          <div className="flex items-center gap-4 text-sm font-semibold text-gray-600">
            <Link href="/login" className="hover:text-gray-900">
              Change slug
            </Link>
            <Link href="/auth/login" className="hover:text-gray-900">
              Superadmin login
            </Link>
          </div>
        </div>
      </nav>

      <main className="relative z-10 mx-auto flex max-w-6xl flex-col gap-10 px-4 py-12 md:flex-row md:items-start">
        <div className="w-full md:w-1/2">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary-600">Tenant access</p>
          <h1 className="mt-4 text-4xl font-bold text-gray-900 md:text-5xl">
            {error ? 'Error loading church' : church ? `Welcome back to ${church.name}` : 'We could not find that church'}
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            {error
              ? 'There was a problem loading the church information. Please try again or contact support.'
              : church
                ? 'Sign in with your church email and password. This URL is unique to your tenant for security.'
                : 'Double-check the slug provided by your superadmin or return to the slug finder to try again.'}
          </p>

          {error ? (
            <div className="mt-6 flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50/70 p-4 text-sm text-red-900">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          ) : church ? (
            <div className="mt-6 rounded-2xl border border-primary-100 bg-primary-50/70 p-4 text-sm text-primary-900">
              <p className="font-semibold">Shareable login link</p>
              <p className="mt-1 font-mono text-base text-primary-900">{formatLoginUrl(slug)}</p>
              <p className="mt-1 text-primary-800">Save this link for staff and regional leaders.</p>
            </div>
          ) : (
            <div className="mt-6 flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50/70 p-4 text-sm text-red-900">
              <AlertCircle className="h-5 w-5" />
              <span>
                Slug &ldquo;/{slug}&rdquo; was not found.{' '}
                <Link href="/login" className="font-semibold underline hover:text-red-800">
                  Return to slug finder
                </Link>{' '}
                or{' '}
                <Link href="/auth/register" className="font-semibold underline hover:text-red-800">
                  register a new church
                </Link>
                .
              </span>
            </div>
          )}

          <div className="mt-8 inline-flex items-center gap-2 text-sm text-gray-500">
            <ArrowLeft className="h-4 w-4" />
            <Link href="/login" className="font-medium text-gray-700 hover:text-gray-900">
              Back to slug finder
            </Link>
          </div>
        </div>

        <div className="w-full md:w-1/2">
          {church && !error ? (
            <CredentialsLoginForm slug={slug} churchName={church.name} />
          ) : (
            <div className="rounded-3xl border border-gray-100 bg-white p-10 text-center shadow-2xl">
              <p className="text-lg font-semibold text-gray-900">
                {error ? 'Please try again later' : 'Enter a valid church slug to continue.'}
              </p>
              <p className="mt-2 text-sm text-gray-600">
                Need help? Email <a href="mailto:admin@pisairtel.com" className="text-primary-600 hover:underline">admin@pisairtel.com</a> and we will resend your tenant details.
              </p>
              <Link
                href="/login"
                className="mt-6 inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-3 text-white"
              >
                {error ? 'Try again' : 'Try another slug'}
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
