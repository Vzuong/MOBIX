import { useEffect, useState, useCallback, useRef } from 'react'
import { api, type Cart, type Product, type User } from './api'
import ProductCard from './components/ProductCard'
import ProductModal from './components/ProductModal'
import CartDrawer from './components/CartDrawer'
import ChatBot from './components/ChatBot'
import AuthModal from './components/AuthModal'
import CheckoutModal from './components/CheckoutModal'
import Toast, { type ToastMessage } from './components/Toast'
import OrderLookupModal from './components/OrderLookupModal'

const NAV_TABS = [
  { id: 'all', label: 'Điện thoại', brand: 'All' },
  { id: 'apple', label: 'iPhone', brand: 'Apple' },
  { id: 'samsung', label: 'Samsung', brand: 'Samsung' },
  { id: 'xiaomi', label: 'Xiaomi', brand: 'Xiaomi' },
  { id: 'oppo', label: 'OPPO', brand: 'OPPO' },
  { id: 'vivo', label: 'vivo', brand: 'Vivo' },
  { id: 'realme', label: 'Realme', brand: 'Realme' },
  { id: 'asus', label: 'ASUS ROG', brand: 'Asus' },
]

interface HeroSlide {
  id: string
  productQuery: string
  label: string
  heading: React.ReactNode
  desc: string
  bgGradient: string
  defaultImage: string
}

const HERO_SLIDES: HeroSlide[] = [
  {
    id: 'iphone-duo',
    productQuery: 'iPhone Duo',
    label: 'IPHONE DUO MÀN HÌNH GẬP',
    heading: (
      <>
        Siêu phẩm gập Apple.<br />
        Đỉnh cao công nghệ 2026.
      </>
    ),
    desc: 'iPhone màn hình gập 7.6 inch không nếp nhăn, khung titan cao cấp, pin kép và chip Apple A20 Pro.',
    bgGradient: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
    defaultImage: 'https://cdn1.viettelstore.vn/Images/Product/ProductImage/875303633.png',
  },
  {
    id: 'xiaomi-17-ultra',
    productQuery: 'Xiaomi 17 Ultra',
    label: 'XIAOMI 17 ULTRA 5G',
    heading: (
      <>
        Ống kính Leica 200MP.<br />
        Cảm biến 1 inch bứt phá.
      </>
    ),
    desc: 'Chip Snapdragon 8 Elite Gen 5, màn hình HyperRGB OLED 6.9" 120Hz và pin 6000mAh sạc siêu nhanh.',
    bgGradient: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
    defaultImage: 'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/42/361988/xiaomi-17-ultra-black-1-639088343209328798.jpg',
  },
  {
    id: 'iphone-18-pro-max',
    productQuery: 'iPhone 18 Pro Max',
    label: 'IPHONE 18 PRO MAX 256GB',
    heading: (
      <>
        Hiệu năng vượt trội.<br />
        Trải nghiệm đỉnh cao 2026.
      </>
    ),
    desc: 'Chip Apple A20 Pro 2nm, camera Pro Fusion 48MP tùy chỉnh khẩu độ và thiết kế Titan Burgundy đẳng cấp.',
    bgGradient: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
    defaultImage: 'https://eplehuset.no/cdn/shop/files/iPhone_18_Pro_Max_Burgundy_PDP_Image_Position_1__no-NO_47b90b79-4d9e-4cee-91c9-78e8381445e8.png?v=1788993474&width=2200',
  },
]

const emptyCart: Cart = { items: [], total: 0, count: 0 }

export default function App() {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<Cart>(emptyCart)
  const [activeTab, setActiveTab] = useState('all')
  const [selectedBrand, setSelectedBrand] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // User Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(() => api.auth.getStoredUser())
  const [isAuthOpen, setIsAuthOpen] = useState(false)
  const [isPendingCheckout, setIsPendingCheckout] = useState(false)
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
  const [isOrderLookupOpen, setIsOrderLookupOpen] = useState(false)
  const [chatInitialPrompt, setChatInitialPrompt] = useState<string | null>(null)

  // Filter & Sort states
  const [sortOption, setSortOption] = useState<'default' | 'price-asc' | 'price-desc' | 'rating-desc'>('default')
  const [priceFilter, setPriceFilter] = useState<'all' | 'under-10' | '10-20' | 'above-20'>('all')
  const [featureFilter, setFeatureFilter] = useState<'all' | 'camera' | 'battery' | 'gaming' | 'fold'>('all')

  // Hero Carousel Slider State
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isSliderPaused, setIsSliderPaused] = useState(false)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)

  // Subnav tabs smooth drag-to-scroll & wheel handler
  const subnavRef = useRef<HTMLElement>(null)
  const [isNavDragging, setIsNavDragging] = useState(false)
  const [navStartX, setNavStartX] = useState(0)
  const [navScrollLeft, setNavScrollLeft] = useState(0)

  const handleNavMouseDown = (e: React.MouseEvent) => {
    if (!subnavRef.current) return
    setIsNavDragging(true)
    setNavStartX(e.pageX - subnavRef.current.offsetLeft)
    setNavScrollLeft(subnavRef.current.scrollLeft)
  }

  const handleNavMouseMove = (e: React.MouseEvent) => {
    if (!isNavDragging || !subnavRef.current) return
    e.preventDefault()
    const x = e.pageX - subnavRef.current.offsetLeft
    const walk = (x - navStartX) * 1.5
    subnavRef.current.scrollLeft = navScrollLeft - walk
  }

  const handleNavMouseUpOrLeave = () => {
    setIsNavDragging(false)
  }

  const handleNavWheel = (e: React.WheelEvent) => {
    if (!subnavRef.current) return
    if (e.deltaY !== 0 && Math.abs(e.deltaX) < Math.abs(e.deltaY)) {
      subnavRef.current.scrollLeft += e.deltaY
    }
  }

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length)
  }, [])

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)
  }, [])

  useEffect(() => {
    if (isSliderPaused) return
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [isSliderPaused, currentSlide])

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return
    const diff = touchStartX - e.changedTouches[0].clientX
    if (diff > 45) {
      nextSlide()
    } else if (diff < -45) {
      prevSlide()
    }
    setTouchStartX(null)
  }

  const showToast = useCallback((text: string) => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, text }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 2800)
  }, [])

  const loadProducts = useCallback(async (brand: string, q: string) => {
    try {
      if (products.length === 0) {
        setLoading(true)
      }
      const data = await api.products({ brand, q })
      setProducts(data)
      setError('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Lỗi khi tải dữ liệu sản phẩm')
    } finally {
      setLoading(false)
    }
  }, [products.length])

  useEffect(() => {
    loadProducts(selectedBrand, searchQuery)
    api.cart()
      .then(setCart)
      .catch((e) => console.error('Lỗi tải giỏ hàng ban đầu:', e))
  }, [loadProducts, selectedBrand, searchQuery])

  const handleAddToCart = async (product: Product) => {
    try {
      const updated = await api.add(product.id)
      setCart(updated)
      showToast(`Đã thêm "${product.name}" vào giỏ hàng!`)
    } catch (err: unknown) {
      showToast(`Không thể thêm vào giỏ: ${err instanceof Error ? err.message : 'Lỗi kết nối'}`)
    }
  }

  const handleUpdateQty = async (productId: number, qty: number) => {
    try {
      const updated = await api.setQty(productId, qty)
      setCart(updated)
      if (qty === 0) showToast('Đã xóa sản phẩm khỏi giỏ hàng')
    } catch (err: unknown) {
      showToast(`Lỗi: ${err instanceof Error ? err.message : 'Thao tác thất bại'}`)
    }
  }

  const handleClearCart = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa toàn bộ giỏ hàng?')) return
    try {
      const updated = await api.clear()
      setCart(updated)
      showToast('Đã xóa sạch giỏ hàng')
    } catch (err: unknown) {
      showToast(`Lỗi: ${err instanceof Error ? err.message : 'Thao tác thất bại'}`)
    }
  }

  // Đồng bộ phiên đăng nhập khi tải ứng dụng
  useEffect(() => {
    if (api.auth.getStoredUser()) {
      api.auth.me()
        .then((res) => setCurrentUser(res.user))
        .catch(() => {
          api.auth.logout()
          setCurrentUser(null)
        })
    }
  }, [])

  const handleCheckoutClick = () => {
    if (!currentUser) {
      setIsPendingCheckout(true)
      setIsAuthOpen(true)
      showToast('Vui lòng đăng nhập hoặc tạo tài khoản để đặt hàng!')
      return
    }
    setIsCartOpen(false)
    setIsCheckoutOpen(true)
  }

  const handleCheckoutSuccess = () => {
    api.clear().then(setCart)
    showToast('🎉 Đặt hàng thành công! MOBIX sẽ gọi xác nhận đơn trong 5 phút.')
  }

  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user)
    showToast(`Xin chào ${user.username}! Đăng nhập thành công`)
    if (isPendingCheckout) {
      setIsPendingCheckout(false)
      setIsCartOpen(false)
      setIsCheckoutOpen(true)
    }
  }

  const handleAskAI = (p: Product) => {
    setChatInitialPrompt(`Tư vấn cho tôi về chiếc ${p.name} này có ưu nhược điểm gì và có nên mua không?`)
    setIsChatOpen(true)
    if (selectedProduct) setSelectedProduct(null)
  }

  const handleAskAIPrompt = (prompt: string) => {
    setChatInitialPrompt(prompt)
    setIsChatOpen(true)
  }

  const handleLogout = () => {
    if (window.confirm(`Bạn có chắc chắn muốn đăng xuất khỏi tài khoản: ${currentUser?.username}?`)) {
      api.auth.logout()
      setCurrentUser(null)
      showToast('Đã đăng xuất tài khoản')
    }
  }

  const featuredProduct = products.find((p) => p.name.includes('16 Pro Max')) || products[0]

  // Lọc và sắp xếp sản phẩm chuẩn UX
  const filteredProducts = products.filter((p) => {
    // 1. Khoảng giá
    if (priceFilter === 'under-10' && p.price >= 10_000_000) return false
    if (priceFilter === '10-20' && (p.price < 10_000_000 || p.price > 20_000_000)) return false
    if (priceFilter === 'above-20' && p.price <= 20_000_000) return false

    // 2. Tính năng nổi bật
    if (featureFilter === 'camera') {
      const isCam =
        (p.camera &&
          (p.camera.includes('200MP') ||
            p.camera.includes('1 inch') ||
            p.camera.includes('Leica') ||
            p.camera.includes('ZEISS') ||
            p.camera.includes('Hasselblad'))) ||
        p.tag.toLowerCase().includes('chụp ảnh') ||
        p.tag.toLowerCase().includes('leica') ||
        p.tag.toLowerCase().includes('zeiss')
      if (!isCam) return false
    }
    if (featureFilter === 'battery') {
      const isBat =
        (p.battery &&
          (p.battery.includes('7000') ||
            p.battery.includes('8000') ||
            p.battery.includes('6600') ||
            p.battery.includes('7500'))) ||
        p.tag.toLowerCase().includes('pin')
      if (!isBat) return false
    }
    if (featureFilter === 'gaming') {
      const screenLower = (p.screen || '').toLowerCase()
      const tagLower = (p.tag || '').toLowerCase()
      const nameLower = (p.name || '').toLowerCase()
      const isGame =
        screenLower.includes('144hz') ||
        screenLower.includes('165hz') ||
        tagLower.includes('gaming') ||
        nameLower.includes('rog')
      if (!isGame) return false
    }
    if (featureFilter === 'fold') {
      const isFold =
        p.name.toLowerCase().includes('fold') ||
        p.name.toLowerCase().includes('flip') ||
        p.name.toLowerCase().includes('duo') ||
        p.description.toLowerCase().includes('gập')
      if (!isFold) return false
    }

    return true
  })

  const displayProducts = [...filteredProducts].sort((a, b) => {
    if (sortOption === 'price-asc') return a.price - b.price
    if (sortOption === 'price-desc') return b.price - a.price
    if (sortOption === 'rating-desc') return b.rating - a.rating
    return 0
  })

  return (
    <>
      <Toast toasts={toasts} />

      {/* TOPBAR (CLEAN WHITE E-COMMERCE HEADER) */}
      <header className="topbar">
        <div className="topbar-container">
          <div className="topbar-row">
            {/* BRAND LOGO */}
            <div className="brand-logo" onClick={() => { setActiveTab('all'); setSelectedBrand('All'); setSearchQuery(''); }}>
              <div className="logo-icon">M</div>
              <span className="brand-name">MOBIX</span>
            </div>

            {/* SEARCH BAR (CENTERED PILL) */}
            <div className="search-wrapper">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                className="search-input"
                placeholder="Tìm kiếm điện thoại (iPhone, Samsung, Xiaomi...)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="search-clear" onClick={() => setSearchQuery('')}>✕</button>
              )}
            </div>

            {/* RIGHT ACTIONS */}
            <div className="header-actions">
              <button
                className="header-link-btn track-order-btn"
                onClick={() => setIsOrderLookupOpen(true)}
                title="Tra cứu tình trạng đơn hàng"
                type="button"
              >
                <span>📦</span>
                <span className="track-order-text">Tra cứu đơn</span>
              </button>

              {currentUser ? (
                <button
                  className="header-link-btn user-logged-btn"
                  onClick={handleLogout}
                  title="Nhấp để đăng xuất tài khoản"
                >
                  <span className="user-avatar-badge">{currentUser.username.charAt(0).toUpperCase()}</span>
                  <span className="user-name-text">{currentUser.username}</span>
                  <span className="user-logout-tag">Đăng xuất</span>
                </button>
              ) : (
                <button
                  className="header-link-btn"
                  onClick={() => {
                    setIsPendingCheckout(false)
                    setIsAuthOpen(true)
                  }}
                >
                  <span>👤</span>
                  <span>Đăng nhập</span>
                </button>
              )}

              <button
                className="cart-icon-btn"
                onClick={() => setIsCartOpen(true)}
                aria-label="Xem giỏ hàng"
              >
                <span>🛒</span>
                <span>Giỏ hàng</span>
                <span className="cart-badge">{cart.count}</span>
              </button>
            </div>
          </div>

          {/* SUB-NAVIGATION TABS (VUỐT NGANG MƯỢT MÀ TRÊN MOBILE & KÉO CHUỘT TRÊN PC) */}
          <nav
            ref={subnavRef}
            className="subnav-tabs"
            aria-label="Danh mục thương hiệu"
            onMouseDown={handleNavMouseDown}
            onMouseMove={handleNavMouseMove}
            onMouseUp={handleNavMouseUpOrLeave}
            onMouseLeave={handleNavMouseUpOrLeave}
            onWheel={handleNavWheel}
          >
            {NAV_TABS.map((tab) => (
              <button
                key={tab.id}
                className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab(tab.id)
                  setSelectedBrand(tab.brand)
                }}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* HERO BANNER SECTION (INTERACTIVE SLIDER) */}
      {!searchQuery && selectedBrand === 'All' && products.length > 0 && (
        <section className="hero-section">
          <div
            className="hero-slider-wrapper"
            onMouseEnter={() => setIsSliderPaused(true)}
            onMouseLeave={() => setIsSliderPaused(false)}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Navigation Arrows */}
            <button
              className="slider-arrow prev"
              onClick={prevSlide}
              aria-label="Slide trước"
              type="button"
            >
              ‹
            </button>
            <button
              className="slider-arrow next"
              onClick={nextSlide}
              aria-label="Slide sau"
              type="button"
            >
              ›
            </button>

            {/* Sliding Track */}
            <div
              className="hero-slider-track"
              style={{
                width: `${HERO_SLIDES.length * 100}%`,
                transform: `translateX(-${(currentSlide * 100) / HERO_SLIDES.length}%)`,
              }}
            >
              {HERO_SLIDES.map((slide) => {
                const matched = products.find((p) =>
                  p.name.toLowerCase().includes(slide.productQuery.toLowerCase())
                )
                const productToShow = matched || products[0]
                const imgSrc = productToShow?.image || slide.defaultImage

                return (
                  <div
                    key={slide.id}
                    className="hero-slide-item"
                    style={{
                      width: `${100 / HERO_SLIDES.length}%`,
                      flex: `0 0 ${100 / HERO_SLIDES.length}%`,
                      maxWidth: `${100 / HERO_SLIDES.length}%`,
                    }}
                  >
                    <div className="hero-banner" style={{ background: slide.bgGradient }}>
                      <div className="hero-content">
                        <div className="hero-label">{slide.label}</div>
                        <h1 className="hero-heading">{slide.heading}</h1>
                        <p className="hero-desc">{slide.desc}</p>
                        <button
                          className="hero-btn"
                          onClick={() => setSelectedProduct(productToShow)}
                          type="button"
                        >
                          <span>Khám phá ngay</span>
                          <span>➔</span>
                        </button>
                      </div>

                      <div className="hero-img-wrap">
                        <img
                          src={imgSrc}
                          alt={slide.label}
                          className="hero-img"
                          onError={(e) => {
                            ;(e.target as HTMLImageElement).src = slide.defaultImage
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination Dots */}
            <div className="pagination-dots" aria-label="Danh sách trang banner">
              {HERO_SLIDES.map((slide, idx) => (
                <button
                  key={slide.id}
                  type="button"
                  className={`dot ${currentSlide === idx ? 'active' : ''}`}
                  onClick={() => setCurrentSlide(idx)}
                  aria-label={`Trang ${idx + 1}: ${slide.label}`}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="main-wrapper">
        <div className="section-header">
          <h2 className="section-title">Điện thoại nổi bật</h2>
          <button className="see-all-link" onClick={() => { setActiveTab('all'); setSelectedBrand('All'); setSearchQuery(''); setPriceFilter('all'); setFeatureFilter('all'); setSortOption('default'); }}>
            <span>Xem tất cả</span>
            <span>➔</span>
          </button>
        </div>

        {/* BỘ LỌC VÀ SẮP XẾP SẢN PHẨM THU GỌN (COMPACT FILTER BAR) */}
        <div className="filter-controls-bar compact">
          <div className="filter-row">
            <span className="filter-group-label">Mức giá:</span>
            <div className="filter-chips">
              <button
                type="button"
                className={`filter-chip ${priceFilter === 'all' ? 'active' : ''}`}
                onClick={() => setPriceFilter('all')}
              >
                Tất cả
              </button>
              <button
                type="button"
                className={`filter-chip ${priceFilter === 'under-10' ? 'active' : ''}`}
                onClick={() => setPriceFilter('under-10')}
              >
                Dưới 10tr
              </button>
              <button
                type="button"
                className={`filter-chip ${priceFilter === '10-20' ? 'active' : ''}`}
                onClick={() => setPriceFilter('10-20')}
              >
                10 - 20tr
              </button>
              <button
                type="button"
                className={`filter-chip ${priceFilter === 'above-20' ? 'active' : ''}`}
                onClick={() => setPriceFilter('above-20')}
              >
                Trên 20tr
              </button>
            </div>

            <div className="sort-group ml-auto">
              <label htmlFor="sort-select" className="filter-group-label">Sắp xếp:</label>
              <select
                id="sort-select"
                className="sort-select"
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as any)}
              >
                <option value="default">Phổ biến nhất</option>
                <option value="price-asc">Giá: Thấp → Cao</option>
                <option value="price-desc">Giá: Cao → Thấp</option>
                <option value="rating-desc">Đánh giá cao nhất</option>
              </select>
            </div>
          </div>

          <div className="filter-row secondary">
            <div className="filter-feature-group">
              <span className="filter-group-label">Nhu cầu:</span>
              <div className="filter-chips">
                <button
                  type="button"
                  className={`filter-chip ${featureFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setFeatureFilter('all')}
                >
                  Tất cả
                </button>
                <button
                  type="button"
                  className={`filter-chip ${featureFilter === 'camera' ? 'active' : ''}`}
                  onClick={() => setFeatureFilter('camera')}
                >
                  📸 Chụp ảnh đẹp
                </button>
                <button
                  type="button"
                  className={`filter-chip ${featureFilter === 'battery' ? 'active' : ''}`}
                  onClick={() => setFeatureFilter('battery')}
                >
                  ⚡ Pin trâu
                </button>
                <button
                  type="button"
                  className={`filter-chip ${featureFilter === 'gaming' ? 'active' : ''}`}
                  onClick={() => setFeatureFilter('gaming')}
                >
                  🎮 Chiến game 144Hz
                </button>
                <button
                  type="button"
                  className={`filter-chip ${featureFilter === 'fold' ? 'active' : ''}`}
                  onClick={() => setFeatureFilter('fold')}
                >
                  📱 Màn hình gập
                </button>
              </div>
            </div>

            <div className="filter-actions-inline">
              <span className="filter-count-text">
                <strong>{displayProducts.length}</strong> máy
              </span>
              {(priceFilter !== 'all' || featureFilter !== 'all' || sortOption !== 'default') && (
                <button
                  type="button"
                  className="reset-filter-btn"
                  onClick={() => {
                    setPriceFilter('all')
                    setFeatureFilter('all')
                    setSortOption('default')
                  }}
                  title="Xóa tất cả bộ lọc"
                >
                  ✕ Bỏ lọc
                </button>
              )}
            </div>
          </div>
        </div>

        {error && <p style={{ color: 'var(--accent-red)', marginBottom: 16 }}>⚠️ {error}</p>}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <p>Đang tải danh sách smartphone...</p>
          </div>
        ) : displayProducts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔍</div>
            <h3 style={{ color: 'var(--text-main)', marginBottom: 6 }}>Không tìm thấy sản phẩm phù hợp</h3>
            <p>Hãy thử xóa bớt bộ lọc hoặc bấm "Nhờ AI tư vấn" để BIX gợi ý máy phù hợp nhé!</p>
            <button
              type="button"
              className="hero-btn"
              style={{ marginTop: 16, display: 'inline-flex' }}
              onClick={() => {
                setPriceFilter('all')
                setFeatureFilter('all')
                setSortOption('default')
                setSelectedBrand('All')
                setSearchQuery('')
              }}
            >
              Xem toàn bộ sản phẩm
            </button>
          </div>
        ) : (
          <div className="product-grid">
            {displayProducts.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onViewDetails={(item) => setSelectedProduct(item)}
                onAskAI={handleAskAI}
                onAddToCart={handleAddToCart}
              />
            ))}
          </div>
        )}
      </main>

      {/* KHỐI CAM KẾT DỊCH VỤ & TÍN NHIỆM THƯƠNG HIỆU */}
      <section className="trust-badges-section">
        <div className="trust-grid">
          <div className="trust-card">
            <div className="trust-icon">🛡️</div>
            <div className="trust-content">
              <h4>100% Hàng chính hãng</h4>
              <p>Phân phối ủy quyền, nguyên seal hộp, bảo hành hãng 12 - 24 tháng</p>
            </div>
          </div>
          <div className="trust-card">
            <div className="trust-icon">🔄</div>
            <div className="trust-content">
              <h4>1 Đổi 1 trong 30 ngày</h4>
              <p>Lỗi phần cứng do nhà sản xuất là đổi ngay máy mới tương đương</p>
            </div>
          </div>
          <div className="trust-card">
            <div className="trust-icon">🚚</div>
            <div className="trust-content">
              <h4>Giao hỏa tốc 2 giờ</h4>
              <p>Nội thành nhận hàng trong 2H, miễn phí vận chuyển toàn quốc</p>
            </div>
          </div>
          <div className="trust-card">
            <div className="trust-icon">💳</div>
            <div className="trust-content">
              <h4>Trả góp 0% lãi suất</h4>
              <p>Qua thẻ tín dụng 25 ngân hàng hoặc CCCD gắn chip duyệt online 5 phút</p>
            </div>
          </div>
        </div>
      </section>

      {/* CHÂN TRANG CHUẨN THƯƠNG MẠI ĐIỆN TỬ MOBIX */}
      <footer className="site-footer">
        <div className="footer-top">
          <div className="footer-col brand-col">
            <div className="footer-logo">
              <span className="logo-icon-sm">M</span>
              <span className="footer-brand-title">MOBIX</span>
            </div>
            <p className="footer-slogan">
              Hệ thống bán lẻ smartphone và thiết bị công nghệ hàng đầu, tích hợp trợ lý AI thông minh BIX tư vấn 24/7.
            </p>
            <div className="footer-hotlines">
              <div className="hotline-item">
                <span>Tư vấn mua hàng (Miễn phí):</span>
                <strong>1800.6868 (8:00 - 22:00)</strong>
              </div>
              <div className="hotline-item">
                <span>Bảo hành & Hỗ trợ kỹ thuật:</span>
                <strong>1800.8686 (8:00 - 21:00)</strong>
              </div>
            </div>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">Chính sách bán hàng</h4>
            <ul className="footer-links">
              <li><a href="#track-order" onClick={(e) => { e.preventDefault(); setIsOrderLookupOpen(true); }} style={{ fontWeight: 700, color: 'var(--primary)' }}>📦 Tra cứu tình trạng đơn hàng</a></li>
              <li><a href="#policies" onClick={(e) => { e.preventDefault(); handleAskAI({ name: 'Chính sách bảo hành 1 đổi 1' } as any); }}>Chính sách bảo hành 1 đổi 1</a></li>
              <li><a href="#policies" onClick={(e) => { e.preventDefault(); handleAskAI({ name: 'Chính sách trả góp 0%' } as any); }}>Chính sách trả góp 0% lãi suất</a></li>
              <li><a href="#policies" onClick={(e) => { e.preventDefault(); handleAskAI({ name: 'Chính sách đổi trả và hoàn tiền' } as any); }}>Chính sách đổi trả trong 30 ngày</a></li>
              <li><a href="#policies" onClick={(e) => { e.preventDefault(); handleAskAI({ name: 'Chính sách giao hàng toàn quốc' } as any); }}>Giao hàng hỏa tốc & COD</a></li>
              <li><a href="#policies" onClick={(e) => { e.preventDefault(); handleAskAI({ name: 'Chương trình Thu cũ đổi mới' } as any); }}>Thu cũ đổi mới trợ giá lên đời</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">Hệ thống Showroom</h4>
            <ul className="footer-links addresses">
              <li>📍 <strong>Hà Nội:</strong> 123 Thái Hà, Đống Đa & 54 Cầu Giấy</li>
              <li>📍 <strong>TP.HCM:</strong> 248 Cách Mạng Tháng 8, Q.3 & 142 Nguyễn Thị Minh Khai, Q.1</li>
              <li>📍 <strong>Đà Nẵng:</strong> 88 Nguyễn Văn Linh, Q.Thanh Khê</li>
              <li>⏰ Mở cửa: 8h00 - 22h00 tất cả các ngày trong tuần (kể cả lễ tết)</li>
            </ul>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">Kết nối & Bảo mật</h4>
            <div className="footer-certifications">
              <span className="cert-badge">✓ ĐÃ THÔNG BÁO BỘ CÔNG THƯƠNG</span>
              <span className="cert-badge">🔒 BẢO MẬT SSL 256-BIT</span>
              <span className="cert-badge">🤖 POWERED BY CLOUDFLARE AI</span>
            </div>
            <div className="footer-social-row">
              <span className="social-pill">Facebook</span>
              <span className="social-pill">YouTube</span>
              <span className="social-pill">TikTok</span>
              <span className="social-pill">Zalo OA</span>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© 2026 MOBIX VIETNAM. Tất cả bản quyền được bảo lưu. Thiết kế và vận hành trên nền tảng Cloudflare Edge & AI.</p>
        </div>
      </footer>

      {/* THANH ĐIỀU HƯỚNG CỐ ĐỊNH DƯỚI ĐÁY CHO MOBILE */}
      <nav className="mobile-bottom-nav" aria-label="Thanh điều hướng di động">
        <button
          type="button"
          className="bottom-nav-item active"
          onClick={() => {
            window.scrollTo({ top: 0, behavior: 'smooth' })
            setActiveTab('all')
            setSelectedBrand('All')
          }}
        >
          <span className="nav-icon">🏠</span>
          <span className="nav-label">Trang chủ</span>
        </button>

        <button
          type="button"
          className="bottom-nav-item"
          onClick={() => {
            document.querySelector('.filter-controls-bar')?.scrollIntoView({ behavior: 'smooth' })
          }}
        >
          <span className="nav-icon">🔍</span>
          <span className="nav-label">Bộ lọc</span>
        </button>

        <button
          type="button"
          className="bottom-nav-item"
          onClick={() => setIsCartOpen(true)}
        >
          <span className="nav-icon" style={{ position: 'relative' }}>
            🛒
            {cart.count > 0 && <span className="bottom-cart-badge">{cart.count}</span>}
          </span>
          <span className="nav-label">Giỏ hàng</span>
        </button>

        <button
          type="button"
          className="bottom-nav-item highlight-ai"
          onClick={() => setIsChatOpen(true)}
        >
          <span className="nav-icon">🤖</span>
          <span className="nav-label">BIX AI</span>
        </button>

        <button
          type="button"
          className="bottom-nav-item"
          onClick={() => {
            if (currentUser) {
              handleLogout()
            } else {
              setIsAuthOpen(true)
            }
          }}
        >
          <span className="nav-icon">{currentUser ? '👤' : '🔑'}</span>
          <span className="nav-label">{currentUser ? currentUser.username : 'Tài khoản'}</span>
        </button>
      </nav>

      {/* CHATBOT FLOATING BUBBLE (NÚT ROBOT TRỢ LÝ AI GÓC PHẢI) */}
      <div className="chat-bubble-wrapper">
        <button
          className="chat-bubble-fab"
          onClick={() => setIsChatOpen(!isChatOpen)}
          aria-label="Tư vấn mua hàng AI"
          title="Nhắn tin với trợ lý AI tư vấn"
        >
          <span>{isChatOpen ? '✕' : '🤖'}</span>
          <span className="chat-online-dot" />
        </button>
      </div>

      {/* PRODUCT DETAIL MODAL */}
      <ProductModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={(p) => handleAddToCart(p)}
        onAskAI={handleAskAI}
      />

      {/* CART DRAWER */}
      <CartDrawer
        open={isCartOpen}
        cart={cart}
        user={currentUser}
        onClose={() => setIsCartOpen(false)}
        onUpdateQty={handleUpdateQty}
        onClearCart={handleClearCart}
        onCheckoutSuccess={handleCheckoutClick}
      />

      {/* CHECKOUT MODAL CHUYÊN NGHIỆP THAY CHO ALERT() */}
      <CheckoutModal
        open={isCheckoutOpen}
        cart={cart}
        user={currentUser}
        onClose={() => setIsCheckoutOpen(false)}
        onSuccess={handleCheckoutSuccess}
      />

      {/* AUTHENTICATION MODAL (LOGIN & REGISTER) */}
      <AuthModal
        open={isAuthOpen}
        onClose={() => {
          setIsAuthOpen(false)
          setIsPendingCheckout(false)
        }}
        onSuccess={handleAuthSuccess}
        isCheckoutTrigger={isPendingCheckout}
      />

      {/* CHATBOT DRAWER VỚI LỊCH SỬ CHAT VÀ INITIAL PROMPT */}
      <ChatBot
        open={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        onAddToCart={(p) => {
          handleAddToCart(p)
          setIsChatOpen(false)
        }}
        onViewProductDetails={(p) => {
          setSelectedProduct(p)
          setIsChatOpen(false)
        }}
        initialPrompt={chatInitialPrompt}
        onClearInitialPrompt={() => setChatInitialPrompt(null)}
      />

      {/* MODAL TRA CỨU ĐƠN HÀNG */}
      <OrderLookupModal
        open={isOrderLookupOpen}
        onClose={() => setIsOrderLookupOpen(false)}
        onAskAI={handleAskAIPrompt}
      />
    </>
  )
}
