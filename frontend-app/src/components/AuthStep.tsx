"use client"

import React, { useState, useRef, useEffect } from "react"
import { BrandMark, BrandLogo, WordReveal, I } from "./shared"
import { login, signup } from "@/lib/api"

type PinInputProps = {
  value: string
  onChange: (v: string) => void
  autoFocus?: boolean
}

function PinInput({ value, onChange, autoFocus = false }: PinInputProps) {
  const ref0 = useRef<HTMLInputElement>(null)
  const ref1 = useRef<HTMLInputElement>(null)
  const ref2 = useRef<HTMLInputElement>(null)
  const ref3 = useRef<HTMLInputElement>(null)
  const refs = [ref0, ref1, ref2, ref3]

  const digits = (value || "").padEnd(4, " ").split("")

  useEffect(() => {
    if (autoFocus) refs[0].current?.focus()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus])

  const setDigit = (i: number, d: string) => {
    const next = value.padEnd(4, " ").split("")
    next[i] = d
    onChange(next.join("").trim())
  }

  const handleInput = (i: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, "").slice(-1)
    if (v) {
      setDigit(i, v)
      if (i < 3) refs[i + 1].current?.focus()
    }
  }

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault()
      if (digits[i] !== " ") {
        setDigit(i, "")
      } else if (i > 0) {
        refs[i - 1].current?.focus()
        const next = value.padEnd(4, " ").split("")
        next[i - 1] = ""
        onChange(next.join("").trim())
      }
    } else if (e.key === "ArrowLeft" && i > 0) {
      refs[i - 1].current?.focus()
    } else if (e.key === "ArrowRight" && i < 3) {
      refs[i + 1].current?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4)
    if (text) {
      e.preventDefault()
      onChange(text)
      refs[Math.min(text.length, 3)].current?.focus()
    }
  }

  return (
    <div className="pin-input" onPaste={handlePaste}>
      {[0, 1, 2, 3].map(i => (
        <input
          key={i}
          ref={refs[i]}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i] === " " ? "" : digits[i]}
          onChange={(e) => handleInput(i, e)}
          onKeyDown={(e) => handleKey(i, e)}
          onFocus={(e) => e.target.select()}
          className={digits[i] !== " " ? "filled" : ""}
          aria-label={`PIN digit ${i + 1}`}
        />
      ))}
    </div>
  )
}

const COUNTRY_CODES = [
  { code: "+49", country: "Germany", flag: "🇩🇪" },
  { code: "+44", country: "United Kingdom", flag: "🇬🇧" },
  { code: "+1",  country: "United States", flag: "🇺🇸" },
  { code: "+33", country: "France", flag: "🇫🇷" },
  { code: "+34", country: "Spain", flag: "🇪🇸" },
  { code: "+39", country: "Italy", flag: "🇮🇹" },
  { code: "+31", country: "Netherlands", flag: "🇳🇱" },
  { code: "+41", country: "Switzerland", flag: "🇨🇭" },
  { code: "+43", country: "Austria", flag: "🇦🇹" },
  { code: "+45", country: "Denmark", flag: "🇩🇰" },
  { code: "+46", country: "Sweden", flag: "🇸🇪" },
]

type PhoneInputProps = {
  countryCode: string
  setCountryCode: (c: string) => void
  phone: string
  setPhone: (p: string) => void
}

function PhoneInput({ countryCode, setCountryCode, phone, setPhone }: PhoneInputProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  const cc = COUNTRY_CODES.find(c => c.code === countryCode) || COUNTRY_CODES[0]

  return (
    <div className="phone-input" ref={ref}>
      <button type="button" className="cc-button" onClick={() => setOpen(o => !o)}>
        <span className="flag">{cc.flag}</span>
        <span className="code">{cc.code}</span>
        <I.ArrowLeft style={{ transform: open ? "rotate(90deg)" : "rotate(-90deg)", transition: "transform 0.2s" }} size={11} />
      </button>
      {open && (
        <div className="cc-menu">
          {COUNTRY_CODES.map(c => (
            <button
              key={c.code}
              type="button"
              className={`cc-option ${c.code === countryCode ? "active" : ""}`}
              onClick={() => { setCountryCode(c.code); setOpen(false) }}
            >
              <span className="flag">{c.flag}</span>
              <span className="country">{c.country}</span>
              <span className="code">{c.code}</span>
            </button>
          ))}
        </div>
      )}
      <input
        type="tel"
        inputMode="tel"
        placeholder="151 234 56789"
        value={phone}
        onChange={(e) => setPhone(e.target.value.replace(/[^\d\s]/g, ""))}
        className="phone-number"
      />
    </div>
  )
}

export type AuthedUser = {
  firstName: string
  phone: string
}

type AuthStepProps = {
  initialMode?: "signup" | "login"
  initialName?: string
  onAuthed: (user: AuthedUser) => void
  onBack?: () => void
}

export function AuthStep({ initialMode = "signup", initialName = "", onAuthed, onBack }: AuthStepProps) {
  const [mode, setMode] = useState<"signup" | "login">(initialMode)
  const [firstName, setFirstName] = useState(initialName)
  const [countryCode, setCountryCode] = useState("+49")
  const [phone, setPhone] = useState("")
  const [pin, setPin] = useState("")
  const [pinConfirm, setPinConfirm] = useState("")
  const [stage, setStage] = useState<"form" | "pin-confirm" | "verifying">("form")
  const [error, setError] = useState("")

  const isSignup = mode === "signup"

  const canSubmitForm = isSignup
    ? firstName.trim().length > 0 && phone.replace(/\s/g, "").length >= 6 && pin.length === 4
    : phone.replace(/\s/g, "").length >= 6 && pin.length === 4

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setError("")

    if (isSignup && stage === "form") {
      setStage("pin-confirm")
      return
    }
    if (isSignup && stage === "pin-confirm") {
      if (pinConfirm !== pin) {
        setError("PINs don't match. Try again.")
        return
      }
    }

    setStage("verifying")
    const username = (countryCode + phone).replace(/\s/g, "")
    const password = pin + pin.slice(0, 2)
    try {
      await (isSignup ? signup : login)(username, password)
      onAuthed({
        firstName: isSignup ? firstName.trim() || "User" : "User",
        phone: `${countryCode} ${phone}`,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed. Please try again.")
      setStage("form")
    }
  }

  return (
    <>
      <header className="topbar">
        <BrandMark href="/home" />
        <div className="right">
          <span className="label-mono">{isSignup ? "Create your account" : "Welcome back"}</span>
        </div>
      </header>

      <main className="auth-stage">
        <div className="auth-left slide-in slide-forward">
          <div className="carousel-eyebrow">
            <span className="num">{isSignup ? "Step · Identity" : "Welcome back"}</span>
          </div>
          <h1 className="connect-headline" style={{ fontSize: 60 }}>
            {isSignup ? (
              <>
                <WordReveal delay={0.05} gap={0.07}>{"Let's get "}</WordReveal>
                <span className="it"><WordReveal delay={0.3} gap={0.07}>acquainted.</WordReveal></span>
              </>
            ) : (
              <>
                <WordReveal delay={0.05} gap={0.07}>{"Welcome "}</WordReveal>
                <span className="it"><WordReveal delay={0.25} gap={0.07}>home.</WordReveal></span>
              </>
            )}
          </h1>
          <p className="connect-lede">
            {isSignup
              ? "Just a first name and your phone number — we'll use it to keep your account portable and recoverable. Pick a 4-digit PIN to keep things simple."
              : "Sign in with the phone number you registered. We'll never ask for a password longer than 4 digits."}
          </p>

          <ul className="benefit-list fade-stagger">
            <li><span className="b-mark"><I.CheckSm /></span><span>Phone number is your account — no email required</span></li>
            <li><span className="b-mark"><I.CheckSm /></span><span>4-digit PIN unlocks the app; biometrics on mobile</span></li>
            <li><span className="b-mark"><I.CheckSm /></span><span>Your data lives in your private EU-hosted tenant</span></li>
          </ul>

          <div className="connect-actions">
            {onBack && (
              <button className="btn btn-ghost" onClick={onBack} style={{ padding: "10px 14px" }}>
                <I.ArrowLeft /> Back
              </button>
            )}
            <button
              className="skip-link"
              onClick={() => { setMode(isSignup ? "login" : "signup"); setStage("form"); setError(""); setPinConfirm("") }}
            >
              {isSignup ? "I already have an account — log in" : "New here? Create an account"}
            </button>
          </div>
        </div>

        <div className="auth-right">
          <form className="auth-card slide-in slide-forward-vis" onSubmit={handleSubmit}>
            <div className="auth-card-head">
              <BrandLogo size={32} />
              <div>
                <div className="ac-title">{isSignup ? "Create account" : "Log in"}</div>
                <div className="ac-sub">{isSignup ? "Step " + (stage === "pin-confirm" ? "2" : "1") + " of 2" : "Phone & PIN"}</div>
              </div>
            </div>

            <div className="auth-card-body">
              {stage !== "pin-confirm" && (
                <>
                  {isSignup && (
                    <div className="field">
                      <label>First name</label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Mark"
                        autoComplete="given-name"
                        autoFocus
                      />
                    </div>
                  )}

                  <div className="field">
                    <label>Phone number</label>
                    <PhoneInput
                      countryCode={countryCode}
                      setCountryCode={setCountryCode}
                      phone={phone}
                      setPhone={setPhone}
                    />
                  </div>

                  <div className="field">
                    <label>{isSignup ? "Set a 4-digit PIN" : "Enter your PIN"}</label>
                    <PinInput value={pin} onChange={setPin} />
                    {isSignup && <span className="field-hint">You'll use this PIN to sign back in.</span>}
                  </div>
                </>
              )}

              {stage === "pin-confirm" && (
                <div className="fade-enter">
                  <div className="confirm-prompt">
                    Confirm your PIN <span style={{ color: "var(--accent)" }}>·</span> just to be sure.
                  </div>
                  <div className="field" style={{ marginTop: 22 }}>
                    <PinInput value={pinConfirm} onChange={setPinConfirm} autoFocus />
                  </div>
                  <button
                    type="button"
                    className="skip-link"
                    onClick={() => { setStage("form"); setPinConfirm(""); setError("") }}
                    style={{ marginTop: 14, display: "inline-block" }}
                  >
                    ← Edit details
                  </button>
                </div>
              )}

              {error && <div className="auth-error">{error}</div>}

              <button
                type="submit"
                className="btn btn-accent"
                disabled={
                  stage === "verifying"
                  || (stage === "form" && !canSubmitForm)
                  || (stage === "pin-confirm" && pinConfirm.length !== 4)
                }
                style={{ width: "100%", marginTop: 4 }}
              >
                {stage === "verifying" ? (
                  <span className="auth-verifying"><span className="spinner" /> Setting up your tenant…</span>
                ) : stage === "pin-confirm" ? (
                  <>Confirm & continue <I.Arrow /></>
                ) : isSignup ? (
                  <>Continue <I.Arrow /></>
                ) : (
                  <>Log in <I.Arrow /></>
                )}
              </button>

              <div className="auth-foot">
                <I.Shield size={12} />
                <span>{isSignup ? "By continuing you agree to UAssist's privacy promise — your messages stay yours." : "Your session expires in 30 days of inactivity."}</span>
              </div>
            </div>
          </form>
        </div>
      </main>

      <footer className="carousel-foot">
        <span className="label-mono">{isSignup ? "Account · Identity" : "Sign in"}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span className="label-mono" style={{ opacity: 0.7 }}>
            {isSignup ? (stage === "pin-confirm" ? "02 / 02" : "01 / 02") : ""}
          </span>
        </div>
      </footer>
    </>
  )
}
