import fixture from '../../tests/fixtures/deal-reporting.json'
import ScoreCardPipeline from './ScoreCardPipeline'

export default function DealsReportingPreview() {
  return (
    <div>
      <p className="bg-amber-50 px-4 py-2 text-sm text-amber-900">Fake fixture only. Example schools, not real deals.</p>
      <ScoreCardPipeline previewRows={fixture} previewNow="2026-06-10" />
    </div>
  )
}
