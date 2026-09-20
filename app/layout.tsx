import type { Metadata, Viewport } from 'next'
import { Fraunces } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const fraunces = Fraunces({ subsets: ['latin'], display: 'swap' })

export const dynamic = 'force-dynamic'

const siteUrl = process.env.NEXTAUTH_URL || 'https://pisairtelcms.com'
const siteName = 'pi-CMS'
const siteTitle = 'pi-CMS — Church Management System'
const siteDescription =
  'Pisairtel Church Management System (pi-CMS): a comprehensive church management platform with AI-powered discipleship, member management, livestreaming, events, giving, and community engagement tools.'

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: siteTitle,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: siteUrl,
  description: siteDescription,
  offers: { '@type': 'Offer', category: 'SaaS' },
  publisher: { '@type': 'Organization', name: 'Pisairtel', url: siteUrl },
}

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  applicationName: siteName,
  keywords: [
    'church management system',
    'church software',
    'church management platform',
    'member management',
    'church livestream',
    'church events',
    'online giving',
    'church attendance',
    'discipleship',
    'pi-CMS',
    'Pisairtel',
  ],
  authors: [{ name: 'Pisairtel' }],
  creator: 'Pisairtel',
  publisher: 'Pisairtel',
  manifest: '/manifest.webmanifest',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName,
    title: siteTitle,
    description: siteDescription,
    url: '/',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: siteTitle,
    description: siteDescription,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon', type: 'image/png' }],
  },
  appleWebApp: { capable: true, title: siteName, statusBarStyle: 'default' },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: '#4f46e5',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,450;0,9..144,560;0,9..144,620;1,9..144,500&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={fraunces.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
