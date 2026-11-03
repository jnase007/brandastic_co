import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  LayoutDashboard,
  Kanban,
  Clock,
  Users,
  Settings,
  Plus,
  ArrowRight,
  Command,
  Ticket,
  Moon,
  Sun,
  LogOut,
  Zap,
  Building2,
  Target,
  BarChart3,
  Trophy,
  Wallet,
  Timer,
  HelpCircle,
  Keyboard,
  Activity,
  Users2,
  Hash,
  Loader2,
  User,
  History,
  Play,
  Sparkles,
  ListChecks,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { Badge } from './ui/badge'

const COMMANDS = [
  // Navigation
  { id: 'dashboard', label: 'Go to Dashboard', icon: LayoutDashboard, shortcut: 'G D', action: 'navigate', path: '/dashboard', category: 'Navigation' },
  { id: 'time', label: 'Go to Time Tracking', icon: Clock, shortcut: 'G T', action: 'navigate', path: '/time', category: 'Navigation' },
  { id: 'clients', label: 'Go to Clients', icon: Building2, shortcut: 'G C', action: 'navigate', path: '/clients', category: 'Navigation' },
  { id: 'feature-list', label: 'Go to Feature List', icon: ListChecks, action: 'navigate', path: '/feature-list', category: 'Navigation' },
  { id: 'pipeline', label: 'Go to Sales Pipeline', icon: Target, action: 'navigate', path: '/pipeline', category: 'Navigation' },
  { id: 'docs', label: 'Go to Internal Docs', icon: HelpCircle, shortcut: 'G N', action: 'navigate', path: '/docs', category: 'Navigation' },
  { id: 'reports', label: 'Go to Reports', icon: BarChart3, shortcut: 'G R', action: 'navigate', path: '/reports', category: 'Navigation' },
  { id: 'payroll', label: 'Go to Payroll Report', icon: Wallet, action: 'navigate', path: '/reports?tab=payroll', category: 'Navigation' },
  { id: 'team', label: 'Go to Team Hub', icon: Users2, shortcut: 'G H', action: 'navigate', path: '/team', category: 'Navigation' },
  { id: 'leaderboard', label: 'Go to Leaderboard', icon: Trophy, shortcut: 'G L', action: 'navigate', path: '/leaderboard', category: 'Navigation' },
  { id: 'boards', label: 'Go to Boards', icon: Kanban, shortcut: 'G B', action: 'navigate', path: '/boards', category: 'Navigation' },
  { id: 'settings', label: 'Go to Settings', icon: Settings, shortcut: 'G S', action: 'navigate', path: '/settings', category: 'Navigation' },
  
  // Quick Actions
  { id: 'log-time', label: 'Log Time Entry', icon: Clock, shortcut: 'T L', action: 'custom', category: 'Quick Actions' },
  { id: 'start-timer', label: 'Start Timer', icon: Timer, shortcut: 'T S', action: 'custom', category: 'Quick Actions' },
  { id: 'stop-timer', label: 'Stop Timer', icon: Timer, shortcut: 'T X', action: 'custom', category: 'Quick Actions' },
  { id: 'new-ticket', label: 'Create New Task', icon: Ticket, shortcut: 'C T', action: 'custom', category: 'Quick Actions' },
  { id: 'new-board', label: 'Create New Board', icon: Plus, shortcut: 'C B', action: 'navigate', path: '/boards?new=true', category: 'Quick Actions' },
  { id: 'activity', label: 'View Activity Feed', icon: Activity, action: 'custom', category: 'Quick Actions' },
  
  // Preferences
  { id: 'toggle-theme', label: 'Toggle Dark Mode', icon: Moon, shortcut: 'T D', action: 'theme', category: 'Preferences' },
  { id: 'keyboard-shortcuts', label: 'Keyboard Shortcuts', icon: Keyboard, shortcut: '?', action: 'custom', category: 'Preferences' },
  
  // Account
  { id: 'logout', label: 'Sign Out', icon: LogOut, action: 'custom', category: 'Account' },
]

// Helper to format minutes as hours
function formatMinutes(minutes) {
  if (!minutes) return '0m'
  const hrs = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hrs === 0) return `${mins}m`
  if (mins === 0) return `${hrs}h`
  return `${hrs}h ${mins}m`
}

export default function CommandPalette({ open, onOpenChange, onAction }) {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const searchTimeoutRef = useRef(null)

  // Load recently viewed items from localStorage
  const [recentlyViewed, setRecentlyViewed] = useState([])
  const [recentTimeEntries, setRecentTimeEntries] = useState([])
  
  // Load recent data on mount
  useEffect(() => {
    if (open) {
      // Load recently viewed
      const recent = JSON.parse(localStorage.getItem('recentlyViewed') || '[]')
      setRecentlyViewed(recent.slice(0, 5))
      
      // Load recent time entries for "continue working" suggestions
      loadRecentTimeEntries()
    }
  }, [open])
  
  const loadRecentTimeEntries = async () => {
    try {
      const { data } = await supabase
        .from('time_entries')
        .select(`
          id, description, minutes, date,
          client:client_id(id, name),
          ticket:ticket_id(id, title, ticket_id)
        `)
        .order('created_at', { ascending: false })
        .limit(3)
      
      setRecentTimeEntries(data || [])
    } catch (e) {
      console.error('Error loading recent time entries:', e)
    }
  }

  // Search tickets when query changes
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([])
      return
    }

    // Debounce search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        // Parallel searches for better performance
        const [ticketsRes, clientsRes, teamRes, boardsRes] = await Promise.all([
          // Search tickets
          supabase
            .from('tickets')
            .select('id, ticket_id, title, client_id, client:client_id(name)')
            .or(`ticket_id.ilike.%${query}%,title.ilike.%${query}%`)
            .limit(5),
          // Search clients
          supabase
            .from('clients')
            .select('id, name, color')
            .ilike('name', `%${query}%`)
            .eq('is_active', true)
            .limit(4),
          // Search team members
          supabase
            .from('profiles')
            .select('id, full_name, email, avatar_url, role')
            .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
            .eq('is_active', true)
            .limit(3),
          // Search boards
          supabase
            .from('boards')
            .select('id, name, client_id, clients(name)')
            .ilike('name', `%${query}%`)
            .limit(3)
        ])

        const results = []
        
        // Add client results first (more likely to be searched)
        if (clientsRes.data?.length) {
          clientsRes.data.forEach(c => {
            results.push({
              id: `client-${c.id}`,
              type: 'client',
              label: c.name,
              sublabel: 'Client',
              icon: Building2,
              color: c.color,
              action: 'navigate',
              path: `/clients/${c.id}`,
              category: '🏢 Clients',
            })
          })
        }

        // Add ticket results
        if (ticketsRes.data?.length) {
          ticketsRes.data.forEach(t => {
            results.push({
              id: `ticket-${t.id}`,
              type: 'ticket',
              label: t.title,
              sublabel: `${t.ticket_id || 'Task'} • ${t.client?.name || 'Unknown'}`,
              ticketId: t.ticket_id,
              icon: Hash,
              action: 'navigate',
              path: `/clients/${t.client_id}/tickets/${t.ticket_id || t.id}`,
              category: '📋 Tasks',
            })
          })
        }
        
        // Add team member results
        if (teamRes.data?.length) {
          teamRes.data.forEach(m => {
            results.push({
              id: `member-${m.id}`,
              type: 'member',
              label: m.full_name,
              sublabel: m.role === 'admin' ? 'Admin' : m.role === 'contractor' ? 'Contractor' : 'Team Member',
              icon: User,
              avatarUrl: m.avatar_url,
              action: 'navigate',
              path: `/team/${m.id}`,
              category: '👥 Team',
            })
          })
        }
        
        // Add board results
        if (boardsRes.data?.length) {
          boardsRes.data.forEach(b => {
            results.push({
              id: `board-${b.id}`,
              type: 'board',
              label: b.name,
              sublabel: b.clients?.name || 'Board',
              icon: Kanban,
              action: 'navigate',
              path: `/boards/${b.id}`,
              category: '📌 Boards',
            })
          })
        }

        setSearchResults(results)
      } catch (error) {
        console.error('Search error:', error)
      } finally {
        setSearching(false)
      }
    }, 150) // Faster debounce

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [query])

  // Filter commands based on query
  const filteredCommands = COMMANDS.filter(cmd =>
    cmd.label.toLowerCase().includes(query.toLowerCase()) ||
    cmd.category.toLowerCase().includes(query.toLowerCase())
  )

  // Group by category (including search results)
  const groupedCommands = useMemo(() => {
    const grouped = {}
    
    // If no query, show smart suggestions first
    if (!query.trim()) {
      // Continue working suggestions from recent time entries
      if (recentTimeEntries.length > 0) {
        grouped['⚡ Continue Working'] = recentTimeEntries.slice(0, 2).map(entry => ({
          id: `continue-${entry.id}`,
          type: 'continue',
          label: entry.description || entry.ticket?.title || 'Continue work',
          sublabel: `${entry.client?.name || 'Client'} • ${formatMinutes(entry.minutes)} logged`,
          icon: Play,
          action: 'custom',
          clientId: entry.client?.id,
          clientName: entry.client?.name,
          ticketId: entry.ticket?.id,
          category: '⚡ Continue Working',
        }))
      }
      
      // Recently viewed
      if (recentlyViewed.length > 0) {
        grouped['🕐 Recently Viewed'] = recentlyViewed.map(item => ({
          id: `recent-${item.type}-${item.id}`,
          type: item.type,
          label: item.name,
          sublabel: item.sublabel || (item.type === 'client' ? 'Client' : item.type === 'ticket' ? 'Task' : 'Team Member'),
          icon: item.type === 'client' ? Building2 : item.type === 'ticket' ? Hash : User,
          action: 'navigate',
          path: item.path,
          category: '🕐 Recently Viewed',
        }))
      }
    }
    
    // Add search results
    searchResults.forEach(result => {
      if (!grouped[result.category]) grouped[result.category] = []
      grouped[result.category].push(result)
    })
    
    // Add filtered commands (but not all when no query - just quick actions)
    const commandsToShow = query.trim() 
      ? filteredCommands 
      : filteredCommands.filter(cmd => cmd.category === 'Quick Actions' || cmd.category === 'Navigation').slice(0, 6)
    
    commandsToShow.forEach(cmd => {
      if (!grouped[cmd.category]) grouped[cmd.category] = []
      grouped[cmd.category].push(cmd)
    })
    
    return grouped
  }, [filteredCommands, searchResults, query, recentlyViewed, recentTimeEntries])

  // Flatten for keyboard navigation
  const flatCommands = Object.values(groupedCommands).flat()

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery('')
      setSelectedIndex(0)
    }
  }, [open])

  // Keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (!open) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, flatCommands.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (flatCommands[selectedIndex]) {
          executeCommand(flatCommands[selectedIndex])
        }
        break
      case 'Escape':
        onOpenChange(false)
        break
    }
  }, [open, flatCommands, selectedIndex])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Track recently viewed
  const trackRecentlyViewed = useCallback((item) => {
    const recent = JSON.parse(localStorage.getItem('recentlyViewed') || '[]')
    // Remove if already exists
    const filtered = recent.filter(r => !(r.type === item.type && r.id === item.id))
    // Add to front
    filtered.unshift(item)
    // Keep only 10
    localStorage.setItem('recentlyViewed', JSON.stringify(filtered.slice(0, 10)))
  }, [])

  // Execute command
  const executeCommand = (cmd) => {
    onOpenChange(false)
    
    // Track recently viewed for searchable items
    if (cmd.type === 'client' || cmd.type === 'ticket' || cmd.type === 'member' || cmd.type === 'board') {
      trackRecentlyViewed({
        type: cmd.type,
        id: cmd.id.replace(`${cmd.type}-`, ''),
        name: cmd.label,
        sublabel: cmd.sublabel,
        path: cmd.path,
      })
    }
    
    switch (cmd.action) {
      case 'navigate':
        navigate(cmd.path)
        break
      case 'theme':
        document.documentElement.classList.toggle('dark')
        break
      case 'custom':
        // For "continue working" items, pass the client/ticket context
        if (cmd.type === 'continue') {
          onAction?.('start-timer', { 
            clientId: cmd.clientId, 
            clientName: cmd.clientName,
            ticketId: cmd.ticketId,
            description: cmd.label 
          })
        } else {
          onAction?.(cmd.id)
        }
        break
    }
  }

  // Global keyboard shortcut
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [open, onOpenChange])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-[20%] z-50 w-full max-w-xl -translate-x-1/2"
          >
            <div className="mx-4 overflow-hidden rounded-2xl border bg-background shadow-2xl">
              {/* Search Input */}
              <div className="flex items-center gap-3 border-b px-4 py-3">
                {searching ? (
                  <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
                ) : (
                  <Search className="h-5 w-5 text-muted-foreground" />
                )}
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search clients, tasks, team, boards..."
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setSelectedIndex(0)
                  }}
                  className="flex-1 bg-transparent text-lg outline-none placeholder:text-muted-foreground"
                />
                <kbd className="hidden sm:inline-flex h-6 items-center gap-1 rounded border bg-muted px-2 text-xs text-muted-foreground">
                  ESC
                </kbd>
              </div>

              {/* Commands List */}
              <div className="max-h-[400px] overflow-y-auto p-2">
                {Object.entries(groupedCommands).length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No commands found</p>
                  </div>
                ) : (
                  Object.entries(groupedCommands).map(([category, commands]) => (
                    <div key={category} className="mb-4">
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {category}
                      </div>
                      {commands.map((cmd) => {
                        const isSelected = flatCommands[selectedIndex]?.id === cmd.id
                        const IconComponent = cmd.icon
                        return (
                          <button
                            key={cmd.id}
                            onClick={() => executeCommand(cmd)}
                            onMouseEnter={() => setSelectedIndex(flatCommands.findIndex(c => c.id === cmd.id))}
                            className={cn(
                              "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all",
                              isSelected
                                ? "bg-brand-orange text-white"
                                : "hover:bg-muted",
                              cmd.type === 'continue' && !isSelected && "bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20"
                            )}
                          >
                            {/* Show avatar for team members, color dot for clients, or icon */}
                            {cmd.avatarUrl ? (
                              <img 
                                src={cmd.avatarUrl} 
                                alt="" 
                                className="h-6 w-6 rounded-full object-cover flex-shrink-0"
                              />
                            ) : cmd.color ? (
                              <div 
                                className="h-5 w-5 rounded-full flex-shrink-0 flex items-center justify-center"
                                style={{ backgroundColor: cmd.color }}
                              >
                                <IconComponent className="h-3 w-3 text-white" />
                              </div>
                            ) : (
                              <IconComponent className={cn(
                                "h-5 w-5 flex-shrink-0", 
                                isSelected ? "text-white" : cmd.type === 'continue' ? "text-green-600" : "text-muted-foreground"
                              )} />
                            )}
                            <div className="flex-1 min-w-0">
                              <span className="font-medium block truncate">{cmd.label}</span>
                              {cmd.sublabel && (
                                <span className={cn(
                                  "text-xs block truncate",
                                  isSelected ? "text-white/80" : "text-muted-foreground"
                                )}>
                                  {cmd.sublabel}
                                </span>
                              )}
                            </div>
                            {cmd.ticketId && (
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "font-mono text-xs flex-shrink-0",
                                  isSelected ? "bg-white/20 text-white border-white/30" : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300"
                                )}
                              >
                                {cmd.ticketId}
                              </Badge>
                            )}
                            {cmd.type === 'continue' && (
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "text-xs flex-shrink-0",
                                  isSelected ? "bg-white/20 text-white border-white/30" : "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300"
                                )}
                              >
                                <Play className="h-3 w-3 mr-1" />
                                Resume
                              </Badge>
                            )}
                            {cmd.shortcut && (
                              <kbd className={cn(
                                "hidden sm:inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-mono",
                                isSelected ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                              )}>
                                {cmd.shortcut}
                              </kbd>
                            )}
                            <ArrowRight className={cn(
                              "h-4 w-4 transition-transform",
                              isSelected ? "text-white translate-x-0" : "text-transparent -translate-x-2"
                            )} />
                          </button>
                        )
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="border-t px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-muted">↑↓</kbd> Navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-muted">↵</kbd> Select
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Command className="h-3 w-3" />
                  <span>K to toggle</span>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
