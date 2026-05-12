"use client"

import { useState } from "react"
import { Mail, MessageCircle, ShieldCheck, Check, ChevronDown, Eye, EyeOff, Link2 } from "lucide-react"
import { cn } from "@/lib/utils"

// ── QR mock ────────────────────────────────────────────────────────────────
const QR_SIZE = 17

function buildQRCells(): boolean[] {
  const inFinder = (r: number, c: number, sr: number, sc: number): boolean | null => {
    const fr = r - sr
    const fc = c - sc
    if (fr < 0 || fr > 6 || fc < 0 || fc > 6) return null
    return (fr === 0 || fr === 6 || fc === 0 || fc === 6) || (fr >= 2 && fr <= 4 && fc >= 2 && fc <= 4)
  }
  const cells: boolean[] = []
  let seed = 0x1337cafe
  for (let r = 0; r < QR_SIZE; r++) {
    for (let c = 0; c < QR_SIZE; c++) {
      const tl = inFinder(r, c, 0, 0)
      const tr = inFinder(r, c, 0, 10)
      const bl = inFinder(r, c, 10, 0)
      if (tl !== null) { cells.push(tl); continue }
      if (tr !== null) { cells.push(tr); continue }
      if (bl !== null) { cells.push(bl); continue }
      // separator columns/rows
      if (c === 7 || (r === 7 && c <= 9) || (r === 9 && c <= 7)) { cells.push(false); continue }
      seed = ((seed * 1664525) + 1013904223) | 0
      cells.push((seed >>> 0) % 2 === 0)
    }
  }
  return cells
}

const QR_CELLS = buildQRCells()

function QRCode() {
  return (
    <div className="p-2.5 bg-white rounded-xl border border-zinc-200 inline-flex shrink-0">
      <div className="grid gap-[1.5px]" style={{ gridTemplateColumns: `repeat(${QR_SIZE}, 6px)` }}>
        {QR_CELLS.map((on, i) => (
          <div key={i} className={cn("h-[6px] w-[6px] rounded-[1px]", on ? "bg-zinc-900" : "")} />
        ))}
      </div>
    </div>
  )
}

// ── Definitions ────────────────────────────────────────────────────────────
type IntegrationId = "email" | "whatsapp" | "signal"

const INTEGRATIONS = [
  {
    id: "email" as IntegrationId,
    name: "Email",
    description: "Send and receive emails via IMAP",
    Icon: Mail,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    kind: "form" as const,
  },
  {
    id: "whatsapp" as IntegrationId,
    name: "WhatsApp",
    description: "Sync your WhatsApp messages",
    Icon: MessageCircle,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    kind: "qr" as const,
    steps: [
      "Open WhatsApp on your phone",
      "Tap Menu or Settings → Linked Devices",
      'Tap "Link a Device"',
      "Scan the QR code with your camera",
    ],
  },
  {
    id: "signal" as IntegrationId,
    name: "Signal",
    description: "Connect your Signal account",
    Icon: ShieldCheck,
    iconBg: "bg-indigo-50",
    iconColor: "text-indigo-600",
    kind: "qr" as const,
    steps: [
      "Open Signal on your phone",
      "Go to Settings → Linked Devices",
      "Tap the + button",
      "Scan the QR code with your camera",
    ],
  },
]

// ── Card ───────────────────────────────────────────────────────────────────
function IntegrationCard({
  integration,
  connected,
  onConnect,
}: {
  integration: (typeof INTEGRATIONS)[number]
  connected: boolean
  onConnect: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [emailVal, setEmailVal] = useState("")
  const [passwordVal, setPasswordVal] = useState("")
  const [showPw, setShowPw] = useState(false)

  const { name, description, Icon, iconBg, iconColor, kind } = integration

  return (
    <div
      className={cn(
        "rounded-2xl bg-white border shadow-sm overflow-hidden",
        connected ? "border-emerald-200" : "border-zinc-200"
      )}
    >
      <button
        onClick={() => !connected && setExpanded((v) => !v)}
        disabled={connected}
        className="w-full flex items-center gap-4 p-5 text-left disabled:cursor-default"
      >
        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", iconBg)}>
          <Icon className={cn("h-5 w-5", iconColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-zinc-900">{name}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
        </div>
        {connected ? (
          <span className="flex items-center gap-1.5 bg-emerald-100 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-full shrink-0">
            <Check className="h-3 w-3" /> Connected
          </span>
        ) : (
          <span className="flex items-center gap-1 text-zinc-400 text-xs font-medium shrink-0">
            Set up
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
          </span>
        )}
      </button>

      {!connected && expanded && (
        <div className="px-5 pb-5 border-t border-zinc-100">
          {kind === "form" ? (
            <div className="pt-4 flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Email address
                </label>
                <input
                  type="email"
                  value={emailVal}
                  onChange={(e) => setEmailVal(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-200 bg-zinc-50 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={passwordVal}
                    onChange={(e) => setPasswordVal(e.target.value)}
                    placeholder="App password"
                    className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-zinc-200 bg-zinc-50 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-zinc-400">Use an app-specific password if 2FA is enabled</p>
              </div>
              <button
                onClick={() => { if (emailVal && passwordVal) onConnect() }}
                disabled={!emailVal || !passwordVal}
                className="mt-1 w-full py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Connect
              </button>
            </div>
          ) : (
            <div className="pt-4 flex items-start gap-5">
              <QRCode />
              <div className="flex-1 min-w-0 pt-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
                  How to connect
                </p>
                <ol className="space-y-2.5">
                  {integration.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-xs text-zinc-600 leading-relaxed">
                      <span className="mt-px h-4 w-4 rounded-full bg-zinc-100 text-zinc-500 font-bold text-[10px] flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
                <div className="mt-4 flex items-center gap-1.5 text-[11px] text-zinc-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 inline-block" />
                  Waiting for scan…
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Panel ──────────────────────────────────────────────────────────────────
export function IntegrationsPanel() {
  const [connected, setConnected] = useState<Set<IntegrationId>>(new Set())

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
          {INTEGRATIONS.map((integration) => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              connected={connected.has(integration.id)}
              onConnect={() => setConnected((prev) => new Set([...prev, integration.id]))}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
