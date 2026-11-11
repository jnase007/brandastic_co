import { useEffect, useMemo, useState } from 'react'
import { Beer, Cake, Palmtree, PartyPopper } from 'lucide-react'
import CompanyHolidays from '../components/CompanyHolidays'
import {
  addDays,
  buildAnnouncements,
  celebrationLabel,
  expandHolidays,
  itemsThisWeek,
  losAngelesToday,
  mondayOf,
  weekGroups,
  weekdayDate,
} from '../lib/announcements'
import { fetchCompanyHolidays, holidayRuleFromRow } from '../lib/companyHolidays'
import { fetchAnnouncementPeople } from '../lib/laborRates'

const TYPES = {
  birthday: { label: 'Birthdays', icon: Cake, dot: 'bg-[#ec4899]', chip: 'bg-[#fce7f3] text-[#be185d]' },
  anniversary: { label: 'Anniversaries', icon: PartyPopper, dot: 'bg-[#7c3aed]', chip: 'bg-[#f3e8ff] text-[#6d28d9]' },
  holiday: { label: 'Holidays', icon: Palmtree, dot: 'bg-[#0284c7]', chip: 'bg-[#e0f2fe] text-[#0369a1]' },
  outing: { label: 'Monthly outing', icon: Beer, dot: 'bg-[#d97706]', chip: 'bg-[#fef3c7] text-[#b45309]' },
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function isCelebration(item) {
  return item.type === 'birthday' || item.type === 'anniversary'
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

function monthsThrough(today, throughDate) {
  const endKey = throughDate.slice(0, 7)
  const keys = []
  let cursor = today.slice(0, 7)
  while (cursor <= endKey) {
    keys.push(cursor)
    const [year, month] = cursor.split('-').map(Number)
    cursor = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`
  }
  return keys
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

  useEffect(() => {
    let cancel = false
    Promise.allSettled([fetchAnnouncementPeople(), fetchCompanyHolidays()]).then(([rateResult, holidayResult]) => {
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
  }), [today, people, holidays])
  const week = itemsThisWeek(today, items)
  const groups = weekGroups(today, items)
  const windowEnd = addDays(today, 30)
  const calendarHolidays = useMemo(() => visibleHolidays(holidays, today, windowEnd), [holidays, today, windowEnd])
  const byDay = useMemo(() => {
    const map = new Map()
    const add = (day, item) => {
      const list = map.get(day) || []
      list.push(item)
      map.set(day, list)
    }
    for (const item of items) {
      if (item.type !== 'holiday') add(item.date, item)
    }
    for (const item of calendarHolidays) {
      for (const day of eachHolidayDay(item)) add(day, item)
    }
    return map
  }, [items, calendarHolidays])
  return (
    <div className="min-h-screen bg-[#f4f7fa] px-4 py-6 text-[#15202b] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <section className="overflow-hidden rounded-3xl bg-[#10141c] text-white shadow-sm">
          <div className="p-8 sm:p-12">
            <p className="text-xs font-semibold tracking-[0.2em] text-[#8eb4ff]">BRANDASTIC · TEAM</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Company Announcements</h1>
            <p className="mt-4 max-w-md text-lg leading-relaxed text-white/75">What to share with the team this week.</p>
          </div>
        </section>

        {loading ? <p className="mt-8 text-sm text-[#5c6b7a]">Loading announcements…</p> : null}
        {peopleError ? <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">{peopleError}</p> : null}
        {holidayError ? <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">{holidayError}</p> : null}

        {!loading ? (
          <>
            <div className="mt-6 grid items-start gap-4 lg:grid-cols-2">
              <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">Announce this week</h2>
                  <p className="mt-1 text-sm text-[#5c6b7a]">{weekdayDate(mondayOf(today))}–{weekdayDate(addDays(mondayOf(today), 6))}</p>
                </div>
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
                              <li key={`${item.type}-${item.date}-${item.title}`} className={`rounded-2xl px-3 py-2 text-sm ${meta.chip}`}>
                                <span className="font-semibold">{isCelebration(item) ? celebrationLabel(item) : item.title}</span>
                                {isCelebration(item) || !item.detail ? null : <span> · {item.detail}</span>}
                                <span className="text-[#3d4d5c]"> · {weekdayDate(item.date)}</span>
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
              </section>

              <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-2xl font-semibold tracking-tight">Coming up · next 30 days</h2>
                  <div className="flex rounded-full bg-[#f4f7fa] p-1 text-sm font-semibold">
                    <button type="button" className={`rounded-full px-3 py-1 ${view === 'calendar' ? 'bg-white shadow-sm' : 'text-[#5c6b7a]'}`} onClick={() => setView('calendar')}>Calendar</button>
                    <button type="button" className={`rounded-full px-3 py-1 ${view === 'list' ? 'bg-white shadow-sm' : 'text-[#5c6b7a]'}`} onClick={() => setView('list')}>List</button>
                  </div>
                </div>
                {view === 'calendar' ? (
                  <div className="mt-6 space-y-6">
                    {monthsThrough(today, windowEnd).map((month) => (
                      <div key={month}>
                        <p className="text-sm font-semibold">{monthName(month)}</p>
                        <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-[#8b98a5]">
                          {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
                        </div>
                        <div className="mt-1 grid grid-cols-7 gap-1">
                          {monthCells(month).map((day, index) => {
                            const dayItems = day ? byDay.get(day) || [] : []
                            const inWindow = day && day >= today && day <= windowEnd
                            const inHoliday = dayItems.some((item) => item.type === 'holiday')
                            const open = Boolean(day) && (inWindow || inHoliday)
                            const selected = day === selectedDay
                            return (
                              <button
                                key={`${month}-${index}`}
                                type="button"
                                disabled={!open}
                                onClick={() => day && setSelectedDay(day)}
                                className={`min-h-12 rounded-xl px-1 py-1 text-left text-xs ${selected ? 'bg-[#e8eeff] ring-1 ring-[#1644ED]' : ''} ${open ? '' : 'opacity-40'}`}
                              >
                                <span className="font-semibold">{day ? Number(day.slice(8)) : ''}</span>
                                <span className="mt-1 flex flex-wrap gap-1">
                                  {dayItems.map((item) => <span key={`${item.type}-${item.title}-${item.rangeStart || item.date}`} className={`h-1.5 w-1.5 rounded-full ${TYPES[item.type].dot}`} />)}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                    <div>
                      <p className="text-sm font-semibold">{selectedDay ? weekdayDate(selectedDay) : 'Pick a day'}</p>
                      {(byDay.get(selectedDay) || []).length ? (
                        <ul className="mt-2 space-y-2">
                          {byDay.get(selectedDay).map((item) => (
                            <li key={`${item.type}-${item.title}-${item.rangeStart || item.date}`} className={`rounded-2xl px-3 py-2 text-sm ${TYPES[item.type].chip}`}>
                              {isCelebration(item) ? celebrationLabel(item) : `${TYPES[item.type].label}: ${item.title}${item.detail ? ` · ${item.detail}` : ''}`}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-[#5c6b7a]">Nothing on this day.</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 space-y-5">
                    {groups.length ? groups.map((group) => (
                      <div key={group.id}>
                        <p className="text-sm font-semibold">{group.label}</p>
                        <ul className="mt-2 space-y-2">
                          {group.items.map((item) => (
                            <li key={`${item.type}-${item.date}-${item.title}`} className="flex items-baseline justify-between gap-3 text-sm">
                              <span><span className="font-semibold">{isCelebration(item) ? celebrationLabel(item) : item.title}</span>{isCelebration(item) || !item.detail ? '' : ` · ${item.detail}`}</span>
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${TYPES[item.type].chip}`}>{weekdayDate(item.date)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )) : <p className="text-sm text-[#5c6b7a]">Nothing in the next 30 days.</p>}
                  </div>
                )}
              </section>
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
