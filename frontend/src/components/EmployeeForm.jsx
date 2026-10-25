import { useEffect, useState } from 'react'
import api from '../api/axios.js'

const emptyEmployee = {
  code: '',
  name: '',
  email: '',
  phone: '',
  address: '',
  gender: 'prefer_not_to_say',
  department: '',
  designation: '',
  joinDate: '',
  status: 'probation',
  exitDate: '',
  basicSalary: '',
}

function EmployeeForm({ initialValue = emptyEmployee, onSubmit, submitLabel, busy, error }) {
  const [form, setForm] = useState({ ...emptyEmployee, ...initialValue })
  const [departments, setDepartments] = useState([])
  const [designations, setDesignations] = useState([])
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [optionsError, setOptionsError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([
      api.get('/api/settings/departments'),
      api.get('/api/settings/designations'),
    ])
      .then(([departmentResponse, designationResponse]) => {
        if (active) {
          setDepartments(departmentResponse.data.departments)
          setDesignations(designationResponse.data.designations)
        }
      })
      .catch(() => {
        if (active) {
          setOptionsError('Could not load department or designation options. Retry to continue.')
        }
      })
      .finally(() => {
        if (active) {
          setOptionsLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  const changeField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    onSubmit({
      ...form,
      email: form.email.trim(),
      code: form.code.trim(),
      name: form.name.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      exitDate: form.exitDate || null,
      basicSalary: Number(form.basicSalary),
    })
  }

  const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal disabled:bg-slate-100'

  if (optionsLoading) {
    return <p className="text-sm text-slate-600" role="status">Loading organization options...</p>
  }

  if (optionsError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
        {optionsError}
        <button type="button" onClick={() => window.location.reload()} className="ml-2 font-semibold underline">Retry</button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 sm:p-6">
      <label className="text-sm font-medium text-slate-700">
        Employee code
        <input required maxLength={50} name="code" value={form.code} onChange={changeField} className={inputClass} />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Full name
        <input required maxLength={100} name="name" value={form.name} onChange={changeField} className={inputClass} />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Email
        <input required type="email" maxLength={254} name="email" value={form.email} onChange={changeField} className={inputClass} />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Phone
        <input required maxLength={40} name="phone" value={form.phone} onChange={changeField} className={inputClass} />
      </label>
      <label className="text-sm font-medium text-slate-700 sm:col-span-2">
        Address
        <textarea required maxLength={500} rows={2} name="address" value={form.address} onChange={changeField} className={inputClass} />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Gender
        <select required name="gender" value={form.gender} onChange={changeField} className={inputClass}>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
          <option value="prefer_not_to_say">Prefer not to say</option>
        </select>
      </label>
      <label className="text-sm font-medium text-slate-700">
        Department
        <select required name="department" value={form.department} onChange={changeField} className={inputClass}>
          <option value="">Select department</option>
          {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
        </select>
      </label>
      <label className="text-sm font-medium text-slate-700">
        Designation
        <select required name="designation" value={form.designation} onChange={changeField} className={inputClass}>
          <option value="">Select designation</option>
          {designations.map((designation) => <option key={designation.id} value={designation.id}>{designation.name}</option>)}
        </select>
      </label>
      <label className="text-sm font-medium text-slate-700">
        Join date
        <input required type="date" name="joinDate" value={form.joinDate} onChange={changeField} className={inputClass} />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Status
        <select required name="status" value={form.status} onChange={changeField} className={inputClass}>
          <option value="active">Active</option>
          <option value="probation">Probation</option>
          <option value="exited">Exited</option>
        </select>
      </label>
      <label className="text-sm font-medium text-slate-700">
        Exit date
        <input type="date" name="exitDate" value={form.exitDate || ''} onChange={changeField} className={inputClass} />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Basic salary
        <input required type="number" min="0.01" step="0.01" name="basicSalary" value={form.basicSalary} onChange={changeField} className={inputClass} />
      </label>
      {error && <p className="text-sm text-red-700 sm:col-span-2" role="alert">{error}</p>}
      <div className="sm:col-span-2">
        <button type="submit" disabled={busy} className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">
          {busy ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  )
}

export default EmployeeForm
