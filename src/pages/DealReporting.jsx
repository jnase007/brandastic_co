import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase, ensureValidSession } from '../lib/supabase'
import DealReportingDashboard from '../components/DealReports'

export default function DealReporting({ previewRows = null, previewNow = null } = {}) {
  const preview = Array.isArray(previewRows)
  const [rows, setRows] = useState(() => (preview ? previewRows : []))
  const [loading, setLoading] = useState(!preview)
  const [monthView, setMonthView] = useState('all')
  const [focus, setFocus] = useState('all')
  const now = previewNow || new Date()

  useEffect(() => {
    if (preview) return undefined
    let cancel = false
    async function load() {
      setLoading(true)
      await ensureValidSession()
      const { data, error } = await supabase.from('sales_leads').select('*').order('first_contact_date', { ascending: false })
      if (cancel) return
      setRows(error ? [] : data || [])
      setLoading(false)
    }
    load()
    return () => { cancel = true }
  }, [preview])

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
        {loading ? (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <DealReportingDashboard
            rows={rows}
            monthView={monthView}
            onMonth={setMonthView}
            now={now}
            focus={focus}
            onFocus={setFocus}
            overview
          />
        )}
      </div>
    </div>
  )
}
