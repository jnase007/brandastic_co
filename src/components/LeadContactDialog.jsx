import { useEffect, useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../hooks/useToast'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { DEAL_INTERESTS, DEAL_TYPE_LABELS, DEAL_TYPES, LEAD_QUALITIES, LEAD_SOURCES, commaMoney, monthLabel, parseJiraKey, parseMoney } from '../lib/leads'

export const PIPELINE_STAGES = [
  { id: 'lead', label: 'Lead' },
  { id: 'kickoff', label: 'Kick-Off Meeting' },
  { id: 'proposal', label: 'Proposal Sent' },
  { id: 'contract', label: 'Buy-in / Contract' },
  { id: 'won', label: 'Closed Won' },
  { id: 'lost', label: 'Closed Lost' },
]

const EMPTY = {
  source: 'Direct',
  first_contact_date: '',
  jira_key: '',
  name: '',
  company: '',
  telephone: '',
  email: '',
  notes: '',
  month: '',
  quality: '',
  close_amount: '',
  referred_by: '',
  deal_type: '',
  deal_interest: '',
  value_2026: '',
  pipeline_stage: '',
}

function draftFromLead(lead, defaultStage) {
  const today = new Date().toISOString().slice(0, 10)
  if (!lead) {
    return {
      ...EMPTY,
      first_contact_date: today,
      month: monthLabel(today),
      pipeline_stage: defaultStage || 'lead',
      quality: 'Good Lead',
    }
  }
  return {
    source: lead.source || 'Direct',
    first_contact_date: lead.first_contact_date || '',
    jira_key: lead.jira_key || '',
    name: lead.name || '',
    company: lead.company || '',
    telephone: lead.telephone || '',
    email: lead.email || '',
    notes: lead.notes || '',
    month: lead.month || '',
    quality: lead.quality || '',
    close_amount: commaMoney(lead.close_amount),
    referred_by: lead.referred_by || '',
    deal_type: lead.deal_type || '',
    deal_interest: lead.deal_interest || '',
    value_2026: commaMoney(lead.value_2026),
    pipeline_stage: lead.pipeline_stage || defaultStage || '',
  }
}

export default function LeadContactDialog({ open, onOpenChange, lead, defaultStage = 'lead', onSaved }) {
  const { toast } = useToast()
  const [draft, setDraft] = useState(() => draftFromLead(lead, defaultStage))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setDraft(draftFromLead(lead, defaultStage))
  }, [open, lead, defaultStage])

  function updateDraft(field, value) {
    setDraft((current) => {
      const next = { ...current, [field]: value }
      if (field === 'first_contact_date') next.month = monthLabel(value)
      return next
    })
  }

  function payloadFromDraft() {
    const amount = (value) => parseMoney(value)
    const jira = parseJiraKey(draft.jira_key)
    return {
      source: (draft.source || '').trim(),
      first_contact_date: draft.first_contact_date || null,
      jira_key: jira,
      name: draft.name.trim(),
      company: draft.company.trim(),
      telephone: draft.telephone.trim(),
      email: draft.email.trim(),
      notes: draft.notes.trim(),
      month: draft.month.trim() || monthLabel(draft.first_contact_date),
      quality: draft.quality.trim() || (jira ? 'Good Lead' : ''),
      close_amount: amount(draft.close_amount),
      referred_by: draft.referred_by.trim(),
      deal_type: draft.deal_type || null,
      deal_interest: (draft.deal_interest || '').trim() || null,
      value_2026: amount(draft.value_2026),
      pipeline_stage: draft.pipeline_stage || defaultStage || null,
      updated_at: new Date().toISOString(),
    }
  }

  async function saveLead() {
    if (!draft.name.trim() && !draft.company.trim()) {
      toast({ title: 'Add a name or company', variant: 'destructive' })
      return
    }
    setSaving(true)
    const payload = payloadFromDraft()
    let result = lead?.id
      ? await supabase.from('sales_leads').update(payload).eq('id', lead.id).select('*').single()
      : await supabase.from('sales_leads').insert(payload).select('*').single()
    if (result.error && String(result.error.message || '').includes('pipeline_stage')) {
      const { pipeline_stage, ...rest } = payload
      result = lead?.id
        ? await supabase.from('sales_leads').update(rest).eq('id', lead.id).select('*').single()
        : await supabase.from('sales_leads').insert(rest).select('*').single()
    }
    if (result.error && String(result.error.message || '').includes('deal_interest')) {
      const { deal_interest, ...rest } = payload
      result = lead?.id
        ? await supabase.from('sales_leads').update(rest).eq('id', lead.id).select('*').single()
        : await supabase.from('sales_leads').insert(rest).select('*').single()
    }
    setSaving(false)
    if (result.error) {
      toast({ title: 'Could not save', description: result.error.message, variant: 'destructive' })
      return
    }
    toast({ title: lead?.id ? 'Contact saved' : 'Added to Score Card and pipeline' })
    onOpenChange(false)
    onSaved?.(result.data)
  }

  async function deleteLead() {
    if (!lead?.id) return
    setSaving(true)
    const { error } = await supabase.from('sales_leads').delete().eq('id', lead.id)
    setSaving(false)
    if (error) {
      toast({ title: 'Could not delete', description: error.message, variant: 'destructive' })
      return
    }
    onOpenChange(false)
    onSaved?.(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-t-3xl border-0 bg-[#f7f8fb] sm:max-w-2xl sm:rounded-3xl sm:p-8">
        <DialogHeader className="text-left">
          <div className="mb-1 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-orange text-white">
              <Sparkles className="h-4 w-4" />
            </span>
            <DialogTitle className="text-xl font-bold">
              {lead?.id ? (draft.company || draft.name || 'Contact') : 'Add contact'}
            </DialogTitle>
          </div>
          <p className="text-sm text-slate-500">
            Same record on Score Card and Deal Pipeline. Save once — both pages see it.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {['Who', 'Channel', 'Deal'].map((step, index) => (
              <span key={step} className="inline-flex items-center gap-1.5 rounded-full bg-brand-orange px-3 py-1 text-xs font-semibold text-white">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[10px]">{index + 1}</span>
                {step}
              </span>
            ))}
          </div>
        </DialogHeader>
        <div className="space-y-5 rounded-2xl bg-white p-4 shadow-sm sm:p-5">
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Who</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name"><Input value={draft.name} onChange={(event) => updateDraft('name', event.target.value)} /></Field>
              <Field label="Company"><Input value={draft.company} onChange={(event) => updateDraft('company', event.target.value)} /></Field>
              <Field label="Phone"><Input type="tel" value={draft.telephone} onChange={(event) => updateDraft('telephone', event.target.value)} /></Field>
              <Field label="Email"><Input type="email" value={draft.email} onChange={(event) => updateDraft('email', event.target.value)} /></Field>
            </div>
          </section>
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Channel</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Source">
                <select className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={draft.source} onChange={(event) => updateDraft('source', event.target.value)}>
                  {LEAD_SOURCES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </Field>
              <Field label="First contact">
                <Input type="date" value={draft.first_contact_date} onChange={(event) => updateDraft('first_contact_date', event.target.value)} />
              </Field>
              <Field label="Referred by">
                <Input value={draft.referred_by} onChange={(event) => updateDraft('referred_by', event.target.value)} />
              </Field>
              <Field label="Jira (optional)">
                <Input value={draft.jira_key} placeholder="CCE-1 or paste a Jira link" onChange={(event) => updateDraft('jira_key', event.target.value)} />
              </Field>
            </div>
          </section>
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Deal</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Pipeline stage">
                <select
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                  value={draft.pipeline_stage || 'lead'}
                  onChange={(event) => {
                    const stage = event.target.value
                    setDraft((current) => ({
                      ...current,
                      pipeline_stage: stage,
                      quality: stage === 'won' ? 'Closed' : stage === 'proposal' || stage === 'contract' ? 'Proposal sent' : current.quality || 'Good Lead',
                    }))
                  }}
                >
                  {PIPELINE_STAGES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">Puts this deal in that column on Deal Pipeline.</p>
              </Field>
              <Field label="Deal type">
                <select className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={draft.deal_type} onChange={(event) => updateDraft('deal_type', event.target.value)}>
                  <option value=""></option>
                  {DEAL_TYPES.map((item) => <option key={item} value={item}>{DEAL_TYPE_LABELS[item] || item}</option>)}
                </select>
              </Field>
              <Field label={draft.deal_type === 'One-time' ? 'Project estimate' : draft.deal_type === 'Monthly' ? 'Monthly estimate' : 'Estimate'}>
                <Input inputMode="decimal" value={draft.value_2026} onChange={(event) => updateDraft('value_2026', commaMoney(event.target.value))} />
                <p className="mt-1 text-xs text-muted-foreground">Retainer = monthly. One-time = project total.</p>
              </Field>
              <Field label="Closed amount">
                <Input inputMode="decimal" value={draft.close_amount} onChange={(event) => updateDraft('close_amount', commaMoney(event.target.value))} />
              </Field>
              <Field label="Quality">
                <select className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={draft.quality} onChange={(event) => updateDraft('quality', event.target.value)}>
                  <option value=""></option>
                  {LEAD_QUALITIES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Deal interest">
                  <div className="flex flex-wrap gap-2">
                    {DEAL_INTERESTS.map((item) => {
                      const selected = (draft.deal_interest || '').split(',').map((part) => part.trim()).filter(Boolean)
                      const on = selected.includes(item)
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => {
                            const next = on ? selected.filter((part) => part !== item) : [...selected, item]
                            updateDraft('deal_interest', next.join(', '))
                          }}
                          className={`rounded-full border px-3 py-1 text-xs font-medium ${on ? 'border-[#1644ED] bg-[#1644ED] text-white' : 'bg-white'}`}
                        >
                          {item}
                        </button>
                      )
                    })}
                  </div>
                </Field>
              </div>
            </div>
          </section>
          <Field label="Notes">
            <Textarea rows={4} value={draft.notes} onChange={(event) => updateDraft('notes', event.target.value)} />
          </Field>
        </div>
        <DialogFooter className="gap-2 pt-2 sm:justify-between">
          {lead?.id ? (
            <Button variant="ghost" className="text-red-600" onClick={deleteLead} disabled={saving}>Delete</Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button className="rounded-full bg-brand-orange px-6 text-white hover:bg-brand-orange/90" onClick={saveLead} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save contact
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }) {
  return (
    <label className="block space-y-1.5">
      <Label className="text-sm font-semibold text-slate-800">{label}</Label>
      {children}
    </label>
  )
}
