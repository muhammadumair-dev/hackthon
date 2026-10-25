import { useEffect, useState } from 'react'
import api from '../api/axios.js'

const jsonText = (value) => value == null ? '—' : JSON.stringify(value, null, 2)

function AuditLogPage() {
  const [filters, setFilters] = useState({ action: '', entityType: '', from: '', to: '' })
  const [page, setPage] = useState(1)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    let active = true
    api.get('/api/audit-logs', {
      params: {
        page,
        pageSize: 20,
        ...(filters.action ? { action: filters.action } : {}),
        ...(filters.entityType ? { entityType: filters.entityType } : {}),
        ...(filters.from ? { from: new Date(`${filters.from}T00:00:00.000Z`).toISOString() } : {}),
        ...(filters.to ? { to: new Date(`${filters.to}T23:59:59.999Z`).toISOString() } : {}),
      },
    })
      .then(({ data }) => {
        if (!active) return
        setResult(data)
        setError('')
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Could not load audit entries.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [filters, page, retryCount])

  const change = (key, value) => {
    setLoading(true)
    setPage(1)
    setFilters((current) => ({ ...current, [key]: value }))
  }

  return (
    <section className="mx-auto w-full max-w-7xl">
      <h1 className="text-2xl font-semibold">Audit log</h1>
      <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-medium">Action
          <input value={filters.action} onChange={(event) => change('action', event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" />
        </label>
        <label className="text-sm font-medium">Entity type
          <input value={filters.entityType} onChange={(event) => change('entityType', event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" />
        </label>
        <label className="text-sm font-medium">From
          <input type="date" value={filters.from} onChange={(event) => change('from', event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" />
        </label>
        <label className="text-sm font-medium">To
          <input type="date" value={filters.to} onChange={(event) => change('to', event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" />
        </label>
      </div>
      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error}<button type="button" onClick={() => { setLoading(true); setRetryCount((count) => count + 1) }} className="ml-2 font-semibold underline">Retry</button></p>}
      {loading ? <p className="mt-5 text-sm text-slate-600" role="status">Loading audit log...</p> : (
        <>
          {!result?.entries.length ? (
            <p className="mt-5 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">No audit entries match these filters.</p>
          ) : (
            <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr><th className="px-3 py-3">When</th><th className="px-3 py-3">Actor</th><th className="px-3 py-3">Action</th><th className="px-3 py-3">Entity</th><th className="px-3 py-3">Changes</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.entries.map((entry) => (
                    <tr key={entry.id} className="align-top">
                      <td className="px-3 py-3 whitespace-nowrap">{new Date(entry.createdAt).toLocaleString()}</td>
                      <td className="px-3 py-3">{entry.actor?.name || entry.actorRole}</td>
                      <td className="px-3 py-3">{entry.action}</td>
                      <td className="px-3 py-3">{entry.entityType}<br /><span className="text-xs text-slate-500">{entry.entityId}</span></td>
                      <td className="px-3 py-3">
                        <details>
                          <summary className="cursor-pointer font-medium">Before / after</summary>
                          <div className="mt-2 grid gap-3 lg:grid-cols-2">
                            <pre className="max-w-full overflow-auto rounded bg-slate-50 p-2 text-xs">{jsonText(entry.before)}</pre>
                            <pre className="max-w-full overflow-auto rounded bg-slate-50 p-2 text-xs">{jsonText(entry.after)}</pre>
                          </div>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-sm text-slate-600">Page {result?.pagination.page || 1} of {result?.pagination.totalPages || 0}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => { setLoading(true); setPage((current) => current - 1) }} className="rounded border px-3 py-2 text-sm disabled:opacity-40">Previous</button>
              <button disabled={page >= (result?.pagination.totalPages || 0)} onClick={() => { setLoading(true); setPage((current) => current + 1) }} className="rounded border px-3 py-2 text-sm disabled:opacity-40">Next</button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

export default AuditLogPage