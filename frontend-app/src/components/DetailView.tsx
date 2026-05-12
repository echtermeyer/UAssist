import { Inbox } from "lucide-react"
import { EmailDetail } from "./EmailDetail"
import { WhatsAppDetail } from "./WhatsAppDetail"
import { SignalDetail } from "./SignalDetail"
import type { Message } from "@/lib/mock-data"

interface Props {
  message: Message | null
  onRefresh: () => void
}

export function DetailView({ message, onRefresh }: Props) {
  if (!message) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-zinc-100 flex items-center justify-center">
          <Inbox className="h-5 w-5 text-zinc-400" />
        </div>
        <p className="text-sm font-medium text-zinc-400">Select a message</p>
      </div>
    )
  }

  if (message.type === "email") return <EmailDetail message={message} onRefresh={onRefresh} />
  if (message.type === "signal") return <SignalDetail message={message} />
  return <WhatsAppDetail message={message} onRefresh={onRefresh} />
}
