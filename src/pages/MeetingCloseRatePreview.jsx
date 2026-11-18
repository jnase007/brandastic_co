import fixture from '../../tests/fixtures/meeting-close-rate.json'
import { MeetingCloseRateSection } from '../components/MeetingCloseRate'

export default function MeetingCloseRatePreview() {
  return (
    <div className="min-h-screen bg-white p-4 sm:p-6">
      <p className="mb-4 text-sm text-slate-500">Fake fixture only. Example academies, not real leads.</p>
      <MeetingCloseRateSection leads={fixture} monthView="all" year={2026} />
    </div>
  )
}
