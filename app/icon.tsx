import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const size = {
  width: 512,
  height: 512,
}

export const contentType = 'image/png'

export default function Icon() {
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
          borderRadius: 112,
        }}
      >
        <div style={{ position: 'relative', width: 512, height: 512, display: 'flex' }}>
          <div
            style={{
              position: 'absolute',
              left: 112,
              top: 128,
              width: 288,
              height: 72,
              borderRadius: 20,
              background: 'white',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 160,
              top: 160,
              width: 72,
              height: 256,
              borderRadius: 20,
              background: 'white',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 280,
              top: 160,
              width: 72,
              height: 256,
              borderRadius: 20,
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
