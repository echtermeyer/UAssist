const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

// ── Raw backend types ────────────────────────────────────────────────────────

export type RawMessage = {
  _id: string
  _service: "whatsapp" | "email" | "signal" | "slack"
  _savedAt: string
  tenantId: string
  envelope?: { from?: { address?: string; name?: string }[]; subject?: string }
  bodyText?: string
  bodyHtml?: string
  _account?: string
  body?: string
  _chat?: string
  from?: string
  message?: string
  fromName?: string
  timestamp?: number
}

// ── Fetch helper ─────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const message = (body as { error?: string }).error || `HTTP ${res.status}`
    if (res.status === 401 && message !== "Invalid credentials" && message !== "Username already taken") {
      throw new Error("UNAUTHORIZED")
    }
    throw new Error(message)
  }
  return res.json()
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function login(username: string, password: string) {
  return apiFetch<{ tenantId: string; role: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  })
}

export async function signup(username: string, password: string) {
  return apiFetch<{ tenantId: string; role: string }>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  })
}

export async function logout() {
  return apiFetch("/auth/logout", { method: "POST" })
}

export async function getMe(): Promise<{ userId: string; username: string; tenantId: string; role: string } | null> {
  try {
    return await apiFetch("/auth/me")
  } catch {
    return null
  }
}

// ── Messages ─────────────────────────────────────────────────────────────────

export async function fetchMessages(service?: "whatsapp" | "email" | "signal" | "slack"): Promise<RawMessage[]> {
  const path = service ? `/messages/${service}` : "/messages"
  return apiFetch<RawMessage[]>(path)
}

// ── SSE stream ────────────────────────────────────────────────────────────────

export function openStream(onMessage: (raw: RawMessage) => void, onError?: () => void): () => void {
  const url = `${BASE}/stream`
  let closed = false
  const controller = new AbortController()

  fetch(url, {
    credentials: "include",
    signal: controller.signal,
  }).then(async res => {
    if (!res.ok || !res.body) { onError?.(); return }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ""
    while (!closed) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const parts = buf.split("\n\n")
      buf = parts.pop() ?? ""
      for (const part of parts) {
        const dataLine = part.split("\n").find(l => l.startsWith("data:"))
        if (!dataLine) continue
        try {
          const raw = JSON.parse(dataLine.slice(5).trim()) as RawMessage
          onMessage(raw)
        } catch {}
      }
    }
  }).catch(() => { if (!closed) onError?.() })

  return () => {
    closed = true
    controller.abort()
  }
}

// ── Send ─────────────────────────────────────────────────────────────────────

export async function sendEmail(to: string, subject: string, message: string) {
  return apiFetch("/send/email", { method: "POST", body: JSON.stringify({ to, subject, message }) })
}

export async function sendWhatsApp(to: string, message: string) {
  return apiFetch("/send/whatsapp", { method: "POST", body: JSON.stringify({ to, message }) })
}

export async function sendSignal(to: string, message: string) {
  return apiFetch("/send/signal", { method: "POST", body: JSON.stringify({ to, message }) })
}

export async function sendSlack(to: string, message: string) {
  return apiFetch("/send/slack", { method: "POST", body: JSON.stringify({ to, message }) })
}

// ── Onboarding ────────────────────────────────────────────────────────────────

export async function startWhatsAppOnboard() {
  return apiFetch("/onboard/whatsapp", { method: "POST", body: JSON.stringify({}) })
}

export async function pollWhatsAppStatus(): Promise<{ status: string; qr: string | null }> {
  return apiFetch("/onboard/whatsapp/status")
}

export async function startSignalOnboard() {
  return apiFetch("/onboard/signal", { method: "POST", body: JSON.stringify({}) })
}

export async function pollSignalStatus(): Promise<{ status: string; linkUri: string | null }> {
  return apiFetch("/onboard/signal/status")
}

export async function connectEmail(email: string, password: string) {
  return apiFetch("/onboard/email", { method: "POST", body: JSON.stringify({ email, password }) })
}

export async function connectSlack(botToken: string, appToken: string) {
  return apiFetch("/onboard/slack", { method: "POST", body: JSON.stringify({ botToken, appToken }) })
}
