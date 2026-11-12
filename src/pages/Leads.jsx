import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, ExternalLink, Loader2, Plus, Search, Trash2, Upload } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../hooks/useToast'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import LeadContactDialog from '../components/LeadContactDialog'
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
  parseJiraKey,
  sheetRowsToLeads,
} from '../lib/leads'

const BLUE_BUTTON = 'bg-[#1644ED] text-white shadow-md hover:bg-[#1238c4] hover:shadow-lg hover:shadow-[#1644ED]/25 focus-visible:ring-[#1644ED]/50'

function missingTable(error) {
  const text = `${error?.code || ''} ${error?.message || ''}`
  return text.includes('sales_leads') || text.includes('PGRST205') || text.includes('42P01')
}

function CellSelect({ className, value, options, allowBlank, onSave }) {
  return (
    <span className="relative inline-flex max-w-full items-center">
      <select
        className={`${className} appearance-none pr-6`}
        value={value || ''}
        onChange={(event) => onSave(event.target.value)}
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {allowBlank ? <option value=""></option> : null}
        {options.map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 h-3.5 w-3.5 opacity-60" />
    </span>
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
  const [editingLead, setEditingLead] = useState(null)
  const [importing, setImporting] = useState(false)
  const [selected, setSelected] = useState(() => new Set())
  const [quick, setQuick] = useState({ name: '', company: '', source: 'Direct', jira_key: '' })
  const [pendingRemove, setPendingRemove] = useState(null)
  const [overviewOpen, setOverviewOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('brandastic-leads-overview')
      if (saved === '1') return true
      if (saved === '0') return false
    } catch { /* ignore */ }
    return !embedded
  })

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('sales_leads')
      .select('*')
      .order('first_contact_date', { ascending: false, nullsFirst: false })
    if (!error) {
      setSetupNeeded(false)
      let rows = data || []
      if (!rows.length) {
        try {
          const response = await fetch(SHEET_CSV_URL)
          if (response.ok) {
            const leads = sheetRowsToLeads(await response.text())
            if (leads.length) {
              const { error: importError } = await supabase.from('sales_leads').upsert(leads, { onConflict: 'import_key', ignoreDuplicates: true })
              if (!importError) {
                const again = await supabase.from('sales_leads').select('*').order('first_contact_date', { ascending: false, nullsFirst: false })
                rows = again.data || []
                toast({ title: `Imported ${leads.length} leads from the sheet` })
              }
            }
          }
        } catch {
          /* keep empty table */
        }
      }
      setRows(rows)
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
    setEditingLead(null)
    setDialogOpen(true)
  }

  function openEdit(row) {
    setEditingLead(row)
    setDialogOpen(true)
  }

  async function patchRow(id, fields) {
    if (setupNeeded) return
    const nextFields = { ...fields, updated_at: new Date().toISOString() }
    if ('jira_key' in nextFields) {
      nextFields.jira_key = parseJiraKey(nextFields.jira_key)
      if (nextFields.jira_key) {
        const current = rows.find((row) => row.id === id)
        if (!current?.quality || current.quality === 'New lead') nextFields.quality = 'Good Lead'
        if (!current?.pipeline_stage) nextFields.pipeline_stage = 'lead'
      }
    }
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...nextFields } : row)))
    let { error } = await supabase.from('sales_leads').update(nextFields).eq('id', id)
    if (error && String(error.message || '').includes('pipeline_stage')) {
      const { pipeline_stage, ...rest } = nextFields
      error = (await supabase.from('sales_leads').update(rest).eq('id', id)).error
    }
    if (error) toast({ title: 'Could not save', description: error.message, variant: 'destructive' })
    else if (nextFields.jira_key) toast({ title: `${nextFields.jira_key} is on the pipeline as a Lead` })
  }

  function toggleSelected(id, on) {
    setSelected((current) => {
      const next = new Set(current)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function toggleShown(on) {
    setSelected((current) => {
      const next = new Set(current)
      for (const row of shown) {
        if (on) next.add(row.id)
        else next.delete(row.id)
      }
      return next
    })
  }

  async function deleteLead(row) {
    if (!setupNeeded) {
      const { error } = await supabase.from('sales_leads').delete().eq('id', row.id)
      if (error) {
        toast({ title: 'Could not remove lead', description: error.message, variant: 'destructive' })
        return
      }
    }
    setRows((current) => current.filter((item) => item.id !== row.id))
    setSelected((current) => {
      const next = new Set(current)
      next.delete(row.id)
      return next
    })
    setPendingRemove(null)
  }

  async function bulkStage(stageId, quality) {
    const ids = [...selected]
    if (!ids.length) return
    const patch = { pipeline_stage: stageId, quality, updated_at: new Date().toISOString() }
    setRows((current) => current.map((row) => (ids.includes(row.id) ? { ...row, ...patch } : row)))
    let { error } = await supabase.from('sales_leads').update(patch).in('id', ids)
    if (error && String(error.message || '').includes('pipeline_stage')) {
      const { pipeline_stage, ...rest } = patch
      error = (await supabase.from('sales_leads').update(rest).in('id', ids)).error
    }
    if (error) toast({ title: 'Could not move leads', description: error.message, variant: 'destructive' })
    else {
      toast({ title: `${ids.length} moved to ${quality || stageId}` })
      setSelected(new Set())
    }
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
    const jira = parseJiraKey(quick.jira_key)
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
    let result = await supabase.from('sales_leads').insert(payload).select('*').single()
    if (result.error && String(result.error.message || '').includes('pipeline_stage')) {
      const { pipeline_stage, ...rest } = payload
      result = await supabase.from('sales_leads').insert(rest).select('*').single()
    }
    if (result.error) {
      toast({ title: 'Could not add lead', description: result.error.message, variant: 'destructive' })
      return
    }
    const created = result.data
    if (created) setRows((current) => [created, ...current.filter((row) => row.id !== created.id)])
    else await load()
    setQuick({ name: '', company: '', source: 'Direct', jira_key: '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
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

      {!setupNeeded ? (
        <div className="mb-4 rounded-xl border border-[#1644ED]/20 bg-[#1644ED]/5 p-3">
          <p className="mb-2 text-sm font-semibold">Add a lead</p>
          <div className="grid gap-2 md:grid-cols-5">
            <Input placeholder="Name" value={quick.name} onChange={(event) => setQuick((c) => ({ ...c, name: event.target.value }))} />
            <Input placeholder="Company" value={quick.company} onChange={(event) => setQuick((c) => ({ ...c, company: event.target.value }))} />
            <select className="h-10 rounded-lg border bg-background px-3 text-sm" value={quick.source} onChange={(event) => setQuick((c) => ({ ...c, source: event.target.value }))}>
              {LEAD_SOURCES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <Input placeholder="Jira key (optional)" value={quick.jira_key} onChange={(event) => setQuick((c) => ({ ...c, jira_key: event.target.value }))} />
            <Button className={BLUE_BUTTON} onClick={quickAdd}>Add lead</Button>
          </div>
        </div>
      ) : null}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" value={query} placeholder="Search name, company, email, Jira, notes" onChange={(event) => setQuery(event.target.value)} />
        </div>
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
        <button
          type="button"
          className="ml-auto inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm text-muted-foreground hover:text-foreground"
          onClick={() => {
            setOverviewOpen((open) => {
              const next = !open
              try { localStorage.setItem('brandastic-leads-overview', next ? '1' : '0') } catch { /* ignore */ }
              return next
            })
          }}
        >
          {overviewOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {overviewOpen ? 'Hide overview' : 'Overview'}
        </button>
      </div>

      {overviewOpen ? (
        <>
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

          <div className="mb-3 flex flex-col gap-2 lg:flex-row">
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

          {setupNeeded ? (
            <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
              Showing the Google Sheet copy. Add and inline edit turn on after the leads table exists — run supabase/sales-leads.sql in Supabase.
            </div>
          ) : null}
        </>
      ) : null}

      <p className="mb-2 text-sm text-muted-foreground">{shown.length} showing · check rows to move many at once · click a name row to open the contact</p>

      {selected.size ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-brand-orange/30 bg-orange-50 px-3 py-2 text-sm">
          <span className="font-semibold">{selected.size} selected</span>
          <Button size="sm" className="rounded-full bg-green-600 text-white hover:bg-green-700" onClick={() => bulkStage('won', 'Closed')}>Mark closed won</Button>
          <Button size="sm" variant="outline" onClick={() => bulkStage('proposal', 'Proposal sent')}>Proposal sent</Button>
          <Button size="sm" variant="outline" onClick={() => bulkStage('lead', 'Good Lead')}>Back to lead</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      ) : null}

      <div className="overflow-auto rounded-xl border border-slate-300 bg-white shadow-sm" style={{ maxHeight: '70vh' }}>
        <table className="min-w-[1600px] w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 text-xs uppercase tracking-wide text-white">
            <tr>
              <th className="border border-slate-300 bg-slate-600 px-2 py-3">
                <input
                  type="checkbox"
                  checked={shown.length > 0 && shown.every((row) => selected.has(row.id))}
                  onChange={(event) => toggleShown(event.target.checked)}
                />
              </th>
              <th className="whitespace-nowrap border border-slate-300 bg-slate-700 px-3 py-3 font-medium">Date</th>
              <th className="whitespace-nowrap border border-slate-300 bg-sky-600 px-3 py-3 font-medium">Channel</th>
              <th className="whitespace-nowrap border border-slate-300 bg-indigo-600 px-3 py-3 font-medium">Jira</th>
              <th className="whitespace-nowrap border border-slate-300 bg-emerald-600 px-3 py-3 font-medium">Name</th>
              <th className="whitespace-nowrap border border-slate-300 bg-teal-600 px-3 py-3 font-medium">Company</th>
              <th className="whitespace-nowrap border border-slate-300 bg-cyan-700 px-3 py-3 font-medium">Phone</th>
              <th className="whitespace-nowrap border border-slate-300 bg-blue-600 px-3 py-3 font-medium">Email</th>
              <th className="whitespace-nowrap border border-slate-300 bg-violet-600 px-3 py-3 font-medium">Notes</th>
              <th className="whitespace-nowrap border border-slate-300 bg-amber-500 px-3 py-3 font-medium">Month</th>
              <th className="whitespace-nowrap border border-slate-300 bg-orange-500 px-3 py-3 font-medium">Quality</th>
              <th className="whitespace-nowrap border border-slate-300 bg-lime-600 px-3 py-3 font-medium">Close $</th>
              <th className="whitespace-nowrap border border-slate-300 bg-fuchsia-600 px-3 py-3 font-medium">Referred by</th>
              <th className="whitespace-nowrap border border-slate-300 bg-rose-500 px-3 py-3 font-medium">Deal type</th>
              <th className="whitespace-nowrap border border-slate-300 bg-green-700 px-3 py-3 font-medium">2026 value</th>
              <th className="w-12 border border-slate-300 bg-slate-500 px-2 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={16} className="border border-slate-300 px-3 py-10 text-muted-foreground">Loading leads…</td></tr>
            ) : shown.length === 0 ? (
              <tr><td colSpan={16} className="border border-slate-300 px-3 py-10 text-muted-foreground">Nothing matches. Add a lead above.</td></tr>
            ) : shown.map((row) => {
              const link = jiraUrl(row.jira_key)
              const cell = 'border border-slate-300 px-2 py-1.5 align-middle'
              return (
                <tr key={row.id} className="cursor-pointer" onClick={() => { if (!setupNeeded) openEdit(row) }}>
                  <td className={`${cell} bg-white`} onClick={(event) => event.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(row.id)} onChange={(event) => toggleSelected(row.id, event.target.checked)} />
                  </td>
                  <td className={`${cell} whitespace-nowrap bg-slate-50`}>
                    <input className="h-8 w-[132px] rounded border-0 bg-transparent px-1 text-sm" type="date" defaultValue={row.first_contact_date || ''} disabled={setupNeeded} onBlur={(event) => patchRow(row.id, { first_contact_date: event.target.value || null, month: monthLabel(event.target.value) })} />
                  </td>
                  <td className={`${cell} bg-sky-50`}>
                    <CellSelect
                      className={`h-8 max-w-[170px] rounded-full px-2 text-xs font-semibold ${chipClass(CHANNEL_COLORS, row.source)}`}
                      value={row.source}
                      options={LEAD_SOURCES}
                      onSave={(value) => patchRow(row.id, { source: value })}
                    />
                  </td>
                  <td className={`${cell} whitespace-nowrap bg-indigo-50`}>
                    <div className="flex items-center gap-1">
                      <input className="h-8 w-24 rounded border bg-white px-1.5 text-sm" defaultValue={row.jira_key || ''} disabled={setupNeeded} onBlur={(event) => patchRow(row.id, { jira_key: event.target.value.trim() })} />
                      {link ? <a className="text-[#1644ED]" href={link} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}><ExternalLink className="h-3.5 w-3.5" /></a> : null}
                    </div>
                  </td>
                  <td className={`${cell} bg-emerald-50`}><input className="h-8 w-full min-w-[110px] rounded border-0 bg-transparent px-1 font-medium" defaultValue={row.name || ''} disabled={setupNeeded} onBlur={(event) => patchRow(row.id, { name: event.target.value.trim() })} /></td>
                  <td className={`${cell} bg-teal-50`}><input className="h-8 w-full min-w-[120px] rounded border-0 bg-transparent px-1" defaultValue={row.company || ''} disabled={setupNeeded} onBlur={(event) => patchRow(row.id, { company: event.target.value.trim() })} /></td>
                  <td className={`${cell} bg-cyan-50`}><input className="h-8 w-full min-w-[110px] rounded border-0 bg-transparent px-1" defaultValue={row.telephone || ''} disabled={setupNeeded} onBlur={(event) => patchRow(row.id, { telephone: event.target.value.trim() })} /></td>
                  <td className={`${cell} bg-blue-50`}><input className="h-8 w-full min-w-[150px] rounded border-0 bg-transparent px-1" defaultValue={row.email || ''} disabled={setupNeeded} onBlur={(event) => patchRow(row.id, { email: event.target.value.trim() })} /></td>
                  <td className={`${cell} bg-violet-50`}>
                    <button type="button" className="max-w-[180px] truncate text-left text-muted-foreground hover:text-foreground" onClick={() => openEdit(row)}>{row.notes || 'Notes…'}</button>
                  </td>
                  <td className={`${cell} bg-amber-50`}><input className="h-8 w-16 rounded border-0 bg-transparent px-1" defaultValue={row.month || ''} disabled={setupNeeded} onBlur={(event) => patchRow(row.id, { month: event.target.value.trim() })} /></td>
                  <td className={`${cell} bg-orange-50`}>
                    <CellSelect
                      className={`h-8 max-w-[190px] rounded-full px-2 text-xs font-semibold ${chipClass(QUALITY_COLORS, row.quality)}`}
                      value={row.quality}
                      options={LEAD_QUALITIES}
                      allowBlank
                      onSave={(value) => patchRow(row.id, { quality: value })}
                    />
                  </td>
                  <td className={`${cell} whitespace-nowrap bg-lime-50`}>
                    <input className="h-8 w-24 rounded border-0 bg-transparent px-1" defaultValue={row.close_amount ?? ''} disabled={setupNeeded} onBlur={(event) => patchRow(row.id, { close_amount: event.target.value === '' ? null : Number(event.target.value) })} />
                  </td>
                  <td className={`${cell} bg-fuchsia-50`}><input className="h-8 w-full min-w-[110px] rounded border-0 bg-transparent px-1" defaultValue={row.referred_by || ''} disabled={setupNeeded} onBlur={(event) => patchRow(row.id, { referred_by: event.target.value.trim() })} /></td>
                  <td className={`${cell} bg-rose-50`}>
                    <CellSelect className="h-8 rounded bg-transparent text-sm" value={row.deal_type} options={DEAL_TYPES} allowBlank onSave={(value) => patchRow(row.id, { deal_type: value || null })} />
                  </td>
                  <td className={`${cell} whitespace-nowrap bg-green-50`}>
                    <input className="h-8 w-24 rounded border-0 bg-transparent px-1" defaultValue={row.value_2026 ?? ''} disabled={setupNeeded} onBlur={(event) => patchRow(row.id, { value_2026: event.target.value === '' ? null : Number(event.target.value) })} />
                  </td>
                  <td className={`${cell} bg-white text-center`} onClick={(event) => event.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setPendingRemove(row)}
                      className="inline-flex rounded-md p-2 text-red-600 hover:bg-red-50"
                      title="Remove lead"
                      aria-label="Remove lead"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {pendingRemove ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <p className="text-base font-semibold">Are you sure you want to remove this?</p>
            <p className="mt-2 text-sm text-slate-600">{pendingRemove.name || pendingRemove.company || 'This lead'}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setPendingRemove(null)} className="rounded-lg border px-3 py-2 text-sm">Cancel</button>
              <button type="button" onClick={() => deleteLead(pendingRemove)} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white">Remove</button>
            </div>
          </div>
        </div>
      ) : null}

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
