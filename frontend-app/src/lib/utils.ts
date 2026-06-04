export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ")
}

export function formatAbsoluteTime(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((today.getTime() - msgDay.getTime()) / 86400000)
  const timeStr = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  if (diffDays === 0) return timeStr
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return date.toLocaleDateString("en-GB", { weekday: "short" })
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" })
}
