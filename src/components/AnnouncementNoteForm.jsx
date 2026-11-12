import '../profitability.css'

export default function AnnouncementNoteForm({ draft, saving, error, onChange, onSubmit, onCancel }) {
  return (
    <form onSubmit={onSubmit} className="an-holiday mt-6">
      <div className="an-holiday-fields an-note-fields">
        <label>
          Title
          <input
            aria-label="Note title"
            value={draft.title}
            disabled={saving}
            onChange={(event) => onChange('title', event.target.value)}
          />
        </label>
        <label>
          Details
          <input
            aria-label="Note details"
            value={draft.details}
            placeholder="Optional"
            disabled={saving}
            onChange={(event) => onChange('details', event.target.value)}
          />
        </label>
        <label>
          Start date
          <input
            aria-label="Note start date"
            type="date"
            value={draft.startDate}
            disabled={saving}
            onChange={(event) => onChange('startDate', event.target.value)}
          />
        </label>
        <label>
          End date
          <input
            aria-label="Note end date"
            type="date"
            value={draft.endDate}
            disabled={saving}
            onChange={(event) => onChange('endDate', event.target.value)}
          />
        </label>
      </div>
      {error ? <p className="pr-rates-error">{error}</p> : null}
      <div className="pr-rates-actions">
        <button type="submit" className="pr-rates-save" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        <button type="button" disabled={saving} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
