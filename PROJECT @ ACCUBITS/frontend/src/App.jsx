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
  const [loading, setLoading] = useState(false)
  const activeChat = chats.find((chat) => chat.id === activeChatId) ?? chats[0]

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
  }

  function handleDeleteChat(chatId) {
    setChats((current) => {
      const remainingChats = current.filter((chat) => chat.id !== chatId)
      if (remainingChats.length > 0) {
        return remainingChats
      }

      const fallbackChat = {
        id: crypto.randomUUID(),
        title: 'New Agent Chat',
        createdAt: new Date().toISOString(),
        messages: [
          {
            role: 'assistant',
            content: 'Fresh chat ready. Ask a question and I will use the indexed context when available.'
          }
        ]
      }
      return [fallbackChat]
    })
  }

  function updateChat(chatId, updater) {
    setChats((current) => current.map((chat) => (chat.id === chatId ? updater(chat) : chat)))
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

    setLoading(true)
    setInput('')

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

      if (!response.ok) {
        throw new Error(`Chat request failed with status ${response.status}`)
      }

      const data = await response.json()
      const assistantMessage = { role: 'assistant', content: data.answer }

      updateChat(activeChat.id, (chat) => ({
        ...chat,
        messages: [...chat.messages, assistantMessage]
      }))
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
        </div>

        <div className="history">
          <div className="history-list">
            {chats.map((chat) => (
              <div key={chat.id} className={`history-item ${chat.id === activeChatId ? 'active' : ''}`}>
                <button
                  className="history-select"
                  onClick={() => {
                    setActiveChatId(chat.id)
                  }}
                >
                  <strong>{chat.title}</strong>
                </button>
                <button
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
        </div>
      </aside>

      <main className="chat-panel">
        <div className="chat-thread-shell">
          <div className="messages-wrap">
            <div className="messages">
              {activeChat?.messages.map((message, index) => (
                <article key={`${message.role}-${index}`} className={`message-row ${message.role}`}>
                  <div className="message-shell">
                    <div className="message-avatar">{message.role === 'assistant' ? 'A' : 'Y'}</div>
                    <article className={`message ${message.role}`}>
                      <span>{message.role === 'assistant' ? 'Agent' : 'You'}</span>
                      <p>{message.content}</p>
                    </article>
                  </div>
                </article>
              ))}
              {loading && (
                <article className="message-row assistant">
                  <div className="message-shell">
                    <div className="message-avatar">A</div>
                    <article className="message assistant">
                      <span>Agent</span>
                      <p>Thinking...</p>
                    </article>
                  </div>
                </article>
              )}
            </div>
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
                {loading ? '...' : '>'}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
