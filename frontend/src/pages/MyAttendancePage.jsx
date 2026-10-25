import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/axios.js'

const getCurrentMonth = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const statusStyles = {
  present: 'border-green-200 bg-green-50 text-green-800',
  late: 'border-amber-200 bg-amber-50 text-amber-800',
  half_day: 'border-orange-200 bg-orange-50 text-orange-800',
  absent: 'border-red-200 bg-red-50 text-red-800',
  missing_checkout: 'border-purple-200 bg-purple-50 text-purple-800',
  on_leave: 'border-blue-200 bg-blue-50 text-blue-800',
}

const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function MyAttendancePage() {
  const [month, setMonth] = useState(getCurrentMonth)
  const [retryCount, setRetryCount] = useState(0)
  const [loadedMonth, setLoadedMonth] = useState('')
  const [days, setDays] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    api.get('/api/attendance/my', { params: { month } })
      .then(({ data }) => {
        if (active) {
          setDays(data.days)
          setLoadedMonth(month)
          setError('')
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Could not load attendance calendar.')
      })
    return () => { active = false }
  }, [month, retryCount])

  const loading = loadedMonth !== month && !error
  const leadingSpaces = days.length
    ? new Date(`${days[0].date}T00:00:00.000Z`).getUTCDay()
    : 0

  return (
    <section className="mx-auto w-full max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">My Attendance</h1>
          <p className="mt-1 text-sm text-slate-600">Your attendance days and check-in/out times.</p>
        </div>
        <label className="text-sm font-medium text-slate-700">
          Month
          <input type="month" value={month} onChange={(event) => {
            setError('')
            setMonth(event.target.value)
          }} className="ml-2 rounded-lg border border-slate-300 px-3 py-2" />
        </label>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
          <button type="button" onClick={() => {
            setError('')
            setRetryCount((count) => count + 1)
          }} className="ml-3 font-semibold underline">Retry</button>
        </div>
      )}
      {loading ? (
        <p className="mt-5 text-sm text-slate-600" role="status">Loading attendance calendar...</p>
      ) : error ? null : days.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">No attendance days for this month.</p>
      ) : (
        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-3 sm:p-5">
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {weekDays.map((day) => <div key={day} className="py-2 text-center text-xs font-semibold text-slate-500">{day}</div>)}
            {Array.from({ length: leadingSpaces }, (_, index) => <div key={`blank-${index}`} />)}
            {days.map((day) => {
              const status = day.status || (day.note === 'Weekend.' ? 'Weekend' : day.note === 'Company holiday.' ? 'Holiday' : '—')
              const style = statusStyles[day.status] || 'border-slate-200 bg-slate-50 text-slate-600'
              return (
                <article key={day.date} className={`min-h-24 rounded-lg border p-2 ${style} sm:min-h-28 sm:p-3`}>
                  <p className="text-sm font-semibold">{Number(day.date.slice(-2))}</p>
                  <p className="mt-1 text-[11px] font-medium capitalize leading-tight sm:text-xs">{String(status).replaceAll('_', ' ')}</p>
                  {day.checkInTime && <p className="mt-2 text-[10px] sm:text-xs">In {day.checkInTime}</p>}
                  {day.checkOutTime && <p className="text-[10px] sm:text-xs">Out {day.checkOutTime}</p>}
                  {day.workedHours > 0 && <p className="mt-1 text-[10px] sm:text-xs">{day.workedHours} h</p>}
                </article>
              )
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600">
            {Object.entries(statusStyles).map(([status, style]) => (
              <span key={status} className={`rounded-full border px-2 py-1 capitalize ${style}`}>{status.replaceAll('_', ' ')}</span>
            ))}
          </div>
        </div>
      )}
      <Link to="/attendance/corrections" className="mt-5 inline-block rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700">
        Request an attendance correction
      </Link>
    </section>
  )
}

export default MyAttendancePage
