import { useEffect, useState } from 'react'
import api from '../api/axios.js'
import useAuth from '../context/useAuth.js'

const getCurrentMonth = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const money = (amount) => new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'PKR',
  minimumFractionDigits: 2,
}).format(amount)

function PayrollPage() {
  const { user } = useAuth()
  const [month, setMonth] = useState(getCurrentMonth)
  const [payroll, setPayroll] = useState(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const isAdmin = user.role === 'admin'

  useEffect(() => {
    let active = true
    const loadPayroll = async () => {
      try {
        const { data } = await api.get('/api/payroll/runs')
        if (!active) return
        const matchingRun = data.runs.find((item) => item.month === month)
        if (!matchingRun) {
          setPayroll(null)
          setError('')
          return
        }
        const details = await api.get(`/api/payroll/runs/${matchingRun.id}`)
        if (!active) return
        setPayroll(details.data)
        setError('')
      } catch (requestError) {
        if (active) setError(requestError.response?.data?.message || 'Could not load payroll.')
      } finally {
        if (active) setLoading(false)
      }
    }
    loadPayroll()
    return () => { active = false }
  }, [month, retryCount])

  const run = payroll?.run || null
  const items = payroll?.items || []

  const refresh = () => {
    setLoading(true)
    setRetryCount((count) => count + 1)
  }

  const createDraft = async (regenerate) => {
    setWorking(true)
    setError('')
    setNotice('')
    try {
      const { data } = await api.post('/api/payroll/runs', { month, regenerate })
      setPayroll({ run: data.run, items: data.items })
      setNotice(regenerate ? 'Payroll draft regenerated.' : 'Payroll draft created.')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not create payroll draft.')
    } finally {
      setWorking(false)
    }
  }

  const finalize = async () => {
    if (!run) return
    setWorking(true)
    setError('')
    setNotice('')
    try {
      const { data } = await api.post(`/api/payroll/runs/${run.id}/finalize`, {})
      setPayroll((current) => current ? { ...current, run: data.run } : current)
      setNotice('Payroll finalized and locked.')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not finalize payroll.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <section className="mx-auto w-full max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Payroll</h1>
          <p className="mt-1 text-sm text-slate-600">
            {isAdmin ? 'Review and finalize monthly payroll.' : 'Prepare and review monthly payroll drafts.'}
          </p>
        </div>
        <label className="text-sm font-medium text-slate-700">
          Payroll month
          <input
            type="month"
            value={month}
            onChange={(event) => {
              setLoading(true)
              setPayroll(null)
              setError('')
              setMonth(event.target.value)
            }}
            className="ml-2 rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
          <button type="button" className="ml-3 font-semibold underline" onClick={refresh}>Retry</button>
        </div>
      )}
      {notice && <p className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800" role="status">{notice}</p>}

      {loading ? (
        <p className="mt-5 text-sm text-slate-600" role="status">Loading payroll...</p>
      ) : error ? null : (
        <>
          {run && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
              <div>
                <p className="font-semibold">{run.month} payroll run</p>
                <p className="mt-1 text-sm text-slate-600">{items.length} employee payslips</p>
              </div>
              <div className="flex items-center gap-2">
                {run.status === 'finalized'
                  ? <span className="rounded-full bg-slate-200 px-3 py-1 text-sm font-semibold text-slate-700">Locked</span>
                  : <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">Draft</span>}
                {isAdmin && run.status === 'draft' && (
                  <button disabled={working} type="button" onClick={finalize} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                    {working ? 'Finalizing...' : 'Finalize'}
                  </button>
                )}
                {!isAdmin && run.status === 'draft' && (
                  <button disabled={working} type="button" onClick={() => createDraft(true)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">
                    {working ? 'Regenerating...' : 'Regenerate draft'}
                  </button>
                )}
              </div>
            </div>
          )}

          {!run && !isAdmin && (
            <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
              <p className="text-sm text-slate-600">No payroll run exists for {month}.</p>
              <button disabled={working} type="button" onClick={() => createDraft(false)} className="mt-4 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
                {working ? 'Creating draft...' : 'Create draft'}
              </button>
            </div>
          )}

          {!run && isAdmin && (
            <p className="mt-5 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600">
              No payroll run exists for {month}. HR must create the draft first.
            </p>
          )}

          {run && items.length === 0 ? (
            <p className="mt-5 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
              No employees were employed during this payroll month.
            </p>
          ) : run && (
            <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Days payable</th>
                    <th className="px-4 py-3">Gross</th>
                    <th className="px-4 py-3">Absent / unpaid / half</th>
                    <th className="px-4 py-3">Deduction</th>
                    <th className="px-4 py-3">Tax</th>
                    <th className="px-4 py-3">Net pay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium">{item.employee?.name || 'Employee record unavailable'}</p>
                        <p className="text-xs text-slate-500">{item.employee?.code || ''}</p>
                      </td>
                      <td className="px-4 py-3">{item.daysPayable} / {item.workingDays}</td>
                      <td className="px-4 py-3">{money(item.gross)}</td>
                      <td className="px-4 py-3">{item.absentDays} / {item.unpaidLeaveDays} / {item.halfDays}</td>
                      <td className="px-4 py-3">{money(item.deduction)}</td>
                      <td className="px-4 py-3">{money(item.monthlyTax)}</td>
                      <td className="px-4 py-3 font-semibold">{money(item.netPay)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}

export default PayrollPage
