import { useCallback, useEffect, useState } from 'react'
import api from '../api/axios.js'

const getCurrentDate = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const statusStyles = {
  present: 'bg-green-100 text-green-800',
  late: 'bg-amber-100 text-amber-800',
  half_day: 'bg-orange-100 text-orange-800',
  absent: 'bg-red-100 text-red-800',
  missing_checkout: 'bg-purple-100 text-purple-800',
  on_leave: 'bg-blue-100 text-blue-800',
}

function AttendanceBoardPage() {
  const [date, setDate] = useState(getCurrentDate)
  const [department, setDepartment] = useState('')
  const [departments, setDepartments] = useState([])
  const [employees, setEmployees] = useState([])
  const [loadedKey, setLoadedKey] = useState('')
  const [error, setError] = useState('')

  const fetchBoard = useCallback(() => {
    const params = { date }
    if (department) params.department = department
    return api.get('/api/attendance/board', { params })
  }, [date, department])

  useEffect(() => {
    let active = true
    api.get('/api/settings/departments')
      .then(({ data }) => {
        if (active) setDepartments(data.departments)
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Could not load departments.')
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    fetchBoard()
      .then(({ data }) => {
        if (active) {
          setEmployees(data.employees)
          setLoadedKey(`${date}:${department}`)
          setError('')
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Could not load attendance board.')
      })
    return () => { active = false }
  }, [fetchBoard, date, department])

  const queryKey = `${date}:${department}`
  const loading = loadedKey !== queryKey && !error

  return (
    <section className="mx-auto w-full max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold">Attendance Board</h1>
        <p className="mt-1 text-sm text-slate-600">Daily status for active and probationary employees.</p>
      </div>
      <div className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[200px_minmax(200px,1fr)]">
        <label className="text-sm font-medium text-slate-700">
          Date
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Department
          <select value={department} onChange={(event) => setDepartment(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
            <option value="">All departments</option>
            {departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      </div>
      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
          <button type="button" onClick={() => fetchBoard().then(({ data }) => {
            setEmployees(data.employees)
            setLoadedKey(queryKey)
            setError('')
          }).catch((requestError) => setError(requestError.response?.data?.message || 'Could not load attendance board.'))} className="ml-3 font-semibold underline">Retry</button>
        </div>
      )}
      {loading ? (
        <p className="mt-5 text-sm text-slate-600" role="status">Loading attendance board...</p>
      ) : employees.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">No active employees match this filter.</p>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Code</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Check-in</th><th className="px-4 py-3">Check-out</th><th className="px-4 py-3">Hours</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map((employee) => (
                <tr key={employee.employeeId}>
                  <td className="px-4 py-3 font-medium">{employee.name}</td>
                  <td className="px-4 py-3">{employee.code}</td>
                  <td className="px-4 py-3">{employee.department.name}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusStyles[employee.status] || 'bg-slate-100 text-slate-700'}`}>
                      {employee.status?.replaceAll('_', ' ') || (employee.note === 'Weekend.' ? 'Weekend' : employee.note === 'Company holiday.' ? 'Holiday' : '—')}
                    </span>
                    {employee.note && <p className="mt-1 text-xs text-slate-500">{employee.note}</p>}
                  </td>
                  <td className="px-4 py-3">{employee.checkInTime || '—'}</td>
                  <td className="px-4 py-3">{employee.checkOutTime || '—'}</td>
                  <td className="px-4 py-3">{employee.workedHours.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default AttendanceBoardPage
