"use client"

import React, { useState, useEffect, useRef } from "react"
import QRCode from "qrcode"
import { BrandMark, FakeQR, WordReveal, I, Logo } from "./shared"
import {
  startWhatsAppOnboard, pollWhatsAppStatus,
  startSignalOnboard, pollSignalStatus,
  connectEmail,
} from "@/lib/api"

// ─── Step rail ────────────────────────────────────────────────────────────────

type StepRailProps = {
  steps: string[]
  current: number
  completed: number[]
}

export function StepRail({ steps, current, completed }: StepRailProps) {
  return (
    <div className="step-rail">
      {steps.map((s, i) => {
        const isDone = completed.includes(i)
        const isActive = current === i
        return (
          <span key={i} className={`step-pip ${isActive ? "active" : ""} ${isDone ? "done" : ""}`}>
            <span className="tick" />
            <span>{s}</span>
          </span>
        )
      })}
    </div>
  )
}

// ─── QR connect step ──────────────────────────────────────────────────────────

type QRStepProps = {
  service: "whatsapp" | "signal"
  serviceName: string
  serviceColor: string
  ServiceIcon: React.ComponentType<{ size?: number }>
  stepLabel: string
  headline?: string
  lede: string
  benefits: string[]
  steps: string[]
  stepLabels: string[]
  current: number
  completed: number[]
  onConnected: () => void
  onSkip: () => void
  onBack: () => void
}

export function QRStep({
  service,
  serviceName,
  serviceColor,
  ServiceIcon,
  stepLabel,
  lede,
  benefits,
  steps,
  stepLabels,
  current,
  completed,
  onConnected,
  onSkip,
  onBack,
}: QRStepProps) {
  const [status, setStatus] = useState<"scanning" | "linking" | "done">("scanning")
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [linkUri, setLinkUri] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const doneRef = useRef(false)

  useEffect(() => {
    setStatus("scanning")
    setQrDataUrl(null)
    setLinkUri(null)
    doneRef.current = false

    const start = async () => {
      try {
        if (service === "whatsapp") {
          await startWhatsAppOnboard()
          intervalRef.current = setInterval(async () => {
            if (doneRef.current) return
            try {
              const s = await pollWhatsAppStatus()
              if (s.qr) setQrDataUrl(s.qr)
              if (s.status === "connected") {
                doneRef.current = true
                clearInterval(intervalRef.current!)
                setStatus("done")
                setTimeout(() => onConnected(), 900)
              }
            } catch {}
          }, 2000)
        } else {
          await startSignalOnboard()
          intervalRef.current = setInterval(async () => {
            if (doneRef.current) return
            try {
              const s = await pollSignalStatus()
              if (s.linkUri) setLinkUri(s.linkUri)
              if (s.status === "linked") {
                doneRef.current = true
                clearInterval(intervalRef.current!)
                setStatus("done")
                setTimeout(() => onConnected(), 900)
              }
            } catch {}
          }, 2000)
        }
      } catch {}
    }

    start()
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service])

  useEffect(() => {
    if (!linkUri || !canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, linkUri, {
      width: 260,
      color: { dark: "#2a2520", light: "#f5ede0" },
    })
  }, [linkUri])

  return (
    <>
      <header className="topbar">
        <BrandMark />
        <div className="right">
          <span className="label-mono">Connect your services</span>
          <button className="skip-btn" onClick={onSkip}>Skip onboarding →</button>
        </div>
      </header>

      <main className="connect-stage">
        <div className="connect-left fade-enter" key={service}>
          <StepRail steps={stepLabels} current={current} completed={completed} />

          <h1 className="connect-headline">
            <WordReveal delay={0.05} gap={0.07}>Connect </WordReveal>
            <span className="it"><WordReveal delay={0.25} gap={0.07}>{serviceName}.</WordReveal></span>
          </h1>
          <p className="connect-lede">{lede}</p>

          <ul className="benefit-list fade-stagger">
            {benefits.map((b, i) => (
              <li key={i}>
                <span className="b-mark"><I.CheckSm /></span>
                <span>{b}</span>
              </li>
            ))}
          </ul>

          <div className="connect-actions">
            <button className="btn btn-ghost" onClick={onBack} style={{ padding: "10px 14px" }}>
              <I.ArrowLeft /> Back
            </button>
            <button className="skip-link" onClick={onSkip}>
              I&apos;ll skip {serviceName} for now
            </button>
          </div>
        </div>

        <div className="connect-right">
          <div className="qr-frame fade-enter" key={`qr-${service}`}>
            <div className="qr-head">
              <div className="qr-svc">
                <div className="qr-icon" style={{ background: serviceColor }}>
                  <ServiceIcon size={20} />
                </div>
                <div className="qr-meta">
                  <span className="n">{serviceName}</span>
                  <span className="s">Linked device · {service === "whatsapp" ? "WhatsApp Web" : "Signal Desktop"}</span>
                </div>
              </div>
              <div className={`qr-status ${status === "done" ? "done" : ""}`}>
                <span className="pulse" />
                {status === "scanning" && "Waiting for scan"}
                {status === "linking" && "Linking…"}
                {status === "done" && "Linked"}
              </div>
            </div>

            <div className="qr-canvas">
              {service === "whatsapp" ? (
                qrDataUrl
                  ? <img src={qrDataUrl} alt="WhatsApp QR code" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  : <FakeQR seed={7} color="var(--ink-strong)" />
              ) : (
                linkUri
                  ? <canvas ref={canvasRef} width={260} height={260} style={{ width: "100%", height: "100%" }} />
                  : <FakeQR seed={13} color="var(--ink-strong)" />
              )}
              <div className="qr-center-logo" style={{ background: serviceColor }}>
                <ServiceIcon size={22} />
              </div>

              {status === "done" && (
                <div className="qr-success">
                  <div className="ring"><I.Check size={28} /></div>
                  <div className="t">{serviceName} connected</div>
                  <div className="s">Listening for messages</div>
                </div>
              )}
            </div>

            <div className="qr-foot">
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 240 }}>
                <span className="label-mono" style={{ color: "var(--ink)" }}>Steps</span>
                <ol style={{ paddingLeft: 18, margin: 0, color: "var(--ink-soft)", fontSize: 12.5, lineHeight: 1.6 }}>
                  {steps.map((s, i) => <li key={i}>{s}</li>)}
                </ol>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="carousel-foot">
        <span className="label-mono">{stepLabel}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button className="btn btn-outline" onClick={onSkip}>Skip</button>
          <button
            className="btn btn-primary"
            onClick={() => status === "done" ? onConnected() : undefined}
            disabled={status !== "done"}
          >
            {status === "done" ? "Continue" : "I've scanned the code"} <I.Arrow />
          </button>
        </div>
      </footer>
    </>
  )
}

// ─── Email connect step ───────────────────────────────────────────────────────

const PROVIDERS = [
  { id: "gmail",   name: "Gmail",     color: "#ea4335", initial: "G" },
  { id: "outlook", name: "Outlook",   color: "#0078d4", initial: "O" },
  { id: "icloud",  name: "iCloud",    color: "#000000", initial: "i" },
  { id: "gmx",     name: "GMX",       color: "#1c449b", initial: "G" },
  { id: "yahoo",   name: "Yahoo",     color: "#6001d2", initial: "Y" },
  { id: "imap",    name: "Other IMAP", color: "#4a463d", initial: "@" },
]

type EmailAccount = { id: number; email: string; provider: string }

type EmailStepProps = {
  stepLabels: string[]
  current: number
  completed: number[]
  stepLabel: string
  onConnected: (accounts: EmailAccount[]) => void
  onSkip: () => void
  onBack: () => void
}

export function EmailStep({ stepLabels, current, completed, stepLabel, onConnected, onSkip, onBack }: EmailStepProps) {
  const [provider, setProvider] = useState("gmail")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [accounts, setAccounts] = useState<EmailAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const m = email.match(/@([\w-]+)/)
    if (!m) return
    const d = m[1].toLowerCase()
    if (d.includes("gmail")) setProvider("gmail")
    else if (d.includes("outlook") || d.includes("hotmail") || d.includes("live")) setProvider("outlook")
    else if (d.includes("icloud") || d.includes("me.com") || d.includes("mac.com")) setProvider("icloud")
    else if (d.includes("gmx") || d.includes("web.de")) setProvider("gmx")
    else if (d.includes("yahoo")) setProvider("yahoo")
    else setProvider("imap")
  }, [email])

  const handleConnect = async () => {
    if (!email || !password) return
    setLoading(true)
    setError("")
    try {
      await connectEmail(email, password)
      setAccounts(prev => [...prev, { id: Date.now(), email, provider }])
      setEmail("")
      setPassword("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect inbox. Check credentials and try again.")
    } finally {
      setLoading(false)
    }
  }

  const removeAcc = (id: number) => setAccounts(prev => prev.filter(a => a.id !== id))

  const prov = PROVIDERS.find(p => p.id === provider)

  return (
    <>
      <header className="topbar">
        <BrandMark />
        <div className="right">
          <span className="label-mono">Connect your services</span>
          <button className="skip-btn" onClick={onSkip}>Skip onboarding →</button>
        </div>
      </header>

      <main className="connect-stage">
        <div className="connect-left fade-enter">
          <StepRail steps={stepLabels} current={current} completed={completed} />

          <h1 className="connect-headline">
            <WordReveal delay={0.05} gap={0.07}>Add your </WordReveal>
            <span className="it"><WordReveal delay={0.25} gap={0.07}>email.</WordReveal></span>
          </h1>
          <p className="connect-lede">
            Connect as many inboxes as you&apos;d like — work, personal, that one you keep meaning to clean out. UAssist reads them in one place.
          </p>

          <ul className="benefit-list fade-stagger">
            <li><span className="b-mark"><I.CheckSm /></span><span>Auto-detects Gmail, Outlook, iCloud, GMX, Yahoo and others via IMAP</span></li>
            <li><span className="b-mark"><I.CheckSm /></span><span>Use an app-specific password if you have two-factor on — we&apos;ll guide you</span></li>
            <li><span className="b-mark"><I.CheckSm /></span><span>Credentials encrypted with your tenant key, never shared</span></li>
          </ul>

          <div className="connect-actions">
            <button className="btn btn-ghost" onClick={onBack} style={{ padding: "10px 14px" }}>
              <I.ArrowLeft /> Back
            </button>
          </div>
        </div>

        <div className="connect-right">
          <div className="email-form-wrap fade-enter">
            <div className="email-form">
              <div className="provider-strip">
                {PROVIDERS.map(p => (
                  <button
                    key={p.id}
                    className={`provider-chip ${provider === p.id ? "active" : ""}`}
                    onClick={() => setProvider(p.id)}
                  >
                    <span className="d" style={{ background: p.color }}>{p.initial}</span>
                    {p.name}
                  </button>
                ))}
              </div>

              <div className="field">
                <label>Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="off"
                />
              </div>

              <div className="field" style={{ position: "relative" }}>
                <label>Password</label>
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={prov?.id === "gmail" || prov?.id === "outlook" ? "App-specific password" : "Password"}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  style={{ position: "absolute", right: 0, bottom: 10, color: "var(--ink-mute)", padding: 4 }}
                >
                  {showPw ? <I.EyeOff /> : <I.Eye />}
                </button>
              </div>

              {error && <div style={{ fontSize: 13, color: "#a64231" }}>{error}</div>}

              <button
                className="btn btn-accent"
                onClick={handleConnect}
                disabled={!email || !password || loading}
                style={{ width: "100%", marginTop: 4 }}
              >
                {loading ? "Verifying…" : (<>Connect inbox <I.Arrow /></>)}
              </button>
            </div>

            {accounts.length > 0 && (
              <div className="connected-list fade-enter">
                <div className="label-mono" style={{ marginBottom: 6 }}>{accounts.length} connected</div>
                {accounts.map(a => {
                  const p = PROVIDERS.find(x => x.id === a.provider) || PROVIDERS[5]
                  return (
                    <div className="connected-row" key={a.id}>
                      <div className="pip" style={{ background: p.color + "22", color: p.color }}>
                        <I.Mail size={14} />
                      </div>
                      <div className="info">
                        <div className="e">{a.email}</div>
                        <div className="h">{p.name} · IMAP IDLE</div>
                      </div>
                      <button
                        onClick={() => removeAcc(a.id)}
                        style={{ color: "var(--ink-mute)", padding: 4, marginRight: 6 }}
                      >
                        <I.X />
                      </button>
                      <span className="check"><I.Check size={11} /></span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="carousel-foot">
        <span className="label-mono">{stepLabel}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button className="btn btn-outline" onClick={onSkip}>
            {accounts.length > 0 ? "Done for now" : "Skip"}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => onConnected(accounts)}
            disabled={accounts.length === 0}
          >
            {accounts.length > 0
              ? <><>Finish setup</> <I.Arrow /></>
              : <>Add at least one to continue</>}
          </button>
        </div>
      </footer>
    </>
  )
}

// Re-export Logo for page.tsx convenience
export { Logo }
