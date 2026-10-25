import { useCallback, useEffect, useState } from 'react'
import api from '../api/axios.js'
import useAuthContext from '../context/useAuth.js'

function HRUsersSettingsPage() {
  const { user } = useAuthContext()
  const readOnly = user.role !== 'admin'
  const [users, setUsers] = useState([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [temporaryPassword, setTemporaryPassword] = useState('')

  const fetchUsers = useCallback(async () => {
    const { data } = await api.get('/api/settings/hr-users')
    return data.hrUsers
  }, [])

  const loadUsers = async () => {
    setLoading(true)
    setError('')
    try {
      setUsers(await fetchUsers())
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not load HR users.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    fetchUsers()
      .then((result) => {
        if (active) {
          setUsers(result)
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError.response?.data?.message || 'Could not load HR users.')
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [fetchUsers])

  const createUser = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setNotice('')
    setTemporaryPassword('')
    try {
      const { data } = await api.post('/api/settings/hr-users', { name: name.trim(), email })
      setUsers((current) => [...current, data.hrUser].sort((a, b) => a.name.localeCompare(b.name)))
      setName('')
      setEmail('')
      setTemporaryPassword(data.temporaryPassword)
      setNotice('HR account created. Copy the temporary password now; it will not be shown again.')
    } catch (requestError) {
      setError(
        requestError.response?.data?.errors?.[0]?.message ||
        requestError.response?.data?.message ||
        'Could not create the HR account.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const toggleActive = async (hrUser) => {
    setError('')
    setNotice('')
    try {
      const { data } = await api.patch(`/api/settings/hr-users/${hrUser.id}`, {
        isActive: !hrUser.isActive,
      })
      setUsers((current) => current.map((item) => item.id === hrUser.id ? data.hrUser : item))
      setNotice(`HR account ${data.hrUser.isActive ? 'activated' : 'deactivated'}.`)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not update this HR account.')
    }
  }

  const resetPassword = async (hrUser) => {
    setError('')
    setNotice('')
    setTemporaryPassword('')
    try {
      const { data } = await api.post(`/api/settings/hr-users/${hrUser.id}/reset-password`)
      setUsers((current) => current.map((item) => item.id === hrUser.id ? data.hrUser : item))
      setTemporaryPassword(data.temporaryPassword)
      setNotice(`Temporary password generated for ${hrUser.name}. Copy it now; it will not be shown again.`)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not reset this HR account password.')
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">HR users</h2>
          {!loading && <span className="text-sm text-slate-500">{users.length} total</span>}
        </div>
        {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
        {notice && <p className="mt-3 text-sm text-green-700" role="status">{notice}</p>}
        {temporaryPassword && (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-900">One-time temporary password</p>
            <code className="mt-2 block break-all rounded bg-white p-3 text-base text-slate-900">{temporaryPassword}</code>
            <p className="mt-2 text-xs text-amber-900">Share it securely with the HR user. It will not be displayed again.</p>
          </div>
        )}
        {loading ? (
          <p className="mt-4 text-sm text-slate-600" role="status">Loading HR users...</p>
        ) : users.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
            No HR users yet.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {users.map((hrUser) => (
              <li key={hrUser.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{hrUser.name}</p>
                  <p className="truncate text-sm text-slate-500">{hrUser.email}</p>
                  <p className={`mt-1 text-xs ${hrUser.isActive ? 'text-green-700' : 'text-red-700'}`}>
                    {hrUser.isActive ? 'Active' : 'Inactive'}
                    {hrUser.mustChangePassword ? ' · Must change password' : ''}
                  </p>
                </div>
                {!readOnly && (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => resetPassword(hrUser)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100">Reset password</button>
                    <button type="button" onClick={() => toggleActive(hrUser)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100">
                      {hrUser.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {error && (
          <button type="button" onClick={loadUsers} className="mt-3 text-sm font-medium underline">Retry loading HR users</button>
        )}
      </section>

      {!readOnly ? (
        <form onSubmit={createUser} className="h-fit space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="font-semibold">Create HR account</h3>
          <p className="text-sm text-slate-600">A temporary password will be generated and shown once. The user must change it on first sign-in.</p>
          <label className="block text-sm font-medium text-slate-700">
            Name
            <input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input required type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
          </label>
          <button type="submit" disabled={submitting} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">
            {submitting ? 'Creating...' : 'Create HR account'}
          </button>
        </form>
      ) : (
        <p className="h-fit rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Read-only: only an Admin can create, deactivate or reset HR accounts.
        </p>
      )}
    </div>
  )
}

export default HRUsersSettingsPage
