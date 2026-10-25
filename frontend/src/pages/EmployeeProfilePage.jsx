import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../api/axios.js'
import useAuthContext from '../context/useAuth.js'

function EmployeeProfilePage() {
  const { user } = useAuthContext()
  const { id } = useParams()
  const isSelf = user.role === 'employee'
  const employeeId = isSelf ? user.employeeId : id
  const [employee, setEmployee] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const canManage = user.role === 'hr'

  const loadEmployee = useCallback(async () => {
    const { data } = isSelf
      ? await api.get('/api/employees/me')
      : await api.get(`/api/employees/${employeeId}`)
    return data.employee
  }, [employeeId, isSelf])

  useEffect(() => {
    let active = true
    loadEmployee()
      .then((record) => {
        if (active) {
          setEmployee(record)
          setPhone(record.phone)
          setAddress(record.address)
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Could not load employee profile.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [loadEmployee])

  const submitProfile = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const { data } = isSelf
        ? await api.put('/api/employees/me', { phone: phone.trim(), address: address.trim() })
        : await api.put(`/api/employees/${employeeId}`, { phone: phone.trim(), address: address.trim() })
      setEmployee(data.employee)
      setNotice('Profile updated.')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not update profile.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-600" role="status">Loading employee profile...</p>
  }
  if (error && !employee) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
        {error}
        <button type="button" onClick={async () => {
          setLoading(true)
          setError('')
          try {
            const record = await loadEmployee()
            setEmployee(record)
            setPhone(record.phone)
            setAddress(record.address)
          } catch (requestError) {
            setError(requestError.response?.data?.message || 'Could not load employee profile.')
          } finally {
            setLoading(false)
          }
        }} className="ml-3 font-semibold underline">Retry</button>
      </div>
    )
  }
  if (!employee) return null

  const details = [
    ['Employee code', employee.code],
    ['Name', employee.name],
    ['Email', employee.email],
    ['Gender', employee.gender.replaceAll('_', ' ')],
    ['Department', employee.department.name],
    ['Designation', employee.designation.name],
    ['Join date', employee.joinDate],
    ['Status', employee.status],
    ['Exit date', employee.exitDate || '—'],
  ]
  if (!isSelf) details.push(['Basic salary', employee.basicSalary])

  return (
    <section className="mx-auto w-full max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{isSelf ? 'My Profile' : 'Employee 360'}</h1>
          <p className="mt-1 text-sm text-slate-600">{employee.name} · {employee.code}</p>
        </div>
        {!isSelf && <Link to="/employees" className="text-sm font-medium underline">Back to directory</Link>}
      </div>

      {canManage && (
        <div className="mt-5 flex flex-wrap gap-2">
          <Link to={`/employees/${employee.id}/edit`} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700">Edit employee</Link>
          <button type="button" onClick={async () => {
            setError('')
            try {
              const { data } = await api.patch(`/api/employees/${employee.id}/login`, { isActive: false })
              setNotice(data.user.isActive ? 'Employee login activated.' : 'Employee login deactivated.')
            } catch (requestError) {
              setError(requestError.response?.data?.message || 'Could not update employee login.')
            }
          }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium">
            Deactivate login
          </button>
          <button type="button" onClick={async () => {
            setError('')
            try {
              const { data } = await api.post(`/api/employees/${employee.id}/reset-password`)
              setNotice(`One-time temporary password for ${data.user.email}: ${data.temporaryPassword}`)
            } catch (requestError) {
              setError(requestError.response?.data?.message || 'Could not reset employee password.')
            }
          }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium">
            Reset login password
          </button>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-700" role="alert">{error}</p>}
      {notice && <p className="mt-4 break-words rounded-lg bg-green-50 p-3 text-sm text-green-800" role="status">{notice}</p>}

      <div className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 sm:p-6">
        {details.map(([label, value]) => (
          <div key={label} className="min-w-0 border-b border-slate-100 pb-3">
            <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
            <p className="mt-1 break-words text-sm text-slate-900">{value}</p>
          </div>
        ))}
        <div className="sm:col-span-2 border-b border-slate-100 pb-3">
          <p className="text-xs font-medium uppercase text-slate-500">Address</p>
          <p className="mt-1 break-words text-sm text-slate-900">{employee.address}</p>
        </div>
      </div>

      {isSelf && (
        <form onSubmit={submitProfile} className="mt-5 grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 sm:p-6">
          <h2 className="font-semibold sm:col-span-2">Edit my contact details</h2>
          <label className="text-sm font-medium text-slate-700">
            Phone
            <input required maxLength={40} value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Address
            <textarea required maxLength={500} rows={2} value={address} onChange={(event) => setAddress(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
          </label>
          <button type="submit" disabled={saving} className="w-fit rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 sm:col-span-2">
            {saving ? 'Saving...' : 'Save contact details'}
          </button>
        </form>
      )}
    </section>
  )
}

export default EmployeeProfilePage
