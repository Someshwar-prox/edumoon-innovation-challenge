// /signin and /signup are gone — every sign-in goes through Google.
// Send anyone who lands here back to the home splash.
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SigninPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/')
  }, [router])
  return null
}
