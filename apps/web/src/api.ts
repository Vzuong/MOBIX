export type Product = { id: number; name: string; description: string; price: number; image: string }
export type Cart = { items: { product: Product; qty: number }[]; total: number; count: number }

const cartId = (() => {
  try {
    let id = localStorage.getItem('cart-id')
    if (!id) localStorage.setItem('cart-id', (id = crypto.randomUUID()))
    return id
  } catch {
    return crypto.randomUUID()
  }
})()

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', 'x-cart-id': cartId },
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

export const api = {
  products: () => req<Product[]>('/products'),
  cart: () => req<Cart>('/cart'),
  add: (productId: number) =>
    req<Cart>('/cart/items', { method: 'POST', body: JSON.stringify({ productId }) }),
  setQty: (productId: number, qty: number) =>
    req<Cart>(`/cart/items/${productId}`, { method: 'PUT', body: JSON.stringify({ qty }) }),
  clear: () => req<Cart>('/cart', { method: 'DELETE' }),
}

export const vnd = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n)
