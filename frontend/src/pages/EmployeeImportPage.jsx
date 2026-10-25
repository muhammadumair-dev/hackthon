import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/axios.js'

function EmployeeImportPage() {
  const [file, setFile] = useState(null)
  const [csv, setCsv] = useState('')
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dryRunResult, setDryRunResult] = useState(null)
  const [importResult, setImportResult] = useState(null)

  const chooseFile = async (event) => {
    const selected = event.target.files?.[0]
    setFile(null)
    setCsv('')
    setDryRunResult(null)
    setImportResult(null)
    setError('')
    if (!selected) return
    if (!selected.name.toLowerCase().endsWith('.csv')) {
      setError('Choose a CSV file.')
      return
    }
    if (selected.size > 2_000_000) {
      setError('CSV must be no larger than 2 MB.')
      return
    }
    try {
      setCsv(await selected.text())
      setFile(selected)
    } catch {
      setError('Could not read the selected CSV file.')
    }
  }

  const runDryRun = async () => {
    if (!csv) return
    setChecking(true)
    setError('')
    setImportResult(null)
    try {
      const { data } = await api.post('/api/employees/import?dryRun=true', { csv })
      setDryRunResult(data)
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
        'Could not validate this CSV file.',
      )
    } finally {
      setChecking(false)
    }
  }

  const confirmImport = async () => {
    setSaving(true)
    setError('')
    try {
      const { data } = await api.post('/api/employees/import?dryRun=false', { csv })
      setImportResult(data)
      setDryRunResult(null)
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
        'Could not import employees.',
      )
    } finally {
      setSaving(false)
    }
  }

  const downloadCredentials = () => {
    if (!importResult?.credentials) return
    const rows = [
      ['employeeId', 'email', 'temporaryPassword'],
      ...importResult.credentials.map((item) => [item.employeeId, item.email, item.temporaryPassword]),
    ]
    const csvContent = rows
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
      .join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'employee-temporary-passwords.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="mx-auto w-full max-w-5xl">
      <Link to="/employees" className="text-sm font-medium underline">← Back to employees</Link>
      <h1 className="mt-3 text-2xl font-semibold">Import employees from CSV</h1>
      <p className="mt-1 text-sm text-slate-600">
        Validate the file first. Every row must match existing department and designation names.
      </p>
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <p className="text-sm font-medium">Required CSV headers</p>
        <code className="mt-2 block break-all text-xs text-slate-600">
          code,name,email,phone,address,gender,department,designation,joinDate,status,exitDate,basicSalary
        </code>
        <p className="mt-2 text-xs text-slate-500">
          Dates use YYYY-MM-DD; gender: male, female, other, prefer_not_to_say; status: active, probation, exited. Maximum 1000 rows and 2 MB.
        </p>
        <label className="mt-4 block text-sm font-medium text-slate-700">
          CSV file
          <input type="file" accept=".csv,text/csv" onChange={chooseFile} className="mt-2 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2" />
        </label>
        {file && <p className="mt-2 text-sm text-slate-600">Selected: {file.name}</p>}
        {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
        <div className="mt-4">
          <button type="button" disabled={!file || checking || saving} onClick={runDryRun} className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
            {checking ? 'Checking rows...' : 'Run dry-run validation'}
          </button>
        </div>
      </div>

      {dryRunResult && (
        <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
          <h2 className="text-lg font-semibold">Dry-run results</h2>
          <p className="mt-1 text-sm text-slate-600">
            {dryRunResult.validRows} of {dryRunResult.totalRows} rows are valid.
          </p>
          {dryRunResult.errors.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-red-50 text-xs uppercase text-red-800">
                  <tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Field</th><th className="px-3 py-2">Reason</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dryRunResult.errors.map((rowError, index) => (
                    <tr key={`${rowError.row}-${rowError.field}-${index}`}>
                      <td className="px-3 py-2">{rowError.row}</td>
                      <td className="px-3 py-2">{rowError.field}</td>
                      <td className="px-3 py-2">{rowError.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-sm text-green-700">No row errors. Every employee login will receive a new temporary password.</p>
          )}
          {dryRunResult.errors.length === 0 && dryRunResult.totalRows > 0 && (
            <button type="button" disabled={saving} onClick={confirmImport} className="mt-4 rounded-lg bg-green-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50">
              {saving ? 'Importing employees...' : `Confirm import (${dryRunResult.validRows})`}
            </button>
          )}
        </section>
      )}

      {importResult && (
        <section className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-green-900">Import complete</h2>
          <p className="mt-1 text-sm text-green-800">{importResult.created} employees and login accounts created.</p>
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
            <p className="font-medium text-amber-900">Temporary passwords — shown only in this response</p>
            <p className="mt-1 text-sm text-amber-900">Download and share securely now. Employees must change these passwords at first sign-in.</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[540px] text-left text-sm">
                <thead><tr><th className="px-2 py-2">Employee ID</th><th className="px-2 py-2">Email</th><th className="px-2 py-2">Temporary password</th></tr></thead>
                <tbody className="divide-y divide-amber-200">
                  {importResult.credentials.map((credential) => (
                    <tr key={credential.employeeId}>
                      <td className="px-2 py-2">{credential.employeeId}</td>
                      <td className="px-2 py-2">{credential.email}</td>
                      <td className="break-all px-2 py-2 font-mono">{credential.temporaryPassword}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={downloadCredentials} className="mt-3 rounded-lg border border-amber-400 px-3 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100">
              Download credentials CSV
            </button>
          </div>
          <Link to="/employees" className="mt-4 inline-block text-sm font-medium underline">Return to directory</Link>
        </section>
      )}
    </section>
  )
}

export default EmployeeImportPage
