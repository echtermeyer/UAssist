import { MessageSquare } from "lucide-react"

export function Header() {
  return (
    <header className="h-14 bg-white border-b border-zinc-100 flex items-center px-5 shrink-0">
      <div className="flex items-center gap-2.5">
        <div className="h-7 w-7 rounded-lg bg-emerald-600 flex items-center justify-center shadow-sm">
          <MessageSquare className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="font-bold text-[15px] text-zinc-900 tracking-tight">UAssist</span>
      </div>
    </header>
  )
}
