import { useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader'
import './org-structure.css'

export default function OrgStructure() {
  const [html, setHtml] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/org-content/org-structure.html')
      .then((res) => {
        if (!res.ok) throw new Error('missing')
        return res.text()
      })
      .then(setHtml)
      .catch(() => setError('The org chart did not load.'))
  }, [])

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader title="Org structure" description="Who reports to whom, and how we work on clients." />
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      <div className="org-page mt-6" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}
