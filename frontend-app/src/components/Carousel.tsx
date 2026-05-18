"use client"

import React, { useState } from "react"
import { BrandMark, BrandLogo, WordReveal, I } from "./shared"

type SlidePart = string | { it: string }

type Slide = {
  eyebrow: string
  headline: SlidePart[]
  lede: string
}

const SLIDES: Slide[] = [
  {
    eyebrow: "01 / Unified",
    headline: ["All your messages, ", { it: "one mind." }],
    lede: "WhatsApp, Signal, email — UAssist gathers your daily flow into a single calm surface so nothing slips between channels.",
  },
  {
    eyebrow: "02 / Intelligent",
    headline: ["An assistant that ", { it: "actually knows you." }],
    lede: "UAssist quietly reads your messages and lifts out what matters — todos, dates, decisions, people — into a digest that updates as you talk.",
  },
  {
    eyebrow: "03 / Private",
    headline: ["Yours, ", { it: "and only yours." }],
    lede: "Hosted in the EU. End-to-end encrypted at rest. Even our team can't read your messages — your conversations belong to you, full stop.",
  },
]

function HeadlineParts({ parts }: { parts: SlidePart[] }) {
  return (
    <>
      {parts.map((p, i) => {
        if (typeof p === "string") {
          return <WordReveal key={i} delay={i * 0.4} gap={0.07}>{p}</WordReveal>
        }
        return (
          <span key={i} className="it">
            <WordReveal delay={0.3 + i * 0.4} gap={0.07}>{p.it}</WordReveal>
          </span>
        )
      })}
    </>
  )
}

function Slide1Visual() {
  return (
    <div className="float-stack" aria-hidden>
      <svg className="connectors" viewBox="0 0 520 520" fill="none" stroke="var(--ink-ghost)" strokeWidth="1" strokeDasharray="3 5">
        <path d="M 110 80 Q 220 200 260 240" />
        <path d="M 410 130 Q 320 220 280 250" />
        <path d="M 80 380 Q 200 320 240 280" />
      </svg>

      <div className="focal-ring">
        <BrandLogo size={42} color="transparent" fg="#f5ede0" />
      </div>

      <div className="chat-card drift1" style={{ top: "20px", left: "20px" }}>
        <div className="ch-head">
          <div className="av" style={{ background: "var(--wa)" }}>L</div>
          <div className="meta">
            <span className="name">Lena</span>
            <span className="via">WhatsApp · 9:14</span>
          </div>
        </div>
        <div className="body">Can you grab oat milk on your way home? And maybe pick the kid up at 16:30?</div>
      </div>

      <div className="chat-card drift2" style={{ top: "60px", right: "0px" }}>
        <div className="ch-head">
          <div className="av" style={{ background: "var(--signal)" }}>J</div>
          <div className="meta">
            <span className="name">Jonas</span>
            <span className="via">Signal · 9:22</span>
          </div>
        </div>
        <div className="body">Moved our Thursday review to 14:00 — works?</div>
      </div>

      <div className="chat-card drift3" style={{ bottom: "30px", left: "10px" }}>
        <div className="ch-head">
          <div className="av" style={{ background: "var(--email)" }}>D</div>
          <div className="meta">
            <span className="name">Deutsche Bahn</span>
            <span className="via">Email · 9:31</span>
          </div>
        </div>
        <div className="body">Your ICE 1573 to München has been rebooked to platform 7.</div>
      </div>
    </div>
  )
}

function Slide2Visual() {
  return (
    <div className="float-stack" aria-hidden>
      <div className="chat-card" style={{ top: "120px", left: "50%", transform: "translateX(-50%)", width: 320 }}>
        <div className="ch-head">
          <div className="av" style={{ background: "var(--wa)" }}>L</div>
          <div className="meta">
            <span className="name">Lena</span>
            <span className="via">WhatsApp · 9:14</span>
          </div>
        </div>
        <div className="body">
          Can you grab{" "}
          <mark style={{ background: "rgba(184,100,58,0.18)", color: "var(--ink)", padding: "1px 4px", borderRadius: 4 }}>oat milk</mark>
          {" "}on your way home? And maybe pick the kid up at{" "}
          <mark style={{ background: "rgba(42,74,53,0.16)", color: "var(--ink)", padding: "1px 4px", borderRadius: 4 }}>16:30</mark>?
        </div>
      </div>

      <div className="insight-pill" style={{ top: "40px", left: "30px", animationDelay: "0.4s" }}>
        <span className="swatch" style={{ background: "var(--insight)" }}><I.CheckSm /></span>
        <span className="kind">Todo</span>
        <span>Buy oat milk</span>
      </div>

      <div className="insight-pill" style={{ top: "60px", right: "20px", animationDelay: "0.55s" }}>
        <span className="swatch" style={{ background: "var(--accent)" }}><I.Calendar size={10} /></span>
        <span className="kind">Pickup</span>
        <span>16:30 — School</span>
      </div>

      <div className="insight-pill" style={{ bottom: "100px", left: "0px", animationDelay: "0.7s" }}>
        <span className="swatch" style={{ background: "var(--signal)" }}><I.Calendar size={10} /></span>
        <span className="kind">Reschedule</span>
        <span>Thu review → 14:00</span>
      </div>

      <div className="insight-pill" style={{ bottom: "60px", right: "40px", animationDelay: "0.85s" }}>
        <span className="swatch" style={{ background: "var(--email)" }}><I.Bell size={10} /></span>
        <span className="kind">Alert</span>
        <span>Train platform changed</span>
      </div>
    </div>
  )
}

function Slide3Visual() {
  return (
    <div className="float-stack center" aria-hidden style={{ position: "relative" }}>
      <div className="privacy-vault">
        <div className="core">
          <span className="lk"><I.Lock size={24} /></span>
          <span className="lbl">E2E</span>
        </div>
      </div>
      <span className="privacy-badge" style={{ top: "20px", left: "10px" }}>EU · Frankfurt</span>
      <span className="privacy-badge" style={{ top: "70px", right: "0px" }}>GDPR Compliant</span>
      <span className="privacy-badge" style={{ bottom: "70px", left: "0px" }}>Zero Knowledge</span>
      <span className="privacy-badge" style={{ bottom: "20px", right: "20px" }}>Open Source</span>
    </div>
  )
}

const VISUALS = [Slide1Visual, Slide2Visual, Slide3Visual]

type CarouselProps = {
  onComplete: () => void
  onSkip: () => void
}

export function Carousel({ onComplete, onSkip }: CarouselProps) {
  const [idx, setIdx] = useState(0)
  const [dir, setDir] = useState<"forward" | "back">("forward")
  const slide = SLIDES[idx]
  const Visual = VISUALS[idx]
  const isLast = idx === SLIDES.length - 1

  const go = (nextIdx: number) => {
    setDir(nextIdx > idx ? "forward" : "back")
    setIdx(nextIdx)
  }

  return (
    <>
      <header className="topbar">
        <BrandMark />
        <div className="right">
          <span className="label-mono">A quiet mind for noisy inboxes</span>
          <button className="skip-btn" onClick={onSkip}>Skip intro →</button>
        </div>
      </header>

      <main className="carousel-stage">
        <div className={`carousel-left slide-in slide-${dir}`} key={`text-${idx}`}>
          <div className="carousel-eyebrow">
            <span className="num">{slide.eyebrow}</span>
          </div>
          <h1 className="headline"><HeadlineParts parts={slide.headline} /></h1>
          <p className="lede">{slide.lede}</p>
        </div>

        <div className={`carousel-right slide-in slide-${dir}-vis`} key={`vis-${idx}`}>
          <Visual />
        </div>
      </main>

      <footer className="carousel-foot">
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            className="btn btn-ghost"
            onClick={() => go(Math.max(0, idx - 1))}
            disabled={idx === 0}
            style={{ padding: "10px 16px" }}
          >
            <I.ArrowLeft /> Back
          </button>
          <div className="dots" role="tablist">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                className={`dot-btn ${i === idx ? "active" : ""}`}
                onClick={() => go(i)}
                aria-label={`Slide ${i + 1}`}
                aria-selected={i === idx}
              />
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span className="label-mono" style={{ opacity: 0.7 }}>
            {String(idx + 1).padStart(2, "0")} / {String(SLIDES.length).padStart(2, "0")}
          </span>
          <button className="btn btn-primary" onClick={() => isLast ? onComplete() : go(idx + 1)}>
            {isLast ? "Get started" : "Continue"} <I.Arrow />
          </button>
        </div>
      </footer>
    </>
  )
}
