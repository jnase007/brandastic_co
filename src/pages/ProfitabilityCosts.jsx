import LaborRates from '../components/LaborRates'
import { useLaborRateRows } from '../lib/laborRates'

export default function ProfitabilityCosts() {
  const { rows, setRows, overhead, setOverhead, missing, overheadMissing, profileReady, error, ready } = useLaborRateRows()

  if (!ready) {
    return (
      <div className="pr-page">
        <div className="pr-panel">
          <h1>Costs</h1>
          <p className="pr-note">Loading…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="pr-page">
      {error ? <p className="pr-note">{error}</p> : null}
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
  )
}
