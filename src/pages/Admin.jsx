import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  Building2,
  Kanban,
  Clock,
  TrendingUp,
  Shield,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  UserPlus,
  CheckCircle,
  XCircle,
  Mail,
  Calendar,
  ArrowUpRight,
  RefreshCw,
  Download,
  Settings,
  BarChart3,
  AlertTriangle,
  Upload,
  FileJson,
  FileSpreadsheet,
  Loader2,
  Send,
  Copy,
  Eye,
  Zap,
  UserCog,
  ShieldCheck,
  User,
  FileText,
  Camera,
  Bot,
  UserRound,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu'
import { supabase, seedSampleClients, deleteSampleClients } from '../lib/supabase'
import { PAGE_AREAS, hasAreaAccess, savePageAccess } from '../lib/pageAccess'
import { useAuth } from '../contexts/AuthContext'
import { cn, formatDate, getInitials } from '../lib/utils'
import ClientDialog from '../components/ClientDialog'
import { UpcomingCelebrations } from '../components/Celebrations'
import { useToast } from '../hooks/useToast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Badge } from '../components/ui/badge'
import { Progress } from '../components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Skeleton } from '../components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import AnimatedCounter from '../components/AnimatedCounter'
import { DonutChart, BarChart } from '../components/Charts'

// JIRA Import Helpers
const STATUS_MAP = {
  'done': 'done', 'closed': 'done', 'resolved': 'done', 'complete': 'done', 'completed': 'done',
  'in progress': 'inprogress', 'in development': 'inprogress', 'in review': 'inprogress', 'testing': 'inprogress',
  'to do': 'todo', 'todo': 'todo', 'open': 'todo', 'new': 'todo', 'backlog': 'todo',
}

const PRIORITY_MAP = {
  'highest': 'urgent', 'blocker': 'urgent', 'critical': 'urgent',
  'high': 'high', 'medium': 'medium', 'normal': 'medium',
  'low': 'low', 'lowest': 'low', 'trivial': 'low',
}

function mapStatus(jiraStatus) {
  const status = jiraStatus?.toLowerCase()?.trim() || ''
  for (const [key, value] of Object.entries(STATUS_MAP)) {
    if (status.includes(key)) return value
  }
  return 'todo'
}

function mapPriority(jiraPriority) {
  const priority = jiraPriority?.toLowerCase()?.trim() || ''
  for (const [key, value] of Object.entries(PRIORITY_MAP)) {
    if (priority.includes(key)) return value
  }
  return 'medium'
}

function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export default function Admin() {
  const { profile, isAdmin, user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [userStatusFilter, setUserStatusFilter] = useState('all') // 'all', 'active', 'inactive'
  
  // Dialog states
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false)
  const [userToDeactivate, setUserToDeactivate] = useState(null)
  const [clientDialogOpen, setClientDialogOpen] = useState(false)
  const [editingClient, setEditingClient] = useState(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingClient, setDeletingClient] = useState(null)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  
  // Invite form states
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState('team')
  const [inviteSending, setInviteSending] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  
  // JIRA Import states
  const [importFile, setImportFile] = useState(null)
  const [importData, setImportData] = useState(null)
  const [importClient, setImportClient] = useState('')
  const [importBoard, setImportBoard] = useState('')
  const [newBoardName, setNewBoardName] = useState('')
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [boards, setBoards] = useState([])
  
  // Sample data seeding
  const [seeding, setSeeding] = useState(false)
  
  // Data states
  const [users, setUsers] = useState([])
  const [clients, setClients] = useState([])
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalClients: 0,
    totalBoards: 0,
    totalTickets: 0,
    activeUsers: 0,
    hoursThisMonth: 0,
  })

  const [fetchError, setFetchError] = useState(null)

  // Hourly rate editing (user costs)
  const [editingRateUserId, setEditingRateUserId] = useState(null)
  const [rateValue, setRateValue] = useState('')
  const [savingRate, setSavingRate] = useState(false)
  
  // Title editing
  const [editingTitleUserId, setEditingTitleUserId] = useState(null)
  const [titleValue, setTitleValue] = useState('')
  const [savingTitle, setSavingTitle] = useState(false)
  
  // Avatar upload for users
  const [uploadingAvatarUserId, setUploadingAvatarUserId] = useState(null)
  const avatarInputRef = useRef(null)
  const [avatarTargetUserId, setAvatarTargetUserId] = useState(null)

  // Overhead settings (shared across admin + team hub)
  const [monthlyOverhead, setMonthlyOverhead] = useState(() => {
    const saved = localStorage.getItem('company_monthly_overhead')
    return saved ? parseFloat(saved) : 37000
  })
  const [targetBillableHours, setTargetBillableHours] = useState(() => {
    const saved = localStorage.getItem('company_target_billable_hours')
    return saved ? parseFloat(saved) : 745
  })

  const overheadPerHour = targetBillableHours > 0 ? monthlyOverhead / targetBillableHours : 0

  const fetchData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    setFetchError(null)

    // Add timeout to prevent hanging forever
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout - please try again')), 10000)
    )

    try {
      // Fetch all data in parallel with timeout
      const fetchPromise = Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('clients').select('*').order('created_at', { ascending: false }),
        supabase.from('boards').select('*, client:clients(name)').eq('is_archived', false).order('created_at', { ascending: false }),
        supabase.from('boards').select('*', { count: 'exact', head: true }),
        supabase.from('tickets').select('*', { count: 'exact', head: true }),
      ])

      const results = await Promise.race([fetchPromise, timeout])
      const [profilesRes, clientsRes, boardsRes, boardCountRes, ticketCountRes] = results

      // Check for errors in any response
      if (profilesRes.error) throw profilesRes.error
      if (clientsRes.error) throw clientsRes.error
      if (boardsRes.error) throw boardsRes.error

      const profilesData = profilesRes.data || []
      const clientsData = clientsRes.data || []
      const boardsData = boardsRes.data || []
      const boardCount = boardCountRes.count || 0
      const ticketCount = ticketCountRes.count || 0

      setUsers(profilesData)
      setClients(clientsData)
      setBoards(boardsData)
      setStats({
        totalUsers: profilesData.length,
        totalClients: clientsData.length,
        totalBoards: boardCount,
        totalTickets: ticketCount,
        activeUsers: profilesData.filter(u => u.role !== 'client').length,
        hoursThisMonth: clientsData.reduce((sum, c) => sum + (c.monthly_hours || 0), 0),
      })
    } catch (error) {
      console.error('Error fetching admin data:', error)
      setFetchError(error.message || 'Failed to load data')
      toast({
        title: 'Error loading data',
        description: 'Please try refreshing the page.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Wait for auth to be ready before fetching data
  useEffect(() => {
    if (authLoading) {
      console.log('[Admin] Auth still loading, waiting...')
      return
    }
    if (!user) {
      console.log('[Admin] No user after auth loaded')
      setLoading(false)
      return
    }
    console.log('[Admin] Auth ready, fetching data...')
    fetchData()
  }, [authLoading, user?.id])

  // Generate invite link
  const handleInvite = async () => {
    if (!inviteEmail) {
      toast({ title: 'Please enter an email address', variant: 'destructive' })
      return
    }

    setInviteSending(true)
    
    try {
      // For now, we create a magic link URL that the user can share
      // In production, you'd use supabase.auth.admin.inviteUserByEmail()
      const signupUrl = `${window.location.origin}/login?invite=true&email=${encodeURIComponent(inviteEmail)}&role=${inviteRole}`
      setInviteLink(signupUrl)
      
      toast({
        title: '✉️ Invite link generated!',
        description: 'Copy the link and send it to your team member.',
        variant: 'success',
      })
    } catch (error) {
      console.error('Invite error:', error)
      toast({
        title: 'Error',
        description: 'Failed to generate invite link.',
        variant: 'destructive',
      })
    } finally {
      setInviteSending(false)
    }
  }

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink)
    toast({ title: 'Link copied to clipboard!' })
  }

  // Handle file upload for JIRA import
  const handleFileUpload = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportFile(file)
    const reader = new FileReader()

    reader.onload = (e) => {
      const content = e.target?.result
      try {
        let parsed
        
        if (file.name.endsWith('.json')) {
          parsed = JSON.parse(content)
          // Handle JIRA JSON export format
          if (parsed.issues) {
            parsed = parsed.issues.map(issue => ({
              key: issue.key,
              summary: issue.fields?.summary,
              description: issue.fields?.description,
              status: issue.fields?.status?.name,
              priority: issue.fields?.priority?.name,
              labels: issue.fields?.labels || [],
              timeEstimate: issue.fields?.timeoriginalestimate,
            }))
          }
        } else {
          // Parse CSV
          const lines = content.split('\n').filter(l => l.trim())
          const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''))
          parsed = lines.slice(1).map(line => {
            const values = parseCSVLine(line)
            const obj = {}
            headers.forEach((h, i) => {
              obj[h] = values[i] || ''
            })
            return obj
          })
        }

        setImportData(parsed)
        toast({
          title: `📊 ${parsed.length} issues found`,
          description: `Ready to import from ${file.name}`,
        })
      } catch (error) {
        console.error('Parse error:', error)
        toast({
          title: 'Error parsing file',
          description: 'Please check the file format.',
          variant: 'destructive',
        })
      }
    }

    if (file.name.endsWith('.json')) {
      reader.readAsText(file)
    } else {
      reader.readAsText(file)
    }
  }, [toast])

  // Run import
  const handleImport = async () => {
    if (!importData || importData.length === 0) return
    if (!importClient) {
      toast({ title: 'Please select a client', variant: 'destructive' })
      return
    }

    setImporting(true)
    setImportProgress(0)

    try {
      // Get or create board
      let boardId = importBoard
      
      if (!boardId && newBoardName) {
        const { data: newBoard, error } = await supabase
          .from('boards')
          .insert({
            name: newBoardName,
            client_id: importClient,
            created_by: user.id,
          })
          .select()
          .single()
        
        if (error) throw error
        boardId = newBoard.id
      }

      if (!boardId) {
        toast({ title: 'Please select or create a board', variant: 'destructive' })
        setImporting(false)
        return
      }

      // Import tickets
      const total = importData.length
      let imported = 0
      let errors = 0

      for (const issue of importData) {
        try {
          const ticketData = {
            title: issue.summary || issue.title || issue.Summary || 'Untitled',
            description: issue.description || issue.Description || '',
            status: mapStatus(issue.status || issue.Status || 'todo'),
            priority: mapPriority(issue.priority || issue.Priority || 'medium'),
            board_id: boardId,
            client_id: importClient,
            created_by: user.id,
            tags: issue.labels || [],
          }

          const { error } = await supabase.from('tickets').insert(ticketData)
          if (error) throw error
          imported++
        } catch (err) {
          console.error('Ticket import error:', err)
          errors++
        }
        
        setImportProgress(Math.round(((imported + errors) / total) * 100))
      }

      toast({
        title: '🎉 Import complete!',
        description: `Imported ${imported} tasks${errors > 0 ? `, ${errors} failed` : ''}`,
        variant: 'success',
      })

      // Reset
      setImportFile(null)
      setImportData(null)
      setNewBoardName('')
      fetchData(true)
    } catch (error) {
      console.error('Import error:', error)
      toast({
        title: 'Import failed',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setImporting(false)
    }
  }

  const handlePageAccess = async (person, key, on) => {
    const next = { ...(person.page_access || {}), [key]: on }
    const { error } = await savePageAccess(supabase, person.id, next)
    if (error) {
      toast({
        title: 'Could not save access',
        description: error.message?.includes('page_access')
          ? 'Add a page_access JSON column on profiles in Supabase, then try again.'
          : error.message,
        variant: 'destructive',
      })
      return
    }
    setUsers((prev) => prev.map((row) => (row.id === person.id ? { ...row, page_access: next } : row)))
  }

  // Handle changing user role
  const handleChangeUserRole = async (userId, newRole) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)

      if (error) throw error

      toast({
        title: '✅ Role updated!',
        description: `User role changed to ${newRole}`,
        variant: 'success',
      })

      fetchData(true)
    } catch (error) {
      console.error('Error changing role:', error)
      toast({
        title: 'Error',
        description: 'Failed to update user role.',
        variant: 'destructive',
      })
    }
  }

  const handleUpdateHourlyRate = async (userId, newRate) => {
    setSavingRate(true)
    try {
      const rate = parseFloat(newRate)
      const { error } = await supabase
        .from('profiles')
        .update({ hourly_cost: isNaN(rate) ? 0 : rate })
        .eq('id', userId)

      if (error) throw error

      setUsers(prev =>
        prev.map(u => u.id === userId ? { ...u, hourly_cost: isNaN(rate) ? 0 : rate } : u)
      )

      toast({
        title: '✅ Hourly rate updated',
        description: `Set to $${isNaN(rate) ? 0 : rate}/hr`,
        variant: 'success',
      })
      setEditingRateUserId(null)
      setRateValue('')
    } catch (error) {
      console.error('Error updating hourly rate:', error)
      toast({
        title: 'Error updating rate',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setSavingRate(false)
    }
  }
  
  // Save title
  const handleSaveTitle = async (userId, newTitle) => {
    setSavingTitle(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ title: newTitle.trim() || null })
        .eq('id', userId)

      if (error) throw error

      setUsers(prev =>
        prev.map(u => u.id === userId ? { ...u, title: newTitle.trim() || null } : u)
      )

      toast({
        title: '✅ Title updated',
        description: newTitle.trim() ? `Set to "${newTitle.trim()}"` : 'Title cleared',
        variant: 'success',
      })
      setEditingTitleUserId(null)
      setTitleValue('')
    } catch (error) {
      console.error('Error updating title:', error)
      toast({
        title: 'Error updating title',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setSavingTitle(false)
    }
  }

  // Handle avatar upload for a user
  const handleAvatarClick = (userId) => {
    setAvatarTargetUserId(userId)
    avatarInputRef.current?.click()
  }

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !avatarTargetUserId) return

    setUploadingAvatarUserId(avatarTargetUserId)

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${avatarTargetUserId}-${Date.now()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file, { cacheControl: '3600', upsert: true })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(filePath)

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', avatarTargetUserId)

      if (updateError) throw updateError

      // Update local state
      setUsers(prev =>
        prev.map(u => u.id === avatarTargetUserId ? { ...u, avatar_url: publicUrl } : u)
      )

      toast({
        title: '✅ Avatar updated',
        description: 'Profile photo has been changed.',
        variant: 'success',
      })
    } catch (error) {
      console.error('Error uploading avatar:', error)
      toast({
        title: 'Error uploading avatar',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setUploadingAvatarUserId(null)
      setAvatarTargetUserId(null)
      // Reset file input
      if (avatarInputRef.current) {
        avatarInputRef.current.value = ''
      }
    }
  }

  const handleSaveOverhead = () => {
    localStorage.setItem('company_monthly_overhead', String(monthlyOverhead || 0))
    localStorage.setItem('company_target_billable_hours', String(targetBillableHours || 0))
    toast({
      title: '✅ Overhead saved',
      description: `$${(monthlyOverhead || 0).toLocaleString()}/month ÷ ${targetBillableHours || 0} hrs = $${overheadPerHour.toFixed(2)}/hr overhead`,
      variant: 'success',
    })
  }

  // Handle opening edit dialog
  const handleEditClient = (client) => {
    setEditingClient(client)
    setClientDialogOpen(true)
  }

  // Handle opening add dialog
  const handleAddClient = () => {
    setEditingClient(null)
    setClientDialogOpen(true)
  }

  // Handle deactivate client (soft delete)
  const handleDeactivateClient = async () => {
    if (!deletingClient) return
    
    try {
      const { error } = await supabase
        .from('clients')
        .update({ is_active: false })
        .eq('id', deletingClient.id)
      
      if (error) throw error
      
      toast({
        title: 'Client deactivated',
        description: `${deletingClient.name} has been deactivated.`,
        variant: 'success',
      })
      
      setDeleteDialogOpen(false)
      setDeletingClient(null)
      fetchData(true)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to deactivate client.',
        variant: 'destructive',
      })
    }
  }

  // Handle permanent delete client (hard delete - for test clients)
  const handlePermanentDeleteClient = async () => {
    if (!deletingClient) return
    
    try {
      // Delete related data first (due to foreign key constraints)
      // Delete time entries
      await supabase.from('time_entries').delete().eq('client_id', deletingClient.id)
      // Delete tickets (this will cascade to comments)
      await supabase.from('tickets').delete().eq('client_id', deletingClient.id)
      // Delete boards
      await supabase.from('boards').delete().eq('client_id', deletingClient.id)
      // Delete client notes
      await supabase.from('client_notes').delete().eq('client_id', deletingClient.id)
      // Delete activity log entries
      await supabase.from('activity_log').delete().eq('client_id', deletingClient.id)
      // Delete client wins
      await supabase.from('client_wins').delete().eq('client_id', deletingClient.id)
      // Finally delete the client
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', deletingClient.id)
      
      if (error) throw error
      
      toast({
        title: '🗑️ Client permanently deleted',
        description: `${deletingClient.name} and all related data have been removed.`,
        variant: 'success',
      })
      
      setDeleteDialogOpen(false)
      setDeletingClient(null)
      fetchData(true)
    } catch (error) {
      console.error('Delete error:', error)
      toast({
        title: 'Error deleting client',
        description: error.message || 'Failed to delete client. Some related data may still exist.',
        variant: 'destructive',
      })
    }
  }

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = userStatusFilter === 'all' || 
      (userStatusFilter === 'active' && user.is_active !== false) ||
      (userStatusFilter === 'inactive' && user.is_active === false)
    return matchesSearch && matchesStatus
  })
  
  // Deactivate/Reactivate user
  const handleToggleUserStatus = async () => {
    if (!userToDeactivate) return
    
    const newStatus = userToDeactivate.is_active === false ? true : false
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: newStatus })
        .eq('id', userToDeactivate.id)
      
      if (error) throw error
      
      toast({
        title: newStatus ? '✅ User reactivated' : '🚫 User deactivated',
        description: `${userToDeactivate.full_name || userToDeactivate.email} has been ${newStatus ? 'reactivated' : 'deactivated'}.`,
        variant: 'success',
      })
      
      setDeactivateDialogOpen(false)
      setUserToDeactivate(null)
      fetchData(true)
    } catch (error) {
      console.error('Error updating user status:', error)
      toast({
        title: 'Error',
        description: 'Failed to update user status.',
        variant: 'destructive',
      })
    }
  }

  // Toggle AI status
  const handleToggleAiStatus = async (userId, isAi) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_ai: isAi })
        .eq('id', userId)
      
      if (error) throw error
      
      setUsers(prev =>
        prev.map(u => u.id === userId ? { ...u, is_ai: isAi } : u)
      )
      
      toast({
        title: isAi ? '🤖 Marked as AI Agent' : '👤 Marked as Human',
        variant: 'success',
      })
    } catch (error) {
      console.error('Error updating AI status:', error)
      toast({
        title: 'Error updating status',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  // Role distribution for chart
  const roleDistribution = [
    { label: 'Team', value: users.filter(u => u.role === 'team').length },
    { label: 'Admin', value: users.filter(u => u.role === 'admin').length },
    { label: 'Client', value: users.filter(u => u.role === 'client').length },
  ]

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="mb-10">
          <Skeleton className="h-10 w-64 mb-3" />
          <Skeleton className="h-6 w-96" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  // Show error state with retry button
  if (fetchError) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
          <h2 className="text-2xl font-bold mb-2">Failed to Load</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            {fetchError}
          </p>
          <div className="flex gap-3">
            <Button onClick={() => fetchData()} variant="default">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            <Button onClick={() => window.location.reload()} variant="outline">
              Reload Page
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="mb-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-brand-purple/10">
                <Shield className="h-6 w-6 text-brand-purple" />
              </div>
              <h1 className="text-2xl sm:text-4xl font-display font-bold">Admin Dashboard</h1>
            </div>
            <p className="text-sm sm:text-lg text-muted-foreground">
              Manage users, clients, and system settings
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                setSeeding(true)
                try {
                  const results = await seedSampleClients()
                  toast({
                    title: '🌱 Sample data added!',
                    description: `Created ${results.clients.length} clients, ${results.boards.length} boards, ${results.tickets.length} tasks`,
                    variant: 'success',
                  })
                  fetchData(true)
                } catch (error) {
                  toast({
                    title: 'Error seeding data',
                    description: error.message,
                    variant: 'destructive',
                  })
                } finally {
                  setSeeding(false)
                }
              }}
              disabled={seeding}
              className="hidden sm:inline-flex"
            >
              {seeding ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Zap className="h-4 w-4 mr-2" />
              )}
              Add Sample Clients
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchData(true)}
              disabled={refreshing}
            >
              <RefreshCw className={cn("h-4 w-4 sm:mr-2", refreshing && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button size="sm" onClick={() => setInviteDialogOpen(true)}>
              <UserPlus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Invite Team Member</span>
              <span className="sm:hidden">Invite</span>
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        variants={containerVariants}
        className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8"
      >
        <motion.div variants={itemVariants}>
          <Card className="relative overflow-hidden group cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                  <p className="text-4xl font-bold mt-2 group-hover:text-brand-purple transition-colors">
                    {stats.totalUsers}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.activeUsers} team members
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-gradient-to-br from-brand-purple/20 to-purple-500/10 group-hover:scale-110 transition-transform duration-300">
                  <Users className="h-7 w-7 text-brand-purple" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="relative overflow-hidden group cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Clients</p>
                  <p className="text-4xl font-bold mt-2 group-hover:text-brand-orange transition-colors">
                    {stats.totalClients}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Active accounts
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-gradient-to-br from-brand-orange/20 to-brand-coral/10 group-hover:scale-110 transition-transform duration-300">
                  <Building2 className="h-7 w-7 text-brand-orange" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="relative overflow-hidden group cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Boards</p>
                  <p className="text-4xl font-bold mt-2 group-hover:text-brand-blue transition-colors">
                    {stats.totalBoards}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Active projects
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-gradient-to-br from-brand-blue/20 to-cyan-500/10 group-hover:scale-110 transition-transform duration-300">
                  <Kanban className="h-7 w-7 text-brand-blue" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="relative overflow-hidden group cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Tickets</p>
                  <p className="text-4xl font-bold mt-2 group-hover:text-green-500 transition-colors">
                    {stats.totalTickets}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    All time
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 group-hover:scale-110 transition-transform duration-300">
                  <BarChart3 className="h-7 w-7 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Main Content */}
      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="clients" className="gap-2">
            <Building2 className="h-4 w-4" />
            Clients
          </TabsTrigger>
          <TabsTrigger value="import" className="gap-2">
            <Upload className="h-4 w-4" />
            Import
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users">
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">User Management</CardTitle>
                    <CardDescription>Manage all registered users</CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search users..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 rounded-xl"
                      />
                    </div>
                    <Select value={userStatusFilter} onValueChange={setUserStatusFilter}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Users</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left py-3 px-4 text-sm font-medium">User</th>
                        <th className="text-left py-3 px-4 text-sm font-medium">Title</th>
                        <th className="text-left py-3 px-4 text-sm font-medium">Role</th>
                        <th className="text-left py-3 px-4 text-sm font-medium">Access</th>
                        <th className="text-left py-3 px-4 text-sm font-medium">Hourly Rate</th>
                        <th className="text-left py-3 px-4 text-sm font-medium">Status</th>
                        <th className="text-left py-3 px-4 text-sm font-medium">Joined</th>
                        <th className="text-right py-3 px-4 text-sm font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-8 text-muted-foreground">
                            No users found
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((user, index) => (
                          <motion.tr
                            key={user.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="border-t hover:bg-muted/30 transition-colors"
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div 
                                  className="relative group cursor-pointer"
                                  onClick={() => handleAvatarClick(user.id)}
                                >
                                  <Avatar className="h-9 w-9">
                                    <AvatarImage src={user.avatar_url} referrerPolicy="no-referrer" />
                                    <AvatarFallback className="bg-brand-orange/10 text-brand-orange">
                                      {getInitials(user.full_name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  {/* Upload overlay */}
                                  <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    {uploadingAvatarUserId === user.id ? (
                                      <Loader2 className="h-4 w-4 text-white animate-spin" />
                                    ) : (
                                      <Camera className="h-4 w-4 text-white" />
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium">{user.full_name || 'No name'}</p>
                                    <button
                                      onClick={() => handleToggleAiStatus(user.id, !user.is_ai)}
                                      className="transition-transform hover:scale-105"
                                      title="Click to toggle Human/AI Agent"
                                    >
                                      {user.is_ai ? (
                                        <Badge variant="outline" className="text-xs bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/30 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-500/20">
                                          <Bot className="h-3 w-3 mr-1" />
                                          AI Agent
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-500/20">
                                          <UserRound className="h-3 w-3 mr-1" />
                                          Human
                                        </Badge>
                                      )}
                                    </button>
                                  </div>
                                  <p className="text-sm text-muted-foreground">{user.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              {user.role === 'client' ? (
                                <span className="text-sm text-muted-foreground">—</span>
                              ) : (
                                <div className="flex items-center gap-2">
                                  {editingTitleUserId === user.id ? (
                                    <>
                                      <Input
                                        value={titleValue}
                                        onChange={(e) => setTitleValue(e.target.value)}
                                        className="h-8 w-40"
                                        placeholder="e.g. Director of Ops"
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            handleSaveTitle(user.id, titleValue)
                                          } else if (e.key === 'Escape') {
                                            setEditingTitleUserId(null)
                                            setTitleValue('')
                                          }
                                        }}
                                        autoFocus
                                      />
                                      <Button
                                        size="icon-sm"
                                        variant="ghost"
                                        onClick={() => handleSaveTitle(user.id, titleValue)}
                                        disabled={savingTitle}
                                      >
                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                      </Button>
                                      <Button
                                        size="icon-sm"
                                        variant="ghost"
                                        onClick={() => {
                                          setEditingTitleUserId(null)
                                          setTitleValue('')
                                        }}
                                      >
                                        <XCircle className="h-4 w-4 text-muted-foreground" />
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <span className="text-sm">{user.title || '—'}</span>
                                      <Button
                                        size="icon-sm"
                                        variant="ghost"
                                        onClick={() => {
                                          setEditingTitleUserId(user.id)
                                          setTitleValue(user.title || '')
                                        }}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <Badge
                                variant={
                                  user.role === 'admin' ? 'default' :
                                  user.role === 'team' ? 'secondary' :
                                  user.role === 'contractor' ? 'outline' : 'outline'
                                }
                                className={cn(
                                  user.role === 'admin' && "bg-brand-purple text-white",
                                  user.role === 'contractor' && "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-700"
                                )}
                              >
                                {user.role === 'team' ? 'Team (W-2)' : 
                                 user.role === 'contractor' ? '1099' :
                                 user.role === 'admin' ? 'Admin (W-2)' :
                                 user.role}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">
                              {user.role === 'client' ? (
                                <span className="text-sm text-muted-foreground">—</span>
                              ) : (
                                <div className="flex flex-col gap-1.5">
                                  {PAGE_AREAS.map((area) => {
                                    const on = hasAreaAccess({ email: user.email }, user, area.key)
                                    return (
                                      <label key={area.key} className="flex items-center gap-2 text-xs text-slate-700">
                                        <input
                                          type="checkbox"
                                          checked={on}
                                          onChange={(event) => handlePageAccess(user, area.key, event.target.checked)}
                                        />
                                        {area.label}
                                      </label>
                                    )
                                  })}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {user.role === 'client' ? (
                                <span className="text-sm text-muted-foreground">—</span>
                              ) : (
                                <div className="flex items-center gap-2">
                                  {editingRateUserId === user.id ? (
                                    <>
                                      <Input
                                        value={rateValue}
                                        onChange={(e) => setRateValue(e.target.value)}
                                        className="h-8 w-24"
                                        inputMode="decimal"
                                      />
                                      <Button
                                        size="icon-sm"
                                        variant="ghost"
                                        disabled={savingRate}
                                        onClick={() => handleUpdateHourlyRate(user.id, rateValue)}
                                      >
                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                      </Button>
                                      <Button
                                        size="icon-sm"
                                        variant="ghost"
                                        onClick={() => {
                                          setEditingRateUserId(null)
                                          setRateValue('')
                                        }}
                                      >
                                        <XCircle className="h-4 w-4 text-muted-foreground" />
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <span className="text-sm">${user.hourly_cost || 0}/hr</span>
                                      <Button
                                        size="icon-sm"
                                        variant="ghost"
                                        onClick={() => {
                                          setEditingRateUserId(user.id)
                                          setRateValue(String(user.hourly_cost ?? 0))
                                        }}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                {user.is_active === false ? (
                                  <>
                                    <XCircle className="h-4 w-4 text-red-500" />
                                    <span className="text-sm text-red-600">Inactive</span>
                                  </>
                                ) : (
                                  <>
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                    <span className="text-sm text-green-600">Active</span>
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-sm text-muted-foreground">
                              {formatDate(user.created_at)}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon-sm">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuLabel>Change Role</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleChangeUserRole(user.id, 'team')}
                                    disabled={user.role === 'team'}
                                    className="gap-2"
                                  >
                                    <User className="h-4 w-4 text-blue-500" />
                                    <span>Team Member (W-2)</span>
                                    {user.role === 'team' && (
                                      <CheckCircle className="h-3 w-3 ml-auto text-green-500" />
                                    )}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleChangeUserRole(user.id, 'contractor')}
                                    disabled={user.role === 'contractor'}
                                    className="gap-2"
                                  >
                                    <FileText className="h-4 w-4 text-amber-500" />
                                    <span>Contractor (1099)</span>
                                    {user.role === 'contractor' && (
                                      <CheckCircle className="h-3 w-3 ml-auto text-green-500" />
                                    )}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleChangeUserRole(user.id, 'admin')}
                                    disabled={user.role === 'admin'}
                                    className="gap-2"
                                  >
                                    <ShieldCheck className="h-4 w-4 text-brand-purple" />
                                    <span>Admin (W-2)</span>
                                    {user.role === 'admin' && (
                                      <CheckCircle className="h-3 w-3 ml-auto text-green-500" />
                                    )}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleChangeUserRole(user.id, 'client')}
                                    disabled={user.role === 'client'}
                                    className="gap-2"
                                  >
                                    <Building2 className="h-4 w-4 text-brand-orange" />
                                    <span>Client</span>
                                    {user.role === 'client' && (
                                      <CheckCircle className="h-3 w-3 ml-auto text-green-500" />
                                    )}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    className="gap-2"
                                    onClick={() => navigate(`/team/${user.id}`)}
                                  >
                                    <Eye className="h-4 w-4" />
                                    <span>View Profile</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    className={cn("gap-2", user.is_active === false ? "text-green-600" : "text-red-600")}
                                    onClick={() => {
                                      setUserToDeactivate(user)
                                      setDeactivateDialogOpen(true)
                                    }}
                                  >
                                    {user.is_active === false ? (
                                      <>
                                        <CheckCircle className="h-4 w-4" />
                                        <span>Reactivate User</span>
                                      </>
                                    ) : (
                                      <>
                                        <XCircle className="h-4 w-4" />
                                        <span>Deactivate User</span>
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </motion.tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-lg">Overhead Settings</CardTitle>
                <CardDescription>
                  Apply a shared overhead to calculate fully-loaded hourly cost.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3 items-end">
                  <div>
                    <Label htmlFor="monthly-overhead">Monthly Overhead</Label>
                    <Input
                      id="monthly-overhead"
                      type="text"
                      value={monthlyOverhead.toLocaleString()}
                      onChange={(e) => setMonthlyOverhead(parseFloat(e.target.value.replace(/,/g, '')) || 0)}
                      className="mt-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <Label htmlFor="target-hours">Target Billable Hours</Label>
                    <Input
                      id="target-hours"
                      inputMode="decimal"
                      value={targetBillableHours}
                      onChange={(e) => setTargetBillableHours(parseFloat(e.target.value) || 0)}
                      className="mt-1.5"
                    />
                  </div>
                  <div className="rounded-lg border bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Overhead per hour</p>
                    <p className="text-xl font-semibold">${overheadPerHour.toFixed(2)}/hr</p>
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <Button onClick={handleSaveOverhead}>
                    Save Overhead
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Clients Tab */}
        <TabsContent value="clients">
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">Client Management</CardTitle>
                    <CardDescription>Manage all client accounts</CardDescription>
                  </div>
                  <Button size="sm" onClick={handleAddClient}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Client
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {clients.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-muted-foreground">
                      No clients yet
                    </div>
                  ) : (
                    clients.map((client, index) => (
                      <motion.div
                        key={client.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.05 }}
                        className="p-5 rounded-2xl border bg-card hover:shadow-md hover:border-brand-orange/30 transition-all cursor-pointer group"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            {client.logo_url ? (
                              <img
                                src={client.logo_url}
                                alt={client.name}
                                className="w-12 h-12 rounded-xl object-contain bg-white border shadow-lg"
                              />
                            ) : (
                              <div
                                className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg"
                                style={{ backgroundColor: client.color || '#F7931E' }}
                              >
                                {client.name?.charAt(0) || 'C'}
                              </div>
                            )}
                            <div>
                              <h3 className="font-semibold group-hover:text-brand-orange transition-colors">
                                {client.name}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {client.monthly_hours}h/month
                              </p>
                            </div>
                          </div>
                          <Badge variant={client.is_active ? 'default' : 'secondary'}>
                            {client.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            <Mail className="h-3 w-3 inline mr-1" />
                            {client.contact_email || 'No email'}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon-sm"
                              onClick={() => handleEditClient(client)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon-sm"
                              onClick={() => {
                                setDeletingClient(client)
                                setDeleteDialogOpen(true)
                              }}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Import Tab */}
        <TabsContent value="import">
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  JIRA Import
                </CardTitle>
                <CardDescription>
                  Import tickets from JIRA CSV or JSON exports
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* File Upload */}
                <div
                  className={cn(
                    "border-2 border-dashed rounded-2xl p-8 text-center transition-all",
                    importFile 
                      ? "border-green-500 bg-green-500/5" 
                      : "border-muted-foreground/25 hover:border-brand-orange/50 hover:bg-muted/50"
                  )}
                >
                  {importFile ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-center gap-3">
                        {importFile.name.endsWith('.json') ? (
                          <FileJson className="h-10 w-10 text-green-500" />
                        ) : (
                          <FileSpreadsheet className="h-10 w-10 text-green-500" />
                        )}
                        <div className="text-left">
                          <p className="font-medium">{importFile.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {importData?.length || 0} issues found
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setImportFile(null)
                          setImportData(null)
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer block">
                      <input
                        type="file"
                        accept=".csv,.json"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                      <p className="font-medium mb-1">Drop your JIRA export here</p>
                      <p className="text-sm text-muted-foreground">
                        Supports CSV and JSON formats
                      </p>
                    </label>
                  )}
                </div>

                {/* Import Settings */}
                {importData && importData.length > 0 && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Select Client</Label>
                      <Select value={importClient} onValueChange={setImportClient}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a client" />
                        </SelectTrigger>
                        <SelectContent>
                          {clients.filter(c => c.is_active).map(client => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Select or Create Board</Label>
                      <Select 
                        value={importBoard} 
                        onValueChange={(v) => {
                          setImportBoard(v)
                          if (v !== 'new') setNewBoardName('')
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a board" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">+ Create New Board</SelectItem>
                          {boards
                            .filter(b => b.client_id === importClient)
                            .map(board => (
                              <SelectItem key={board.id} value={board.id}>
                                {board.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {importBoard === 'new' && (
                      <div className="space-y-2 md:col-span-2">
                        <Label>New Board Name</Label>
                        <Input
                          value={newBoardName}
                          onChange={(e) => setNewBoardName(e.target.value)}
                          placeholder="e.g., Q1 2024 Tasks"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Preview */}
                {importData && importData.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-medium flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Preview (first 5 issues)
                    </h3>
                    <div className="rounded-xl border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-3">Title</th>
                            <th className="text-left p-3">Status</th>
                            <th className="text-left p-3">Priority</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importData.slice(0, 5).map((issue, i) => (
                            <tr key={i} className="border-t">
                              <td className="p-3 truncate max-w-xs">
                                {issue.summary || issue.title || issue.Summary || 'No title'}
                              </td>
                              <td className="p-3">
                                <Badge variant="outline">
                                  {mapStatus(issue.status || issue.Status)}
                                </Badge>
                              </td>
                              <td className="p-3">
                                <Badge variant="secondary">
                                  {mapPriority(issue.priority || issue.Priority)}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Import Button */}
                {importData && importData.length > 0 && (
                  <div className="flex items-center justify-between pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Ready to import <strong>{importData.length}</strong> tickets
                    </p>
                    <Button 
                      onClick={handleImport}
                      disabled={importing || !importClient || (!importBoard && !newBoardName)}
                      className="gap-2"
                    >
                      {importing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Importing... {importProgress}%
                        </>
                      ) : (
                        <>
                          <Zap className="h-4 w-4" />
                          Start Import
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {importing && (
                  <Progress value={importProgress} className="h-2" />
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <motion.div variants={itemVariants} className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>User Distribution by Role</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center">
                <DonutChart
                  value={stats.activeUsers}
                  total={stats.totalUsers}
                  size={180}
                  strokeWidth={20}
                  label="Team Members"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Monthly Hours by Client</CardTitle>
              </CardHeader>
              <CardContent>
                <BarChart
                  data={clients.slice(0, 6).map(c => ({
                    label: c.name?.substring(0, 8) || 'Client',
                    value: c.monthly_hours || 0
                  }))}
                  height={180}
                />
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="text-center p-4 rounded-xl bg-muted/50">
                    <p className="text-3xl font-bold text-brand-orange">
                      {Math.round(stats.hoursThisMonth)}h
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">Total Monthly Hours</p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-muted/50">
                    <p className="text-3xl font-bold text-brand-blue">
                      {stats.totalBoards}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">Active Boards</p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-muted/50">
                    <p className="text-3xl font-bold text-brand-purple">
                      {users.filter(u => u.role === 'admin').length}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">Admins</p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-muted/50">
                    <p className="text-3xl font-bold text-green-500">
                      {clients.filter(c => c.is_active).length}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">Active Clients</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Upcoming Celebrations - Admin View */}
            <UpcomingCelebrations showAll />
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Client Dialog */}
      <ClientDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
        client={editingClient}
        onSuccess={() => {
          fetchData(true)
          setEditingClient(null)
        }}
      />

      {/* Hidden file input for avatar upload */}
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        onChange={handleAvatarUpload}
        className="hidden"
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Remove Client: {deletingClient?.name}
            </DialogTitle>
            <DialogDescription>
              Choose how you want to handle this client:
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 py-4">
            {/* Deactivate Option */}
            <div 
              className="p-4 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 cursor-pointer hover:border-amber-400 transition-colors"
              onClick={handleDeactivateClient}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <Eye className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-amber-700 dark:text-amber-400">Deactivate (Recommended)</h4>
                  <p className="text-sm text-amber-600/80 dark:text-amber-400/70">Hide from active lists but keep all data. Can be reactivated later.</p>
                </div>
              </div>
            </div>
            
            {/* Permanent Delete Option */}
            <div 
              className="p-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 cursor-pointer hover:border-red-400 transition-colors"
              onClick={handlePermanentDeleteClient}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                  <Trash2 className="h-5 w-5 text-red-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-red-700 dark:text-red-400">Permanently Delete</h4>
                  <p className="text-sm text-red-600/80 dark:text-red-400/70">Remove client and ALL related data forever. Cannot be undone!</p>
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="w-full">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Deactivation Dialog */}
      <Dialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {userToDeactivate?.is_active === false ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Reactivate Team Member
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-500" />
                  Deactivate Team Member
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {userToDeactivate?.is_active === false ? (
                <>
                  Are you sure you want to reactivate <strong>{userToDeactivate?.full_name || userToDeactivate?.email}</strong>?
                  They will be able to log in and access the system again.
                </>
              ) : (
                <>
                  Are you sure you want to deactivate <strong>{userToDeactivate?.full_name || userToDeactivate?.email}</strong>?
                  <br /><br />
                  <span className="text-muted-foreground">
                    • They will no longer be able to log in<br />
                    • All their data, time entries, and activity will be preserved<br />
                    • You can reactivate them at any time
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant={userToDeactivate?.is_active === false ? "default" : "destructive"} 
              onClick={handleToggleUserStatus}
            >
              {userToDeactivate?.is_active === false ? 'Reactivate User' : 'Deactivate User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Team Member Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={(open) => {
        setInviteDialogOpen(open)
        if (!open) {
          setInviteEmail('')
          setInviteName('')
          setInviteRole('team')
          setInviteLink('')
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-brand-orange" />
              Invite Team Member
            </DialogTitle>
            <DialogDescription>
              Send an invite to join your Brandastic PM workspace
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email Address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="colleague@brandastic.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-name">Name (optional)</Label>
              <Input
                id="invite-name"
                placeholder="John Doe"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="team">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Team Member
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Admin
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {inviteRole === 'admin' 
                  ? 'Admins can manage users, clients, and all settings'
                  : 'Team members can view all clients and manage tasks'
                }
              </p>
            </div>

            {inviteLink && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl bg-green-500/10 border border-green-500/30 space-y-3"
              >
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Invite Link Ready!</span>
                </div>
                <div className="flex gap-2">
                  <Input 
                    value={inviteLink} 
                    readOnly 
                    className="text-xs font-mono"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={copyInviteLink}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Share this link with your team member to let them sign up
                </p>
              </motion.div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleInvite}
              disabled={inviteSending || !inviteEmail}
              className="gap-2"
            >
              {inviteSending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : inviteLink ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Link Generated
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Generate Invite Link
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
