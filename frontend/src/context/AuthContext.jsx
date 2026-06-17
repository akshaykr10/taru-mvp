import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = loading
  const [user, setUser]       = useState(null)

  useEffect(() => {
    // Flag: onAuthStateChange has fired at least once (INITIAL_SESSION or SIGNED_IN).
    // Prevents getSession().then() from overwriting a session that onAuthStateChange
    // already set — the race condition that caused first-attempt login failures.
    let authStateReceived = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      authStateReceived = true
      setSession(session ?? null)
      setUser(session?.user ?? null)
    })

    // getSession() handles page-reload / email-confirmation redirect cases where
    // onAuthStateChange may not fire before the first render. Only apply if
    // onAuthStateChange hasn't already given us a definitive answer.
    supabase.auth.getSession().then(({ data }) => {
      if (!authStateReceived) {
        setSession(data.session ?? null)
        setUser(data.session?.user ?? null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{ session, user, signOut, loading: session === undefined }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
