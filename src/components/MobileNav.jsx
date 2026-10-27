import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Menu, X, LayoutDashboard, Kanban, Building2, Clock, BarChart3,
  Users2, Trophy, User, Shield, LogOut, Timer, Activity,
  Search, ChevronRight, Zap, Bell, BookOpen, ActivitySquare, Settings,
  ListTodo, Lightbulb, Target,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useAuth } from '../contexts/AuthContext'
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
  { path: '/pipeline', icon: Target, label: 'Sales Pipeline' },
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

// Bottom tab bar for quick access
export function MobileTabBar({ onOpenTimer, onOpenActivity }) {
  const location = useLocation()
  const { user, isAdmin, profile } = useAuth()
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
        { path: '/profitability', icon: BarChart3, label: 'Profitability' },
        { path: '/profitability/team', icon: Users2, label: 'Team' },
      ]

  const [showMore, setShowMore] = useState(false)
  
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
              : item.path === '/profitability'
                ? location.pathname.startsWith('/profitability') && !location.pathname.startsWith('/profitability/team')
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
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-all duration-200",
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
                <span className={cn("text-[10px] font-medium", isActive && "text-brand-orange font-semibold")}>
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
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm lg:hidden"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-3xl border-t shadow-2xl lg:hidden max-h-[85vh] flex flex-col"
            >
              {/* Handle - Fixed at top */}
              <div className="flex-shrink-0 pt-3 pb-2">
                <div className="w-12 h-1 bg-muted rounded-full mx-auto" />
              </div>
              
              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto px-4 pb-4">
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
                    onClick={() => setShowMore(false)}
                    className="p-2 rounded-lg hover:bg-muted"
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
                <div className="space-y-1 mb-4">
                  {navItems.slice(3).map((item) => {
                    const Icon = item.icon
                    const isActive = location.pathname === item.path
                    
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setShowMore(false)}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors",
                          isActive
                            ? "bg-brand-orange/10 text-brand-orange"
                            : "text-foreground hover:bg-muted"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="font-medium">{item.label}</span>
                        <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
                      </Link>
                    )
                  })}
                  
                  {isAdmin && adminNavItems.map((item) => {
                    const Icon = item.icon
                    
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setShowMore(false)}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-brand-purple hover:bg-brand-purple/10 transition-colors"
                      >
                        <Icon className="h-5 w-5" />
                        <span className="font-medium">{item.label}</span>
                        <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
                      </Link>
                    )
                  })}
                </div>

                {/* Close Button */}
                <Button
                  variant="ghost"
                  className="w-full mt-4"
                  onClick={() => setShowMore(false)}
                >
                  Close
                </Button>
              </div>
              
              {/* Safe area padding at bottom */}
              <div className="safe-area-bottom" />
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
