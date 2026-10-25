import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import api from '../api/axios.js'
import AnnouncementList from './AnnouncementList.jsx'

const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#9333ea', '#0891b2', '#ef4444']

const getDateRange = (isAdmin) => {
  const now = new Date()
  const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return { from: isAdmin ? `${to.slice(0, 4)}-01-01` : `${to.slice(0, 7)}-01`, to }
}

function MetricCard({ label, value, detail }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
    </article>
  )
}

function ChartPanel({ title, children, empty }) {
  return (
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {empty ? (
        <p className="mt-5 flex h-64 items-center justify-center text-center text-sm text-slate-500">
          No data for this selection.
        </p>
      ) : (
        <div className="mt-4 h-64 w-full">{children}</div>
      )}
    </section>
  )
}

function DashboardFilters({ from, to, department, departments, onChange }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="text-sm font-medium text-slate-700">
        From
        <input type="date" value={from} max={to} onChange={(event) => onChange('from', event.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2" />
      </label>
      <label className="text-sm font-medium text-slate-700">
        To
        <input type="date" value={to} min={from} onChange={(event) => onChange('to', event.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2" />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Department
        <select value={department} onChange={(event) => onChange('department', event.target.value)} className="mt-1 block min-w-44 rounded-lg border border-slate-300 px-3 py-2">
          <option value="">All departments</option>
          {departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
    </div>
  )
}

function AnalyticsDashboard({ type }) {
  const isAdmin = type === 'admin'
  const [filters, setFilters] = useState(() => getDateRange(isAdmin))
  const [department, setDepartment] = useState('')
  const [departments, setDepartments] = useState([])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const endpoint = isAdmin ? '/api/dashboard/admin' : '/api/dashboard/hr'
  const params = useMemo(() => ({
    from: filters.from,
    to: filters.to,
    ...(department ? { department } : {}),
  }), [filters, department])

  useEffect(() => {
    let active = true
    Promise.all([
      api.get(endpoint, { params }),
      api.get('/api/settings/departments'),
    ]).then(([dashboardResponse, departmentsResponse]) => {
      if (!active) return
      setData(dashboardResponse.data)
      setDepartments(departmentsResponse.data.departments)
      setError('')
    }).catch((requestError) => {
      if (active) setError(requestError.response?.data?.message || 'Could not load dashboard analytics.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [endpoint, params, retryCount])

  const retry = () => {
    setLoading(true)
    setRetryCount((count) => count + 1)
  }
  const changeFilter = (field, value) => {
    if (!value && field !== 'department') return
    setLoading(true)
    setSummary(null)
    setSummaryError('')
    if (field === 'department') setDepartment(value)
    else setFilters((current) => ({ ...current, [field]: value }))
  }

  const summarize = async () => {
    setSummaryLoading(true)
    setSummaryError('')
    try {
      const { data: response } = await api.post('/api/ai/dashboard-summary', {
        kpis: data,
        filters: params,
      })
      if (!response.summary) {
        setSummaryError(response.message || 'Could not create an AI summary.')
        setSummary(null)
      } else {
        setSummary(response.summary)
      }
    } catch (requestError) {
      setSummaryError(requestError.response?.data?.message || 'Could not create an AI summary.')
      setSummary(null)
    } finally {
      setSummaryLoading(false)
    }
  }

  const heading = isAdmin ? 'Admin dashboard' : 'HR dashboard'

  return (
    <section className="mx-auto w-full max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{heading}</h1>
          <p className="mt-1 text-sm text-slate-600">Live analytics based on organization records.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <DashboardFilters
            from={filters.from}
            to={filters.to}
            department={department}
            departments={departments}
            onChange={changeFilter}
          />
          <button
            type="button"
            onClick={summarize}
            disabled={!data || loading || summaryLoading}
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {summaryLoading ? 'Summarizing...' : 'Summarize'}
          </button>
        </div>
      </div>
      {error && (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
          <button type="button" onClick={retry} className="ml-3 font-semibold underline">Retry</button>
        </div>
      )}
      {summaryError && <p className="mt-4 text-sm text-red-700" role="alert">{summaryError}</p>}
      {summary && (
        <section className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-blue-950">Dashboard summary</h2>
            <span className="text-xs font-semibold uppercase tracking-wide text-blue-800">AI-generated</span>
          </div>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-blue-950">
            {summary.bullets.map((bullet, index) => <li key={`${index}-${bullet}`}>{bullet}</li>)}
          </ul>
        </section>
      )}
      {loading ? (
        <p className="mt-6 text-sm text-slate-600" role="status">Loading dashboard analytics...</p>
      ) : error ? null : !data ? (
        <p className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">Dashboard data is not available.</p>
      ) : (
        isAdmin ? <AdminDashboardData data={data} /> : <HrDashboardData data={data} />
      )}
    </section>
  )
}

function HrDashboardData({ data }) {
  const trend = data.attendanceTrend || []
  const absenteeism = data.absenteeismByDepartment || []
  const leaveByType = data.leaveByType || []
  const topLate = data.topLateComers || []
  return (
    <>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Headcount" value={data.headcount} />
        <MetricCard label="Present today" value={data.presentToday} />
        <MetricCard label="On leave today" value={data.onLeaveToday} />
        <MetricCard label="Late today" value={data.lateToday} />
        <MetricCard label="Pending approvals" value={data.pendingApprovals.total} detail={`${data.pendingApprovals.leave} leave · ${data.pendingApprovals.attendanceCorrections} attendance`} />
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <ChartPanel title="Attendance rate trend" empty={!trend.length}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 8, right: 12, left: -16, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={(value) => value.slice(5)} minTickGap={24} />
              <YAxis domain={[0, 100]} unit="%" />
              <Tooltip formatter={(value) => `${value}%`} labelFormatter={(value) => `Date: ${value}`} />
              <Legend />
              <Line type="monotone" dataKey="attendanceRate" name="Attendance rate" stroke="#2563eb" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="latePercent" name="Late %" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title="Absenteeism by department" empty={!absenteeism.length}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={absenteeism} margin={{ top: 8, right: 12, left: -16, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="department" interval={0} angle={-15} textAnchor="end" height={55} />
              <YAxis unit="%" />
              <Tooltip formatter={(value, name) => [name === 'absenteeismRate' ? `${value}%` : value, name === 'absenteeismRate' ? 'Absenteeism' : name]} />
              <Bar dataKey="absenteeismRate" name="Absenteeism" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title="Approved leave by type" empty={!leaveByType.length}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={leaveByType} dataKey="approvedDays" nameKey="name" cx="50%" cy="50%" outerRadius="75%" label={({ name, value }) => `${name} (${value})`}>
                {leaveByType.map((item, index) => <Cell key={item.leaveTypeId} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title="Leave utilization by type" empty={!leaveByType.length}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={leaveByType} margin={{ top: 8, right: 12, left: -16, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" interval={0} angle={-15} textAnchor="end" height={55} />
              <YAxis unit="%" />
              <Tooltip formatter={(value) => `${value}%`} />
              <Bar dataKey="utilizationPercent" name="Quota used" fill="#16a34a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>
      <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold">Top 5 late-comers</h2>
        {topLate.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No late check-ins in this date range.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[500px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr><th className="px-3 py-2">Employee</th><th className="px-3 py-2">Code</th><th className="px-3 py-2">Department</th><th className="px-3 py-2">Late check-ins</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topLate.map((item) => (
                  <tr key={item.employeeId}>
                    <td className="px-3 py-3 font-medium">{item.name}</td>
                    <td className="px-3 py-3">{item.code}</td>
                    <td className="px-3 py-3">{item.department || 'Unassigned'}</td>
                    <td className="px-3 py-3">{item.lateCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold">Latest announcements</h2>
        <AnnouncementList announcements={data.announcements} />
      </section>
    </>
  )
}

function AdminDashboardData({ data }) {
  const payrollDepartments = data.payrollCost.byDepartment || []
  const headcountDepartments = data.headcountByDepartment || []
  const payrollMonths = data.payrollCost.byMonth || []
  const gender = data.genderBreakdown || []
  const tenure = data.tenureBreakdown || []
  return (
    <>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Headcount" value={data.headcount} detail={`As of ${data.to}`} />
        <MetricCard label="Attrition" value={`${data.attrition.rate}%`} detail={`${data.attrition.exits} exits · avg ${data.attrition.averageHeadcount} headcount`} />
        <MetricCard label="Finalized payroll gross" value={money(data.payrollCost.gross)} />
        <MetricCard label="Finalized payroll net" value={money(data.payrollCost.net)} />
        <MetricCard label="Average gross salary" value={money(data.averageSalary)} />
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <ChartPanel title="Headcount by department" empty={!headcountDepartments.length}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={headcountDepartments} margin={{ top: 8, right: 12, left: -16, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="department" interval={0} angle={-15} textAnchor="end" height={55} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="headcount" name="Headcount" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title="Finalized payroll cost by department" empty={!payrollDepartments.length}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={payrollDepartments} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="department" interval={0} angle={-15} textAnchor="end" height={55} />
              <YAxis tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
              <Tooltip formatter={(value) => money(value)} />
              <Legend />
              <Bar dataKey="gross" name="Gross" fill="#2563eb" />
              <Bar dataKey="net" name="Net" fill="#16a34a" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title="Finalized payroll cost by month" empty={!payrollMonths.length}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={payrollMonths} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
              <Tooltip formatter={(value) => money(value)} />
              <Legend />
              <Bar dataKey="gross" name="Gross" fill="#7c3aed" />
              <Bar dataKey="net" name="Net" fill="#0891b2" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title="Gender distribution" empty={!gender.length}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={gender} dataKey="headcount" nameKey="gender" cx="50%" cy="50%" outerRadius="72%" label={({ name, value }) => `${name}: ${value}`}>
                {gender.map((item, index) => <Cell key={item.gender} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title="Employee tenure" empty={!tenure.some((item) => item.headcount)}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={tenure} margin={{ top: 8, right: 12, left: -16, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="range" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="headcount" name="Employees" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>
      <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold">Recent audit activity</h2>
        {!data.auditFeed?.length ? (
          <p className="mt-3 text-sm text-slate-600">No audit activity yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr><th className="px-3 py-2">When</th><th className="px-3 py-2">Actor</th><th className="px-3 py-2">Action</th><th className="px-3 py-2">Entity</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.auditFeed.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-3 py-3 whitespace-nowrap">{new Date(entry.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-3">{entry.actor}</td>
                    <td className="px-3 py-3">{entry.action}</td>
                    <td className="px-3 py-3">{entry.entityType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold">Latest announcements</h2>
        <AnnouncementList announcements={data.announcements} />
      </section>
    </>
  )
}

const money = (value) => new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'PKR',
  maximumFractionDigits: 0,
}).format(value || 0)

export default AnalyticsDashboard
