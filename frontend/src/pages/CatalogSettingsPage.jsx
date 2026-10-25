import { useCallback, useEffect, useState } from 'react'
import api from '../api/axios.js'
import useAuthContext from '../context/useAuth.js'

const config = {
  departments: { title: 'Departments', singular: 'department', plural: 'departments', endpoint: '/api/settings/departments', listKey: 'departments' },
  designations: { title: 'Designations', singular: 'designation', plural: 'designations', endpoint: '/api/settings/designations', listKey: 'designations' },
  'leave-types': { title: 'Leave types', singular: 'leave type', plural: 'leaveTypes', endpoint: '/api/settings/leave-types', listKey: 'leaveTypes' },
  holidays: { title: 'Holidays', singular: 'holiday', plural: 'holidays', endpoint: '/api/settings/holidays', listKey: 'holidays' },
}

const emptyForm = {
  name: '',
  date: '',
  yearlyQuota: '14',
  isUnlimited: false,
  isPaid: true,
}

function CatalogSettingsPage({ resource }) {
  const settings = config[resource]
  const { user } = useAuthContext()
  const readOnly = user.role !== 'admin'
  const [items, setItems] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const fetchItems = useCallback(async () => {
    const { data } = await api.get(settings.endpoint)
    return data[settings.listKey]
  }, [settings])

  const loadItems = async () => {
    setLoading(true)
    setError('')
    try {
      setItems(await fetchItems())
    } catch (requestError) {
      setError(requestError.response?.data?.message || `Could not load ${settings.title.toLowerCase()}.`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    fetchItems()
      .then((result) => {
        if (active) {
          setItems(result)
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError.response?.data?.message || `Could not load ${settings.title.toLowerCase()}.`)
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
  }, [fetchItems, settings.title])

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
  }

  const handleChange = (event) => {
    const { name, value, checked, type } = event.target
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
  }

  const toPayload = () => {
    if (resource === 'holidays') {
      return { name: form.name.trim(), date: form.date }
    }
    if (resource === 'leave-types') {
      return {
        name: form.name.trim(),
        yearlyQuota: form.isUnlimited ? null : Number(form.yearlyQuota),
        isUnlimited: form.isUnlimited,
        isPaid: form.isPaid,
      }
    }
    return { name: form.name.trim() }
  }

  const startEditing = (item) => {
    setEditingId(item.id)
    setForm({
      ...emptyForm,
      name: item.name,
      date: item.date || '',
      yearlyQuota: item.yearlyQuota ?? '14',
      isUnlimited: item.isUnlimited ?? false,
      isPaid: item.isPaid ?? true,
    })
    setError('')
    setNotice('')
  }

  const saveItem = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const endpoint = editingId ? `${settings.endpoint}/${editingId}` : settings.endpoint
      const { data } = await api.request({
        method: editingId ? 'PATCH' : 'POST',
        url: endpoint,
        data: toPayload(),
      })
      const itemKey = resource === 'leave-types' ? 'leaveType' : resource.slice(0, -1)
      const savedItem = data[itemKey]
      setItems((current) =>
        editingId
          ? current.map((item) => item.id === editingId ? savedItem : item)
          : [...current, savedItem].sort((a, b) =>
              resource === 'holidays'
                ? a.date.localeCompare(b.date)
                : a.name.localeCompare(b.name),
            ),
      )
      resetForm()
      setNotice(`${settings.singular[0].toUpperCase()}${settings.singular.slice(1)} saved.`)
    } catch (requestError) {
      setError(
        requestError.response?.data?.errors?.[0]?.message ||
        requestError.response?.data?.message ||
        `Could not save ${settings.singular}.`,
      )
    } finally {
      setSaving(false)
    }
  }

  const deleteItem = async (item) => {
    if (!window.confirm(`Delete ${item.name}?`)) {
      return
    }
    setError('')
    setNotice('')
    try {
      await api.delete(`${settings.endpoint}/${item.id}`)
      setItems((current) => current.filter((entry) => entry.id !== item.id))
      if (editingId === item.id) {
        resetForm()
      }
      setNotice(`${settings.singular[0].toUpperCase()}${settings.singular.slice(1)} deleted.`)
    } catch (requestError) {
      setError(requestError.response?.data?.message || `Could not delete ${settings.singular}.`)
    }
  }

  const renderFormFields = () => (
    <>
      <label className="block text-sm font-medium text-slate-700">
        {resource === 'holidays' ? 'Holiday name' : `${settings.singular[0].toUpperCase()}${settings.singular.slice(1)} name`}
        <input required maxLength={resource === 'holidays' ? 120 : 100} name="name" value={form.name} onChange={handleChange} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
      </label>
      {resource === 'holidays' && (
        <label className="block text-sm font-medium text-slate-700">
          Date
          <input required type="date" name="date" value={form.date} onChange={handleChange} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
        </label>
      )}
      {resource === 'leave-types' && (
        <>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="isUnlimited" checked={form.isUnlimited} onChange={handleChange} />
            Unlimited yearly quota
          </label>
          {!form.isUnlimited && (
            <label className="block text-sm font-medium text-slate-700">
              Yearly quota (days)
              <input required type="number" min="0" step="0.5" name="yearlyQuota" value={form.yearlyQuota} onChange={handleChange} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
          )}
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="isPaid" checked={form.isPaid} onChange={handleChange} />
            Paid leave
          </label>
        </>
      )}
    </>
  )

  const renderItemDetails = (item) => {
    if (resource === 'holidays') {
      return <><span className="font-medium">{item.name}</span><span className="text-sm text-slate-500">{item.date}</span></>
    }
    if (resource === 'leave-types') {
      return (
        <span className="min-w-0">
          <span className="block font-medium">{item.name}</span>
          <span className="block text-sm text-slate-500">
            {item.isUnlimited ? 'Unlimited' : `${item.yearlyQuota} days/year`} · {item.isPaid ? 'Paid' : 'Unpaid'}
          </span>
        </span>
      )
    }
    return <span className="font-medium">{item.name}</span>
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{settings.title}</h2>
          {!loading && <span className="text-sm text-slate-500">{items.length} total</span>}
        </div>
        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
            {error}
            <button type="button" onClick={loadItems} className="ml-3 font-semibold underline">Retry</button>
          </div>
        )}
        {notice && <p className="mt-3 text-sm text-green-700" role="status">{notice}</p>}
        {loading ? (
          <p className="mt-4 text-sm text-slate-600" role="status">Loading {settings.title.toLowerCase()}...</p>
        ) : items.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
            No {settings.title.toLowerCase()} yet.
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1">
                  {renderItemDetails(item)}
                </div>
                {!readOnly && (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => startEditing(item)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100">Edit</button>
                    <button type="button" onClick={() => deleteItem(item)} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50">Delete</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {!readOnly ? (
        <form onSubmit={saveItem} className="h-fit space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="font-semibold">{editingId ? `Edit ${settings.singular}` : `Add ${settings.singular}`}</h3>
          {renderFormFields()}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={saving} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">
              {saving ? 'Saving...' : editingId ? 'Save changes' : `Add ${settings.singular}`}
            </button>
            {editingId && <button type="button" onClick={resetForm} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancel</button>}
          </div>
        </form>
      ) : (
        <p className="h-fit rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Read-only: only an Admin can add, edit or delete {settings.title.toLowerCase()}.
        </p>
      )}
    </div>
  )
}

export default CatalogSettingsPage
