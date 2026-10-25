import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuth from '../context/useAuth.js'

function ChangePasswordPage() {
  const { changePassword, user } = useAuth()
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      await changePassword({ currentPassword, newPassword })
      navigate('/dashboard', { replace: true })
    } catch (requestError) {
      setError(
        requestError.response?.data?.errors?.[0]?.message ||
        requestError.response?.data?.message ||
        'Password could not be changed.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-semibold text-slate-900">Change password</h1>
        <p className="mt-2 text-sm text-slate-600">
          {user.mustChangePassword
            ? 'Change your temporary password to continue.'
            : 'Enter your current password and choose a new one.'}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Current password
            <input
              required
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            New password
            <input
              required
              type="password"
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
            />
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Use at least 8 characters.
            </span>
          </label>

          {error && <p className="text-sm text-red-700" role="alert">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Updating password...' : 'Update password'}
          </button>
        </form>
      </section>
    </main>
  )
}

export default ChangePasswordPage
