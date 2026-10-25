import { useEffect, useState } from 'react'
import api from '../api/axios.js'

const money = (amount) => new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'PKR',
  minimumFractionDigits: 2,
}).format(amount)

function MyPayslipsPage() {
  const [payslips, setPayslips] = useState([])
  const [loading, setLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState('')
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    let active = true
    api.get('/api/payroll/payslips/my')
      .then(({ data }) => {
        if (!active) return
        setPayslips(data.payslips)
        setError('')
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Could not load your payslips.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [retryCount])

  const download = async (payslip) => {
    setDownloadingId(payslip.id)
    setError('')
    try {
      const response = await api.get(`/api/payroll/payslips/${payslip.id}/pdf`, {
        responseType: 'blob',
      })
      const url = URL.createObjectURL(response.data)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `payslip-${payslip.month}.pdf`
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not download this payslip.')
    } finally {
      setDownloadingId('')
    }
  }

  return (
    <section className="mx-auto w-full max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold">My Payslips</h1>
        <p className="mt-1 text-sm text-slate-600">Download finalized monthly payslips.</p>
      </div>
      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
          <button type="button" className="ml-3 font-semibold underline" onClick={() => {
            setLoading(true)
            setRetryCount((count) => count + 1)
          }}>Retry</button>
        </div>
      )}
      {loading ? (
        <p className="mt-5 text-sm text-slate-600" role="status">Loading payslips...</p>
      ) : error ? null : payslips.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">No finalized payslips are available yet.</p>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[650px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr><th className="px-4 py-3">Month</th><th className="px-4 py-3">Gross</th><th className="px-4 py-3">Deduction</th><th className="px-4 py-3">Tax</th><th className="px-4 py-3">Net pay</th><th className="px-4 py-3">Payslip</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payslips.map((payslip) => (
                <tr key={payslip.id}>
                  <td className="px-4 py-3 font-medium">{payslip.month}</td>
                  <td className="px-4 py-3">{money(payslip.gross)}</td>
                  <td className="px-4 py-3">{money(payslip.deduction)}</td>
                  <td className="px-4 py-3">{money(payslip.monthlyTax)}</td>
                  <td className="px-4 py-3 font-semibold">{money(payslip.netPay)}</td>
                  <td className="px-4 py-3">
                    <button type="button" disabled={downloadingId === payslip.id} onClick={() => download(payslip)} className="font-medium text-blue-700 underline disabled:opacity-50">
                      {downloadingId === payslip.id ? 'Downloading...' : 'Download PDF'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default MyPayslipsPage
