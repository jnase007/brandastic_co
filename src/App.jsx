import { useState, useEffect, useCallback, lazy, Suspense, useTransition, useRef } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from './contexts/AuthContext'
import { GamificationProvider } from './contexts/GamificationContext'
import PageLoadingBar from './components/PageLoadingBar'

// Pages - Lazy loaded for better performance
const Login = lazy(() => import('./pages/Login'))
const Demo = lazy(() => import('./pages/Demo'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Boards = lazy(() => import('./pages/Boards'))
const TaskBoard = lazy(() => import('./pages/TaskBoard'))
const BoardDetail = lazy(() => import('./pages/BoardDetail'))
const TicketDetail = lazy(() => import('./pages/TicketDetail'))
const ClientPortal = lazy(() => import('./pages/ClientPortal'))
const Settings = lazy(() => import('./pages/Settings'))
const Admin = lazy(() => import('./pages/Admin'))
const TeamHub = lazy(() => import('./pages/TeamHub'))
const JiraImport = lazy(() => import('./pages/JiraImport'))
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'))
const TimeTracking = lazy(() => import('./pages/TimeTracking'))
const Reports = lazy(() => import('./pages/Reports'))
const Calendar = lazy(() => import('./pages/Calendar'))
const ClientManagement = lazy(() => import('./pages/ClientManagement'))
const SalesPipeline = lazy(() => import('./pages/SalesPipeline'))
const ClientDetail = lazy(() => import('./pages/ClientDetail'))
const TeamMemberDetail = lazy(() => import('./pages/TeamMemberDetail'))
const NotFound = lazy(() => import('./pages/NotFound'))
const Diagnostics = lazy(() => import('./pages/Diagnostics'))
const ClientPublic = lazy(() => import('./pages/ClientPublic'))
const ClientLogin = lazy(() => import('./pages/ClientLogin'))
const ClientDashboard = lazy(() => import('./pages/ClientDashboard'))
const Mission = lazy(() => import('./pages/Mission'))
const Financials = lazy(() => import('./pages/Financials'))
const Profitability = lazy(() => import('./pages/Profitability'))
const ProfitabilityTeam = lazy(() => import('./pages/ProfitabilityTeam'))
const WorkingNotWorking = lazy(() => import('./pages/WorkingNotWorking'))
const AdminHub = lazy(() => import('./pages/AdminHub'))
const Ideas = lazy(() => import('./pages/Ideas'))
// Note: AuthCallback removed - using implicit flow with detectSessionInUrl
const EmailTemplates = lazy(() => import('./pages/EmailTemplates'))
const InternalDocs = lazy(() => import('./pages/InternalDocs'))

// Components
import Sidebar from './components/Sidebar'
import LoadingScreen from './components/LoadingScreen'
import CommandPalette from './components/CommandPalette'
import FloatingTimer from './components/FloatingTimer'
import ActivityFeed from './components/ActivityFeed'
import Confetti, { useConfetti } from './components/Confetti'
import EasterEggs from './components/EasterEggs'
// SessionStatus removed - Supabase handles session management
import { MobileTabBar, MobileHeader } from './components/MobileNav'
import InstallPrompt from './components/InstallPrompt'
import { Avatar, AvatarFallback, AvatarImage } from './components/ui/avatar'
import { Badge } from './components/ui/badge'
import { Loader2, RefreshCw, Sparkles } from 'lucide-react'

// Error Boundary to catch React render errors
import { Component } from 'react'

// Detect stale deployment errors (dynamic import failures)
const isStaleDeploymentError = (error) => {
  const message = error?.message || ''
  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Loading chunk') ||
    message.includes('Loading CSS chunk') ||
    message.includes('ChunkLoadError')
  )
}

// Auto-refresh on stale deployment (only once per session)
const handleStaleDeployment = () => {
  const lastRefresh = sessionStorage.getItem('stale-refresh-time')
  const now = Date.now()
  
  // Only auto-refresh if we haven't refreshed in the last 10 seconds
  if (!lastRefresh || (now - parseInt(lastRefresh)) > 10000) {
    console.log('[App] Stale deployment detected, auto-refreshing...')
    sessionStorage.setItem('stale-refresh-time', now.toString())
    window.location.reload()
    return true
  }
  return false
}

// Global handler for unhandled promise rejections (catches dynamic import failures)
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (isStaleDeploymentError(event.reason)) {
      event.preventDefault()
      handleStaleDeployment()
    }
  })
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, isStale: false }
  }

  static getDerivedStateFromError(error) {
    const isStale = isStaleDeploymentError(error)
    return { hasError: true, error, isStale }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo)
    
    // Auto-refresh for stale deployment errors
    if (isStaleDeploymentError(error)) {
      if (handleStaleDeployment()) return
    }
  }

  render() {
    if (this.state.hasError) {
      // Special UI for stale deployment
      if (this.state.isStale) {
        return (
          <div className="min-h-[50vh] flex items-center justify-center p-6">
            <div className="text-center">
              <h2 className="text-xl font-bold text-brand-orange mb-2">New Version Available</h2>
              <p className="text-muted-foreground mb-4">
                A new version has been deployed. Please refresh to get the latest updates.
              </p>
              <button 
                onClick={() => {
                  // Clear caches and reload
                  if ('caches' in window) {
                    caches.keys().then(names => names.forEach(name => caches.delete(name)))
                  }
                  window.location.reload()
                }}
                className="px-4 py-2 bg-brand-orange text-white rounded-lg hover:bg-brand-orange/90"
              >
                Refresh Now
              </button>
            </div>
          </div>
        )
      }
      
      return (
        <div className="min-h-[50vh] flex items-center justify-center p-6">
          <div className="text-center">
            <h2 className="text-xl font-bold text-red-500 mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4">{this.state.error?.message || 'An unexpected error occurred'}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-brand-orange text-white rounded-lg hover:bg-brand-orange/90"
            >
              Refresh Page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// Lightweight page loading spinner for route transitions with timeout handling
function PageLoader() {
  const [showRetry, setShowRetry] = useState(false)
  
  useEffect(() => {
    // Show retry option after 5 seconds of loading
    const timer = setTimeout(() => setShowRetry(true), 5000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <>
      {/* Top-of-page laser loading bar - always visible */}
      <PageLoadingBar isLoading={true} />
      
      {/* Center content loading indicator */}
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-center">
          {/* Inline loading bar with laser effect */}
          <div className="w-48 h-1.5 mx-auto mb-6 bg-slate-200/50 dark:bg-slate-700/50 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(59, 130, 246, 0.4) 20%, #3b82f6 50%, rgba(59, 130, 246, 0.4) 80%, transparent 100%)',
                boxShadow: '0 0 10px rgba(59, 130, 246, 0.5), 0 0 20px rgba(59, 130, 246, 0.3)',
              }}
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
          
        <Loader2 className="h-8 w-8 animate-spin text-brand-orange mx-auto mb-3" />
        <p className="text-sm text-muted-foreground mb-3">Loading...</p>
        {showRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
            className="text-xs"
          >
            Taking too long? Refresh
          </Button>
        )}
      </div>
    </div>
    </>
  )
}
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './components/ui/dropdown-menu'
import { User, LogOut, ChevronDown, X, Eye } from 'lucide-react'
import { Button } from './components/ui/button'
import { QuickActionsFAB } from './components/QuickActions'
import { readFullNav } from './lib/navMode'
import { ShortcutsPanel } from './components/ShortcutsPanel'
import { NotificationBell } from './components/NotificationCenter'
import { FocusModeProvider } from './components/FocusMode'

// Protected Route wrapper
function ProtectedRoute({ children, allowedRoles = ['team', 'admin', 'client'] }) {
  const { user, profile, loading } = useAuth()
  const [isProcessingOAuth, setIsProcessingOAuth] = useState(false)
  
  // Check if we're in the middle of an OAuth callback
  // Supabase adds auth tokens to the URL hash after OAuth redirect
  useEffect(() => {
    const hash = window.location.hash
    if (hash && (hash.includes('access_token') || hash.includes('refresh_token') || hash.includes('error'))) {
      console.log('[ProtectedRoute] OAuth callback detected, waiting for auth to process...')
      setIsProcessingOAuth(true)
      // Give Supabase time to process the tokens
      const timeout = setTimeout(() => {
        setIsProcessingOAuth(false)
        // Clean the hash from URL after processing
        if (window.location.hash) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search)
        }
      }, 3000)
      return () => clearTimeout(timeout)
    }
  }, [])
  
  // Also stop processing if user becomes available
  useEffect(() => {
    if (user && isProcessingOAuth) {
      setIsProcessingOAuth(false)
      // Clean the hash from URL
      if (window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
      }
    }
  }, [user, isProcessingOAuth])

  if (loading || isProcessingOAuth) {
    return <LoadingScreen />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (profile && !allowedRoles.includes(profile.role)) {
    // Redirect clients to their portal
    if (profile.role === 'client') {
      return <Navigate to="/portal" replace />
    }
    return <Navigate to="/profitability" replace />
  }

  return children
}

// Team-only route
function TeamRoute({ children }) {
  return (
    <ProtectedRoute allowedRoles={['team', 'admin']}>
      {children}
    </ProtectedRoute>
  )
}

// Client-only route
function ClientRoute({ children }) {
  return (
    <ProtectedRoute allowedRoles={['client']}>
      {children}
    </ProtectedRoute>
  )
}

// Admin-only route
function AdminRoute({ children }) {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      {children}
    </ProtectedRoute>
  )
}

// Client Preview Banner Component
function ClientPreviewBanner({ onExit }) {
  return (
    <motion.div
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -50, opacity: 0 }}
      className="fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-brand-orange via-brand-coral to-brand-orange text-white px-4 py-2.5 flex items-center justify-center gap-4 shadow-lg"
    >
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4" />
        <span className="font-medium text-sm">
          👀 You're previewing the <strong>Client Portal</strong>
        </span>
      </div>
      <Button
        size="sm"
        variant="secondary"
        onClick={onExit}
        className="h-7 px-3 bg-white/20 hover:bg-white/30 text-white border-0"
      >
        <X className="h-3.5 w-3.5 mr-1" />
        Exit Preview
      </Button>
    </motion.div>
  )
}

// Main Layout with Sidebar
function MainLayout({ children }) {
  const { user, profile, signOut, isActualAdmin, clientPreviewMode, exitClientPreview } = useAuth()
  const navigate = useNavigate()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [timerVisible, setTimerVisible] = useState(false)
  const [timerInitialClient, setTimerInitialClient] = useState(null)
  const [timerInitialDescription, setTimerInitialDescription] = useState('')
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [fullNav, setFullNavUi] = useState(() => readFullNav())

  useEffect(() => {
    const sync = () => setFullNavUi(readFullNav())
    window.addEventListener('brandastic-full-nav', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('brandastic-full-nav', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      
      // ? for shortcuts panel
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        setShortcutsOpen(true)
      }
      
      // T for timer
      if (e.key === 't' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        setTimerVisible(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Function to open timer with a pre-selected client (called from boards)
  const openTimerWithClient = useCallback((client, description = '') => {
    setTimerInitialClient(client)
    setTimerInitialDescription(description)
    setTimerVisible(true)
  }, [])

  // Expose timer function globally so boards can access it
  useEffect(() => {
    window.openTimerWithClient = openTimerWithClient
    return () => {
      delete window.openTimerWithClient
    }
  }, [openTimerWithClient])

  // Handle command actions
  const handleCommandAction = useCallback((actionId) => {
    switch (actionId) {
      case 'start-timer':
        setTimerVisible(true)
        break
      case 'stop-timer':
        setTimerVisible(true)
        break
      case 'logout':
        // Handle in context
        break
    }
  }, [])

  const handleSignOut = async () => {
    await signOut()
    // Use hard redirect to ensure all cached state is cleared
    window.location.href = '/login'
  }

  // Lazy load ClientPortal for preview mode
  const ClientPortalPreview = lazy(() => import('./pages/ClientPortal'))

  return (
    <div className="min-h-screen bg-background">
      {/* Client Preview Banner */}
      <AnimatePresence>
        {clientPreviewMode && (
          <ClientPreviewBanner onExit={exitClientPreview} />
        )}
      </AnimatePresence>

      {/* Desktop Sidebar - completely hidden when in client preview */}
      {!clientPreviewMode && (
        <div className="hidden lg:block">
          <Sidebar
            collapsed={sidebarCollapsed}
            onCollapse={setSidebarCollapsed}
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
            onOpenActivity={() => setActivityOpen(true)}
            onOpenTimer={() => setTimerVisible(true)}
          />
        </div>
      )}



      {/* Mobile Header - hidden in client preview */}
      {!clientPreviewMode && (
        <div className="lg:hidden">
          <MobileHeader onOpenSearch={() => setCommandPaletteOpen(true)} />
        </div>
      )}
      
      {/* Main content */}
      {clientPreviewMode ? (
        /* Client Portal Preview Mode - Full screen, no sidebar */
        <main className="min-h-screen pt-12">
          <Suspense fallback={<PageLoader />}>
            <ClientPortalPreview />
          </Suspense>
        </main>
      ) : (
        /* Normal Mode with sidebar */
        <main className="min-h-screen pt-14 pb-20 lg:pt-0 lg:pb-0">
          {/* Desktop layout with sidebar margin */}
          <motion.div
            initial={false}
            animate={{ marginLeft: sidebarCollapsed ? 72 : 240 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="hidden lg:block min-h-screen"
          >
            <div className="sticky top-0 z-40 h-14 px-4 sm:px-6 lg:px-8 flex items-center justify-end bg-background/95 backdrop-blur-md border-b">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border bg-background hover:bg-muted/50 transition-colors">
                    <Avatar className="h-8 w-8 border-2 border-brand-orange/30">
                      <AvatarImage src={profile?.avatar_url} />
                      <AvatarFallback className="bg-brand-orange text-white text-xs font-medium">
                        {profile?.full_name?.[0] || user?.email?.[0]?.toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span>{profile?.full_name || 'User'}</span>
                      <span className="text-xs font-normal text-muted-foreground">{user?.email}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/settings')}>
                    <User className="h-4 w-4 mr-2" />
                    My Profile
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-red-600 focus:text-red-600">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {children}
          </motion.div>
          {/* Mobile layout - no sidebar margin */}
          <div className="lg:hidden">
            {children}
          </div>
        </main>
      )}

      {/* These elements are hidden in client preview mode */}
      {!clientPreviewMode && (
        <>
          {/* Mobile Bottom Tab Bar */}
          <MobileTabBar
            onOpenTimer={() => setTimerVisible(true)}
            onOpenActivity={() => setActivityOpen(true)}
          />

          {/* Command Palette */}
          <CommandPalette
            open={commandPaletteOpen}
            onOpenChange={setCommandPaletteOpen}
            onAction={handleCommandAction}
          />

          {/* Activity Feed */}
          <ActivityFeed
            open={activityOpen}
            onClose={() => setActivityOpen(false)}
          />

          {/* Floating Timer - Toggl-style */}
          <FloatingTimer
            isVisible={isActualAdmin && fullNav && timerVisible}
            onClose={() => {
              setTimerVisible(false)
              setTimerInitialClient(null)
              setTimerInitialDescription('')
            }}
            initialClient={timerInitialClient}
            initialDescription={timerInitialDescription}
          />

          {/* Quick Actions FAB - Hidden when timer is visible to avoid overlap */}
          {isActualAdmin && fullNav && !timerVisible && (
            <QuickActionsFAB
              onStartTimer={() => setTimerVisible(true)}
              onNewTicket={() => navigate('/taskboard?new=true')}
              onOpenSearch={() => setCommandPaletteOpen(true)}
              onShowShortcuts={() => setShortcutsOpen(true)}
            />
          )}

          {/* Keyboard Shortcuts Panel */}
          <ShortcutsPanel
            isOpen={shortcutsOpen}
            onClose={() => setShortcutsOpen(false)}
          />
        </>
      )}
    </div>
  )
}

function App() {
  const { user, profile, loading } = useAuth()
  const location = useLocation()
  const { trigger: confettiTrigger, fire: fireConfetti } = useConfetti()
  const [isDark, setIsDark] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const prevPathRef = useRef(location.pathname)

  // Track navigation state for loading bar
  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      setIsNavigating(true)
      prevPathRef.current = location.pathname
      
      // Hide the loading bar after a short delay to allow content to render
      const timer = setTimeout(() => setIsNavigating(false), 800)
      return () => clearTimeout(timer)
    }
  }, [location.pathname])

  // Scroll to top on page navigation
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [location.pathname])

  // iOS Safari Keep-Alive Hack
  // Hidden iframe prevents iOS from fully suspending JavaScript context during tab switch
  // This is a known workaround for iOS Safari/Chrome background suspension
  useEffect(() => {
    const iframe = document.createElement('iframe')
    iframe.style.display = 'none'
    iframe.src = '/keep-alive.html'
    iframe.id = 'keep-alive-iframe'
    document.body.appendChild(iframe)

    return () => {
      const el = document.getElementById('keep-alive-iframe')
      if (el) document.body.removeChild(el)
    }
  }, [])

  // State for update notification
  const [updateAvailable, setUpdateAvailable] = useState(false)
  
  // Auto-recover from stale chunk caches after deploys + version checking
  useEffect(() => {
    const alreadyRetried = () => sessionStorage.getItem('chunk_reload_attempted') === 'true'
    const markRetried = () => sessionStorage.setItem('chunk_reload_attempted', 'true')
    const clearRetried = () => sessionStorage.removeItem('chunk_reload_attempted')

    // Clear retry flag once app loads successfully
    clearRetried()

    // Check for deployment updates by comparing versions
    const checkForUpdates = async () => {
      try {
        // Get current app version (injected at build time)
        const currentVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : null
        if (!currentVersion) return
        
        // Fetch server version with cache-busting
        const response = await fetch(`/version.json?t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        })
        
        if (!response.ok) return
        
        const serverVersion = await response.json()
        
        // If versions differ, a new deployment happened
        if (serverVersion.version && serverVersion.version !== currentVersion) {
          console.log(`[App] New version available: ${serverVersion.version} (current: ${currentVersion})`)
          setUpdateAvailable(true)
        }
      } catch (e) {
        // Ignore fetch errors (offline, etc.)
      }
    }
    
    // Check for updates periodically (every 2 minutes)
    const versionCheckInterval = setInterval(checkForUpdates, 2 * 60 * 1000)
    
    // Handle when tab/app becomes visible again - check for version updates
    // Note: Session handling is done in AuthContext, not here
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Handle iOS bfcache (back-forward cache) page restoration
    const handlePageShow = (event) => {
      // persisted = true means the page was restored from bfcache
      if (event.persisted) {
        console.log('[App] Page restored from bfcache')
        checkForUpdates()
      }
    }
    window.addEventListener('pageshow', handlePageShow)

    const isChunkLoadError = (message = '') =>
      message.includes('Failed to fetch dynamically imported module') ||
      message.includes('Loading chunk') ||
      message.includes('ChunkLoadError') ||
      message.includes('Importing a module script failed') ||
      message.includes('error loading dynamically imported module')

    const isDeploymentError = (message = '') =>
      message.includes('Unexpected token') ||
      message.includes('SyntaxError') ||
      message.includes('is not defined') ||
      (message.includes('404') && message.includes('.js'))

    const handleError = (event) => {
      const message = event?.reason?.message || event?.message || String(event?.reason || '')
      
      // Handle chunk load errors with auto-refresh
      if (isChunkLoadError(message)) {
        console.warn('[App] Chunk load error detected, refreshing...')
        if (!alreadyRetried()) {
          markRetried()
          window.location.reload()
        }
        return
      }
      
      // Handle other deployment-related errors (stale code)
      if (isDeploymentError(message)) {
        console.warn('[App] Possible stale code detected:', message)
        setUpdateAvailable(true)
      }
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleError)
    
    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleError)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pageshow', handlePageShow)
      clearInterval(versionCheckInterval)
    }
  }, [])

  // Initialize theme from localStorage (user-specific when available)
  useEffect(() => {
    const applyTheme = (themeName) => {
      const root = document.documentElement

      if (themeName === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        if (prefersDark) {
          root.classList.add('dark')
        } else {
          root.classList.remove('dark')
        }
      } else if (themeName === 'dark') {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }

    // Check user-specific theme first, then fall back to generic theme
    const userTheme = user?.id ? localStorage.getItem(`theme:${user.id}`) : null
    const genericTheme = localStorage.getItem('theme')
    const themePreference = userTheme || genericTheme || 'light'
    applyTheme(themePreference)
    setIsDark(document.documentElement.classList.contains('dark'))

    if (themePreference === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = () => {
        applyTheme('system')
        setIsDark(document.documentElement.classList.contains('dark'))
      }
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [user?.id])

  // Toggle dark mode
  const toggleDarkMode = useCallback(() => {
    setIsDark(prev => {
      const next = !prev
      const nextTheme = next ? 'dark' : 'light'
      if (next) {
        document.documentElement.classList.add('dark')
        localStorage.setItem('theme', 'dark')
      } else {
        document.documentElement.classList.remove('dark')
        localStorage.setItem('theme', 'light')
      }
      if (user?.id) {
        localStorage.setItem(`theme:${user.id}`, nextTheme)
      }
      return next
    })
  }, [user?.id])

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Theme toggle: Cmd/Ctrl + Shift + D
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'd') {
        e.preventDefault()
        toggleDarkMode()
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [toggleDarkMode])

  // Debug auth state on refresh
  useEffect(() => {
    console.log('[App] Auth state:', { loading, user: user?.email || null, profile: profile?.full_name || null })
  }, [loading, user, profile])

  // Show loading screen while auth is initializing
  if (loading) {
    console.log('[App] Showing LoadingScreen - auth still loading')
    return <LoadingScreen />
  }

  // Confetti component
  const confetti = <Confetti trigger={confettiTrigger} />

  // Public routes (no sidebar). Email templates stay admin-only.
  const isPublicPath =
    location.pathname === '/login' ||
    location.pathname === '/client-login' ||
    location.pathname === '/demo' ||
    location.pathname.startsWith('/client-view/')

  if (!user && isPublicPath) {
    return (
      <div className="min-h-screen bg-background">
        <PageLoadingBar isLoading={isNavigating} />
        {confetti}
        {(location.pathname === '/login' || location.pathname === '/client-login') && <InstallPrompt />}
        <Suspense fallback={<PageLoader />}>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/login" element={<Login />} />
              <Route path="/client-login" element={<ClientLogin />} />
              <Route path="/demo" element={<Demo />} />
              <Route path="/client-view/:token" element={<ClientPublic />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </AnimatePresence>
        </Suspense>
      </div>
    )
  }

  // Demo page - no auth required but with sidebar experience
  if (location.pathname === '/demo') {
    return (
      <div className="min-h-screen bg-background">
        <PageLoadingBar isLoading={isNavigating} />
        {confetti}
        <Suspense fallback={<PageLoader />}>
          <Demo />
        </Suspense>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Global navigation loading bar */}
      <PageLoadingBar isLoading={isNavigating} />
      
      {confetti}
      <EasterEggs />
      <InstallPrompt />
      
      {/* Update available notification - appears when a new deployment is detected */}
      <AnimatePresence>
        {updateAvailable && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-4 py-2.5 shadow-lg"
          >
            <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4" />
                <span className="font-medium">New update available!</span>
                <span className="hidden sm:inline opacity-90">Refresh to get the latest features.</span>
              </div>
              <button
                onClick={async () => {
                  // Clear all caches and service worker to ensure clean reload
                  try {
                    // Unregister service workers
                    const registrations = await navigator.serviceWorker?.getRegistrations()
                    for (const registration of registrations || []) {
                      await registration.unregister()
                    }
                    // Clear all caches
                    const cacheNames = await caches?.keys()
                    for (const name of cacheNames || []) {
                      await caches.delete(name)
                    }
                  } catch (e) {
                    console.warn('Cache clear failed:', e)
                  }
                  // Hard reload bypassing cache
                  window.location.href = window.location.href.split('?')[0] + '?v=' + Date.now()
                }}
                className="flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-full text-sm font-medium transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {user ? (
        <FocusModeProvider>
        <GamificationProvider>
          <MainLayout>
            <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
{/* Profile loads in background - no blocking indicator needed */}
            <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              {/* Team routes */}
              <Route
                path="/dashboard"
                element={
                  <TeamRoute>
                    <Dashboard onConfetti={fireConfetti} />
                  </TeamRoute>
                }
              />
              <Route
                path="/boards"
                element={
                  <TeamRoute>
                    <Boards />
                  </TeamRoute>
                }
              />
              <Route
                path="/taskboard"
                element={
                  <TeamRoute>
                    <TaskBoard />
                  </TeamRoute>
                }
              />
              <Route
                path="/boards/:boardId"
                element={
                  <TeamRoute>
                    <BoardDetail />
                  </TeamRoute>
                }
              />
              <Route
                path="/tickets/:ticketId"
                element={
                  <TeamRoute>
                    <TicketDetail />
                  </TeamRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <TeamRoute>
                    <Settings />
                  </TeamRoute>
                }
              />
              <Route
                path="/team"
                element={
                  <TeamRoute>
                    <TeamHub />
                  </TeamRoute>
                }
              />
              <Route
                path="/team/:memberId"
                element={
                  <TeamRoute>
                    <TeamMemberDetail />
                  </TeamRoute>
                }
              />
              <Route
                path="/ideas"
                element={
                  <TeamRoute>
                    <Ideas />
                  </TeamRoute>
                }
              />
              <Route
                path="/ai-squad"
                element={<Navigate to="/dashboard" replace />}
              />
              <Route
                path="/leaderboard"
                element={
                  <TeamRoute>
                    <LeaderboardPage />
                  </TeamRoute>
                }
              />
              <Route
                path="/time"
                element={
                  <TeamRoute>
                    <TimeTracking />
                  </TeamRoute>
                }
              />
              <Route
                path="/reports"
                element={
                  <TeamRoute>
                    <Reports />
                  </TeamRoute>
                }
              />
              <Route
                path="/calendar"
                element={
                  <TeamRoute>
                    <Calendar />
                  </TeamRoute>
                }
              />
              <Route
                path="/clients"
                element={
                  <TeamRoute>
                    <ClientManagement />
                  </TeamRoute>
                }
              />
              <Route
                path="/pipeline"
                element={
                  <TeamRoute>
                    <SalesPipeline />
                  </TeamRoute>
                }
              />
              <Route
                path="/clients/:clientId"
                element={
                  <TeamRoute>
                    <ClientDetail />
                  </TeamRoute>
                }
              />
              <Route
                path="/clients/:clientSlug/tickets/:ticketId"
                element={
                  <TeamRoute>
                    <TicketDetail />
                  </TeamRoute>
                }
              />
              <Route
                path="/docs"
                element={
                  <TeamRoute>
                    <InternalDocs />
                  </TeamRoute>
                }
              />
              <Route path="/videos" element={<Navigate to="/docs" replace />} />
              <Route path="/how-it-works" element={<Navigate to="/docs?collection=platform-guide" replace />} />
              <Route
                path="/diagnostics"
                element={
                  <AdminRoute>
                    <Diagnostics />
                  </AdminRoute>
                }
              />
              <Route
                path="/import"
                element={
                  <AdminRoute>
                    <JiraImport />
                  </AdminRoute>
                }
              />

              {/* Client portal route */}
              <Route
                path="/portal"
                element={
                  <ClientRoute>
                    <ClientPortal />
                  </ClientRoute>
                }
              />

              {/* Public client view (shareable link) */}
              <Route
                path="/client-view/:token"
                element={<ClientPublic />}
              />

              {/* Client dashboard (for logged-in clients) */}
              <Route
                path="/client-dashboard"
                element={<ClientDashboard />}
              />
              <Route
                path="/login"
                element={<Navigate to="/profitability" replace />}
              />
              <Route
                path="/client-login"
                element={<ClientLogin />}
              />

              {/* Admin route */}
              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <Admin />
                  </AdminRoute>
                }
              />

              {/* Mission Dashboard */}
              <Route
                path="/mission"
                element={
                  <AdminRoute>
                    <Mission />
                  </AdminRoute>
                }
              />

              {/* Financials Dashboard */}
              <Route
                path="/profitability/team/:member"
                element={
                  <TeamRoute>
                    <ProfitabilityTeam />
                  </TeamRoute>
                }
              />
              <Route
                path="/profitability/team"
                element={
                  <TeamRoute>
                    <ProfitabilityTeam />
                  </TeamRoute>
                }
              />
              <Route
                path="/profitability/*"
                element={
                  <TeamRoute>
                    <Profitability />
                  </TeamRoute>
                }
              />
              <Route
                path="/financials"
                element={
                  <AdminRoute>
                    <Financials />
                  </AdminRoute>
                }
              />

              {/* Working / Not Working */}
              <Route
                path="/working"
                element={
                  <AdminRoute>
                    <WorkingNotWorking />
                  </AdminRoute>
                }
              />

              {/* Admin Hub */}
              <Route
                path="/admin-hub"
                element={
                  <AdminRoute>
                    <AdminHub />
                  </AdminRoute>
                }
              />

              {/* Email Templates */}
              <Route
                path="/email-templates"
                element={
                  <AdminRoute>
                    <EmailTemplates />
                  </AdminRoute>
                }
              />

              {/* Default redirect */}
              <Route path="/" element={<Navigate to="/profitability" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </AnimatePresence>
            </Suspense>
            </ErrorBoundary>
          </MainLayout>
        </GamificationProvider>
        </FocusModeProvider>
      ) : (
        <Suspense fallback={<PageLoader />}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/login" element={<Login />} />
            <Route path="/client-login" element={<ClientLogin />} />
            <Route path="/client-dashboard" element={<Navigate to="/client-login" replace />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/client-view/:token" element={<ClientPublic />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </AnimatePresence>
        </Suspense>
      )}
    </div>
  )
}

export default App
