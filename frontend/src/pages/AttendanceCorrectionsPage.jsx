import { useCallback, useEffect, useState } from 'react'
import api from '../api/axios.js'
import useAuth from '../context/useAuth.js'

const getCurrentDate = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const getCurrentMonth = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function AttendanceCorrectionsPage() {
  const { user } = useAuth()
  const isEmployee = user.role === 'employee'
  const canReview = user.role === 'hr'
  const [corrections, setCorrections] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [savingRequest, setSavingRequest] = useState(false)
  const [todayDate, setTodayDate] = useState(getCurrentDate)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [comments, setComments] = useState({})
  const [form, setForm] = useState({
    date: getCurrentDate(),
    requestedCheckIn: '09:00',
    requestedCheckOut: '17:00',
    reason: '',
  })

  const loadCorrections = useCallback(async () => {
    const { data } = await api.get('/api/attendance/corrections')
    setCorrections(data.corrections)
  }, [])

  useEffect(() => {
    let active = true
    api.get('/api/attendance/corrections')
      .then(({ data }) => {
        if (active) setCorrections(data.corrections)
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Could not load attendance corrections.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    if (isEmployee) {
      api.get('/api/attendance/my', { params: { month: getCurrentMonth() } })
        .then(({ data }) => {
          if (active) {
            setTodayDate(data.today.date)
            setForm((current) => ({ ...current, date: data.today.date }))
          }
        })
        .catch((requestError) => {
          if (active) setError(requestError.response?.data?.message || 'Could not load the company date.')
        })
    }
    return () => { active = false }
  }, [isEmployee, loadCorrections])

  const updateForm = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const submitRequest = async (event) => {
    event.preventDefault()
    setSavingRequest(true)
    setError('')
    setNotice('')
    try {
      await api.post('/api/attendance/corrections', form)
      setNotice('Correction request submitted.')
      setForm((current) => ({ ...current, reason: '' }))
      await loadCorrections()
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not submit correction request.')
    } finally {
      setSavingRequest(false)
    }
  }

  const reviewCorrection = async (correction, decision) => {
    const comment = comments[correction.id]?.trim() || ''
    if (!comment) {
      setError('Enter a review comment before taking action.')
      return
    }
    setBusyId(correction.id)
    setError('')
    setNotice('')
    try {
      await api.post(`/api/attendance/corrections/${correction.id}/${decision}`, { comment })
      setNotice(`Correction ${decision}.`)
      await loadCorrections()
    } catch (requestError) {
      setError(requestError.response?.data?.message || `Could not ${decision} correction.`)
    } finally {
      setBusyId('')
    }
  }

  return (
    <section className="mx-auto w-full max-w-5xl">
      <h1 className="text-2xl font-semibold">Attendance Corrections</h1>
      <p className="mt-1 text-sm text-slate-600">
        {isEmployee ? 'Request a change to a past attendance record.' : canReview ? 'Review pending employee requests.' : 'View attendance correction requests.'}
      </p>
      {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
      {notice && <p className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800" role="status">{notice}</p>}

      {isEmployee && (
        <form onSubmit={submitRequest} className="mt-5 grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 sm:p-6">
          <h2 className="font-semibold sm:col-span-2">New correction request</h2>
          <label className="text-sm font-medium text-slate-700">
            Date
            <input required type="date" max={todayDate} name="date" value={form.date} onChange={updateForm} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Requested check-in
            <input required type="time" name="requestedCheckIn" value={form.requestedCheckIn} onChange={updateForm} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Requested check-out
            <input required type="time" name="requestedCheckOut" value={form.requestedCheckOut} onChange={updateForm} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            Reason
            <textarea required maxLength={500} rows={3} name="reason" value={form.reason} onChange={updateForm} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <button type="submit" disabled={savingRequest} className="w-fit rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 sm:col-span-2">
            {savingRequest ? 'Submitting...' : 'Submit request'}
          </button>
        </form>
      )}

      <div className="mt-5">
        <h2 className="text-lg font-semibold">{isEmployee ? 'My requests' : canReview ? 'Pending requests' : 'Correction requests'}</h2>
        {loading ? (
          <p className="mt-3 text-sm text-slate-600" role="status">Loading correction requests...</p>
        ) : corrections.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
            {canReview ? 'There are no pending correction requests.' : 'No correction requests yet.'}
          </p>
        ) : (
          <div className="mt-3 grid gap-3">
            {corrections.map((correction) => (
              <article key={correction.id} className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{correction.employee?.name || 'My request'} · {correction.date}</h3>
                    {correction.employee?.code && <p className="mt-1 text-xs text-slate-500">{correction.employee.code}</p>}
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize">{correction.status}</span>
                </div>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div><dt className="text-xs uppercase text-slate-500">Requested check-in</dt><dd>{correction.requestedCheckIn}</dd></div>
                  <div><dt className="text-xs uppercase text-slate-500">Requested check-out</dt><dd>{correction.requestedCheckOut}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-xs uppercase text-slate-500">Reason</dt><dd className="break-words">{correction.reason}</dd></div>
                  {correction.comment && <div className="sm:col-span-2"><dt className="text-xs uppercase text-slate-500">Review comment</dt><dd>{correction.comment}</dd></div>}
                </dl>
                {canReview && correction.status === 'pending' && (
                  <div className="mt-4">
                    <label className="text-sm font-medium text-slate-700">
                      Review comment
                      <textarea required maxLength={500} rows={2} value={comments[correction.id] || ''} onChange={(event) => setComments((current) => ({ ...current, [correction.id]: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
                    </label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button type="button" disabled={busyId === correction.id} onClick={() => reviewCorrection(correction, 'approve')} className="rounded-lg bg-green-700 px-3 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-60">Approve</button>
                      <button type="button" disabled={busyId === correction.id} onClick={() => reviewCorrection(correction, 'reject')} className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60">Reject</button>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export default AttendanceCorrectionsPage
