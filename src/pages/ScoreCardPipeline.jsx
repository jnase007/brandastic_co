import { useEffect, useMemo, useState } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { Loader2, RefreshCw } from 'lucide-react'
import { supabase, ensureValidSession } from '../lib/supabase'
import { CHANNEL_COLORS, chipClass, displayDate, formatMoney, jiraUrl } from '../lib/leads'
import { Button } from '../components/ui/button'
import { useToast } from '../hooks/useToast'

const STAGES = [
  { id: 'lead', title: 'Lead', quality: 'Good Lead', weight: 0.1 },
  { id: 'kickoff', title: 'Kick-Off Meeting', quality: 'Good Lead', weight: 0.3 },
  { id: 'proposal', title: 'Proposal Sent', quality: 'Proposal sent', weight: 0.6 },
  { id: 'contract', title: 'Buy-in/Contract Sent', quality: 'Proposal sent', weight: 0.9 },
  { id: 'won', title: 'Closed Won', quality: 'Closed', weight: 1 },
  { id: 'lost', title: 'Closed Lost', quality: 'No response from emails & calls', weight: 0 },
]

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

  const load = async () => {
    setLoading(true)
    await ensureValidSession()
    const { data, error } = await supabase
      .from('sales_leads')
      .select('*')
      .not('jira_key', 'is', null)
      .neq('jira_key', '')
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

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-[#8eb4ff]">NEW · SCORE CARD DEALS</p>
          <h1 className="text-2xl font-bold">Sales Pipeline</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            New board. Score Card leads with a Jira key only. Drag Closed Won and Financials picks up channel + close amount. Old /pipeline is untouched.
          </p>
        </div>
        <Button variant="outline" onClick={load}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {setupNeeded ? (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
          Add a Jira key on Score Card (someone you actually talk to) and it lands here. If save is blocked, run supabase/sales-leads.sql once.
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-4">
            {STAGES.map((stage) => {
              const cards = byStage[stage.id]
              const total = cards.reduce((sum, row) => sum + amountOf(row), 0)
              const weighted = total * stage.weight
              return (
                <Droppable droppableId={stage.id} key={stage.id}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="flex w-[280px] shrink-0 flex-col rounded-2xl bg-[#eef1f4] p-3"
                    >
                      <div className="mb-3 font-semibold">
                        {stage.title} {cards.length}
                      </div>
                      <div className="min-h-[480px] flex-1 space-y-3">
                        {cards.map((row, index) => {
                          const link = jiraUrl(row.jira_key)
                          return (
                            <Draggable draggableId={String(row.id)} index={index} key={row.id}>
                              {(drag) => (
                                <div
                                  ref={drag.innerRef}
                                  {...drag.draggableProps}
                                  {...drag.dragHandleProps}
                                  className="rounded-xl border bg-white p-4 shadow-sm"
                                >
                                  <div className="text-base font-semibold text-[#0f6e6b]">{row.company || row.name || 'Untitled'}</div>
                                  {row.name && row.company ? (
                                    <div className="mt-1 text-sm text-[#0f6e6b]">{row.name}</div>
                                  ) : null}
                                  <div className="mt-3 space-y-1 text-sm text-slate-700">
                                    <div>
                                      Deal Source:{' '}
                                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${chipClass(CHANNEL_COLORS, row.source)}`}>
                                        {row.source || '—'}
                                      </span>
                                    </div>
                                    {row.deal_interest || row.notes ? (
                                      <div>Deal Interest: {row.deal_interest || row.notes}</div>
                                    ) : null}
                                    <div>Amount: {formatMoney(amountOf(row)) || '$0'}</div>
                                    <div>Create date: {displayDate(row.first_contact_date) || '—'}</div>
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
                      <div className="mt-3 border-t border-slate-200 pt-2 text-sm font-medium">
                        <div>{formatMoney(total) || '$0'} | Total amount</div>
                        <div className="text-slate-500">
                          {formatMoney(weighted) || '$0'} ({Math.round(stage.weight * 100)}%) | Weighted amount
                        </div>
                      </div>
                    </div>
                  )}
                </Droppable>
              )
            })}
          </div>
        </DragDropContext>
      )}
    </div>
  )
}
