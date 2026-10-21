import { useEffect, useState } from 'react'
import { api, vnd, type Cart, type Product } from './api'

const emptyCart: Cart = { items: [], total: 0, count: 0 }

export default function App() {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<Cart>(emptyCart)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([api.products(), api.cart()])
      .then(([p, c]) => {
        setProducts(p)
        setCart(c)
      })
      .catch((e) => setError(e.message))
  }, [])

  const run = (p: Promise<Cart>) => p.then(setCart).catch((e) => setError(e.message))

  return (
    <>
      <header className="topbar">
        <h1>🛍️ Store</h1>
        <button className="cart-btn" onClick={() => setOpen(true)} aria-label="Mở giỏ hàng">
          🛒
          {cart.count > 0 && <span className="badge">{cart.count}</span>}
        </button>
      </header>

      <main>
        {error && <p className="error">Lỗi: {error}</p>}
        <div className="grid">
          {products.map((p) => (
            <article className="card" key={p.id}>
              <img src={p.image} alt={p.name} loading="lazy" />
              <div className="card-body">
                <h2>{p.name}</h2>
                <p className="desc">{p.description}</p>
                <div className="card-foot">
                  <strong>{vnd(p.price)}</strong>
                  <button onClick={() => run(api.add(p.id))}>Thêm</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>

      {open && <div className="overlay" onClick={() => setOpen(false)} />}
      <aside className={`drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
        <div className="drawer-head">
          <h2>Giỏ hàng ({cart.count})</h2>
          <button className="ghost" onClick={() => setOpen(false)} aria-label="Đóng">✕</button>
        </div>

        <div className="drawer-body">
          {cart.items.length === 0 && <p className="empty">Giỏ hàng trống</p>}
          {cart.items.map(({ product: p, qty }) => (
            <div className="line" key={p.id}>
              <img src={p.image} alt="" />
              <div className="line-info">
                <span className="line-name">{p.name}</span>
                <span className="line-price">{vnd(p.price)}</span>
                <div className="qty">
                  <button onClick={() => run(api.setQty(p.id, qty - 1))}>−</button>
                  <span>{qty}</span>
                  <button onClick={() => run(api.setQty(p.id, qty + 1))}>+</button>
                </div>
              </div>
              <button className="ghost" onClick={() => run(api.setQty(p.id, 0))} aria-label="Xóa">🗑</button>
            </div>
          ))}
        </div>

        <div className="drawer-foot">
          <div className="total">
            <span>Tổng cộng</span>
            <strong>{vnd(cart.total)}</strong>
          </div>
          <button className="primary" disabled={!cart.count} onClick={() => alert('Demo: chưa có thanh toán 🙂')}>
            Thanh toán
          </button>
          <button className="ghost" disabled={!cart.count} onClick={() => run(api.clear())}>
            Xóa giỏ hàng
          </button>
        </div>
      </aside>
    </>
  )
}
