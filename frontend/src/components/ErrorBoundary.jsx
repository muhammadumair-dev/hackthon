import { Component } from 'react'

class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
          <section className="max-w-lg rounded-xl border border-red-200 bg-white p-6 text-center">
            <h1 className="text-lg font-semibold text-slate-900">This page could not be displayed</h1>
            <p className="mt-2 text-sm text-slate-600">An unexpected error occurred. Reload the page to try again.</p>
            <button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
              Reload page
            </button>
          </section>
        </main>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary