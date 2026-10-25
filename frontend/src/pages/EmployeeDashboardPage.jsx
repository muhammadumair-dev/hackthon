import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AttendanceWidget from '../components/AttendanceWidget.jsx'
import api from '../api/axios.js'
import AnnouncementList from '../components/AnnouncementList.jsx'

const money = (value) => new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'PKR',
  maximumFractionDigits: 2,
}).format(value || 0)

function EmployeeDashboardPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    let active = true
    api.get('/api/dashboard/employee')
      .then(({ data: response }) => {
        if (!active) return
        setData(response)
        setError('')
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Could not load your dashboard.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [retryCount])

  const retry = () => {
    setLoading(true)
    setRetryCount((count) => count + 1)
  }

  return (
    <section className="mx-auto w-full max-w-6xl">
      <h1 className="text-2xl font-semibold">Employee dashboard</h1>
      <AttendanceWidget />
      <div className="mt-5 flex flex-wrap gap-4 text-sm font-medium">
        <Link to="/attendance" className="text-slate-700 underline">View my attendance calendar</Link>
        <Link to="/leave" className="text-slate-700 underline">Manage leave</Link>
        <Link to="/payslips" className="text-slate-700 underline">View payslips</Link>
      </div>

      {error && (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}<button type="button" onClick={retry} className="ml-3 font-semibold underline">Retry</button>
        </div>
      )}
      {loading ? (
        <p className="mt-5 text-sm text-slate-600" role="status">Loading your personal dashboard...</p>
      ) : error ? null : !data ? (
        <p className="mt-5 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">Personal dashboard data is not available.</p>
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-500">Today</p>
              <p className="mt-2 text-lg font-semibold capitalize">{data.today.status?.replaceAll('_', ' ') || 'No status'}</p>
              <p className="mt-1 text-sm text-slate-500">{data.today.checkInTime ? `Checked in at ${data.today.checkInTime}` : data.today.date}</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-500">Hours this week</p>
              <p className="mt-2 text-2xl font-semibold">{data.week.workedHours.toFixed(2)} / {data.week.targetHours} h</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, (data.week.workedHours / data.week.targetHours) * 100)}%` }} />
              </div>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-500">Late check-ins this month</p>
              <p className="mt-2 text-2xl font-semibold">{data.lateCountThisMonth}</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-500">Last finalized payslip</p>
              {data.lastPayslip ? (
                <>
                  <p className="mt-2 text-lg font-semibold">{money(data.lastPayslip.netPay)}</p>
                  <p className="text-sm text-slate-500">{data.lastPayslip.month} net pay</p>
                </>
              ) : <p className="mt-2 text-sm text-slate-600">No finalized payslip yet.</p>}
            </article>
          </div>

          <section className="mt-6">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">Leave balance</h2>
                <p className="text-sm text-slate-500">{data.leaveBalance.year}</p>
              </div>
              <Link to="/leave" className="text-sm font-medium underline">View leave</Link>
            </div>
            {data.leaveBalance.leaveTypes.length ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {data.leaveBalance.leaveTypes.map((type) => (
                  <article key={type.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <h3 className="font-semibold">{type.name}</h3>
                    <p className="mt-2 text-sm text-slate-600">
                      Used {type.used}{type.isUnlimited ? ' days' : ` of ${type.yearlyQuota} days`}
                    </p>
                    <p className="text-sm text-slate-600">
                      {type.isUnlimited ? 'Unlimited' : `${type.remaining} days remaining`}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">No leave types have been configured.</p>
            )}
          </section>

          <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="font-semibold">Announcements</h2>
            <AnnouncementList announcements={data.announcements} />
          </section>
        </>
      )}
    </section>
  )
}

export default EmployeeDashboardPage
