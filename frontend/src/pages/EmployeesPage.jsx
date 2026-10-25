import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/axios.js'
import useAuthContext from '../context/useAuth.js'

function EmployeesPage() {
  const { user } = useAuthContext()
  const canManage = user.role === 'hr'
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [departments, setDepartments] = useState([])
  const [employees, setEmployees] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadEmployees = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = { page: pagination.page, pageSize: pagination.pageSize }
      if (search) params.search = search
      if (departmentFilter) params.department = departmentFilter
      if (statusFilter) params.status = statusFilter
      const { data } = await api.get('/api/employees', { params })
      setEmployees(data.employees)
      setPagination(data.pagination)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not load employees.')
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.pageSize, search, departmentFilter, statusFilter])

  useEffect(() => {
    let active = true
    api.get('/api/settings/departments')
      .then(({ data }) => {
        if (active) setDepartments(data.departments)
      })
      .catch(() => {
        if (active) setError('Could not load department filters.')
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    const params = { page: pagination.page, pageSize: pagination.pageSize }
    if (search) params.search = search
    if (departmentFilter) params.department = departmentFilter
    if (statusFilter) params.status = statusFilter
    api.get('/api/employees', { params })
      .then(({ data }) => {
        if (active) {
          setEmployees(data.employees)
          setPagination(data.pagination)
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Could not load employees.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [pagination.page, pagination.pageSize, search, departmentFilter, statusFilter])

  const exportCsv = async () => {
    setError('')
    try {
      const params = {}
      if (search) params.search = search
      if (departmentFilter) params.department = departmentFilter
      if (statusFilter) params.status = statusFilter
      const { data } = await api.get('/api/employees/export', { params, responseType: 'blob' })
      const url = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = url
      link.download = 'hcm-employees.csv'
      link.click()
      URL.revokeObjectURL(url)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not export employees.')
    }
  }

  const runSearch = (event) => {
    event.preventDefault()
    setLoading(true)
    setPagination((current) => ({ ...current, page: 1 }))
    setSearch(searchInput.trim())
  }

  const changeDepartment = (value) => {
    setLoading(true)
    setDepartmentFilter(value)
    setPagination((current) => ({ ...current, page: 1 }))
  }

  const changeStatus = (value) => {
    setLoading(true)
    setStatusFilter(value)
    setPagination((current) => ({ ...current, page: 1 }))
  }

  const changePage = (page) => {
    setLoading(true)
    setPagination((current) => ({ ...current, page }))
  }

  return (
    <section className="mx-auto w-full max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Employees</h1>
          <p className="mt-1 text-sm text-slate-600">{user.role === 'admin' ? 'Read-only employee directory.' : 'Search and manage employee profiles.'}</p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={exportCsv} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-100">Export CSV</button>
            <Link to="/employees/import" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-100">Import CSV</Link>
            <Link to="/employees/new" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700">Add employee</Link>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
          <button type="button" onClick={loadEmployees} className="ml-3 font-semibold underline">Retry</button>
        </div>
      )}

      <form onSubmit={runSearch} className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[minmax(200px,1fr)_200px_160px_auto]">
        <label className="sr-only" htmlFor="employee-search">Search employees</label>
        <input id="employee-search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search name, code, or email" className="min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <label className="sr-only" htmlFor="department-filter">Filter department</label>
        <select id="department-filter" value={departmentFilter} onChange={(event) => changeDepartment(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">All departments</option>
          {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
        </select>
        <label className="sr-only" htmlFor="status-filter">Filter status</label>
        <select id="status-filter" value={statusFilter} onChange={(event) => changeStatus(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="probation">Probation</option>
          <option value="exited">Exited</option>
        </select>
        <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">Search</button>
      </form>

      {loading ? (
        <p className="mt-5 text-sm text-slate-600" role="status">Loading employees...</p>
      ) : employees.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
          No employees found. {canManage ? 'Register an employee or adjust your filters.' : 'Employees will appear here when registered.'}
        </p>
      ) : (
        <>
          <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Designation</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((employee) => (
                  <tr key={employee.id}>
                    <td className="px-4 py-3">
                      <span className="block font-medium text-slate-900">{employee.name}</span>
                      <span className="block text-slate-500">{employee.email}</span>
                    </td>
                    <td className="px-4 py-3">{employee.code}</td>
                    <td className="px-4 py-3">{employee.department.name}</td>
                    <td className="px-4 py-3">{employee.designation.name}</td>
                    <td className="px-4 py-3 capitalize">{employee.status}</td>
                    <td className="px-4 py-3">{employee.joinDate}</td>
                    <td className="px-4 py-3">
                      <Link to={`/employees/${employee.id}`} className="font-medium underline">View profile</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
            <p>{pagination.total} employees · Page {pagination.page} of {Math.max(pagination.totalPages, 1)}</p>
            <div className="flex gap-2">
              <button type="button" disabled={pagination.page <= 1} onClick={() => changePage(pagination.page - 1)} className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-50">Previous</button>
              <button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => changePage(pagination.page + 1)} className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-50">Next</button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

export default EmployeesPage
