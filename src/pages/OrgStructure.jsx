import PageHeader from '../components/PageHeader'

export default function OrgStructure() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <PageHeader title="Org structure" description="Who reports to whom, and how we work on clients." />
      <div className="mt-6 space-y-4 rounded-2xl border bg-white p-5">
        <p className="text-center font-bold text-white" style={{ background: '#1e3a5f', borderRadius: 12, padding: 12 }}>Justin · CEO</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl p-4" style={{ background: '#ede9fe' }}>
            <p className="font-semibold">Melissa & Erin — Sales</p>
            <p className="text-sm">Sales, proposals, account growth</p>
          </div>
          <div className="rounded-xl p-4" style={{ background: '#d1fae5' }}>
            <p className="font-semibold">Sandy — Director of Operations</p>
            <p className="text-sm">Websites, development, technical ops, client services</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl p-4" style={{ background: '#d1fae5' }}>
            <p className="font-semibold">Stacy — Marketing Manager</p>
            <p className="text-sm">Client strategy & relationship · Aimee</p>
          </div>
          <div className="rounded-xl p-4" style={{ background: '#d1fae5' }}>
            <p className="font-semibold">Maxwell — Marketing Manager</p>
            <p className="text-sm">Client strategy & relationship · Chloe</p>
          </div>
          <div className="rounded-xl p-4" style={{ background: '#dbeafe' }}>
            <p className="font-semibold">Samantha — Head of Digital</p>
            <p className="text-sm">Jonathan paid · new hire paid · CJ SEO</p>
          </div>
        </div>
      </div>
    </div>
  )
}
