import { useState } from 'react'
import { api, vnd, type Order } from '../api'

type Props = {
  open: boolean
  onClose: () => void
  onAskAI?: (prompt: string) => void
}

export default function OrderLookupModal({ open, onClose, onAskAI }: Props) {
  const [orderCode, setOrderCode] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [order, setOrder] = useState<Order | null>(null)
  const [copied, setCopied] = useState(false)

  if (!open) return null

  const handleLookup = async (codeToUse?: string, phoneToUse?: string) => {
    const code = (codeToUse ?? orderCode).trim()
    const cleanPhone = (phoneToUse ?? phone).trim()

    if (!code) {
      setError('Vui lòng nhập Mã đơn hàng (bắt đầu bằng MBX-)')
      return
    }
    if (!cleanPhone || cleanPhone.length < 8) {
      setError('Vui lòng nhập Số điện thoại đặt hàng')
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await api.orders.lookup({
        order_code: code,
        phone: cleanPhone,
      })

      if (res.ok && res.order) {
        setOrder(res.order)
        setError('')
      } else {
        setError(res.error || 'Không tìm thấy đơn hàng. Vui lòng kiểm tra lại thông tin.')
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không thể tra cứu đơn hàng vào lúc này. Vui lòng thử lại sau.'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleFillSample = () => {
    setOrderCode('MBX-888999')
    setPhone('0988888888')
    handleLookup('MBX-888999', '0988888888')
  }

  const handleCopyCode = () => {
    if (!order) return
    navigator.clipboard?.writeText(order.order_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Xác định bước tiến trình (Timeline Stepper)
  // 1: Đặt hàng -> 2: Đã xác nhận -> 3: Đang giao -> 4: Giao thành công
  const getStepIndex = (status: string) => {
    if (status.includes('Giao thành công') || status.includes('Hoàn tất')) return 4
    if (status.includes('Đang giao')) return 3
    if (status.includes('Đã xác nhận') || status.includes('Đang đóng gói')) return 2
    return 1 // Đang xử lý
  }

  const currentStep = order ? getStepIndex(order.status) : 1

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-sheet order-lookup-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />

        <div className="lookup-header">
          <div className="lookup-title-wrap">
            <span className="lookup-icon">📦</span>
            <div>
              <h3 className="lookup-heading">Tra cứu tình trạng đơn hàng</h3>
              <p className="lookup-sub">Nhập mã đơn hàng và số điện thoại để theo dõi lộ trình giao máy</p>
            </div>
          </div>
          <button className="chat-close-btn" type="button" onClick={onClose} aria-label="Đóng">
            ✕
          </button>
        </div>

        {/* FORM NHẬP THÔNG TIN TRA CỨU */}
        <form
          className="lookup-form"
          onSubmit={(e) => {
            e.preventDefault()
            handleLookup()
          }}
        >
          <div className="lookup-input-row">
            <div className="lookup-field">
              <label className="lookup-label">Mã đơn hàng *</label>
              <input
                type="text"
                className="lookup-input"
                placeholder="VD: MBX-888999"
                value={orderCode}
                onChange={(e) => setOrderCode(e.target.value.toUpperCase())}
              />
            </div>
            <div className="lookup-field">
              <label className="lookup-label">Số điện thoại đặt hàng *</label>
              <input
                type="tel"
                className="lookup-input"
                placeholder="VD: 0988888888"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="lookup-actions-row">
            <button className="lookup-submit-btn" type="submit" disabled={loading}>
              {loading ? 'Đang tra cứu...' : '🔍 Tra cứu đơn hàng'}
            </button>
            <button
              className="lookup-sample-btn"
              type="button"
              onClick={handleFillSample}
              title="Điền nhanh đơn mẫu có sẵn để thử nghiệm"
            >
              💡 Thử đơn mẫu
            </button>
          </div>
        </form>

        {error && (
          <div className="lookup-error-banner">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* KẾT QUẢ TRA CỨU CHI TIẾT */}
        {order && (
          <div className="lookup-result-card">
            {/* THẺ ĐẦU: MÃ ĐƠN & TRẠNG THÁI */}
            <div className="result-top-bar">
              <div className="result-code-wrap">
                <span className="result-code-label">MÃ ĐƠN:</span>
                <span className="result-code-value">{order.order_code}</span>
                <button
                  type="button"
                  className="copy-code-btn"
                  onClick={handleCopyCode}
                  title="Sao chép mã đơn hàng"
                >
                  {copied ? '✓ Đã chép' : '📋 Chép mã'}
                </button>
              </div>

              <div
                className={`order-status-badge ${
                  currentStep === 4
                    ? 'completed'
                    : currentStep === 3
                    ? 'shipping'
                    : currentStep === 2
                    ? 'confirmed'
                    : 'processing'
                }`}
              >
                {order.status}
              </div>
            </div>

            {/* TIMELINE TIẾN TRÌNH 4 BƯỚC */}
            <div className="order-stepper">
              <div className={`step-item ${currentStep >= 1 ? 'active' : ''}`}>
                <div className="step-circle">{currentStep >= 1 ? '✓' : '1'}</div>
                <div className="step-label">Đã tiếp nhận</div>
              </div>
              <div className={`step-line ${currentStep >= 2 ? 'active' : ''}`} />

              <div className={`step-item ${currentStep >= 2 ? 'active' : ''}`}>
                <div className="step-circle">{currentStep >= 2 ? '✓' : '2'}</div>
                <div className="step-label">Đã xác nhận</div>
              </div>
              <div className={`step-line ${currentStep >= 3 ? 'active' : ''}`} />

              <div className={`step-item ${currentStep >= 3 ? 'active' : ''}`}>
                <div className="step-circle">{currentStep >= 3 ? '🚚' : '3'}</div>
                <div className="step-label">Đang giao hàng</div>
              </div>
              <div className={`step-line ${currentStep >= 4 ? 'active' : ''}`} />

              <div className={`step-item ${currentStep >= 4 ? 'active' : ''}`}>
                <div className="step-circle">{currentStep >= 4 ? '✓' : '4'}</div>
                <div className="step-label">Giao thành công</div>
              </div>
            </div>

            {/* THÔNG TIN NGƯỜI NHẬN & VẬN CHUYỂN */}
            <div className="result-grid">
              <div className="info-block">
                <span className="info-title">👤 Người nhận hàng</span>
                <p><strong>{order.customer_name}</strong> • {order.phone}</p>
                <p className="sub-text">📍 {order.address}, {order.city}</p>
              </div>

              <div className="info-block">
                <span className="info-title">💳 Phương thức thanh toán</span>
                <p><strong>{order.payment_method}</strong></p>
                <p className="sub-text">🕒 Thời gian tạo: {order.created_at || 'Hôm nay'}</p>
              </div>
            </div>

            {/* DANH SÁCH SẢN PHẨM TRONG ĐƠN */}
            <div className="order-items-box">
              <span className="info-title">📱 Sản phẩm trong kiện hàng ({order.items?.length || 0})</span>
              <div className="order-items-list">
                {order.items && order.items.length > 0 ? (
                  order.items.map((it, idx) => (
                    <div key={idx} className="order-item-row">
                      {it.image && (
                        <img src={it.image} alt={it.name} className="order-item-thumb" />
                      )}
                      <div className="order-item-meta">
                        <span className="order-item-name">{it.name}</span>
                        <span className="order-item-sub">Số lượng: <strong>{it.qty}</strong> máy</span>
                      </div>
                      <span className="order-item-price">{vnd(it.price * it.qty)}</span>
                    </div>
                  ))
                ) : (
                  <p className="sub-text">Kiện hàng tiêu chuẩn MOBIX</p>
                )}
              </div>

              <div className="order-total-bar">
                <span>Tổng giá trị đơn hàng:</span>
                <span className="order-total-amount">{vnd(order.total_amount)}</span>
              </div>
            </div>

            {/* HỖ TRỢ VÀ NÚT TƯƠNG TÁC */}
            <div className="result-footer-actions">
              <div className="support-hotline-note">
                📞 Cần thay đổi địa chỉ hoặc hẹn giờ giao? Gọi ngay <strong>1800 6933</strong> (Miễn phí 24/7)
              </div>
              {onAskAI && (
                <button
                  type="button"
                  className="ask-ai-order-btn"
                  onClick={() => {
                    onClose()
                    onAskAI(`Tôi muốn kiểm tra tình trạng đơn hàng ${order.order_code} số điện thoại ${order.phone}`)
                  }}
                >
                  🤖 Nhờ AI BIX hỗ trợ đơn này
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
