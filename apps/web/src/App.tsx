import { useEffect, useState, useCallback, useRef } from 'react'
import { api, type Cart, type Product, type User } from './api'
import ProductCard from './components/ProductCard'
import ProductModal from './components/ProductModal'
import CartDrawer from './components/CartDrawer'
import ChatBot from './components/ChatBot'
import AuthModal from './components/AuthModal'
import Toast, { type ToastMessage } from './components/Toast'

const NAV_TABS = [
  { id: 'all', label: 'Điện thoại', brand: 'All' },
  { id: 'acc', label: 'Phụ kiện', brand: 'All' },
  { id: 'apple', label: 'iPhone', brand: 'Apple' },
  { id: 'samsung', label: 'Samsung', brand: 'Samsung' },
  { id: 'xiaomi', label: 'Xiaomi', brand: 'Xiaomi' },
  { id: 'oppo', label: 'OPPO', brand: 'OPPO' },
  { id: 'vivo', label: 'vivo', brand: 'Vivo' },
  { id: 'realme', label: 'Realme', brand: 'Realme' },
  { id: 'nokia', label: 'Nokia', brand: 'All' },
  { id: 'more', label: 'Xem thêm ▾', brand: 'All' },
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

  const executeCheckout = (user: User) => {
    alert(
      `🎉 Chúc mừng ${user.username}!\n` +
      `Đơn hàng của bạn đã được ghi nhận vào hệ thống MOBIX.\n` +
      `Nhân viên tư vấn sẽ liên hệ đến số điện thoại ${user.phone} để xác nhận trong 5 phút!`
    )
    api.clear().then(setCart)
    setIsCartOpen(false)
  }

  const handleCheckoutClick = () => {
    if (!currentUser) {
      setIsPendingCheckout(true)
      setIsAuthOpen(true)
      showToast('Vui lòng đăng nhập hoặc tạo tài khoản để hoàn tất đơn hàng!')
      return
    }
    executeCheckout(currentUser)
  }

  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user)
    showToast(`Xin chào ${user.username}! Đăng nhập thành công`)
    if (isPendingCheckout) {
      setIsPendingCheckout(false)
      executeCheckout(user)
    }
  }

  const handleLogout = () => {
    if (window.confirm(`Bạn có chắc chắn muốn đăng xuất khỏi tài khoản: ${currentUser?.username}?`)) {
      api.auth.logout()
      setCurrentUser(null)
      showToast('Đã đăng xuất tài khoản')
    }
  }

  const featuredProduct = products.find((p) => p.name.includes('16 Pro Max')) || products[0]

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
                placeholder="Tìm kiếm điện thoại, phụ kiện, ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="search-clear" onClick={() => setSearchQuery('')}>✕</button>
              )}
            </div>

            {/* RIGHT ACTIONS */}
            <div className="header-actions">
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
                  if (tab.id === 'acc') {
                    showToast('Chuyên mục Phụ kiện đang được cập nhật thêm sản phẩm')
                  } else if (tab.id === 'nokia') {
                    showToast(`Dòng máy ${tab.label} sắp có hàng tại MOBIX`)
                  }
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
          <button className="see-all-link" onClick={() => { setActiveTab('all'); setSelectedBrand('All'); setSearchQuery(''); }}>
            <span>Xem tất cả</span>
            <span>➔</span>
          </button>
        </div>

        {error && <p style={{ color: 'var(--accent-red)', marginBottom: 16 }}>⚠️ {error}</p>}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <p>Đang tải danh sách smartphone...</p>
          </div>
        ) : products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔍</div>
            <h3 style={{ color: 'var(--text-main)', marginBottom: 6 }}>Không tìm thấy sản phẩm phù hợp</h3>
            <p>Hãy thử tìm kiếm từ khóa khác hoặc bấm "Điện thoại" để xem toàn bộ danh mục.</p>
          </div>
        ) : (
          <div className="product-grid">
            {products.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onViewDetails={(item) => setSelectedProduct(item)}
              />
            ))}
          </div>
        )}
      </main>

      {/* CHATBOT FLOATING BUBBLE (BONG BÓNG NHỎ GÓC DƯỚI BÊN PHẢI) */}
      <button
        className="chat-bubble-fab"
        onClick={() => setIsChatOpen(!isChatOpen)}
        aria-label="Tư vấn mua hàng AI"
        title="Nhắn tin với trợ lý AI tư vấn"
      >
        <span>💬</span>
        <span className="chat-online-dot" />
      </button>

      {/* PRODUCT DETAIL MODAL */}
      <ProductModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={(p) => handleAddToCart(p)}
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

      {/* AUTHENTICATION MODAL (LOGIN & REGISTER OPTION A) */}
      <AuthModal
        open={isAuthOpen}
        onClose={() => {
          setIsAuthOpen(false)
          setIsPendingCheckout(false)
        }}
        onSuccess={handleAuthSuccess}
        isCheckoutTrigger={isPendingCheckout}
      />

      {/* CHATBOT DRAWER */}
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
      />
    </>
  )
}
