import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  User, Bell, Shield, Palette, Save, Upload, Camera, Check, 
  Sparkles, Mail, Clock, Calendar, Trophy, X, Loader2,
  Sun, Moon, Monitor, Zap, RefreshCw, Cake, PartyPopper, ImagePlus, Trash2
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useGamification } from '../contexts/GamificationContext'
import { cn, getInitials, formatDate } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Badge } from '../components/ui/badge'
import { Progress } from '../components/ui/progress'
import { useToast } from '../hooks/useToast'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export default function Settings() {
  const { user, profile, loading: authLoading, updateUserProfile, uploadAvatar, justLoggedIn, profileSynced, clearLoginState, refreshProfile } = useAuth()
  const { stats, getRank, getLevelProgress, achievements, syncWithRealData } = useGamification()
  const { toast } = useToast()
  const fileInputRef = useRef(null)
  const bannerInputRef = useRef(null)
  const autosaveTimeoutRef = useRef(null)
  const preferencesSnapshotRef = useRef(null)

  const DEFAULT_NOTIFICATION_PREFS = {
    ticketAssignments: true,
    commentReplies: true,
    achievements: true,
    weeklySummary: false,
  }

  const getStoredTheme = useCallback((userId) => {
    if (!userId) return localStorage.getItem('theme') || 'light'
    return localStorage.getItem(`theme:${userId}`) || localStorage.getItem('theme') || 'light'
  }, [])

  const getStoredNotificationPrefs = useCallback((userId) => {
    if (!userId) return DEFAULT_NOTIFICATION_PREFS
    const raw = localStorage.getItem(`notification_prefs:${userId}`)
    if (!raw) return DEFAULT_NOTIFICATION_PREFS
    try {
      const parsed = JSON.parse(raw)
      return { ...DEFAULT_NOTIFICATION_PREFS, ...parsed }
    } catch {
      return DEFAULT_NOTIFICATION_PREFS
    }
  }, [])

  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [title, setTitle] = useState(profile?.title || '')
  const [tagline, setTagline] = useState(profile?.tagline || '')
  const [birthday, setBirthday] = useState(profile?.birthday || '')
  const [workStartDate, setWorkStartDate] = useState(profile?.work_start_date || '')
  const [showBirthday, setShowBirthday] = useState(profile?.show_birthday ?? true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [bannerUrl, setBannerUrl] = useState(profile?.banner_url || '')
  const [showWelcome, setShowWelcome] = useState(false)
  
  // Theme state
  const [theme, setTheme] = useState(() => getStoredTheme(user?.id))
  const [notificationPrefs, setNotificationPrefs] = useState(() => getStoredNotificationPrefs(user?.id))

  // Autosave state
  const [autosaveEnabled, setAutosaveEnabled] = useState(() => {
    const stored = localStorage.getItem('autosave_enabled')
    return stored === null ? true : stored === 'true'
  })

  // Show welcome toast when profile is synced from Google
  useEffect(() => {
    if (justLoggedIn && profileSynced && profile) {
      setShowWelcome(true)
      toast({
        title: '👋 Welcome!',
        description: `Your profile has been synced from Google. Looking good, ${profile.full_name?.split(' ')[0]}!`,
        variant: 'success',
      })
      
      // Clear the login state after showing
      setTimeout(() => {
        clearLoginState()
        setShowWelcome(false)
      }, 3000)
    }
  }, [justLoggedIn, profileSynced, profile, clearLoginState, toast])

  // Sync profile data when it loads
  useEffect(() => {
    if (profile) {
      console.log('[Settings] Profile loaded:', { 
        id: profile.id, 
        email: profile.email, 
        full_name: profile.full_name 
      })
      setFullName(profile.full_name || '')
      setTitle(profile.title || '')
      setTagline(profile.tagline || '')
      setBirthday(profile.birthday || '')
      setWorkStartDate(profile.work_start_date || '')
      setShowBirthday(profile.show_birthday ?? true)
      setBannerUrl(profile.banner_url || '')
    } else {
      console.log('[Settings] Profile is null/undefined')
    }
  }, [profile])

  // Load user-specific appearance + notification preferences
  useEffect(() => {
    if (!user?.id) return
    const storedTheme = getStoredTheme(user.id)
    const storedNotifications = getStoredNotificationPrefs(user.id)
    setTheme(storedTheme)
    setNotificationPrefs(storedNotifications)
    preferencesSnapshotRef.current = JSON.stringify({
      theme: storedTheme,
      notificationPrefs: storedNotifications,
    })
  }, [user?.id, getStoredTheme, getStoredNotificationPrefs])

  useEffect(() => {
    document.documentElement.classList.remove('dark')
    setTheme('light')
    if (user?.id) localStorage.setItem(`theme:${user.id}`, 'light')
    localStorage.setItem('theme', 'light')
  }, [user?.id])

  // Handle theme change
  const handleThemeChange = (newTheme) => {
    setTheme(newTheme)
    toast({
      title: `🎨 Theme updated`,
      description: `Switched to ${newTheme === 'system' ? 'system' : newTheme} mode`,
    })
  }

  const savePreferences = useCallback(async (prefs) => {
    if (!user?.id) return
    localStorage.setItem(`theme:${user.id}`, prefs.theme)
    localStorage.setItem('theme', prefs.theme)
    localStorage.setItem(`notification_prefs:${user.id}`, JSON.stringify(prefs.notificationPrefs))
  }, [user?.id])

  // Autosave appearance + notification preferences
  useEffect(() => {
    if (!user?.id || !autosaveEnabled) return
    const currentSnapshot = JSON.stringify({ theme, notificationPrefs })

    if (!preferencesSnapshotRef.current) {
      preferencesSnapshotRef.current = currentSnapshot
      return
    }

    if (currentSnapshot === preferencesSnapshotRef.current) return

    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current)
    }

    autosaveTimeoutRef.current = setTimeout(async () => {
      try {
        await savePreferences({ theme, notificationPrefs })
        preferencesSnapshotRef.current = currentSnapshot
        toast({
          title: '✓ Settings saved',
          description: 'Your preferences have been updated.',
          duration: 2000,
        })
      } catch (error) {
        toast({
          title: 'Failed to save settings',
          description: error?.message || 'Please try again.',
          variant: 'destructive',
        })
      }
    }, 1500)

    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current)
      }
    }
  }, [theme, notificationPrefs, autosaveEnabled, user?.id, savePreferences, toast])

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      // Build update object with only changed/valid fields
      const updates = {}
      
      if (fullName && fullName !== profile?.full_name) {
        updates.full_name = fullName
      }
      
      // Only include optional fields if they have values or are being cleared
      if (title !== undefined) {
        updates.title = title || null
      }
      
      if (tagline !== undefined) {
        updates.tagline = tagline || null
      }
      
      if (birthday !== undefined) {
        updates.birthday = birthday || null
      }
      
      if (workStartDate !== undefined) {
        updates.work_start_date = workStartDate || null
      }
      
      if (showBirthday !== undefined) {
        updates.show_birthday = showBirthday
      }

      // If nothing to update
      if (Object.keys(updates).length === 0) {
        toast({
          title: 'No changes',
          description: 'Nothing to save.',
        })
        setSaving(false)
        return
      }

      const { error } = await updateUserProfile(updates)
      
      if (error) {
        console.error('Profile update error:', error)
        throw error
      }

      toast({
        title: '✅ Profile updated!',
        description: 'Your changes have been saved successfully.',
        variant: 'success',
      })
    } catch (error) {
      console.error('Save profile error:', error)
      
      // Check if it's a column not found error
      const errorMessage = error?.message || 'Unknown error'
      
      if (errorMessage.includes('column') || errorMessage.includes('undefined')) {
        toast({
          title: '⚠️ Database needs update',
          description: 'Run supabase/profiles-update.sql to add new columns.',
          variant: 'destructive',
        })
      } else {
        toast({
          title: '❌ Failed to save',
          description: errorMessage,
          variant: 'destructive',
        })
      }
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleBannerClick = () => {
    bannerInputRef.current?.click()
  }

  const handleBannerChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file',
        description: 'Please select an image file.',
        variant: 'destructive',
      })
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please select an image under 50MB.',
        variant: 'destructive',
      })
      return
    }

    setUploadingBanner(true)
    try {
      // Upload to Supabase storage
      const { supabase } = await import('../lib/supabase')
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}-banner-${Date.now()}.${fileExt}`
      const filePath = `banners/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(filePath)

      // Update profile with new banner URL
      const { error: updateError } = await updateUserProfile({ banner_url: publicUrl })
      if (updateError) throw updateError

      setBannerUrl(publicUrl)
      toast({
        title: '🎨 Banner updated!',
        description: 'Your profile banner looks amazing!',
        variant: 'success',
      })
    } catch (error) {
      console.error('Banner upload error:', error)
      toast({
        title: 'Upload failed',
        description: 'Could not upload your banner. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setUploadingBanner(false)
    }
  }

  const handleRemoveBanner = async () => {
    try {
      const { error } = await updateUserProfile({ banner_url: null })
      if (error) throw error

      setBannerUrl('')
      toast({
        title: 'Banner removed',
        description: 'Your profile now uses the default gradient.',
      })
    } catch (error) {
      toast({
        title: 'Failed to remove banner',
        description: 'Please try again.',
        variant: 'destructive',
      })
    }
  }

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file',
        description: 'Please select an image file.',
        variant: 'destructive',
      })
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please select an image under 50MB.',
        variant: 'destructive',
      })
      return
    }

    setUploadingAvatar(true)
    try {
      const { error, url } = await uploadAvatar(file)
      if (error) throw error

      toast({
        title: '📸 Avatar updated!',
        description: 'Your new profile picture looks great!',
        variant: 'success',
      })
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: 'Could not upload your avatar. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setUploadingAvatar(false)
    }
  }

  const rank = getRank(stats?.level || 1)
  const progress = getLevelProgress(stats?.xp || 0)
  const unlockedAchievements = stats?.achievements?.length || 0
  const totalAchievements = achievements?.length || 1 // Prevent division by zero
  const achievementProgress = totalAchievements > 0 ? (unlockedAchievements / totalAchievements) * 100 : 0

  // Show loading state if auth is still loading
  if (authLoading) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-brand-orange" />
          <p className="text-muted-foreground">Loading your profile...</p>
        </div>
      </div>
    )
  }

  // Show prompt to refresh if profile is missing data
  if (!profile?.full_name && !authLoading) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center">
            <RefreshCw className="h-8 w-8 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold">Profile Not Loaded</h2>
          <p className="text-muted-foreground max-w-md">
            Your profile data didn't load properly. This can happen after being idle. 
            Try refreshing, or your profile may need to be synced.
          </p>
          <div className="flex gap-3">
            <Button onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Page
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/login'}>
              Re-login
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
      className="p-4 sm:p-6 max-w-4xl mx-auto"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="mb-8">
        <h1 className="text-3xl font-display font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account and preferences
        </p>
      </motion.div>

      {/* Profile Synced Banner */}
      <AnimatePresence>
        {showWelcome && profile && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="mb-6"
          >
            <Card className="bg-gradient-to-r from-green-500/10 to-emerald-500/5 border-green-500/30">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-green-700 dark:text-green-400">
                    Profile synced from Google!
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Your name and picture have been imported. You can update them anytime.
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowWelcome(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">
            <User className="mr-2 h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="stats">
            <Trophy className="mr-2 h-4 w-4" />
            Stats
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="mr-2 h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <Palette className="mr-2 h-4 w-4" />
            Appearance
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <motion.div variants={itemVariants} className="space-y-6">
            {/* Profile Card */}
            <Card className="overflow-hidden">
              {/* Header Banner - Editable */}
              <div 
                className="h-32 md:h-40 relative group cursor-pointer"
                onClick={handleBannerClick}
                style={{
                  background: bannerUrl 
                    ? `url(${bannerUrl}) center/cover no-repeat`
                    : 'linear-gradient(135deg, #F7931E 0%, #E8614D 50%, #8B5CF6 100%)'
                }}
              >
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 text-white">
                    {uploadingBanner ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <>
                        <ImagePlus className="h-6 w-6" />
                        <span className="font-medium">{bannerUrl ? 'Change' : 'Add'} Banner</span>
                      </>
                    )}
                  </div>
                </div>
                {/* Remove banner button */}
                {bannerUrl && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemoveBanner(); }}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    title="Remove banner"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleBannerChange}
                  className="hidden"
                />
              </div>
              
              <CardContent className="relative pt-0 pb-6 px-6">
                {/* Avatar Section */}
                <div className="flex flex-col sm:flex-row items-start gap-6">
                  <div className="-mt-12 relative group">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleAvatarClick}
                      className="relative cursor-pointer"
                    >
                      <Avatar className="h-28 w-28 border-4 border-background shadow-xl">
                        <AvatarImage src={profile?.avatar_url} />
                        <AvatarFallback className="text-3xl bg-brand-orange text-white">
                          {getInitials(profile?.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      
                      {/* Upload Overlay */}
                      <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        {uploadingAvatar ? (
                          <Loader2 className="h-8 w-8 text-white animate-spin" />
                        ) : (
                          <Camera className="h-8 w-8 text-white" />
                        )}
                      </div>
                      
                      {/* Online indicator */}
                      <div className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 border-2 border-background rounded-full" />
                    </motion.div>
                    <p className="text-xs text-center text-muted-foreground mt-2">
                      Click to change
                    </p>
                  </div>

                  <div className="flex-1 pt-2 sm:pt-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-2xl font-bold">{profile?.full_name || 'Your Name'}</h2>
                        {profile?.title && (
                          <p className="text-sm text-muted-foreground font-medium mt-0.5">
                            {profile.title}
                          </p>
                        )}
                        {profile?.tagline && (
                          <p className="text-sm text-muted-foreground italic mt-0.5">
                            "{profile.tagline}"
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">{profile?.email}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-3">
                          <Badge 
                            className="capitalize"
                            style={{ backgroundColor: rank?.color || '#F7931E' }}
                          >
                            {rank?.title || 'Rookie'} • Level {stats?.level || 1}
                          </Badge>
                          <Badge variant="outline" className="capitalize">
                            {profile?.role || 'team'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Edit Profile Form */}
            <Card>
              <CardHeader>
                <CardTitle>Edit Profile</CardTitle>
                <CardDescription>
                  Update your personal information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter your full name"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <div className="relative mt-1.5">
                      <Input
                        id="email"
                        value={profile?.email || ''}
                        disabled
                        className="pr-10"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Check className="h-4 w-4 text-green-500" />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Verified via Google
                    </p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="title">Job Title / Position 💼</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Creative Director, Senior Developer, Account Manager"
                    className="mt-1.5"
                    maxLength={100}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Your role at Brandastic - shown on your team profile
                  </p>
                </div>

                <div>
                  <Label htmlFor="tagline">Tagline / Fun Quote ✨</Label>
                  <Input
                    id="tagline"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder="e.g., Coffee-powered marketing wizard ☕"
                    className="mt-1.5"
                    maxLength={100}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    A fun line that shows up on your profile ({tagline.length}/100)
                  </p>
                </div>

                {/* Birthday & Anniversary Section */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-orange-500/10 border border-pink-500/20 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <PartyPopper className="h-5 w-5 text-pink-500" />
                    <h3 className="font-semibold">Celebrations 🎉</h3>
                  </div>
                  
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="birthday" className="flex items-center gap-2">
                        <Cake className="h-4 w-4 text-pink-500" />
                        Your Birthday
                      </Label>
                      <Input
                        id="birthday"
                        type="date"
                        value={birthday}
                        onChange={(e) => setBirthday(e.target.value)}
                        className="mt-1.5"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="workStartDate" className="flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-orange-500" />
                        Started at Brandastic
                      </Label>
                      <Input
                        id="workStartDate"
                        type="date"
                        value={workStartDate}
                        onChange={(e) => setWorkStartDate(e.target.value)}
                        className="mt-1.5"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <input
                      type="checkbox"
                      id="showBirthday"
                      checked={showBirthday}
                      onChange={(e) => setShowBirthday(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-pink-500 focus:ring-pink-500"
                    />
                    <label htmlFor="showBirthday" className="text-sm text-muted-foreground">
                      Show my birthday to the team (we'll celebrate! 🎂)
                    </label>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                  <div className="w-10 h-10 rounded-lg bg-brand-blue/10 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-brand-blue" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Member since</p>
                    <p className="text-xs text-muted-foreground">
                      {profile?.created_at ? formatDate(profile.created_at) : 'Recently joined'}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button 
                    onClick={handleSaveProfile} 
                    disabled={saving}
                    className="min-w-[140px]"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Stats Tab */}
        <TabsContent value="stats">
          <motion.div variants={itemVariants} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Your Stats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Level Progress */}
                  <div className="p-4 rounded-xl bg-gradient-to-br from-brand-orange/10 to-brand-coral/5 border border-brand-orange/20">
                    <div className="flex items-center gap-4 mb-4">
                      <div 
                        className="w-16 h-16 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg"
                        style={{ backgroundColor: rank?.color || '#F7931E' }}
                      >
                        {stats?.level || 1}
                      </div>
                      <div>
                        <p className="font-bold text-lg">{rank?.title || 'Rookie'}</p>
                        <p className="text-sm text-muted-foreground">
                          {(stats?.xp || 0).toLocaleString()} XP Total
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Progress to Level {(stats?.level || 1) + 1}</span>
                        <span className="font-medium">{Math.round(progress)}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>
                  </div>

                  {/* Achievements */}
                  <div className="p-4 rounded-xl bg-gradient-to-br from-yellow-500/10 to-orange-500/5 border border-yellow-500/20">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold">Achievements</h4>
                      <Badge variant="outline">
                        {unlockedAchievements}/{totalAchievements}
                      </Badge>
                    </div>
                    <Progress 
                      value={achievementProgress} 
                      className="h-2 mb-4" 
                    />
                    <div className="flex flex-wrap gap-2">
                      {stats?.achievements?.slice(0, 6).map((achId) => {
                        const ach = achievements?.find(a => a.id === achId)
                        if (!ach) return null
                        return (
                          <div
                            key={achId}
                            className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center"
                            title={ach.name}
                          >
                            <ach.icon className="h-4 w-4 text-white" />
                          </div>
                        )
                      })}
                      {unlockedAchievements > 6 && (
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-xs font-medium">
                          +{unlockedAchievements - 6}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-4 mt-6">
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-3xl font-bold">{stats?.ticketsCompleted || 0}</p>
                    <p className="text-sm text-muted-foreground">Tickets Completed</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-3xl font-bold">{Math.round(stats?.hoursLogged || 0)}</p>
                    <p className="text-sm text-muted-foreground">Hours Logged</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-3xl font-bold">{stats?.currentStreak || 0}</p>
                    <p className="text-sm text-muted-foreground">Day Streak 🔥</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>
                  Choose what notifications you want to receive
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { 
                      key: 'ticketAssignments',
                      label: 'Email notifications for new tickets', 
                      desc: 'Get notified when tickets are assigned to you',
                    },
                    { 
                      key: 'commentReplies',
                      label: 'Email notifications for comments', 
                      desc: 'Get notified when someone comments on your tickets',
                    },
                    { 
                      key: 'achievements',
                      label: 'Achievement notifications', 
                      desc: 'Get notified when you unlock new achievements',
                    },
                    { 
                      key: 'weeklySummary',
                      label: 'Weekly summary', 
                      desc: 'Receive a weekly summary of your activity',
                    },
                  ].map((item, index) => (
                    <div key={index} className="flex items-start justify-between p-4 rounded-lg border">
                      <div>
                        <p className="font-medium text-sm">{item.label}</p>
                        <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={!!notificationPrefs[item.key]}
                          onChange={(e) => {
                            const checked = e.target.checked
                            setNotificationPrefs(prev => ({
                              ...prev,
                              [item.key]: checked,
                            }))
                          }}
                        />
                        <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-orange"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance">
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>
                  Customize how Brandastic PM looks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <Label className="mb-3 block">Theme</Label>
                    <p className="text-sm text-muted-foreground">Light mode only for now.</p>
                  </div>

                  {/* Autosave Toggle */}
                  <div className="pt-4 border-t">
                    <Label className="mb-3 block">Autosave</Label>
                    <div className="flex items-center justify-between p-4 rounded-xl border">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-2 rounded-lg transition-colors",
                          autosaveEnabled ? "bg-green-500/10" : "bg-muted"
                        )}>
                          <RefreshCw className={cn(
                            "h-5 w-5",
                            autosaveEnabled ? "text-green-500" : "text-muted-foreground"
                          )} />
                        </div>
                        <div>
                          <p className="font-medium">Auto-save changes</p>
                          <p className="text-sm text-muted-foreground">
                            Automatically save your work as you type
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={autosaveEnabled}
                        onClick={() => {
                          const newValue = !autosaveEnabled
                          setAutosaveEnabled(newValue)
                          localStorage.setItem('autosave_enabled', String(newValue))
                          toast({
                            title: newValue ? '🔄 Autosave enabled' : '⏸️ Autosave disabled',
                            description: newValue 
                              ? 'Your changes will be saved automatically' 
                              : 'Remember to save your changes manually',
                          })
                        }}
                        className={cn(
                          "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-orange focus:ring-offset-2",
                          autosaveEnabled ? "bg-green-500" : "bg-gray-200 dark:bg-gray-700"
                        )}
                      >
                        <span
                          className={cn(
                            "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                            autosaveEnabled ? "translate-x-5" : "translate-x-0"
                          )}
                        />
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {autosaveEnabled 
                        ? '✓ Changes save automatically after 1.5 seconds of inactivity' 
                        : '⚠️ Don\'t forget to manually save your work'}
                    </p>
                  </div>

                  {/* Clear Cache */}
                  <div className="p-4 rounded-lg bg-muted/50 border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-red-500/10">
                          <Trash2 className="h-5 w-5 text-red-500" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">Clear Cache & Reload</p>
                          <p className="text-xs text-muted-foreground">
                            Fix display issues by clearing local data
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-500 border-red-200 hover:bg-red-50 dark:border-red-500/30 dark:hover:bg-red-500/10"
                        onClick={() => {
                          // Preserve essential data
                          const preserveKeys = ['theme', 'brandastic-auth']
                          const preserved = {}
                          preserveKeys.forEach(key => {
                            const value = localStorage.getItem(key)
                            if (value) preserved[key] = value
                          })
                          // Also preserve user-specific theme
                          for (let i = 0; i < localStorage.length; i++) {
                            const key = localStorage.key(i)
                            if (key?.startsWith('theme:')) {
                              preserved[key] = localStorage.getItem(key)
                            }
                          }
                          localStorage.clear()
                          Object.entries(preserved).forEach(([key, value]) => {
                            localStorage.setItem(key, value)
                          })
                          toast({
                            title: '🧹 Cache cleared!',
                            description: 'Reloading page...',
                          })
                          setTimeout(() => window.location.reload(), 500)
                        }}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Clear & Reload
                      </Button>
                    </div>
                  </div>

                  {/* Keyboard Shortcut hint */}
                  <div className="p-4 rounded-lg bg-muted/50 border">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-brand-orange/10">
                        <Palette className="h-5 w-5 text-brand-orange" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Quick Toggle</p>
                        <p className="text-xs text-muted-foreground">
                          Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">⌘</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">⇧</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">D</kbd> to toggle dark mode
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}
