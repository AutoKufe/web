'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { apiClient } from '@/lib/api/client'

interface User {
  id: string
  email: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        setUser({
          id: session.user.id,
          email: session.user.email || '',
        })
        apiClient.setAccessToken(session.access_token)
      }
      setLoading(false)
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          setUser(null)
          apiClient.setAccessToken(null)
        } else if (session) {
          setUser({
            id: session.user.id,
            email: session.user.email || '',
          })
          apiClient.setAccessToken(session.access_token)
        }

        // Recovery links (implicit flow, #access_token=...&type=recovery) can
        // land on any page — the fragment survives client-side redirects.
        // The SDK auto-detects it and fires this event regardless of route,
        // so catching it here (app-wide) is the only reliable place to send
        // the user to the actual "set new password" screen.
        if (event === 'PASSWORD_RECOVERY') {
          router.replace('/update-password')
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [router, supabase.auth])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
