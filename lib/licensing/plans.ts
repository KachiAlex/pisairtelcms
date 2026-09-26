export type LicensingTier = 'STARTER' | 'GROWTH' | 'ENTERPRISE'

export interface PricingRange {
  min: number
  max?: number
}

export interface PlanLimits {
  maxUsers?: number
  maxStorageGB?: number
  maxSermons?: number
  maxEvents?: number
  maxDepartments?: number
  maxGroups?: number
}

export type BillingCycle = 'monthly' | 'annual' | 'lifetime'

export interface LicensingPlanConfig {
  id: string
  tier: LicensingTier
  name: string
  description: string
  targetMembers: { min: number; max?: number }
  priceMonthlyRange: PricingRange
  priceAnnualRange: PricingRange
  setupFeeRange: PricingRange
  features: string[]
  includes?: string[]
  idealUseCases: string[]
  multiCampusSupport?: boolean
  prioritySupport?: boolean
  limits?: PlanLimits
  billingCycle?: BillingCycle
}

/**
 * Tier ranking used for feature gating. `free` covers the Free Trial plan
 * and any plan whose code/tier can't be resolved (fails closed).
 */
export const PLAN_TIER_ORDER: Record<string, number> = {
  free: 0,
  starter: 1,
  growth: 2,
  enterprise: 3,
  lifetime: 3,
}

/**
 * Module-level features and the minimum tier required to use them.
 * Checked by guardApi({ requirePlanFeature }) — keep keys machine-stable.
 */
export const PLAN_FEATURES: Record<string, keyof typeof PLAN_TIER_ORDER> = {
  payroll: 'growth',
  ai: 'growth',
  'advanced-analytics': 'enterprise',
}

export const LICENSING_PLANS: LicensingPlanConfig[] = [
  {
    id: 'starter',
    tier: 'STARTER',
    name: 'Starter',
    description: 'Digitize core church operations for small congregations.',
    targetMembers: { min: 50, max: 300 },
    priceMonthlyRange: { min: 29, max: 49 },
    priceAnnualRange: { min: 299, max: 499 },
    setupFeeRange: { min: 100, max: 300 },
    limits: {
      maxUsers: 200,
      maxSermons: 100,
      maxEvents: 25,
      maxDepartments: 10,
      maxGroups: 25,
      maxStorageGB: 25,
    },
    features: [
      'Membership + attendance tracking',
      'Announcements & messaging',
      'Sermon + media library',
      'Basic giving + financial reports',
      'Limited admin roles',
    ],
    includes: ['30-day trial', 'Email support'],
    idealUseCases: ['Single site congregations', 'Church plants'],
    multiCampusSupport: false,
  },
  {
    id: 'growth',
    tier: 'GROWTH',
    name: 'Growth',
    description: 'Automation & volunteer workflows for mid-sized churches.',
    targetMembers: { min: 300, max: 1500 },
    priceMonthlyRange: { min: 99, max: 149 },
    priceAnnualRange: { min: 999, max: 1499 },
    setupFeeRange: { min: 300, max: 800 },
    limits: {
      maxUsers: 1500,
      maxSermons: 500,
      maxEvents: 100,
      maxDepartments: 40,
      maxGroups: 100,
      maxStorageGB: 100,
    },
    features: [
      'All Starter features',
      'First-timer + follow-up automation',
      'Volunteer & department management',
      'Event + registration workflows',
      'Advanced giving analytics',
      'Multiple admin workspaces',
    ],
    includes: ['Phone support', 'Automation templates'],
    idealUseCases: ['Multi-service churches', 'Campus launch teams'],
    multiCampusSupport: true,
  },
  {
    id: 'enterprise',
    tier: 'ENTERPRISE',
    name: 'Enterprise',
    description: 'Full ERP suite for mega / multi-campus churches.',
    targetMembers: { min: 1500 },
    priceMonthlyRange: { min: 299, max: 799 },
    priceAnnualRange: { min: 3000, max: 10000 },
    setupFeeRange: { min: 1000, max: 5000 },
    features: [
      'Multi-campus & HQ dashboard',
      'Advanced leadership analytics',
      'Role-based access + audit logs',
      'API + integrations',
      'Priority support + success manager',
    ],
    includes: ['Dedicated success engineer', 'Quarterly strategy reviews'],
    idealUseCases: ['Mega churches', 'Regional hubs', 'International ministries'],
    multiCampusSupport: true,
    prioritySupport: true,
  },
  {
    id: 'lifetime',
    tier: 'ENTERPRISE',
    name: 'Lifetime',
    description: 'One-time license with lifetime updates and white-glove onboarding.',
    targetMembers: { min: 50 },
    priceMonthlyRange: { min: 6999, max: 8999 },
    priceAnnualRange: { min: 6999, max: 8999 },
    setupFeeRange: { min: 0, max: 0 },
    features: [
      'All Enterprise capabilities',
      'Dedicated success manager',
      'Priority roadmap access',
      'Unlimited campuses & admins',
      'Lifetime feature updates',
    ],
    includes: ['Concierge migration', 'Lifetime support'],
    idealUseCases: ['Founding partners', 'Denominations securing perpetual license'],
    multiCampusSupport: true,
    prioritySupport: true,
    billingCycle: 'lifetime',
  },
]

export function getPlanConfig(planId?: string) {
  if (!planId) return undefined
  return LICENSING_PLANS.find((plan) => plan.id === planId)
}

export const DENOMINATION_LICENSE = {
  id: 'denomination',
  description: 'Network-wide master license covering all branches with central governance + local autonomy.',
  pricingRange: { min: 10000, max: 100000 },
  billing: 'Annual contracts',
  notes: ['Includes custom SSO + API integrations', 'Bulk analytics dashboard'],
}

export interface LicensingRecommendationInput {
  memberCount?: number
  multiCampus?: boolean
  needsAdvancedAnalytics?: boolean
}

export function recommendPlan(input: LicensingRecommendationInput) {
  const memberCount = input.memberCount ?? 0
  if (memberCount >= 1500 || input.multiCampus) {
    return LICENSING_PLANS.find((plan) => plan.id === 'enterprise')
  }
  if (memberCount >= 300 || input.needsAdvancedAnalytics) {
    return LICENSING_PLANS.find((plan) => plan.id === 'growth')
  }
  return LICENSING_PLANS.find((plan) => plan.id === 'starter')
}

export function attachPlanMeta<T extends { id?: string }>(plans: T[]) {
  return plans.map((plan) => {
    if (!plan?.id) return plan
    const meta = LICENSING_PLANS.find((item) => item.id === plan.id)
    return meta
      ? {
          ...plan,
          tierMeta: meta,
        }
      : plan
  })
}

export const PREMIUM_ADDONS = [
  {
    id: 'analytics_plus',
    name: 'Advanced Analytics + Forecasting',
    pricePerMonth: 49,
  },
  {
    id: 'ai_sermon',
    name: 'AI Sermon Summaries & Search',
    pricePerMonth: 29,
  },
  {
    id: 'sms_whatsapp',
    name: 'SMS & WhatsApp Automation',
    pricePerMonth: 19,
  },
  {
    id: 'white_label',
    name: 'Custom Branding / White-label App',
    pricePerMonth: 99,
  },
  {
    id: 'compliance',
    name: 'Advanced Security & Compliance',
    pricePerMonth: 59,
  },
]
