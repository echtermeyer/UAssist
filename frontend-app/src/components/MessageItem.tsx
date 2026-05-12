import { Mail, MessageCircle } from "lucide-react"
import { cn, formatRelativeTime, getAvatarColors } from "@/lib/utils"
import type { Message } from "@/lib/mock-data"

interface Props {
  message: Message
  selected: boolean
  onSelect: () => void
}

export function MessageItem({ message, selected, onSelect }: Props) {
  const { bg, text } = getAvatarColors(message.initials)

  return (
    <button
      onClick={onSelect}
      className={cn(
        "relative w-full text-left px-4 py-3 flex items-start gap-3 border-b border-zinc-100 last:border-0 transition-colors cursor-pointer",
        selected ? "bg-white" : "hover:bg-zinc-100/70"
      )}
    >
      {selected && (
        <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-emerald-500" />
      )}

      <div
        className={cn(
          "h-8 w-8 rounded-full shrink-0 mt-0.5 flex items-center justify-center text-xs font-bold",
          bg,
          text
        )}
      >
        {message.initials}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "text-sm truncate",
              message.read ? "font-medium text-zinc-700" : "font-semibold text-zinc-900"
            )}
          >
            {message.sender}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {message.type === "email" ? (
              <Mail className="h-3 w-3 text-zinc-400" />
            ) : (
              <MessageCircle className="h-3 w-3 text-emerald-500" />
            )}
            <span className="text-[11px] text-zinc-400 tabular-nums">
              {formatRelativeTime(message.timestamp)}
            </span>
          </div>
        </div>
        <p className="text-xs text-zinc-500 truncate mt-0.5">{message.preview}</p>
      </div>

      {!message.read && (
        <span className="mt-2 shrink-0 h-1.5 w-1.5 rounded-full bg-emerald-500" />
      )}
    </button>
  )
}
