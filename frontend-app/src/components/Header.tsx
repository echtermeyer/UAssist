"use client"

import { MessageSquare, LogOut } from "lucide-react"

interface Props {
  onLogout?: () => void
}

export function Header({ onLogout }: Props) {
  return (
    <header className="h-14 bg-white border-b border-zinc-100 flex items-center px-5 shrink-0 justify-between">
      <div className="flex items-center gap-2.5">
        <div className="h-7 w-7 rounded-lg bg-emerald-600 flex items-center justify-center shadow-sm">
          <MessageSquare className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="font-bold text-[15px] text-zinc-900 tracking-tight">UAssist</span>
      </div>
      {onLogout && (
        <button
          onClick={onLogout}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      )}
    </header>
  )
}
