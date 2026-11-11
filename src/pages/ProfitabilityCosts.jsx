import LaborRates from '../components/LaborRates'
import { useLaborRateRows } from '../lib/laborRates'

export default function ProfitabilityCosts() {
  const { rows, setRows, overhead, setOverhead, missing, overheadMissing, profileReady, error, ready } = useLaborRateRows()

  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 sm:p-8">
        <p className="text-sm text-slate-500">Loading costs…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
        <LaborRates
          alwaysOpen
          rows={rows}
          fallback={[]}
          overhead={overhead}
          fallbackOverhead={null}
          missing={missing || overheadMissing}
          overheadMissing={overheadMissing}
          profileReady={profileReady}
          onSaved={(savedRows, savedOverhead) => {
            setRows(savedRows)
            setOverhead(savedOverhead)
          }}
        />
      </div>
    </div>
  )
}
