import { Send, Reply } from "lucide-react"
import { cn, getAvatarColors } from "@/lib/utils"
import type { EmailMessage } from "@/lib/mock-data"

interface Props {
  message: EmailMessage
}

export function EmailDetail({ message }: Props) {
  const { bg, text } = getAvatarColors(message.initials)

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-5 pb-4 border-b border-zinc-100">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "h-9 w-9 rounded-full shrink-0 flex items-center justify-center text-xs font-bold",
              bg,
              text
            )}
          >
            {message.initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-semibold text-sm text-zinc-900">{message.sender}</p>
              <span className="text-xs text-zinc-400 shrink-0 tabular-nums">
                {new Date(message.timestamp).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">{message.address}</p>
          </div>
        </div>
        <h1 className="text-lg font-bold text-zinc-900 mt-4 leading-snug">{message.subject}</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <p className="text-sm leading-[1.85] text-zinc-700 whitespace-pre-line">{message.body}</p>
      </div>

      <div className="border-t border-zinc-100 px-4 py-3">
        <div className="flex items-center gap-2 border border-zinc-200 rounded-xl px-3 py-2 bg-zinc-50 focus-within:bg-white focus-within:border-zinc-300 transition-all">
          <Reply className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
          <input
            placeholder="Reply…"
            className="flex-1 bg-transparent text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none"
          />
          <button className="h-6 w-6 rounded-md bg-emerald-600 flex items-center justify-center hover:bg-emerald-700 transition-colors shrink-0">
            <Send className="h-3 w-3 text-white" />
          </button>
        </div>
      </div>
    </div>
  )
}
