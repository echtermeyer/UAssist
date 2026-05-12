import { MessageItem } from "./MessageItem"
import type { Message } from "@/lib/mock-data"

interface Props {
  messages: Message[]
  selectedId: string | null
  onSelect: (message: Message) => void
}

export function MessageList({ messages, selectedId, onSelect }: Props) {
  const unreadCount = messages.filter((m) => !m.read).length

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
          Inbox
        </span>
        {unreadCount > 0 && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            {unreadCount} new
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {messages.map((message) => (
          <MessageItem
            key={message.id}
            message={message}
            selected={message.id === selectedId}
            onSelect={() => onSelect(message)}
          />
        ))}
      </div>
    </div>
  )
}
