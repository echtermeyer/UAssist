"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { getMe, logout, fetchMessages, openStream } from "@/lib/api"
import type { RawMessage } from "@/lib/api"
import { Carousel } from "@/components/Carousel"
import { AuthStep } from "@/components/AuthStep"
import type { AuthedUser } from "@/components/AuthStep"
import { QRStep, EmailStep } from "@/components/ConnectSteps"
import { Dashboard } from "@/components/Dashboard"
import { Logo } from "@/components/shared"

type Step = "intro" | "auth" | "whatsapp" | "signal" | "email" | "dashboard"
type Transition = "fwd" | "back"

const STEP_LABELS = ["WhatsApp", "Signal", "Email"]
const STEPS: Step[] = ["intro", "auth", "whatsapp", "signal", "email", "dashboard"]

function loadConnectedFromStorage(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = localStorage.getItem("ua_integrations")
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

function saveConnectedToStorage(connected: Set<string>) {
  localStorage.setItem("ua_integrations", JSON.stringify([...connected]))
}

export default function Page() {
  const [step, setStep] = useState<Step | null>(null)
  const [transition, setTransition] = useState<Transition>("fwd")
  const [user, setUser] = useState<AuthedUser | null>(null)
  const [completed, setCompleted] = useState<number[]>([])
  const [connected, setConnected] = useState<Set<string>>(new Set())
  const [messages, setMessages] = useState<RawMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const closeStreamRef = useRef<(() => void) | null>(null)

  // On mount: check session via cookie
  useEffect(() => {
    getMe().then(me => {
      if (me) {
        setConnected(loadConnectedFromStorage())
        setStep("dashboard")
      } else {
        setStep("intro")
      }
    })
  }, [])

  const goTo = useCallback((next: Step, dir: Transition = "fwd") => {
    setTransition(dir)
    setStep(next)
  }, [])

  const goNext = useCallback(() => {
    setStep(cur => {
      if (!cur) return cur
      const idx = STEPS.indexOf(cur)
      const next = STEPS[idx + 1] as Step | undefined
      return next ?? cur
    })
    setTransition("fwd")
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

  const markConnected = useCallback((service: string) => {
    setConnected(prev => {
      const next = new Set(prev)
      next.add(service)
      saveConnectedToStorage(next)
      return next
    })
  }, [])

  const skipAll = useCallback(() => goTo("dashboard"), [goTo])

  const handleLogout = useCallback(async () => {
    await logout().catch(() => {})
    localStorage.removeItem("ua_integrations")
    closeStreamRef.current?.()
    closeStreamRef.current = null
    setMessages([])
    setConnected(new Set())
    setCompleted([])
    setUser(null)
    goTo("auth")
  }, [goTo])

  // Messages + SSE — only active on dashboard
  const loadMessages = useCallback(async () => {
    setLoadingMessages(true)
    try {
      const raw = await fetchMessages()
      setMessages(raw)
    } catch {
      // silently ignore; will retry via SSE or polling
    } finally {
      setLoadingMessages(false)
    }
  }, [])

  const appendMessage = useCallback((raw: RawMessage) => {
    setMessages(prev => {
      if (prev.find(m => m._id === raw._id)) return prev
      return [raw, ...prev]
    })
  }, [])

  useEffect(() => {
    if (step !== "dashboard") {
      closeStreamRef.current?.()
      closeStreamRef.current = null
      return
    }

    loadMessages()

    const close = openStream(appendMessage, () => {
      const interval = setInterval(loadMessages, 15000)
      return () => clearInterval(interval)
    })
    closeStreamRef.current = close

    return () => {
      close()
      closeStreamRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // Not yet determined (hydration)
  if (step === null) return null

  const connectStepIdx = step === "whatsapp" ? 0 : step === "signal" ? 1 : step === "email" ? 2 : -1

  let body: React.ReactNode

  if (step === "intro") {
    body = (
      <Carousel
        onComplete={() => goTo("auth")}
        onSkip={() => goTo("auth")}
      />
    )
  } else if (step === "auth") {
    body = (
      <AuthStep
        initialMode="signup"
        onAuthed={(u) => { setUser(u); goTo("whatsapp") }}
        onBack={() => goTo("intro", "back")}
        onSkip={skipAll}
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
        onConnected={() => { markConnected("whatsapp"); setCompleted(c => [...c, 0]); goTo("signal") }}
        onSkip={() => { setCompleted(c => [...c]); goTo("signal") }}
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
        onConnected={() => { markConnected("signal"); setCompleted(c => [...c, 1]); goTo("email") }}
        onSkip={() => goTo("email")}
        onBack={() => goTo("whatsapp", "back")}
      />
    )
  } else if (step === "email") {
    body = (
      <EmailStep
        stepLabels={STEP_LABELS}
        current={2}
        completed={completed}
        stepLabel="Step 03 · Email"
        onConnected={(accounts) => {
          if (accounts.length > 0) markConnected("email")
          setCompleted(c => [...c, 2])
          goTo("dashboard")
        }}
        onSkip={() => goTo("dashboard")}
        onBack={() => goTo("signal", "back")}
      />
    )
  } else {
    body = (
      <Dashboard
        user={user ?? undefined}
        connected={connected}
        messages={messages}
        loadingMessages={loadingMessages}
        onConnect={(service) => {
          if (service === "whatsapp") goTo("whatsapp")
          else if (service === "signal") goTo("signal")
          else if (service === "email") goTo("email")
        }}
        onLogout={handleLogout}
        onReset={() => { goTo("intro") }}
      />
    )
  }

  return (
    <div className="app-shell">
      <div
        className={`scene-wrap scene-${step} ${transition === "back" ? "scene-back" : "scene-fwd"}`}
        key={step}
      >
        {body}
      </div>
    </div>
  )
}
