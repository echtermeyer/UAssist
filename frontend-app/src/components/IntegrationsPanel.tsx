"use client"

import { useState, useEffect, useRef } from "react"
import { Mail, MessageCircle, ShieldCheck, Check, ChevronDown, Eye, EyeOff, Link2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { startWhatsAppOnboard, pollWhatsAppStatus, startSignalOnboard, pollSignalStatus, connectEmail, connectSlack } from "@/lib/api"

type IntegrationId = "email" | "whatsapp" | "signal" | "slack"
type OnboardStatus = "idle" | "pending" | "connected" | "linked" | "error"

const STORAGE_KEY = "ua_integrations"

function loadConnected(): Set<IntegrationId> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return new Set((raw ? JSON.parse(raw) : []) as IntegrationId[])
  } catch {
    return new Set()
  }
}

function saveConnected(set: Set<IntegrationId>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
}

// ── Email card ─────────────────────────────────────────────────────────────────

function EmailCard({ connected, onConnect }: { connected: boolean; onConnect: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [emailVal, setEmailVal] = useState("")
  const [passwordVal, setPasswordVal] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleConnect() {
    if (!emailVal || !passwordVal) return
    setLoading(true)
    setError("")
    try {
      await connectEmail(emailVal, passwordVal)
      onConnect()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Connection failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn("rounded-2xl bg-white border shadow-sm overflow-hidden", connected ? "border-emerald-200" : "border-zinc-200")}>
      <button
        onClick={() => !connected && setExpanded(v => !v)}
        disabled={connected}
        className="w-full flex items-center gap-4 p-5 text-left disabled:cursor-default"
      >
        <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-blue-50">
          <Mail className="h-5 w-5 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-zinc-900">Email</p>
          <p className="text-xs text-zinc-500 mt-0.5">Send and receive emails via IMAP</p>
        </div>
        {connected ? (
          <span className="flex items-center gap-1.5 bg-emerald-100 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-full shrink-0">
            <Check className="h-3 w-3" /> Connected
          </span>
        ) : (
          <span className="flex items-center gap-1 text-zinc-400 text-xs font-medium shrink-0">
            Set up <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
          </span>
        )}
      </button>

      {!connected && expanded && (
        <div className="px-5 pb-5 border-t border-zinc-100 pt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Email address</label>
            <input
              type="email"
              value={emailVal}
              onChange={e => setEmailVal(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-200 bg-zinc-50 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Password</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={passwordVal}
                onChange={e => setPasswordVal(e.target.value)}
                placeholder="App password"
                className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-zinc-200 bg-zinc-50 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              />
              <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[11px] text-zinc-400">Use an app-specific password if 2FA is enabled</p>
          </div>
          {error && <p className="text-xs text-rose-600">{error}</p>}
          <button
            onClick={handleConnect}
            disabled={!emailVal || !passwordVal || loading}
            className="mt-1 w-full py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Connecting…" : "Connect"}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Slack card ─────────────────────────────────────────────────────────────────

function SlackCard({ connected, onConnect }: { connected: boolean; onConnect: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [botToken, setBotToken] = useState("")
  const [appToken, setAppToken] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleConnect() {
    if (!botToken || !appToken) return
    setLoading(true)
    setError("")
    try {
      await connectSlack(botToken, appToken)
      onConnect()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Connection failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn("rounded-2xl bg-white border shadow-sm overflow-hidden", connected ? "border-emerald-200" : "border-zinc-200")}>
      <button
        onClick={() => !connected && setExpanded(v => !v)}
        disabled={connected}
        className="w-full flex items-center gap-4 p-5 text-left disabled:cursor-default"
      >
        <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-purple-50">
          <svg className="h-5 w-5 text-purple-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-zinc-900">Slack</p>
          <p className="text-xs text-zinc-500 mt-0.5">Receive and send Slack messages via Socket Mode</p>
        </div>
        {connected ? (
          <span className="flex items-center gap-1.5 bg-emerald-100 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-full shrink-0">
            <Check className="h-3 w-3" /> Connected
          </span>
        ) : (
          <span className="flex items-center gap-1 text-zinc-400 text-xs font-medium shrink-0">
            Set up <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
          </span>
        )}
      </button>

      {!connected && expanded && (
        <div className="px-5 pb-5 border-t border-zinc-100 pt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Bot Token</label>
            <input
              type="password"
              value={botToken}
              onChange={e => setBotToken(e.target.value)}
              placeholder="xoxb-…"
              className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-200 bg-zinc-50 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">App-Level Token</label>
            <input
              type="password"
              value={appToken}
              onChange={e => setAppToken(e.target.value)}
              placeholder="xapp-…"
              className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-200 bg-zinc-50 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
            />
            <p className="text-[11px] text-zinc-400">Requires <code className="font-mono">connections:write</code> scope. Create at api.slack.com/apps.</p>
          </div>
          {error && <p className="text-xs text-rose-600">{error}</p>}
          <button
            onClick={handleConnect}
            disabled={!botToken || !appToken || loading}
            className="mt-1 w-full py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Connecting…" : "Connect"}
          </button>
        </div>
      )}
    </div>
  )
}

// ── QR card (WhatsApp + Signal) ───────────────────────────────────────────────

function QRCard({
  id,
  name,
  description,
  Icon,
  iconBg,
  iconColor,
  steps,
  connected,
  onConnect,
}: {
  id: IntegrationId
  name: string
  description: string
  Icon: React.ElementType
  iconBg: string
  iconColor: string
  steps: string[]
  connected: boolean
  onConnect: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [status, setStatus] = useState<OnboardStatus>("idle")
  const [qrData, setQrData] = useState<string | null>(null) // base64 PNG for WA, linkUri for Signal
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  useEffect(() => () => stopPolling(), [])

  async function handleStart() {
    setStatus("pending")
    setQrData(null)
    try {
      if (id === "whatsapp") {
        await startWhatsAppOnboard()
        pollRef.current = setInterval(async () => {
          const s = await pollWhatsAppStatus()
          if (s.qr) setQrData(s.qr)
          if (s.status === "connected") {
            stopPolling()
            setStatus("connected")
            onConnect()
          }
        }, 2000)
      } else {
        await startSignalOnboard()
        pollRef.current = setInterval(async () => {
          const s = await pollSignalStatus()
          if (s.linkUri) setQrData(s.linkUri)
          if (s.status === "linked") {
            stopPolling()
            setStatus("linked")
            onConnect()
          }
        }, 2000)
      }
    } catch {
      setStatus("error")
    }
  }

  const isDone = status === "connected" || status === "linked" || connected

  return (
    <div className={cn("rounded-2xl bg-white border shadow-sm overflow-hidden", isDone ? "border-emerald-200" : "border-zinc-200")}>
      <button
        onClick={() => !isDone && setExpanded(v => !v)}
        disabled={isDone}
        className="w-full flex items-center gap-4 p-5 text-left disabled:cursor-default"
      >
        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", iconBg)}>
          <Icon className={cn("h-5 w-5", iconColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-zinc-900">{name}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
        </div>
        {isDone ? (
          <span className="flex items-center gap-1.5 bg-emerald-100 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-full shrink-0">
            <Check className="h-3 w-3" /> Connected
          </span>
        ) : (
          <span className="flex items-center gap-1 text-zinc-400 text-xs font-medium shrink-0">
            Set up <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
          </span>
        )}
      </button>

      {!isDone && expanded && (
        <div className="px-5 pb-5 border-t border-zinc-100 pt-4">
          {status === "idle" && (
            <div>
              <ol className="space-y-2.5 mb-4">
                {steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs text-zinc-600 leading-relaxed">
                    <span className="mt-px h-4 w-4 rounded-full bg-zinc-100 text-zinc-500 font-bold text-[10px] flex items-center justify-center shrink-0">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
              <button
                onClick={handleStart}
                className="w-full py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-all"
              >
                Generate QR code
              </button>
            </div>
          )}

          {status === "pending" && !qrData && (
            <div className="flex items-center gap-2 py-4 text-xs text-zinc-500">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
              Generating QR code…
            </div>
          )}

          {status === "pending" && qrData && (
            <div className="flex items-start gap-5">
              {id === "whatsapp" ? (
                // plain img — Next.js Image doesn't support data: URLs
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrData} alt="WhatsApp QR" width={120} height={120} className="rounded-xl border border-zinc-200 shrink-0" />
              ) : (
                // Signal returns a linkdevice URI — encode as QR via an inline SVG trick
                // We display it as a data URL using the browser's canvas
                <SignalQR linkUri={qrData} />
              )}
              <div className="flex-1 min-w-0 pt-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Scan with your phone</p>
                <ol className="space-y-2.5">
                  {steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-xs text-zinc-600 leading-relaxed">
                      <span className="mt-px h-4 w-4 rounded-full bg-zinc-100 text-zinc-500 font-bold text-[10px] flex items-center justify-center shrink-0">{i + 1}</span>
                      {step}
                    </li>
                  ))}
                </ol>
                <div className="mt-4 flex items-center gap-1.5 text-[11px] text-zinc-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
                  Waiting for scan…
                </div>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="text-xs text-rose-600 py-2">
              Failed to start onboarding. Please try again.
              <button onClick={() => setStatus("idle")} className="ml-2 underline">Retry</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Renders a Signal linkdevice URI as a QR code using canvas
function SignalQR({ linkUri }: { linkUri: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current || !linkUri) return
    // Dynamically import qrcode to render into canvas
    import("qrcode").then(QRCode => {
      QRCode.toCanvas(canvasRef.current!, linkUri, { width: 120, margin: 1 }, () => {})
    })
  }, [linkUri])

  return <canvas ref={canvasRef} width={120} height={120} className="rounded-xl border border-zinc-200 shrink-0" />
}

// ── Panel ──────────────────────────────────────────────────────────────────────

export function IntegrationsPanel() {
  const [connected, setConnected] = useState<Set<IntegrationId>>(new Set())

  // Load persisted state on mount
  useEffect(() => {
    setConnected(loadConnected())
  }, [])

  const mark = (id: IntegrationId) => {
    setConnected(prev => {
      const next = new Set([...prev, id])
      saveConnected(next)
      return next
    })
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="h-14 border-b border-zinc-100 bg-white flex items-center px-6 shrink-0">
        <h2 className="font-bold text-[15px] text-zinc-900 tracking-tight">Integrations</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {connected.size === 0 && (
          <div className="flex items-start gap-3.5 bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm mb-5">
            <div className="h-9 w-9 rounded-xl bg-zinc-100 flex items-center justify-center shrink-0 mt-0.5">
              <Link2 className="h-4 w-4 text-zinc-500" />
            </div>
            <div>
              <p className="font-semibold text-sm text-zinc-900">Start integrating now</p>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                Connect your messaging channels to manage all conversations from one place.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <EmailCard connected={connected.has("email")} onConnect={() => mark("email")} />
          <SlackCard connected={connected.has("slack")} onConnect={() => mark("slack")} />
          <QRCard
            id="whatsapp"
            name="WhatsApp"
            description="Sync your WhatsApp messages"
            Icon={MessageCircle}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
            steps={[
              "Open WhatsApp on your phone",
              "Tap Menu or Settings → Linked Devices",
              'Tap "Link a Device"',
              "Scan the QR code with your camera",
            ]}
            connected={connected.has("whatsapp")}
            onConnect={() => mark("whatsapp")}
          />
          <QRCard
            id="signal"
            name="Signal"
            description="Connect your Signal account"
            Icon={ShieldCheck}
            iconBg="bg-indigo-50"
            iconColor="text-indigo-600"
            steps={[
              "Open Signal on your phone",
              "Go to Settings → Linked Devices",
              "Tap the + button",
              "Scan the QR code with your camera",
            ]}
            connected={connected.has("signal")}
            onConnect={() => mark("signal")}
          />
        </div>
      </div>
    </div>
  )
}
