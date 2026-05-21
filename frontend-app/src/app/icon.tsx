import { ImageResponse } from "next/og"

export const size = { width: 32, height: 32 }
export const contentType = "image/png"

export default function Icon() {
  return new ImageResponse(
    (
      <svg viewBox="0 0 28 28" width="32" height="32">
        <rect width="28" height="28" rx="8" fill="#b8643a" />
        <path
          d="M 8.5 7.5 L 8.5 15.5 A 5.5 5.5 0 0 0 19.5 15.5 L 19.5 7.5"
          stroke="#f4ede0"
          stroke-width="2.3"
          fill="none"
          stroke-linecap="round"
        />
        <circle cx="14" cy="21.2" r="0.95" fill="#f4ede0" />
      </svg>
    ),
    { ...size }
  )
}
