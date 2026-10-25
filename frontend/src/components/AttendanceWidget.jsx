import { useCallback, useEffect, useState } from 'react'
import api from '../api/axios.js'

const getCurrentMonth = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function AttendanceWidget() {
  const [today, setToday] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(0)

  const loadToday = useCallback(async () => {
    const { data } = await api.get('/api/attendance/my', { params: { month: getCurrentMonth() } })
    setToday(data.today)
  }, [])

  useEffect(() => {
    let active = true
    api.get('/api/attendance/my', { params: { month: getCurrentMonth() } })
      .then(({ data }) => {
        if (active) setToday(data.today)
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Could not load today’s attendance.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    const interval = window.setInterval(() => setNow(Date.now()), 15000)
    const initialTick = window.setTimeout(() => setNow(Date.now()), 0)
    return () => {
      active = false
      window.clearInterval(interval)
      window.clearTimeout(initialTick)
    }
  }, [])

  const handleAttendance = async (action) => {
    setBusy(true)
    setError('')
    try {
      await api.post(`/api/attendance/${action}`)
      await loadToday()
    } catch (requestError) {
      setError(requestError.response?.data?.message || `Could not ${action.replace('-', ' ')}.`)
    } finally {
      setBusy(false)
    }
  }

  const liveHours = today?.checkIn && !today.checkOut
    ? Math.max(0, (now - new Date(today.checkIn).getTime()) / 3600000)
    : today?.workedHours || 0

  if (loading) {
    return <p className="mt-5 text-sm text-slate-600" role="status">Loading today’s attendance...</p>
  }

  return (
    <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Today’s attendance</h2>
          <p className="mt-1 text-sm text-slate-600">{today?.date || 'No attendance record yet'}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium capitalize text-slate-700">
          {today?.checkIn ? (today.checkOut ? today.status?.replaceAll('_', ' ') : 'Checked in') : today?.status?.replaceAll('_', ' ') || 'Not checked in'}
        </span>
      </div>
      {error && (
        <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
          <button type="button" onClick={async () => {
            setError('')
            setLoading(true)
            try {
              await loadToday()
            } catch (requestError) {
              setError(requestError.response?.data?.message || 'Could not load today’s attendance.')
            } finally {
              setLoading(false)
            }
          }} className="ml-2 font-semibold underline">Retry</button>
        </p>
      )}
      {today?.note && <p className="mt-3 text-sm text-amber-800">{today.note}</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs uppercase text-slate-500">Check-in</p>
          <p className="mt-1 font-medium">{today?.checkInTime || '—'}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs uppercase text-slate-500">Check-out</p>
          <p className="mt-1 font-medium">{today?.checkOutTime || '—'}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs uppercase text-slate-500">Worked hours</p>
          <p className="mt-1 font-medium">{liveHours.toFixed(2)} h</p>
        </div>
      </div>
      <div className="mt-4">
        {!today?.checkIn ? (
          <button type="button" disabled={busy} onClick={() => handleAttendance('check-in')} className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">
            {busy ? 'Checking in...' : 'Check in'}
          </button>
        ) : !today.checkOut ? (
          <button type="button" disabled={busy} onClick={() => handleAttendance('check-out')} className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">
            {busy ? 'Checking out...' : 'Check out'}
          </button>
        ) : (
          <p className="text-sm text-slate-600">Your attendance for today is complete.</p>
        )}
      </div>
    </section>
  )
}

export default AttendanceWidget
