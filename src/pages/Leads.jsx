import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Loader2, Plus, Search, Upload } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../hooks/useToast'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import {
  CHANNEL_COLORS,
  DEAL_TYPES,
  LEAD_QUALITIES,
  LEAD_SOURCES,
  QUALITY_COLORS,
  SHEET_CSV_URL,
  chipClass,
  displayDate,
  formatMoney,
  jiraUrl,
  monthLabel,
  sheetRowsToLeads,
} from '../lib/leads'

const BLUE_BUTTON = 'bg-[#1644ED] text-white shadow-md hover:bg-[#1238c4] hover:shadow-lg hover:shadow-[#1644ED]/25 focus-visible:ring-[#1644ED]/50'

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
  value_2026: '',
}

function missingTable(error) {
  const text = `${error?.code || ''} ${error?.message || ''}`
  return text.includes('sales_leads') || text.includes('PGRST205') || text.includes('42P01')
}

function CellSelect({ className, value, options, allowBlank, onSave }) {
  return (
    <select
      className={className}
      value={value || ''}
      onChange={(event) => onSave(event.target.value)}
      onClick={(event) => event.stopPropagation()}
    >
      {allowBlank ? <option value=""></option> : null}
      {options.map((item) => (
        <option key={item} value={item}>{item}</option>
      ))}
    </select>
  )
}

export default function Leads({ embedded = false }) {
  const { toast } = useToast()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [setupNeeded, setSetupNeeded] = useState(false)
  const [query, setQuery] = useState('')
  const [quality, setQuality] = useState('all')
  const [source, setSource] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [draft, setDraft] = useState(EMPTY)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [quick, setQuick] = useState({ name: '', company: '', source: 'Direct', jira_key: '' })

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('sales_leads')
      .select('*')
      .order('first_contact_date', { ascending: false, nullsFirst: false })
    if (!error) {
      setSetupNeeded(false)
      setRows(data || [])
      setLoading(false)
      return
    }
    if (!missingTable(error)) {
      toast({ title: 'Could not load leads', description: error.message, variant: 'destructive' })
      setRows([])
      setLoading(false)
      return
    }
    try {
      const response = await fetch(SHEET_CSV_URL)
      if (!response.ok) throw new Error(`Sheet download failed (${response.status})`)
      const leads = sheetRowsToLeads(await response.text())
        .map((lead) => ({ ...lead, id: lead.import_key }))
        .sort((a, b) => String(b.first_contact_date || '').localeCompare(String(a.first_contact_date || '')))
      setSetupNeeded(true)
      setRows(leads)
    } catch (sheetError) {
      setSetupNeeded(true)
      setRows([])
      toast({ title: 'Could not load the sheet', description: sheetError.message, variant: 'destructive' })
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const counts = useMemo(() => ({
    all: rows.length,
    jira: rows.filter((row) => row.jira_key).length,
    good: rows.filter((row) => row.quality === 'Good Lead' || row.jira_key).length,
    proposal: rows.filter((row) => row.quality === 'Proposal sent').length,
    closed: rows.filter((row) => row.quality === 'Closed').length,
  }), [rows])

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (quality === 'blank' && row.quality) return false
      if (quality === 'pipeline' && !row.jira_key) return false
      if (quality !== 'all' && quality !== 'blank' && quality !== 'pipeline' && row.quality !== quality) return false
      if (source !== 'all' && row.source !== source) return false
      if (!needle) return true
      return [row.source, row.name, row.company, row.email, row.telephone, row.notes, row.jira_key, row.referred_by]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    })
  }, [rows, query, quality, source])

  function openNew() {
    const today = new Date().toISOString().slice(0, 10)
    setEditingId(null)
    setDraft({ ...EMPTY, first_contact_date: today, month: monthLabel(today) })
    setDialogOpen(true)
  }

  function openEdit(row) {
    setEditingId(row.id)
    setDraft({
      source: row.source || '',
      first_contact_date: row.first_contact_date || '',
      jira_key: row.jira_key || '',
      name: row.name || '',
      company: row.company || '',
      telephone: row.telephone || '',
      email: row.email || '',
      notes: row.notes || '',
      month: row.month || '',
      quality: row.quality || '',
      close_amount: row.close_amount ?? '',
      referred_by: row.referred_by || '',
      deal_type: row.deal_type || '',
      value_2026: row.value_2026 ?? '',
    })
    setDialogOpen(true)
  }

  function updateDraft(field, value) {
    setDraft((current) => {
      const next = { ...current, [field]: value }
      if (field === 'first_contact_date') next.month = monthLabel(value)
      return next
    })
  }

  function payloadFromDraft() {
    const amount = (value) => {
      if (value === '' || value == null) return null
      const number = Number(value)
      return Number.isFinite(number) ? number : null
    }
    const jira = draft.jira_key.trim()
    return {
      source: draft.source.trim(),
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
      value_2026: amount(draft.value_2026),
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
    if (payload.jira_key && !editingId) payload.pipeline_stage = 'lead'
    let result = editingId
      ? await supabase.from('sales_leads').update(payload).eq('id', editingId)
      : await supabase.from('sales_leads').insert(payload)
    if (result.error && String(result.error.message || '').includes('pipeline_stage')) {
      const { pipeline_stage, ...rest } = payload
      result = editingId
        ? await supabase.from('sales_leads').update(rest).eq('id', editingId)
        : await supabase.from('sales_leads').insert(rest)
    }
    setSaving(false)
    if (result.error) {
      toast({ title: 'Could not save lead', description: result.error.message, variant: 'destructive' })
      return
    }
    setDialogOpen(false)
    await load()
  }

  async function patchRow(id, fields) {
    if (setupNeeded) return
    const nextFields = { ...fields, updated_at: new Date().toISOString() }
    if (nextFields.jira_key && !nextFields.quality) {
      const current = rows.find((row) => row.id === id)
      if (!current?.quality) nextFields.quality = 'Good Lead'
    }
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...nextFields } : row)))
    const { error } = await supabase.from('sales_leads').update(nextFields).eq('id', id)
    if (error) toast({ title: 'Could not save', description: error.message, variant: 'destructive' })
  }

  async function deleteLead() {
    if (!editingId) return
    setSaving(true)
    const { error } = await supabase.from('sales_leads').delete().eq('id', editingId)
    setSaving(false)
    if (error) {
      toast({ title: 'Could not delete lead', description: error.message, variant: 'destructive' })
      return
    }
    setDialogOpen(false)
    await load()
  }

  async function importSheet() {
    setImporting(true)
    try {
      const response = await fetch(SHEET_CSV_URL)
      if (!response.ok) throw new Error(`Sheet download failed (${response.status})`)
      const leads = sheetRowsToLeads(await response.text())
      const { error } = await supabase.from('sales_leads').upsert(leads, { onConflict: 'import_key', ignoreDuplicates: true })
      if (error) throw error
      toast({ title: `Imported ${leads.length} leads from the sheet` })
      await load()
    } catch (error) {
      toast({ title: 'Import failed', description: error.message, variant: 'destructive' })
    } finally {
      setImporting(false)
    }
  }

  async function quickAdd() {
    if (!quick.name.trim() && !quick.company.trim()) {
      toast({ title: 'Add a name or company', variant: 'destructive' })
      return
    }
    const today = new Date().toISOString().slice(0, 10)
    const jira = quick.jira_key.trim()
    const payload = {
      source: quick.source,
      name: quick.name.trim(),
      company: quick.company.trim(),
      jira_key: jira,
      first_contact_date: today,
      month: monthLabel(today),
      quality: jira ? 'Good Lead' : 'New lead',
      pipeline_stage: jira ? 'lead' : null,
      updated_at: new Date().toISOString(),
    }
    let result = await supabase.from('sales_leads').insert(payload)
    if (result.error && String(result.error.message || '').includes('pipeline_stage')) {
      const { pipeline_stage, ...rest } = payload
      result = await supabase.from('sales_leads').insert(rest)
    }
    if (result.error) {
      toast({ title: 'Could not add lead', description: result.error.message, variant: 'destructive' })
      return
    }
    setQuick({ name: '', company: '', source: 'Direct', jira_key: '' })
    await load()
  }

  const filters = [
    { id: 'all', label: `All ${counts.all}` },
    { id: 'pipeline', label: `On pipeline ${counts.jira}` },
    { id: 'Good Lead', label: `Good ${counts.good}` },
    { id: 'Proposal sent', label: `Proposal ${counts.proposal}` },
    { id: 'Closed', label: `Closed ${counts.closed}` },
  ]

  return (
    <div className={embedded ? 'px-4 pb-8 pt-4' : 'min-h-screen bg-background p-4 sm:p-6 lg:p-8'}>
      {!embedded ? (
        <div className="mb-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Leads</p>
          <h1 className="mt-1 text-2xl font-semibold">All leads</h1>
        </div>
      ) : null}

      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        {[
          { label: 'Leads', value: counts.all, className: 'bg-[#cfe8f8]' },
          { label: 'With Jira / pipeline', value: counts.jira, className: 'bg-[#b6d7a8]' },
          { label: 'Proposals', value: counts.proposal, className: 'bg-[#fee6b8]' },
          { label: 'Closed', value: counts.closed, className: 'bg-[#bbf7d0]' },
        ].map((card) => (
          <div key={card.label} className={`rounded-xl px-4 py-3 ${card.className}`}>
            <div className="text-xs font-medium uppercase tracking-wide opacity-70">{card.label}</div>
            <div className="text-2xl font-bold">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setQuality(item.id)}
            className={`rounded-full px-3 py-1 text-sm font-medium ${quality === item.id ? 'bg-slate-900 text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-col gap-2 lg:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" value={query} placeholder="Search name, company, email, Jira, notes" onChange={(event) => setQuery(event.target.value)} />
        </div>
        <select className="h-10 rounded-lg border bg-background px-3 text-sm" value={source} onChange={(event) => setSource(event.target.value)}>
          <option value="all">All channels</option>
          {LEAD_SOURCES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <Button variant="outline" onClick={importSheet} disabled={importing || setupNeeded}>
          {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          Import sheet
        </Button>
        <Button className={BLUE_BUTTON} onClick={openNew} disabled={setupNeeded}>
          <Plus className="mr-2 h-4 w-4" />
          Full add
        </Button>
      </div>

      {!setupNeeded ? (
        <div className="mb-3 grid gap-2 rounded-xl border bg-muted/30 p-3 md:grid-cols-5">
          <Input placeholder="Name" value={quick.name} onChange={(event) => setQuick((c) => ({ ...c, name: event.target.value }))} />
          <Input placeholder="Company" value={quick.company} onChange={(event) => setQuick((c) => ({ ...c, company: event.target.value }))} />
          <select className="h-10 rounded-lg border bg-background px-3 text-sm" value={quick.source} onChange={(event) => setQuick((c) => ({ ...c, source: event.target.value }))}>
            {LEAD_SOURCES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <Input placeholder="Jira key → pipeline" value={quick.jira_key} onChange={(event) => setQuick((c) => ({ ...c, jira_key: event.target.value }))} />
          <Button className={BLUE_BUTTON} onClick={quickAdd}>Add lead</Button>
        </div>
      ) : (
        <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          Showing the Google Sheet copy. Add and inline edit turn on after the leads table exists — run supabase/sales-leads.sql in Supabase.
        </div>
      )}

      <p className="mb-2 text-sm text-muted-foreground">{shown.length} showing · click a cell to edit · Jira key sends them to the pipeline</p>

      <div className="overflow-auto rounded-xl border bg-white shadow-sm" style={{ maxHeight: '70vh' }}>
        <table className="min-w-[1500px] w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-900 text-xs uppercase tracking-wide text-white">
            <tr>
              {['Date', 'Channel', 'Jira', 'Name', 'Company', 'Phone', 'Email', 'Notes', 'Month', 'Quality', 'Close $', 'Referred by', 'Deal type', '2026 value'].map((label) => (
                <th key={label} className="whitespace-nowrap px-3 py-3 font-medium">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={14} className="px-3 py-10 text-muted-foreground">Loading leads…</td></tr>
            ) : shown.length === 0 ? (
              <tr><td colSpan={14} className="px-3 py-10 text-muted-foreground">Nothing matches. Add a lead above.</td></tr>
            ) : shown.map((row) => {
              const link = jiraUrl(row.jira_key)
              const cell = 'border-t px-2 py-1.5 align-middle'
              return (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className={`${cell} whitespace-nowrap`}>
                    <input className="h-8 w-[132px] rounded border-0 bg-transparent px-1 text-sm" type="date" defaultValue={row.first_contact_date || ''} disabled={setupNeeded} onBlur={(event) => patchRow(row.id, { first_contact_date: event.target.value || null, month: monthLabel(event.target.value) })} />
                  </td>
                  <td className={cell}>
                    <CellSelect
                      className={`h-8 max-w-[170px] rounded-full px-2 text-xs font-semibold ${chipClass(CHANNEL_COLORS, row.source)}`}
                      value={row.source}
                      options={LEAD_SOURCES}
                      onSave={(value) => patchRow(row.id, { source: value })}
                    />
                  </td>
                  <td className={`${cell} whitespace-nowrap`}>
                    <div className="flex items-center gap-1">
                      <input className="h-8 w-24 rounded border px-1.5 text-sm" defaultValue={row.jira_key || ''} disabled={setupNeeded} onBlur={(event) => patchRow(row.id, { jira_key: event.target.value.trim() })} />
                      {link ? <a className="text-[#1644ED]" href={link} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}><ExternalLink className="h-3.5 w-3.5" /></a> : null}
                    </div>
                  </td>
                  <td className={cell}><input className="h-8 w-full min-w-[110px] rounded border-0 bg-transparent px-1 font-medium" defaultValue={row.name || ''} disabled={setupNeeded} onBlur={(event) => patchRow(row.id, { name: event.target.value.trim() })} /></td>
                  <td className={cell}><input className="h-8 w-full min-w-[120px] rounded border-0 bg-transparent px-1" defaultValue={row.company || ''} disabled={setupNeeded} onBlur={(event) => patchRow(row.id, { company: event.target.value.trim() })} /></td>
                  <td className={cell}><input className="h-8 w-full min-w-[110px] rounded border-0 bg-transparent px-1" defaultValue={row.telephone || ''} disabled={setupNeeded} onBlur={(event) => patchRow(row.id, { telephone: event.target.value.trim() })} /></td>
                  <td className={cell}><input className="h-8 w-full min-w-[150px] rounded border-0 bg-transparent px-1" defaultValue={row.email || ''} disabled={setupNeeded} onBlur={(event) => patchRow(row.id, { email: event.target.value.trim() })} /></td>
                  <td className={cell}>
                    <button type="button" className="max-w-[180px] truncate text-left text-muted-foreground hover:text-foreground" onClick={() => openEdit(row)}>{row.notes || 'Notes…'}</button>
                  </td>
                  <td className={cell}><input className="h-8 w-16 rounded border-0 bg-transparent px-1" defaultValue={row.month || ''} disabled={setupNeeded} onBlur={(event) => patchRow(row.id, { month: event.target.value.trim() })} /></td>
                  <td className={cell}>
                    <CellSelect
                      className={`h-8 max-w-[190px] rounded-full px-2 text-xs font-semibold ${chipClass(QUALITY_COLORS, row.quality)}`}
                      value={row.quality}
                      options={LEAD_QUALITIES}
                      allowBlank
                      onSave={(value) => patchRow(row.id, { quality: value })}
                    />
                  </td>
                  <td className={`${cell} whitespace-nowrap`}>
                    <input className="h-8 w-24 rounded border-0 bg-transparent px-1" defaultValue={row.close_amount ?? ''} disabled={setupNeeded} onBlur={(event) => patchRow(row.id, { close_amount: event.target.value === '' ? null : Number(event.target.value) })} />
                  </td>
                  <td className={cell}><input className="h-8 w-full min-w-[110px] rounded border-0 bg-transparent px-1" defaultValue={row.referred_by || ''} disabled={setupNeeded} onBlur={(event) => patchRow(row.id, { referred_by: event.target.value.trim() })} /></td>
                  <td className={cell}>
                    <CellSelect className="h-8 rounded bg-transparent text-sm" value={row.deal_type} options={DEAL_TYPES} allowBlank onSave={(value) => patchRow(row.id, { deal_type: value || null })} />
                  </td>
                  <td className={`${cell} whitespace-nowrap`}>
                    <input className="h-8 w-24 rounded border-0 bg-transparent px-1" defaultValue={row.value_2026 ?? ''} disabled={setupNeeded} onBlur={(event) => patchRow(row.id, { value_2026: event.target.value === '' ? null : Number(event.target.value) })} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit lead' : 'Add lead'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Source">
              <select className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={draft.source} onChange={(event) => updateDraft('source', event.target.value)}>
                <option value=""> </option>
                {LEAD_SOURCES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </Field>
            <Field label="Date of 1st contact">
              <Input type="date" value={draft.first_contact_date} onChange={(event) => updateDraft('first_contact_date', event.target.value)} />
            </Field>
            <Field label="Jira key">
              <Input value={draft.jira_key} placeholder="CCE-1" onChange={(event) => updateDraft('jira_key', event.target.value)} />
            </Field>
            <Field label="Month">
              <Input value={draft.month} onChange={(event) => updateDraft('month', event.target.value)} />
            </Field>
            <Field label="Name">
              <Input value={draft.name} onChange={(event) => updateDraft('name', event.target.value)} />
            </Field>
            <Field label="Company">
              <Input value={draft.company} onChange={(event) => updateDraft('company', event.target.value)} />
            </Field>
            <Field label="Telephone">
              <Input value={draft.telephone} onChange={(event) => updateDraft('telephone', event.target.value)} />
            </Field>
            <Field label="Email">
              <Input type="email" value={draft.email} onChange={(event) => updateDraft('email', event.target.value)} />
            </Field>
            <Field label="Quality">
              <select className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={draft.quality} onChange={(event) => updateDraft('quality', event.target.value)}>
                <option value=""> </option>
                {LEAD_QUALITIES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </Field>
            <Field label="Deal type">
              <select className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={draft.deal_type} onChange={(event) => updateDraft('deal_type', event.target.value)}>
                <option value=""> </option>
                {DEAL_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </Field>
            <Field label="Close amount">
              <Input type="number" value={draft.close_amount} onChange={(event) => updateDraft('close_amount', event.target.value)} />
            </Field>
            <Field label="2026 value">
              <Input type="number" value={draft.value_2026} onChange={(event) => updateDraft('value_2026', event.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Referred by">
                <Input value={draft.referred_by} onChange={(event) => updateDraft('referred_by', event.target.value)} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Reason / notes">
                <Textarea value={draft.notes} onChange={(event) => updateDraft('notes', event.target.value)} />
              </Field>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {editingId ? (
              <Button variant="outline" onClick={deleteLead} disabled={saving}>Delete</Button>
            ) : <span />}
            <Button className={BLUE_BUTTON} onClick={saveLead} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block space-y-1.5">
      <Label>{label}</Label>
      {children}
    </label>
  )
}
