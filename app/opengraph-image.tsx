import { ImageResponse } from 'next/og'
import { LOGO_DATA_URI } from '@/lib/branding/constants'

export const runtime = 'edge'

export const alt = 'Pisairtel CMS — Church Management, Simplified'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#15161a',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_DATA_URI} width={168} height={168} alt="" style={{ marginBottom: 40 }} />
        <div
          style={{
            fontSize: 92,
            fontWeight: 800,
            color: 'white',
            lineHeight: 1,
            letterSpacing: -2,
          }}
        >
          Pisairtel CMS
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 38,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.85)',
          }}
        >
          Church Management, Simplified
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
