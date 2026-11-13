import { useEffect, useMemo, useRef, useState } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { GripVertical, Loader2, Plus, RefreshCw, Target } from 'lucide-react'
import { supabase, ensureValidSession } from '../lib/supabase'
import { CHANNEL_COLORS, chipClass, displayDate, formatMoney, jiraUrl } from '../lib/leads'
import { Button } from '../components/ui/button'
import LeadContactDialog from '../components/LeadContactDialog'
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

function stageFromLead(row) {
  const stage = String(row.pipeline_stage || '').toLowerCase()
  if (STAGES.some((s) => s.id === stage)) return stage
  if (row.quality === 'Closed') return 'won'
  if (row.quality === 'Proposal sent') return 'proposal'
  return 'lead'
}

function contractMonths(row) {
  const months = Number(row.contract_months)
  return months > 0 ? months : 12
}

function withinPastYear(row) {
  const raw = row.first_contact_date || row.updated_at || row.created_at
  if (!raw) return true
  const time = new Date(raw).getTime()
  if (!Number.isFinite(time)) return true
  return Date.now() - time <= 365 * 24 * 60 * 60 * 1000
}

function amountOf(row) {
  const stage = stageFromLead(row)
  if (stage === 'won') return Number(row.close_amount || row.value_2026) || 0
  const estimate = Number(row.value_2026) || 0
  if (row.deal_type === 'Monthly') return estimate * contractMonths(row)
  return estimate
}

export default function ScoreCardPipeline() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [setupNeeded, setSetupNeeded] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingLead, setEditingLead] = useState(null)
  const [selected, setSelected] = useState(() => new Set())
  const selectedRef = useRef(selected)
  selectedRef.current = selected
  const lastAnchorRef = useRef(null)

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

  const stageStats = useMemo(
    () =>
      STAGES.map((stage) => {
        const cards = byStage[stage.id] || []
        const amount = cards.reduce((sum, row) => sum + amountOf(row), 0)
        return { ...stage, count: cards.length, amount }
      }),
    [byStage]
  )
  const pipelineTally = ['lead', 'kickoff', 'proposal'].reduce(
    (sum, id) => sum + (stageStats.find((stage) => stage.id === id)?.amount || 0),
    0
  )
  const closedWonYear = (byStage.won || []).filter(withinPastYear)
  const closedWonYearAmount = closedWonYear.reduce((sum, row) => sum + amountOf(row), 0)

  function toggleSelected(id, on) {
    setSelected((current) => {
      const next = new Set(current)
      if (on) next.add(String(id))
      else next.delete(String(id))
      return next
    })
    lastAnchorRef.current = String(id)
  }

  function onCardCheck(event, row, cards) {
    event.stopPropagation()
    const id = String(row.id)
    if (event.nativeEvent.shiftKey && lastAnchorRef.current) {
      const ids = cards.map((card) => String(card.id))
      const start = ids.indexOf(lastAnchorRef.current)
      const end = ids.indexOf(id)
      if (start >= 0 && end >= 0) {
        const lo = Math.min(start, end)
        const hi = Math.max(start, end)
        setSelected((current) => {
          const next = new Set(current)
          for (let i = lo; i <= hi; i += 1) next.add(ids[i])
          return next
        })
        return
      }
    }
    toggleSelected(id, event.target.checked)
  }

  function selectColumn(cards, on) {
    setSelected((current) => {
      const next = new Set(current)
      for (const card of cards) {
        if (on) next.add(String(card.id))
        else next.delete(String(card.id))
      }
      return next
    })
    if (cards[0]) lastAnchorRef.current = String(cards[0].id)
  }

  async function persistStages(ids, stageId) {
    const unique = [...new Set(ids.map(String))]
    if (!unique.length) return
    const stage = STAGES.find((s) => s.id === stageId)
    const patch = { pipeline_stage: stageId, quality: stage.quality, updated_at: new Date().toISOString() }
    setRows((current) => current.map((row) => (unique.includes(String(row.id)) ? { ...row, ...patch } : row)))
    let { error } = await supabase.from('sales_leads').update(patch).in('id', unique)
    if (error && String(error.message || '').includes('pipeline_stage')) {
      const { pipeline_stage, ...rest } = patch
      error = (await supabase.from('sales_leads').update(rest).in('id', unique)).error
    }
    if (error) {
      toast({ title: 'Could not move deals', description: error.message, variant: 'destructive' })
      load()
      return
    }
    toast({ title: unique.length > 1 ? `${unique.length} moved to ${stage.title}` : `Moved to ${stage.title}` })
    setSelected(new Set())
  }

  function onDragEnd(result) {
    if (!result.destination) return
    if (result.source.droppableId === result.destination.droppableId) return
    const dragged = String(result.draggableId)
    const checked = selectedRef.current
    const ids = checked.has(dragged) && checked.size > 1 ? [...checked] : [dragged]
    persistStages(ids, result.destination.droppableId)
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
              Check one card, scroll, Shift-click another to grab the whole stretch (50+). Drag any selected card into the next column — they all move.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button size="sm" className="bg-purple-500 text-white hover:bg-purple-600" onClick={() => { setEditingLead(null); setDialogOpen(true) }}>
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
          <div className="rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="text-sm text-slate-500">Pipeline</p>
            <p className="text-2xl font-bold text-green-700">{formatMoney(pipelineTally) || '$0'}</p>
            <p className="mt-1 text-xs text-slate-500">Lead + kickoff + proposal</p>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <p className="text-sm text-slate-500">Closed won</p>
            <p className="text-2xl font-bold">{closedWonYear.length}</p>
            <p className="mt-1 text-xs text-slate-500">Past 365 days{closedWonYearAmount ? ` · ${formatMoney(closedWonYearAmount)}` : ''}</p>
          </div>
        </div>

        {selected.size ? (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 text-sm">
            <span className="font-semibold">{selected.size} selected</span>
            <span className="text-slate-500">Drag one into another column to move all</span>
            <Button size="sm" className="rounded-full bg-green-600 text-white hover:bg-green-700" onClick={() => persistStages([...selected], 'won')}>Closed won</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        ) : null}

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
                return (
                  <div key={stage.id} className="flex w-[260px] min-w-[260px] shrink-0 flex-col">
                    <div className="mb-3 flex items-center gap-2 px-1">
                      <input
                        type="checkbox"
                        title="Select all in this column"
                        checked={cards.length > 0 && cards.every((card) => selected.has(String(card.id)))}
                        onChange={(event) => selectColumn(cards, event.target.checked)}
                      />
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
                                      selected.has(String(row.id)) && 'ring-2 ring-purple-400',
                                      snap.isDragging ? 'rotate-2 shadow-lg ring-2 ring-purple-500' : 'cursor-grab hover:shadow-md'
                                    )}
                                  >
                                    <div className="mb-2 flex items-start gap-2">
                                      <input
                                        type="checkbox"
                                        className="mt-1 shrink-0"
                                        checked={selected.has(String(row.id))}
                                        onMouseDown={(event) => event.stopPropagation()}
                                        onClick={(event) => {
                                          event.stopPropagation()
                                          if (event.shiftKey) {
                                            event.preventDefault()
                                            onCardCheck(event, row, cards)
                                          }
                                        }}
                                        onChange={(event) => {
                                          if (event.nativeEvent.shiftKey) return
                                          onCardCheck(event, row, cards)
                                        }}
                                      />
                                      <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                                      <div className="min-w-0 flex-1 overflow-hidden">
                                        <button type="button" className="w-full break-words text-left text-sm font-semibold leading-snug hover:underline" onClick={(event) => { event.stopPropagation(); setEditingLead(row); setDialogOpen(true) }}>{row.company || row.name || 'Untitled'}</button>
                                        {snap.isDragging && selected.has(String(row.id)) && selected.size > 1 ? (
                                          <div className="mt-1 inline-flex rounded-full bg-purple-600 px-2 py-0.5 text-[11px] font-semibold text-white">+{selected.size - 1} more</div>
                                        ) : null}
                                        {row.name && row.company ? (
                                          <div className="mt-0.5 break-words text-xs text-slate-500">{row.name}</div>
                                        ) : null}
                                      </div>
                                    </div>
                                    <div className="space-y-1 text-xs text-slate-600">
                                      <div>
                                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${chipClass(CHANNEL_COLORS, row.source)}`}>
                                          {row.source || '—'}
                                        </span>
                                      </div>
                                      <div>
                                        {row.deal_type === 'Monthly' && Number(row.value_2026) ? (
                                          <>
                                            {formatMoney(row.value_2026)} × {contractMonths(row)}
                                            <div className="font-semibold">{formatMoney(amountOf(row))}</div>
                                          </>
                                        ) : (formatMoney(amountOf(row)) || '$0')}
                                      </div>
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

                  </div>
                )
              })}
            </div>
          </DragDropContext>
        )}
      </div>

      <div className="sticky bottom-0 z-20 -mx-4 mt-4 overflow-x-auto border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="flex gap-4">
          {stageStats.map((stage) => (
            <div key={stage.id} className="w-[260px] min-w-[260px] shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div className="flex items-center gap-1.5">
                <span className={cn('h-2 w-2 rounded-full', stage.color)} />
                <p className="truncate text-xs font-medium text-slate-600">{stage.title}</p>
              </div>
              <p className="mt-1 text-sm font-bold">{formatMoney(stage.amount) || '$0'}</p>
              <p className="text-xs text-slate-500">{stage.count} {stage.count === 1 ? 'deal' : 'deals'}</p>
            </div>
          ))}
        </div>
      </div>

      <LeadContactDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        lead={editingLead}
        defaultStage="lead"
        onSaved={() => load()}
      />
    </div>
  )
}
