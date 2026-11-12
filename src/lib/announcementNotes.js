import { supabase } from './supabase'

const NOTE_COLUMNS = 'id, title, details, start_date, end_date, created_at'

function errorText(error) {
  return `${error?.message || ''} ${error?.code || ''} ${error?.details || ''}`
}

export function missingNotesTable(error) {
  const text = errorText(error)
  return error?.code === 'PGRST205' || error?.code === '42P01' || (text.includes('does not exist') && text.includes('announcement_notes'))
}

export async function fetchAnnouncementNotes() {
  const { data, error } = await supabase.from('announcement_notes').select(NOTE_COLUMNS).order('created_at')
  if (!error) return { rows: data || [], missing: false }
  if (missingNotesTable(error)) return { rows: [], missing: true }
  throw error
}

function payloadFrom(note) {
  return {
    title: String(note.title || '').trim(),
    details: String(note.details || '').trim() || null,
    start_date: note.startDate || null,
    end_date: note.endDate || null,
  }
}

export async function saveAnnouncementNote(note) {
  const payload = payloadFrom(note)
  if (note.id) {
    const { error } = await supabase.from('announcement_notes').update(payload).eq('id', note.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('announcement_notes').insert(payload, { defaultToNull: false })
    if (error) throw error
  }
  const loaded = await fetchAnnouncementNotes()
  if (loaded.missing) {
    const missing = new Error('Announcement notes are not available yet. Run supabase/announcement-notes.sql in the Supabase SQL editor.')
    missing.code = 'PGRST205'
    throw missing
  }
  return loaded.rows
}

export async function deleteAnnouncementNote(id) {
  const { error } = await supabase.from('announcement_notes').delete().eq('id', id)
  if (error) throw error
}
