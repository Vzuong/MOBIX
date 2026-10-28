import { useState } from 'react'
import { vnd, type Cart, type User } from '../api'

type Props = {
  open: boolean
  cart: Cart
  user?: User | null
  onClose: () => void
  onUpdateQty: (productId: number, qty: number) => void
  onClearCart: () => void
  onCheckoutSuccess: () => void
}

export default function CartDrawer({
  open,
  cart,
  user,
  onClose,
  onUpdateQty,
  onClearCart,
  onCheckoutSuccess,
}: Props) {
  const [couponCode, setCouponCode] = useState('')
  const [discount, setDiscount] = useState(0)
  const [couponMessage, setCouponMessage] = useState('')

  if (!open) return null

  const handleApplyCoupon = () => {
    const code = couponCode.trim().toUpperCase()
    if (code === 'MOBIX2024') {
      setDiscount(500000)
      setCouponMessage('🎉 Áp dụng thành công mã MOBIX2024 (-500.000đ)')
    } else {
      setCouponMessage('❌ Mã giảm giá không hợp lệ (Thử mã: MOBIX2024)')
    }
  }

  const finalTotal = Math.max(0, cart.total - discount)

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside className="cart-drawer" onClick={(e) => e.stopPropagation()} aria-label="Giỏ hàng">
        <div className="drawer-header">
          <div className="drawer-title">
            <span>🛒</span>
            <span>Giỏ hàng của bạn ({cart.count})</span>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Đóng giỏ hàng">
            ✕
          </button>
        </div>

        <div className="drawer-body">
          {cart.items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>📱</div>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: 6 }}>Giỏ hàng chưa có điện thoại</h3>
              <p style={{ fontSize: '0.85rem' }}>Khám phá các dòng flagship mới nhất để nhận ưu đãi ngay hôm nay!</p>
            </div>
          ) : (
            <>
              {cart.items.map(({ product: p, qty }) => (
                <div className="cart-item" key={p.id}>
                  <img
                    src={p.image}
                    alt={p.name}
                    className="cart-item-img"
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&auto=format&fit=crop&q=80'
                    }}
                  />
                  <div className="cart-item-info">
                    <span className="cart-item-name">{p.name}</span>
                    <span className="cart-item-price">{vnd(p.price)}</span>
                    <div className="qty-control">
                      <button
                        className="qty-btn"
                        onClick={() => onUpdateQty(p.id, qty - 1)}
                        aria-label="Giảm số lượng"
                      >
                        −
                      </button>
                      <span className="qty-num">{qty}</span>
                      <button
                        className="qty-btn"
                        onClick={() => onUpdateQty(p.id, qty + 1)}
                        aria-label="Tăng số lượng"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <button
                    className="remove-btn"
                    onClick={() => onUpdateQty(p.id, 0)}
                    aria-label={`Xoá ${p.name}`}
                  >
                    🗑
                  </button>
                </div>
              ))}

              <div style={{ marginTop: 8 }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Mã giảm giá voucher:</span>
                <div className="coupon-box">
                  <input
                    type="text"
                    className="coupon-input"
                    placeholder="Nhập MOBIX2024"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                  />
                  <button className="coupon-btn" onClick={handleApplyCoupon}>
                    Áp dụng
                  </button>
                </div>
                {couponMessage && (
                  <p
                    style={{
                      fontSize: '0.75rem',
                      marginTop: 4,
                      color: discount ? 'var(--accent-green)' : 'var(--accent-red)',
                    }}
                  >
                    {couponMessage}
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {cart.items.length > 0 && (
          <div className="drawer-footer">
            <div className="summary-row">
              <span>Tạm tính ({cart.count} sản phẩm)</span>
              <span>{vnd(cart.total)}</span>
            </div>
            {discount > 0 && (
              <div className="summary-row" style={{ color: 'var(--accent-green)' }}>
                <span>Voucher giảm giá</span>
                <span>-{vnd(discount)}</span>
              </div>
            )}
            <div className="summary-row">
              <span>Phí vận chuyển</span>
              <span style={{ color: 'var(--accent-green)' }}>Miễn phí toàn quốc</span>
            </div>
            <div className="summary-row summary-total">
              <span>Tổng cộng</span>
              <span style={{ color: '#ff385c' }}>{vnd(finalTotal)}</span>
            </div>

            {user && (
              <div className="cart-user-badge">
                <span className="badge-icon">👤</span>
                <div className="badge-text">
                  <span className="badge-title">Giao cho: <strong>{user.username}</strong></span>
                  <span className="badge-sub">SĐT nhận tư vấn & giao hàng: <strong>{user.phone || 'Chưa cập nhật'}</strong></span>
                </div>
              </div>
            )}

            <button className="checkout-btn" onClick={onCheckoutSuccess}>
              Tiến hành thanh toán ngay 🚀
            </button>

            <button className="clear-cart-btn" onClick={onClearCart}>
              Xóa sạch giỏ hàng
            </button>
          </div>
        )}
      </aside>
    </div>
  )
}
