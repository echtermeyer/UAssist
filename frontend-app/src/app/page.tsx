"use client"

import { useState, useEffect, useCallback } from "react"
import { type Message, normalizeMessage } from "@/lib/mock-data"
import { fetchMessages, login, getToken, clearToken } from "@/lib/api"
import { Header } from "@/components/Header"
import { MessageList } from "@/components/MessageList"
import { DetailView } from "@/components/DetailView"
import { IntegrationsPanel } from "@/components/IntegrationsPanel"

// ── Login screen ─────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await login(username, password)
      onLogin()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-zinc-50">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-zinc-200 shadow-sm p-8">
        <h1 className="text-xl font-bold text-zinc-900 mb-1">UAssist</h1>
        <p className="text-sm text-zinc-500 mb-6">Sign in to continue</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-200 bg-zinc-50 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-200 bg-zinc-50 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              required
            />
          </div>
          {error && <p className="text-xs text-rose-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-1 w-full py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Page() {
  const [authed, setAuthed] = useState<boolean | null>(null) // null = checking
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Message | null>(null)

  // Check for existing token on mount
  useEffect(() => {
    setAuthed(!!getToken())
  }, [])

  const loadMessages = useCallback(async () => {
    setLoading(true)
    try {
      const raw = await fetchMessages()
      setMessages(raw.map(normalizeMessage))
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "UNAUTHORIZED") {
        setAuthed(false)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authed) {
      loadMessages()
      // Poll every 15s for new messages
      const interval = setInterval(loadMessages, 15000)
      return () => clearInterval(interval)
    }
  }, [authed, loadMessages])

  if (authed === null) return null // brief flash while checking localStorage

  if (!authed) {
    return <LoginScreen onLogin={() => setAuthed(true)} />
  }

  return (
    <div className="flex h-screen bg-zinc-50">
      {/* Left 50% — messaging */}
      <div className="w-1/2 flex flex-col border-r border-zinc-200 overflow-hidden">
        <Header onLogout={() => { clearToken(); setAuthed(false) }} />
        <div className="flex flex-1 overflow-hidden">
          <div className="w-[42%] flex flex-col border-r border-zinc-100 overflow-hidden bg-zinc-50">
            <MessageList
              messages={messages}
              loading={loading && messages.length === 0}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
            />
          </div>
          <div className="flex-1 flex flex-col overflow-hidden bg-white">
            <DetailView message={selected} onRefresh={loadMessages} />
          </div>
        </div>
      </div>

      {/* Right 50% — integrations */}
      <div className="w-1/2 flex flex-col overflow-hidden">
        <IntegrationsPanel />
      </div>
    </div>
  )
}
