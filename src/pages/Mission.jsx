import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Target, Eye, Lightbulb, TrendingUp, Users, DollarSign,
  Sparkles, Edit2, Save, ChevronRight, Rocket, Award,
  BarChart3, Calendar, Zap, Crown, Heart, CheckCircle,
  ArrowUpRight, Settings, X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Badge } from '../components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'
import { Label } from '../components/ui/label'
import { useToast } from '../hooks/useToast'
import AnimatedCounter from '../components/AnimatedCounter'
import { AreaChart } from '../components/Charts'

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: 'spring', damping: 20, stiffness: 300 }
  }
}

// Default mission data
const DEFAULT_MISSION = {
  long_term_vision: "40 private and charter schools on retainer by 2030 — enrollment directors first",
  vision_pillars: [
    { title: "Focus on businesses with over 10M+ in sales", icon: "target" },
    { title: "With contracts that include a holistic presence across all channels", icon: "layers" },
    { title: "With a focus on Annual Retainers", icon: "repeat" },
  ],
  rally_cry: "Focused. Growth.",
  rally_year: "2027",
  core_values: [
    { title: "Ignite Potential", description: "Unlock growth for every team member + brand" },
    { title: "Results Focused", description: "Measure KPI's that matter" },
    { title: "Lifetime Clients", description: "Forge long-term partnerships" },
  ],
  vital_factors: [
    { label: "Revenue", value: "$3M = ARR (6 New Contracts)", icon: "dollar" },
    { label: "Clients", value: "25", icon: "users" },
    { label: "Higher Rates", value: "$175-$195/hr", icon: "trending" },
    { label: "Deals", value: "1/mo", icon: "target" },
    { label: "Net Profit", value: "10% - 20%", icon: "chart" },
  ],
  initiatives: [
    { title: "Grow Rev", description: "Increase Rev by 25% YOY" },
    { title: "Efficiency", description: "Team is working on billable items 80% of the time" },
    { title: "Team", description: "Instill a Growth mindset in our team leading to better client results" },
    { title: "Cash/Margin", description: "Positive bottom line each month" },
    { title: "Management", description: "Leadership is proactive in taking ownership" },
  ],
  revenue_target: 5000000,
  current_revenue: 1800000,
  target_year: 2030,
  start_year: 2026,
  current_clients: 22,
  target_clients: 70,
}

export default function Mission() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [mission, setMission] = useState(DEFAULT_MISSION)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingSection, setEditingSection] = useState(null)
  const [editData, setEditData] = useState({})
  
  // Calculate CAGR
  const years = mission.target_year - mission.start_year
  const cagr = years > 0 
    ? ((Math.pow(mission.revenue_target / mission.current_revenue, 1 / years) - 1) * 100).toFixed(1)
    : 0
  
  // Generate trajectory data
  const trajectoryData = []
  for (let year = mission.start_year; year <= mission.target_year; year++) {
    const yearIndex = year - mission.start_year
    const value = mission.current_revenue * Math.pow(1 + parseFloat(cagr) / 100, yearIndex)
    trajectoryData.push({ label: String(year), value: Math.round(value) })
  }
  
  // Generate yearly roadmap
  const yearlyRoadmap = trajectoryData.map((item, idx) => {
    const prevClients = idx === 0 ? mission.current_clients : Math.round(mission.current_clients + (mission.target_clients - mission.current_clients) * (idx / years))
    const totalClients = Math.round(mission.current_clients + (mission.target_clients - mission.current_clients) * ((idx + 1) / years))
    const newClients = totalClients - prevClients
    
    return {
      year: item.label,
      revenue: item.value,
      totalClients,
      newClients,
      perMonth: (newClients / 12).toFixed(1),
      milestone: idx === years ? `$${(mission.revenue_target / 1000000).toFixed(1)}M Goal!` : 
                 idx === 0 ? '' : 
                 `Reach $${(item.value / 1000000).toFixed(1)}M`
    }
  })
  
  // Average client value
  const avgClientValue = mission.current_revenue / mission.current_clients
  const avgClientMonthly = avgClientValue / 12
  const clientsNeededPerYear = (mission.target_clients - mission.current_clients) / years

  useEffect(() => {
    fetchMission()
  }, [])

  const fetchMission = async () => {
    try {
      const { data, error } = await supabase
        .from('company_mission')
        .select('*')
        .single()
      
      if (data) {
        const next = { ...DEFAULT_MISSION, ...data }
        if (String(next.rally_year) === '2025') next.rally_year = '2027'
        setMission(next)
      }
    } catch (error) {
      console.log('Using default mission data')
    }
    setLoading(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Prepare data for save - ensure proper types
      const saveData = {
        id: 1,
        long_term_vision: mission.long_term_vision,
        vision_pillars: mission.vision_pillars,
        rally_cry: mission.rally_cry,
        rally_year: mission.rally_year,
        core_values: mission.core_values,
        vital_factors: mission.vital_factors,
        initiatives: mission.initiatives,
        revenue_target: Number(mission.revenue_target) || 5000000,
        current_revenue: Number(mission.current_revenue) || 1800000,
        target_year: Number(mission.target_year) || 2030,
        start_year: Number(mission.start_year) || 2026,
        current_clients: Number(mission.current_clients) || 22,
        target_clients: Number(mission.target_clients) || 70,
        updated_at: new Date().toISOString(),
        updated_by: profile?.id
      }
      
      const { error } = await supabase
        .from('company_mission')
        .upsert(saveData, { onConflict: 'id' })
      
      if (error) throw error
      
      toast({ title: '✨ Mission updated!', description: 'Your changes have been saved.', variant: 'success' })
      setEditOpen(false)
    } catch (error) {
      console.error('Save error:', error)
      toast({ title: 'Error saving', description: error.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (section, data) => {
    setEditingSection(section)
    setEditData(data)
    setEditOpen(true)
  }

  const formatCurrency = (value) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`
    return `$${value}`
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a1628]">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-white/10 bg-white/80 dark:bg-[#0d1d35]/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3 text-slate-900 dark:text-white">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-orange to-brand-coral flex items-center justify-center">
                <Target className="h-5 w-5 text-white" />
              </div>
              Mission & Vision
            </h1>
            <p className="text-slate-500 dark:text-white/50 text-sm mt-1">Our company vision and one-page strategic plan</p>
          </div>
          {profile?.role === 'admin' && (
            <Button 
              onClick={() => openEdit('main', mission)}
              className="bg-brand-orange hover:bg-brand-coral text-white"
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
        </div>
      </div>

      <motion.div 
        className="max-w-7xl mx-auto px-6 py-8 space-y-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants}>
          <Card className="bg-white dark:bg-[#0d1d35] border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-slate-900 dark:text-white">40 schools by 2030</CardTitle>
              <p className="text-sm text-[#1644ED]">Assumption: a ramp of 6, 10, 13, 18 new schools a year at about $7.5K/mo each, with 15% of schools leaving each year.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl bg-[#1644ED] p-4 text-white">
                <p className="font-semibold">Goal: $3.5M by 2030</p>
                <p className="text-sm text-white/80">40 education retainers × about $90K/year; excludes media. More than today’s $1.44M recurring book. Ramp math below is ~$3.6M — we hold the company target at $3.5M.</p>
              </div>
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted text-left"><tr><th className="px-3 py-2">Year</th><th className="px-3 py-2">New schools signed</th><th className="px-3 py-2">Active after 15% churn</th><th className="px-3 py-2">New annual revenue</th></tr></thead>
                  <tbody>
                    <tr className="border-t"><td className="px-3 py-2">Today</td><td className="px-3 py-2">—</td><td className="px-3 py-2">2 current</td><td className="px-3 py-2">$315K/yr (CalOPS + Heart Christian)</td></tr>
                    <tr className="border-t"><td className="px-3 py-2">2027</td><td className="px-3 py-2">6</td><td className="px-3 py-2">6</td><td className="px-3 py-2">~$540K</td></tr>
                    <tr className="border-t"><td className="px-3 py-2">2028</td><td className="px-3 py-2">10</td><td className="px-3 py-2">15</td><td className="px-3 py-2">~$1.35M</td></tr>
                    <tr className="border-t"><td className="px-3 py-2">2029</td><td className="px-3 py-2">13</td><td className="px-3 py-2">26</td><td className="px-3 py-2">~$2.34M</td></tr>
                    <tr className="border-t bg-orange-50"><td className="px-3 py-2 font-semibold">2030</td><td className="px-3 py-2 font-semibold">18</td><td className="px-3 py-2 font-semibold">40</td><td className="px-3 py-2 font-semibold">~$3.6M</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-muted-foreground">47 schools signed, about 40 still active by 2030 after churn. Plus $315K/yr from current schools.</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Long Term Vision */}
        <motion.div variants={itemVariants}>
          <Card className="bg-white dark:bg-[#0d1d35] border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <Eye className="h-5 w-5 text-purple-500 dark:text-purple-400" />
                  </div>
                  <div>
                    <CardTitle className="text-slate-900 dark:text-white">Long Term Vision</CardTitle>
                    <p className="text-slate-500 dark:text-white/40 text-sm">Company Vision</p>
                  </div>
                </div>
                {profile?.role === 'admin' && (
                  <Badge variant="outline" className="text-purple-500 border-purple-300 dark:border-purple-500/50">
                    <Edit2 className="h-3 w-3 mr-1" />
                    Editable
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {profile?.role === 'admin' ? (
                <Textarea 
                  value={mission.long_term_vision}
                  onChange={(e) => setMission(m => ({ ...m, long_term_vision: e.target.value }))}
                  className="text-lg text-slate-800 dark:text-white/90 font-medium bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/20 min-h-[60px] resize-none"
                  placeholder="Enter your long-term vision..."
                />
              ) : (
                <p className="text-lg text-slate-800 dark:text-white/90 font-medium">{mission.long_term_vision}</p>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                {mission.vision_pillars.map((pillar, idx) => (
                  <div 
                    key={idx}
                    className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-purple-300 dark:hover:border-purple-500/30 transition-colors min-h-[80px]"
                  >
                    {profile?.role === 'admin' ? (
                      <Textarea 
                        value={pillar.title}
                        onChange={(e) => {
                          const newPillars = [...mission.vision_pillars]
                          newPillars[idx] = { ...newPillars[idx], title: e.target.value }
                          setMission(m => ({ ...m, vision_pillars: newPillars }))
                        }}
                        className="text-slate-600 dark:text-white/70 text-sm bg-transparent border-transparent hover:border-slate-300 dark:hover:border-white/20 focus:border-purple-400 transition-colors min-h-[60px] resize-none"
                      />
                    ) : (
                      <p className="text-slate-600 dark:text-white/70 text-sm">{pillar.title}</p>
                    )}
                  </div>
                ))}
              </div>
              
              {profile?.role === 'admin' && (
                <div className="flex justify-end pt-2">
                  <Button 
                    size="sm" 
                    className="bg-purple-600 hover:bg-purple-700 text-white" 
                    onClick={handleSave}
                    disabled={saving}
                  >
                    <Save className={cn("h-4 w-4 mr-2", saving && "animate-spin")} />
                    {saving ? 'Saving...' : 'Save Vision'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Rally Cry */}
        <motion.div variants={itemVariants}>
          <Card className="bg-white dark:bg-[#0d1d35] border-slate-200 dark:border-white/10 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-cyan-500 dark:text-cyan-400" />
                </div>
                <CardTitle className="text-slate-900 dark:text-white">{mission.rally_year} Rally Cry/Theme</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-brand-orange via-red-500 to-green-500 bg-clip-text text-transparent">
                {mission.rally_cry}
              </h2>
            </CardContent>
          </Card>
        </motion.div>

        {/* Core Values */}
        <motion.div variants={itemVariants}>
          <Card className="bg-white dark:bg-[#0d1d35] border-slate-200 dark:border-white/10 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-orange/20 flex items-center justify-center">
                  <Heart className="h-5 w-5 text-brand-orange" />
                </div>
                <CardTitle className="text-slate-900 dark:text-white">Core Values</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {mission.core_values.map((value, idx) => (
                  <div 
                    key={idx}
                    className="p-5 rounded-xl bg-gradient-to-br from-brand-orange/10 to-brand-orange/5 border border-brand-orange/20 hover:border-brand-orange/40 transition-all"
                  >
                    <h3 className="text-brand-orange font-semibold mb-2">{idx + 1}. {value.title}</h3>
                    <p className="text-slate-600 dark:text-white/60 text-sm">{value.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Vital Factors Goals */}
        <motion.div variants={itemVariants}>
          <Card className="bg-white dark:bg-[#0d1d35] border-slate-200 dark:border-white/10 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <Target className="h-5 w-5 text-green-500 dark:text-green-400" />
                </div>
                <CardTitle className="text-slate-900 dark:text-white">Top Vital Factors Goals</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {mission.vital_factors.map((factor, idx) => (
                  <div 
                    key={idx}
                    className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-green-300 dark:hover:border-green-500/30 transition-colors"
                  >
                    {profile?.role === 'admin' ? (
                      <>
                        <Input 
                          value={factor.label}
                          onChange={(e) => {
                            const newFactors = [...mission.vital_factors]
                            newFactors[idx] = { ...newFactors[idx], label: e.target.value }
                            setMission(m => ({ ...m, vital_factors: newFactors }))
                          }}
                          className="text-slate-500 dark:text-white/50 text-xs mb-1 bg-transparent border-transparent hover:border-slate-300 dark:hover:border-white/20 focus:border-green-400 transition-colors h-6 px-1"
                          placeholder="Label..."
                        />
                        <Input 
                          value={factor.value}
                          onChange={(e) => {
                            const newFactors = [...mission.vital_factors]
                            newFactors[idx] = { ...newFactors[idx], value: e.target.value }
                            setMission(m => ({ ...m, vital_factors: newFactors }))
                          }}
                          className="text-slate-900 dark:text-white font-bold text-lg bg-transparent border-transparent hover:border-slate-300 dark:hover:border-white/20 focus:border-green-400 transition-colors h-8 px-1"
                          placeholder="Value..."
                        />
                      </>
                    ) : (
                      <>
                        <p className="text-slate-500 dark:text-white/50 text-xs mb-1">{idx + 1}. {factor.label}</p>
                        <p className="text-slate-900 dark:text-white font-bold text-lg">{factor.value}</p>
                      </>
                    )}
                  </div>
                ))}
              </div>
              
              {profile?.role === 'admin' && (
                <div className="flex justify-end pt-4">
                  <Button 
                    size="sm" 
                    className="bg-green-600 hover:bg-green-700 text-white" 
                    onClick={handleSave}
                    disabled={saving}
                  >
                    <Save className={cn("h-4 w-4 mr-2", saving && "animate-spin")} />
                    {saving ? 'Saving...' : 'Save Goals'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Vital Initiatives */}
        <motion.div variants={itemVariants}>
          <Card className="bg-white dark:bg-[#0d1d35] border-slate-200 dark:border-white/10 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                  <Lightbulb className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />
                </div>
                <div>
                  <CardTitle className="text-slate-900 dark:text-white">Vital Initiatives to Achieve Goals</CardTitle>
                  <p className="text-slate-500 dark:text-white/40 text-sm">Action Items</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {mission.initiatives.map((init, idx) => (
                  <div 
                    key={idx}
                    className="p-4 rounded-xl bg-yellow-50 dark:bg-white/5 border border-yellow-200 dark:border-white/10 hover:border-yellow-300 dark:hover:border-yellow-500/30 transition-colors"
                  >
                    {profile?.role === 'admin' ? (
                      <>
                        <Input 
                          value={init.title}
                          onChange={(e) => {
                            const newInitiatives = [...mission.initiatives]
                            newInitiatives[idx] = { ...newInitiatives[idx], title: e.target.value }
                            setMission(m => ({ ...m, initiatives: newInitiatives }))
                          }}
                          className="text-yellow-600 dark:text-yellow-400 font-semibold text-sm mb-2 bg-transparent border-transparent hover:border-yellow-300 dark:hover:border-yellow-500/30 focus:border-yellow-400 transition-colors h-7 px-1"
                          placeholder="Title..."
                        />
                        <Textarea 
                          value={init.description}
                          onChange={(e) => {
                            const newInitiatives = [...mission.initiatives]
                            newInitiatives[idx] = { ...newInitiatives[idx], description: e.target.value }
                            setMission(m => ({ ...m, initiatives: newInitiatives }))
                          }}
                          className="text-slate-600 dark:text-white/60 text-xs leading-relaxed bg-transparent border-transparent hover:border-yellow-300 dark:hover:border-yellow-500/30 focus:border-yellow-400 transition-colors min-h-[60px] resize-none px-1"
                          placeholder="Description..."
                        />
                      </>
                    ) : (
                      <>
                        <h4 className="text-yellow-600 dark:text-yellow-400 font-semibold text-sm mb-2">{idx + 1}. {init.title}</h4>
                        <p className="text-slate-600 dark:text-white/60 text-xs leading-relaxed">{init.description}</p>
                      </>
                    )}
                  </div>
                ))}
              </div>
              
              {profile?.role === 'admin' && (
                <div className="flex justify-end pt-4">
                  <Button 
                    size="sm" 
                    className="bg-yellow-600 hover:bg-yellow-700 text-white" 
                    onClick={handleSave}
                    disabled={saving}
                  >
                    <Save className={cn("h-4 w-4 mr-2", saving && "animate-spin")} />
                    {saving ? 'Saving...' : 'Save Initiatives'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Road to Target Revenue */}
        <motion.div variants={itemVariants}>
          <Card className="bg-white dark:bg-[#0d1d35] border-slate-200 dark:border-white/10 shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-orange/20 flex items-center justify-center">
                    <Rocket className="h-5 w-5 text-brand-orange" />
                  </div>
                  <div>
                    <CardTitle className="text-slate-900 dark:text-white">Road to ${(mission.revenue_target / 1000000).toFixed(1)}M</CardTitle>
                    <p className="text-slate-500 dark:text-white/50 text-sm">
                      {years}-Year Revenue Roadmap with {cagr}% CAGR ({mission.start_year} → {mission.target_year})
                    </p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Planning Mode Controls */}
              <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                <span className="text-slate-500 dark:text-white/50 text-sm">Planning Mode:</span>
                <Button size="sm" className="bg-brand-orange hover:bg-brand-coral text-white">
                  Set Target Revenue
                </Button>
                <Button size="sm" variant="outline" className="border-slate-300 dark:border-white/20 text-slate-700 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/10">
                  Set Growth Rate
                </Button>
              </div>

              {/* Revenue & Client Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label className="text-slate-600 dark:text-white/70 text-sm">{mission.target_year} Target Revenue ($)</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input 
                      type="text" 
                      value={mission.revenue_target.toLocaleString()}
                      onChange={(e) => setMission(m => ({ ...m, revenue_target: parseInt(e.target.value.replace(/,/g, '')) || 0 }))}
                      className="bg-slate-100 dark:bg-white/5 border-slate-300 dark:border-white/20 text-slate-900 dark:text-white font-mono"
                    />
                    <span className="text-slate-500 dark:text-white/50 text-sm">= ${(mission.revenue_target / 1000000).toFixed(1)}M</span>
                  </div>
                  <p className="text-brand-orange text-xs mt-1">Required CAGR: {cagr}%</p>
                </div>
                <div>
                  <Label className="text-slate-600 dark:text-white/70 text-sm">Current Revenue ($)</Label>
                  <Input 
                    type="text" 
                    value={mission.current_revenue.toLocaleString()}
                    onChange={(e) => setMission(m => ({ ...m, current_revenue: parseInt(e.target.value.replace(/,/g, '')) || 0 }))}
                    className="mt-1 bg-slate-100 dark:bg-white/5 border-slate-300 dark:border-white/20 text-slate-900 dark:text-white font-mono"
                  />
                  <p className="text-slate-400 dark:text-white/40 text-xs mt-1">= ${(mission.current_revenue / 1000000).toFixed(2)}M</p>
                </div>
                <div>
                  <Label className="text-slate-600 dark:text-white/70 text-sm">Target Clients</Label>
                  <Input 
                    type="number" 
                    value={mission.target_clients}
                    onChange={(e) => setMission(m => ({ ...m, target_clients: parseInt(e.target.value) || 0 }))}
                    className="mt-1 bg-slate-100 dark:bg-white/5 border-slate-300 dark:border-white/20 text-slate-900 dark:text-white"
                  />
                  <p className="text-slate-400 dark:text-white/40 text-xs mt-1">by {mission.target_year}</p>
                </div>
                <div>
                  <Label className="text-slate-600 dark:text-white/70 text-sm">Current Clients</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input 
                      type="number" 
                      value={mission.current_clients}
                      onChange={(e) => setMission(m => ({ ...m, current_clients: parseInt(e.target.value) || 0 }))}
                      className="bg-slate-100 dark:bg-white/5 border-slate-300 dark:border-white/20 text-slate-900 dark:text-white"
                    />
                  </div>
                  <p className="text-slate-400 dark:text-white/40 text-xs mt-1">today</p>
                </div>
              </div>
              
              {/* Save Button */}
              <div className="flex justify-end">
                <Button 
                  size="sm" 
                  className="bg-green-600 hover:bg-green-700 text-white" 
                  onClick={handleSave}
                  disabled={saving}
                >
                  <Save className={cn("h-4 w-4 mr-2", saving && "animate-spin")} />
                  {saving ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-gradient-to-br from-brand-orange/20 to-brand-orange/5 border border-brand-orange/30">
                  <p className="text-brand-orange/70 text-xs mb-1">{mission.target_year} TARGET GOAL</p>
                  <p className="text-brand-orange text-3xl font-bold">${(mission.revenue_target / 1000000).toFixed(1)}M</p>
                  <p className="text-slate-500 dark:text-white/50 text-xs">At {cagr}% YoY Growth</p>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 border border-purple-500/30">
                  <p className="text-purple-500/70 text-xs mb-1">STARTING REVENUE</p>
                  <p className="text-purple-500 text-3xl font-bold">${(mission.current_revenue / 1000000).toFixed(1)}M</p>
                  <p className="text-slate-500 dark:text-white/50 text-xs">{mission.start_year} Annual Revenue</p>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-br from-teal-500/20 to-teal-500/5 border border-teal-500/30">
                  <p className="text-teal-600/70 text-xs mb-1">REQUIRED CAGR</p>
                  <p className="text-teal-600 text-3xl font-bold">{cagr}%</p>
                  <p className="text-slate-500 dark:text-white/50 text-xs">Year-over-year growth</p>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-br from-rose-500/20 to-rose-500/5 border border-rose-500/30">
                  <p className="text-rose-500/70 text-xs mb-1">CLIENTS BY {mission.target_year}</p>
                  <p className="text-rose-500 text-3xl font-bold">{mission.target_clients}</p>
                  <p className="text-slate-500 dark:text-white/50 text-xs">@ ${Math.round(avgClientMonthly).toLocaleString()}/yr avg</p>
                </div>
              </div>

              {/* Revenue Trajectory Chart */}
              <div>
                <h3 className="text-slate-900 dark:text-white font-semibold mb-4 flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-brand-orange" />
                  Revenue Trajectory at {cagr}% CAGR
                </h3>
                <div className="h-64 bg-slate-100 dark:bg-white/5 rounded-xl p-4 border border-slate-200 dark:border-white/10">
                  <div className="relative h-full">
                    {/* Y-axis labels */}
                    <div className="absolute left-0 top-0 bottom-8 w-12 flex flex-col justify-between text-slate-500 dark:text-white/50 text-xs">
                      <span>${(mission.revenue_target / 1000000).toFixed(0)}M</span>
                      <span>${((mission.revenue_target + mission.current_revenue) / 2 / 1000000).toFixed(0)}M</span>
                      <span>${(mission.current_revenue / 1000000).toFixed(0)}M</span>
                      <span>$0M</span>
                    </div>
                    
                    {/* Chart area */}
                    <div className="absolute left-14 right-0 top-0 bottom-8">
                      <svg className="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
                        {/* Grid lines */}
                        <line x1="0" y1="50" x2="400" y2="50" stroke="rgba(100,116,139,0.2)" strokeDasharray="4" />
                        <line x1="0" y1="100" x2="400" y2="100" stroke="rgba(100,116,139,0.2)" strokeDasharray="4" />
                        <line x1="0" y1="150" x2="400" y2="150" stroke="rgba(100,116,139,0.2)" strokeDasharray="4" />
                        
                        {/* Area fill */}
                        <defs>
                          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#F7931E" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="#F7931E" stopOpacity="0.05" />
                          </linearGradient>
                        </defs>
                        
                        {/* Path */}
                        <path
                          d={`M 0 ${200 - (mission.current_revenue / mission.revenue_target) * 180} ${trajectoryData.map((d, i) => 
                            `L ${(i / (trajectoryData.length - 1)) * 400} ${200 - (d.value / mission.revenue_target) * 180}`
                          ).join(' ')} L 400 200 L 0 200 Z`}
                          fill="url(#areaGradient)"
                        />
                        
                        {/* Line */}
                        <path
                          d={`M 0 ${200 - (mission.current_revenue / mission.revenue_target) * 180} ${trajectoryData.map((d, i) => 
                            `L ${(i / (trajectoryData.length - 1)) * 400} ${200 - (d.value / mission.revenue_target) * 180}`
                          ).join(' ')}`}
                          fill="none"
                          stroke="#F7931E"
                          strokeWidth="3"
                        />
                        
                        {/* Data points */}
                        {trajectoryData.map((d, i) => (
                          <circle
                            key={i}
                            cx={(i / (trajectoryData.length - 1)) * 400}
                            cy={200 - (d.value / mission.revenue_target) * 180}
                            r="5"
                            fill="#F7931E"
                            stroke="#f8fafc"
                            strokeWidth="2"
                          />
                        ))}
                      </svg>
                    </div>
                    
                    {/* X-axis labels */}
                    <div className="absolute left-14 right-0 bottom-0 flex justify-between text-slate-500 dark:text-white/50 text-xs">
                      {trajectoryData.map((d, i) => (
                        <span key={i}>{d.label}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Year-by-Year Roadmap Table */}
        <motion.div variants={itemVariants}>
          <Card className="bg-white dark:bg-[#0d1d35] border-slate-200 dark:border-white/10 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                </div>
                <CardTitle className="text-slate-900 dark:text-white">Year-by-Year Roadmap</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-white/10">
                      <th className="text-left py-3 px-4 text-slate-500 dark:text-white/50 font-medium text-sm">Year</th>
                      <th className="text-left py-3 px-4 text-slate-500 dark:text-white/50 font-medium text-sm">Target Revenue</th>
                      <th className="text-left py-3 px-4 text-slate-500 dark:text-white/50 font-medium text-sm">Total Clients</th>
                      <th className="text-left py-3 px-4 text-slate-500 dark:text-white/50 font-medium text-sm">New Clients Needed</th>
                      <th className="text-left py-3 px-4 text-slate-500 dark:text-white/50 font-medium text-sm">New/Month</th>
                      <th className="text-left py-3 px-4 text-slate-500 dark:text-white/50 font-medium text-sm">Milestone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearlyRoadmap.map((row, idx) => (
                      <tr 
                        key={row.year}
                        className={cn(
                          "border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors",
                          idx === years && "bg-green-50 dark:bg-green-500/10"
                        )}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-900 dark:text-white font-medium">{row.year}</span>
                            {idx === 0 && <Badge className="bg-cyan-600 text-white text-[10px]">Now</Badge>}
                            {idx === years && <Badge className="bg-green-600 text-white text-[10px]">Goal</Badge>}
                          </div>
                        </td>
                        <td className={cn("py-3 px-4 font-bold", idx === years ? "text-green-600 dark:text-green-400" : "text-slate-900 dark:text-white")}>
                          ${(row.revenue / 1000000).toFixed(2)}M
                        </td>
                        <td className="py-3 px-4 text-slate-900 dark:text-white">{row.totalClients}</td>
                        <td className="py-3 px-4">
                          {row.newClients > 0 ? (
                            <span className="text-green-600 dark:text-green-400">+{row.newClients}</span>
                          ) : (
                            <span className="text-slate-400 dark:text-white/40">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-white/70">~{row.perMonth}/mo</td>
                        <td className="py-3 px-4">
                          {idx === years ? (
                            <span className="text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                              <CheckCircle className="h-4 w-4" />
                              {row.milestone}
                            </span>
                          ) : row.milestone ? (
                            <span className="text-slate-500 dark:text-white/60">{row.milestone}</span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* What This Means + Growth Levers */}
        <motion.div variants={itemVariants} className="grid md:grid-cols-2 gap-6">
          <Card className="bg-white dark:bg-[#0d1d35] border-slate-200 dark:border-white/10 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-green-500 dark:text-green-400" />
                </div>
                <CardTitle className="text-slate-900 dark:text-white">What This Means</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <ArrowUpRight className="h-4 w-4 text-green-500 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <p className="text-slate-600 dark:text-white/70 text-sm">
                  Average client brings in <span className="text-slate-900 dark:text-white font-bold">${Math.round(avgClientMonthly).toLocaleString()}/month</span> (${Math.round(avgClientValue).toLocaleString()}/year)
                </p>
              </div>
              <div className="flex items-start gap-3">
                <ArrowUpRight className="h-4 w-4 text-green-500 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <p className="text-slate-600 dark:text-white/70 text-sm">
                  Need to add <span className="text-slate-900 dark:text-white font-bold">~{Math.round(clientsNeededPerYear)} new clients per year</span> on average
                </p>
              </div>
              <div className="flex items-start gap-3">
                <ArrowUpRight className="h-4 w-4 text-green-500 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <p className="text-slate-600 dark:text-white/70 text-sm">
                  That's roughly <span className="text-slate-900 dark:text-white font-bold">{(clientsNeededPerYear / 12).toFixed(1)} new client per month</span>
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-[#0d1d35] border-slate-200 dark:border-white/10 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-purple-500 dark:text-purple-400" />
                </div>
                <CardTitle className="text-slate-900 dark:text-white">Growth Levers</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <ArrowUpRight className="h-4 w-4 text-purple-500 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <p className="text-slate-600 dark:text-white/70 text-sm">
                  <span className="text-slate-900 dark:text-white font-medium">Increase average client value</span> — upsell existing clients
                </p>
              </div>
              <div className="flex items-start gap-3">
                <ArrowUpRight className="h-4 w-4 text-purple-500 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <p className="text-slate-600 dark:text-white/70 text-sm">
                  <span className="text-slate-900 dark:text-white font-medium">Improve client retention</span> — reduce churn rate
                </p>
              </div>
              <div className="flex items-start gap-3">
                <ArrowUpRight className="h-4 w-4 text-purple-500 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <p className="text-slate-600 dark:text-white/70 text-sm">
                  <span className="text-slate-900 dark:text-white font-medium">Target larger businesses</span> — higher contract values
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Bottom Line */}
        <motion.div variants={itemVariants}>
          <div className="p-6 rounded-2xl bg-gradient-to-r from-brand-orange to-brand-coral text-center">
            <p className="text-white text-lg font-medium">
              <span className="font-bold">Bottom Line:</span> With {cagr}% annual growth, you'll reach{' '}
              <span className="font-bold">${(mission.revenue_target / 1000000).toFixed(1)}M</span> by {mission.target_year}, 
              growing from <span className="font-bold">{mission.current_clients} clients</span> to{' '}
              <span className="font-bold">{mission.target_clients} clients</span>.
            </p>
          </div>
        </motion.div>
      </motion.div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl bg-white dark:bg-[#0d1d35] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-white">Edit Mission & Vision</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-slate-600 dark:text-white/70">Long Term Vision</Label>
              <Textarea 
                value={mission.long_term_vision}
                onChange={(e) => setMission(m => ({ ...m, long_term_vision: e.target.value }))}
                className="mt-1 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/20 text-slate-900 dark:text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-600 dark:text-white/70">Rally Cry Year</Label>
                <Input 
                  value={mission.rally_year}
                  onChange={(e) => setMission(m => ({ ...m, rally_year: e.target.value }))}
                  className="mt-1 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/20 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <Label className="text-slate-600 dark:text-white/70">Rally Cry Theme</Label>
                <Input 
                  value={mission.rally_cry}
                  onChange={(e) => setMission(m => ({ ...m, rally_cry: e.target.value }))}
                  className="mt-1 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/20 text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-600 dark:text-white/70">Target Revenue ($)</Label>
                <Input 
                  type="text"
                  value={mission.revenue_target.toLocaleString()}
                  onChange={(e) => setMission(m => ({ ...m, revenue_target: parseInt(e.target.value.replace(/,/g, '')) || 0 }))}
                  className="mt-1 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/20 text-slate-900 dark:text-white font-mono"
                />
              </div>
              <div>
                <Label className="text-slate-600 dark:text-white/70">Current Revenue ($)</Label>
                <Input 
                  type="text"
                  value={mission.current_revenue.toLocaleString()}
                  onChange={(e) => setMission(m => ({ ...m, current_revenue: parseInt(e.target.value.replace(/,/g, '')) || 0 }))}
                  className="mt-1 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/20 text-slate-900 dark:text-white font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label className="text-slate-600 dark:text-white/70">Start Year</Label>
                <Input 
                  type="number"
                  value={mission.start_year}
                  onChange={(e) => setMission(m => ({ ...m, start_year: parseInt(e.target.value) || 2026 }))}
                  className="mt-1 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/20 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <Label className="text-slate-600 dark:text-white/70">Target Year</Label>
                <Input 
                  type="number"
                  value={mission.target_year}
                  onChange={(e) => setMission(m => ({ ...m, target_year: parseInt(e.target.value) || 2030 }))}
                  className="mt-1 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/20 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <Label className="text-slate-600 dark:text-white/70">Current Clients</Label>
                <Input 
                  type="number"
                  value={mission.current_clients}
                  onChange={(e) => setMission(m => ({ ...m, current_clients: parseInt(e.target.value) || 0 }))}
                  className="mt-1 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/20 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <Label className="text-slate-600 dark:text-white/70">Target Clients</Label>
                <Input 
                  type="number"
                  value={mission.target_clients}
                  onChange={(e) => setMission(m => ({ ...m, target_clients: parseInt(e.target.value) || 0 }))}
                  className="mt-1 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/20 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} className="border-slate-200 dark:border-white/20 text-slate-600 dark:text-white/70" disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} className="bg-brand-orange hover:bg-brand-coral text-white" disabled={saving}>
              <Save className={cn("h-4 w-4 mr-2", saving && "animate-spin")} />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
