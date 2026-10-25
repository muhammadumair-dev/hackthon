function LoadingState({ message = 'Loading...' }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <p className="text-center text-slate-600" role="status" aria-live="polite">
        {message}
      </p>
    </main>
  )
}

export default LoadingState
