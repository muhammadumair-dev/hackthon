function ConnectionError({ message, onRetry }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <section className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Unable to connect</h1>
        <p className="mt-2 text-sm text-slate-600" role="alert">
          {message}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Try again
        </button>
      </section>
    </main>
  )
}

export default ConnectionError
