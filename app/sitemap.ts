import type { MetadataRoute } from 'next'

const siteUrl = process.env.NEXTAUTH_URL || 'https://pisairtelcms.com'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, changeFrequency: 'weekly', priority: 1 },
    { url: `${siteUrl}/auth/register`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${siteUrl}/auth/login`, changeFrequency: 'monthly', priority: 0.3 },
  ]
}
