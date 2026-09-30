'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, ScanSearch } from 'lucide-react'

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function LoginSlugCapturePage() {
  const router = useRouter()
  const [slugInput, setSlugInput] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const normalizedSlug = useMemo(() => slugify(slugInput), [slugInput])
  const exampleSlug = normalizedSlug || 'grace-community'
  const loginUrlPreview = `pisairtel.app/login/${exampleSlug}`

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const targetSlug = slugify(slugInput)
    if (!targetSlug) {
      setError('Enter your church slug to continue')
      return
    }
    setLoading(true)
    router.push(`/login/${targetSlug}`)
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="fixed inset-0 -z-10">
        <img src="/home-bg.svg" alt="pi-CMS background" className="h-full w-full object-cover" />
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
          <Link href="/auth/login" className="text-sm font-semibold text-gray-600 hover:text-gray-900">
            Superadmin Login
          </Link>
        </div>
      </nav>

      <main className="relative z-10 mx-auto flex max-w-6xl flex-col gap-10 px-4 py-16 md:flex-row md:items-center">
        <div className="w-full md:w-1/2">
          <div className="inline-flex items-center rounded-full border border-primary-100 bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-primary-700">
            <ScanSearch className="mr-2 h-4 w-4" />Church slug login
          </div>
          <h1 className="mt-6 text-4xl font-bold text-gray-900 md:text-5xl">
            Tell us your church slug to enter the right tenant
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            Every church on Pisairtel gets a unique slug, like <span className="font-mono text-gray-900">/{exampleSlug}</span>. Your staff and campus leaders will log in using this slug so we can route them to your tenant securely.
          </p>

          <div className="mt-6 rounded-2xl border border-gray-100 bg-white/80 p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-700">Need help?</p>
            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              <li>• Ask your superadmin for the slug (shown in Superadmin → Tenant details)</li>
              <li>• It is included in welcome emails when a church is created</li>
              <li>• Slug = the URL-safe version of your church name. Example login URL: <span className="font-mono text-gray-900">{loginUrlPreview}</span></li>
            </ul>
          </div>
        </div>

        <div className="w-full md:w-1/2">
          <form onSubmit={handleSubmit} className="rounded-3xl border border-gray-100 bg-white p-8 shadow-2xl">
            <label htmlFor="slug" className="text-sm font-semibold text-gray-700">
              Enter your church slug
            </label>
            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-gray-300 bg-gray-50 px-4 py-3 focus-within:border-primary-500 focus-within:bg-white">
              <span className="font-mono text-gray-500">pisairtel.app/login/</span>
              <input
                id="slug"
                name="slug"
                type="text"
                value={slugInput}
                onChange={(event) => {
                  setSlugInput(event.target.value)
                  setError('')
                }}
                placeholder="your-church"
                className="w-full border-none bg-transparent text-gray-900 placeholder:text-gray-400 focus:outline-none"
              />
            </div>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-3 text-lg font-semibold text-white shadow-lg shadow-primary-500/30 transition hover:from-primary-700 hover:to-primary-800 disabled:opacity-50"
            >
              Continue
              <ArrowRight className="h-5 w-5" />
            </button>

            <div className="mt-6 rounded-2xl border border-primary-100 bg-primary-50/70 p-4 text-sm text-primary-900">
              <p className="font-semibold">What is a slug?</p>
              <p className="mt-1">
                It is the short, URL-friendly identifier for your church. We create it from your church name during registration so staff can log in securely at <span className="font-mono">pisairtel.app/login/&lt;slug&gt;</span>.
              </p>
            </div>

            <p className="mt-6 text-center text-sm text-gray-600">
              Need to register your church?{' '}
              <Link href="/auth/register" className="font-semibold text-primary-600 hover:text-primary-700">
                Start a free trial
              </Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  )
}
