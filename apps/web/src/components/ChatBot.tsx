import { useState, useRef, useEffect } from 'react'
import { api, vnd, type Product, type ChatMessage } from '../api'

type Props = {
  open: boolean
  onClose: () => void
  onAddToCart: (product: Product) => void
  onViewProductDetails: (product: Product) => void
}

export default function ChatBot({ open, onClose, onAddToCart, onViewProductDetails }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: 'Xin chào! Mình là **BIX** 🤖 - Trợ lý công nghệ AI của MOBIX. Bạn cần tư vấn máy chụp ảnh Leica/Zeiss, chiến game 144Hz, pin 8000mAh hay trong tầm giá nào ạ?',
      time: 'Vừa xong',
      suggestions: [
        'Con máy chụp ảnh ngon nhất?',
        'iPhone với Xiaomi máy nào quay phim tốt hơn?',
        'Máy chơi game tốt nhất trong tầm giá?',
        'Máy gập nào đáng mua?',
        'Chính sách trả góp 0%',
      ],
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, open])

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend ?? input).trim()
    if (!text || loading) return

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
      const botMsg: ChatMessage = {
        id: crypto.randomUUID(),
        sender: 'bot',
        text: res.reply,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestions: res.suggestions,
        products: res.products,
      }
      setMessages((prev) => [...prev, botMsg])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          sender: 'bot',
          text: 'Rất tiếc, đường truyền tư vấn tạm thời bận. Bạn có thể thử lại ngay bây giờ nhé!',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <aside className="chat-drawer" role="dialog" aria-label="Trợ lý ảo BIX AI">
      <div className="chat-header">
        <div className="bot-info">
          <div className="bot-avatar">🤖</div>
          <div>
            <div className="bot-name">BIX - AI Advisor</div>
            <div className="bot-status">
              <span>● Trực tuyến 24/7 • Tư vấn tức thì</span>
            </div>
          </div>
        </div>
        <button className="chat-close-btn" onClick={onClose} aria-label="Đóng chat">
          ✕
        </button>
      </div>

        <div className="chat-messages">
          {messages.map((m) => (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column' }}>
              <div className={`msg-bubble ${m.sender}`}>
                <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>

                {/* Embedded Smartphone Carousel if matched */}
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

              {/* Prompt Suggestions */}
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

          {loading && (
            <div className="msg-bubble bot" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span>MOBIX AI đang phân tích kho sản phẩm...</span>
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
