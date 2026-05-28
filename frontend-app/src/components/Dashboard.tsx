"use client"

import React, { useState, useMemo, useEffect, useCallback } from "react"
import { BrandLogo, WordReveal, I, Logo } from "./shared"
import { formatRelativeTime } from "@/lib/utils"
import type { RawMessage, AiTodo, AiWhatMattersItem } from "@/lib/api"
import { fetchAiSummary, fetchAiTodos, fetchAiTodoState, toggleAiTodo, fetchAiWhatMatters } from "@/lib/api"

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
}

export function Dashboard({
  user,
  connected = new Set(),
  messages,
  loadingMessages,
  onConnect,
  onLogout,
}: DashboardProps) {
  const [active, setActive] = useState("all")
  const [selected, setSelected] = useState<string | null>(null)

  // AI state
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false)
  const [aiTodos, setAiTodos] = useState<AiTodo[]>([])
  const [aiTodoDone, setAiTodoDone] = useState<Set<number>>(new Set())
  const [aiTodosLoading, setAiTodosLoading] = useState(false)
  const [aiWhatMatters, setAiWhatMatters] = useState<AiWhatMattersItem[]>([])
  const [aiWhatMattersLoading, setAiWhatMattersLoading] = useState(false)

  const allServices = ["whatsapp", "signal", "email"]
  const missing = allServices.filter(s => !connected.has(s))
  const connectedArr = allServices.filter(s => connected.has(s))

  const firstName = user?.firstName || "Mark"
  const hour = new Date().getHours()
  const greeting = hour < 5 ? "Still up" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
  const dateStr = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })

  const inboxRows: InboxRow[] = useMemo(() => (messages ?? []).map(toInboxRow), [messages])

  const visibleMessages = useMemo(() => {
    return inboxRows.filter(m => connected.has(m.ch))
  }, [inboxRows, connected])

  const filtered = useMemo(() => {
    if (active === "all") return visibleMessages
    return visibleMessages.filter(m => m.ch === active)
  }, [active, visibleMessages])

  const hasData = visibleMessages.length > 0
  const hasConnected = connected.size > 0

  // Fetch AI data when messages are available
  useEffect(() => {
    if (!hasData) return
    setAiSummaryLoading(true)
    fetchAiSummary()
      .then(res => setAiSummary(res.summary))
      .catch(() => setAiSummary(null))
      .finally(() => setAiSummaryLoading(false))
  }, [hasData])

  useEffect(() => {
    if (!hasData) return
    setAiTodosLoading(true)
    Promise.all([fetchAiTodos(), fetchAiTodoState()])
      .then(([todosRes, stateRes]) => {
        setAiTodos(todosRes.todos)
        setAiTodoDone(new Set(stateRes.done))
      })
      .catch(() => {})
      .finally(() => setAiTodosLoading(false))
  }, [hasData])

  useEffect(() => {
    if (!hasData) return
    setAiWhatMattersLoading(true)
    fetchAiWhatMatters()
      .then(res => setAiWhatMatters(res.items))
      .catch(() => setAiWhatMatters([]))
      .finally(() => setAiWhatMattersLoading(false))
  }, [hasData])

  const handleTodoToggle = useCallback(async (index: number) => {
    // Optimistic update
    setAiTodoDone(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
    try {
      const res = await toggleAiTodo(index)
      setAiTodoDone(new Set(res.done))
    } catch {}
  }, [])

  // Sort todos: undone first, done last
  const sortedTodos = useMemo(() => {
    return aiTodos.map((todo, i) => ({ ...todo, index: i, done: aiTodoDone.has(i) }))
      .sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1))
  }, [aiTodos, aiTodoDone])

  return (
    <div className="dash-shell">
      {/* ─── Sidebar ─── */}
      <aside className="dash-side">
        <div className="brand-row" style={{ cursor: "default" }}>
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
            {loadingMessages ? "Loading messages…" : hasData ? `${visibleMessages.filter(m => m.unread).length} new since 07:00` : "Connect a service to get started"}
          </div>
        </div>

        {missing.length > 0 && (
          <div className="connect-more-card">
            <div className="cmc-head">
              <div>
                <div className="eyebrow" style={{ color: "var(--accent)" }}>{hasConnected ? "Get more from UAssist" : "Welcome to UAssist"}</div>
                <h3 className="cmc-title">
                  {hasConnected
                    ? `Connect ${missing.length === 1 ? "one more channel" : `${missing.length} more channels`} to see your full picture.`
                    : "Connect your first service to get started."}
                </h3>
                <p className="cmc-sub">
                  {hasConnected
                    ? "UAssist works with whatever you've connected — but the assistant gets sharper the more sources it can listen to."
                    : "UAssist unifies your WhatsApp, Signal, and email into one calm surface. Connect a service below and your messages will appear here within seconds."}
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

        {hasData ? (
          <>
            <div className="section-h">
              <span className="t serif">What matters today</span>
              <span className="a">AI digest · {aiWhatMattersLoading ? "refreshing..." : "refreshed just now"}</span>
            </div>

            <div className="digest-grid">
              {aiWhatMattersLoading ? (
                <div className="digest-card" style={{ opacity: 0.55, gridColumn: "1 / -1" }}>
                  <span className="kind"><span className="k-dot" style={{ background: "var(--ink-mute)" }} /> Loading AI digest...</span>
                  <div className="title-line" style={{ color: "var(--ink-mute)", fontSize: 15 }}>
                    Analyzing your messages to surface what matters most...
                  </div>
                </div>
              ) : aiWhatMatters.length > 0 ? (
                aiWhatMatters.slice(0, 3).map((item, i) => (
                  <div key={i} className="digest-card">
                    <span className="kind"><span className="k-dot" style={{ background: `var(--${item.kindColor || "accent"})` }} /> {item.kind}</span>
                    <div className="title-line">{item.title}</div>
                    <div className="ctx"><span className="ch-dot" /> {item.context}</div>
                  </div>
                ))
              ) : (
                <div className="digest-card" style={{ opacity: 0.55, gridColumn: "1 / -1" }}>
                  <span className="kind"><span className="k-dot" style={{ background: "var(--ink-mute)" }} /> AI digest</span>
                  <div className="title-line" style={{ color: "var(--ink-mute)", fontSize: 15 }}>
                    Nothing urgent found in today's messages. You're all caught up!
                  </div>
                </div>
              )}
            </div>
          </>
        ) : hasConnected ? (
          <div className="digest-grid">
            <div className="digest-card" style={{ opacity: 0.55, gridColumn: "1 / -1" }}>
              <span className="kind"><span className="k-dot" style={{ background: "var(--ink-mute)" }} /> AI digest · waiting for data</span>
              <div className="title-line" style={{ color: "var(--ink-mute)", fontSize: 15 }}>
                Once messages arrive, UAssist will surface tasks, schedule items, and things that need your attention — all in one digest.
              </div>
              <div className="ctx"><span className="ch-dot" /> Pulled from your connected services</div>
            </div>
          </div>
        ) : (
          <div className="digest-grid">
            {[
              { dot: "var(--insight)", label: "Tasks", desc: "UAssist spots action items in your conversations and surfaces them before you forget." },
              { dot: "var(--accent)", label: "Schedule", desc: "Times, appointments, and plans mentioned in any message — collected automatically." },
              { dot: "var(--email)", label: "Heads up", desc: "Important emails, alerts, and things that need a quick read, filtered from the noise." },
            ].map(({ dot, label, desc }) => (
              <div key={label} className="digest-card" style={{ opacity: 0.45 }}>
                <span className="kind"><span className="k-dot" style={{ background: dot }} /> {label}</span>
                <div className="title-line" style={{ color: "var(--ink-mute)", fontSize: 14, fontStyle: "normal" }}>{desc}</div>
                <div className="ctx" style={{ opacity: 0 }}>placeholder</div>
              </div>
            ))}
          </div>
        )}

        <div className="section-h">
          <span className="t serif">Inbox</span>
          <span className="a" style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {hasData && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <I.Search size={11} /> Search <span className="kbd">⌘K</span>
              </span>
            )}
            <span>{hasData ? `${filtered.length} messages` : "No messages yet"}</span>
          </span>
        </div>

        {hasData ? (
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
        ) : (
          <div style={{ padding: "40px 0", textAlign: "center", color: "var(--ink-faint)" }}>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>
              {hasConnected
                ? "Your messages will appear here as they arrive."
                : "Connect WhatsApp, Signal, or Email above and your messages will flow in here."}
            </div>
          </div>
        )}
      </main>

      {/* ─── Right rail ─── */}
      <aside className="dash-rail">
        <div className="rail-head">
          <BrandLogo size={26} />
          Your <span className="it">assistant</span>
        </div>

        {hasData ? (
          <>
            <div className="assistant-bubble fade-enter">
              <div className="from">
                <span className="av">
                  <BrandLogo size={18} color="transparent" fg="var(--accent)" />
                </span>
                UAssist · just now
              </div>
              <div className="body">
                {aiSummaryLoading ? (
                  <em style={{ color: "var(--ink-mute)" }}>Summarizing your messages...</em>
                ) : aiSummary ? (
                  aiSummary
                ) : (
                  "I'm analyzing your messages. Check back shortly."
                )}
              </div>
            </div>

            <div>
              <div className="label-mono" style={{ marginBottom: 12 }}>
                {aiTodosLoading ? "Loading todos..." : `Open todos · ${sortedTodos.filter(t => !t.done).length}`}
              </div>
              <div className="todo-list">
                {sortedTodos.map(t => (
                  <div
                    key={t.index}
                    className={`todo-row ${t.done ? "done" : ""}`}
                    onClick={() => handleTodoToggle(t.index)}
                    style={{ cursor: "pointer" }}
                  >
                    <span className={`check ${t.done ? "done" : ""}`}>
                      {t.done && <I.CheckSm style={{ color: "#fff", marginTop: 1 }} />}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="t" style={t.done ? { textDecoration: "line-through", opacity: 0.5 } : undefined}>{t.text}</div>
                      <div className="meta">{t.meta}</div>
                    </div>
                  </div>
                ))}
                {!aiTodosLoading && sortedTodos.length === 0 && (
                  <div style={{ fontSize: 13, color: "var(--ink-faint)", padding: "8px 0" }}>
                    No to-do items extracted from today's messages.
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="assistant-bubble fade-enter" style={{ opacity: 0.55 }}>
            <div className="from">
              <span className="av">
                <BrandLogo size={18} color="transparent" fg="var(--accent)" />
              </span>
              UAssist
            </div>
            <div className="body">
              Connect your services and I'll start reading your messages. I'll surface tasks, reminders, and things that need your attention — so you don't have to.
            </div>
          </div>
        )}

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
