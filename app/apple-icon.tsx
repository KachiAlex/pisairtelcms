import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const size = {
  width: 180,
  height: 180,
}

export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
          borderRadius: 40,
        }}
      >
        <div style={{ position: 'relative', width: 180, height: 180, display: 'flex' }}>
          <div
            style={{
              position: 'absolute',
              left: 39,
              top: 45,
              width: 102,
              height: 26,
              borderRadius: 7,
              background: 'white',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 56,
              top: 56,
              width: 26,
              height: 90,
              borderRadius: 7,
              background: 'white',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 99,
              top: 56,
              width: 26,
              height: 90,
              borderRadius: 7,
              background: 'white',
            }}
          />
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
