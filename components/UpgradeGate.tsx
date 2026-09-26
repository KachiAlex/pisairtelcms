import Link from 'next/link'

const FEATURE_LABELS: Record<string, { name: string; blurb: string; plan: string }> = {
  payroll: {
    name: 'Payroll',
    blurb: 'Manage salaries, wage scales, pay periods, and staff compensation.',
    plan: 'Growth',
  },
  ai: {
    name: 'AI Discipleship',
    blurb: 'AI coaching, growth plans, follow-up messages, and reading plan recommendations.',
    plan: 'Growth',
  },
  'advanced-analytics': {
    name: 'Advanced Analytics',
    blurb: 'Deeper reporting, trends, and cross-module insights.',
    plan: 'Enterprise',
  },
}

export default function UpgradeGate({ feature }: { feature: string }) {
  const info = FEATURE_LABELS[feature] || {
    name: feature,
    blurb: 'This module is not included in your current plan.',
    plan: 'a higher',
  }

  return (
    <div className="max-w-lg mx-auto mt-16 px-4">
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-2xl">
          ⬆️
        </div>
        <h1 className="text-xl font-semibold text-gray-900">{info.name} is a {info.plan}-plan feature</h1>
        <p className="mt-2 text-sm text-gray-600">{info.blurb}</p>
        <p className="mt-3 text-sm text-gray-600">
          Upgrade your subscription to the <span className="font-medium text-gray-900">{info.plan} plan</span> or higher to unlock it.
        </p>
        <Link
          href="/subscription"
          className="mt-6 inline-block rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          View plans &amp; upgrade
        </Link>
      </div>
    </div>
  )
}
