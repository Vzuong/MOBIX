import { vnd, type Product } from '../api'

type Props = {
  product: Product | null
  onClose: () => void
  onAddToCart: (product: Product) => void
}

export default function ProductModal({ product, onClose, onAddToCart }: Props) {
  if (!product) return null

  const discountPercent =
    product.original_price && product.original_price > product.price
      ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
      : null

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />

        <div className="modal-body">
          <div className="modal-hero">
            {product.tag && <div className="card-tag">{product.tag}</div>}
            <img
              src={product.image}
              alt={product.name}
              onError={(e) => {
                ;(e.target as HTMLImageElement).src =
                  'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&auto=format&fit=crop&q=80'
              }}
            />
          </div>

          <div>
            <div className="card-brand-row" style={{ marginBottom: 6 }}>
              <span className="brand-text" style={{ fontSize: '0.85rem' }}>{product.brand}</span>
              <span className="rating-text" style={{ fontSize: '0.85rem' }}>★ {product.rating.toFixed(1)} (128 đánh giá)</span>
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 8 }}>{product.name}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.5 }}>
              {product.description}
            </p>
          </div>

          <div className="modal-specs-table">
            <h4 style={{ fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 700 }}>
              Thông số kỹ thuật chi tiết
            </h4>
            <div className="spec-row">
              <span className="spec-label">Màn hình</span>
              <span className="spec-value">{product.screen}</span>
            </div>
            <div className="spec-row">
              <span className="spec-label">Bộ vi xử lý (Chip)</span>
              <span className="spec-value">{product.chip}</span>
            </div>
            <div className="spec-row">
              <span className="spec-label">RAM / Bộ nhớ trong</span>
              <span className="spec-value">{product.ram_rom}</span>
            </div>
            <div className="spec-row">
              <span className="spec-label">Pin & Công nghệ sạc</span>
              <span className="spec-value">{product.battery}</span>
            </div>
            <div className="spec-row">
              <span className="spec-label">Chính sách bảo hành</span>
              <span className="spec-value" style={{ color: 'var(--accent-green)' }}>12 tháng chính hãng, 1 đổi 1 trong 30 ngày</span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <div className="modal-price-box">
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Giá khuyến mãi:</span>
            <span className="price-current" style={{ fontSize: '1.15rem' }}>{vnd(product.price)}</span>
            {product.original_price && (
              <span className="price-original" style={{ fontSize: '0.75rem' }}>
                {vnd(product.original_price)} {discountPercent && `(-${discountPercent}%)`}
              </span>
            )}
          </div>

          <button
            className="modal-cta"
            onClick={() => {
              onAddToCart(product)
              onClose()
            }}
          >
            Thêm vào giỏ ngay 🛍️
          </button>
        </div>
      </div>
    </div>
  )
}
