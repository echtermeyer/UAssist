const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

// ── Token storage ────────────────────────────────────────────────────────────

export function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("ua_token")
}

export function setToken(token: string) {
  localStorage.setItem("ua_token", token)
}

export function clearToken() {
  localStorage.removeItem("ua_token")
}

// ── Raw backend types ────────────────────────────────────────────────────────

export type RawMessage = {
  _id: string
  _service: "whatsapp" | "email" | "signal"
  _savedAt: string
  tenantId: string
  // email fields
  envelope?: { from?: { address?: string; name?: string }[]; subject?: string }
  bodyText?: string
  bodyHtml?: string
  _account?: string
  // whatsapp fields
  body?: string
  _chat?: string
  from?: { _serialized?: string; user?: string }
  // signal fields
  message?: string
  fromName?: string
  timestamp?: number
}

// ── Fetch helper ─────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (res.status === 401) {
    clearToken()
    throw new Error("UNAUTHORIZED")
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return res.json()
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function login(username: string, password: string): Promise<{ token: string; tenantId: string; role: string }> {
  const data = await apiFetch<{ token: string; tenantId: string; role: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  })
  setToken(data.token)
  return data
}

// ── Messages ─────────────────────────────────────────────────────────────────

export async function fetchMessages(service?: "whatsapp" | "email" | "signal"): Promise<RawMessage[]> {
  const path = service ? `/messages/${service}` : "/messages"
  return apiFetch<RawMessage[]>(path)
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
