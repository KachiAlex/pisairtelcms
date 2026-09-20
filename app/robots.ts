import type { MetadataRoute } from 'next'

const siteUrl = process.env.NEXTAUTH_URL || 'https://pisairtelcms.com'

// The authenticated app surface redirects to login anyway; disallow keeps
// crawlers from spending budget on redirects and keeps private paths out
// of the index even if they leak into external links.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/admin',
        '/superadmin',
        '/dashboard',
        '/accounting',
        '/ai',
        '/analytics',
        '/attendance',
        '/branches',
        '/check-in',
        '/community',
        '/digital-school',
        '/events',
        '/family',
        '/giving',
        '/groups',
        '/leaderboard',
        '/livestream',
        '/livestreams',
        '/meetings',
        '/membership-card',
        '/messages',
        '/payroll',
        '/prayer',
        '/reading-plans',
        '/reports',
        '/sermons',
        '/settings',
        '/subscription',
        '/surveys',
        '/unit',
        '/users',
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
