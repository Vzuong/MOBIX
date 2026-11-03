import { useState } from 'react'
import { api, vnd, type Cart, type User } from '../api'

type Props = {
  open: boolean
  cart: Cart
  user: User | null
  onClose: () => void
  onSuccess: () => void
}

export default function CheckoutModal({ open, cart, user, onClose, onSuccess }: Props) {
  const [fullname, setFullname] = useState(user?.username || '')
  const [phone, setPhone] = useState(user?.phone || '')
  const [city, setCity] = useState('Hà Nội')
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'qr' | 'installment'>('cod')
  const [orderCode, setOrderCode] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullname.trim()) {
      setError('Vui lòng nhập họ và tên người nhận')
      return
    }
    const cleanPhone = phone.trim()
    if (!cleanPhone || cleanPhone.length < 9) {
      setError('Vui lòng nhập số điện thoại hợp lệ (tối thiểu 9 số)')
      return
    }
    if (!address.trim()) {
      setError('Vui lòng nhập địa chỉ nhận hàng cụ thể')
      return
    }

    // Sinh mã đơn hàng ngẫu nhiên chuyên nghiệp
    const code = `MBX-${Math.floor(100000 + Math.random() * 900000)}`
    try {
      setIsSubmitting(true)
      await api.orders.create({
        order_code: code,
        phone: cleanPhone,
        customer_name: fullname.trim(),
        address: address.trim(),
        city,
        payment_method:
          paymentMethod === 'cod'
            ? 'Thanh toán khi nhận hàng (COD)'
            : paymentMethod === 'qr'
            ? 'Chuyển khoản VietQR'
            : 'Trả góp 0% lãi suất',
        total_amount: cart.total,
        items: cart.items.map((it) => ({
          id: it.product.id,
          name: it.product.name,
          price: it.product.price,
          qty: it.qty,
          image: it.product.image,
        })),
      })
    } catch (err) {
      console.error('Lỗi lưu đơn hàng:', err)
    } finally {
      setIsSubmitting(false)
      setOrderCode(code)
      setError('')
      onSuccess()
    }
  }

  const handleFinish = () => {
    setOrderCode(null)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-sheet checkout-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />

        {orderCode ? (
          /* MÀN HÌNH ĐẶT HÀNG THÀNH CÔNG */
          <div className="checkout-success-view">
            <div className="success-icon-badge">✓</div>
            <h2 className="success-title">Đặt hàng thành công!</h2>
            <p className="success-desc">
              Cảm ơn quý khách <strong>{fullname}</strong> đã tin chọn mua sắm smartphone tại hệ thống MOBIX.
            </p>

            <div className="order-receipt-card">
              <div className="receipt-row">
                <span className="receipt-label">Mã đơn hàng:</span>
                <span className="receipt-code">{orderCode}</span>
              </div>
              <div className="receipt-row">
                <span className="receipt-label">Số điện thoại:</span>
                <span className="receipt-value">{phone}</span>
              </div>
              <div className="receipt-row">
                <span className="receipt-label">Địa chỉ nhận:</span>
                <span className="receipt-value">{address}, {city}</span>
              </div>
              <div className="receipt-row">
                <span className="receipt-label">Hình thức:</span>
                <span className="receipt-value">
                  {paymentMethod === 'cod' && 'Thanh toán khi nhận hàng (COD)'}
                  {paymentMethod === 'qr' && 'Chuyển khoản VietQR'}
                  {paymentMethod === 'installment' && 'Trả góp 0% lãi suất'}
                </span>
              </div>
              <div className="receipt-row total">
                <span className="receipt-label">Tổng thanh toán:</span>
                <span className="receipt-total">{vnd(cart.total)}</span>
              </div>
            </div>

            <div className="service-alert-box">
              📞 <strong>Tổng đài viên MOBIX</strong> sẽ gọi điện đến số <strong>{phone}</strong> trong vòng 5 phút để xác nhận kiện hàng và điều phối giao siêu tốc.
              <br /><br />
              🔍 Quý khách có thể dùng mã <strong>{orderCode}</strong> hoặc SĐT <strong>{phone}</strong> để theo dõi tiến độ đơn hàng tại mục <strong>Tra cứu đơn</strong> ở đầu trang web.
            </div>

            <button className="checkout-confirm-btn" onClick={handleFinish} type="button">
              Tiếp tục mua sắm ➔
            </button>
          </div>
        ) : (
          /* FORM NHẬP THÔNG TIN GIAO HÀNG & PHƯƠNG THỨC */
          <form className="checkout-form-view" onSubmit={handleSubmit}>
            <div className="checkout-header">
              <h3 className="checkout-heading">📦 Thông tin đặt hàng</h3>
              <button className="chat-close-btn" type="button" onClick={onClose} aria-label="Đóng">
                ✕
              </button>
            </div>

            {error && <div className="checkout-error-banner">⚠️ {error}</div>}

            {/* Tóm tắt giỏ hàng thu nhỏ */}
            <div className="checkout-cart-summary">
              <div className="summary-title-row">
                <span style={{ fontWeight: 700 }}>Đơn hàng ({cart.count} sản phẩm)</span>
                <span style={{ fontWeight: 800, color: 'var(--primary)' }}>{vnd(cart.total)}</span>
              </div>
              <div className="summary-items-list">
                {cart.items.map((it) => (
                  <div key={it.product.id} className="summary-item-line">
                    <span className="item-name-qty">{it.product.name} × {it.qty}</span>
                    <span className="item-subtotal">{vnd(it.product.price * it.qty)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Thông tin người nhận */}
            <div className="checkout-field-group">
              <label className="checkout-label">Họ và tên người nhận *</label>
              <input
                type="text"
                className="checkout-input"
                placeholder="Ví dụ: Nguyễn Văn An"
                value={fullname}
                onChange={(e) => setFullname(e.target.value)}
                required
              />
            </div>

            <div className="checkout-field-row">
              <div className="checkout-field-group" style={{ flex: 1 }}>
                <label className="checkout-label">Số điện thoại nhận hàng *</label>
                <input
                  type="tel"
                  className="checkout-input"
                  placeholder="0987xxxxxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>

              <div className="checkout-field-group" style={{ flex: 1 }}>
                <label className="checkout-label">Tỉnh / Thành phố *</label>
                <select
                  className="checkout-input checkout-select"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                >
                  <option value="Hà Nội">Hà Nội (Hỏa tốc 2H)</option>
                  <option value="TP.Hồ Chí Minh">TP.Hồ Chí Minh (Hỏa tốc 2H)</option>
                  <option value="Đà Nẵng">Đà Nẵng</option>
                  <option value="Hải Phòng">Hải Phòng</option>
                  <option value="Cần Thơ">Cần Thơ</option>
                  <option value="Tỉnh thành khác">Tỉnh thành khác</option>
                </select>
              </div>
            </div>

            <div className="checkout-field-group">
              <label className="checkout-label">Địa chỉ nhận hàng chi tiết *</label>
              <input
                type="text"
                className="checkout-input"
                placeholder="Số nhà, tên đường, Phường/Xã..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
              />
            </div>

            <div className="checkout-field-group">
              <label className="checkout-label">Ghi chú giao hàng (không bắt buộc)</label>
              <input
                type="text"
                className="checkout-input"
                placeholder="Ví dụ: Giao vào giờ hành chính, gọi trước khi giao"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            {/* Chọn hình thức thanh toán */}
            <div className="checkout-field-group">
              <label className="checkout-label">Hình thức thanh toán</label>
              <div className="payment-options-grid">
                <label className={`payment-card ${paymentMethod === 'cod' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === 'cod'}
                    onChange={() => setPaymentMethod('cod')}
                  />
                  <div>
                    <div className="pay-title">💵 Thanh toán khi nhận hàng (COD)</div>
                    <div className="pay-desc">Đồng kiểm tra máy nguyên seal trước khi thanh toán tiền mặt</div>
                  </div>
                </label>

                <label className={`payment-card ${paymentMethod === 'qr' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === 'qr'}
                    onChange={() => setPaymentMethod('qr')}
                  />
                  <div>
                    <div className="pay-title">📲 Quét mã VietQR chuyển khoản</div>
                    <div className="pay-desc">Tự động nhận diện đơn hàng, miễn phí vận chuyển 100%</div>
                  </div>
                </label>

                <label className={`payment-card ${paymentMethod === 'installment' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === 'installment'}
                    onChange={() => setPaymentMethod('installment')}
                  />
                  <div>
                    <div className="pay-title">💳 Trả góp 0% lãi suất</div>
                    <div className="pay-desc">Hỗ trợ thẻ tín dụng 25 ngân hàng hoặc CCCD duyệt online 5 phút</div>
                  </div>
                </label>
              </div>
            </div>

            <button className="checkout-confirm-btn" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Đang xử lý tạo đơn...' : `Xác nhận đặt hàng • ${vnd(cart.total)}`}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
