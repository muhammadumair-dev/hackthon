import { useState } from 'react'
import api from '../api/axios.js'

function AiChatPanel() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const sendMessage = async (event) => {
    event.preventDefault()
    const message = draft.trim()
    if (!message || loading) return

    const history = messages
      .filter((item) => item.role === 'user' || item.role === 'assistant')
      .slice(-10)
      .map(({ role, content }) => ({ role, content }))
    setMessages((current) => [...current, { role: 'user', content: message }])
    setDraft('')
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/api/ai/chat', { message, history })
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: data.reply, aiGenerated: data.aiGenerated },
      ])
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not send your message. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open && (
        <section
          aria-label="AI assistant chat"
          className="mb-3 flex h-[min(70vh,34rem)] w-[min(92vw,26rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        >
          <header className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white">
            <div>
              <h2 className="font-semibold">HCM AI assistant</h2>
              <p className="text-xs text-slate-300">Ask about your HR data or policy</p>
            </div>
            <button
              type="button"
              aria-label="Close assistant"
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-1 text-xl leading-none hover:bg-slate-700"
            >
              ×
            </button>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-3" aria-live="polite">
            {messages.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
                You can ask in English or Roman Urdu. Answers are AI-generated and based on your role access.
              </p>
            )}
            {messages.map((item, index) => (
              <article
                key={`${item.role}-${index}`}
                className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${
                  item.role === 'user'
                    ? 'ml-auto bg-blue-700 text-white'
                    : 'mr-auto border border-slate-200 bg-white text-slate-800'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{item.content}</p>
                {item.aiGenerated && (
                  <span className="mt-1 block text-[10px] font-medium uppercase tracking-wide opacity-70">
                    AI-generated
                  </span>
                )}
              </article>
            ))}
            {loading && <p className="text-sm text-slate-500" role="status">Thinking...</p>}
          </div>
          {error && <p className="px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
          <form onSubmit={sendMessage} className="border-t border-slate-200 bg-white p-3">
            <label htmlFor="ai-chat-message" className="sr-only">Message the AI assistant</label>
            <textarea
              id="ai-chat-message"
              rows={2}
              maxLength={2000}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask a question..."
              className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-xs text-slate-500">Your access controls what it can answer.</span>
              <button
                type="submit"
                disabled={loading || !draft.trim()}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send'}
              </button>
            </div>
          </form>
        </section>
      )}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="ml-auto flex min-h-12 items-center gap-2 rounded-full bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-blue-800"
      >
        <span aria-hidden="true">✦</span>
        {open ? 'Close assistant' : 'Ask AI'}
      </button>
    </div>
  )
}

export default AiChatPanel
