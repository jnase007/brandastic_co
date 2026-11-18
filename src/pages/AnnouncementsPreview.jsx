import Announcements from './Announcements'
import { losAngelesToday } from '../lib/announcements'

const today = losAngelesToday()

const PREVIEW = {
  holidayRows: [
    {
      id: 'fake-holiday-1',
      name: 'Example Day Off',
      start_date: '2026-07-04',
      end_date: '2026-07-04',
      notes: 'Fake fixture',
      repeat_rule: 'fixed',
      month: 7,
      day: 4,
      weekday: null,
      nth: null,
      length_days: 1,
    },
    {
      id: 'fake-holiday-2',
      name: 'Example Winter Break',
      start_date: '2026-12-24',
      end_date: '2026-12-26',
      notes: 'Fake fixture',
      repeat_rule: 'none',
      month: null,
      day: null,
      weekday: null,
      nth: null,
      length_days: 3,
    },
  ],
  noteRows: [
    {
      id: 'fake-note-1',
      title: 'Example team note',
      details: 'Fake fixture. Not a real announcement.',
      start_date: today,
      end_date: today,
    },
  ],
}

export default function AnnouncementsPreview() {
  return <Announcements preview={PREVIEW} />
}
