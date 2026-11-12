import { useEffect, useMemo, useState } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { GripVertical, Trash2 } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { BRAND_CARE_SEED } from '../lib/brandCareSeed'

const KEY = 'brandastic-brand-care-roster'
const ROLES = [
  { key: 'marketingManager', label: 'Marketing Manager', head: 'bg-emerald-600', cell: 'bg-emerald-50' },
  { key: 'accountSpecialist', label: 'Account Specialist', head: 'bg-lime-600', cell: 'bg-lime-50' },
  { key: 'coordinator', label: 'Marketing Coordinator', head: 'bg-amber-500', cell: 'bg-amber-50' },
  { key: 'paidMedia', label: 'Paid Media', head: 'bg-indigo-600', cell: 'bg-indigo-50' },
  { key: 'seo', label: 'SEO', head: 'bg-violet-600', cell: 'bg-violet-50' },
  { key: 'design', label: 'Design', head: 'bg-rose-500', cell: 'bg-rose-50' },
]

function withIds(rows) {
  return rows.map((row, index) => ({
    id: row.id || `row-${index}-${row.client || 'new'}`,
    client: row.client || '',
    services: row.services || '',
    hours: row.hours || '',
    marketingManager: row.marketingManager || '',
    accountSpecialist: row.accountSpecialist || '',
    coordinator: row.coordinator || '',
    paidMedia: row.paidMedia || '',
    seo: row.seo || '',
    design: row.design || '',
    monday: row.monday || '',
    jira: row.jira || '',
  }))
}

function loadRows() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return withIds(BRAND_CARE_SEED)
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || !parsed.length) return withIds(BRAND_CARE_SEED)
    return withIds(parsed)
  } catch {
    return withIds(BRAND_CARE_SEED)
  }
}

function Cell({ value, multiline, onSave, placeholder }) {
  const [on, setOn] = useState(false)
  const [draft, setDraft] = useState(value || '')

  useEffect(() => {
    if (!on) setDraft(value || '')
  }, [value, on])

  const save = () => {
    setOn(false)
    if ((draft || '') !== (value || '')) onSave(draft)
  }

  if (on) {
    const cls = 'w-full rounded-md border border-[#1644ED] px-2 py-1 text-sm'
    if (multiline) {
      return (
        <textarea
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={save}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setDraft(value || '')
              setOn(false)
            }
          }}
          className={`${cls} min-h-[88px]`}
        />
      )
    }
    return (
      <input
        autoFocus
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            save()
          }
          if (event.key === 'Escape') {
            setDraft(value || '')
            setOn(false)
          }
        }}
        className={cls}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setOn(true)}
      className="w-full rounded-lg border border-transparent px-2 py-2 text-left hover:border-dashed hover:border-slate-300 hover:bg-white"
      title="Click to edit"
    >
      {value ? (
        <span className={multiline ? 'whitespace-pre-wrap text-slate-700' : 'font-medium'}>{value}</span>
      ) : (
        <span className="text-slate-400">{placeholder || 'Click to add'}</span>
      )}
    </button>
  )
}

function PersonCell({ value, onSave }) {
  const [on, setOn] = useState(false)
  const [draft, setDraft] = useState(value || '')

  useEffect(() => {
    if (!on) setDraft(value || '')
  }, [value, on])

  if (on) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          setOn(false)
          if ((draft || '') !== (value || '')) onSave(draft)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
          if (event.key === 'Escape') {
            setDraft(value || '')
            setOn(false)
          }
        }}
        className="h-9 w-full rounded-md border border-[#1644ED] px-2 text-sm"
      />
    )
  }

  const name = (value || '').trim()
  return (
    <button type="button" onClick={() => setOn(true)} className="w-full text-left" title="Click to edit">
      {name ? (
        <span className="inline-flex max-w-[150px] items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-900">
          {name}
        </span>
      ) : (
        <span className="inline-flex rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-xs text-slate-400">+ Assign</span>
      )}
    </button>
  )
}

export default function BrandCare() {
  const [rows, setRows] = useState(loadRows)
  const [q, setQ] = useState('')
  const [pendingRemove, setPendingRemove] = useState(null)

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(rows))
  }, [rows])

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return rows
    return rows.filter((row) => Object.values(row).join(' ').toLowerCase().includes(term))
  }, [rows, q])

  const update = (id, patch) => {
    setRows((list) => list.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const addClient = () => {
    setRows((list) => [
      {
        id: `row-${Date.now()}`,
        client: '',
        services: '',
        hours: '',
        marketingManager: '',
        accountSpecialist: '',
        coordinator: '',
        paidMedia: '',
        seo: '',
        design: '',
        monday: '',
        jira: '',
      },
      ...list,
    ])
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const removeClient = (id) => {
    setRows((list) => list.filter((row) => row.id !== id))
    setPendingRemove(null)
  }

  const onDragEnd = (result) => {
    if (!result.destination || q.trim()) return
    const next = Array.from(rows)
    const [moved] = next.splice(result.source.index, 1)
    next.splice(result.destination.index, 0, moved)
    setRows(next)
  }

  return (
    <div className="px-4 py-6 sm:px-6">
      <PageHeader
        title="Brand Care"
        description="Click any cell to edit. Add a client when you need a new row."
        actions={
          <button type="button" onClick={addClient} className="rounded-lg bg-[#1644ED] px-4 py-2.5 text-sm font-semibold text-white">
            Add client
          </button>
        }
      />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search clients…"
          className="h-10 w-full max-w-sm rounded-lg border px-3 text-sm"
        />
        <p className="text-sm text-muted-foreground">{visible.length} clients</p>
      </div>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-300 bg-white shadow-sm">
        <table className="w-full min-w-[1200px] border-collapse text-sm">
          <thead className="text-white">
            <tr>
              <th className="w-10 border border-slate-300 bg-slate-600 px-2 py-3" />
              <th className="sticky left-10 z-10 border border-slate-300 bg-slate-700 px-4 py-3 text-left font-medium">Client</th>
              <th className="border border-slate-300 bg-sky-600 px-4 py-3 text-left font-medium">What we manage</th>
              <th className="border border-slate-300 bg-orange-500 px-4 py-3 text-left font-medium">Hours by service</th>
              {ROLES.map((role) => (
                <th key={role.key} className={`border border-slate-300 px-3 py-3 text-left font-medium ${role.head}`}>{role.label}</th>
              ))}
              <th className="border border-slate-300 bg-fuchsia-600 px-3 py-3 text-left font-medium">Monday notes</th>
              <th className="w-12 border border-slate-300 bg-slate-500 px-2 py-3" />
            </tr>
          </thead>
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="brand-care-rows" isDropDisabled={Boolean(q.trim())}>
              {(drop) => (
                <tbody ref={drop.innerRef} {...drop.droppableProps}>
                  {visible.map((row, index) => (
                    <Draggable key={row.id} draggableId={String(row.id)} index={index} isDragDisabled={Boolean(q.trim())}>
                      {(drag) => (
                        <tr ref={drag.innerRef} {...drag.draggableProps}>
                          <td className="border border-slate-300 bg-white px-1 py-2 text-center">
                            <button type="button" {...drag.dragHandleProps} className="inline-flex cursor-grab rounded p-1 text-slate-400 hover:text-slate-700" title="Drag to reorder" aria-label="Drag to reorder">
                              <GripVertical className="h-4 w-4" />
                            </button>
                          </td>
                          <td className="sticky left-10 z-10 min-w-[160px] border border-slate-300 bg-slate-50 px-2 py-2 font-semibold">
                            <Cell value={row.client} onSave={(value) => update(row.id, { client: value })} placeholder="Client name" />
                          </td>
                          <td className="min-w-[220px] border border-slate-300 bg-sky-50 px-2 py-2">
                            <Cell multiline value={row.services} onSave={(value) => update(row.id, { services: value })} placeholder="What we manage" />
                          </td>
                          <td className="min-w-[170px] border border-slate-300 bg-orange-50 px-2 py-2">
                            <Cell multiline value={row.hours} onSave={(value) => update(row.id, { hours: value })} placeholder="Hours by service" />
                          </td>
                          {ROLES.map((role) => (
                            <td key={role.key} className={`min-w-[130px] border border-slate-300 px-2 py-2 ${role.cell}`}>
                              <PersonCell value={row[role.key]} onSave={(value) => update(row.id, { [role.key]: value })} />
                            </td>
                          ))}
                          <td className="min-w-[220px] border border-slate-300 bg-fuchsia-50 px-2 py-2">
                            <Cell multiline value={row.monday} onSave={(value) => update(row.id, { monday: value })} placeholder="Monday notes" />
                          </td>
                          <td className="border border-slate-300 bg-white px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => setPendingRemove(row)}
                              className="inline-flex rounded-md p-2 text-red-600 hover:bg-red-50"
                              title="Remove client"
                              aria-label="Remove client"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      )}
                    </Draggable>
                  ))}
                  {drop.placeholder}
                </tbody>
              )}
            </Droppable>
          </DragDropContext>
        </table>
      </div>
      {pendingRemove ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <p className="text-base font-semibold">Are you sure you want to remove this?</p>
            <p className="mt-2 text-sm text-slate-600">{pendingRemove.client || 'This client'}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setPendingRemove(null)} className="rounded-lg border px-3 py-2 text-sm">Cancel</button>
              <button type="button" onClick={() => removeClient(pendingRemove.id)} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white">Remove</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
