import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Play, Square, Clock, X, Minimize2, ChevronDown, 
  Building2, FileText, Check, Zap, Search, Ticket, Loader2,
  ArrowUp, ArrowDown, CornerDownLeft
} from 'lucide-react'
import { supabase, createManualTimeEntry } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useGamification } from '../contexts/GamificationContext'
import { cn } from '../lib/utils'
import { DEFAULT_TIME_CHANNEL, TIME_CHANNELS, normalizeTimeChannel } from '../lib/timeChannels'
import { useToast } from '../hooks/useToast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog'
import { Button } from './ui/button'

// Format seconds to HH:MM:SS
function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// Fuzzy search scoring - handles partial matches, out of order words, typos
function fuzzySearch(query, text) {
  if (!query || !text) return { match: false, score: 0, ranges: [] }
  
  const q = query.toLowerCase().trim()
  const t = text.toLowerCase()
  
  // Exact match (highest priority)
  if (t === q) return { match: true, score: 100, ranges: [[0, t.length]] }
  
  // Starts with query
  if (t.startsWith(q)) return { match: true, score: 90, ranges: [[0, q.length]] }
  
  // Contains exact query
  const exactIndex = t.indexOf(q)
  if (exactIndex !== -1) {
    return { match: true, score: 80, ranges: [[exactIndex, exactIndex + q.length]] }
  }
  
  // Word matching - all query words must be present
  const queryWords = q.split(/\s+/).filter(w => w.length > 0)
  const textWords = t.split(/\s+/)
  const ranges = []
  let allFound = true
  let score = 70
  
  for (const qWord of queryWords) {
    let found = false
    let currentIdx = 0
    
    for (const tWord of textWords) {
      const wordStart = t.indexOf(tWord, currentIdx)
      
      // Exact word match
      if (tWord === qWord) {
        ranges.push([wordStart, wordStart + tWord.length])
        found = true
        score += 5
        break
      }
      
      // Word starts with query word
      if (tWord.startsWith(qWord)) {
        ranges.push([wordStart, wordStart + qWord.length])
        found = true
        score += 3
        break
      }
      
      // Word contains query word
      const idx = tWord.indexOf(qWord)
      if (idx !== -1) {
        ranges.push([wordStart + idx, wordStart + idx + qWord.length])
        found = true
        score += 1
        break
      }
      
      currentIdx = wordStart + tWord.length
    }
    
    if (!found) {
      allFound = false
      break
    }
  }
  
  if (allFound && ranges.length > 0) {
    return { match: true, score, ranges }
  }
  
  // Fuzzy character matching for typo tolerance
  let qi = 0
  let ti = 0
  const fuzzyRanges = []
  let rangeStart = -1
  
  while (qi < q.length && ti < t.length) {
    if (q[qi] === t[ti]) {
      if (rangeStart === -1) rangeStart = ti
      qi++
    } else {
      if (rangeStart !== -1) {
        fuzzyRanges.push([rangeStart, ti])
        rangeStart = -1
      }
    }
    ti++
  }
  
  if (rangeStart !== -1) {
    fuzzyRanges.push([rangeStart, ti])
  }
  
  if (qi === q.length) {
    // All query characters found in order
    const fuzzyScore = 30 + Math.floor((q.length / t.length) * 20)
    return { match: true, score: fuzzyScore, ranges: fuzzyRanges }
  }
  
  return { match: false, score: 0, ranges: [] }
}

// Highlight matched text
function HighlightedText({ text, ranges, className }) {
  if (!ranges || ranges.length === 0) {
    return <span className={className}>{text}</span>
  }
  
  // Sort and merge overlapping ranges
  const sortedRanges = [...ranges].sort((a, b) => a[0] - b[0])
  const mergedRanges = []
  
  for (const range of sortedRanges) {
    const last = mergedRanges[mergedRanges.length - 1]
    if (last && range[0] <= last[1]) {
      last[1] = Math.max(last[1], range[1])
    } else {
      mergedRanges.push([...range])
    }
  }
  
  const parts = []
  let lastEnd = 0
  
  for (const [start, end] of mergedRanges) {
    if (start > lastEnd) {
      parts.push(<span key={`text-${lastEnd}`}>{text.slice(lastEnd, start)}</span>)
    }
    parts.push(
      <span key={`match-${start}`} className="bg-brand-orange/30 text-brand-orange font-semibold rounded px-0.5">
        {text.slice(start, end)}
      </span>
    )
    lastEnd = end
  }
  
  if (lastEnd < text.length) {
    parts.push(<span key={`text-${lastEnd}`}>{text.slice(lastEnd)}</span>)
  }
  
  return <span className={className}>{parts}</span>
}

export default function FloatingTimer({ 
  isVisible,
  onClose,
  initialClient = null,
  initialDescription = ''
}) {
  const { user } = useAuth()
  const { toast } = useToast()
  const { trackTimeLogged } = useGamification()
  
  const [isRunning, setIsRunning] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [startTime, setStartTime] = useState(null)
  const [minimized, setMinimized] = useState(false)
  
  // Form state
  const [description, setDescription] = useState('')
  const [selectedClient, setSelectedClient] = useState(null)
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [showPicker, setShowPicker] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isBillable, setIsBillable] = useState(true)
  const [selectedChannel, setSelectedChannel] = useState(DEFAULT_TIME_CHANNEL)
  
  // Step-based selection: 'client' or 'task'
  const [selectionStep, setSelectionStep] = useState('client')
  const [showNewTaskInput, setShowNewTaskInput] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [creatingTask, setCreatingTask] = useState(false)
  const [conflictOpen, setConflictOpen] = useState(false)
  const [pendingStart, setPendingStart] = useState(null)
  
  // Data
  const [clients, setClients] = useState([])
  const [tickets, setTickets] = useState([])
  const [recentItems, setRecentItems] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  
  // Keyboard navigation
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  
  const inputRef = useRef(null)
  const searchInputRef = useRef(null)
  const listRef = useRef(null)

  // Load clients, tickets, and recent selections
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      try {
        const { data: clientsData, error: clientsError } = await supabase
          .from('clients')
          .select('id, name, color, monthly_hours')
          .eq('is_active', true)
          .order('name')
        if (clientsError) console.error('Error loading clients:', clientsError)
        else setClients(clientsData || [])
        
        // Load tickets/projects for deeper search
        const { data: ticketsData, error: ticketsError } = await supabase
          .from('tickets')
          .select(`
            id, title, ticket_id, client_id,
            boards (id, name, client_id, clients (id, name, color))
          `)
          .order('updated_at', { ascending: false })
          .limit(500)
        
        if (ticketsError) console.error('Error loading tickets:', ticketsError)
        else setTickets(ticketsData || [])
        
        // Load recent items from localStorage
        const recent = JSON.parse(localStorage.getItem('recentTimerItems') || '[]')
        setRecentItems(recent.slice(0, 5))
        
      } catch (err) {
        console.error('Exception loading data:', err)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  // Get tasks for selected client (match by ticket.client_id or board's client)
  const clientTasks = useMemo(() => {
    if (!selectedClient) return []
    return tickets.filter(ticket => {
      const ticketClientId = ticket.client_id || ticket.boards?.clients?.id || ticket.boards?.client_id
      return ticketClientId === selectedClient.id
    })
  }, [selectedClient, tickets])

  // Looks like a task ID (e.g. BRA-17, ABC123, PROJ-42)
  const looksLikeTaskId = useMemo(() => {
    const q = (searchQuery || '').trim().toUpperCase()
    if (!q || q.length < 2) return false
    return /^[A-Z0-9]+-?\d*$/.test(q) || /^[A-Z]+\d+$/i.test(q)
  }, [searchQuery])

  // Combine and filter search results based on current step
  const searchResults = useMemo(() => {
    const results = []
    
    if (selectionStep === 'client') {
      // Step 1: Show clients only
      const clientsToSearch = searchQuery.trim() ? clients : clients.slice(0, 10)
      
      for (const client of clientsToSearch) {
        if (searchQuery.trim()) {
          const { match, score, ranges } = fuzzySearch(searchQuery, client.name)
          if (match) {
            results.push({
              type: 'client',
              id: client.id,
              name: client.name,
              color: client.color,
              score,
              ranges,
              data: client
            })
          }
        } else {
          results.push({
            type: 'client',
            id: client.id,
            name: client.name,
            color: client.color,
            score: 50,
            ranges: [],
            data: client
          })
        }
      }
    } else if (selectionStep === 'task') {
      const q = (searchQuery || '').trim()
      const queryLower = q.toLowerCase()

      // Task ID search: search ALL tickets by ticket_id (exact or starts-with) so user can jump to any task
      if (looksLikeTaskId && q) {
        for (const ticket of tickets) {
          const tid = (ticket.ticket_id || '').toLowerCase()
          const exactMatch = tid === queryLower
          const startsWith = tid.startsWith(queryLower)
          if (exactMatch || startsWith) {
            const clientFromTicket = ticket.boards?.clients || clients.find(c => c.id === ticket.client_id) || selectedClient
            if (!clientFromTicket) continue
            results.push({
              type: 'ticket',
              id: ticket.id,
              name: ticket.title,
              ticket_id: ticket.ticket_id,
              boardName: ticket.boards?.name,
              score: exactMatch ? 120 : 100,
              ranges: [[0, (ticket.ticket_id || '').length]],
              data: { ticket, client: clientFromTicket }
            })
          }
        }
      }

      // Tasks for selected client (by title or ticket_id via fuzzy search)
      if (selectedClient) {
        const tasksToSearch = q ? clientTasks : clientTasks.slice(0, 15)
        for (const ticket of tasksToSearch) {
          if (q) {
            const searchText = [ticket.title, ticket.ticket_id].filter(Boolean).join(' ')
            const ticketIdExact = (ticket.ticket_id || '').toLowerCase() === queryLower
            const { match, score, ranges } = fuzzySearch(searchQuery, searchText)
            const finalScore = ticketIdExact ? Math.max(score, 115) : score
            if (match && !results.some(r => r.type === 'ticket' && r.id === ticket.id)) {
              results.push({
                type: 'ticket',
                id: ticket.id,
                name: ticket.title,
                ticket_id: ticket.ticket_id,
                boardName: ticket.boards?.name,
                score: finalScore,
                ranges,
                data: { ticket, client: selectedClient }
              })
            }
          } else {
            if (!results.some(r => r.type === 'ticket' && r.id === ticket.id)) {
              results.push({
                type: 'ticket',
                id: ticket.id,
                name: ticket.title,
                ticket_id: ticket.ticket_id,
                boardName: ticket.boards?.name,
                score: 50,
                ranges: [],
                data: { ticket, client: selectedClient }
              })
            }
          }
        }
      }
    }
    
    // Sort by score
    return results.sort((a, b) => b.score - a.score).slice(0, 15)
  }, [searchQuery, clients, clientTasks, tickets, selectionStep, selectedClient, looksLikeTaskId])

  // Display items is now just the search results (already handles empty query)
  const displayItems = searchResults

  // Reset highlight when results change
  useEffect(() => {
    setHighlightedIndex(-1)
  }, [searchQuery])

  // Keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (!showPicker) return
    
    const items = displayItems
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex(prev => 
          prev < items.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : items.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && items[highlightedIndex]) {
          selectItem(items[highlightedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setShowPicker(false)
        setSearchQuery('')
        break
      case 'Tab':
        if (items.length > 0) {
          e.preventDefault()
          selectItem(items[0])
        }
        break
    }
  }, [showPicker, displayItems, highlightedIndex])

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex]
      if (item) {
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [highlightedIndex])

  // Select an item (client or ticket) - step-based
  const selectItem = (item) => {
    if (item.type === 'client') {
      // Step 1 complete: client selected, move to step 2
      setSelectedClient(item.data)
      setSelectedTicket(null)
      setDescription('')
      setSearchQuery('')
      setSelectionStep('task') // Move to task selection
      setHighlightedIndex(-1)
      
      toast({
        title: '📁 Client selected',
        description: `Now select or create a task for ${item.name}`
      })
    } else if (item.type === 'ticket') {
      // Step 2 complete: task selected (client may change if task was found by ID search)
      if (item.data.client) setSelectedClient(item.data.client)
      setSelectedTicket(item.data.ticket)
      setDescription(item.data.ticket.title)
      setShowPicker(false)
      setSearchQuery('')
      
      toast({
        title: '🎫 Task selected',
        description: (item.data.ticket?.ticket_id ? `${item.data.ticket.ticket_id}: ` : '') + item.name
      })
    }
    
    // Save to recent
    const newRecent = [
      { 
        type: item.type, 
        id: item.id, 
        name: item.name,
        color: item.color || item.clientColor,
        clientName: item.clientName,
        clientId: item.clientId,
        data: item.data
      },
      ...recentItems.filter(r => !(r.type === item.type && r.id === item.id))
    ].slice(0, 5)
    
    setRecentItems(newRecent)
    localStorage.setItem('recentTimerItems', JSON.stringify(newRecent))
  }
  
  // Create a new task for the selected client
  const handleCreateTask = async () => {
    if (!newTaskTitle.trim() || !selectedClient) return
    
    setCreatingTask(true)
    try {
      // First, check if client has any boards, if not create a default one
      const { data: existingBoards } = await supabase
        .from('boards')
        .select('id, name')
        .eq('client_id', selectedClient.id)
        .eq('is_archived', false)
        .limit(1)
      
      let boardId
      if (existingBoards && existingBoards.length > 0) {
        boardId = existingBoards[0].id
      } else {
        // Create a default board for this client
        const { data: newBoard, error: boardError } = await supabase
          .from('boards')
          .insert({
            name: 'General',
            client_id: selectedClient.id,
            created_by: user.id,
            is_archived: false
          })
          .select()
          .single()
        
        if (boardError) throw boardError
        boardId = newBoard.id
      }
      
      // Create the task
      const { data: newTicket, error: ticketError } = await supabase
        .from('tickets')
        .insert({
          title: newTaskTitle,
          board_id: boardId,
          client_id: selectedClient.id,
          status: 'in_progress',
          priority: 'medium',
          created_by: user.id
        })
        .select()
        .single()
      
      if (ticketError) throw ticketError
      
      // Set the new task as selected
      setSelectedTicket(newTicket)
      setDescription(newTaskTitle)
      setShowNewTaskInput(false)
      setNewTaskTitle('')
      setShowPicker(false)
      
      // Refresh tickets list
      const { data: ticketsData } = await supabase
        .from('tickets')
        .select(`id, title, ticket_id, boards (id, name, client_id, clients (id, name, color))`)
        .order('updated_at', { ascending: false })
        .limit(500)
      if (ticketsData) setTickets(ticketsData)
      
      toast({
        title: '✅ Task created!',
        description: `"${newTaskTitle}" is ready to track`
      })
    } catch (error) {
      console.error('Error creating task:', error)
      toast({
        title: 'Error creating task',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setCreatingTask(false)
    }
  }

  // Apply initial client/description when provided
  useEffect(() => {
    if (initialClient && !isRunning && !selectedClient) {
      setSelectedClient(initialClient)
      // Automatically open task picker when client is pre-selected
      setSelectionStep('task')
      setShowPicker(true)
      // Focus search input after a brief delay
      setTimeout(() => searchInputRef.current?.focus(), 150)
    }
    if (initialDescription && !isRunning) {
      setDescription(initialDescription)
    }
  }, [initialClient, initialDescription, isRunning])

  // Timer tick
  useEffect(() => {
    let interval
    if (isRunning) {
      interval = setInterval(() => {
        setSeconds(s => s + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isRunning])

  // Load saved timer from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('activeTimer')
    if (saved) {
      try {
      const { startTime, description, clientId, ticketId, isBillable, channel } = JSON.parse(saved)
      const elapsed = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000)
      setStartTime(startTime)
      setSeconds(elapsed)
      setDescription(description || '')
      setIsBillable(isBillable !== false)
      setSelectedChannel(normalizeTimeChannel(channel))
      setIsRunning(true)
      
      // Find and set client
      if (clientId) {
        supabase
          .from('clients')
          .select('id, name, color')
          .eq('id', clientId)
          .single()
          .then(({ data }) => {
            if (data) setSelectedClient(data)
          })
        }
      } catch (e) {
        console.warn('Invalid timer data in localStorage, clearing...')
        localStorage.removeItem('activeTimer')
      }
    }
  }, [])

  // Start timer
  const startTimer = () => {
    if (!selectedClient) {
      toast({
        title: 'Select a project first',
        description: 'Search and choose which project you\'re working on',
        variant: 'destructive'
      })
      setShowPicker(true)
      setTimeout(() => searchInputRef.current?.focus(), 100)
      return
    }
    
    const now = new Date().toISOString()
    setStartTime(now)
    setIsRunning(true)
    setSeconds(0)
    
    // Save to localStorage
    localStorage.setItem('activeTimer', JSON.stringify({
      startTime: now,
      description,
      clientId: selectedClient?.id,
      ticketId: selectedTicket?.id,
      isBillable,
      channel: selectedChannel,
    }))
    
    toast({
      title: '⏱️ Timer started!',
      description: `Tracking: ${description || selectedClient.name}`,
      duration: 2500,
    })
  }

  const handleStart = () => {
    if (isRunning) {
      setPendingStart({
        description,
        client: selectedClient,
        ticket: selectedTicket,
        isBillable,
        channel: selectedChannel,
      })
      setConflictOpen(true)
      return
    }
    startTimer()
  }

  // Stop timer and save
  const handleStop = async () => {
    setIsRunning(false)
    localStorage.removeItem('activeTimer')
    
    // Allow any time entry (even under 1 minute) - just need at least 1 second
    if (seconds < 1) {
      toast({
        title: 'Timer not started',
        description: 'Start the timer before stopping',
        variant: 'destructive'
      })
      return
    }

    // Save to database
    try {
      // Validate we have a client
      if (!selectedClient?.id) {
        toast({
          title: 'No client selected',
          description: 'Please select a client before saving time',
          variant: 'destructive'
        })
        return
      }

      // Calculate minutes (can be fractional for sub-minute entries)
      const totalMinutes = Math.max(1, Math.round(seconds / 60)) // Minimum 1 minute for billing purposes
      const endTime = new Date()
      const startTime = new Date(endTime.getTime() - seconds * 1000)
      
      const timeEntry = {
        user_id: user.id,
        client_id: selectedClient.id,
        channel: normalizeTimeChannel(selectedChannel),
        description: description || selectedClient.name || 'No description',
        notes: description || '',
        minutes: totalMinutes,
        date: endTime.toISOString().split('T')[0],
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        is_running: false,
        billable: isBillable,
      }
      
      // Only add ticket_id if we have one
      if (selectedTicket?.id) {
        timeEntry.ticket_id = selectedTicket.id
      }
      
      const { error } = await createManualTimeEntry({
        ...timeEntry,
        duration_seconds: seconds,
      })

      if (error) {
        console.error('Supabase error:', error)
        throw error
      }

      // Format time for display
      const hours = Math.floor(seconds / 3600)
      const mins = Math.floor((seconds % 3600) / 60)
      const secs = seconds % 60
      
      let timeDisplay = ''
      if (hours > 0) timeDisplay += `${hours}h `
      if (mins > 0) timeDisplay += `${mins}m `
      if (hours === 0 && mins === 0) timeDisplay = `${secs}s (rounded to 1m)`
      
      toast({
        title: '✅ Time saved!',
        description: `Logged ${timeDisplay.trim()} for ${selectedClient?.name}`,
        variant: 'success',
        duration: 3500,
      })
      
      // Track for gamification (XP, achievements)
      trackTimeLogged(totalMinutes)
      
      // Reset
      setSeconds(0)
      setDescription('')
      setSelectedTicket(null)
      
    } catch (error) {
      console.error('Error saving time:', error)
      
      // Provide helpful error messages
      let errorMessage = 'Please try again'
      if (error?.message?.includes('violates row-level security')) {
        errorMessage = 'Permission denied. Your profile may need the "team" role.'
      } else if (error?.message?.includes('violates foreign key')) {
        errorMessage = 'Invalid client or project selected.'
      } else if (error?.message) {
        errorMessage = error.message
      }
      
      toast({
        title: 'Error saving time',
        description: errorMessage,
        variant: 'destructive'
      })
    }
  }

  // Discard timer
  const handleDiscard = () => {
    setIsRunning(false)
    setSeconds(0)
    localStorage.removeItem('activeTimer')
    toast({ title: 'Timer discarded' })
  }

  if (!isVisible && !isRunning) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 100, scale: 0.8 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 100, scale: 0.8 }}
        drag
        dragMomentum={false}
        className="fixed z-50 cursor-move bottom-6 right-6 max-sm:bottom-24 max-sm:right-4 max-sm:left-4 max-sm:w-auto"
      >
        <Dialog open={conflictOpen} onOpenChange={setConflictOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Timer already running</DialogTitle>
              <DialogDescription>
                You can only track one task at a time. Do you want to stop the current timer and start this one?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={() => setConflictOpen(false)}>
                Keep current timer
              </Button>
              <Button
                onClick={() => {
                  setConflictOpen(false)
                  setIsRunning(false)
                  localStorage.removeItem('activeTimer')
                  if (pendingStart) {
                    setDescription(pendingStart.description || '')
                    setSelectedClient(pendingStart.client || null)
                    setSelectedTicket(pendingStart.ticket || null)
                    setIsBillable(pendingStart.isBillable !== false)
                    setSelectedChannel(normalizeTimeChannel(pendingStart.channel))
                  }
                  startTimer()
                }}
              >
                Switch timer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {minimized ? (
          // Minimized - floating button
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setMinimized(false)}
            className={cn(
              "relative h-16 w-16 rounded-full shadow-2xl flex items-center justify-center",
              isRunning 
                ? "bg-gradient-to-br from-green-500 to-emerald-600" 
                : "bg-gradient-to-br from-brand-orange to-brand-coral"
            )}
          >
            {isRunning && (
              <motion.div
                className="absolute inset-0 rounded-full bg-green-500"
                animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
            <Clock className="h-7 w-7 text-white relative z-10" />
            {isRunning && (
              <div className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-white text-green-600 text-[10px] font-bold shadow">
                {formatTime(seconds).slice(0, 5)}
              </div>
            )}
          </motion.button>
        ) : (
          // Expanded - Toggl-style widget
          <motion.div
            layout
            className="w-96 max-sm:w-full rounded-2xl shadow-2xl border bg-background overflow-hidden"
          >
            {/* Header */}
            <div className={cn(
              "px-4 py-3 flex items-center justify-between",
              isRunning 
                ? "bg-gradient-to-r from-green-500 to-emerald-600" 
                : "bg-gradient-to-r from-brand-orange to-brand-coral"
            )}>
              <div className="flex items-center gap-2 text-white">
                <Zap className="h-4 w-4" />
                <span className="font-semibold">
                  {isRunning ? 'Tracking...' : 'Start Timer'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setMinimized(true)}
                  className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors"
                >
                  <Minimize2 className="h-4 w-4" />
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* Timer Display */}
              <div className={cn(
                "text-center py-5 rounded-xl font-mono text-4xl font-bold relative overflow-hidden",
                isRunning 
                  ? "bg-green-500/10 text-green-600" 
                  : "bg-muted text-muted-foreground"
              )}>
                {isRunning && (
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-green-500/10 via-green-500/20 to-green-500/10"
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  />
                )}
                <span className="relative z-10">{formatTime(seconds)}</span>
              </div>

              {/* Step Indicator */}
              <div className="flex items-center gap-2 text-xs">
                <div className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-full",
                  selectedClient ? "bg-green-500/10 text-green-600" : "bg-brand-orange/10 text-brand-orange"
                )}>
                  <Building2 className="h-3 w-3" />
                  <span>1. Client</span>
                  {selectedClient && <Check className="h-3 w-3" />}
                </div>
                <ChevronDown className="h-3 w-3 text-muted-foreground rotate-[-90deg]" />
                <div className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-full",
                  !selectedClient && "opacity-40",
                  selectedTicket ? "bg-green-500/10 text-green-600" : selectedClient ? "bg-brand-orange/10 text-brand-orange" : "bg-muted text-muted-foreground"
                )}>
                  <Ticket className="h-3 w-3" />
                  <span>2. Task</span>
                  {selectedTicket && <Check className="h-3 w-3" />}
                </div>
              </div>

              {/* Selection Box */}
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      if (!showPicker) setShowPicker(true)
                    }}
                    onFocus={() => !isRunning && setShowPicker(true)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      selectionStep === 'client'
                        ? "Search clients..."
                        : `Search by task ID (e.g. BRA-17) or name...`
                    }
                    className={cn(
                      "w-full pl-10 pr-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/50 transition-all",
                      isRunning && "opacity-60 cursor-not-allowed",
                      !selectedClient && !isRunning && "border-brand-orange border-dashed bg-brand-orange/5"
                    )}
                    disabled={isRunning}
                  />
                  {isLoading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>

                {/* Selected Items Display */}
                {selectedClient && !showPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 p-3 rounded-xl bg-muted/50 border"
                  >
                    <div className="space-y-2">
                      {/* Client Row */}
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: selectedClient.color || '#F7931E' }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{selectedClient.name}</p>
                        </div>
                        {!isRunning && (
                          <button
                            onClick={() => {
                              setSelectedClient(null)
                              setSelectedTicket(null)
                              setDescription('')
                              setSelectionStep('client')
                              setShowPicker(true)
                              setTimeout(() => searchInputRef.current?.focus(), 100)
                            }}
                            className="text-xs text-brand-orange hover:underline"
                          >
                            Change
                          </button>
                        )}
                      </div>
                      
                      {/* Task Row */}
                      <div className="flex items-center gap-3 pl-7">
                        {selectedTicket ? (
                          <>
                            <Ticket className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <p className="text-sm text-muted-foreground truncate flex-1">
                              {selectedTicket.ticket_id && `${selectedTicket.ticket_id}: `}{selectedTicket.title}
                            </p>
                            {!isRunning && (
                              <button
                                onClick={() => {
                                  setSelectedTicket(null)
                                  setDescription('')
                                  setSelectionStep('task')
                                  setShowPicker(true)
                                  setTimeout(() => searchInputRef.current?.focus(), 100)
                                }}
                                className="text-xs text-brand-orange hover:underline"
                              >
                                Change
                              </button>
                            )}
                          </>
                        ) : (
                          !isRunning && (
                            <button
                              onClick={() => {
                                setSelectionStep('task')
                                setShowPicker(true)
                                setTimeout(() => searchInputRef.current?.focus(), 100)
                              }}
                              className="text-sm text-brand-orange hover:underline flex items-center gap-1"
                            >
                              <Ticket className="h-3 w-3" />
                              Select or create a task
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Autocomplete Dropdown */}
                <AnimatePresence>
                  {showPicker && !isRunning && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: 'auto' }}
                      exit={{ opacity: 0, y: -10, height: 0 }}
                      className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-xl shadow-2xl z-20 overflow-hidden"
                    >
                      {/* Results Header */}
                      <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground font-medium">
                          {selectionStep === 'client' ? (
                            <>📁 Select a Client</>
                          ) : (
                            <>🎫 Select a Task for {selectedClient?.name}</>
                          )}
                        </span>
                        {selectionStep === 'task' && (
                          <button
                            onClick={() => {
                              setSelectionStep('client')
                              setSearchQuery('')
                            }}
                            className="text-[10px] text-brand-orange hover:underline"
                          >
                            ← Back to clients
                          </button>
                        )}
                      </div>

                      {/* Results List */}
                      <div ref={listRef} className="max-h-80 overflow-y-auto">
                        {searchResults.length === 0 ? (
                          <div className="p-6 text-center">
                            {selectionStep === 'client' ? (
                              clients.length === 0 ? (
                                <div className="space-y-2">
                                  <Building2 className="h-8 w-8 mx-auto text-muted-foreground/50" />
                                  <p className="text-sm text-muted-foreground">No clients yet</p>
                                  <p className="text-xs text-muted-foreground">
                                    Go to <strong>Clients</strong> to add some
                                  </p>
                                </div>
                              ) : searchQuery.trim() ? (
                                <div className="space-y-2">
                                  <Search className="h-8 w-8 mx-auto text-muted-foreground/50" />
                                  <p className="text-sm text-muted-foreground">
                                    No clients match "<span className="font-medium">{searchQuery}</span>"
                                  </p>
                                </div>
                              ) : null
                            ) : (
                              // Task step - no tasks found
                              <div className="space-y-3">
                                <Ticket className="h-8 w-8 mx-auto text-muted-foreground/50" />
                                <p className="text-sm text-muted-foreground">
                                  {searchQuery.trim() 
                                    ? `No tasks match "${searchQuery}"` 
                                    : 'No tasks yet for this client'
                                  }
                                </p>
                                <button
                                  onClick={() => setShowNewTaskInput(true)}
                                  className="inline-flex items-center gap-2 px-4 py-2 bg-brand-orange text-white rounded-lg text-sm font-medium hover:bg-brand-orange/90 transition-colors"
                                >
                                  <Zap className="h-4 w-4" />
                                  Create New Task
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          displayItems.map((item, index) => (
                            <motion.button
                              key={`${item.type}-${item.id}`}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.02 }}
                              onClick={() => selectItem(item)}
                              className={cn(
                                "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors",
                                highlightedIndex === index 
                                  ? "bg-brand-orange/10" 
                                  : "hover:bg-muted/50",
                                selectedClient?.id === item.id && item.type === 'client' && "bg-green-500/10"
                              )}
                            >
                              <div className="flex-shrink-0 mt-0.5">
                                {item.type === 'client' ? (
                                  <div 
                                    className="w-4 h-4 rounded-full"
                                    style={{ backgroundColor: item.color || '#F7931E' }}
                                  />
                                ) : (
                                  <div className="w-4 h-4 rounded bg-muted flex items-center justify-center">
                                    <Ticket className="h-2.5 w-2.5 text-muted-foreground" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <HighlightedText 
                                    text={item.name} 
                                    ranges={item.ranges}
                                    className="font-medium truncate"
                                  />
                                  {item.type === 'ticket' && item.ticket_id && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                                      {item.ticket_id}
                                    </span>
                                  )}
                                </div>
                                {item.type === 'ticket' && (
                                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                    <div 
                                      className="w-2 h-2 rounded-full"
                                      style={{ backgroundColor: item.clientColor || '#F7931E' }}
                                    />
                                    {item.clientName}
                                    {item.boardName && <span>• {item.boardName}</span>}
                                  </p>
                                )}
                                {item.type === 'client' && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    Client • {item.data?.monthly_hours || 0}h/month
                                  </p>
                                )}
                              </div>
                              {highlightedIndex === index && (
                                <div className="text-xs text-brand-orange font-medium flex items-center gap-1">
                                  <CornerDownLeft className="h-3 w-3" />
                                </div>
                              )}
                            </motion.button>
                          ))
                        )}
                      </div>

                      {/* Create New Task Option - only in task step */}
                      {selectionStep === 'task' && searchResults.length > 0 && !showNewTaskInput && (
                        <div className="p-2 border-t">
                          <button
                            onClick={() => setShowNewTaskInput(true)}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-brand-orange hover:bg-brand-orange/10 transition-colors"
                          >
                            <Zap className="h-4 w-4" />
                            <span>Create new task...</span>
                          </button>
                        </div>
                      )}
                      
                      {/* New Task Input */}
                      {showNewTaskInput && (
                        <div className="p-3 border-t bg-brand-orange/5">
                          <p className="text-xs font-medium text-brand-orange mb-2">Create new task for {selectedClient?.name}</p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newTaskTitle}
                              onChange={(e) => setNewTaskTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && newTaskTitle.trim()) {
                                  handleCreateTask()
                                } else if (e.key === 'Escape') {
                                  setShowNewTaskInput(false)
                                  setNewTaskTitle('')
                                }
                              }}
                              placeholder="Task name..."
                              className="flex-1 px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
                              autoFocus
                              disabled={creatingTask}
                            />
                            <button
                              onClick={handleCreateTask}
                              disabled={!newTaskTitle.trim() || creatingTask}
                              className="px-3 py-2 bg-brand-orange text-white rounded-lg text-sm font-medium hover:bg-brand-orange/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                              {creatingTask ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              onClick={() => {
                                setShowNewTaskInput(false)
                                setNewTaskTitle('')
                              }}
                              disabled={creatingTask}
                              className="px-2 py-2 text-muted-foreground hover:text-foreground rounded-lg"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {/* Footer */}
                      {!showNewTaskInput && (
                        <div className="p-2 border-t bg-muted/20">
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground px-2">
                            <span>
                              {selectionStep === 'client' 
                                ? `${clients.length} clients` 
                                : `${clientTasks.length} tasks for this client`
                              }
                            </span>
                            <button
                              onClick={() => {
                                setShowPicker(false)
                                setSearchQuery('')
                              }}
                              className="text-brand-orange hover:underline"
                            >
                              Close (Esc)
                            </button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Description - Only show when client selected */}
              {selectedClient && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="relative"
                >
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What are you working on? (optional)"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
                    disabled={isRunning}
                  />
                </motion.div>
              )}

              {/* Channel + Billable */}
              {selectedClient && (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Channel</p>
                    <div className="flex flex-wrap gap-1.5">
                      {TIME_CHANNELS.map((channel) => (
                        <button
                          key={channel.id}
                          type="button"
                          disabled={isRunning}
                          onClick={() => setSelectedChannel(channel.id)}
                          className={cn(
                            "px-2.5 py-1 rounded-full text-xs border transition-colors",
                            selectedChannel === channel.id
                              ? "bg-brand-orange text-white border-brand-orange"
                              : "bg-muted/40 text-muted-foreground border-transparent hover:border-brand-orange/40",
                            isRunning && "opacity-60 cursor-not-allowed"
                          )}
                        >
                          {channel.label}
                        </button>
                      ))}
                    </div>
                  </div>
                <div className="flex items-center justify-between px-1">
                  <span className="text-sm text-muted-foreground">Billable</span>
                  <button
                    onClick={() => !isRunning && setIsBillable(!isBillable)}
                    disabled={isRunning}
                    className={cn(
                      "relative w-12 h-6 rounded-full transition-colors",
                      isBillable ? "bg-green-500" : "bg-muted",
                      isRunning && "opacity-60 cursor-not-allowed"
                    )}
                  >
                    <motion.div
                      animate={{ x: isBillable ? 24 : 2 }}
                      className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
                    />
                  </button>
                </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                {isRunning ? (
                  <>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleDiscard}
                      className="flex-1 h-12 rounded-xl border-2 border-red-500 text-red-500 font-semibold flex items-center justify-center gap-2 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                    >
                      <X className="h-5 w-5" />
                      Discard
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleStop}
                      className="flex-[2] h-12 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-red-500/25"
                    >
                      <Square className="h-5 w-5 fill-current" />
                      Stop & Save
                    </motion.button>
                  </>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleStart}
                    disabled={!selectedClient}
                    className={cn(
                      "flex-1 h-12 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all shadow-lg",
                      selectedClient
                        ? "bg-green-500 hover:bg-green-600 text-white shadow-green-500/25"
                        : "bg-muted text-muted-foreground cursor-not-allowed shadow-none"
                    )}
                  >
                    <Play className="h-5 w-5 fill-current" />
                    {selectedClient ? 'Start Timer' : 'Select a project first'}
                  </motion.button>
                )}
              </div>

              {/* Keyboard shortcuts hint */}
              {!isRunning && !showPicker && (
                <p className="text-center text-xs text-muted-foreground">
                  Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">T</kbd> to toggle timer • 
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono ml-1">/</kbd> to search
                </p>
              )}
            </div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
