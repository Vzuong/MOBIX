import { useState, useRef, useEffect } from 'react'
import { api, vnd, type Product, type ChatMessage } from '../api'

type Props = {
  open: boolean
  onClose: () => void
  onAddToCart: (product: Product) => void
  onViewProductDetails: (product: Product) => void
  initialPrompt?: string | null
  onClearInitialPrompt?: () => void
}

// Hàm xử lý và hiển thị văn bản Markdown sạch sẽ, hoàn toàn loại bỏ dấu * thô
function renderMessageText(text: string) {
  const lines = text.split('\n')
  return lines.map((line, idx) => {
    let raw = line.trim()
    if (!raw) {
      return <div key={idx} style={{ height: '0.4em' }} />
    }

    let prefix: { type: 'bullet' | 'number'; label: string } | null = null

    // Nhận diện gạch đầu dòng (*, -, •, +)
    const bulletMatch = raw.match(/^([*\-•+]\s+)/)
    if (bulletMatch) {
      prefix = { type: 'bullet', label: '•' }
      raw = raw.slice(bulletMatch[0].length).trim()
    } else {
      // Nhận diện đánh số thứ tự (1., 2., 3...)
      const numMatch = raw.match(/^(\d+\.)\s+/)
      if (numMatch) {
        prefix = { type: 'number', label: numMatch[1] }
        raw = raw.slice(numMatch[0].length).trim()
      }
    }

    // Tách các đoạn in đậm **...** hoặc *...*
    const tokens: { type: 'text' | 'bold'; content: string }[] = []
    const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = regex.exec(raw)) !== null) {
      if (match.index > lastIndex) {
        const plain = raw.slice(lastIndex, match.index).replace(/\*/g, '')
        if (plain) tokens.push({ type: 'text', content: plain })
      }
      const boldText = (match[2] || match[3] || '').replace(/\*/g, '').trim()
      if (boldText) {
        tokens.push({ type: 'bold', content: boldText })
      }
      lastIndex = regex.lastIndex
    }

    if (lastIndex < raw.length) {
      const plain = raw.slice(lastIndex).replace(/\*/g, '')
      if (plain) tokens.push({ type: 'text', content: plain })
    }

    if (tokens.length === 0) {
      tokens.push({ type: 'text', content: raw.replace(/\*/g, '') })
    }

    return (
      <div
        key={idx}
        style={{
          display: prefix ? 'flex' : 'block',
          gap: prefix ? '6px' : undefined,
          marginBottom: '4px',
          lineHeight: 1.5,
        }}
      >
        {prefix && (
          <span
            style={{
              color: prefix.type === 'bullet' ? 'var(--primary)' : 'inherit',
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {prefix.label}
          </span>
        )}
        <span>
          {tokens.map((tok, tIdx) =>
            tok.type === 'bold' ? (
              <strong key={tIdx} style={{ fontWeight: 700, color: 'inherit' }}>
                {tok.content}
              </strong>
            ) : (
              <span key={tIdx}>{tok.content}</span>
            )
          )}
        </span>
      </div>
    )
  })
}

const DEFAULT_WELCOME: ChatMessage = {
  id: 'welcome_v2',
  sender: 'bot',
  text: 'Dạ em chào anh/chị! Em là **BIX** 🤖 - Chuyên viên tư vấn điện thoại tại MOBIX.\nAnh/chị đang cần tìm máy chụp ảnh đẹp, cày game mượt màn 144Hz, pin trâu hay cần tìm trong tầm ngân sách nào để em hỗ trợ tư vấn chi tiết cho mình ạ?',
  time: 'Vừa xong',
  suggestions: [
    'Con máy chụp ảnh ngon nhất?',
    'Máy nào chơi game đỉnh nhất?',
    'Chính sách trả góp 0%',
    'Chính sách bảo hành 1 đổi 1',
  ],
}

export default function ChatBot({
  open,
  onClose,
  onAddToCart,
  onViewProductDetails,
  initialPrompt,
  onClearInitialPrompt,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('mobix_chat_messages_v3')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {}
    return [DEFAULT_WELCOME]
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [typingHint, setTypingHint] = useState('Đang xem xét nhu cầu của bạn...')
  
  // Trạng thái hiệu ứng gõ phím như người đang nhập (Typewriter Streaming)
  const [streamingMsg, setStreamingMsg] = useState<{
    id: string
    fullText: string
    currentLength: number
    suggestions?: string[]
    products?: Product[]
    time: string
  } | null>(null)

  const streamIntervalRef = useRef<any>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Lưu lịch sử chat vào localStorage mỗi khi có tin nhắn mới
  useEffect(() => {
    try {
      localStorage.setItem('mobix_chat_messages_v3', JSON.stringify(messages))
    } catch {}
  }, [messages])

  // Luân chuyển gợi ý khi AI đang suy nghĩ
  useEffect(() => {
    if (!loading) return

    setTypingHint('Đang lắng nghe và xem xét nhu cầu của bạn...')
    const t1 = setTimeout(() => {
      setTypingHint('Đang chọn lọc các dòng máy phù hợp nhất...')
    }, 1300)

    const t2 = setTimeout(() => {
      setTypingHint('Đang chuẩn bị lời tư vấn chi tiết cho bạn...')
    }, 2700)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [loading])

  // Xử lý hiệu ứng gõ phím mượt mà (Typewriter streaming ở 60 FPS)
  useEffect(() => {
    if (!streamingMsg) return

    streamIntervalRef.current = setInterval(() => {
      setStreamingMsg((prev) => {
        if (!prev) return null
        const nextLen = prev.currentLength + 4
        if (nextLen >= prev.fullText.length) {
          clearInterval(streamIntervalRef.current)
          const finalBotMsg: ChatMessage = {
            id: prev.id,
            sender: 'bot',
            text: prev.fullText,
            time: prev.time,
            suggestions: prev.suggestions,
            products: prev.products,
          }
          setMessages((msgs) => [...msgs, finalBotMsg])
          return null
        }
        return { ...prev, currentLength: nextLen }
      })
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 16)

    return () => {
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current)
    }
  }, [streamingMsg?.id])

  // Tự động gửi câu hỏi nếu có initialPrompt truyền từ ngoài
  useEffect(() => {
    if (open && initialPrompt && initialPrompt.trim()) {
      handleSend(initialPrompt.trim())
      onClearInitialPrompt?.()
    }
  }, [open, initialPrompt])

  const handleClearHistory = () => {
    if (window.confirm('Bạn có chắc muốn xóa sạch lịch sử trò chuyện với BIX?')) {
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current)
      setStreamingMsg(null)
      setMessages([DEFAULT_WELCOME])
      try {
        localStorage.removeItem('mobix_chat_messages_v3')
      } catch {}
    }
  }

  useEffect(() => {
    if (open) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, streamingMsg, loading, open])

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend ?? input).trim()
    if (!text || loading) return

    // Nếu đang stream dở tin nhắn trước, chốt ngay tin nhắn đó
    if (streamingMsg) {
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current)
      const finished: ChatMessage = {
        id: streamingMsg.id,
        sender: 'bot',
        text: streamingMsg.fullText,
        time: streamingMsg.time,
        suggestions: streamingMsg.suggestions,
        products: streamingMsg.products,
      }
      setMessages((prev) => [...prev, finished])
      setStreamingMsg(null)
    }

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      sender: 'user',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await api.chat(text)
      setLoading(false)

      // Kích hoạt hiệu ứng người tư vấn gõ phím mượt mà
      setStreamingMsg({
        id: crypto.randomUUID(),
        fullText: res.reply,
        currentLength: 0,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestions: res.suggestions,
        products: res.products,
      })
    } catch {
      setLoading(false)
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          sender: 'bot',
          text: 'Dạ rất tiếc, đường truyền tư vấn tạm thời bận. Bạn có thể gửi lại câu hỏi ngay bây giờ nhé ạ!',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    }
  }

  if (!open) return null

  return (
    <aside className="chat-drawer" role="dialog" aria-label="Trợ lý ảo BIX AI">
      <div className="chat-header">
        <div className="bot-info">
          <div className="bot-avatar">🤖</div>
          <div>
            <div className="bot-name">BIX – Tư Vấn Viên AI</div>
            <div className="bot-status">
              <span>● Trực tuyến 24/7 • Tư vấn tận tâm</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            className="chat-clear-btn"
            onClick={handleClearHistory}
            title="Xóa lịch sử chat"
            aria-label="Xóa lịch sử chat"
            type="button"
          >
            🗑️
          </button>
          <button className="chat-close-btn" onClick={onClose} aria-label="Đóng chat">
            ✕
          </button>
        </div>
      </div>

      <div className="chat-messages">
        {messages.map((m) => (
          <div key={m.id} style={{ display: 'flex', flexDirection: 'column' }}>
            <div className={`msg-bubble ${m.sender}`}>
              <div className="msg-text">{renderMessageText(m.text)}</div>

              {/* Danh sách điện thoại gợi ý kèm theo */}
              {m.products && m.products.length > 0 && (
                <div className="chat-products-row">
                  {m.products.map((p) => (
                    <div className="chat-product-mini" key={p.id}>
                      <img
                        src={p.image}
                        alt={p.name}
                        onClick={() => onViewProductDetails(p)}
                        style={{ cursor: 'pointer' }}
                        onError={(e) => {
                          ;(e.target as HTMLImageElement).src =
                            'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&auto=format&fit=crop&q=80'
                        }}
                      />
                      <span
                        className="mini-name"
                        title={p.name}
                        onClick={() => onViewProductDetails(p)}
                        style={{ cursor: 'pointer' }}
                      >
                        {p.name}
                      </span>
                      <span className="mini-price">{vnd(p.price)}</span>
                      <button onClick={() => onAddToCart(p)}>+ Thêm giỏ</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Gợi ý câu hỏi thông minh */}
            {m.suggestions && m.suggestions.length > 0 && (
              <div className="chat-suggestions">
                {m.suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    className="prompt-chip"
                    onClick={() => handleSend(s)}
                  >
                    💡 {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* HIỆU ỨNG GÕ PHÍM TRỰC TIẾP NHƯ NGƯỜI ĐANG NHẬP */}
        {streamingMsg && (
          <div className="msg-bubble bot streaming-msg">
            <div className="msg-text">
              {renderMessageText(streamingMsg.fullText.slice(0, streamingMsg.currentLength))}
              <span className="typing-cursor">▌</span>
            </div>
          </div>
        )}

        {/* HIỆU ỨNG AI ĐANG SUY NGHĨ / PHÂN TÍCH */}
        {loading && (
          <div className="msg-bubble bot typing-bubble">
            <div className="typing-header">
              <span className="typing-avatar">🤖</span>
              <span className="typing-title">BIX đang suy nghĩ</span>
              <span className="typing-dots-wave">
                <span className="wave-dot" />
                <span className="wave-dot" />
                <span className="wave-dot" />
              </span>
            </div>
            <div className="typing-status-hint">
              <span className="typing-spinner" />
              <span>{typingHint}</span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      <div className="chat-input-bar">
        <input
          type="text"
          className="chat-input"
          placeholder="Hỏi nhu cầu (VD: máy chụp ảnh đẹp dưới 20tr)..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <button
          className="chat-send-btn"
          onClick={() => handleSend()}
          disabled={loading || !input.trim()}
          aria-label="Gửi tin nhắn"
        >
          ➤
        </button>
      </div>
    </aside>
  )
}
