import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'pi-CMS — Pisairtel Church Management System'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

function PiMark({ s }: { s: number }) {
  // Geometric pi glyph drawn from divs — no font dependency.
  const px = (v: number) => Math.round(v * s)
  return (
    <div style={{ position: 'relative', width: px(64), height: px(64), display: 'flex' }}>
      <div
        style={{
          position: 'absolute',
          left: px(14),
          top: px(16),
          width: px(36),
          height: px(9),
          borderRadius: px(2.5),
          background: 'white',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: px(20),
          top: px(22),
          width: px(9),
          height: px(30),
          borderRadius: px(2.5),
          background: 'white',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: px(35),
          top: px(22),
          width: px(9),
          height: px(30),
          borderRadius: px(2.5),
          background: 'white',
        }}
      />
    </div>
  )
}

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
          background: 'linear-gradient(135deg, #1e3a8a 0%, #4f46e5 60%, #7c3aed 100%)',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial',
        }}
      >
        <div
          style={{
            display: 'flex',
            background: 'rgba(255,255,255,0.14)',
            borderRadius: 44,
            marginBottom: 48,
          }}
        >
          <PiMark s={3} />
        </div>
        <div
          style={{
            fontSize: 96,
            fontWeight: 800,
            color: 'white',
            lineHeight: 1,
            letterSpacing: -2,
          }}
        >
          pi-CMS
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
