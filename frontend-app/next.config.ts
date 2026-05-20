import type { NextConfig } from "next"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              `default-src 'self'`,
              `script-src 'self' 'unsafe-inline' 'unsafe-eval'`,
              `style-src 'self' 'unsafe-inline'`,
              `img-src 'self' data: blob:`,
              `connect-src 'self' ${API_URL}`,
              `font-src 'self'`,
              `frame-ancestors 'none'`,
            ].join("; "),
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ]
  },
}

export default nextConfig
