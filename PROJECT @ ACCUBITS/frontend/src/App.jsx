import { useEffect, useRef, useState } from 'react'

const API_BASE = 'http://localhost:8000/api'
const CHATS_STORAGE_KEY = 'gemini-workspace-chats'
const ACTIVE_CHAT_STORAGE_KEY = 'gemini-workspace-active-chat'

function createChat() {
  return {
    id: crypto.randomUUID(),
    title: 'New chat',
    createdAt: new Date().toISOString(),
    messages: []
  }
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric'
  }).format(new Date(value))
}

function App() {
  const [chats, setChats] = useState(() => {
    const saved = window.localStorage.getItem(CHATS_STORAGE_KEY)
    if (!saved) {
      return [createChat()]
    }

    try {
      const parsed = JSON.parse(saved)
      return parsed.length > 0 ? parsed : [createChat()]
    } catch (error) {
      console.error('Could not restore chats', error)
      return [createChat()]
    }
  })
  const [activeChatId, setActiveChatId] = useState(
    () => window.localStorage.getItem(ACTIVE_CHAT_STORAGE_KEY) ?? null
  )
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('Checking backend...')
  const [connected, setConnected] = useState(false)
  const endRef = useRef(null)
  const textareaRef = useRef(null)
  const activeChat = chats.find((chat) => chat.id === activeChatId) ?? chats[0]
  const messages = activeChat?.messages ?? []

  useEffect(() => {
    checkStatus()
  }, [])

  useEffect(() => {
    window.localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(chats))
  }, [chats])

  useEffect(() => {
    if (activeChatId) {
      window.localStorage.setItem(ACTIVE_CHAT_STORAGE_KEY, activeChatId)
    }
  }, [activeChatId])

  useEffect(() => {
    if (chats.length > 0 && !chats.some((chat) => chat.id === activeChatId)) {
      setActiveChatId(chats[0].id)
    }
  }, [activeChatId, chats])

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

  function updateChat(chatId, updater) {
    setChats((current) => current.map((chat) => (chat.id === chatId ? updater(chat) : chat)))
  }

  function handleNewChat() {
    const newChat = createChat()
    setChats((current) => [newChat, ...current])
    setActiveChatId(newChat.id)
    setInput('')
  }

  function handleDeleteChat(chatId) {
    setChats((current) => {
      const remaining = current.filter((chat) => chat.id !== chatId)
      return remaining.length > 0 ? remaining : [createChat()]
    })
  }

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
    if (!message || loading || !activeChat) {
      return
    }

    const nextMessages = [...messages, { role: 'user', content: message }]
    updateChat(activeChat.id, (chat) => ({
      ...chat,
      title: chat.title === 'New chat' ? message.slice(0, 28) || 'New chat' : chat.title,
      messages: nextMessages
    }))
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
      updateChat(activeChat.id, (chat) => ({
        ...chat,
        messages: [...chat.messages, { role: 'assistant', content: data.answer }]
      }))
      setConnected(true)
      setStatus(`Backend connected • ${data.mode}`)
    } catch (error) {
      console.error('Chat failed', error)
      updateChat(activeChat.id, (chat) => ({
        ...chat,
        messages: [
          ...chat.messages,
          {
            role: 'assistant',
            content: 'I could not reach Gemini through the backend. Check the backend, API key, and internet connection.'
          }
        ]
      }))
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

      <aside className="history-panel">
        <div className="history-header">
          <div>
            <p className="eyebrow">History</p>
            <h2>Conversations</h2>
          </div>
          <button type="button" className="history-new-button" onClick={handleNewChat}>
            New
          </button>
        </div>

        <div className="history-list">
          {chats.map((chat) => (
            <div key={chat.id} className={`history-item ${chat.id === activeChat?.id ? 'active' : ''}`}>
              <button
                type="button"
                className="history-select"
                onClick={() => {
                  setActiveChatId(chat.id)
                }}
              >
                <strong>{chat.title}</strong>
                <span>{formatDate(chat.createdAt)}</span>
              </button>
              <button
                type="button"
                className="history-delete"
                aria-label={`Delete ${chat.title}`}
                onClick={() => {
                  handleDeleteChat(chat.id)
                }}
              >
                x
              </button>
            </div>
          ))}
        </div>
      </aside>

      <section className="chat-card">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">
              AI
            </div>
            <div>
              <p className="eyebrow">Gemini Workspace</p>
              <h1>{activeChat?.title ?? 'Ask anything'}</h1>
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
                Your chats now save locally in the sidebar. Ask a general question, a technical question, or something
                current and the assistant will respond in this thread.
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
