# Landing Checkout Analytics Guide

This reference explains how to query landing page checkout analytics and replay the same metrics that power the Superadmin dashboard.

## Overview

Landing checkout attempts are stored in the `landing_plan_payments` Firestore collection (managed by `LandingPaymentService`). Each document includes plan info, amount, currency, status (`INITIATED`, `PAID`, `FAILED`), promo code, contact fields, and timestamps (`createdAt`, `updatedAt`, optional `paidAt`).

The helper `getLandingCheckoutAnalytics` (in `lib/analytics/platform-analytics.ts`) aggregates this data: it filters by date range/plan/status, returns totals, revenue by currency, conversion rate, and up to the full entry list.

## Usage in code

```ts
import { getLandingCheckoutAnalytics } from '@/lib/analytics/platform-analytics'

const { totals, conversionRate, entries } = await getLandingCheckoutAnalytics({
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-01-31'),
  planIds: ['starter', 'growth'],
  status: ['PAID', 'FAILED'],
})

console.log('Attempts', totals.count)
console.log('Paid', totals.byStatus.PAID)
console.log('Revenue USD', totals.amountByCurrency.USD)
console.log('Conversion %', conversionRate)
console.log('Latest entry', entries[0])
```

### Parameters
- `startDate` / `endDate` (optional): limit results to a window. The Superadmin analytics page passes the period window (month/quarter/year).
- `planIds` (optional): filters down to specific plan IDs (max 10 per Firestore `in` query).
- `status` (optional): filters by landing payment status array.

### Returned shape
- `totals.count`: number of records after filters.
- `totals.amountByCurrency`: object keyed by currency (`{ USD: 199, NGN: 350000 }`).
- `totals.byStatus`: counts grouped by status.
- `totals.byPlan`: counts grouped by plan ID.
- `conversionRate`: percentage of `PAID` entries over total attempts (1 decimal precision).
- `entries`: fully hydrated landing payment documents (sorted newest-first) including contact info, promo, amount, currency, status, timestamps.

## Exporting data via Node script

You can run a quick Node script (e.g., `tsx scripts/landing-checkout-report.ts`) to print daily stats:

```ts
import { getLandingCheckoutAnalytics } from '@/lib/analytics/platform-analytics'

async function main() {
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  const report = await getLandingCheckoutAnalytics({ startDate: start, endDate: today })
  console.log(JSON.stringify(report, null, 2))
}

main()
```

## Surfacing metrics elsewhere
- **Superadmin Analytics page** already displays funnel metrics and the latest six entries.
- **Alerting / Slack hooks**: call the helper from a scheduled job, and notify when conversion drops below a threshold or when `FAILED` counts spike.
- **Ad-hoc analysis**: load `report.entries` into spreadsheets or BI tools for deeper cohorts.

## Troubleshooting
- If a checkout attempt fails before payment initialization, `LandingPaymentService.markFailed` stores the error in `lastError`; include that in custom reports.
- Ensure webhook events are flowing; without Flutterwave callbacks, `status` will remain `INITIATED` and conversion stays low.
- When filtering by plan IDs, confirm they exist in `subscriptionPlans` (use slugs such as `starter`, `growth`, `enterprise`).
