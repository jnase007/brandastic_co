import { useEffect, useMemo, useState } from 'react'
import { Beer, Cake, Palmtree, PartyPopper, Pin } from 'lucide-react'
import AnnouncementNoteForm from '../components/AnnouncementNoteForm'
import CompanyHolidays from '../components/CompanyHolidays'
import {
  addDays,
  buildAnnouncements,
  celebrationLabel,
  expandHolidays,
  itemsThisWeek,
  losAngelesToday,
  mondayOf,
  noteCalendarItems,
  weekGroups,
  weekdayDate,
} from '../lib/announcements'
import { deleteAnnouncementNote, fetchAnnouncementNotes, missingNotesTable, saveAnnouncementNote } from '../lib/announcementNotes'
import { fetchCompanyHolidays, holidayRuleFromRow } from '../lib/companyHolidays'
import { fetchAnnouncementPeople } from '../lib/laborRates'
import PageHeader from '../components/PageHeader'
import '../profitability.css'

const TYPES = {
  birthday: { label: 'Birthdays', icon: Cake, dot: 'bg-[#ec4899]', chip: 'bg-[#fce7f3] text-[#be185d]' },
  anniversary: { label: 'Anniversaries', icon: PartyPopper, dot: 'bg-[#7c3aed]', chip: 'bg-[#f3e8ff] text-[#6d28d9]' },
  holiday: { label: 'Holidays', icon: Palmtree, dot: 'bg-[#0284c7]', chip: 'bg-[#e0f2fe] text-[#0369a1]' },
  outing: { label: 'Monthly outing', icon: Beer, dot: 'bg-[#d97706]', chip: 'bg-[#fef3c7] text-[#b45309]' },
  note: { label: 'Notes', icon: Pin, dot: 'bg-[#475569]', chip: 'bg-[#f1f5f9] text-[#334155]' },
}

const BLANK_NOTE = { id: '', title: '', details: '', startDate: '', endDate: '' }

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function isCelebration(item) {
  return item.type === 'birthday' || item.type === 'anniversary'
}

function shownTitle(item) {
  if (isCelebration(item)) return celebrationLabel(item)
  if (item.type === 'note') return `📌 ${item.title}`
  return item.title
}

function noteWhen(row) {
  const start = String(row.start_date || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return ''
  const endRaw = String(row.end_date || '').slice(0, 10)
  const end = /^\d{4}-\d{2}-\d{2}$/.test(endRaw) && endRaw >= start ? endRaw : ''
  return end && end > start ? `${weekdayDate(start)}–${weekdayDate(end)}` : weekdayDate(start)
}

function NoteActions({ disabled, onEdit, onDelete }) {
  return (
    <span className="ml-2 inline-flex gap-2">
      <button type="button" className="text-xs font-semibold underline" disabled={disabled} onClick={onEdit}>Edit</button>
      <button type="button" className="text-xs font-semibold underline" disabled={disabled} onClick={onDelete}>Delete</button>
    </span>
  )
}

function monthName(monthKey) {
  const [year, month] = monthKey.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)))
}

function monthCells(monthKey) {
  const [year, month] = monthKey.split('-').map(Number)
  const first = `${monthKey}-01`
  const [firstYear, firstMonth, firstDay] = first.split('-').map(Number)
  const offset = (new Date(Date.UTC(firstYear, firstMonth - 1, firstDay)).getUTCDay() + 6) % 7
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const cells = Array(offset).fill(null)
  for (let day = 1; day <= count; day += 1) cells.push(`${monthKey}-${String(day).padStart(2, '0')}`)
  while (cells.length % 7) cells.push(null)
  return cells
}

function UpcomingCalendar({
  title,
  today,
  windowEnd,
  byDay,
  view,
  setView,
  selectedDay,
  setSelectedDay,
  hoveredDay,
  setHoveredDay,
  noteSaving,
  onEditNote,
  onDeleteNote,
  groups,
}) {
  const listGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const start = item.rangeStart || item.date
        const end = item.rangeEnd && item.rangeEnd >= start ? item.rangeEnd : start
        return start <= windowEnd && end >= today
      }),
    }))
    .filter((group) => group.items.length && group.id <= windowEnd && addDays(group.id, 6) >= today)

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <div className="flex rounded-full bg-[#f4f7fa] p-1 text-sm font-semibold">
          <button type="button" className={`rounded-full px-3 py-1 ${view === 'calendar' ? 'bg-white shadow-sm' : 'text-[#5c6b7a]'}`} onClick={() => setView('calendar')}>Calendar</button>
          <button type="button" className={`rounded-full px-3 py-1 ${view === 'list' ? 'bg-white shadow-sm' : 'text-[#5c6b7a]'}`} onClick={() => setView('list')}>List</button>
        </div>
      </div>
      {view === 'calendar' ? (
        <div className="mt-6 space-y-8">
          <div>
            <p className="text-sm font-semibold">{selectedDay ? weekdayDate(selectedDay) : 'Hover a day'}</p>
            {(byDay.get(selectedDay) || []).length ? (
              <ul className="mt-2 space-y-2">
                {byDay.get(selectedDay).map((item) => (
                  <li key={`${item.type}-${item.id || item.title}-${item.rangeStart || item.date}`} className={`rounded-2xl px-3 py-2 text-sm ${TYPES[item.type].chip}`}>
                    {isCelebration(item) ? shownTitle(item) : `${TYPES[item.type].label}: ${shownTitle(item)}${item.detail ? ` · ${item.detail}` : ''}`}
                    {item.type === 'note' ? <NoteActions disabled={noteSaving} onEdit={() => onEditNote(item)} onDelete={() => onDeleteNote(item)} /> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-[#5c6b7a]">Nothing on this day.</p>
            )}
          </div>
          {monthsThrough(today, windowEnd).map((month) => (
            <div key={month}>
              <p className="text-sm font-semibold">{monthName(month)}</p>
              <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-[#8b98a5]">
                {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
              </div>
              <div className="mt-1 grid grid-cols-7 overflow-hidden rounded-xl border border-[#d5dde6]" onMouseLeave={() => setHoveredDay(null)}>
                {monthCells(month).map((day, index) => {
                  const dayItems = day ? byDay.get(day) || [] : []
                  const inRange = day && day.slice(0, 7) >= today.slice(0, 7) && day <= windowEnd
                  const inMarked = dayItems.some((item) => item.type === 'holiday' || item.type === 'note')
                  const open = Boolean(day) && (inRange || inMarked)
                  const selected = day === selectedDay
                  return (
                    <button
                      key={`${month}-${index}`}
                      type="button"
                      disabled={!open}
                      onMouseEnter={() => {
                        if (day && open) {
                          setSelectedDay(day)
                          setHoveredDay(day)
                        }
                      }}
                      onClick={() => day && setSelectedDay(day)}
                      className={`relative min-h-12 border-b border-r border-[#d5dde6] px-1.5 py-1.5 text-left text-xs ${selected ? 'bg-[#e8eeff]' : day ? 'bg-white' : 'bg-[#f8fafc]'} ${open ? 'hover:bg-[#f1f5f9]' : 'opacity-40'}`}
                    >
                      <span className="font-semibold">{day ? Number(day.slice(8)) : ''}</span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        {dayItems.map((item) => <span key={`${item.type}-${item.id || item.title}-${item.rangeStart || item.date}`} className={`h-1.5 w-1.5 rounded-full ${TYPES[item.type].dot}`} />)}
                      </span>
                      {hoveredDay === day && dayItems.length ? (
                        <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 w-44 -translate-x-1/2 rounded-xl bg-white px-2 py-1.5 text-left text-[11px] font-medium text-[#1b2838] shadow-lg ring-1 ring-black/10">
                          {dayItems.map((item) => (
                            <span key={`${item.type}-${item.id || item.title}-${item.rangeStart || item.date}`} className="block leading-snug">
                              {isCelebration(item) ? shownTitle(item) : `${TYPES[item.type].label}: ${shownTitle(item)}`}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {listGroups.length ? listGroups.map((group) => (
            <div key={group.id}>
              <p className="text-sm font-semibold">{group.label}</p>
              <ul className="mt-2 space-y-2">
                {group.items.map((item) => (
                  <li key={`${item.type}-${item.id || item.date}-${item.title}`} className="flex items-baseline justify-between gap-3 text-sm">
                    <span><span className="font-semibold">{shownTitle(item)}</span>{isCelebration(item) || !item.detail ? '' : ` · ${item.detail}`}{item.type === 'note' ? <NoteActions disabled={noteSaving} onEdit={() => onEditNote(item)} onDelete={() => onDeleteNote(item)} /> : null}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${TYPES[item.type].chip}`}>{weekdayDate(item.date)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )) : <p className="text-sm text-[#5c6b7a]">Nothing in this window.</p>}
        </div>
      )}
    </section>
  )
}

function nextMonthKey(monthKey) {
  const [year, month] = monthKey.split('-').map(Number)
  return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`
}

function monthsThrough(today, throughDate) {
  const endKey = throughDate.slice(0, 7)
  const keys = []
  let cursor = today.slice(0, 7)
  while (cursor <= endKey) {
    keys.push(cursor)
    cursor = nextMonthKey(cursor)
  }
  return keys
}

function yearWindowEnd(today) {
  let cursor = today.slice(0, 7)
  for (let i = 0; i < 11; i += 1) cursor = nextMonthKey(cursor)
  return monthEnd(`${cursor}-01`)
}

function holidayBounds(item) {
  const start = item.rangeStart || item.date
  const end = item.rangeEnd && item.rangeEnd >= start ? item.rangeEnd : start
  return { start, end }
}

function eachHolidayDay(item) {
  const { start, end } = holidayBounds(item)
  const days = []
  let cursor = start
  while (cursor <= end && days.length < 370) {
    days.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return days
}

function monthEnd(iso) {
  const [year, month] = iso.slice(0, 7).split('-').map(Number)
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${iso.slice(0, 7)}-${String(last).padStart(2, '0')}`
}

function holidayCalendarItem(range, today) {
  const multi = range.endDate > range.startDate
  const when = multi ? `${weekdayDate(range.startDate)}–${weekdayDate(range.endDate)}` : weekdayDate(range.startDate)
  const notes = String(range.notes || '').trim()
  return {
    type: 'holiday',
    date: range.startDate < today ? today : range.startDate,
    rangeStart: range.startDate,
    rangeEnd: range.endDate,
    title: range.name,
    detail: notes ? `${notes} ${when}` : when,
  }
}

function visibleHolidays(holidays, today, windowEnd) {
  return expandHolidays(holidays, today, monthEnd(windowEnd)).map((range) => holidayCalendarItem(range, today))
}

export default function Announcements() {
  const today = useMemo(() => losAngelesToday(), [])
  const [people, setPeople] = useState([])
  const [peopleError, setPeopleError] = useState('')
  const [holidays, setHolidays] = useState([])
  const [holidayRows, setHolidayRows] = useState([])
  const [holidaysMissing, setHolidaysMissing] = useState(false)
  const [holidayColumnsMissing, setHolidayColumnsMissing] = useState(false)
  const [holidayError, setHolidayError] = useState('')
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('calendar')
  const [selectedDay, setSelectedDay] = useState(today)
  const [hoveredDay, setHoveredDay] = useState(null)
  const [noteRows, setNoteRows] = useState([])
  const [notesMissing, setNotesMissing] = useState(false)
  const [noteError, setNoteError] = useState('')
  const [noteFormOpen, setNoteFormOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState(BLANK_NOTE)
  const [noteSaving, setNoteSaving] = useState(false)

  useEffect(() => {
    let cancel = false
    Promise.allSettled([fetchAnnouncementPeople(), fetchCompanyHolidays(), fetchAnnouncementNotes()]).then(([rateResult, holidayResult, noteResult]) => {
      if (cancel) return
      if (rateResult.status === 'fulfilled' && rateResult.value?.rows) {
        setPeople(rateResult.value.rows)
      } else if (rateResult.status === 'rejected') {
        setPeopleError(rateResult.reason?.message || 'Could not load people')
      } else {
        setPeopleError('People are not available yet. Run supabase/announcements.sql in the Supabase SQL editor.')
      }
      if (holidayResult.status === 'fulfilled') {
        setHolidayRows(holidayResult.value.rows)
        setHolidaysMissing(holidayResult.value.missing)
        setHolidayColumnsMissing(holidayResult.value.columnsMissing)
        setHolidays(holidayResult.value.rows.map(holidayRuleFromRow))
      } else {
        setHolidayError(holidayResult.reason?.message || 'Could not load holidays')
      }
      if (noteResult.status === 'fulfilled') {
        setNoteRows(noteResult.value.rows)
        setNotesMissing(noteResult.value.missing)
      } else {
        setNoteError(noteResult.reason?.message || 'Could not load notes')
      }
      setLoading(false)
    })
    return () => { cancel = true }
  }, [])

  const items = useMemo(() => buildAnnouncements(today, {
    people: people.map((row) => ({
      name: row.name,
      birthday: row.birthday,
      startDate: row.start_date,
      showOnAnnouncements: row.show_on_announcements !== false,
    })),
    holidays,
    notes: noteRows,
  }), [today, people, holidays, noteRows])
  const week = itemsThisWeek(today, items)
  const groups = weekGroups(today, items)
  const windowEnd = yearWindowEnd(today)
  const calendarHolidays = useMemo(() => visibleHolidays(holidays, today, windowEnd), [holidays, today, windowEnd])
  const calendarThrough = monthEnd(windowEnd)
  const calendarNotes = useMemo(() => noteCalendarItems(noteRows, today, calendarThrough), [noteRows, today, calendarThrough])
  const laterNotes = noteRows.filter((row) => {
    const start = String(row.start_date || '').slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return false
    const endRaw = String(row.end_date || '').slice(0, 10)
    const end = /^\d{4}-\d{2}-\d{2}$/.test(endRaw) && endRaw >= start ? endRaw : start
    return end >= today && start > calendarThrough
  })
  const byDay = useMemo(() => {
    const map = new Map()
    const add = (day, item) => {
      const list = map.get(day) || []
      list.push(item)
      map.set(day, list)
    }
    for (const item of items) {
      if (item.type !== 'holiday' && item.type !== 'note') add(item.date, item)
    }
    for (const item of calendarHolidays) {
      for (const day of eachHolidayDay(item)) add(day, item)
    }
    for (const item of calendarNotes) {
      for (const day of eachHolidayDay(item)) add(day, item)
    }
    return map
  }, [items, calendarHolidays, calendarNotes])

  function startAddNote() {
    setNoteDraft(BLANK_NOTE)
    setNoteError('')
    setNoteFormOpen(true)
  }

  function closeNoteForm() {
    setNoteFormOpen(false)
    setNoteDraft(BLANK_NOTE)
    setNoteError('')
  }

  function editNote(row) {
    setNoteDraft({
      id: row.id,
      title: row.title || '',
      details: row.details || '',
      startDate: String(row.start_date || '').slice(0, 10),
      endDate: String(row.end_date || '').slice(0, 10),
    })
    setNoteError('')
    setNoteFormOpen(true)
  }

  function editNoteItem(item) {
    const row = noteRows.find((note) => note.id === item.id)
    if (row) editNote(row)
  }

  async function submitNote(event) {
    event.preventDefault()
    const title = noteDraft.title.trim()
    if (!title) {
      setNoteError('A note needs a title.')
      return
    }
    if (noteDraft.endDate && !noteDraft.startDate) {
      setNoteError('Add a start date, or clear the end date.')
      return
    }
    if (noteDraft.startDate && noteDraft.endDate && noteDraft.endDate < noteDraft.startDate) {
      setNoteError('End date has to be on or after the start date.')
      return
    }
    setNoteSaving(true)
    setNoteError('')
    try {
      const rows = await saveAnnouncementNote({ ...noteDraft, title })
      setNoteRows(rows)
      setNotesMissing(false)
      setNoteFormOpen(false)
      setNoteDraft(BLANK_NOTE)
    } catch (err) {
      if (missingNotesTable(err)) setNotesMissing(true)
      setNoteError(err.message || 'Could not save that note')
    } finally {
      setNoteSaving(false)
    }
  }

  async function removeNote(row) {
    if (!row?.id) return
    if (!confirm(`Delete “${row.title}”?`)) return
    setNoteSaving(true)
    setNoteError('')
    try {
      await deleteAnnouncementNote(row.id)
      setNoteRows((current) => current.filter((note) => note.id !== row.id))
      if (noteDraft.id === row.id) {
        setNoteFormOpen(false)
        setNoteDraft(BLANK_NOTE)
      }
    } catch (err) {
      if (missingNotesTable(err)) setNotesMissing(true)
      setNoteError(err.message || 'Could not delete that note')
    } finally {
      setNoteSaving(false)
    }
  }

  function removeNoteItem(item) {
    const row = noteRows.find((note) => note.id === item.id)
    if (row) removeNote(row)
  }
  return (
    <div className="min-h-screen bg-[#f4f7fa] px-4 py-6 text-[#15202b] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <PageHeader title="Announcements" description="What to share with the team this week." />

        {loading ? <p className="mt-8 text-sm text-[#5c6b7a]">Loading announcements…</p> : null}
        {peopleError ? <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">{peopleError}</p> : null}
        {holidayError ? <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">{holidayError}</p> : null}

        {!loading ? (
          <>
            <div className="mt-6 space-y-4">
              <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight">Announce this week</h2>
                    <p className="mt-1 text-sm text-[#5c6b7a]">{weekdayDate(mondayOf(today))}–{weekdayDate(addDays(mondayOf(today), 6))}</p>
                  </div>
                  <button type="button" className="pr-rates-toggle" onClick={startAddNote}>Add note</button>
                </div>
                {noteFormOpen ? (
                  <AnnouncementNoteForm
                    draft={noteDraft}
                    saving={noteSaving}
                    error={noteError}
                    onChange={(field, value) => {
                      setNoteError('')
                      setNoteDraft((current) => ({ ...current, [field]: value }))
                    }}
                    onSubmit={submitNote}
                    onCancel={closeNoteForm}
                  />
                ) : null}
                {notesMissing ? <p className="mt-4 text-sm text-amber-900">In Supabase, open the SQL editor and run supabase/announcement-notes.sql once. Then notes can be added here.</p> : null}
                {noteError && !noteFormOpen ? <p className="pr-rates-error">{noteError}</p> : null}
                {week.length ? (
                  <div className="mt-6 space-y-5">
                    {Object.keys(TYPES).map((type) => {
                      const group = week.filter((item) => item.type === type)
                      if (!group.length) return null
                      const meta = TYPES[type]
                      const Icon = meta.icon
                      return (
                        <div key={type}>
                          <p className="flex items-center gap-2 text-sm font-semibold">
                            <Icon className="h-4 w-4" />
                            {meta.label}
                          </p>
                          <ul className="mt-2 space-y-2">
                            {group.map((item) => (
                              <li key={`${item.type}-${item.id || item.date}-${item.title}`} className={`rounded-2xl px-3 py-2 text-sm ${meta.chip}`}>
                                <span className="font-semibold">{shownTitle(item)}</span>
                                {isCelebration(item) || !item.detail ? null : <span> · {item.detail}</span>}
                                {item.undated ? null : <span className="text-[#3d4d5c]"> · {weekdayDate(item.date)}</span>}
                                {item.type === 'note' ? <NoteActions disabled={noteSaving} onEdit={() => editNoteItem(item)} onDelete={() => removeNoteItem(item)} /> : null}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="mt-6 text-sm text-[#5c6b7a]">Nothing to announce this week.</p>
                )}
                {laterNotes.length ? (
                  <div className="mt-6">
                    <p className="text-sm font-semibold">Later notes</p>
                    <ul className="mt-2 space-y-2">
                      {laterNotes.map((row) => (
                        <li key={row.id} className={`rounded-2xl px-3 py-2 text-sm ${TYPES.note.chip}`}>
                          <span className="font-semibold">📌 {row.title}</span>
                          {row.details ? <span> · {row.details}</span> : null}
                          {noteWhen(row) ? <span className="text-[#3d4d5c]"> · {noteWhen(row)}</span> : null}
                          <NoteActions disabled={noteSaving} onEdit={() => editNote(row)} onDelete={() => removeNote(row)} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>

              <UpcomingCalendar
                title="Coming up"
                today={today}
                windowEnd={windowEnd}
                byDay={byDay}
                view={view}
                setView={setView}
                selectedDay={selectedDay}
                setSelectedDay={setSelectedDay}
                hoveredDay={hoveredDay}
                setHoveredDay={setHoveredDay}
                noteSaving={noteSaving}
                onEditNote={editNoteItem}
                onDeleteNote={removeNoteItem}
                groups={groups}
              />
            </div>

            <div className="mt-6">
              <CompanyHolidays
                rows={holidayRows}
                missing={holidaysMissing}
                columnsMissing={holidayColumnsMissing}
                onSaved={(rows) => {
                  setHolidayRows(rows)
                  setHolidayColumnsMissing(false)
                  setHolidays(rows.map(holidayRuleFromRow))
                }}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
