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
  DEAL_TYPES,
  LEAD_QUALITIES,
  LEAD_SOURCES,
  SHEET_CSV_URL,
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

export default function Leads() {
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

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (quality === 'blank' && row.quality) return false
      if (quality !== 'all' && quality !== 'blank' && row.quality !== quality) return false
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
    return {
      source: draft.source.trim(),
      first_contact_date: draft.first_contact_date || null,
      jira_key: draft.jira_key.trim(),
      name: draft.name.trim(),
      company: draft.company.trim(),
      telephone: draft.telephone.trim(),
      email: draft.email.trim(),
      notes: draft.notes.trim(),
      month: draft.month.trim() || monthLabel(draft.first_contact_date),
      quality: draft.quality.trim(),
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
    const result = editingId
      ? await supabase.from('sales_leads').update(payload).eq('id', editingId)
      : await supabase.from('sales_leads').insert(payload)
    setSaving(false)
    if (result.error) {
      toast({ title: 'Could not save lead', description: result.error.message, variant: 'destructive' })
      return
    }
    setDialogOpen(false)
    await load()
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

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Leads</p>
          <h1 className="mt-1 text-2xl font-semibold">All leads</h1>
          <p className="mt-1 text-sm text-muted-foreground">{shown.length} of {rows.length} leads</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={importSheet} disabled={importing || setupNeeded}>
            {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Import sheet
          </Button>
          <Button className={BLUE_BUTTON} onClick={openNew} disabled={setupNeeded}>
            <Plus className="mr-2 h-4 w-4" />
            Add lead
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" value={query} placeholder="Search name, company, email, notes" onChange={(event) => setQuery(event.target.value)} />
        </div>
        <select className="h-10 rounded-lg border bg-background px-3 text-sm" value={source} onChange={(event) => setSource(event.target.value)}>
          <option value="all">All sources</option>
          {LEAD_SOURCES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select className="h-10 rounded-lg border bg-background px-3 text-sm" value={quality} onChange={(event) => setQuality(event.target.value)}>
          <option value="all">All qualities</option>
          <option value="blank">No quality yet</option>
          {LEAD_QUALITIES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>

      {setupNeeded ? (
        <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          This list is the All Leads sheet. Add and Import stay off until the leads table exists. In Supabase, open the SQL editor and run <span className="font-medium">supabase/sales-leads.sql</span> once.
        </div>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-lg border">
        <table className="min-w-[1400px] w-full text-left text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {['Date', 'Source', 'Jira', 'Name', 'Company', 'Phone', 'Email', 'Notes', 'Month', 'Quality', 'Close amount', 'Referred by', 'Deal type', '2026 value'].map((label) => (
                <th key={label} className="px-3 py-2 font-medium">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={14} className="px-3 py-8 text-muted-foreground">Loading leads…</td></tr>
            ) : shown.length === 0 ? (
              <tr><td colSpan={14} className="px-3 py-8 text-muted-foreground">No leads match.</td></tr>
            ) : shown.map((row) => {
              const link = jiraUrl(row.jira_key)
              return (
                <tr
                  key={row.id}
                  className={setupNeeded ? 'border-t' : 'cursor-pointer border-t hover:bg-muted/40'}
                  onClick={() => { if (!setupNeeded) openEdit(row) }}
                >
                  <td className="whitespace-nowrap px-3 py-2">{displayDate(row.first_contact_date)}</td>
                  <td className="whitespace-nowrap px-3 py-2">{row.source}</td>
                  <td className="whitespace-nowrap px-3 py-2" onClick={(event) => event.stopPropagation()}>
                    {link ? <a className="inline-flex items-center gap-1 text-[#1644ED] hover:underline" href={link} target="_blank" rel="noreferrer">{row.jira_key} <ExternalLink className="h-3 w-3" /></a> : row.jira_key}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-medium">{row.name}</td>
                  <td className="whitespace-nowrap px-3 py-2">{row.company}</td>
                  <td className="whitespace-nowrap px-3 py-2">{row.telephone}</td>
                  <td className="whitespace-nowrap px-3 py-2">{row.email}</td>
                  <td className="max-w-[240px] truncate px-3 py-2" title={row.notes}>{row.notes}</td>
                  <td className="px-3 py-2">{row.month}</td>
                  <td className="whitespace-nowrap px-3 py-2">{row.quality}</td>
                  <td className="whitespace-nowrap px-3 py-2">{formatMoney(row.close_amount)}</td>
                  <td className="max-w-[180px] truncate px-3 py-2">{row.referred_by}</td>
                  <td className="whitespace-nowrap px-3 py-2">{row.deal_type}</td>
                  <td className="whitespace-nowrap px-3 py-2">{formatMoney(row.value_2026)}</td>
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
