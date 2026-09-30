export type TenantBrand = {
  id?: string | null
  name: string
  tagline: string
  logo: string
  primaryColor: string
  secondaryColor: string
  accentColor?: string
  brandFont?: string
  customDomain?: string | null
}

export const DEFAULT_TENANT_BRAND: TenantBrand = {
  name: 'Pisairtel CMS',
  tagline: 'Modern Church Management & Discipleship Platform',
  logo: '/logo.svg',
  primaryColor: '#e31e24',
  secondaryColor: '#15161a',
  accentColor: '#faf9f5',
  id: null,
  customDomain: null,
}

/** Canonical brand mark (gradient ring + red cross). Single source for
 *  favicon, app icons, OG image, and in-app logos. */
export const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#F7C93C"/><stop offset="28%" stop-color="#F7931E"/><stop offset="55%" stop-color="#E8286E"/><stop offset="80%" stop-color="#C0208A"/><stop offset="100%" stop-color="#8E1FA0"/></linearGradient></defs><circle cx="200" cy="200" r="180" fill="url(#g)"/><circle cx="200" cy="200" r="160" fill="#000000"/><circle cx="200" cy="200" r="148" fill="#FFFFFF"/><g transform="translate(200,200) scale(1.28)"><rect x="-70" y="-52" width="140" height="100" rx="14" fill="none" stroke="#E31E24" stroke-width="8"/><circle cx="-52" cy="-34" r="5" fill="#E31E24"/><circle cx="-32" cy="-34" r="5" fill="#E31E24"/><path d="M-8 -28 L8 -28 L8 -10 L26 -10 L26 6 L8 6 L8 40 L-8 40 L-8 6 L-26 6 L-26 -10 L-8 -10 Z" fill="#E31E24"/></g></svg>`

/** Edge-safe data URI for embedding the mark inside next/og ImageResponse. */
export const LOGO_DATA_URI = `data:image/svg+xml;base64,${btoa(LOGO_SVG)}`
