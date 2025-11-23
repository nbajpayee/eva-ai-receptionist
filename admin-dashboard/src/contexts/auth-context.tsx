'use client'

/**
 * Authentication Context Provider
 * Manages user authentication state and provides auth methods
 */

import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { UserRole } from '@/types/database'
import { logError, createLogger } from '@/lib/logger'

const logger = createLogger({ module: 'AuthContext' })

interface Profile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
}

interface AuthContextType {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
  hasRole: (roles: UserRole | UserRole[]) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  // Fetch user profile from database
  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      logError(error, { context: 'fetchProfile', userId })
      return null
    }

    return data as Profile
  }

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        const finalUser = session?.user ?? null

        setSession(session ?? null)
        setUser(finalUser)

        if (finalUser) {
          // Fetch profile in background so we don't block loading state
          fetchProfile(finalUser.id)
            .then((userProfile) => {
              setProfile(userProfile)
            })
            .catch((error) => {
              logError(error, { context: 'initAuth', userId: finalUser.id })
            })
        } else {
          setProfile(null)
        }
      } catch (error) {
        logError(error, { context: 'initAuth' })
      } finally {
        setLoading(false)
      }
    }

    initAuth()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)

      if (session?.user) {
        // Fetch profile in background, independent of loading state
        fetchProfile(session.user.id)
          .then((userProfile) => {
            setProfile(userProfile)
          })
          .catch((error) => {
            logError(error, { context: 'onAuthStateChange', userId: session.user.id })
          })
      } else {
        setProfile(null)
      }

      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setSession(null)
  }

  const hasRole = (roles: UserRole | UserRole[]) => {
    if (!profile) return false

    const roleArray = Array.isArray(roles) ? roles : [roles]
    return roleArray.includes(profile.role)
  }

  const value = {
    user,
    profile,
    session,
    loading,
    signIn,
    signOut,
    hasRole,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
