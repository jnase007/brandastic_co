import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Kanban,
  User,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Search,
  Activity,
  Timer,
  Command,
  Users,
  BarChart3,
  Shield,
  Users2,
  Upload,
  Trophy,
  Clock,
  Eye,
  EyeOff,
  Building2,
  Sparkles,
  BookOpen,
  ChevronDown,
  Target,
  Flame,
  CalendarDays,
  CheckCircle,
  Crown,
  History,
  Hash,
  X,
  Mail,
  Lightbulb,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useAuth } from '../contexts/AuthContext'
import { readFullNav, setFullNav } from '../lib/navMode'
import { Button } from './ui/button'
import XPBar from './XPBar'
import { AchievementMini } from './AchievementShowcase'
import DailyChallenges from './DailyChallenges'
import { NotificationBell } from './NotificationCenter'

const LOGO_WHITE = 'https://mjguavikbkqrzlvaizqa.supabase.co/storage/v1/object/public/images/BrandasticLogo-White%20(4).png'
const LOGO_ICON = 'https://mjguavikbkqrzlvaizqa.supabase.co/storage/v1/object/public/images/Brandastic_black_logo%20(6).png'
const LOGO_MARK = 'https://mjguavikbkqrzlvaizqa.supabase.co/storage/v1/object/public/images/Logo-1024x1024.png'

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', shortcut: 'G D' },
  { path: '/time', icon: Clock, label: 'Time Tracking', shortcut: 'G T' },
  { path: '/clients', icon: Building2, label: 'Clients', shortcut: 'G C' },
  { path: '/pipeline', icon: Target, label: 'Sales Pipeline' },
  { path: '/docs', icon: BookOpen, label: 'Internal Docs', shortcut: 'G N' },
  { path: '/taskboard', icon: Kanban, label: 'Task Board', shortcut: 'G K' },
  { path: '/reports', icon: BarChart3, label: 'Reports', shortcut: 'G R' },
  { path: '/calendar', icon: CalendarDays, label: 'Calendar', shortcut: 'G E' },
  { path: '/team', icon: Users2, label: 'Team Hub', shortcut: 'G H' },
  { path: '/ideas', icon: Lightbulb, label: 'Ideas', shortcut: 'G I' },
  { path: '/leaderboard', icon: Trophy, label: 'Leaderboard', shortcut: 'G L' },
]

const simpleNavItems = [
  { path: '/profitability', icon: BarChart3, label: 'Profitability' },
  { path: '/profitability/team', icon: Users2, label: 'Team' },
]

const adminNavItems = [
  { path: '/admin-hub', icon: Crown, label: 'Admin Hub', shortcut: 'G H' },
  { path: '/mission', icon: Target, label: 'Mission', shortcut: 'G M' },
  { path: '/financials', icon: BarChart3, label: 'Financials', shortcut: 'G F' },
  { path: '/working', icon: CheckCircle, label: 'Working/Not', shortcut: 'G W' },
  { path: '/email-templates', icon: Mail, label: 'Email Templates', shortcut: 'G E' },
  { path: '/admin', icon: Shield, label: 'Users', shortcut: 'G A' },
  { path: '/import', icon: Upload, label: 'JIRA Import', shortcut: 'G I' },
]

export default function Sidebar({ 
  collapsed, 
  onCollapse, 
  onOpenCommandPalette,
  onOpenActivity,
  onOpenTimer
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const { signOut, isAdmin, isActualAdmin, viewMode, toggleViewMode, toggleClientPreview, clientPreviewMode } = useAuth()
  const [fullNav, setFullNavState] = useState(false)

  useEffect(() => {
    if (!isActualAdmin) {
      setFullNavState(false)
      return
    }
    try {
      const v = localStorage.getItem('brandasticFullNav')
      setFullNavState(v === '1')
    } catch {
      setFullNavState(false)
    }
  }, [isActualAdmin])

  const showFullNav = Boolean(isActualAdmin && fullNav)
  const visibleNavItems = showFullNav ? navItems : simpleNavItems

  const unhideNav = () => {
    setFullNav(true)
    setFullNavState(true)
  }
  const hideNavAgain = () => {
    setFullNav(false)
    setFullNavState(false)
  }
  const [gamificationExpanded, setGamificationExpanded] = useState(false)
  const [recentlyViewed, setRecentlyViewed] = useState([])
  const [showRecent, setShowRecent] = useState(true)

  // Load recently viewed items
  useEffect(() => {
    const loadRecent = () => {
      const recent = JSON.parse(localStorage.getItem('recentlyViewed') || '[]')
      setRecentlyViewed(recent.slice(0, 5))
    }
    loadRecent()
    
    // Listen for storage changes (from command palette)
    const handleStorage = (e) => {
      if (e.key === 'recentlyViewed') {
        loadRecent()
      }
    }
    window.addEventListener('storage', handleStorage)
    
    // Also poll periodically for same-tab updates
    const interval = setInterval(loadRecent, 2000)
    
    return () => {
      window.removeEventListener('storage', handleStorage)
      clearInterval(interval)
    }
  }, [])

  
  const getRecentIcon = (type) => {
    switch (type) {
      case 'client': return Building2
      case 'ticket': return Hash
      case 'member': return User
      case 'board': return Kanban
      default: return History
    }
  }
  
  const clearRecentlyViewed = (e) => {
    e.preventDefault()
    e.stopPropagation()
    localStorage.removeItem('recentlyViewed')
    setRecentlyViewed([])
  }

  const handleSignOut = async () => {
    await signOut()
    window.location.href = '/login'
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r bg-background flex flex-col",
        "shadow-lg"
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b">
        <AnimatePresence mode="wait">
          {collapsed ? (
            <motion.div
              key="icon"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="w-10 h-10 rounded-lg overflow-hidden"
              data-logo
            >
              <img 
                src={LOGO_MARK} 
                alt="Brandastic" 
                className="w-full h-full object-contain"
              />
            </motion.div>
          ) : (
            <motion.div
              key="full"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex items-center gap-2"
              data-logo
            >
              <div className="w-9 h-9 rounded-lg overflow-hidden">
                <img 
                  src={LOGO_MARK} 
                  alt="Brandastic" 
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="font-bold text-lg">Brandastic</span>
            </motion.div>
          )}
        </AnimatePresence>
        
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onCollapse(!collapsed)}
          className="h-8 w-8"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Search - prioritized at top */}
      {showFullNav && <div className="p-3 pb-2">
        <Button
          variant="outline"
          size={collapsed ? "icon" : "default"}
          onClick={onOpenCommandPalette}
          className={cn(
            "w-full justify-start gap-2",
            collapsed && "justify-center px-0"
          )}
        >
          <Search className="h-4 w-4" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left text-muted-foreground">Search...</span>
              <kbd className="text-xs bg-muted px-1.5 py-0.5 rounded">⌘K</kbd>
            </>
          )}
        </Button>
      </div>}

      {/* Compact XP Bar & Gamification Toggle */}
      {showFullNav && <div className="px-3 pb-2">
        {collapsed ? (
          <XPBar collapsed={collapsed} />
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="wait">
              {!gamificationExpanded ? (
                /* Compact Gamification Summary */
                <motion.button
                  key="compact"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setGamificationExpanded(true)}
                  className="w-full p-2 rounded-lg bg-gradient-to-r from-brand-orange/10 to-brand-purple/5 border border-brand-orange/20 hover:border-brand-orange/40 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <XPBar collapsed={true} />
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Target className="h-3 w-3 text-brand-purple" />
                        <Trophy className="h-3 w-3 text-yellow-500" />
                      </div>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </div>
                </motion.button>
              ) : (
                /* Expanded Gamification Cards */
                <motion.div
                  key="expanded"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-2"
                >
                  {/* XP Bar with collapse button */}
                  <div className="relative">
                    <XPBar collapsed={false} />
                    <button
                      onClick={() => setGamificationExpanded(false)}
                      className="absolute top-2 right-2 p-1 rounded hover:bg-black/10 transition-colors"
                    >
                      <ChevronDown className="h-4 w-4 text-muted-foreground rotate-180" />
                    </button>
                  </div>
                  <DailyChallenges compact />
                  <AchievementMini />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {visibleNavItems.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all relative group",
                collapsed && "justify-center px-0",
                isActive
                  ? "bg-brand-orange text-white"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && (
                <span className="flex items-center gap-2">
                  {item.label}
                  {item.beta && (
                    <span className="text-[9px] px-1.5 py-0.5 bg-amber-500/20 text-amber-600 rounded-full font-medium">
                      BETA
                    </span>
                  )}
                </span>
              )}
              
              {/* Active indicator */}
              {isActive && (
                <motion.div
                  layoutId="activeNav"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full"
                />
              )}
              
              {/* Tooltip for collapsed */}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-foreground text-background text-sm rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                  {item.label}
                </div>
              )}
            </Link>
          )
        })}

        {/* Admin Navigation - only for admins */}
        {showFullNav && isActualAdmin && (
          <>
            <div className="pt-4 border-t mt-4">
              <div className={cn(
                "flex items-center justify-between mb-2",
                collapsed ? "justify-center" : "px-3"
              )}>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  {collapsed ? "⚡" : "Admin"}
                </p>
                {!collapsed && (
                  <button
                    onClick={toggleViewMode}
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all",
                      viewMode === 'team'
                        ? "bg-green-500/10 text-green-600 hover:bg-green-500/20"
                        : "bg-brand-purple/10 text-brand-purple hover:bg-brand-purple/20"
                    )}
                    title={viewMode === 'team' ? 'Viewing as Team Member' : 'Viewing as Admin'}
                  >
                    {viewMode === 'team' ? (
                      <>
                        <Eye className="h-3 w-3" />
                        Team View
                      </>
                    ) : (
                      <>
                        <Shield className="h-3 w-3" />
                        Admin View
                      </>
                    )}
                  </button>
                )}
              </div>
              
              {/* Only show admin nav items when in admin view mode */}
              {viewMode !== 'team' && adminNavItems.map((item) => {
                const isActive = location.pathname === item.path
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all relative group",
                      collapsed && "justify-center px-0",
                      isActive
                        ? "bg-brand-purple text-white"
                        : "hover:bg-brand-purple/10 text-brand-purple hover:text-brand-purple"
                    )}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                    
                    {collapsed && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-foreground text-background text-sm rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                        {item.label}
                      </div>
                    )}
                  </Link>
                )
              })}
              
              {/* When in team view mode, show a compact toggle */}
              {collapsed && (
                <button
                  onClick={toggleViewMode}
                  className={cn(
                    "w-full flex items-center justify-center p-2.5 rounded-lg font-medium transition-all",
                    viewMode === 'team'
                      ? "bg-green-500/10 text-green-600 hover:bg-green-500/20"
                      : "bg-brand-purple/10 text-brand-purple hover:bg-brand-purple/20"
                  )}
                  title={viewMode === 'team' ? 'Switch to Admin View' : 'Switch to Team View'}
                >
                  {viewMode === 'team' ? (
                    <Eye className="h-5 w-5" />
                  ) : (
                    <EyeOff className="h-5 w-5" />
                  )}
                </button>
              )}

              {/* Preview Client Portal Button */}
              {!collapsed ? (
                <button
                  onClick={() => toggleClientPreview()}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2.5 mt-2 rounded-lg font-medium transition-all",
                    clientPreviewMode
                      ? "bg-brand-coral text-white hover:bg-brand-coral/90"
                      : "bg-gradient-to-r from-brand-orange/10 to-brand-coral/10 text-brand-orange hover:from-brand-orange/20 hover:to-brand-coral/20 border border-brand-orange/20"
                  )}
                >
                  <Sparkles className="h-4 w-4" />
                  <span className="text-sm">
                    {clientPreviewMode ? 'Exit Client View' : 'Preview Client Portal'}
                  </span>
                </button>
              ) : (
                <button
                  onClick={() => toggleClientPreview()}
                  className={cn(
                    "w-full flex items-center justify-center p-2.5 mt-2 rounded-lg font-medium transition-all",
                    clientPreviewMode
                      ? "bg-brand-coral text-white"
                      : "bg-brand-orange/10 text-brand-orange hover:bg-brand-orange/20"
                  )}
                  title={clientPreviewMode ? 'Exit Client View' : 'Preview Client Portal'}
                >
                  <Sparkles className="h-5 w-5" />
                </button>
              )}
            </div>
          </>
        )}

        {/* Recently Viewed Section */}
        {showFullNav && !collapsed && recentlyViewed.length > 0 && showRecent && (
          <div className="pt-4 border-t mt-4">
            <div className="flex items-center justify-between px-3 mb-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <History className="h-3 w-3" />
                Recent
              </p>
              <button
                onClick={clearRecentlyViewed}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                title="Clear recent"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <AnimatePresence>
              {recentlyViewed.map((item, idx) => {
                const IconComponent = getRecentIcon(item.type)
                return (
                  <motion.div
                    key={`${item.type}-${item.id}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <Link
                      to={item.path}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-all group"
                    >
                      <IconComponent className="h-3.5 w-3.5 flex-shrink-0 opacity-60 group-hover:opacity-100" />
                      <span className="truncate flex-1">{item.name}</span>
                    </Link>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}

        {showFullNav && <div className="pt-4 border-t mt-4">
          <p className={cn(
            "text-xs text-muted-foreground uppercase tracking-wider mb-2",
            collapsed ? "text-center" : "px-3"
          )}>
            {collapsed ? "•" : "Quick Access"}
          </p>
          
          <button
            onClick={onOpenTimer}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all",
              collapsed && "justify-center px-0",
              "hover:bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            <Timer className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span>Timer</span>}
          </button>
          
          <button
            onClick={onOpenActivity}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all",
              collapsed && "justify-center px-0",
              "hover:bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            <Activity className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span>Activity</span>}
          </button>

          {/* Notifications */}
          <div className={cn(
            "flex items-center gap-3 px-3 py-2.5",
            collapsed && "justify-center px-0"
          )}>
            <NotificationBell />
            {!collapsed && <span className="text-sm text-muted-foreground">Notifications</span>}
          </div>
        </div>}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t space-y-2">
        {isActualAdmin && !showFullNav && (
          <Button
            variant="outline"
            size={collapsed ? "icon" : "default"}
            onClick={unhideNav}
            className={cn(
              "w-full justify-start gap-2",
              collapsed && "justify-center px-0"
            )}
            title="Unhide navigation"
          >
            <Eye className="h-4 w-4" />
            {!collapsed && <span>Unhide navigation</span>}
          </Button>
        )}
        {isActualAdmin && showFullNav && (
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "default"}
            onClick={hideNavAgain}
            className={cn(
              "w-full justify-start gap-2 text-muted-foreground",
              collapsed && "justify-center px-0"
            )}
            title="Hide extra navigation"
          >
            <EyeOff className="h-4 w-4" />
            {!collapsed && <span>Hide extra nav</span>}
          </Button>
        )}
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          onClick={handleSignOut}
          className={cn(
            "w-full justify-start gap-2 text-muted-foreground hover:text-red-500",
            collapsed && "justify-center px-0"
          )}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Sign Out</span>}
        </Button>
      </div>
    </motion.aside>
  )
}
