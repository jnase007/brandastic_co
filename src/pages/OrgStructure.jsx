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
      <PageHeader
        title="Org structure"
        description="Who reports to whom, and how we work on clients."
        actions={
          <a
            href="https://docs.google.com/spreadsheets/d/11K3YdNeb3G7m7jvfuuY2FoaikRmbV5EC2ps1hz_kjBM/edit?gid=53272418#gid=53272418"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-lg bg-[#1644ED] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#1339c9]"
          >
            Open org sheet
          </a>
        }
      />
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      <div className="org-page mt-6" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}
