import { useEffect, useState } from 'react'
import { DEFAULT_LOST_REASON, LOST_REASONS, summarizeAlerts, wonChecklist } from '../lib/dealPipeline'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'

const BADGE = {
  'suggest-lost': 'bg-red-100 text-red-800',
  reengage: 'bg-amber-100 text-amber-900',
  reminder: 'bg-amber-100 text-amber-900',
  priority: 'bg-orange-100 text-orange-900',
  checklist: 'bg-green-100 text-green-800',
  'checklist-done': 'bg-slate-100 text-slate-600',
  'reason-needed': 'bg-red-100 text-red-800',
  unknown: 'bg-slate-100 text-slate-600',
}

export function DealAlertBadge({ alert }) {
  if (!alert) return null
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${BADGE[alert.kind] || BADGE.unknown}`}>
      {alert.badge}
    </span>
  )
}

export function DealAlertsPanel({ rows, now, onReview }) {
  const summary = summarizeAlerts(rows, now)
  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="deal-alerts" aria-labelledby="deal-alerts-title">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="deal-alerts-title" className="text-lg font-semibold text-slate-900">Pipeline alerts</h2>
        <p className="text-xs text-slate-500">In-app only. Nothing is emailed or sent. A deal moves only when you save it.</p>
      </div>
      <p className="mb-3 text-sm text-slate-600">
        Lead is Erin, 45 days with no Kick-Off. Kick-Off notifies Justin at 30, 60, and 90 days. Proposal Sent reminds Justin after 5 business days, then every 14 days, and suggests Deal Lost at 60. Buy-In / Contract Sent has no timer.
      </p>
      <div className="mb-3 flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-full bg-red-100 px-2 py-1 text-red-800">{summary.items.filter((item) => item.kind === 'suggest-lost').length} suggest Deal Lost</span>
        <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-900">{summary.items.filter((item) => item.kind === 'reengage' || item.kind === 'reminder').length} re-engage or remind</span>
        <span className="rounded-full bg-orange-100 px-2 py-1 text-orange-900">{summary.priority} highest priority</span>
        <span className="rounded-full bg-green-100 px-2 py-1 text-green-800">{summary.items.filter((item) => item.kind === 'checklist').length} open checklists</span>
      </div>
      {summary.items.length ? (
        <ul className="max-h-36 space-y-2 overflow-y-auto">
          {summary.items.map((item) => (
            <li key={String(item.id)} className="flex flex-wrap items-start justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{item.company}</p>
                <p className="text-slate-600">{item.detail}</p>
              </div>
              {item.kind === 'suggest-lost' || item.kind === 'reason-needed' ? (
                <Button type="button" size="sm" variant="outline" onClick={() => onReview(item.id)}>
                  {item.kind === 'reason-needed' ? 'Add lost reason' : 'Review Deal Lost'}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">No timers are due in this list.</p>
      )}
      {summary.undated ? <p className="mt-2 text-xs text-slate-500">{summary.undated} deals have no date, so their timer was not run.</p> : null}
    </section>
  )
}

const CHECKLIST = [
  ['signed', 'Confirm the signed agreement'],
  ['onboarding', 'Trigger onboarding'],
  ['teamKickoff', 'Tell the team about kickoff (checklist only — nothing is sent)'],
]

export function WonChecklist({ row, onChange }) {
  const value = wonChecklist(row)
  return (
    <fieldset className="mt-2 space-y-1 border-t border-slate-100 pt-2">
      <legend className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Deal Won checklist</legend>
      {CHECKLIST.map(([key, label]) => (
        <label key={key} className="flex items-start gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={Boolean(value[key])}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => onChange({ ...value, [key]: event.target.checked })}
          />
          <span>{label}</span>
        </label>
      ))}
    </fieldset>
  )
}

export function DealLostDialog({ open, rows, onOpenChange, onSave }) {
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [followUp, setFollowUp] = useState('')
  const single = rows.length === 1 ? rows[0] : null

  useEffect(() => {
    if (!open) return
    setReason(single?.lost_reason || DEFAULT_LOST_REASON)
    setNote(single?.lost_note || '')
    setFollowUp(single?.follow_up_recommendation || '')
  }, [open, single])

  const moving = rows.some((row) => String(row?.pipeline_stage || '').toLowerCase() !== 'lost')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{moving ? 'Move to Deal Lost' : 'Deal Lost'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-slate-600">
            {rows.map((row) => row.company || row.name || 'Untitled').join(', ') || 'This deal'}
            {moving ? ' will stay put until you save.' : ' already sits in Deal Lost.'}
          </p>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Lost reason</span>
            <select
              aria-label="Lost reason"
              className="h-10 w-full rounded-lg border bg-white px-3 text-sm"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            >
              <option value="">Select a reason</option>
              {LOST_REASONS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Internal note</span>
            <Textarea aria-label="Internal note" rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Follow-up recommendation</span>
            <Textarea aria-label="Follow-up recommendation" rows={2} value={followUp} onChange={(event) => setFollowUp(event.target.value)} placeholder="Revisitable — this does not schedule anything" />
          </label>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            type="button"
            onClick={() => onSave({ reason: reason || DEFAULT_LOST_REASON, note: note.trim(), followUp: followUp.trim() })}
          >
            {moving ? 'Save Deal Lost' : 'Save lost reason'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
