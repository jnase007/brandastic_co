import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Menu, X, LayoutDashboard, Kanban, Building2, Clock, BarChart3,
  Users, Users2, Trophy, User, Shield, LogOut, Timer, Activity,
  Search, ChevronRight, Zap, Bell, BookOpen, ActivitySquare, Settings,
  ListTodo, Lightbulb, Target, ListChecks, CheckCircle,
  Server,
  Globe,
  Compass,
  Crosshair,
  ClipboardList,
  Megaphone,
  GraduationCap,
  Heart,
  Receipt,
  LineChart,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useAuth } from '../contexts/AuthContext'
import { useBillingAllowed } from '../hooks/useBillingAllowed'
import { readFullNav } from '../lib/navMode'
import { Button } from './ui/button'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { getInitials } from '../lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'

const LOGO_MARK = 'https://mjguavikbkqrzlvaizqa.supabase.co/storage/v1/object/public/images/Logo-1024x1024.png'

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/time', icon: Clock, label: 'Time Tracking' },
  { path: '/clients', icon: Building2, label: 'Clients' },
  { path: '/score-card', icon: ClipboardList, label: 'All Leads' },
  { path: '/pipeline', icon: Target, label: 'Deal Pipeline' },
  { path: '/feature-list', icon: ListChecks, label: 'Feature List' },
  { path: '/mission', icon: Target, label: 'Mission' },
  { path: '/strategy', icon: Compass, label: 'Strategy 2027' },
  { path: '/ideal-target-client', icon: Crosshair, label: 'Target Client(s)' },
  { path: '/hosting', icon: Server, label: 'Hosting' },
  { path: '/docs', icon: BookOpen, label: 'Internal Docs' },
  { path: '/taskboard', icon: ListTodo, label: 'Task Board' },
  { path: '/reports', icon: BarChart3, label: 'Reports' },
  { path: '/team', icon: Users2, label: 'Team Hub' },
  { path: '/ideas', icon: Lightbulb, label: 'Ideas' },
  { path: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
  { path: '/boards', icon: Kanban, label: 'Boards' },
]

const adminNavItems = [
  { path: '/admin', icon: Shield, label: 'Admin' },
]

const MOBILE_MENU = [
  {
    group: 'Sales',
    items: [
      {
        path: '/score-card',
        icon: ClipboardList,
        label: 'All Leads',
        children: [{ path: '/score-card/financials', label: 'Financials' }],
      },
      {
        path: '/deals',
        icon: Target,
        label: 'Deal Pipeline',
        children: [{ path: '/deals/reporting', label: 'Reporting' }],
      },
      { path: '/analytics', icon: LineChart, label: 'Analytics', billingOnly: true },
    ],
  },
  {
    group: 'Delivery',
    items: [
      { path: '/profitability', icon: BarChart3, label: 'Marketing Retainers' },
      { path: '/profitability/websites', icon: Globe, label: 'Websites' },
      { path: '/hosting', icon: Server, label: 'Hosting' },
    ],
  },
  {
    group: 'Ops',
    items: [{ path: '/feature-list', icon: ListChecks, label: 'Feature List' }],
  },
  {
    group: 'Company',
    items: [
      { path: '/mission', icon: Target, label: 'Mission' },
      { path: '/strategy', icon: Compass, label: 'Strategy 2027' },
      { path: '/ideal-target-client', icon: Crosshair, label: 'Target Client(s)' },
      { path: '/brand-care', icon: Heart, label: 'Brand Care' },
      { path: '/announcements', icon: Megaphone, label: 'Announcements' },
    ],
  },
  {
    group: 'Education',
    items: [
      { path: '/education/v1-overview', icon: GraduationCap, label: 'Masterclass' },
      { path: '/education/agency-academy-course', icon: BookOpen, label: 'Courses' },
      { path: '/education/course-downloads', icon: BookOpen, label: 'Course downloads' },
    ],
  },
  {
    group: 'Team',
    items: [
      { path: '/new_admin', icon: Shield, label: 'Admin' },
      { path: '/profitability/team', icon: Users2, label: 'Team Hours' },
      {
        path: '/billing',
        icon: Receipt,
        label: 'Billing',
        billingOnly: true,
        children: [{ path: '/billing/subscriptions', label: 'Subscriptions' }],
      },
      { path: '/people', icon: Users, label: 'People' },
      { path: '/scenarios', icon: BarChart3, label: 'Scenarios' },
      { path: '/working', icon: CheckCircle, label: 'Working/Not' },
      { path: '/org-structure', icon: Building2, label: 'Org structure' },
    ],
  },
]

const WORKSPACE_ITEMS = [
  { path: '/docs', icon: BookOpen, label: 'Internal Docs' },
  { path: '/taskboard', icon: ListTodo, label: 'Task Board' },
  { path: '/reports', icon: BarChart3, label: 'Reports' },
  { path: '/team', icon: Users2, label: 'Team Hub' },
  { path: '/ideas', icon: Lightbulb, label: 'Ideas' },
  { path: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
  { path: '/boards', icon: Kanban, label: 'Boards' },
  { path: '/pipeline', icon: Target, label: 'Pipeline' },
]

function pathActive(path, pathname) {
  if (path === '/billing') return pathname === '/billing' || pathname.startsWith('/billing/')
  if (path === '/score-card') return pathname === '/score-card' || pathname.startsWith('/score-card/')
  if (path === '/deals') return pathname === '/deals' || pathname.startsWith('/deals/')
  if (path === '/profitability') return pathname === '/profitability'
  if (path === '/profitability/team') return pathname.startsWith('/profitability/team')
  if (path === '/profitability/websites') return pathname.startsWith('/profitability/websites')
  return pathname === path
}

// Bottom tab bar for quick access
export function MobileTabBar({ onOpenTimer, onOpenActivity, billingAllowedOverride = false }) {
  const location = useLocation()
  const { user, isAdmin, profile, canSeePeople, canSeeScoreCard, canSeeProfitability, canManageUsers } = useAuth()
  const billingFromHook = useBillingAllowed()
  const billingAllowed = billingAllowedOverride || billingFromHook
  const canSeePath = (path) => {
    if (path === '/billing' || path === '/team/billing' || path === '/billing/subscriptions' || path === '/team/billing/subscriptions') return billingAllowed
    if (['/people', '/new_admin', '/admin', '/profitability/team', '/scenarios', '/working', '/org-structure'].includes(path)) return canManageUsers
    if (path === '/people') return canSeePeople
    if (path === '/score-card') return canSeeScoreCard
    if (path === '/profitability') return canSeeProfitability
    return true
  }
  const canRevealNav = String(user?.email || '').toLowerCase() === 'justin@brandastic.com'
  const showFullNav = canRevealNav && readFullNav()

  const quickItems = showFullNav
    ? [
        { path: '/dashboard', icon: LayoutDashboard, label: 'Home' },
        { path: '/time', icon: Clock, label: 'Time' },
        { path: '/clients', icon: Building2, label: 'Clients' },
        { action: 'timer', icon: Timer, label: 'Timer' },
        { action: 'more', icon: Menu, label: 'More' },
      ]
    : [
        { path: '/score-card', icon: ClipboardList, label: 'Leads' },
        { path: '/deals', icon: Target, label: 'Deals' },
        { path: '/hosting', icon: Server, label: 'Hosting' },
        { action: 'more', icon: Menu, label: 'More' },
      ].filter((item) => !item.path || canSeePath(item.path))

  const [showMore, setShowMore] = useState(false)

  useEffect(() => {
    setShowMore(false)
  }, [location.pathname])

  useEffect(() => {
    if (!showMore) return undefined
    const previousBody = document.body.style.overflow
    const previousHtml = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousBody
      document.documentElement.style.overflow = previousHtml
    }
  }, [showMore])

  const closeMenu = () => setShowMore(false)
  
  return (
    <>
      {/* Bottom Tab Bar */}
      <nav 
        className="fixed left-0 right-0 z-50 bg-background border-t lg:hidden"
        style={{ 
          bottom: 0,
          top: 'auto',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          // Multiple GPU acceleration hints for iOS Safari
          WebkitTransform: 'translate3d(0, 0, 0)',
          transform: 'translate3d(0, 0, 0)',
          WebkitBackfaceVisibility: 'hidden',
          backfaceVisibility: 'hidden',
          willChange: 'transform',
          // Prevent any movement
          position: 'fixed',
        }}
      >
        <div className="flex items-center justify-around h-16 px-2 bg-gradient-to-t from-background via-background to-background/95">
          {quickItems.map((item) => {
            const Icon = item.icon
            const isActive = item.path === '/profitability/team'
              ? location.pathname.startsWith('/profitability/team')
              : item.path === '/profitability/websites'
                ? location.pathname.startsWith('/profitability/websites')
                : item.path === '/profitability'
                  ? location.pathname.startsWith('/profitability') && !location.pathname.startsWith('/profitability/team') && !location.pathname.startsWith('/profitability/websites')
                  : item.path === '/deals'
                    ? location.pathname === '/deals' || location.pathname.startsWith('/deals/')
                    : item.path && location.pathname === item.path
            
            if (item.action === 'timer') {
              return (
                <motion.button
                  key="timer"
                  onClick={onOpenTimer}
                  whileTap={{ scale: 0.9 }}
                  className="flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 text-muted-foreground hover:text-foreground active:bg-brand-orange/10"
                >
                  <div className="relative">
                    <Icon className="h-5 w-5" />
                    <motion.span 
                      className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                    />
                  </div>
                  <span className="text-[10px] font-medium">{item.label}</span>
                </motion.button>
              )
            }
            
            if (item.action === 'more') {
              return (
                <motion.button
                  key="more"
                  onClick={() => setShowMore(true)}
                  whileTap={{ scale: 0.9 }}
                  className="flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 text-muted-foreground hover:text-foreground active:bg-brand-orange/10"
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </motion.button>
              )
            }
            
            if (item.href) {
              return (
                <a
                  key={item.path}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="relative flex flex-col items-center justify-center gap-1 px-1 py-2 rounded-xl text-muted-foreground hover:text-foreground"
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </a>
              )
            }

            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1 px-1 py-2 rounded-xl transition-all duration-200",
                  isActive
                    ? "text-brand-orange"
                    : "text-muted-foreground hover:text-foreground active:scale-95"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="mobileActiveTab"
                    className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-1 bg-brand-orange rounded-full"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
                <motion.div
                  animate={isActive ? { scale: 1.1, y: -2 } : { scale: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  <Icon className={cn("h-5 w-5", isActive && "text-brand-orange")} />
                </motion.div>
                <span className={cn("max-w-[4.6rem] text-center text-[10px] font-medium leading-tight", isActive && "text-brand-orange font-semibold")}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* More Menu Drawer */}
      <AnimatePresence>
        {showMore && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMore(false)}
              className="fixed inset-0 z-[55] bg-black/50 backdrop-blur-sm lg:hidden"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
              data-testid="mobile-nav-drawer"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-[60] flex flex-col overflow-hidden rounded-t-3xl border-t bg-background shadow-2xl lg:hidden"
              style={{ height: '100dvh', maxHeight: '100dvh', paddingTop: 'env(safe-area-inset-top, 0px)' }}
            >
              {/* Handle - Fixed at top */}
              <div className="flex-shrink-0 pt-3 pb-2">
                <div className="w-12 h-1 bg-muted rounded-full mx-auto" />
              </div>
              
              {/* Scrollable Content */}
              <div
                data-testid="mobile-nav-scroll"
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4"
                style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
              >
                {/* User Profile */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 mb-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={profile?.avatar_url} />
                    <AvatarFallback className="bg-brand-orange text-white font-bold">
                      {getInitials(profile?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{profile?.full_name || 'User'}</p>
                    <p className="text-sm text-muted-foreground truncate">{profile?.role || 'Team Member'}</p>
                  </div>
                  <Link
                    to="/settings"
                    onClick={closeMenu}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg hover:bg-muted"
                  >
                    <Settings className="h-5 w-5 text-muted-foreground" />
                  </Link>
                </div>
                
                {/* Quick Actions */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <button
                    onClick={() => {
                      onOpenTimer()
                      setShowMore(false)
                    }}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl bg-gradient-to-br from-brand-orange to-brand-coral text-white"
                  >
                    <Timer className="h-6 w-6" />
                    <span className="text-xs font-medium">Timer</span>
                  </button>
                  <button
                    onClick={() => {
                      onOpenActivity()
                      setShowMore(false)
                    }}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl bg-muted"
                  >
                    <Activity className="h-6 w-6" />
                    <span className="text-xs font-medium">Activity</span>
                  </button>
                  <Link
                    to="/leaderboard"
                    onClick={() => setShowMore(false)}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl bg-muted"
                  >
                    <Trophy className="h-6 w-6" />
                    <span className="text-xs font-medium">Rank</span>
                  </Link>
                  <Link
                    to="/settings"
                    onClick={() => setShowMore(false)}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl bg-muted"
                  >
                    <Settings className="h-6 w-6" />
                    <span className="text-xs font-medium">Settings</span>
                  </Link>
                </div>

                {/* Nav Items */}
                <div className="mb-4">
                  {MOBILE_MENU.map((section) => {
                    const items = section.items.filter((item) => !item.billingOnly || billingAllowed).filter((item) => canSeePath(item.path))
                    if (!items.length) return null
                    return (
                      <div key={section.group}>
                        <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{section.group}</p>
                        <div className="space-y-0.5">
                          {items.map((item) => {
                            const Icon = item.icon
                            const active = pathActive(item.path, location.pathname)
                            return (
                              <div key={item.path}>
                                <Link
                                  to={item.path}
                                  onClick={closeMenu}
                                  className={cn(
                                    'flex min-h-[44px] items-center gap-3 rounded-xl px-4 transition-colors',
                                    active ? 'bg-brand-orange/10 font-semibold text-brand-orange' : 'text-foreground hover:bg-muted'
                                  )}
                                >
                                  <Icon className="h-5 w-5 shrink-0" />
                                  <span className="font-medium">{item.label}</span>
                                  <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                                </Link>
                                {item.children?.map((child) => (
                                  <Link
                                    key={child.path}
                                    to={child.path}
                                    onClick={closeMenu}
                                    className={cn(
                                      'ml-6 flex min-h-[44px] items-center rounded-lg border-l border-border px-3 text-sm',
                                      location.pathname === child.path
                                        ? 'bg-[#e8eeff] font-medium text-[#1644ED]'
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                    )}
                                  >
                                    {child.label}
                                  </Link>
                                ))}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}

                  {showFullNav ? (
                    <div>
                      <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Workspace</p>
                      <div className="space-y-0.5">
                        {WORKSPACE_ITEMS.filter((item) => canSeePath(item.path)).map((item) => {
                          const Icon = item.icon
                          const active = pathActive(item.path, location.pathname)
                          return (
                            <Link
                              key={item.path}
                              to={item.path}
                              onClick={closeMenu}
                              className={cn(
                                'flex min-h-[44px] items-center gap-3 rounded-xl px-4 transition-colors',
                                active ? 'bg-brand-orange/10 font-semibold text-brand-orange' : 'text-foreground hover:bg-muted'
                              )}
                            >
                              <Icon className="h-5 w-5 shrink-0" />
                              <span className="font-medium">{item.label}</span>
                              <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}

                  {isAdmin && adminNavItems.map((item) => {
                    const Icon = item.icon
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={closeMenu}
                        className="mt-2 flex min-h-[44px] items-center gap-3 rounded-xl px-4 text-brand-purple hover:bg-brand-purple/10"
                      >
                        <Icon className="h-5 w-5" />
                        <span className="font-medium">{item.label}</span>
                        <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                      </Link>
                    )
                  })}
                </div>

                {/* Close Button */}
                <Button
                  variant="ghost"
                  className="mt-4 min-h-[44px] w-full"
                  onClick={closeMenu}
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

// Mobile Header
export function MobileHeader({ onOpenSearch }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    window.location.href = '/login'
  }
  
  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-lg border-b h-14 flex items-center justify-between px-4 lg:hidden">
      <Link to="/dashboard" className="flex items-center gap-2">
        <img src={LOGO_MARK} alt="Brandastic" className="h-8 w-8" />
        <span className="font-bold text-lg">Brandastic</span>
      </Link>
      
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onOpenSearch}
          className="h-9 w-9"
        >
          <Search className="h-5 w-5" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="h-9 w-9">
              <Avatar className="h-7 w-7">
                <AvatarImage src={profile?.avatar_url} />
                <AvatarFallback className="text-xs bg-brand-orange text-white">
                  {getInitials(profile?.full_name)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              {profile?.full_name || 'Account'}
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
    </div>
  )
}

export default MobileTabBar
