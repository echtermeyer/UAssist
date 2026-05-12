import { ShieldCheck } from "lucide-react"
import { cn, getAvatarColors } from "@/lib/utils"
import type { SignalMessage } from "@/lib/mock-data"

interface Props {
  message: SignalMessage
}

export function SignalDetail({ message }: Props) {
  const { bg, text } = getAvatarColors(message.initials)

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-3">
        <div className="relative shrink-0">
          <div className={cn("h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold", bg, text)}>
            {message.initials}
          </div>
          <span className="absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full bg-indigo-500 border-2 border-white flex items-center justify-center">
            <ShieldCheck className="h-1.5 w-1.5 text-white" />
          </span>
        </div>
        <div>
          <p className="font-semibold text-sm text-zinc-900 leading-none">{message.sender}</p>
          {message.phone && <p className="text-xs text-zinc-400 mt-1">{message.phone}</p>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 bg-zinc-50/40">
        <div className="flex justify-start">
          <div className="max-w-[72%] rounded-2xl px-3.5 py-2 text-sm shadow-sm bg-white border border-zinc-200 text-zinc-800 rounded-bl-sm">
            <p className="leading-relaxed">{message.body}</p>
            <p className="text-[10px] mt-1 text-right text-zinc-400">
              {new Date(message.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
