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
  ListChecks,
  Server,
  Globe,
  Compass,
  Crosshair,
  ClipboardList,
  Megaphone,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { prefetchRoute } from '../lib/routePrefetch'
import { useAuth } from '../contexts/AuthContext'
import { readFullNav, setFullNav } from '../lib/navMode'
import { useFeatureListNav } from '../lib/featureListNav'
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
  { path: '/feature-list', icon: ListChecks, label: 'Feature List' },
  { path: '/hosting', icon: Server, label: 'Hosting' },
  { path: '/pipeline', icon: Target, label: 'Deal Pipeline' },
  { path: '/mission', icon: Target, label: 'Mission', shortcut: 'G M' },
  { path: '/strategy', icon: Compass, label: 'Strategy' },
  { path: '/ideal-target-client', icon: Crosshair, label: 'Target Client(s)' },
  { path: '/score-card', icon: ClipboardList, label: 'Score Card' },
  { path: '/docs', icon: BookOpen, label: 'Internal Docs', shortcut: 'G N' },
  { path: '/taskboard', icon: Kanban, label: 'Task Board', shortcut: 'G K' },
  { path: '/reports', icon: BarChart3, label: 'Reports', shortcut: 'G R' },
  { path: '/calendar', icon: CalendarDays, label: 'Calendar', shortcut: 'G E' },
  { path: '/team', icon: Users2, label: 'Team Hub', shortcut: 'G H' },
  { path: '/ideas', icon: Lightbulb, label: 'Ideas', shortcut: 'G I' },
  { path: '/leaderboard', icon: Trophy, label: 'Leaderboard', shortcut: 'G L' },
]

const simpleNavItems = [
  { path: '/deals', icon: Target, label: 'Deal Pipeline', group: 'Sales' },
  { path: '/score-card', icon: ClipboardList, label: 'Score Card', group: 'Sales' },
  { path: '/profitability', icon: BarChart3, label: 'Marketing Retainers', group: 'Delivery' },
  { path: '/profitability/websites', icon: Globe, label: 'Websites', group: 'Delivery' },
  { path: '/hosting', icon: Server, label: 'Hosting', group: 'Delivery' },
  { path: '/announcements', icon: Megaphone, label: 'Announcements', group: 'Ops' },
  { path: '/feature-list', icon: ListChecks, label: 'Feature List', group: 'Ops' },
  { path: '/mission', icon: Target, label: 'Mission', group: 'Company' },
  { path: '/strategy', icon: Compass, label: 'Strategy', group: 'Company' },
  { path: '/ideal-target-client', icon: Crosshair, label: 'Target Client(s)', group: 'Company' },
  { path: '/new_admin', icon: Shield, label: 'Admin', group: 'Team' },
  { path: '/profitability/team', icon: Users2, label: 'Team Hours', group: 'Team' },
  { path: '/people', icon: Users, label: 'People', group: 'Team' },
  { path: '/scenarios', icon: BarChart3, label: 'Scenarios', group: 'Team' },
  { path: '/working', icon: CheckCircle, label: 'Working/Not', group: 'Team' },
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
  const { user, signOut, isAdmin, isActualAdmin, canSeePeople, canSeeScoreCard, canSeeProfitability, canManageUsers, viewMode, toggleViewMode, toggleClientPreview, clientPreviewMode } = useAuth()
  const canRevealNav = String(user?.email || '').toLowerCase() === 'justin@brandastic.com'
  const [fullNav, setFullNavState] = useState(false)

  useEffect(() => {
    if (!canRevealNav) {
      setFullNavState(false)
      return
    }
    try {
      const v = localStorage.getItem('brandasticFullNav')
      setFullNavState(v === '1')
    } catch {
      setFullNavState(false)
    }
  }, [canRevealNav])

  const showFullNav = Boolean(canRevealNav && fullNav)
  const simplePaths = new Set(simpleNavItems.map((item) => item.path))
  const visibleNavItems = [
    ...simpleNavItems,
    ...(showFullNav ? navItems.filter((item) => !simplePaths.has(item.path)) : []),
  ].filter((item) => {
    if (item.path === '/people') return canSeePeople
    if (item.path === '/score-card') return canSeeScoreCard
    if (item.path === '/profitability') return canSeeProfitability
    if (item.path === '/admin' || item.path === '/new_admin') return canManageUsers
    return true
  })
  const featureNav = useFeatureListNav()?.nav

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
    const interval = setInterval(loadRecent, 15000)
    
    return () => {
      window.removeEventListener('storage', handleStorage)
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (!featureNav?.activeId || collapsed) return
    const button = document.querySelector(`[data-feature-nav="${featureNav.activeId}"]`)
    const nav = button?.closest('nav')
    if (!button || !nav) return
    const navRect = nav.getBoundingClientRect()
    const buttonRect = button.getBoundingClientRect()
    if (buttonRect.top < navRect.top) nav.scrollTop -= navRect.top - buttonRect.top
    else if (buttonRect.bottom > navRect.bottom) nav.scrollTop += buttonRect.bottom - navRect.bottom
  }, [featureNav?.activeId, collapsed])

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
        {visibleNavItems.map((item, index) => {
          const prevGroup = visibleNavItems[index - 1]?.group
          const showGroup = Boolean(item.group && item.group !== prevGroup && !collapsed)
          const isActive = item.path === '/profitability'
            ? (location.pathname === '/profitability' || (location.pathname.startsWith('/profitability/') && !location.pathname.startsWith('/profitability/team') && !location.pathname.startsWith('/profitability/websites')))
            : item.path === '/profitability/team'
              ? location.pathname.startsWith('/profitability/team')
              : item.path === '/profitability/websites'
                ? location.pathname.startsWith('/profitability/websites')
                : item.path === '/score-card'
                  ? location.pathname.startsWith('/score-card')
                  : location.pathname === item.path
          const sections = item.path === '/feature-list' && location.pathname === '/feature-list' && !collapsed ? featureNav?.sections : null
          const hiddenItem = showFullNav && !simplePaths.has(item.path)
          return (
            <div key={item.path}>
              {showGroup ? (
                <p className={cn('px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400', index > 0 && 'mt-3 pt-2')}>{item.group}</p>
              ) : null}
              <Link
                to={item.path}
                onMouseEnter={() => prefetchRoute(item.path)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all relative group",
                  collapsed && "justify-center px-0",
                  isActive && hiddenItem
                    ? "bg-pink-500 text-white"
                    : isActive
                      ? "bg-brand-orange text-white"
                      : hiddenItem
                        ? "text-pink-500 hover:bg-pink-500/10 hover:text-pink-600"
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

                {/* Tooltip for collapsed */}
                {collapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-foreground text-background text-sm rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                    {item.label}
                  </div>
                )}
              </Link>
              {item.path === '/score-card' && isActive && !collapsed ? (
                <div className="mb-2 ml-3 mt-1 border-l border-border pl-2">
                  <Link
                    to="/score-card/financials"
                    onMouseEnter={() => prefetchRoute('/score-card/financials')}
                    className={cn(
                      "flex w-full rounded-lg px-2 py-1.5 text-left text-sm",
                      location.pathname === '/score-card/financials'
                        ? "bg-[#e8eeff] font-medium text-[#1644ED]"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    Financials
                  </Link>
                </div>
              ) : null}
              {sections?.length ? (
                <div className="mb-2 ml-3 mt-1 space-y-0.5 border-l border-border pl-2">
                  {sections.map((section) => {
                    const current = section.id === (featureNav.activeId || sections[0].id)
                    return (
                      <button
                        key={section.id}
                        type="button"
                        data-feature-nav={section.id}
                        onClick={() => featureNav.jump(section.name)}
                        className={cn(
                          "flex w-full items-baseline gap-2 rounded-lg px-2 py-1.5 text-left text-sm leading-snug",
                          current
                            ? "bg-[#e8eeff] font-medium text-[#1644ED]"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <span className="w-5 shrink-0 text-xs">{section.number}</span>
                        <span>{section.name}</span>
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>
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
        {canRevealNav && !showFullNav && (
          <button
            type="button"
            onClick={unhideNav}
            className="w-full flex justify-end pr-1 opacity-[0.12] hover:opacity-50 transition-opacity"
            title=" "
            aria-label="Reveal extra navigation"
          >
            <Eye className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
        {canRevealNav && showFullNav && (
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
