import { useState } from 'react'
import { vnd, type Product } from '../api'

type Props = {
  product: Product
  onViewDetails: (product: Product) => void
  onAskAI?: (product: Product) => void
  onAddToCart?: (product: Product) => void
}

export default function ProductCard({ product, onViewDetails, onAskAI, onAddToCart }: Props) {
  const [isAdded, setIsAdded] = useState(false)

  const discountPercent =
    product.original_price && product.original_price > product.price
      ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
      : null

  // Format clean badge text like "Mới" or "Bán chạy"
  const badgeText = product.tag.includes('MỚI')
    ? 'Mới'
    : product.tag.includes('BÁN CHẠY')
    ? 'Bán chạy'
    : product.tag.includes('GAMING')
    ? 'Gaming'
    : product.tag || (discountPercent ? `-${discountPercent}%` : null)

  const handleAdd = () => {
    if (!onAddToCart) return
    onAddToCart(product)
    setIsAdded(true)
    setTimeout(() => setIsAdded(false), 1400)
  }

  // Extract key spec highlights
  const refreshRate = product.screen?.includes('165Hz')
    ? '165Hz'
    : product.screen?.includes('144Hz')
    ? '144Hz'
    : product.screen?.includes('120Hz')
    ? '120Hz'
    : product.screen?.toLowerCase().includes('oled')
    ? 'OLED'
    : null

  const chipShort = product.chip
    ? product.chip
        .replace('Apple ', '')
        .replace('Snapdragon ', 'Snap ')
        .replace('MediaTek ', 'MTK ')
        .replace('Dimensity ', 'Dim ')
        .split(' ')
        .slice(0, 3)
        .join(' ')
    : null

  return (
    <article className="product-card">
      {badgeText && <div className="card-badge sale">{badgeText}</div>}

      <div
        className="card-img-box"
        onClick={() => onViewDetails(product)}
        title="Bấm để xem chi tiết"
      >
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          onError={(e) => {
            ;(e.target as HTMLImageElement).src =
              'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d2/IPhone_16_Pro_Vector.svg/960px-IPhone_16_Pro_Vector.svg.png'
          }}
        />
      </div>

      <div className="card-info">
        <h3
          className="product-name"
          onClick={() => onViewDetails(product)}
          title={product.name}
        >
          {product.name}
        </h3>

        <div className="card-brand-row">
          <span className="product-brand">{product.brand}</span>
          <div className="product-rating">
            <span className="rating-star">★ {product.rating.toFixed(1)}</span>
            <span className="rating-count">(128)</span>
          </div>
        </div>

        {/* CÁC THÔNG SỐ CỐT LÕI (REFRESH RATE / CHIP) */}
        <div className="card-specs-tags">
          {refreshRate && (
            <span
              className={`spec-tag hz-tag ${refreshRate === '165Hz' || refreshRate === '144Hz' ? 'high-hz' : ''}`}
            >
              ⚡ {refreshRate}
            </span>
          )}
          {chipShort && <span className="spec-tag chip-tag">🧠 {chipShort}</span>}
        </div>

        <div className="price-container">
          <span className="price-main">{vnd(product.price)}</span>
          {product.original_price && (
            <>
              <span className="price-old">{vnd(product.original_price)}</span>
              {discountPercent && <span className="badge-discount">-{discountPercent}%</span>}
            </>
          )}
        </div>

        {/* 3 NÚT HÀNH ĐỘNG: XEM CHI TIẾT - THÊM GIỎ HÀNG - HỎI AI */}
        <div className="card-actions-row">
          <button
            className="card-cta-btn"
            onClick={() => onViewDetails(product)}
            type="button"
            title="Xem thông số kỹ thuật chi tiết"
          >
            <span>Chi tiết</span>
          </button>

          {onAddToCart && (
            <button
              className={`card-cart-btn ${isAdded ? 'added' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                handleAdd()
              }}
              type="button"
              title="Thêm ngay vào giỏ hàng"
            >
              <span>{isAdded ? '✓ Đã thêm' : '+ Giỏ 🛒'}</span>
            </button>
          )}

          {onAskAI && (
            <button
              className="card-ai-btn"
              onClick={(e) => {
                e.stopPropagation()
                onAskAI(product)
              }}
              title="Nhờ AI BIX tư vấn chiếc máy này"
              type="button"
            >
              <span>🤖 Hỏi AI</span>
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
