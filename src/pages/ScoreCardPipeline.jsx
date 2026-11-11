import { useEffect, useMemo, useState } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { GripVertical, Loader2, Plus, RefreshCw, Target } from 'lucide-react'
import { supabase, ensureValidSession } from '../lib/supabase'
import { CHANNEL_COLORS, LEAD_SOURCES, chipClass, displayDate, formatMoney, jiraUrl } from '../lib/leads'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import { useToast } from '../hooks/useToast'
import { cn } from '../lib/utils'

const STAGES = [
  { id: 'lead', title: 'Lead', quality: 'Good Lead', weight: 0.1, color: 'bg-gray-400' },
  { id: 'kickoff', title: 'Kick-Off Meeting', quality: 'Good Lead', weight: 0.3, color: 'bg-blue-500' },
  { id: 'proposal', title: 'Proposal Sent', quality: 'Proposal sent', weight: 0.6, color: 'bg-purple-500' },
  { id: 'contract', title: 'Buy-in/Contract Sent', quality: 'Proposal sent', weight: 0.9, color: 'bg-orange-500' },
  { id: 'won', title: 'Closed Won', quality: 'Closed', weight: 1, color: 'bg-green-500' },
  { id: 'lost', title: 'Closed Lost', quality: 'No response from emails & calls', weight: 0, color: 'bg-red-500' },
]

const EMPTY = {
  name: '',
  company: '',
  source: 'Direct',
  value_2026: '',
  notes: '',
  jira_key: '',
}

function stageFromLead(row) {
  const stage = String(row.pipeline_stage || '').toLowerCase()
  if (STAGES.some((s) => s.id === stage)) return stage
  if (row.quality === 'Closed') return 'won'
  if (row.quality === 'Proposal sent') return 'proposal'
  return 'lead'
}

function amountOf(row) {
  return Number(row.value_2026 || row.close_amount) || 0
}

export default function ScoreCardPipeline() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [setupNeeded, setSetupNeeded] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [draft, setDraft] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    await ensureValidSession()
    const { data, error } = await supabase
      .from('sales_leads')
      .select('*')
      .order('first_contact_date', { ascending: false })
    if (error) {
      setSetupNeeded(true)
      setRows([])
    } else {
      setSetupNeeded(false)
      setRows(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const byStage = useMemo(() => {
    const grouped = Object.fromEntries(STAGES.map((s) => [s.id, []]))
    for (const row of rows) grouped[stageFromLead(row)].push(row)
    return grouped
  }, [rows])

  const pipelineValue = rows.reduce((sum, row) => sum + amountOf(row), 0)

  async function persistStage(id, stageId) {
    const stage = STAGES.find((s) => s.id === stageId)
    const patch = { pipeline_stage: stageId, quality: stage.quality, updated_at: new Date().toISOString() }
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)))
    let { error } = await supabase.from('sales_leads').update(patch).eq('id', id)
    if (error && String(error.message || '').includes('pipeline_stage')) {
      const { pipeline_stage, ...rest } = patch
      error = (await supabase.from('sales_leads').update(rest).eq('id', id)).error
    }
    if (error) {
      toast({ title: 'Could not move deal', description: error.message, variant: 'destructive' })
      load()
      return
    }
    toast({ title: `Moved to ${stage.title}` })
  }

  function onDragEnd(result) {
    if (!result.destination) return
    if (result.source.droppableId === result.destination.droppableId) return
    persistStage(result.draggableId, result.destination.droppableId)
  }

  async function addProspect() {
    if (!draft.name.trim() && !draft.company.trim()) {
      toast({ title: 'Add a name or company', variant: 'destructive' })
      return
    }
    setSaving(true)
    const today = new Date().toISOString().slice(0, 10)
    const payload = {
      name: draft.name.trim(),
      company: draft.company.trim(),
      source: draft.source,
      notes: draft.notes.trim(),
      jira_key: draft.jira_key.trim() || null,
      value_2026: Number(draft.value_2026 || 0) || null,
      first_contact_date: today,
      month: today.slice(0, 7),
      quality: 'Good Lead',
      pipeline_stage: 'lead',
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabase.from('sales_leads').insert(payload).select('*').single()
    setSaving(false)
    if (error) {
      toast({ title: 'Could not add prospect', description: error.message, variant: 'destructive' })
      return
    }
    setRows((current) => [data, ...current])
    setDialogOpen(false)
    setDraft(EMPTY)
    toast({ title: 'Added to pipeline' })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 p-2">
                <Target className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold sm:text-4xl">Deal Pipeline</h1>
            </div>
            <p className="text-sm text-slate-500 sm:text-lg">
              Same people as Score Card. Add here or there — they show up on this board. Drag to move stages.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button size="sm" className="bg-purple-500 text-white hover:bg-purple-600" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Prospect
            </Button>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4">
            <p className="text-sm text-slate-500">Prospects</p>
            <p className="text-2xl font-bold text-purple-500">{rows.length}</p>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <p className="text-sm text-slate-500">Pipeline value</p>
            <p className="text-2xl font-bold text-green-600">{formatMoney(pipelineValue) || '$0'}</p>
          </div>
          <div className="rounded-xl border bg-white p-4 col-span-2 md:col-span-1">
            <p className="text-sm text-slate-500">Closed won</p>
            <p className="text-2xl font-bold">{byStage.won.length}</p>
          </div>
        </div>

        {setupNeeded ? (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
            Score Card save is blocked until supabase/sales-leads.sql is run once.
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-4 overflow-x-auto pb-4">
              {STAGES.map((stage) => {
                const cards = byStage[stage.id]
                const total = cards.reduce((sum, row) => sum + amountOf(row), 0)
                const weighted = total * stage.weight
                return (
                  <div key={stage.id} className="flex w-[240px] min-w-[240px] shrink-0 flex-col">
                    <div className="mb-3 flex items-center gap-2 px-1">
                      <div className={cn('h-2 w-2 rounded-full', stage.color)} />
                      <h3 className="text-sm font-semibold">{stage.title}</h3>
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs">{cards.length}</span>
                    </div>
                    <Droppable droppableId={stage.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={cn(
                            'min-h-[300px] flex-1 rounded-xl border-2 border-dashed p-2 transition-colors',
                            snapshot.isDraggingOver ? 'border-purple-500 bg-purple-500/10' : 'border-transparent bg-slate-100'
                          )}
                        >
                          {cards.map((row, index) => {
                            const link = jiraUrl(row.jira_key)
                            return (
                              <Draggable draggableId={String(row.id)} index={index} key={row.id}>
                                {(drag, snap) => (
                                  <div
                                    ref={drag.innerRef}
                                    {...drag.draggableProps}
                                    {...drag.dragHandleProps}
                                    className={cn(
                                      'mb-2 rounded-lg border bg-white p-3 shadow-sm',
                                      snap.isDragging ? 'rotate-2 shadow-lg ring-2 ring-purple-500' : 'cursor-grab hover:shadow-md'
                                    )}
                                  >
                                    <div className="mb-2 flex items-center gap-2">
                                      <GripVertical className="h-4 w-4 shrink-0 text-slate-400" />
                                      <div className="min-w-0">
                                        <div className="truncate font-semibold">{row.company || row.name || 'Untitled'}</div>
                                        {row.name && row.company ? (
                                          <div className="truncate text-xs text-slate-500">{row.name}</div>
                                        ) : null}
                                      </div>
                                    </div>
                                    <div className="space-y-1 text-xs text-slate-600">
                                      <div>
                                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${chipClass(CHANNEL_COLORS, row.source)}`}>
                                          {row.source || '—'}
                                        </span>
                                      </div>
                                      <div>{formatMoney(amountOf(row)) || '$0'}</div>
                                      <div>{displayDate(row.first_contact_date) || '—'}</div>
                                      {link ? (
                                        <a className="text-[#1644ED] hover:underline" href={link} target="_blank" rel="noreferrer">
                                          {row.jira_key}
                                        </a>
                                      ) : null}
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            )
                          })}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                    <div className="mt-2 px-1 text-xs font-medium text-slate-600">
                      <div>{formatMoney(total) || '$0'} total</div>
                      <div className="text-slate-400">
                        {formatMoney(weighted) || '$0'} ({Math.round(stage.weight * 100)}%) weighted
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </DragDropContext>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add prospect</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Name</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div>
              <Label>Company</Label>
              <Input value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} />
            </div>
            <div>
              <Label>Source</Label>
              <select
                className="h-10 w-full rounded-md border px-3 text-sm"
                value={draft.source}
                onChange={(e) => setDraft({ ...draft, source: e.target.value })}
              >
                {LEAD_SOURCES.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Amount</Label>
              <Input value={draft.value_2026} onChange={(e) => setDraft({ ...draft, value_2026: e.target.value })} />
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button className="bg-purple-500 text-white hover:bg-purple-600" disabled={saving} onClick={addProspect}>
              {saving ? 'Saving…' : 'Add to pipeline'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
