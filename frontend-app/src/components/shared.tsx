"use client"

import React, { useMemo } from "react"

type IconProps = {
  size?: number
  style?: React.CSSProperties
  className?: string
}

export const I = {
  Arrow: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width={p.size ?? 16} height={p.size ?? 16} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={p.style} className={p.className}>
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  ),
  ArrowLeft: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width={p.size ?? 16} height={p.size ?? 16} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={p.style} className={p.className}>
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  ),
  Check: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width={p.size ?? 14} height={p.size ?? 14} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={p.style} className={p.className}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
  Lock: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width={p.size ?? 16} height={p.size ?? 16} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={p.style} className={p.className}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  ),
  Shield: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width={p.size ?? 16} height={p.size ?? 16} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={p.style} className={p.className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  Sparkles: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width={p.size ?? 14} height={p.size ?? 14} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={p.style} className={p.className}>
      <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
      <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z" />
    </svg>
  ),
  Calendar: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width={p.size ?? 14} height={p.size ?? 14} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={p.style} className={p.className}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  ),
  Mail: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width={p.size ?? 16} height={p.size ?? 16} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={p.style} className={p.className}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 7 9-7" />
    </svg>
  ),
  Bell: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width={p.size ?? 14} height={p.size ?? 14} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={p.style} className={p.className}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8z" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  ),
  Search: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width={p.size ?? 14} height={p.size ?? 14} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={p.style} className={p.className}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  ),
  CheckSm: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width={p.size ?? 12} height={p.size ?? 12} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={p.style} className={p.className}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
  Plus: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width={p.size ?? 14} height={p.size ?? 14} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={p.style} className={p.className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Eye: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width={p.size ?? 16} height={p.size ?? 16} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={p.style} className={p.className}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  EyeOff: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width={p.size ?? 16} height={p.size ?? 16} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={p.style} className={p.className}>
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a19.77 19.77 0 0 1 4.06-5.94" />
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a19.78 19.78 0 0 1-3.17 4.5" />
      <path d="M1 1l22 22" />
      <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" />
    </svg>
  ),
  Refresh: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width={p.size ?? 13} height={p.size ?? 13} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={p.style} className={p.className}>
      <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  ),
  X: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width={p.size ?? 14} height={p.size ?? 14} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={p.style} className={p.className}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  ),
}

export const Logo = {
  WhatsApp: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width={p.size ?? 18} height={p.size ?? 18} fill="currentColor" style={p.style} className={p.className}>
      <path d="M17.5 14.4c-.3-.15-1.77-.87-2.05-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.5-.9-.8-1.5-1.78-1.67-2.08-.17-.3-.02-.45.13-.6.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.67-1.62-.92-2.22-.25-.58-.5-.5-.67-.51l-.57-.01c-.2 0-.52.07-.8.37s-1.05 1.03-1.05 2.5 1.07 2.9 1.22 3.1c.15.2 2.12 3.23 5.15 4.53.72.31 1.28.5 1.72.64.72.23 1.38.2 1.9.12.58-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35z" />
      <path d="M12 2C6.48 2 2 6.48 2 12c0 1.95.56 3.77 1.53 5.32L2 22l4.79-1.5A9.96 9.96 0 0 0 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm5.83 14.6c-.25.7-1.44 1.33-2.02 1.42-.52.08-1.18.11-1.9-.12-.44-.14-1-.33-1.72-.64-3.03-1.3-5-4.33-5.15-4.53-.15-.2-1.22-1.63-1.22-3.1s.77-2.2 1.05-2.5c.28-.3.6-.37.8-.37l.57.01c.17.01.42-.07.67.51.25.6.84 2.07.92 2.22.07.15.12.33.02.53-.1.2-.15.32-.3.5-.15.17-.32.39-.45.52-.15.15-.3.3-.13.6.17.3.77 1.28 1.67 2.08 1.15 1.03 2.12 1.35 2.42 1.5.3.15.48.13.65-.07.18-.2.75-.87.95-1.17.2-.3.4-.25.67-.15.28.1 1.75.82 2.05.97.3.15.5.22.57.35.08.12.08.72-.17 1.42z" opacity="0.6" />
    </svg>
  ),
  Signal: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width={p.size ?? 18} height={p.size ?? 18} fill="currentColor" style={p.style} className={p.className}>
      <path d="M12 2C6.48 2 2 6.48 2 12c0 1.7.42 3.3 1.17 4.7L2 22l5.3-1.17A9.96 9.96 0 0 0 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm-.5 5h2v6h-2V7zm0 8h2v2h-2v-2z" />
    </svg>
  ),
  Mail: (p: IconProps) => (
    <svg viewBox="0 0 24 24" width={p.size ?? 18} height={p.size ?? 18} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={p.style} className={p.className}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3 7.5l9 6.5 9-6.5" />
    </svg>
  ),
}

export function BrandLogo({ size = 28, color = "var(--accent)", fg = "#f4ede0" }: { size?: number; color?: string; fg?: string }) {
  return (
    <svg viewBox="0 0 28 28" width={size} height={size} style={{ flexShrink: 0 }}>
      <rect width="28" height="28" rx="8" fill={color} />
      <path
        d="M 8.5 7.5 L 8.5 15.5 A 5.5 5.5 0 0 0 19.5 15.5 L 19.5 7.5"
        stroke={fg}
        strokeWidth="2.3"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="14" cy="21.2" r="0.95" fill={fg} />
    </svg>
  )
}

export function BrandMark({ size = "default" }: { size?: "default" | "small" }) {
  const sm = size === "small"
  return (
    <span className="brand">
      <BrandLogo size={sm ? 24 : 28} />
      <span className="word" style={{ fontSize: sm ? 16 : 18 }}>
        <span style={{ fontWeight: 600 }}>U</span>
        <span style={{ fontWeight: 400, color: "var(--ink-soft)" }}>Assist</span>
      </span>
    </span>
  )
}

export function FakeQR({ seed = 1, color = "var(--ink-strong)" }: { seed?: number; color?: string }) {
  const size = 21
  const cells = useMemo(() => {
    const out: { x: number; y: number }[] = []
    let s = seed * 9301 + 49297
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const isCornerArea = (cx: number, cy: number) =>
          x >= cx && x < cx + 7 && y >= cy && y < cy + 7
        if (isCornerArea(0, 0) || isCornerArea(size - 7, 0) || isCornerArea(0, size - 7)) continue
        const cx = (size - 1) / 2
        const cy = (size - 1) / 2
        if (Math.abs(x - cx) <= 2 && Math.abs(y - cy) <= 2) continue
        if (rnd() > 0.5) out.push({ x, y })
      }
    }
    return out
  }, [seed])

  const cell = 100 / size
  return (
    <svg className="qr-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
      {cells.map((c, i) => (
        <rect key={i} x={c.x * cell} y={c.y * cell} width={cell * 0.92} height={cell * 0.92} rx={cell * 0.18} fill={color} />
      ))}
      {([[0, 0], [size - 7, 0], [0, size - 7]] as [number, number][]).map(([fx, fy], i) => (
        <g key={i}>
          <rect x={fx * cell} y={fy * cell} width={cell * 7} height={cell * 7} rx={cell * 1.2} fill={color} />
          <rect x={(fx + 1) * cell} y={(fy + 1) * cell} width={cell * 5} height={cell * 5} rx={cell * 0.9} fill="var(--paper)" />
          <rect x={(fx + 2) * cell} y={(fy + 2) * cell} width={cell * 3} height={cell * 3} rx={cell * 0.6} fill={color} />
        </g>
      ))}
    </svg>
  )
}

export function WordReveal({ children, delay = 0, gap = 0.08 }: { children: React.ReactNode; delay?: number; gap?: number }) {
  let i = 0
  const renderNode = (node: React.ReactNode): React.ReactNode => {
    if (node === null || node === undefined || node === false) return null
    if (typeof node === "string") {
      const parts = node.split(/(\s+)/)
      return parts.map((p, k) => {
        if (p === "") return null
        if (/^\s+$/.test(p)) {
          return p.includes("\n")
            ? <br key={`br-${i}-${k}`} />
            : <span key={`sp-${i}-${k}`} style={{ display: "inline-block", width: "0.27em" }}>&nbsp;</span>
        }
        const idx = i++
        return (
          <span key={`w-${idx}`} style={{ animationDelay: `${delay + idx * gap}s`, fontFamily: "var(--sans)" }}>{p}</span>
        )
      })
    }
    if (Array.isArray(node)) return node.map(renderNode)
    if (React.isValidElement(node)) {
      const el = node as React.ReactElement<Record<string, unknown>>
      const inner = renderNode((el.props as { children?: React.ReactNode }).children)
      return React.cloneElement(el, { ...el.props, children: inner })
    }
    return node
  }
  return <span className="word-reveal" style={{ fontFamily: "var(--sans)" }}>{renderNode(children)}</span>
}
