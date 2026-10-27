import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

function isBrandasticEmail(email) {
  return String(email || '').toLowerCase().endsWith('@brandastic.com')
}

async function rejectNonBrandastic(user) {
  if (user && !isBrandasticEmail(user.email)) {
    await supabase.auth.signOut({ scope: 'global' })
    return true
  }
  return false
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // View mode toggle (admin can switch between admin and team view)
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('viewMode') || 'default'
  })

  // Client preview mode (for admins to preview client portal)
  const [clientPreviewMode, setClientPreviewMode] = useState(false)
  const [previewClientId, setPreviewClientId] = useState(null)

  // Fetch profile helper with timeout
  const fetchProfile = async (userId) => {
    console.log('[Auth] fetchProfile called for:', userId)
    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile fetch timeout')), 10000)
      )
      
      const fetchPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      
      const { data, error } = await Promise.race([fetchPromise, timeoutPromise])
      
      console.log('[Auth] fetchProfile result:', data ? 'found' : 'not found', error?.message || '')

      if (error) {
        console.error('[Auth] Profile fetch error:', error)
        return null
      }
      
      if (data) {
        setProfile(data)
        return data
      }
      
      console.log('[Auth] No profile found for user:', userId)
      return null
    } catch (err) {
      console.error('[Auth] Error fetching profile:', err)
      // Fail open on timeout/network so nav does not bounce the existing session.
      return null
    }
  }

  // Create profile if it doesn't exist (for new OAuth users)
  const createProfileIfNeeded = async (user) => {
    if (!user) return null
    
    console.log('[Auth] createProfileIfNeeded for:', user.email)

    try {
      // Check if profile exists with timeout
      const checkTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile check timeout')), 8000)
      )
      
      const checkPromise = supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()
      
      let existing = null
      let checkError = null
      try {
        ;({ data: existing, error: checkError } = await Promise.race([checkPromise, checkTimeout]))
      } catch (timeoutErr) {
        console.warn('[Auth] Profile check timed out - keeping current session', timeoutErr?.message || timeoutErr)
        return null
      }
      
      if (checkError) {
        console.error('[Auth] Error checking profile:', checkError)
        return null
      }

      if (existing) {
        console.log('[Auth] Profile exists, fetching full profile')
        return fetchProfile(user.id)
      }

      console.log('[Auth] Creating new profile for:', user.email)
      
      // Create new profile
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || 
                     user.user_metadata?.name || 
                     user.email?.split('@')[0] || 'User',
          role: 'team',
          avatar_url: user.user_metadata?.avatar_url || 
                      user.user_metadata?.picture || null,
        }, { onConflict: 'id' })

      if (error) {
        console.error('[Auth] Error creating profile:', error)
      } else {
        console.log('[Auth] Profile created successfully')
      }

      return fetchProfile(user.id)
    } catch (err) {
      console.error('[Auth] createProfileIfNeeded error:', err)
      return null
    }
  }

  // Initialize auth - with timeout protection
  useEffect(() => {
    let mounted = true
    let timeoutId = null

    const initAuth = async () => {
      try {
        // Set a longer timeout - 15 seconds to handle slow connections
        timeoutId = setTimeout(() => {
          if (mounted && loading) {
            console.warn('[Auth] Timeout after 15s - setting loading to false')
            // DON'T clear localStorage - just stop loading
            // The session might still be valid, just slow to load
            setLoading(false)
          }
        }, 15000)

        // Check localStorage first to see if we have stored auth
        const storedAuth = localStorage.getItem('brandastic-auth')
        console.log('[Auth] Initializing, stored auth exists:', !!storedAuth)
        
        // Try getSession first
        const { data: { session }, error } = await supabase.auth.getSession()
        console.log('[Auth] getSession result:', session ? session.user?.email : 'null', error ? error.message : 'no error')

        if (!mounted) return

        if (error) {
          console.error('[Auth] Session error:', error)
          // Only clear if it's a genuine auth error, not a network error
          if (error.message?.includes('invalid') || error.message?.includes('expired')) {
            await supabase.auth.signOut({ scope: 'local' })
          }
          setUser(null)
          setProfile(null)
        } else if (session?.user) {
          console.log('[Auth] Session found for:', session.user.email)
          if (await rejectNonBrandastic(session.user)) {
            setUser(null)
            setProfile(null)
          } else {
            setUser(session.user)
            await createProfileIfNeeded(session.user)
          }
        } else if (storedAuth) {
          // We have stored auth but getSession returned null - try to recover
          console.log('[Auth] No session but localStorage has auth - attempting recovery...')
          try {
            // Parse stored auth to check if it looks valid
            const parsed = JSON.parse(storedAuth)
            if (parsed?.access_token) {
              // Try to set the session manually
              const { data: recoveredSession, error: setError } = await supabase.auth.setSession({
                access_token: parsed.access_token,
                refresh_token: parsed.refresh_token
              })
              if (recoveredSession?.user && !setError) {
                console.log('[Auth] Session recovered for:', recoveredSession.user.email)
                setUser(recoveredSession.user)
                await createProfileIfNeeded(recoveredSession.user)
              } else {
                console.log('[Auth] Recovery failed:', setError?.message)
                setUser(null)
                setProfile(null)
              }
            }
          } catch (parseError) {
            console.log('[Auth] Could not parse stored auth:', parseError)
            setUser(null)
            setProfile(null)
          }
        } else {
          console.log('[Auth] No session found and no stored auth')
          setUser(null)
          setProfile(null)
        }
      } catch (error) {
        console.error('[Auth] Init error:', error)
        // Don't clear auth on network errors - user might still have valid session
        if (error.message?.includes('network') || error.message?.includes('fetch')) {
          console.warn('[Auth] Network error - keeping existing state')
        } else {
          setUser(null)
          setProfile(null)
        }
      } finally {
        if (timeoutId) clearTimeout(timeoutId)
        if (mounted) setLoading(false)
      }
    }

    initAuth()

    // Listen for auth changes - this is the single source of truth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[Auth] Event:', event, session?.user?.email || 'no session')

        if (!mounted) return

        // Handle different auth events
        if (event === 'TOKEN_REFRESHED') {
          console.log('[Auth] Token refreshed for:', session?.user?.email)
          if (session?.user) {
            if (await rejectNonBrandastic(session.user)) {
              setUser(null)
              setProfile(null)
            } else {
              setUser(session.user)
            }
          }
          return
        }

        if (event === 'SIGNED_OUT') {
          console.log('[Auth] User signed out')
          setUser(null)
          setProfile(null)
          setLoading(false)
          return
        }

        if (session?.user) {
          if (await rejectNonBrandastic(session.user)) {
            setUser(null)
            setProfile(null)
            setLoading(false)
            return
          }
          setUser(session.user)
          if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
            console.log('[Auth] Creating/fetching profile for:', session.user.email)
            await createProfileIfNeeded(session.user)
          } else {
            await fetchProfile(session.user.id)
          }
        } else if (event !== 'TOKEN_REFRESHED') {
          // No session and not just a token refresh - clear user state
          console.log('[Auth] No session, clearing state')
          setUser(null)
          setProfile(null)
        }

        setLoading(false)
      }
    )

    return () => {
      mounted = false
      if (timeoutId) clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [])

  // Sign in with Google (primary auth method for team)
  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/profitability`,
        queryParams: {
          hd: 'brandastic.com',
          prompt: 'select_account',
        },
      },
    })
    return { data, error }
  }

  // Sign out
  const signOut = async () => {
    try {
      setUser(null)
      setProfile(null)
      localStorage.removeItem('viewMode')
      
      const { error } = await supabase.auth.signOut({ scope: 'global' })
      return { error }
    } catch (err) {
      console.error('Sign out error:', err)
      return { error: err }
    }
  }

  // Update profile
  const updateUserProfile = async (updates) => {
    if (!user) return { error: new Error('Not authenticated') }

    try {
      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, v]) => v !== undefined)
      )

      if (Object.keys(cleanUpdates).length === 0) {
        return { data: profile, error: null }
      }

      const { data, error } = await supabase
        .from('profiles')
        .update({ ...cleanUpdates, updated_at: new Date().toISOString() })
        .eq('id', user.id)
        .select()

      if (data && data.length > 0) {
        setProfile(data[0])
        return { data: data[0], error: null }
      }

      return { data: null, error }
    } catch (err) {
      console.error('Profile update error:', err)
      return { data: null, error: err }
    }
  }

  // Upload avatar
  const uploadAvatar = async (file) => {
    if (!user) return { error: new Error('Not authenticated') }

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}-${Date.now()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file, { cacheControl: '3600', upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(filePath)

      const { data, error } = await updateUserProfile({ avatar_url: publicUrl })
      return { data, error, url: publicUrl }
    } catch (error) {
      console.error('Avatar upload error:', error)
      return { error }
    }
  }

  // Refresh profile
  const refreshProfile = async () => {
    if (!user) return
    await fetchProfile(user.id)
  }

  // Toggle view mode (for admins to see team view)
  const toggleViewMode = useCallback(() => {
    setViewMode(prev => {
      const newMode = prev === 'team' ? 'default' : 'team'
      localStorage.setItem('viewMode', newMode)
      return newMode
    })
  }, [])

  // Client preview mode functions
  const startClientPreview = useCallback((clientId) => {
    setClientPreviewMode(true)
    setPreviewClientId(clientId || null)
  }, [])

  const toggleClientPreview = useCallback((clientId = null) => {
    setClientPreviewMode(prev => !prev)
    setPreviewClientId(clientId)
  }, [])

  const exitClientPreview = useCallback(() => {
    setClientPreviewMode(false)
    setPreviewClientId(null)
  }, [])

  // Admin emails whitelist
  const ADMIN_EMAILS = [
    'justin@brandastic.com',
    'admin@brandastic.com',
  ]

  // Role calculations
  const actualRole = profile?.role
  const userEmail = user?.email?.toLowerCase() || profile?.email?.toLowerCase()
  const isEmailAdmin = ADMIN_EMAILS.includes(userEmail)
  const isActualAdmin = actualRole === 'admin' || isEmailAdmin

  // Auto-set admin role if email is in whitelist
  useEffect(() => {
    const autoSetAdmin = async () => {
      if (user && profile && isEmailAdmin && actualRole !== 'admin') {
        console.log('Auto-setting admin role for:', userEmail)
        await supabase
          .from('profiles')
          .update({ role: 'admin' })
          .eq('id', user.id)
        await fetchProfile(user.id)
      }
    }
    autoSetAdmin()
  }, [user, profile, isEmailAdmin, actualRole, userEmail])

  // Effective role (considering view mode toggle)
  const effectiveIsAdmin = isActualAdmin && viewMode !== 'team'

  const value = {
    user,
    profile,
    loading,
    signInWithGoogle,
    signOut,
    updateUserProfile,
    uploadAvatar,
    refreshProfile,
    // Role helpers
    isTeam: actualRole === 'team' || actualRole === 'admin',
    isAdmin: effectiveIsAdmin,
    isActualAdmin,
    isClient: actualRole === 'client',
    // View mode
    viewMode,
    toggleViewMode,
    // Client preview
    clientPreviewMode,
    previewClientId,
    startClientPreview,
    toggleClientPreview,
    exitClientPreview,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
