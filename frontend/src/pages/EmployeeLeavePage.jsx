import { useEffect, useState } from 'react'
import api from '../api/axios.js'

const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm'

function EmployeeLeavePage() {
  const [balance, setBalance] = useState(null)
  const [leaves, setLeaves] = useState([])
  const [leaveTypes, setLeaveTypes] = useState([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [leaveType, setLeaveType] = useState('')
  const [smartDescription, setSmartDescription] = useState('')
  const [smartLoading, setSmartLoading] = useState(false)
  const [smartError, setSmartError] = useState('')
  const [workdays, setWorkdays] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [activeId, setActiveId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const [workdaysRetry, setWorkdaysRetry] = useState(0)

  useEffect(() => {
    let active = true
    Promise.all([
      api.get('/api/leave/balance'),
      api.get('/api/leave/my'),
    ]).then(([balanceResponse, leavesResponse]) => {
      if (!active) return
      setBalance(balanceResponse.data)
      setLeaveTypes(balanceResponse.data.leaveTypes)
      setLeaves(leavesResponse.data.leaves)
      setLeaveType((current) => current || balanceResponse.data.leaveTypes[0]?.id || '')
      setError('')
    }).catch((requestError) => {
      if (active) {
        setError(requestError.response?.data?.message || 'Could not load your leave information.')
      }
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [retryCount])

  useEffect(() => {
    let active = true
    if (!startDate || !endDate || endDate < startDate) {
      return () => { active = false }
    }
    const timer = window.setTimeout(() => {
      api.get('/api/leave/workdays', { params: { startDate, endDate } })
        .then(({ data }) => {
          if (active) setWorkdays(data)
        })
        .catch((requestError) => {
          if (active) {
            setError(requestError.response?.data?.message || 'Could not calculate working days.')
            setWorkdays(null)
          }
        })
    }, 250)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [startDate, endDate, workdaysRetry])

  const refresh = () => {
    setLoading(true)
    setRetryCount((count) => count + 1)
    setWorkdaysRetry((count) => count + 1)
  }

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    setSubmitting(true)
    try {
      await api.post('/api/leave', { leaveType, startDate, endDate, reason })
      setNotice('Your leave request was submitted.')
      setReason('')
      refresh()
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not submit your leave request.')
    } finally {
      setSubmitting(false)
    }
  }

  const prefillWithAi = async (event) => {
    event.preventDefault()
    setSmartError('')
    setNotice('')
    setSmartLoading(true)
    try {
      const { data } = await api.post('/api/ai/smart-leave', { text: smartDescription })
      if (!data.suggestion) {
        setSmartError(data.message || 'Could not understand that request. Please fill the form manually.')
        return
      }
      setLeaveType(data.suggestion.type)
      setStartDate(data.suggestion.start)
      setEndDate(data.suggestion.end)
      setReason(data.suggestion.reason)
      setWorkdays(null)
      setNotice('AI filled the form. Review every field and submit it yourself.')
    } catch (requestError) {
      setSmartError(requestError.response?.data?.message || 'Could not prepare a leave suggestion.')
    } finally {
      setSmartLoading(false)
    }
  }

  const cancel = async (id) => {
    setActiveId(id)
    setError('')
    setNotice('')
    try {
      await api.post(`/api/leave/${id}/cancel`, {})
      setNotice('Leave request cancelled.')
      refresh()
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not cancel this request.')
    } finally {
      setActiveId('')
    }
  }

  return (
    <section className="mx-auto w-full max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold">Leave</h1>
        <p className="mt-1 text-sm text-slate-600">View your balance, request time off, and track decisions.</p>
      </div>
      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
          <button type="button" className="ml-3 font-semibold underline" onClick={refresh}>Retry</button>
        </div>
      )}
      {notice && <p className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800" role="status">{notice}</p>}

      {loading ? (
        <p className="mt-5 text-sm text-slate-600" role="status">Loading your leave information...</p>
      ) : !error ? (
        <>
          <section className="mt-6">
            <h2 className="text-lg font-semibold">Balance for {balance?.year}</h2>
            {leaveTypes.length ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {leaveTypes.map((type) => (
                  <article key={type.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <h3 className="font-semibold">{type.name}</h3>
                    <p className="mt-2 text-sm text-slate-600">
                      Used {type.used} {type.isUnlimited ? 'days' : `of ${type.yearlyQuota} days`}
                    </p>
                    <p className="text-sm text-slate-600">
                      {type.isUnlimited ? 'Unlimited' : `${type.remaining} days remaining`}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">
                No leave types are configured yet.
              </p>
            )}
          </section>

          <section className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
            <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
              <h2 className="text-lg font-semibold">Apply for leave</h2>
              {!leaveTypes.length ? (
                <p className="mt-3 text-sm text-slate-600">Ask your administrator to add a leave type before applying.</p>
              ) : (
                <>
                  <section className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <label htmlFor="smart-leave-description" className="block text-sm font-medium text-slate-800">
                      Describe in words
                    </label>
                    <textarea
                      id="smart-leave-description"
                      rows={2}
                      maxLength={1000}
                      value={smartDescription}
                      onChange={(event) => setSmartDescription(event.target.value)}
                      placeholder="For example: agle Monday Tuesday behen ki shadi ke liye chahiye"
                      className={inputClass}
                    />
                    <p className="mt-2 text-xs text-slate-600">AI will pre-fill the form only. Review it before submitting.</p>
                    {smartError && <p className="mt-2 text-sm text-red-700" role="alert">{smartError}</p>}
                    <button
                      type="button"
                      onClick={prefillWithAi}
                      disabled={smartLoading || !smartDescription.trim()}
                      className="mt-3 rounded-lg border border-blue-700 px-3 py-2 text-sm font-medium text-blue-800 disabled:opacity-50"
                    >
                      {smartLoading ? 'Understanding request...' : 'Use AI to fill form'}
                    </button>
                  </section>
                  <label className="mt-4 block text-sm font-medium text-slate-700">
                    Leave type
                    <select required value={leaveType} onChange={(event) => setLeaveType(event.target.value)} className={inputClass}>
                      {leaveTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
                    </select>
                  </label>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="text-sm font-medium text-slate-700">
                      Start date
                      <input required type="date" value={startDate} onChange={(event) => { setWorkdays(null); setStartDate(event.target.value) }} className={inputClass} />
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      End date
                      <input required type="date" min={startDate || undefined} value={endDate} onChange={(event) => { setWorkdays(null); setEndDate(event.target.value) }} className={inputClass} />
                    </label>
                  </div>
                  <p className="mt-3 text-sm text-slate-600" aria-live="polite">
                    Working days: {workdays ? workdays.days : 'Select a valid date range'}
                  </p>
                  {workdays?.days === 0 && <p className="mt-1 text-sm text-amber-700">This range contains no working days.</p>}
                  <label className="mt-3 block text-sm font-medium text-slate-700">
                    Reason
                    <textarea required maxLength={1000} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} className={inputClass} />
                  </label>
                  <button disabled={submitting || !workdays?.days} type="submit" className="mt-4 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">
                    {submitting ? 'Submitting...' : 'Submit request'}
                  </button>
                </>
              )}
            </form>

            <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
              <h2 className="text-lg font-semibold">My requests</h2>
              {leaves.length === 0 ? (
                <p className="mt-4 rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600">You have not submitted any leave requests.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[600px] text-left text-sm">
                    <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                      <tr><th className="px-3 py-2">Type / dates</th><th className="px-3 py-2">Days</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Comment</th><th className="px-3 py-2">Action</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {leaves.map((leave) => (
                        <tr key={leave.id}>
                          <td className="px-3 py-3">
                            <p className="font-medium">{leave.leaveType?.name}</p>
                            <p className="text-xs text-slate-500">{leave.startDate} – {leave.endDate}</p>
                          </td>
                          <td className="px-3 py-3">{leave.days}</td>
                          <td className="px-3 py-3 capitalize">{leave.status}</td>
                          <td className="px-3 py-3">{leave.reviewComment || '—'}</td>
                          <td className="px-3 py-3">
                            {leave.status === 'pending' && (
                              <button type="button" disabled={activeId === leave.id} onClick={() => cancel(leave.id)} className="font-medium text-red-700 underline disabled:opacity-50">
                                {activeId === leave.id ? 'Cancelling...' : 'Cancel'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </section>
        </>
      ) : null}
    </section>
  )
}

export default EmployeeLeavePage
