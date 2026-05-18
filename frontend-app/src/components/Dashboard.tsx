"use client"

import React, { useState, useMemo } from "react"
import { BrandLogo, WordReveal, I, Logo } from "./shared"
import { formatRelativeTime } from "@/lib/utils"
import type { RawMessage } from "@/lib/api"

// ─── Types ────────────────────────────────────────────────────────────────────

type InboxRow = {
  id: string
  ch: "whatsapp" | "signal" | "email"
  name: string
  preview: string
  time: string
  unread: boolean
  initial: string
  color: string
}

const CHANNEL_COLORS = {
  whatsapp: "#1f7a4a",
  signal: "#2c4ea8",
  email: "#8c5a1d",
}

function toInboxRow(msg: RawMessage): InboxRow {
  const ch = (msg._service === "slack" ? "email" : msg._service) as "whatsapp" | "signal" | "email"
  const name = msg.fromName
    || (typeof msg.from === "string" ? msg.from : undefined)
    || msg.envelope?.from?.[0]?.name
    || msg.envelope?.from?.[0]?.address
    || "Unknown"
  const preview = msg.bodyText || msg.body || msg.message || msg.envelope?.subject || ""
  return {
    id: msg._id,
    ch,
    name,
    preview: preview.slice(0, 120),
    time: formatRelativeTime(msg._savedAt),
    unread: true,
    initial: name.charAt(0).toUpperCase(),
    color: CHANNEL_COLORS[ch] || "#8c5a1d",
  }
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const MESSAGES: InboxRow[] = [
  { id: "1", ch: "whatsapp", name: "Lena Mohr", preview: "Can you grab oat milk on your way home? And maybe pick the kid up at 16:30?", time: "09:14", unread: true, initial: "L", color: "#1f7a4a" },
  { id: "2", ch: "signal", name: "Jonas Reuter", preview: "Moved our Thursday review to 14:00 — works?", time: "09:22", unread: true, initial: "J", color: "#2c4ea8" },
  { id: "3", ch: "email", name: "Deutsche Bahn", preview: "Your ICE 1573 to München has been rebooked to platform 7.", time: "09:31", unread: true, initial: "D", color: "#8c5a1d" },
  { id: "4", ch: "email", name: "Stripe", preview: "Invoice #INV-4421 for €840.00 was paid by Northstar GmbH.", time: "08:47", unread: false, initial: "S", color: "#635bff" },
  { id: "5", ch: "whatsapp", name: "Family group", preview: "Mama: Sunday lunch at our place — bring something sweet?", time: "08:12", unread: false, initial: "F", color: "#1f7a4a" },
  { id: "6", ch: "signal", name: "Mira Köhler", preview: "The contract draft you wanted, v3. Take a look when you can.", time: "Yesterday", unread: false, initial: "M", color: "#2c4ea8" },
  { id: "7", ch: "email", name: "GitHub", preview: "[uassist/api] PR #218: Add tenant-scoped onboarding hooks", time: "Yesterday", unread: false, initial: "G", color: "#24292e" },
  { id: "8", ch: "whatsapp", name: "Tomek Z.", preview: "Yo — climbing at 19? Bouldering hall by the canal.", time: "Mon", unread: false, initial: "T", color: "#1f7a4a" },
  { id: "9", ch: "email", name: "Notion", preview: "3 pages were updated in the Q3 planning space.", time: "Mon", unread: false, initial: "N", color: "#000" },
  { id: "10", ch: "signal", name: "Anna B.", preview: "Thanks for the recommendation — booked the tasting for Saturday.", time: "Sun", unread: false, initial: "A", color: "#2c4ea8" },
]

const TODOS = [
  { id: 1, text: "Pick up oat milk on the way home", meta: "From Lena · WhatsApp · today", done: false },
  { id: 2, text: "Confirm Thursday 14:00 review with Jonas", meta: "From Jonas · Signal · today", done: false },
  { id: 3, text: "Review contract draft v3", meta: "From Mira · Signal · yesterday", done: true },
  { id: 4, text: "RSVP family lunch Sunday", meta: "From Mama · WhatsApp · today", done: false },
]

const CHANNEL_META = {
  all: { label: "Everything", color: "var(--ink)" },
  whatsapp: { label: "WhatsApp", color: "var(--wa)" },
  signal: { label: "Signal", color: "var(--signal)" },
  email: { label: "Email", color: "var(--email)" },
}

function ChannelTag({ ch }: { ch: string }) {
  const meta = CHANNEL_META[ch as keyof typeof CHANNEL_META] || CHANNEL_META.email
  return <span className="ch-tag" style={{ color: meta.color }}>{meta.label}</span>
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

type DashboardProps = {
  user?: { firstName: string; phone: string }
  connected?: Set<string>
  messages?: RawMessage[]
  loadingMessages?: boolean
  onConnect?: (service: string) => void
  onLogout?: () => void
  onReset?: () => void
}

export function Dashboard({
  user,
  connected = new Set(["whatsapp", "signal", "email"]),
  messages,
  loadingMessages,
  onConnect,
  onLogout,
  onReset,
}: DashboardProps) {
  const [active, setActive] = useState("all")
  const [todos, setTodos] = useState(TODOS)
  const [selected, setSelected] = useState<string | null>("1")

  const allServices = ["whatsapp", "signal", "email"]
  const missing = allServices.filter(s => !connected.has(s))
  const connectedArr = allServices.filter(s => connected.has(s))

  const firstName = user?.firstName || "Mark"
  const hour = new Date().getHours()
  const greeting = hour < 5 ? "Still up" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
  const dateStr = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })

  const inboxRows: InboxRow[] = useMemo(() => {
    if (messages && messages.length > 0) return messages.map(toInboxRow)
    return MESSAGES
  }, [messages])

  const visibleMessages = useMemo(() => {
    return inboxRows.filter(m => connected.has(m.ch))
  }, [inboxRows, connected])

  const filtered = useMemo(() => {
    if (active === "all") return visibleMessages
    return visibleMessages.filter(m => m.ch === active)
  }, [active, visibleMessages])

  const toggleTodo = (id: number) => setTodos(ts => ts.map(t => t.id === id ? { ...t, done: !t.done } : t))

  return (
    <div className="dash-shell">
      {/* ─── Sidebar ─── */}
      <aside className="dash-side">
        <div className="brand-row">
          <BrandLogo size={26} />
          <span className="brand-text">UAssist</span>
        </div>

        <div className="side-section">
          <div className="heading">Inbox</div>
          {Object.entries(CHANNEL_META).map(([key, m]) => {
            const count = key === "all"
              ? visibleMessages.length
              : visibleMessages.filter(msg => msg.ch === key).length
            const isConnected = key === "all" || connected.has(key)
            if (!isConnected) {
              return (
                <div
                  key={key}
                  className="side-item side-item-disconnected"
                  onClick={() => onConnect?.(key)}
                  title={`Connect ${m.label}`}
                >
                  <span className="swatch" style={{ background: m.color, opacity: 0.35 }} />
                  <span style={{ color: "var(--ink-faint)" }}>{m.label}</span>
                  <span className="connect-pill"><I.Plus size={11} /> Add</span>
                </div>
              )
            }
            return (
              <div
                key={key}
                className={`side-item ${active === key ? "active" : ""}`}
                onClick={() => setActive(key)}
              >
                <span className="swatch" style={{ background: m.color }} />
                {m.label}
                <span className="count">{count}</span>
              </div>
            )
          })}
        </div>

        <div className="side-section">
          <div className="heading">Assistant</div>
          <div className="side-item"><I.Sparkles size={14} />Daily digest</div>
          <div className="side-item"><I.Bell size={14} />Reminders<span className="count">4</span></div>
          <div className="side-item"><I.Calendar size={14} />Schedule</div>
        </div>

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="user-card">
            <div className="user-avatar">{firstName.charAt(0).toUpperCase()}</div>
            <div className="user-meta">
              <div className="user-name">{firstName}</div>
              <div className="user-phone">{user?.phone || "+49 ··· ·· ····"}</div>
            </div>
            {onLogout && (
              <button className="user-logout" onClick={onLogout} title="Log out">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <path d="M16 17l5-5-5-5" />
                  <path d="M21 12H9" />
                </svg>
              </button>
            )}
          </div>

          <div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-faint)", marginBottom: 6 }}>
              Channels · {connectedArr.length}/3
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              {allServices.map(s => (
                <span key={s} style={{
                  width: 8, height: 8,
                  background: CHANNEL_META[s as keyof typeof CHANNEL_META].color,
                  opacity: connected.has(s) ? 1 : 0.25,
                  borderRadius: "50%",
                }} />
              ))}
              <span style={{ fontSize: 11.5, color: "var(--ink-mute)", marginLeft: 4 }}>
                {connectedArr.length === 0 ? "none connected" : `${connectedArr.length} live`}
              </span>
            </div>
            {onReset && (
              <button
                className="skip-link"
                onClick={onReset}
                style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 8, alignSelf: "flex-start", display: "inline-block" }}
              >
                Restart onboarding
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ─── Main ─── */}
      <main className="dash-main fade-enter">
        <div className="dash-greeting">
          <div className="greet" style={{ fontFamily: "var(--sans)" }}>
            <WordReveal delay={0.05} gap={0.06}>{greeting}, </WordReveal>
            <br />
            <span className="it"><WordReveal delay={0.25} gap={0.06}>{firstName}.</WordReveal></span>
          </div>
          <div className="meta">
            {dateStr}<br />
            {loadingMessages ? "Loading messages…" : `${visibleMessages.filter(m => m.unread).length} new since 07:00`}
          </div>
        </div>

        {missing.length > 0 && (
          <div className="connect-more-card">
            <div className="cmc-head">
              <div>
                <div className="eyebrow" style={{ color: "var(--accent)" }}>Get more from UAssist</div>
                <h3 className="cmc-title">
                  Connect {missing.length === 1 ? "one more channel" : `${missing.length} more channels`} to see your full picture.
                </h3>
                <p className="cmc-sub">
                  UAssist works with whatever you&apos;ve connected — but the assistant gets sharper the more sources it can listen to.
                </p>
              </div>
            </div>
            <div className="cmc-row">
              {missing.map(s => {
                const meta = CHANNEL_META[s as keyof typeof CHANNEL_META]
                const icon = s === "whatsapp" ? <Logo.WhatsApp size={18} /> : s === "signal" ? <Logo.Signal size={18} /> : <Logo.Mail size={18} />
                return (
                  <button key={s} className="cmc-chip" onClick={() => onConnect?.(s)}>
                    <span className="cmc-chip-icon" style={{ background: meta.color }}>{icon}</span>
                    <span className="cmc-chip-text">
                      <span className="n">Connect {meta.label}</span>
                      <span className="d">{s === "email" ? "IMAP · 1 minute" : "Scan QR · 30 seconds"}</span>
                    </span>
                    <I.Arrow />
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="section-h">
          <span className="t serif">What matters today</span>
          <span className="a">AI digest · refreshed 2m ago</span>
        </div>

        <div className="digest-grid">
          <div className="digest-card">
            <span className="kind"><span className="k-dot" style={{ background: "var(--insight)" }} /> Tasks · 4</span>
            <div className="title-line">
              <span className="serif-it" style={{ color: "var(--accent)", fontSize: 18 }}>Oat milk</span> on the way home, and confirm a{" "}
              <span className="serif-it" style={{ color: "var(--accent)", fontSize: 18 }}>Thursday review</span> with Jonas.
            </div>
            <div className="ctx"><span className="ch-dot" /> Pulled from WhatsApp, Signal</div>
          </div>
          <div className="digest-card">
            <span className="kind"><span className="k-dot" style={{ background: "var(--accent)" }} /> Schedule</span>
            <div className="title-line">
              School pickup moved to <span className="serif-it" style={{ color: "var(--accent)", fontSize: 18 }}>16:30</span>. Family lunch Sunday — bring something sweet.
            </div>
            <div className="ctx"><span className="ch-dot" /> WhatsApp · Lena, Mama</div>
          </div>
          <div className="digest-card">
            <span className="kind"><span className="k-dot" style={{ background: "var(--email)" }} /> Heads up</span>
            <div className="title-line">
              Your <span className="serif-it" style={{ color: "var(--accent)", fontSize: 18 }}>ICE to München</span> changed to platform 7. Stripe invoice paid: €840.
            </div>
            <div className="ctx"><span className="ch-dot" /> Email · Deutsche Bahn, Stripe</div>
          </div>
        </div>

        <div className="section-h">
          <span className="t serif">Inbox</span>
          <span className="a" style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <I.Search size={11} /> Search <span className="kbd">⌘K</span>
            </span>
            <span>{filtered.length} messages</span>
          </span>
        </div>

        <div className="inbox-list">
          {filtered.map(m => (
            <div
              key={m.id}
              className={`inbox-row ${m.unread ? "unread" : ""} ${selected === m.id ? "selected" : ""}`}
              onClick={() => setSelected(m.id)}
              style={selected === m.id ? { background: "var(--paper-soft)" } : undefined}
            >
              <div className="av" style={{ background: m.color }}>{m.initial}</div>
              <div className="mid">
                <div className="name-row">
                  <span className="nm">{m.name}</span>
                  <ChannelTag ch={m.ch} />
                  {m.unread && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} />}
                </div>
                <div className="preview">{m.preview}</div>
              </div>
              <div className="time">{m.time}</div>
            </div>
          ))}
        </div>
      </main>

      {/* ─── Right rail ─── */}
      <aside className="dash-rail">
        <div className="rail-head">
          <BrandLogo size={26} />
          Your <span className="it">assistant</span>
        </div>

        <div className="assistant-bubble fade-enter">
          <div className="from">
            <span className="av">
              <BrandLogo size={18} color="transparent" fg="var(--accent)" />
            </span>
            UAssist · 2 min ago
          </div>
          <div className="body">
            You have <em>three things</em> to handle before noon: pick up oat milk for Lena, confirm the Thursday review with Jonas, and your train moved to <em>platform 7</em>.
            <br /><br />
            Want me to message Jonas back about 14:00?
          </div>
          <div className="actions">
            <button className="a primary">Yes, reply 14:00 works</button>
            <button className="a">Snooze 1h</button>
            <button className="a">Not now</button>
          </div>
        </div>

        <div>
          <div className="label-mono" style={{ marginBottom: 12 }}>Open todos · {todos.filter(t => !t.done).length}</div>
          <div className="todo-list">
            {todos.map(t => (
              <div key={t.id} className={`todo-row ${t.done ? "done" : ""}`}>
                <span className={`check ${t.done ? "done" : ""}`} onClick={() => toggleTodo(t.id)}>
                  {t.done && <I.CheckSm style={{ color: "#fff", marginTop: 1 }} />}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t">{t.text}</div>
                  <div className="meta">{t.meta}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{
          marginTop: "auto",
          padding: "16px 18px",
          background: "var(--card-elev)",
          borderRadius: 14,
          border: "1px solid var(--hairline-soft)",
          boxShadow: "var(--shadow-sm)",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}>
          <span style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "var(--accent-tint)", color: "var(--accent)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}>
            <I.Shield />
          </span>
          <div style={{ fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.45 }}>
            <strong style={{ color: "var(--ink)", fontWeight: 500 }}>Hosted in Frankfurt.</strong>{" "}
            All messages encrypted with your tenant key.{" "}
            <a style={{ color: "var(--accent)" }}>Privacy →</a>
          </div>
        </div>
      </aside>
    </div>
  )
}
