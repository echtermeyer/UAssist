import type { RawMessage } from "./api"

export type EmailMessage = {
  id: string
  type: "email"
  sender: string
  initials: string
  address: string
  subject: string
  timestamp: string
  read: boolean
  preview: string
  body: string
}

export type WhatsAppMessage = {
  id: string
  type: "whatsapp"
  sender: string
  initials: string
  phone: string
  timestamp: string
  read: boolean
  preview: string
  conversation: Array<{
    id: string
    text: string
    sent: boolean
    time: string
  }>
}

export type SignalMessage = {
  id: string
  type: "signal"
  sender: string
  initials: string
  phone: string
  timestamp: string
  read: boolean
  preview: string
  body: string
}

export type Message = EmailMessage | WhatsAppMessage | SignalMessage

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export function normalizeMessage(raw: RawMessage): Message {
  const service = raw._service
  const id = raw._id
  const savedAt = raw._savedAt ?? new Date().toISOString()

  if (service === "email") {
    const from = raw.envelope?.from?.[0]
    const sender = from?.name || from?.address || raw._account || "Unknown"
    const address = from?.address || raw._account || ""
    const subject = raw.envelope?.subject || "(no subject)"
    const body = raw.bodyText || raw.bodyHtml?.replace(/<[^>]+>/g, " ").trim() || ""
    const preview = body.slice(0, 120)
    return {
      id,
      type: "email",
      sender,
      initials: initials(sender),
      address,
      subject,
      timestamp: savedAt,
      read: false,
      preview,
      body,
    }
  }

  if (service === "whatsapp") {
    const chat = raw._chat || "Unknown"
    const text = raw.body || ""
    return {
      id,
      type: "whatsapp",
      sender: chat,
      initials: initials(chat),
      phone: "",
      timestamp: savedAt,
      read: false,
      preview: text.slice(0, 120),
      conversation: [
        {
          id: `${id}_0`,
          text,
          sent: false,
          time: new Date(savedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        },
      ],
    }
  }

  // signal
  const sender = raw.fromName || raw.from || "Unknown"
  const body = raw.message || ""
  return {
    id,
    type: "signal",
    sender: typeof sender === "string" ? sender : String(sender),
    initials: initials(typeof sender === "string" ? sender : String(sender)),
    phone: typeof raw.from === "string" ? raw.from : "",
    timestamp: raw.timestamp ? new Date(raw.timestamp).toISOString() : savedAt,
    read: false,
    preview: body.slice(0, 120),
    body,
  }
}
