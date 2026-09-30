import { ImageResponse } from 'next/og'
import { LOGO_DATA_URI } from '@/lib/branding/constants'

export const runtime = 'edge'

export const size = {
  width: 512,
  height: 512,
}

export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={LOGO_DATA_URI} width={512} height={512} alt="" />
    ),
    {
      ...size,
    }
  )
}
