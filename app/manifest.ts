import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pisairtel Church Management System',
    short_name: 'pi-CMS',
    description:
      'Comprehensive church management platform with member management, livestreaming, events, giving, and AI-powered discipleship tools.',
    start_url: '/',
    display: 'standalone',
    background_color: '#faf9f5',
    theme_color: '#4f46e5',
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  }
}
