"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { getMe, loginDemo } from "@/lib/api"
import { Carousel } from "@/components/Carousel"
import { AuthStep } from "@/components/AuthStep"
import type { AuthedUser } from "@/components/AuthStep"
import { QRStep, EmailStep } from "@/components/ConnectSteps"
import { Logo } from "@/components/shared"

type Step = "intro" | "auth" | "whatsapp" | "signal" | "email"
type Transition = "fwd" | "back"

const STEP_LABELS = ["WhatsApp", "Signal", "Email"]
const STEPS: Step[] = ["intro", "auth", "whatsapp", "signal", "email"]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step | null>(null)
  const [transition, setTransition] = useState<Transition>("fwd")
  const [user, setUser] = useState<AuthedUser | null>(null)
  const [completed, setCompleted] = useState<number[]>([])

  useEffect(() => {
    getMe().then(me => {
      if (me) {
        router.replace("/home")
      } else {
        setStep("intro")
      }
    })
  }, [router])

  const goTo = useCallback((next: Step, dir: Transition = "fwd") => {
    setTransition(dir)
    setStep(next)
  }, [])

  const goBack = useCallback(() => {
    setStep(cur => {
      if (!cur) return cur
      const idx = STEPS.indexOf(cur)
      const prev = STEPS[idx - 1] as Step | undefined
      return prev ?? cur
    })
    setTransition("back")
  }, [])

  if (step === null) return null

  let body: React.ReactNode

  if (step === "intro") {
    body = <Carousel onComplete={() => goTo("auth")} onSkip={() => goTo("auth")} />
  } else if (step === "auth") {
    body = (
      <AuthStep
        initialMode="signup"
        onAuthed={(u) => { setUser(u); goTo("whatsapp") }}
        onBack={() => goTo("intro", "back")}
      />
    )
  } else if (step === "whatsapp") {
    body = (
      <QRStep
        service="whatsapp"
        serviceName="WhatsApp"
        serviceColor="var(--wa)"
        ServiceIcon={Logo.WhatsApp}
        stepLabel="Step 01 · WhatsApp"
        lede="Link your WhatsApp account in seconds by scanning a QR code. UAssist works like WhatsApp Web — no extra app needed."
        benefits={[
          "All chats, contacts and media — synced automatically",
          "Send and reply right from your UAssist dashboard",
          "Disconnect instantly from Settings at any time",
        ]}
        steps={[
          "Open WhatsApp on your phone",
          "Tap ⋮ → Linked Devices → Link a Device",
          "Point your camera at the QR code",
        ]}
        stepLabels={STEP_LABELS}
        current={0}
        completed={completed}
        onConnected={() => { setCompleted(c => [...c, 0]); goTo("signal") }}
        onSkip={() => goTo("signal")}
        onBack={() => goTo("auth", "back")}
      />
    )
  } else if (step === "signal") {
    body = (
      <QRStep
        service="signal"
        serviceName="Signal"
        serviceColor="var(--signal)"
        ServiceIcon={Logo.Signal}
        stepLabel="Step 02 · Signal"
        lede="Link Signal Desktop to read and reply to your encrypted messages — fully end-to-end, just like the app."
        benefits={[
          "Full end-to-end encryption, always on",
          "Read and send messages without touching your phone",
          "Signal never sees your message content — and neither do we",
        ]}
        steps={[
          "Open Signal on your phone",
          "Go to Settings → Linked Devices",
          "Tap + and scan the QR code",
        ]}
        stepLabels={STEP_LABELS}
        current={1}
        completed={completed}
        onConnected={() => { setCompleted(c => [...c, 1]); goTo("email") }}
        onSkip={() => goTo("email")}
        onBack={() => goTo("whatsapp", "back")}
      />
    )
  } else {
    body = (
      <EmailStep
        stepLabels={STEP_LABELS}
        current={2}
        completed={completed}
        stepLabel="Step 03 · Email"
        onConnected={() => { setCompleted(c => [...c, 2]); router.push("/home") }}
        onSkip={() => router.push("/home")}
        onBack={() => goTo("signal", "back")}
      />
    )
  }

  return (
    <div className="app-shell">
      <div className={`scene-wrap scene-${step} ${transition === "back" ? "scene-back" : "scene-fwd"}`} key={step}>
        {body}
      </div>
      {step === "auth" && (
        <div style={{ position: "fixed", bottom: 18, left: "50%", transform: "translateX(-50%)", zIndex: 10 }}>
          <button
            className="skip-link"
            style={{ fontSize: 11, color: "var(--ink-faint)", opacity: 0.5 }}
            onClick={async () => { try { await loginDemo() } catch {} router.push("/home") }}
          >
            Demo platform
          </button>
        </div>
      )}
    </div>
  )
}
