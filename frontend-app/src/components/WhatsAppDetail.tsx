"use client"

import { useState } from "react"
import { Send } from "lucide-react"
import { cn, getAvatarColors } from "@/lib/utils"
import { sendWhatsApp } from "@/lib/api"
import type { WhatsAppMessage } from "@/lib/mock-data"

interface Props {
  message: WhatsAppMessage
  onRefresh: () => void
}

export function WhatsAppDetail({ message, onRefresh }: Props) {
  const { bg, text } = getAvatarColors(message.initials)
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)

  async function handleSend() {
    if (!input.trim() || !message.phone) return
    setSending(true)
    try {
      await sendWhatsApp(message.phone.replace(/\D/g, ""), input)
      setInput("")
      onRefresh()
    } catch {
      // keep input so user can retry
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-3">
        <div className="relative shrink-0">
          <div className={cn("h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold", bg, text)}>
            {message.initials}
          </div>
          <span className="absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white" />
        </div>
        <div>
          <p className="font-semibold text-sm text-zinc-900 leading-none">{message.sender}</p>
          <p className="text-xs text-emerald-600 mt-1 font-medium">Online</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 bg-zinc-50/40">
        {message.conversation.map((msg) => (
          <div key={msg.id} className={cn("flex", msg.sent ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[72%] rounded-2xl px-3.5 py-2 text-sm shadow-sm",
                msg.sent
                  ? "bg-emerald-600 text-white rounded-br-sm"
                  : "bg-white border border-zinc-200 text-zinc-800 rounded-bl-sm"
              )}
            >
              <p className="leading-relaxed">{msg.text}</p>
              <p className={cn("text-[10px] mt-1 text-right", msg.sent ? "text-emerald-100/80" : "text-zinc-400")}>
                {msg.time}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-zinc-100 px-4 py-3 bg-white">
        <div className="flex items-center gap-2 border border-zinc-200 rounded-xl px-3 py-2 bg-zinc-50 focus-within:bg-white focus-within:border-zinc-300 transition-all">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Message…"
            className="flex-1 bg-transparent text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="h-6 w-6 rounded-full bg-emerald-600 flex items-center justify-center hover:bg-emerald-700 transition-colors shrink-0 disabled:opacity-40"
          >
            <Send className="h-3 w-3 text-white" />
          </button>
        </div>
      </div>
    </div>
  )
}
