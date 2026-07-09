import { useEffect, useState } from 'react'

const API_BASE = 'http://localhost:8000/api'
const CHAT_STORAGE_KEY = 'agent-builder-chats'
const ACTIVE_CHAT_STORAGE_KEY = 'agent-builder-active-chat'

const starterChat = {
  id: crypto.randomUUID(),
  title: 'New Agent Chat',
  createdAt: new Date().toISOString(),
  messages: [
    {
      role: 'assistant',
      content:
        'Ask about your indexed knowledge base, system design, or agent workflow. Create a new chat anytime from the sidebar.'
    }
  ]
}

function App() {
  const [chats, setChats] = useState(() => {
    const saved = window.localStorage.getItem(CHAT_STORAGE_KEY)
    if (!saved) {
      return [starterChat]
    }

    try {
      const parsed = JSON.parse(saved)
      return parsed.length > 0 ? parsed : [starterChat]
    } catch (error) {
      console.error('Could not restore chat history', error)
      return [starterChat]
    }
  })
  const [activeChatId, setActiveChatId] = useState(
    () => window.localStorage.getItem(ACTIVE_CHAT_STORAGE_KEY) ?? starterChat.id
  )
  const [input, setInput] = useState('')
  const [status, setStatus] = useState({ rag_ready: false, llm_mode: 'demo', document_count: 0 })
  const [sources, setSources] = useState([])
  const [loading, setLoading] = useState(false)
  const [ingesting, setIngesting] = useState(false)

  const activeChat = chats.find((chat) => chat.id === activeChatId) ?? chats[0]

  useEffect(() => {
    fetchStatus()
  }, [])

  useEffect(() => {
    window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chats))
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

  async function fetchStatus() {
    try {
      const response = await fetch(`${API_BASE}/status`)
      const data = await response.json()
      setStatus(data)
    } catch (error) {
      console.error('Status fetch failed', error)
    }
  }

  function handleNewChat() {
    const newChat = {
      id: crypto.randomUUID(),
      title: 'Untitled Chat',
      createdAt: new Date().toISOString(),
      messages: [
        {
          role: 'assistant',
          content: 'Fresh chat ready. Ask a question and I will use the indexed context when available.'
        }
      ]
    }
    setChats((current) => [newChat, ...current])
    setActiveChatId(newChat.id)
    setSources([])
  }

  function updateChat(chatId, updater) {
    setChats((current) => current.map((chat) => (chat.id === chatId ? updater(chat) : chat)))
  }

  async function handleIngest() {
    setIngesting(true)
    try {
      const response = await fetch(`${API_BASE}/ingest`, { method: 'POST' })
      const data = await response.json()
      await fetchStatus()
      window.alert(`Indexed ${data.indexed_documents} documents and ${data.indexed_chunks} chunks.`)
    } catch (error) {
      console.error('Ingest failed', error)
      window.alert('Could not ingest documents. Make sure the backend is running.')
    } finally {
      setIngesting(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const message = input.trim()
    if (!message || !activeChat) {
      return
    }

    const nextUserMessage = { role: 'user', content: message }
    const optimisticMessages = [...activeChat.messages, nextUserMessage]

    updateChat(activeChat.id, (chat) => ({
      ...chat,
      title: chat.title === 'Untitled Chat' || chat.title === 'New Agent Chat' ? message.slice(0, 28) : chat.title,
      messages: optimisticMessages
    }))

    setInput('')
    setLoading(true)

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history: optimisticMessages.map((entry) => ({
            role: entry.role,
            content: entry.content
          }))
        })
      })
      const data = await response.json()
      const assistantMessage = { role: 'assistant', content: data.answer }

      updateChat(activeChat.id, (chat) => ({
        ...chat,
        messages: [...chat.messages, assistantMessage]
      }))
      setSources(data.sources ?? [])
      setStatus((current) => ({ ...current, llm_mode: data.mode ?? current.llm_mode }))
    } catch (error) {
      console.error('Chat failed', error)
      updateChat(activeChat.id, (chat) => ({
        ...chat,
        messages: [
          ...chat.messages,
          {
            role: 'assistant',
            content: 'The backend is unavailable right now. Start the FastAPI server and try again.'
          }
        ]
      }))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-top">
          <button className="new-chat-button" onClick={handleNewChat}>
            <span className="new-chat-icon">+</span>
            <span>New chat</span>
          </button>

          <button className="ghost-button" onClick={handleIngest} disabled={ingesting}>
            {ingesting ? 'Indexing...' : 'Ingest Knowledge'}
          </button>
        </div>

        <div className="history">
          <div className="sidebar-label">Chat History</div>
          <div className="history-list">
            {chats.map((chat) => (
              <button
                key={chat.id}
                className={`history-item ${chat.id === activeChatId ? 'active' : ''}`}
                onClick={() => {
                  setActiveChatId(chat.id)
                  setSources([])
                }}
              >
                <strong>{chat.title}</strong>
                <span>{new Date(chat.createdAt).toLocaleDateString()}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="sidebar-footer">
          <span>{status.rag_ready ? 'RAG ready' : 'No index yet'}</span>
          <span>{status.llm_mode} mode</span>
          <span>{status.document_count} docs</span>
        </div>
      </aside>

      <main className="chat-layout">
        <header className="chat-header">
          <div>
            <h1>Agent Builder</h1>
            <p>Simple LLM + RAG workspace with chat history.</p>
          </div>
        </header>

        <section className="chat-panel">
          <div className="messages">
            {activeChat?.messages.map((message, index) => (
              <article key={`${message.role}-${index}`} className={`message ${message.role}`}>
                <span>{message.role === 'assistant' ? 'Agent' : 'You'}</span>
                <p>{message.content}</p>
              </article>
            ))}
            {loading && (
              <article className="message assistant">
                <span>Agent</span>
                <p>Thinking through your request...</p>
              </article>
            )}
          </div>

          <div className="composer-wrap">
            <form className="composer" onSubmit={handleSubmit}>
              <textarea
                rows="2"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Message your agent..."
              />
              <button className="send-button" type="submit" disabled={loading}>
                {loading ? 'Sending...' : 'Send'}
              </button>
            </form>
          </div>
        </section>

        <section className="sources-card">
          <div className="sources-header">
            <h3>Sources</h3>
            <span>Latest retrieved context</span>
          </div>
          <div className="sources-list">
            {sources.length === 0 ? (
              <p className="empty-state">Retrieved chunks will appear here after you chat with indexed knowledge.</p>
            ) : (
              sources.map((source) => (
                <article key={source.id} className="source-item">
                  <header>
                    <strong>{source.document}</strong>
                    <span>{source.score.toFixed(3)}</span>
                  </header>
                  <p>{source.text}</p>
                </article>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
