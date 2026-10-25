import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import EmployeeForm from '../components/EmployeeForm.jsx'
import api from '../api/axios.js'

function EmployeeFormPage({ mode }) {
  const isEditing = mode === 'edit'
  const { id } = useParams()
  const navigate = useNavigate()
  const [employee, setEmployee] = useState(null)
  const [loading, setLoading] = useState(isEditing)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [temporaryPassword, setTemporaryPassword] = useState('')
  const [savedEmployeeId, setSavedEmployeeId] = useState('')

  useEffect(() => {
    if (!isEditing) return undefined
    let active = true

    api.get(`/api/employees/${id}`)
      .then(({ data }) => {
        if (active) {
          setEmployee({
            ...data.employee,
            department: data.employee.department.id,
            designation: data.employee.designation.id,
            exitDate: data.employee.exitDate || '',
          })
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Could not load employee.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [id, isEditing])

  const submitEmployee = async (payload) => {
    setBusy(true)
    setError('')
    try {
      if (isEditing) {
        await api.put(`/api/employees/${id}`, payload)
        navigate(`/employees/${id}`, { replace: true })
      } else {
        const { data } = await api.post('/api/employees', payload)
        setTemporaryPassword(data.temporaryPassword)
        setSavedEmployeeId(data.employee.id)
      }
    } catch (requestError) {
      setError(
        requestError.response?.data?.errors?.[0]?.message ||
        requestError.response?.data?.message ||
        'Could not save employee.',
      )
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-600" role="status">Loading employee...</p>
  }

  return (
    <section className="mx-auto w-full max-w-4xl">
      <Link to={isEditing ? `/employees/${id}` : '/employees'} className="text-sm font-medium underline">← Back to employees</Link>
      <h1 className="mt-3 text-2xl font-semibold">{isEditing ? 'Edit employee' : 'Add employee'}</h1>
      <p className="mt-1 text-sm text-slate-600">
        {isEditing ? 'Update the employee and their linked login profile.' : 'A login with a one-time temporary password will be created with this employee.'}
      </p>
      {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
      {isEditing && error && (
        <button type="button" onClick={() => window.location.reload()} className="mt-2 text-sm underline">Retry</button>
      )}
      {(!isEditing || employee) && (
        <div className="mt-5">
          <EmployeeForm
            initialValue={employee || undefined}
            onSubmit={submitEmployee}
            submitLabel={isEditing ? 'Save employee' : 'Create employee'}
            busy={busy}
            error=""
          />
        </div>
      )}

      {temporaryPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="temporary-password-title">
          <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 id="temporary-password-title" className="text-xl font-semibold">Employee created</h2>
            <p className="mt-2 text-sm text-slate-600">
              Copy this temporary password now. It is shown only once, and the employee must change it at first sign-in.
            </p>
            <code className="mt-4 block break-all rounded-lg bg-slate-100 p-3 text-base">{temporaryPassword}</code>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(temporaryPassword)
                  } catch {
                    setError('Copy was blocked by the browser. Select and copy the password manually.')
                  }
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100"
              >
                Copy password
              </button>
              <button
                type="button"
                onClick={() => navigate(`/employees/${savedEmployeeId}`, { replace: true, state: { passwordSeen: true } })}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Continue to profile
              </button>
            </div>
            {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
          </section>
        </div>
      )}
    </section>
  )
}

export default EmployeeFormPage
