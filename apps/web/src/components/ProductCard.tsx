import { vnd, type Product } from '../api'

type Props = {
  product: Product
  onViewDetails: (product: Product) => void
}

export default function ProductCard({ product, onViewDetails }: Props) {
  const discountPercent =
    product.original_price && product.original_price > product.price
      ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
      : null

  // Format clean badge text like "Mới" or "Bán chạy"
  const badgeText = product.tag.includes('MỚI')
    ? 'Mới'
    : product.tag.includes('BÁN CHẠY')
    ? 'Bán chạy'
    : product.tag || (discountPercent ? `-${discountPercent}%` : null)

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

        <span className="product-brand">{product.brand}</span>

        <div className="product-rating">
          <span className="rating-star">★ {product.rating.toFixed(1)}</span>
          <span>(128 đánh giá)</span>
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

        <button
          className="card-cta-btn"
          onClick={() => onViewDetails(product)}
        >
          <span>Xem chi tiết</span>
          <span>➔</span>
        </button>
      </div>
    </article>
  )
}
