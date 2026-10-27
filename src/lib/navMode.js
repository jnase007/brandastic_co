const STORAGE_KEY = 'brandasticFullNav'

export function readFullNav() {
  if (typeof window === 'undefined') return false
  try {
    const q = new URLSearchParams(window.location.search)
    if (q.get('full') === '1') {
      localStorage.setItem(STORAGE_KEY, '1')
      return true
    }
    if (q.get('simple') === '1') {
      localStorage.setItem(STORAGE_KEY, '0')
      return false
    }
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function setFullNav(on) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, on ? '1' : '0')
    window.dispatchEvent(new Event('brandastic-full-nav'))
  } catch {
    /* ignore */
  }
}
