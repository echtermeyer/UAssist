"use client"

import { useState } from "react"
import { messages, type Message } from "@/lib/mock-data"
import { Header } from "@/components/Header"
import { MessageList } from "@/components/MessageList"
import { DetailView } from "@/components/DetailView"
import { IntegrationsPanel } from "@/components/IntegrationsPanel"

export default function Page() {
  const [selected, setSelected] = useState<Message | null>(null)

  return (
    <div className="flex h-screen bg-zinc-50">
      {/* Left 50% — messaging */}
      <div className="w-1/2 flex flex-col border-r border-zinc-200 overflow-hidden">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <div className="w-[42%] flex flex-col border-r border-zinc-100 overflow-hidden bg-zinc-50">
            <MessageList messages={messages} selectedId={selected?.id ?? null} onSelect={setSelected} />
          </div>
          <div className="flex-1 flex flex-col overflow-hidden bg-white">
            <DetailView message={selected} />
          </div>
        </div>
      </div>

      {/* Right 50% — integrations */}
      <div className="w-1/2 flex flex-col overflow-hidden">
        <IntegrationsPanel />
      </div>
    </div>
  )
}
