import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import useAuth from '../context/useAuth.js'

function SetupPage() {
  const { completeSetup } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    companyName: '',
    adminName: '',
    email: '',
    password: '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const updateField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      await completeSetup(form)
      navigate('/login', { replace: true })
    } catch (requestError) {
      setError(
        requestError.response?.data?.errors?.[0]?.message ||
        requestError.response?.data?.message ||
        'Setup could not be completed.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-semibold text-slate-900">Set up HCM Lite</h1>
        <p className="mt-2 text-sm text-slate-600">
          Create your company and its first Admin account.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Company name
            <input
              required
              maxLength={120}
              name="companyName"
              value={form.companyName}
              onChange={updateField}
              autoComplete="organization"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Admin name
            <input
              required
              maxLength={100}
              name="adminName"
              value={form.adminName}
              onChange={updateField}
              autoComplete="name"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              required
              type="email"
              maxLength={254}
              name="email"
              value={form.email}
              onChange={updateField}
              autoComplete="email"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Password
            <input
              required
              type="password"
              minLength={8}
              maxLength={72}
              name="password"
              value={form.password}
              onChange={updateField}
              autoComplete="new-password"
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
            {submitting ? 'Creating company...' : 'Create company'}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-slate-600">
          Already set up? <Link className="font-medium text-slate-900 underline" to="/login">Sign in</Link>
        </p>
      </section>
    </main>
  )
}

export default SetupPage
