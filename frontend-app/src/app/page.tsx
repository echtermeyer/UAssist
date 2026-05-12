"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { type Message, normalizeMessage } from "@/lib/mock-data"
import { fetchMessages, login, signup, getToken, clearToken, openStream } from "@/lib/api"
import type { RawMessage } from "@/lib/api"
import { Header } from "@/components/Header"
import { MessageList } from "@/components/MessageList"
import { DetailView } from "@/components/DetailView"
import { IntegrationsPanel } from "@/components/IntegrationsPanel"

// ── Auth screens ──────────────────────────────────────────────────────────────

type AuthMode = "login" | "signup"

function AuthScreen({ onAuth }: { onAuth: () => void }) {
  const [mode, setMode] = useState<AuthMode>("login")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      if (mode === "login") {
        await login(username, password)
      } else {
        await signup(username, password)
      }
      onAuth()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-zinc-50">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-zinc-200 shadow-sm p-8">
        <h1 className="text-xl font-bold text-zinc-900 mb-1">UAssist</h1>
        <p className="text-sm text-zinc-500 mb-6">
          {mode === "login" ? "Sign in to continue" : "Create your account"}
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={mode === "login" ? "admin" : "yourname"}
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
              minLength={6}
            />
          </div>
          {error && <p className="text-xs text-rose-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-1 w-full py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? (mode === "login" ? "Signing in…" : "Creating account…") : (mode === "login" ? "Sign in" : "Create account")}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-zinc-100 text-center">
          {mode === "login" ? (
            <p className="text-xs text-zinc-500">
              No account?{" "}
              <button onClick={() => { setMode("signup"); setError("") }} className="text-emerald-600 font-semibold hover:underline">
                Sign up
              </button>
            </p>
          ) : (
            <p className="text-xs text-zinc-500">
              Already have an account?{" "}
              <button onClick={() => { setMode("login"); setError("") }} className="text-emerald-600 font-semibold hover:underline">
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Page() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Message | null>(null)
  const closeStreamRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    setAuthed(!!getToken())
  }, [])

  const loadMessages = useCallback(async () => {
    setLoading(true)
    try {
      const raw = await fetchMessages()
      setMessages(raw.map(normalizeMessage))
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "UNAUTHORIZED") setAuthed(false)
    } finally {
      setLoading(false)
    }
  }, [])

  const appendMessage = useCallback((raw: RawMessage) => {
    const msg = normalizeMessage(raw)
    setMessages(prev => {
      if (prev.find(m => m.id === msg.id)) return prev
      return [msg, ...prev]
    })
  }, [])

  useEffect(() => {
    if (!authed) return

    // Initial load
    loadMessages()

    // SSE stream for real-time updates
    const close = openStream(appendMessage, () => {
      // On SSE error fall back to polling every 15s
      const interval = setInterval(loadMessages, 15000)
      return () => clearInterval(interval)
    })
    closeStreamRef.current = close

    return () => {
      close()
      closeStreamRef.current = null
    }
  }, [authed, loadMessages, appendMessage])

  if (authed === null) return null

  if (!authed) {
    return <AuthScreen onAuth={() => setAuthed(true)} />
  }

  return (
    <div className="flex h-screen bg-zinc-50">
      <div className="w-1/2 flex flex-col border-r border-zinc-200 overflow-hidden">
        <Header onLogout={() => { clearToken(); closeStreamRef.current?.(); setAuthed(false) }} />
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
      <div className="w-1/2 flex flex-col overflow-hidden">
        <IntegrationsPanel />
      </div>
    </div>
  )
}
