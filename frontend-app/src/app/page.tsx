"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { getMe } from "@/lib/api"

export default function Page() {
  const router = useRouter()
  useEffect(() => {
    getMe().then(me => {
      router.replace(me ? "/home" : "/onboarding")
    })
  }, [router])
  return null
}
