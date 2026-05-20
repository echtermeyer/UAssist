"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { getMe, logout, fetchMessages, openStream } from "@/lib/api"
import type { RawMessage } from "@/lib/api"
import type { AuthedUser } from "@/components/AuthStep"
import { QRStep, EmailStep } from "@/components/ConnectSteps"
import { Dashboard } from "@/components/Dashboard"
import { Logo } from "@/components/shared"

type ConnectStep = "whatsapp" | "signal" | "email" | null

const STEP_LABELS = ["WhatsApp", "Signal", "Email"]

function loadConnected(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try { return new Set(JSON.parse(localStorage.getItem("ua_integrations") || "[]")) } catch { return new Set() }
}

function saveConnected(s: Set<string>) {
  localStorage.setItem("ua_integrations", JSON.stringify([...s]))
}

export default function HomePage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<AuthedUser | null>(null)
  const [connected, setConnected] = useState<Set<string>>(new Set())
  const [messages, setMessages] = useState<RawMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [connectStep, setConnectStep] = useState<ConnectStep>(null)
  const closeStreamRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    getMe().then(me => {
      if (!me) { router.replace("/onboarding"); return }
      setUser({ firstName: me.username, phone: "" })
      const fromServer = new Set(
        Object.entries(me.onboarding)
          .filter(([, v]) => v === "connected" || v === "linked")
          .map(([k]) => k)
      )
      const merged = new Set([...fromServer, ...loadConnected()])
      saveConnected(merged)
      setConnected(merged)
      setReady(true)
    })
  }, [router])

  const markConnected = useCallback((service: string) => {
    setConnected(prev => {
      const next = new Set(prev)
      next.add(service)
      saveConnected(next)
      return next
    })
  }, [])

  const handleLogout = useCallback(async () => {
    await logout().catch(() => {})
    localStorage.removeItem("ua_integrations")
    closeStreamRef.current?.()
    closeStreamRef.current = null
    router.push("/onboarding")
  }, [router])

  const loadMessages = useCallback(async () => {
    setLoadingMessages(true)
    try { setMessages(await fetchMessages()) } catch {} finally { setLoadingMessages(false) }
  }, [])

  const appendMessage = useCallback((raw: RawMessage) => {
    setMessages(prev => prev.find(m => m._id === raw._id) ? prev : [raw, ...prev])
  }, [])

  useEffect(() => {
    if (!ready) return
    loadMessages()
    const close = openStream(appendMessage, () => {
      const interval = setInterval(loadMessages, 15000)
      return () => clearInterval(interval)
    })
    closeStreamRef.current = close
    return () => { close(); closeStreamRef.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  if (!ready) return null

  if (connectStep) {
    const completed = ["whatsapp", "signal", "email"].map((s, i) => connected.has(s) ? i : -1).filter(i => i >= 0)
    const stepIdx = connectStep === "whatsapp" ? 0 : connectStep === "signal" ? 1 : 2

    if (connectStep === "email") {
      return (
        <div className="app-shell">
          <div className="scene-wrap scene-fwd" key="email">
            <EmailStep
              stepLabels={STEP_LABELS}
              current={2}
              completed={completed}
              stepLabel="Step 03 · Email"
              onConnected={() => { markConnected("email"); setConnectStep(null) }}
              onSkip={() => setConnectStep(null)}
              onBack={() => setConnectStep(null)}
            />
          </div>
        </div>
      )
    }

    return (
      <div className="app-shell">
        <div className="scene-wrap scene-fwd" key={connectStep}>
          <QRStep
            service={connectStep}
            serviceName={connectStep === "whatsapp" ? "WhatsApp" : "Signal"}
            serviceColor={connectStep === "whatsapp" ? "var(--wa)" : "var(--signal)"}
            ServiceIcon={connectStep === "whatsapp" ? Logo.WhatsApp : Logo.Signal}
            stepLabel={`Step 0${stepIdx + 1} · ${connectStep === "whatsapp" ? "WhatsApp" : "Signal"}`}
            lede={connectStep === "whatsapp"
              ? "Link your WhatsApp account in seconds by scanning a QR code."
              : "Link Signal Desktop to read and reply to your encrypted messages."}
            benefits={connectStep === "whatsapp" ? [
              "All chats, contacts and media — synced automatically",
              "Send and reply right from your UAssist dashboard",
            ] : [
              "Full end-to-end encryption, always on",
              "Read and send messages without touching your phone",
            ]}
            steps={connectStep === "whatsapp" ? [
              "Open WhatsApp on your phone",
              "Tap ⋮ → Linked Devices → Link a Device",
              "Point your camera at the QR code",
            ] : [
              "Open Signal on your phone",
              "Go to Settings → Linked Devices",
              "Tap + and scan the QR code",
            ]}
            stepLabels={STEP_LABELS}
            current={stepIdx}
            completed={completed}
            onConnected={() => { markConnected(connectStep); setConnectStep(null) }}
            onSkip={() => setConnectStep(null)}
            onBack={() => setConnectStep(null)}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Dashboard
        user={user ?? undefined}
        connected={connected}
        messages={messages}
        loadingMessages={loadingMessages}
        onConnect={(service) => setConnectStep(service as ConnectStep)}
        onLogout={handleLogout}
      />
    </div>
  )
}
