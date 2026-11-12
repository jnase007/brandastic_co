import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader'
import { BRAND_CARE_SEED } from '../lib/brandCareSeed'

const KEY = 'brandastic-brand-care-roster'
const ROLES = [
  { key: 'marketingManager', label: 'Marketing Manager' },
  { key: 'accountSpecialist', label: 'Account Specialist' },
  { key: 'coordinator', label: 'Marketing Coordinator' },
  { key: 'paidMedia', label: 'Paid Media' },
  { key: 'seo', label: 'SEO' },
  { key: 'design', label: 'Design' },
]

function loadRows() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return BRAND_CARE_SEED
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || !parsed.length) return BRAND_CARE_SEED
    return parsed
  } catch {
    return BRAND_CARE_SEED
  }
}

function Person({ name }) {
  const value = (name || '').trim()
  if (!value) {
    return <span className="text-xs text-slate-400">—</span>
  }
  return (
    <span className="inline-flex max-w-[140px] items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-900">
      {value}
    </span>
  )
}

export default function BrandCare() {
  const [rows, setRows] = useState(loadRows)
  const [editing, setEditing] = useState(false)
  const [q, setQ] = useState('')

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(rows))
  }, [rows])

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return rows
    return rows.filter((row) =>
      [row.client, row.services, row.hours, row.marketingManager, row.accountSpecialist, row.coordinator, row.paidMedia, row.seo, row.design]
        .join(' ')
        .toLowerCase()
        .includes(term)
    )
  }, [rows, q])

  const update = (index, patch) => {
    setRows((list) => list.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  return (
    <div className="px-4 py-6 sm:px-6">
      <PageHeader
        title="Brand Care"
        description="Clients, what we manage, hours by service, and who owns it. For Monday meetings."
        actions={
          <button
            type="button"
            onClick={() => setEditing((value) => !value)}
            className="rounded-lg border px-3 py-2 text-sm font-medium"
          >
            {editing ? 'Done' : 'Update'}
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
      <div className="mt-4 overflow-x-auto rounded-2xl border bg-white shadow-sm">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="bg-emerald-400 text-white">
            <tr>
              <th className="sticky left-0 z-10 bg-emerald-400 px-4 py-3 text-left font-medium">Client</th>
              <th className="px-4 py-3 text-left font-medium">What we manage</th>
              <th className="px-4 py-3 text-left font-medium">Hours by service</th>
              {ROLES.map((role) => (
                <th key={role.key} className="px-3 py-3 text-left font-medium">{role.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, index) => {
              const realIndex = rows.findIndex((item) => item.client === row.client && item.jira === row.jira)
              return (
                <tr key={`${row.client}-${row.jira}-${index}`} className={index % 2 ? 'bg-slate-50' : 'bg-white'}>
                  <td className="sticky left-0 z-10 bg-inherit px-4 py-3 font-semibold">{row.client}</td>
                  <td className="max-w-[240px] px-4 py-3 whitespace-pre-wrap text-slate-600">
                    {editing ? (
                      <textarea className="min-h-[72px] w-full rounded-md border px-2 py-1 text-sm" value={row.services} onChange={(event) => update(realIndex, { services: event.target.value })} />
                    ) : (
                      row.services || '—'
                    )}
                  </td>
                  <td className="max-w-[180px] px-4 py-3 whitespace-pre-wrap font-medium">
                    {editing ? (
                      <textarea className="min-h-[72px] w-full rounded-md border px-2 py-1 text-sm" value={row.hours} onChange={(event) => update(realIndex, { hours: event.target.value })} />
                    ) : (
                      row.hours || '—'
                    )}
                  </td>
                  {ROLES.map((role) => (
                    <td key={role.key} className="px-3 py-3">
                      {editing ? (
                        <input
                          className="h-9 w-full rounded-md border px-2 text-sm"
                          value={row[role.key] || ''}
                          onChange={(event) => update(realIndex, { [role.key]: event.target.value })}
                        />
                      ) : (
                        <Person name={row[role.key]} />
                      )}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
