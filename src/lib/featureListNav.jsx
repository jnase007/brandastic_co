import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const FeatureListNavContext = createContext(null)

export function FeatureListNavProvider({ children }) {
  const [nav, setNavState] = useState(null)
  const setNav = useCallback((next) => setNavState(next), [])
  const clear = useCallback(() => setNavState(null), [])
  const value = useMemo(() => ({ nav, setNav, clear }), [nav, setNav, clear])
  return (
    <FeatureListNavContext.Provider value={value}>
      {children}
    </FeatureListNavContext.Provider>
  )
}

export function useFeatureListNav() {
  return useContext(FeatureListNavContext)
}
