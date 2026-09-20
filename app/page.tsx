'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect, useRef, useMemo, type FormEvent, type ChangeEvent } from 'react'
import {
  Users,
  DollarSign,
  Heart,
  ClipboardCheck,
  CalendarDays,
  MessageSquare,
  Building2,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Lock,
  Check,
  type LucideIcon,
} from 'lucide-react'
import { LICENSING_PLANS } from '@/lib/licensing/plans'

type PublicPromo = {
  code: string
  type: 'percentage' | 'flat'
  value: number
  appliesTo: 'plan' | 'church' | 'global'
  planIds?: string[]
  churchIds?: string[]
  notes?: string
}

type PricingApiPlan = {
  id: string
  name: string
  description?: string
  price: number
  currency?: string
  billingCycle?: string
  features?: string[]
  trialDays?: number
  type?: string
  promoCode?: string
}

type MarketingPlan = PricingApiPlan & {
  features: string[]
  currency: string
  billingCycle: string
  cta?: string
  popular?: boolean
  discountedPrice?: number
  promoLabel?: string
  promoCode?: string
}

type CheckoutFormState = {
  fullName: string
  email: string
  churchName: string
  phone: string
  promoCode: string
  notes: string
}

const emptyCheckoutForm = (): CheckoutFormState => ({
  fullName: '',
  email: '',
  churchName: '',
  phone: '',
  promoCode: '',
  notes: '',
})

const FALLBACK_PLANS: MarketingPlan[] = LICENSING_PLANS.filter((plan) =>
  ['starter', 'growth', 'enterprise', 'lifetime'].includes(plan.id)
).map((plan) => ({
  id: plan.id,
  name: plan.name,
  description: plan.description,
  price: plan.priceMonthlyRange.min,
  currency: 'USD',
  billingCycle: plan.billingCycle ?? 'monthly',
  features: plan.features || [],
  trialDays: 30,
  type: plan.tier,
  cta:
    plan.id === 'enterprise' || plan.id === 'lifetime'
      ? 'Talk to Sales'
      : 'Start Free Trial',
  popular: plan.id === 'growth',
}))

const currencyFormatter = (currency: string) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  })

const mapPlanFromApi = (plan: PricingApiPlan): MarketingPlan => {
  const price =
    typeof plan.price === 'number' ? plan.price : Number(plan.price) || 0
  const currency = plan.currency || 'USD'
  const billingCycle = plan.billingCycle || 'monthly'
  const normalizedFeatures = Array.isArray(plan.features) ? plan.features : []

  return {
    ...plan,
    price,
    currency,
    billingCycle,
    features: normalizedFeatures,
    trialDays: plan.trialDays ?? 0,
    cta:
      price <= 0
        ? 'Start Free Trial'
        : billingCycle === 'lifetime'
          ? 'Get Lifetime Access'
          : 'Get Started',
    popular: plan.id === 'growth' || plan.type?.toUpperCase() === 'GROWTH',
  }
}

const findPromoForPlan = (planId: string, promos: PublicPromo[]) =>
  promos.find((promo) => {
    if (promo.appliesTo === 'global') return true
    if (promo.appliesTo === 'plan') {
      return promo.planIds?.includes(planId)
    }
    return false
  })

const formatPromoLabel = (
  promo: PublicPromo,
  currency: string,
  basePrice: number
) => {
  if (promo.type === 'percentage') {
    return `${promo.value}% off`
  }

  const formatter = currencyFormatter(currency)
  return `${formatter.format(promo.value)} off`
}

const calculateDiscountedPrice = (basePrice: number, promo: PublicPromo) => {
  if (promo.type === 'percentage') {
    const pct = Math.min(100, Math.max(0, promo.value))
    return Math.max(0, basePrice - (basePrice * pct) / 100)
  }

  return Math.max(0, basePrice - promo.value)
}

const applyPromoToPlan = (plan: MarketingPlan, promos: PublicPromo[]): MarketingPlan => {
  const promo = findPromoForPlan(plan.id, promos)
  if (!promo) {
    return { ...plan, promoLabel: undefined, discountedPrice: undefined }
  }

  return {
    ...plan,
    discountedPrice: calculateDiscountedPrice(plan.price, promo),
    promoLabel: formatPromoLabel(promo, plan.currency, plan.price),
  }
}

export default function Home() {
  const [mounted, setMounted] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const stackRef = useRef<HTMLDivElement | null>(null)
  const tiltRef = useRef<HTMLDivElement | null>(null)
  const [marketingPlans, setMarketingPlans] = useState<MarketingPlan[]>(FALLBACK_PLANS)
  const [promos, setPromos] = useState<PublicPromo[]>([])
  const [pricingError, setPricingError] = useState<string | null>(null)
  const decoratedPlans = useMemo(
    () =>
      marketingPlans
        .map((plan) => applyPromoToPlan(plan, promos))
        .sort((a, b) => (a.discountedPrice ?? a.price) - (b.discountedPrice ?? b.price)),
    [marketingPlans, promos]
  )

  // A $0 plan is a trial offer, not a tier — it renders as a ribbon above the
  // grid so the paid cards stay in a clean 4-column array.
  const freePlan = useMemo(
    () => decoratedPlans.find((p) => (p.discountedPrice ?? p.price) <= 0 && p.billingCycle !== 'lifetime'),
    [decoratedPlans]
  )
  const paidPlans = useMemo(
    () => decoratedPlans.filter((p) => p !== freePlan),
    [decoratedPlans, freePlan]
  )
  const plansToRender = paidPlans.length ? paidPlans : decoratedPlans
  const [selectedPlan, setSelectedPlan] = useState<MarketingPlan | null>(null)
  const [checkoutForm, setCheckoutForm] = useState<CheckoutFormState>(emptyCheckoutForm())
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null)
  const [checkoutStatus, setCheckoutStatus] = useState<'idle' | 'submitting' | 'success'>('idle')
  const isCheckoutOpen = Boolean(selectedPlan)

  const openCheckout = (plan: MarketingPlan) => {
    const effectivePrice = plan.discountedPrice ?? plan.price
    if (effectivePrice <= 0) {
      window.location.href = `/auth/register?plan=${plan.id}`
      return
    }

    setSelectedPlan(plan)
    setCheckoutForm({
      ...emptyCheckoutForm(),
      promoCode: plan.promoCode || '',
    })
    setCheckoutError(null)
    setCheckoutMessage(null)
    setCheckoutStatus('idle')
  }

  const closeCheckout = () => {
    if (checkoutStatus === 'submitting') return
    setSelectedPlan(null)
    setCheckoutForm(emptyCheckoutForm())
    setCheckoutError(null)
    setCheckoutMessage(null)
    setCheckoutStatus('idle')
  }

  const handleCheckoutFieldChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target
    setCheckoutForm((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleCheckoutSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedPlan) return
    if (!checkoutForm.fullName.trim() || !checkoutForm.email.trim()) {
      setCheckoutError('Please provide your full name and email address.')
      return
    }

    setCheckoutStatus('submitting')
    setCheckoutError(null)
    setCheckoutMessage(null)

    try {
      const response = await fetch('/api/public/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: selectedPlan.id,
          ...checkoutForm,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to start checkout')
      }

      setCheckoutStatus('success')
      if (data.authorizationUrl) {
        setCheckoutMessage('Redirecting you to our secure payment partner…')
        window.location.href = data.authorizationUrl
        return
      }

      if (data.signupUrl) {
        setCheckoutMessage('This plan starts free. Redirecting you to registration…')
        window.location.href = data.signupUrl
        return
      }

      setCheckoutMessage(
        data.message || 'Checkout initialized. Please check your email for next steps.'
      )
    } catch (error: any) {
      setCheckoutStatus('idle')
      setCheckoutError(error?.message || 'Unable to start checkout. Please try again.')
    }
  }

  useEffect(() => {
    setMounted(true)
    let cancelled = false
    async function loadPricing() {
      try {
        const response = await fetch('/api/public/pricing', { cache: 'no-store' })
        if (!response.ok) {
          throw new Error('Failed to load pricing')
        }
        const data = await response.json()
        if (cancelled) return

        const fetchedPlans = Array.isArray(data?.plans) ? data.plans.map(mapPlanFromApi) : []
        const fetchedPromos = Array.isArray(data?.promos) ? data.promos : []

        setMarketingPlans(fetchedPlans.length ? fetchedPlans : FALLBACK_PLANS)
        setPromos(fetchedPromos)
        setPricingError(null)
      } catch (error) {
        console.error('Failed to fetch live pricing:', error)
        if (!cancelled) {
          setMarketingPlans(FALLBACK_PLANS)
          setPricingError('Unable to fetch live pricing right now. Showing defaults.')
        }
      }
    }

    loadPricing()

    // Intersection Observer for reveal animations
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in')
          }
        })
      },
      { threshold: 0.15 }
    )

    // Observe all reveal elements
    const revealEls = document.querySelectorAll('.reveal')
    revealEls.forEach((el) => observerRef.current?.observe(el))

    // Card stack tilt effect
    const stack = stackRef.current
    const tilt = tiltRef.current
    if (stack && tilt) {
      const handleMouseMove = (e: MouseEvent) => {
        const r = stack.getBoundingClientRect()
        const x = (e.clientX - r.left) / r.width - 0.5
        const y = (e.clientY - r.top) / r.height - 0.5
        tilt.style.transform = `rotate(${x * 4}deg) translate(${x * 10}px, ${y * 10}px)`
      }
      const handleMouseLeave = () => {
        tilt.style.transform = 'rotate(0deg) translate(0, 0)'
      }
      stack.addEventListener('mousemove', handleMouseMove)
      stack.addEventListener('mouseleave', handleMouseLeave)

      return () => {
        cancelled = true
        stack.removeEventListener('mousemove', handleMouseMove)
        stack.removeEventListener('mouseleave', handleMouseLeave)
        observerRef.current?.disconnect()
      }
    }

    return () => {
      cancelled = true
      observerRef.current?.disconnect()
    }
  }, [])

  const features: {
    icon: LucideIcon
    title: string
    description: string
  }[] = [
    { icon: Users, title: 'Membership Directory', description: 'Keep every member\'s contact details, family connections, and involvement history in one searchable place.' },
    { icon: DollarSign, title: 'Giving & Tithes', description: 'Track tithes and offerings by fund, send giving statements, and see trends without a spreadsheet.' },
    { icon: ClipboardCheck, title: 'Attendance & Check-in', description: 'Check in members and first-time visitors for services, groups, or events in seconds, not sign-in sheets.' },
    { icon: CalendarDays, title: 'Service & Event Planning', description: 'Plan services, assign volunteers, and schedule recurring events without juggling group chats.' },
    { icon: MessageSquare, title: 'Communication', description: 'Reach your congregation by email or SMS, segmented by ministry, group, or campus.' },
    { icon: Building2, title: 'Multi-Campus Support', description: 'Manage several campuses or church plants from one connected account and shared directory.' },
  ]

  return (
    <main className="min-h-screen bg-[#faf9f5] text-[#15161a] overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-[60] bg-[#faf9f5]/86 backdrop-blur-md border-b border-[#e6e2d8]">
        <div className="max-w-[1180px] mx-auto px-8 flex items-center justify-between h-[78px]">
          <Link href="/" className="flex items-center gap-2.5">
            <svg width="32" height="32" viewBox="0 0 400 400" className="w-8 h-8 block">
              <defs><linearGradient id="hg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F7C93C"/><stop offset="28%" stopColor="#F7931E"/>
                <stop offset="55%" stopColor="#E8286E"/><stop offset="80%" stopColor="#C0208A"/><stop offset="100%" stopColor="#8E1FA0"/>
              </linearGradient></defs>
              <circle cx="200" cy="200" r="180" fill="url(#hg)"/>
              <circle cx="200" cy="200" r="160" fill="#000000"/>
              <circle cx="200" cy="200" r="148" fill="#FFFFFF"/>
              <g transform="translate(200,200) scale(1.28)">
                <rect x="-70" y="-52" width="140" height="100" rx="14" fill="none" stroke="#E31E24" strokeWidth="8"/>
                <circle cx="-52" cy="-34" r="5" fill="#E31E24"/><circle cx="-32" cy="-34" r="5" fill="#E31E24"/>
                <path d="M-8 -28 L8 -28 L8 -10 L26 -10 L26 6 L8 6 L8 40 L-8 40 L-8 6 L-26 6 L-26 -10 L-8 -10 Z" fill="#E31E24"/>
              </g>
            </svg>
            <div className="font-['Fraunces'] font-semibold text-[19px]">
              Pisairtel<span className="text-[#e31e24] font-bold text-[11px] tracking-[0.06em] align-middle ml-0.5">CMS</span>
            </div>
          </Link>
          <div className="flex items-center gap-7">
            <a href="#features" className="hidden md:inline text-[13.5px] text-[#5b5c63] font-medium hover:text-[#15161a] transition-colors">Features</a>
            <a href="#showcase" className="hidden md:inline text-[13.5px] text-[#5b5c63] font-medium hover:text-[#15161a] transition-colors">How it works</a>
            <a href="#pricing" className="hidden md:inline text-[13.5px] text-[#5b5c63] font-medium hover:text-[#15161a] transition-colors">Pricing</a>
            <div className="flex items-center gap-2.5">
              <Link href="/login" className="text-[13.5px] font-semibold px-5 py-2.5 rounded-md border border-[#d5cfc0] text-[#15161a] hover:border-[#15161a] transition-colors">Sign in</Link>
              <Link href="/auth/register" className="text-[13.5px] font-semibold px-5 py-2.5 rounded-md bg-[#e31e24] text-white hover:bg-[#cf1a1f] hover:-translate-y-px hover:shadow-lg hover:shadow-red-500/30 transition-all">Get started</Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-22 pb-10 overflow-hidden">
        <div className="absolute rounded-full blur-[70px] opacity-55 z-0 w-[420px] h-[420px] top-[-140px] right-[-60px]" style={{ background: 'radial-gradient(circle,#fbe6ee 0%,transparent 72%)', animation: 'floatA 24s ease-in-out infinite' }} />
        <div className="absolute rounded-full blur-[70px] opacity-55 z-0 w-[360px] h-[360px] bottom-[-120px] left-[18%]" style={{ background: 'radial-gradient(circle,#fdecd0 0%,transparent 72%)', animation: 'floatB 28s ease-in-out infinite' }} />
        <div className="max-w-[1180px] mx-auto px-8 flex gap-10 items-center relative z-1 max-md:flex-col">
          <div className="w-1/2 max-md:w-full relative z-30 p-6 rounded-2xl bg-[#fbfaf6]/80 backdrop-blur-sm border border-white/15 shadow-sm">
            <div className="reveal in inline-flex items-center font-['JetBrains_Mono'] text-[11.5px] tracking-[0.16em] uppercase text-[#9b9a94] mb-6 border border-[#d5cfc0]/30 rounded-full px-3.5 py-1.5 bg-white/40">
              <span className="w-1.5 h-1.5 rounded-full bg-[#e31e24] mr-2" />
              Pisairtel CMS &middot; Church Management
            </div>
            <h1 className="reveal in font-['Fraunces'] font-[560] text-[clamp(36px,4.6vw,54px)] leading-[1.08] tracking-[-0.01em]">
              Care for your congregation.<br />Let the software handle <em className="italic font-[500] text-[#e31e24]">the rest</em>.
            </h1>
            <p className="reveal in mt-6 text-[18.5px] leading-[1.7] text-[#3d3934] max-w-[540px] font-medium">
              Membership, giving, attendance, communication and more — one connected system built for churches of any size.
            </p>
            <div className="reveal in mt-8 flex flex-wrap gap-3.5">
              <Link href="/auth/register" className="inline-flex items-center gap-1.5 px-6 py-3.5 rounded-md bg-[#e31e24] text-white text-[14.5px] font-semibold hover:bg-[#cf1a1f] hover:-translate-y-px hover:shadow-lg hover:shadow-red-500/30 transition-all">
                Get Started
                <ArrowRight className="w-[15px] h-[15px]" />
              </Link>
              <a href="#showcase" className="inline-flex items-center px-6 py-3.5 rounded-md border border-[#d5cfc0] text-[#15161a] text-[14.5px] font-semibold hover:border-[#15161a] transition-colors">See How It Works</a>
            </div>
            <div className="reveal in mt-11 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-[540px]">
              <div className="flex flex-col items-start gap-2.5">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#e31e24] to-[#f7931e] flex items-center justify-center text-white shadow-md">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-[12.5px] font-medium text-[#5b5c63] leading-tight">Member<br />Management</span>
              </div>
              <div className="flex flex-col items-start gap-2.5">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#e31e24] to-[#f7931e] flex items-center justify-center text-white shadow-md">
                  <Heart className="w-5 h-5" />
                </div>
                <span className="text-[12.5px] font-medium text-[#5b5c63] leading-tight">Giving &amp;<br />Donations</span>
              </div>
              <div className="flex flex-col items-start gap-2.5">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#e31e24] to-[#f7931e] flex items-center justify-center text-white shadow-md">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <span className="text-[12.5px] font-medium text-[#5b5c63] leading-tight">Attendance &amp;<br />Events</span>
              </div>
              <div className="flex flex-col items-start gap-2.5">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#e31e24] to-[#f7931e] flex items-center justify-center text-white shadow-md">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <span className="text-[12.5px] font-medium text-[#5b5c63] leading-tight">Communication<br />Made Easy</span>
              </div>
            </div>
          </div>
          <div className="w-1/2 max-md:w-full">
            <div
              className="reveal in relative min-h-[660px] max-md:min-h-[480px] flex items-center justify-end max-md:justify-center -mr-[88px] max-md:mr-0"
              ref={stackRef}
            >
              <div
                className="absolute w-[690px] h-[490px] right-[42px] top-1/2 -translate-y-1/2 rounded-full blur-[5px] max-md:hidden -z-10"
                style={{
                  background:
                    'radial-gradient(circle, rgba(255,255,255,.92) 0% 25%, rgba(255,237,225,.56) 46%, rgba(237,28,36,.055) 68%, transparent 74%)',
                }}
              />
              <Image
                src="/hero-dashboard.png"
                alt="Pisairtel CMS church management illustration"
                width={850}
                height={600}
                unoptimized
                className="w-full md:w-[56vw] md:max-w-[850px] h-auto relative z-0 translate-y-[8px]"
                style={{
                  filter: 'drop-shadow(0 30px 48px rgba(49,35,19,.13)) saturate(.98) contrast(1.01)',
                }}
                priority
              />

              <div className="absolute right-[105px] top-[106px] w-[205px] z-20 p-4 rounded-[14px] border border-[rgba(221,211,197,.9)] bg-[rgba(255,253,249,.88)] backdrop-blur-md shadow-[0_18px_40px_rgba(37,27,17,.11)] max-md:hidden">
                <div className="flex items-center gap-2 text-[11px] tracking-[0.12em] uppercase text-[#777066]">
                  <span className="w-2 h-2 rounded-full bg-[#38b26d] shadow-[0_0_0_4px_rgba(56,178,109,.12)]" />
                  Live Church Data
                </div>
                <div className="mt-2 font-['Fraunces'] text-lg leading-tight font-bold text-[#15161a]">
                  Everything in one place.
                </div>
                <div className="mt-1 text-xs leading-relaxed text-[#8a8176]">
                  Members, giving, attendance, events and communication stay connected.
                </div>
              </div>

              <div className="absolute right-[36px] bottom-[125px] z-20 inline-flex items-center gap-2.5 px-3 py-2.5 rounded-full bg-[#161616] text-white text-xs shadow-[0_14px_30px_rgba(0,0,0,.18)] max-md:hidden">
                <span className="w-6 h-6 rounded-full bg-gradient-to-br from-[#e31e24] to-[#ff7b10] flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
                </span>
                <span className="font-['Fraunces'] text-[13px] leading-tight">
                  <strong>Built for churches</strong>
                  <br />Simple to use every day
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="py-7 border-y border-[#e6e2d8] bg-white/50">
        <div className="max-w-[1180px] mx-auto px-8 flex flex-wrap items-center justify-center gap-x-9 gap-y-2 font-['JetBrains_Mono'] text-[11px] tracking-[0.12em] uppercase text-[#9b9a94]">
          <span>Trusted by congregations across Nigeria</span>
          <span className="text-[#d5cfc0]">&middot;</span>
          <span>Built for churches of every size</span>
          <span className="text-[#d5cfc0]">&middot;</span>
          <span>Secure cloud hosting</span>
          <span className="text-[#d5cfc0]">&middot;</span>
          <span>Cancel anytime</span>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-22">
        <div className="max-w-[1180px] mx-auto px-8">
          <div className="reveal mb-14 max-w-[640px]">
            <div className="font-['JetBrains_Mono'] text-[11.5px] tracking-[0.16em] uppercase text-[#9b9a94] mb-3">/ features</div>
            <h2 className="font-['Fraunces'] font-[560] text-[clamp(28px,3.6vw,42px)] leading-[1.12] tracking-[-0.01em]">
              Everything you need on <em className="italic font-[500] text-[#e31e24]">Sunday</em>, and the rest of the week.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-[#e6e2d8] border border-[#e6e2d8] rounded-2xl overflow-hidden">
            {features.map((f) => {
              const Icon = f.icon
              return (
                <div key={f.title} className="reveal group bg-[#faf9f5] p-7 hover:bg-white transition-colors duration-300">
                  <div className="w-11 h-11 rounded-lg bg-white border border-[#e6e2d8] flex items-center justify-center mb-4 group-hover:border-[#e31e24] group-hover:shadow-md transition-all">
                    <Icon className="w-[18px] h-[18px] text-[#e31e24]" />
                  </div>
                  <h3 className="font-['Fraunces'] font-semibold text-[18px] mb-2">{f.title}</h3>
                  <p className="text-[14.5px] leading-[1.6] text-[#5b5c63]">{f.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Showcase */}
      <section id="showcase" className="py-22 bg-white border-y border-[#e6e2d8]">
        <div className="max-w-[1180px] mx-auto px-8 grid lg:grid-cols-2 gap-14 items-center">
          <div className="reveal">
            <div className="font-['JetBrains_Mono'] text-[11.5px] tracking-[0.16em] uppercase text-[#9b9a94] mb-3">/ how it works</div>
            <h2 className="font-['Fraunces'] font-[560] text-[clamp(28px,3.6vw,42px)] leading-[1.12] mb-5 tracking-[-0.01em]">
              From <em className="italic font-[500] text-[#e31e24]">visitor</em> to <em className="italic font-[500] text-[#e31e24]">member</em>, in one connected flow.
            </h2>
            <p className="text-[16px] leading-[1.65] text-[#5b5c63] mb-7 max-w-[480px]">
              A first-time visitor checks in on Sunday. By Monday, they're in the directory, assigned to a small group, and on the pastor's follow-up list — automatically.
            </p>
            <ul className="space-y-3.5 mb-8">
              {[
                { step: '01', text: 'Visitor checks in via phone or kiosk' },
                { step: '02', text: 'Profile created automatically in the directory' },
                { step: '03', text: 'Assigned to a small group based on location or age' },
                { step: '04', text: 'Pastor gets a follow-up reminder by Tuesday' },
              ].map((s) => (
                <li key={s.step} className="flex items-start gap-4">
                  <span className="font-['JetBrains_Mono'] text-[12px] text-[#e31e24] mt-0.5 shrink-0">{s.step}</span>
                  <span className="text-[15px] text-[#15161a] leading-[1.55]">{s.text}</span>
                </li>
              ))}
            </ul>
            <Link href="/auth/register" className="inline-flex items-center gap-1.5 font-semibold text-[14px] text-[#e31e24] hover:gap-2.5 transition-all">
              See the full workflow
              <ArrowRight className="w-[14px] h-[14px]" />
            </Link>
          </div>
          <div className="reveal relative">
            <div className="rounded-2xl border border-[#e6e2d8] bg-[#faf9f5] p-6 shadow-xl">
              <div className="flex items-center justify-between mb-5">
                <div className="font-['JetBrains_Mono'] text-[11px] tracking-[0.1em] uppercase text-[#9b9a94]">Sunday &middot; Check-in</div>
                <div className="flex items-center font-['JetBrains_Mono'] text-[10px] text-[#2fae66]"><span className="w-1.5 h-1.5 rounded-full bg-[#2fae66] mr-1.5" style={{ boxShadow: '0 0 0 3px rgba(47,174,102,.15)' }} />Live</div>
              </div>
              <div className="space-y-3">
                {[
                  { name: 'Grace Okoro', detail: 'First-time visitor', tag: 'New', color: '#e31e24' },
                  { name: 'Emeka Nwosu', detail: 'Member &middot; Men\'s Fellowship', tag: 'Checked in', color: '#2fae66' },
                  { name: 'Aisha Bello', detail: 'First-time visitor', tag: 'New', color: '#e31e24' },
                  { name: 'David Okafor', detail: 'Member &middot; Choir', tag: 'Checked in', color: '#2fae66' },
                ].map((p, i) => (
                  <div key={i} className="flex items-center gap-3 bg-white rounded-lg border border-[#e6e2d8] px-4 py-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#f7931e] to-[#e8286e] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-semibold text-[#15161a] truncate">{p.name}</div>
                      <div className="text-[12px] text-[#9b9a94] truncate" dangerouslySetInnerHTML={{ __html: p.detail }} />
                    </div>
                    <span className="text-[10px] font-['JetBrains_Mono'] uppercase tracking-[0.1em] px-2 py-1 rounded" style={{ color: p.color, background: p.color + '14' }}>{p.tag}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 pt-4 border-t border-[#e6e2d8] flex items-center justify-between">
                <span className="text-[12px] text-[#9b9a94] font-['JetBrains_Mono']">4 checked in &middot; 2 new</span>
                <span className="text-[12px] text-[#e31e24] font-semibold cursor-pointer hover:underline">View all</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quote */}
      <section className="py-22">
        <div className="max-w-[820px] mx-auto px-8 text-center">
          <div className="reveal">
            <div className="text-[#e31e24] text-5xl font-['Fraunces'] leading-none mb-4">&ldquo;</div>
            <blockquote className="font-['Fraunces'] font-[450] text-[clamp(22px,2.8vw,32px)] leading-[1.35] tracking-[-0.005em] text-[#15161a]">
              We replaced three spreadsheets and a WhatsApp group with Pisairtel CMS. Now I actually know who's here on Sunday and who needs a call on Monday.
            </blockquote>
            <div className="mt-7 flex items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#f7931e] to-[#e8286e]" />
              <div className="text-left">
                <div className="text-[14px] font-semibold text-[#15161a]">Pastor Samuel Adeyemi</div>
                <div className="text-[12px] text-[#9b9a94] font-['JetBrains_Mono']">Grace Community Church, Lagos</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-22 bg-white border-y border-[#e6e2d8]">
        <div className="max-w-[1180px] mx-auto px-8">
          <div className="reveal mb-14 max-w-[640px]">
            <div className="font-['JetBrains_Mono'] text-[11.5px] tracking-[0.16em] uppercase text-[#9b9a94] mb-3">/ pricing</div>
            <h2 className="font-['Fraunces'] font-[560] text-[clamp(28px,3.6vw,42px)] leading-[1.12] tracking-[-0.01em]">
              Simple plans. <em className="italic font-[500] text-[#e31e24]">No surprises.</em>
            </h2>
          </div>

          {pricingError && (
            <div className="mb-6 rounded-lg border border-[#e6e2d8] bg-[#faf9f5] px-4 py-3 text-sm text-[#9b9a94]">
              {pricingError}
            </div>
          )}

          {freePlan && paidPlans.length > 0 && (
            <div className="reveal mb-6 flex items-center justify-between gap-4 rounded-xl border border-[#2fae66]/30 bg-[#2fae66]/5 px-5 py-4">
              <div>
                <p className="font-semibold text-[15px] text-[#15161a]">
                  {freePlan.trialDays ? `${freePlan.trialDays}-day free trial` : 'Free plan'} — {freePlan.name}
                </p>
                <p className="text-[13px] text-[#5b5c63] mt-0.5">{freePlan.description}</p>
              </div>
              <Link
                href={`/auth/register?plan=${freePlan.id}`}
                className="shrink-0 px-4 py-2.5 rounded-lg bg-[#2fae66] text-white text-[13.5px] font-semibold hover:bg-[#289a59] transition-colors"
              >
                Start Free
              </Link>
            </div>
          )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">
            {plansToRender.map((plan, index) => {
              const formatter = currencyFormatter(plan.currency)
              const planPrice = plan.discountedPrice ?? plan.price
              const displayedPrice = formatter.format(planPrice)
              const hasDiscount =
                plan.discountedPrice !== undefined && plan.discountedPrice < plan.price
              const cadenceLabel =
                plan.billingCycle === 'annual'
                  ? '/year'
                  : plan.billingCycle === 'lifetime'
                    ? 'one-time'
                    : '/month'
              const secondaryLabel =
                plan.billingCycle === 'lifetime'
                  ? 'Lifetime license'
                  : plan.billingCycle === 'annual'
                    ? 'Billed annually'
                    : 'Billed monthly'
              const ctaLabel =
                plan.cta ||
                (plan.billingCycle === 'lifetime'
                  ? 'Get Lifetime Access'
                  : planPrice <= 0
                    ? 'Start Free'
                    : 'Get Started')
              const isFreePlan = planPrice <= 0

              return (
                <div
                  key={plan.id || index}
                  className={`reveal relative rounded-2xl p-6 border transition-all duration-300 hover:-translate-y-1 flex flex-col h-full ${
                    plan.popular
                      ? 'border-[#e31e24] shadow-xl bg-[#faf9f5]'
                      : 'border-[#e6e2d8] shadow-sm hover:shadow-md bg-white'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#e31e24] text-white text-[11px] font-semibold rounded-full font-['JetBrains_Mono'] uppercase tracking-[0.08em]">
                      Most Popular
                    </div>
                  )}
                  <div className="mb-5">
                    <h3 className="font-['Fraunces'] font-semibold text-[20px] text-[#15161a] mb-2">{plan.name}</h3>
                    <div className="flex items-baseline gap-1.5 mb-1">
                      <span className="font-['Fraunces'] font-bold text-[32px] text-[#15161a]">{displayedPrice}</span>
                      <span className="text-[13px] text-[#9b9a94] font-semibold">{cadenceLabel}</span>
                    </div>
                    {hasDiscount && (
                      <div className="flex items-center gap-2 text-[12px] text-[#9b9a94] mb-1">
                        <span className="line-through">{formatter.format(plan.price)}</span>
                        <span className="font-semibold text-[#2fae66]">{plan.promoLabel}</span>
                      </div>
                    )}
                    <p className="text-[13.5px] text-[#5b5c63]">{plan.description}</p>
                    <p className="text-[11px] text-[#9b9a94] mt-1 font-['JetBrains_Mono']">{secondaryLabel}</p>
                  </div>
                  <ul className="space-y-2.5 mb-6 flex-1">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <svg className="w-[15px] h-[15px] text-[#e31e24] mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-[13.5px] text-[#15161a]">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  {isFreePlan ? (
                    <Link
                      href={`/auth/register?plan=${plan.id}`}
                      className={`block w-full text-center py-3 rounded-lg font-semibold text-[14px] transition-all mt-auto ${
                        plan.popular
                          ? 'bg-[#e31e24] text-white hover:bg-[#cf1a1f] shadow-md'
                          : 'bg-[#15161a] text-white hover:bg-[#2a2b30]'
                      }`}
                    >
                      {ctaLabel}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openCheckout(plan)}
                      className={`w-full text-center py-3 rounded-lg font-semibold text-[14px] transition-all mt-auto ${
                        plan.popular
                          ? 'bg-[#e31e24] text-white hover:bg-[#cf1a1f] shadow-md'
                          : 'bg-[#15161a] text-white hover:bg-[#2a2b30]'
                      }`}
                    >
                      {ctaLabel}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {isCheckoutOpen && selectedPlan && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeCheckout} />
          <div className="relative max-w-2xl w-full bg-white rounded-2xl shadow-2xl border border-[#e6e2d8] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e6e2d8]">
              <div>
                <p className="font-['JetBrains_Mono'] text-[11px] uppercase tracking-[0.16em] text-[#9b9a94] mb-1">Secure Checkout</p>
                <h3 className="font-['Fraunces'] font-semibold text-[22px] text-[#15161a]">{selectedPlan.name}</h3>
              </div>
              <button
                type="button"
                className="text-[#9b9a94] hover:text-[#15161a] transition-colors text-xl"
                onClick={closeCheckout}
                aria-label="Close checkout"
              >
                ✕
              </button>
            </div>

            <div className="px-6 pt-6 pb-2 bg-[#faf9f5] border-b border-[#e6e2d8]">
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <p className="font-['JetBrains_Mono'] text-[10px] uppercase tracking-[0.1em] text-[#9b9a94]">Amount</p>
                  <p className="font-['Fraunces'] font-bold text-[28px] text-[#15161a]">
                    {currencyFormatter(selectedPlan.currency).format(selectedPlan.discountedPrice ?? selectedPlan.price)}
                  </p>
                </div>
                <div className="flex-1">
                  <p className="font-['JetBrains_Mono'] text-[10px] uppercase tracking-[0.1em] text-[#9b9a94]">Billing</p>
                  <p className="text-[14px] font-semibold text-[#15161a]">
                    {selectedPlan.billingCycle === 'annual'
                      ? 'Billed annually'
                      : selectedPlan.billingCycle === 'lifetime'
                        ? 'One-time payment'
                        : 'Billed monthly'}
                  </p>
                </div>
                {selectedPlan.promoLabel && (
                  <div className="px-3 py-1 rounded-full bg-[#2fae66]/10 text-[#2fae66] text-[12px] font-semibold">
                    {selectedPlan.promoLabel}
                  </div>
                )}
              </div>
            </div>

            <form onSubmit={handleCheckoutSubmit} className="px-6 py-6 space-y-5">
              {checkoutError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {checkoutError}
                </div>
              )}
              {checkoutMessage && (
                <div className="rounded-lg border border-[#2fae66]/20 bg-[#2fae66]/5 px-4 py-3 text-sm text-[#2fae66]">
                  {checkoutMessage}
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="fullName" className="text-[13px] font-semibold text-[#15161a]">
                    Full name *
                  </label>
                  <input
                    id="fullName"
                    name="fullName"
                    type="text"
                    placeholder="Pastor Daniel Obasi"
                    value={checkoutForm.fullName}
                    onChange={handleCheckoutFieldChange}
                    className="w-full rounded-lg border border-[#e6e2d8] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#e31e24] focus:border-transparent transition-shadow text-[14px]"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="email" className="text-[13px] font-semibold text-[#15161a]">
                    Email *
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@church.org"
                    value={checkoutForm.email}
                    onChange={handleCheckoutFieldChange}
                    className="w-full rounded-lg border border-[#e6e2d8] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#e31e24] focus:border-transparent transition-shadow text-[14px]"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="churchName" className="text-[13px] font-semibold text-[#15161a]">
                    Church name
                  </label>
                  <input
                    id="churchName"
                    name="churchName"
                    type="text"
                    placeholder="City of Light Church"
                    value={checkoutForm.churchName}
                    onChange={handleCheckoutFieldChange}
                    className="w-full rounded-lg border border-[#e6e2d8] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#e31e24] focus:border-transparent transition-shadow text-[14px]"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="phone" className="text-[13px] font-semibold text-[#15161a]">
                    Phone (optional)
                  </label>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      placeholder="+234 801 234 5678"
                      value={checkoutForm.phone}
                      onChange={handleCheckoutFieldChange}
                      className="w-full rounded-lg border border-[#e6e2d8] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#e31e24] focus:border-transparent transition-shadow text-[14px]"
                    />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="promoCode" className="text-[13px] font-semibold text-[#15161a]">
                    Promo code
                  </label>
                  <input
                    id="promoCode"
                    name="promoCode"
                    type="text"
                    placeholder="EASTER25"
                    value={checkoutForm.promoCode}
                    onChange={handleCheckoutFieldChange}
                    className="w-full rounded-lg border border-[#e6e2d8] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#e31e24] focus:border-transparent transition-shadow uppercase tracking-widest text-[13px]"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="notes" className="text-[13px] font-semibold text-[#15161a]">
                    Notes
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    placeholder="Key context for our team…"
                    value={checkoutForm.notes}
                    onChange={handleCheckoutFieldChange}
                    rows={3}
                    className="w-full rounded-lg border border-[#e6e2d8] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#e31e24] focus:border-transparent transition-shadow resize-none text-[14px]"
                  />
                </div>
              </div>

              <div className="flex flex-col md:flex-row md:items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={checkoutStatus === 'submitting'}
                  className="inline-flex justify-center items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white bg-[#e31e24] hover:bg-[#cf1a1f] shadow-md disabled:opacity-60 disabled:cursor-not-allowed transition-all text-[14px]"
                >
                  {checkoutStatus === 'submitting' ? 'Initializing payment…' : 'Continue to payment'}
                </button>
                <button
                  type="button"
                  className="text-[#5b5c63] hover:text-[#15161a] font-semibold text-[14px]"
                  onClick={closeCheckout}
                  disabled={checkoutStatus === 'submitting'}
                >
                  Cancel
                </button>
              </div>

              <p className="text-[12px] text-[#9b9a94]">
                By continuing you agree to Pisairtel CMS's terms of service and authorize us to redirect you to our
                secure payment partner.
              </p>
            </form>
          </div>
        </div>
      )}

      {/* Closing CTA */}
      <section className="py-22">
        <div className="max-w-[1180px] mx-auto px-8">
          <div className="reveal relative overflow-hidden rounded-3xl bg-[#15161a] p-12 md:p-16 lg:p-20 text-center">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full blur-[80px] opacity-30" style={{ background: 'radial-gradient(circle,#e31e24 0%,transparent 70%)' }} />
            <div className="absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full blur-[80px] opacity-20" style={{ background: 'radial-gradient(circle,#f7931e 0%,transparent 70%)' }} />
            <div className="relative z-10">
              <h2 className="font-['Fraunces'] font-[560] text-[clamp(28px,3.8vw,44px)] leading-[1.12] mb-5 tracking-[-0.01em] text-white">
                Ready to care for your <em className="italic font-[500] text-[#f7931e]">congregation</em>?
              </h2>
              <p className="text-[16px] md:text-[18px] leading-[1.6] mb-8 text-white/70 max-w-[520px] mx-auto">
                Start your free trial today. No credit card required. Set up in minutes.
              </p>
              <div className="flex flex-col sm:flex-row gap-3.5 justify-center">
                <Link
                  href="/auth/register"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-lg bg-[#e31e24] text-white font-semibold text-[15px] hover:bg-[#cf1a1f] hover:-translate-y-px hover:shadow-lg hover:shadow-red-500/30 transition-all"
                >
                  Start free trial
                  <ArrowRight className="w-[15px] h-[15px]" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center px-7 py-3.5 rounded-lg border border-white/20 text-white font-semibold text-[15px] hover:border-white/40 transition-colors"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#e6e2d8] bg-[#faf9f5]">
        <div className="max-w-[1180px] mx-auto px-8 py-14">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div>
              <Link href="/" className="flex items-center gap-2.5 mb-5">
                <svg width="28" height="28" viewBox="0 0 400 400" className="w-7 h-7 block">
                  <defs><linearGradient id="fg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#F7C93C"/><stop offset="28%" stopColor="#F7931E"/>
                    <stop offset="55%" stopColor="#E8286E"/><stop offset="80%" stopColor="#C0208A"/><stop offset="100%" stopColor="#8E1FA0"/>
                  </linearGradient></defs>
                  <circle cx="200" cy="200" r="180" fill="url(#fg)"/>
                  <circle cx="200" cy="200" r="160" fill="#000000"/>
                  <circle cx="200" cy="200" r="148" fill="#FFFFFF"/>
                  <g transform="translate(200,200) scale(1.28)">
                    <rect x="-70" y="-52" width="140" height="100" rx="14" fill="none" stroke="#E31E24" strokeWidth="8"/>
                    <circle cx="-52" cy="-34" r="5" fill="#E31E24"/><circle cx="-32" cy="-34" r="5" fill="#E31E24"/>
                    <path d="M-8 -28 L8 -28 L8 -10 L26 -10 L26 6 L8 6 L8 40 L-8 40 L-8 6 L-26 6 L-26 -10 L-8 -10 Z" fill="#E31E24"/>
                  </g>
                </svg>
                <div className="font-['Fraunces'] font-semibold text-[17px]">
                  Pisairtel<span className="text-[#e31e24] font-bold text-[10px] tracking-[0.06em] align-middle ml-0.5">CMS</span>
                </div>
              </Link>
              <p className="text-[13px] text-[#9b9a94] leading-[1.6] max-w-[200px]">
                Church management software built for how churches actually run.
              </p>
            </div>
            <div>
              <h3 className="font-['JetBrains_Mono'] text-[11px] uppercase tracking-[0.12em] text-[#9b9a94] mb-4">Product</h3>
              <ul className="space-y-2.5">
                <li><a href="#features" className="text-[14px] text-[#5b5c63] hover:text-[#15161a] transition-colors">Features</a></li>
                <li><a href="#pricing" className="text-[14px] text-[#5b5c63] hover:text-[#15161a] transition-colors">Pricing</a></li>
                <li><a href="#showcase" className="text-[14px] text-[#5b5c63] hover:text-[#15161a] transition-colors">How it works</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-['JetBrains_Mono'] text-[11px] uppercase tracking-[0.12em] text-[#9b9a94] mb-4">Company</h3>
              <ul className="space-y-2.5">
                <li><a href="#" className="text-[14px] text-[#5b5c63] hover:text-[#15161a] transition-colors">About</a></li>
                <li><a href="#" className="text-[14px] text-[#5b5c63] hover:text-[#15161a] transition-colors">Contact</a></li>
                <li><a href="#" className="text-[14px] text-[#5b5c63] hover:text-[#15161a] transition-colors">Blog</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-['JetBrains_Mono'] text-[11px] uppercase tracking-[0.12em] text-[#9b9a94] mb-4">Legal</h3>
              <ul className="space-y-2.5">
                <li><a href="#" className="text-[14px] text-[#5b5c63] hover:text-[#15161a] transition-colors">Privacy</a></li>
                <li><a href="#" className="text-[14px] text-[#5b5c63] hover:text-[#15161a] transition-colors">Terms</a></li>
                <li><a href="#" className="text-[14px] text-[#5b5c63] hover:text-[#15161a] transition-colors">Security</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-[#e6e2d8] pt-7 flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-[13px] text-[#9b9a94]">
              &copy; {new Date().getFullYear()} Pisairtel Church Management System. All rights reserved.
            </p>
            <div className="flex items-center gap-4 font-['JetBrains_Mono'] text-[11px] text-[#9b9a94]">
              <span className="flex items-center gap-1.5"><ShieldCheck className="w-[13px] h-[13px]" /> SOC 2 ready</span>
              <span className="flex items-center gap-1.5"><Lock className="w-[13px] h-[13px]" /> 256-bit encryption</span>
              <span className="flex items-center gap-1.5"><RefreshCw className="w-[13px] h-[13px]" /> 99.9% uptime</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
