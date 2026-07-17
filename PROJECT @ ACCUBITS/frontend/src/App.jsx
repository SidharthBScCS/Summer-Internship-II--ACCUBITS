import { useEffect, useRef, useState } from 'react'

const API_BASE = 'http://localhost:8000/api'

function App() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('Checking backend...')
  const [connected, setConnected] = useState(false)
  const endRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    checkStatus()
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) {
      return
    }

    textarea.style.height = '0px'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`
  }, [input])

  async function checkStatus() {
    try {
      const response = await fetch(`${API_BASE}/status`)
      if (!response.ok) {
        throw new Error('Status request failed')
      }

      const data = await response.json()
      setConnected(true)
      setStatus(`Backend connected • ${data.llm_mode}`)
    } catch (error) {
      console.error('Status check failed', error)
      setConnected(false)
      setStatus('Backend not connected')
    }
  }

  async function sendMessage(event) {
    event.preventDefault()
    const message = input.trim()
    if (!message || loading) {
      return
    }

    const nextMessages = [...messages, { role: 'user', content: message }]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history: nextMessages.map((entry) => ({
            role: entry.role,
            content: entry.content
          }))
        })
      })

      if (!response.ok) {
        throw new Error(`Chat failed with status ${response.status}`)
      }

      const data = await response.json()
      setMessages((current) => [...current, { role: 'assistant', content: data.answer }])
      setConnected(true)
      setStatus(`Backend connected • ${data.mode}`)
    } catch (error) {
      console.error('Chat failed', error)
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: 'I could not reach Gemini through the backend. Check the backend, API key, and internet connection.'
        }
      ])
      setConnected(false)
      setStatus('Backend not connected')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void sendMessage(event)
    }
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <section className="chat-card">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">
              AI
            </div>
            <div>
              <p className="eyebrow">Gemini Workspace</p>
              <h1>Ask anything</h1>
            </div>
          </div>

          <button
            type="button"
            className={`status-chip ${connected ? 'connected' : 'offline'}`}
            onClick={checkStatus}
          >
            <span className="status-dot" />
            <span>{status}</span>
          </button>
        </header>

        <main className="thread">
          {messages.length === 0 && (
            <section className="empty-state">
              <p className="eyebrow">Ready</p>
              <h2>Start a conversation with Gemini</h2>
              <p>
                Your backend is connected to the chat interface here. Ask a general question, a technical question,
                or something current and the assistant will respond in this thread.
              </p>
            </section>
          )}

          {messages.map((message, index) => (
            <article key={`${message.role}-${index}`} className={`message-row ${message.role}`}>
              <div className={`avatar ${message.role}`}>{message.role === 'assistant' ? 'AI' : 'You'}</div>
              <div className="message-content">
                <div className="message-role">{message.role === 'assistant' ? 'Assistant' : 'You'}</div>
                <div className={`bubble ${message.role}`}>{message.content}</div>
              </div>
            </article>
          ))}

          {loading && (
            <article className="message-row assistant">
              <div className="avatar assistant">AI</div>
              <div className="message-content">
                <div className="message-role">Assistant</div>
                <div className="bubble assistant thinking">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </article>
          )}
          <div ref={endRef} />
        </main>

        <form className="composer-shell" onSubmit={sendMessage}>
          <div className="composer">
            <textarea
              ref={textareaRef}
              rows="1"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Gemini..."
            />
            <div className="composer-footer">
              <span className="composer-hint">Enter to send, Shift+Enter for a new line</span>
              <div className="actions">
                <button type="button" className="secondary" onClick={checkStatus}>
                  Refresh
                </button>
                <button type="submit" className="primary" disabled={loading || !input.trim()}>
                  {loading ? 'Thinking...' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </section>
    </div>
  )
}

export default App
