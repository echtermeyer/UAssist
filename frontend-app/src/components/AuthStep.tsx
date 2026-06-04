"use client"

import React, { useState, useRef, useEffect } from "react"
import { BrandMark, BrandLogo, WordReveal, I } from "./shared"
import { login, signup } from "@/lib/api"

const COUNTRY_CODES = [
  { code: "+49", country: "Germany", flag: "\u{1F1E9}\u{1F1EA}" },
  { code: "+44", country: "United Kingdom", flag: "\u{1F1EC}\u{1F1E7}" },
  { code: "+1",  country: "United States", flag: "\u{1F1FA}\u{1F1F8}" },
  { code: "+33", country: "France", flag: "\u{1F1EB}\u{1F1F7}" },
  { code: "+34", country: "Spain", flag: "\u{1F1EA}\u{1F1F8}" },
  { code: "+39", country: "Italy", flag: "\u{1F1EE}\u{1F1F9}" },
  { code: "+31", country: "Netherlands", flag: "\u{1F1F3}\u{1F1F1}" },
  { code: "+41", country: "Switzerland", flag: "\u{1F1E8}\u{1F1ED}" },
  { code: "+43", country: "Austria", flag: "\u{1F1E6}\u{1F1F9}" },
  { code: "+45", country: "Denmark", flag: "\u{1F1E9}\u{1F1F0}" },
  { code: "+46", country: "Sweden", flag: "\u{1F1F8}\u{1F1EA}" },
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
  onAuthed: (user: AuthedUser, isNew: boolean) => void
  onBack?: () => void
}

export function AuthStep({ initialMode = "signup", initialName = "", onAuthed, onBack }: AuthStepProps) {
  const [mode, setMode] = useState<"signup" | "login">(initialMode)
  const [firstName, setFirstName] = useState(initialName)
  const [countryCode, setCountryCode] = useState("+49")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [passwordConfirm, setPasswordConfirm] = useState("")
  const [stage, setStage] = useState<"form" | "verifying">("form")
  const [error, setError] = useState("")

  const isSignup = mode === "signup"

  const canSubmit = isSignup
    ? firstName.trim().length > 0 && phone.replace(/\s/g, "").length >= 6 && password.length >= 6 && password === passwordConfirm
    : phone.replace(/\s/g, "").length >= 6 && password.length >= 6

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setError("")

    if (isSignup && password !== passwordConfirm) {
      setError("Passwords don't match. Try again.")
      return
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.")
      return
    }

    setStage("verifying")
    const username = (countryCode + phone).replace(/\s/g, "")
    try {
      if (isSignup) {
        await signup(username, password, firstName.trim())
      } else {
        await login(username, password)
      }
      onAuthed({
        firstName: isSignup ? firstName.trim() || "User" : "User",
        phone: `${countryCode} ${phone}`,
      }, isSignup)
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
              ? "Just a first name, your phone number, and a password to keep your account secure."
              : "Sign in with the phone number you registered and your password."}
          </p>

          <ul className="benefit-list fade-stagger">
            <li><span className="b-mark"><I.CheckSm /></span><span>Phone number is your account — no email required</span></li>
            <li><span className="b-mark"><I.CheckSm /></span><span>Secure password keeps your data protected</span></li>
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
              onClick={() => { setMode(isSignup ? "login" : "signup"); setStage("form"); setError(""); setPassword(""); setPasswordConfirm("") }}
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
                <div className="ac-sub">{isSignup ? "Phone & password" : "Phone & password"}</div>
              </div>
            </div>

            <div className="auth-card-body">
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
                <label>{isSignup ? "Create a password" : "Password"}</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isSignup ? "At least 6 characters" : "Enter your password"}
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  minLength={6}
                />
                {isSignup && <span className="field-hint">Must be at least 6 characters.</span>}
              </div>

              {isSignup && (
                <div className="field">
                  <label>Confirm password</label>
                  <input
                    type="password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    minLength={6}
                  />
                </div>
              )}

              {error && <div className="auth-error">{error}</div>}

              <button
                type="submit"
                className="btn btn-accent"
                disabled={stage === "verifying" || !canSubmit}
                style={{ width: "100%", marginTop: 4 }}
              >
                {stage === "verifying" ? (
                  <span className="auth-verifying"><span className="spinner" /> Setting up your tenant…</span>
                ) : isSignup ? (
                  <>Create account <I.Arrow /></>
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
          <span className="label-mono" style={{ opacity: 0.7 }}></span>
        </div>
      </footer>
    </>
  )
}
