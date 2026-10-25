import { useCallback, useEffect, useState } from 'react'
import useAuthContext from '../context/useAuth.js'
import api from '../api/axios.js'

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const emptySettings = {
  name: '',
  officeStart: '09:00',
  graceMinutes: 15,
  halfDayHours: 5,
  weekend: ['Sat', 'Sun'],
  officeLatitude: '',
  officeLongitude: '',
  radiusMeters: 150,
  timezone: 'Asia/Karachi',
}

function CompanySettingsPage() {
  const { user } = useAuthContext()
  const [settings, setSettings] = useState(emptySettings)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const readOnly = user.role !== 'admin'

  const fetchSettings = useCallback(async () => {
    const { data } = await api.get('/api/settings/company')
    return {
      ...emptySettings,
      ...data.company,
      weekend: Array.isArray(data.company.weekend) ? data.company.weekend : emptySettings.weekend,
      officeLatitude: data.company.officeLatitude ?? '',
      officeLongitude: data.company.officeLongitude ?? '',
    }
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    setError('')
    try {
      setSettings(await fetchSettings())
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not load company settings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    fetchSettings()
      .then((result) => {
        if (active) {
          setSettings(result)
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError.response?.data?.message || 'Could not load company settings.')
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
  }, [fetchSettings])

  const updateField = (event) => {
    const { name, value } = event.target
    setSettings((current) => ({ ...current, [name]: value }))
  }

  const toggleWeekend = (day) => {
    setSettings((current) => ({
      ...current,
      weekend: current.weekend.includes(day)
        ? current.weekend.filter((selected) => selected !== day)
        : [...current.weekend, day],
    }))
  }

  const saveSettings = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    setSaving(true)

    const latitude = settings.officeLatitude === '' ? null : Number(settings.officeLatitude)
    const longitude = settings.officeLongitude === '' ? null : Number(settings.officeLongitude)
    if ((latitude === null) !== (longitude === null)) {
      setError('Provide both office coordinates, or leave both empty.')
      setSaving(false)
      return
    }

    try {
      const { data } = await api.patch('/api/settings/company', {
        name: settings.name.trim(),
        officeStart: settings.officeStart,
        graceMinutes: Number(settings.graceMinutes),
        halfDayHours: Number(settings.halfDayHours),
        weekend: settings.weekend,
        officeLatitude: latitude,
        officeLongitude: longitude,
        radiusMeters: Number(settings.radiusMeters),
        timezone: settings.timezone.trim(),
      })
      setSettings({
        ...emptySettings,
        ...data.company,
        weekend: Array.isArray(data.company.weekend) ? data.company.weekend : emptySettings.weekend,
        officeLatitude: data.company.officeLatitude ?? '',
        officeLongitude: data.company.officeLongitude ?? '',
      })
      setNotice('Company settings saved. They apply to new records.')
    } catch (requestError) {
      setError(
        requestError.response?.data?.errors?.[0]?.message ||
        requestError.response?.data?.message ||
        'Could not save company settings.',
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-600" role="status">Loading company settings...</p>
  }

  return (
    <div className="max-w-3xl">
      <h2 className="text-lg font-semibold">Company settings</h2>
      <p className="mt-1 text-sm text-slate-600">
        These settings are used when new records are created; existing records are not changed.
      </p>
      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
          <button type="button" onClick={loadSettings} className="ml-3 font-semibold underline">Retry</button>
        </div>
      )}
      {notice && <p className="mt-4 text-sm text-green-700" role="status">{notice}</p>}
      <form onSubmit={saveSettings} className="mt-5 grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 sm:p-6">
        <label className="text-sm font-medium text-slate-700">
          Company name
          <input required maxLength={120} name="name" value={settings.name} onChange={updateField} disabled={readOnly} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Office start
          <input required type="time" name="officeStart" value={settings.officeStart} onChange={updateField} disabled={readOnly} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Grace period (minutes)
          <input required type="number" min="0" max="240" name="graceMinutes" value={settings.graceMinutes} onChange={updateField} disabled={readOnly} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Half-day threshold (hours)
          <input required type="number" min="0.5" max="24" step="0.5" name="halfDayHours" value={settings.halfDayHours} onChange={updateField} disabled={readOnly} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100" />
        </label>
        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-medium text-slate-700">Weekend</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {weekdays.map((day) => (
              <label key={day} className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={(settings.weekend || []).includes(day)} disabled={readOnly} onChange={() => toggleWeekend(day)} />
                {day}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="text-sm font-medium text-slate-700">
          Office latitude
          <input type="number" min="-90" max="90" step="any" name="officeLatitude" value={settings.officeLatitude} onChange={updateField} disabled={readOnly} placeholder="Optional" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Office longitude
          <input type="number" min="-180" max="180" step="any" name="officeLongitude" value={settings.officeLongitude} onChange={updateField} disabled={readOnly} placeholder="Optional" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Office radius (meters)
          <input required type="number" min="1" max="100000" name="radiusMeters" value={settings.radiusMeters} onChange={updateField} disabled={readOnly} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Company timezone (IANA)
          <input required maxLength={100} name="timezone" value={settings.timezone} onChange={updateField} disabled={readOnly} placeholder="Asia/Karachi" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100" />
        </label>
        {!readOnly && (
          <div className="flex items-end sm:col-span-2">
            <button type="submit" disabled={saving} className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">
              {saving ? 'Saving...' : 'Save settings'}
            </button>
          </div>
        )}
        {readOnly && <p className="sm:col-span-2 text-sm text-slate-500">Read-only: only an Admin can change company settings.</p>}
      </form>
    </div>
  )
}

export default CompanySettingsPage
