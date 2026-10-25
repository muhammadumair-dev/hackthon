import { useCallback, useEffect, useState } from 'react'
import api from '../api/axios.js'
import useAuth from '../context/useAuth.js'
import AnnouncementList from '../components/AnnouncementList.jsx'

function AnnouncementsPage() {
  const { user } = useAuth()
  const [announcements, setAnnouncements] = useState([])
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/api/announcements')
      setAnnouncements(data.announcements)
      setError('')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not load announcements.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    api.get('/api/announcements')
      .then(({ data }) => {
        if (!active) return
        setAnnouncements(data.announcements)
        setError('')
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Could not load announcements.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setLoading(true)
    setError('')
    setNotice('')
    try {
      await api.post('/api/announcements', { title, message })
      setTitle('')
      setMessage('')
      setNotice('Announcement posted.')
      await load()
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not post announcement.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mx-auto w-full max-w-4xl">
      <h1 className="text-2xl font-semibold">Announcements</h1>
      {['admin', 'hr'].includes(user.role) && (
        <form onSubmit={submit} className="mt-5 space-y-3 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h2 className="font-semibold">Post an announcement</h2>
          <label className="block text-sm font-medium">
            Title
            <input required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="block text-sm font-medium">
            Message
            <textarea required maxLength={3000} rows={4} value={message} onChange={(event) => setMessage(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <button disabled={saving} className="rounded-lg bg-blue-700 px-4 py-2 font-medium text-white disabled:opacity-50">
            {saving ? 'Posting...' : 'Post announcement'}
          </button>
        </form>
      )}
      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error}<button type="button" onClick={() => { setLoading(true); load() }} className="ml-2 font-semibold underline">Retry</button></p>}
      {notice && <p className="mt-4 text-sm text-green-700" role="status">{notice}</p>}
      <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="font-semibold">Latest announcements</h2>
        {loading ? <p className="mt-3 text-sm text-slate-600" role="status">Loading announcements...</p> : (
          <AnnouncementList announcements={announcements} />
        )}
      </section>
    </section>
  )
}

export default AnnouncementsPage