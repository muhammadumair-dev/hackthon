import { useEffect, useState } from 'react'
import api from '../api/axios.js'
import useAuth from '../context/useAuth.js'

const statuses = ['pending', 'approved', 'rejected', 'cancelled', 'all']

function LeaveRequestsPage() {
  const { user } = useAuth()
  const [leaves, setLeaves] = useState([])
  const [departments, setDepartments] = useState([])
  const [status, setStatus] = useState('pending')
  const [department, setDepartment] = useState('')
  const [pagination, setPagination] = useState(null)
  const [page, setPage] = useState(1)
  const [comments, setComments] = useState({})
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const canReview = user.role === 'hr'

  useEffect(() => {
    let active = true
    Promise.all([
      api.get('/api/leave/requests', {
        params: { status: status || undefined, department: department || undefined, page, pageSize: 10 },
      }),
      api.get('/api/settings/departments'),
    ]).then(([requestsResponse, departmentsResponse]) => {
      if (!active) return
      setLeaves(requestsResponse.data.leaves)
      setPagination(requestsResponse.data.pagination)
      setDepartments(departmentsResponse.data.departments)
      setError('')
    }).catch((requestError) => {
      if (active) setError(requestError.response?.data?.message || 'Could not load leave requests.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [status, department, page, retryCount])

  const refresh = () => {
    setLoading(true)
    setRetryCount((count) => count + 1)
  }

  const review = async (id, decision) => {
    const comment = comments[id]?.trim() || ''
    if (!comment) {
      setError('Enter a review comment before deciding this request.')
      return
    }
    setActiveId(id)
    setError('')
    setNotice('')
    try {
      await api.post(`/api/leave/${id}/${decision}`, { comment })
      setNotice(`Leave request ${decision}.`)
      refresh()
    } catch (requestError) {
      setError(requestError.response?.data?.message || `Could not ${decision} this request.`)
    } finally {
      setActiveId('')
    }
  }

  return (
    <section className="mx-auto w-full max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Leave Requests</h1>
          <p className="mt-1 text-sm text-slate-600">{canReview ? 'Review employee leave requests.' : 'View employee leave requests.'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="text-sm font-medium text-slate-700">
            Status
            <select value={status} onChange={(event) => { setLoading(true); setPage(1); setStatus(event.target.value) }} className="ml-2 rounded-lg border border-slate-300 px-3 py-2">
              {statuses.map((value) => <option key={value} value={value}>{value === 'all' ? 'All statuses' : value}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Department
            <select value={department} onChange={(event) => { setLoading(true); setPage(1); setDepartment(event.target.value) }} className="ml-2 rounded-lg border border-slate-300 px-3 py-2">
              <option value="">All departments</option>
              {departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        </div>
      </div>
      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}<button type="button" className="ml-3 font-semibold underline" onClick={refresh}>Retry</button>
        </div>
      )}
      {notice && <p className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800" role="status">{notice}</p>}
      {loading ? (
        <p className="mt-5 text-sm text-slate-600" role="status">Loading leave requests...</p>
      ) : error ? null : leaves.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">No leave requests match these filters.</p>
      ) : (
        <div className="mt-5 space-y-4">
          {leaves.map((leave) => (
            <article key={leave.id} className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{leave.employee?.name} <span className="font-normal text-slate-500">({leave.employee?.code})</span></h2>
                  <p className="text-sm text-slate-600">{leave.employee?.department?.name || 'No department'}</p>
                </div>
                <span className="h-fit rounded-full bg-slate-100 px-3 py-1 text-xs capitalize text-slate-700">{leave.status}</span>
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div><dt className="text-slate-500">Leave type</dt><dd className="font-medium">{leave.leaveType?.name}</dd></div>
                <div><dt className="text-slate-500">Dates</dt><dd className="font-medium">{leave.startDate} – {leave.endDate}</dd></div>
                <div><dt className="text-slate-500">Working days</dt><dd className="font-medium">{leave.days}</dd></div>
                <div><dt className="text-slate-500">Reason</dt><dd className="font-medium">{leave.reason}</dd></div>
              </dl>
              {leave.reviewComment && <p className="mt-3 text-sm text-slate-600">Previous comment: {leave.reviewComment}</p>}
              {canReview && leave.status === 'pending' && (
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <label className="flex-1 text-sm font-medium text-slate-700">
                    Review comment
                    <input maxLength={1000} value={comments[leave.id] || ''} onChange={(event) => setComments((current) => ({ ...current, [leave.id]: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
                  </label>
                  <div className="flex items-end gap-2">
                    <button disabled={activeId === leave.id} type="button" onClick={() => review(leave.id, 'approve')} className="rounded-lg bg-green-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Approve</button>
                    <button disabled={activeId === leave.id} type="button" onClick={() => review(leave.id, 'reject')} className="rounded-lg bg-red-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Reject</button>
                  </div>
                </div>
              )}
            </article>
          ))}
          {pagination?.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">Page {pagination.page} of {pagination.totalPages} ({pagination.total} requests)</p>
              <div className="flex gap-2">
                <button type="button" disabled={page <= 1} onClick={() => { setLoading(true); setPage((value) => value - 1) }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50">Previous</button>
                <button type="button" disabled={page >= pagination.totalPages} onClick={() => { setLoading(true); setPage((value) => value + 1) }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50">Next</button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export default LeaveRequestsPage
