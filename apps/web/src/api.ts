export type Product = {
  id: number
  name: string
  brand: string
  price: number
  original_price: number | null
  image: string
  chip: string
  screen: string
  ram_rom: string
  battery: string
  rating: number
  tag: string
  description: string
}

export type CartItem = {
  product: Product
  qty: number
}

export type Cart = {
  items: CartItem[]
  total: number
  count: number
}

export type User = {
  id: number
  username: string
  phone: string
  role?: string
}

export type ChatMessage = {
  id: string
  sender: 'user' | 'bot'
  text: string
  time: string
  suggestions?: string[]
  products?: Product[]
}

const cartId = (() => {
  try {
    let id = localStorage.getItem('mobix_cart_id')
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem('mobix_cart_id', id)
    }
    return id
  } catch {
    return crypto.randomUUID()
  }
})()

const getStoredToken = () => {
  try {
    return localStorage.getItem('mobix_token')
  } catch {
    return null
  }
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getStoredToken()
  const customHeaders: Record<string, string> = {
    'content-type': 'application/json',
    'x-cart-id': cartId,
  }
  if (token) {
    customHeaders['authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      ...customHeaders,
      ...(init.headers || {}),
    },
  })
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}))
    throw new Error(errorBody.error || `${res.status} ${res.statusText}`)
  }
  return res.json()
}

const productCache = new Map<string, { data: Product[]; time: number }>()

export const api = {
  products: async (params?: { brand?: string; q?: string }) => {
    const query = new URLSearchParams()
    if (params?.brand && params.brand !== 'All') query.set('brand', params.brand)
    if (params?.q) query.set('q', params.q)
    const qs = query.toString()
    const cacheKey = `mobix_prod_${qs || 'all'}`

    // 1. Thử lấy từ Memory Cache (0ms)
    const mem = productCache.get(cacheKey)
    if (mem && Date.now() - mem.time < 120_000) {
      return mem.data
    }

    // 2. Thử lấy từ SessionStorage (0ms, giúp tải tức thì khi mở lại trang)
    try {
      const stored = sessionStorage.getItem(cacheKey)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.data && Date.now() - parsed.time < 300_000) {
          productCache.set(cacheKey, parsed)
          return parsed.data as Product[]
        }
      }
    } catch {
      // Bỏ qua lỗi sessionStorage nếu bị chặn
    }

    // 3. Tải từ API và lưu vào cache
    const data = await req<Product[]>(`/products${qs ? `?${qs}` : ''}`)
    productCache.set(cacheKey, { data, time: Date.now() })
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify({ data, time: Date.now() }))
    } catch {}
    return data
  },
  cart: () => req<Cart>('/cart'),
  add: (productId: number) =>
    req<Cart>('/cart/items', { method: 'POST', body: JSON.stringify({ productId }) }),
  setQty: (productId: number, qty: number) =>
    req<Cart>(`/cart/items/${productId}`, { method: 'PUT', body: JSON.stringify({ qty }) }),
  clear: () => req<Cart>('/cart', { method: 'DELETE' }),
  chat: (message: string) =>
    req<{ reply: string; suggestions?: string[]; products?: Product[] }>('/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
  auth: {
    register: async (data: { username: string; phone: string; password: string }) => {
      const res = await req<{ user: User; token: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      try {
        localStorage.setItem('mobix_token', res.token)
        localStorage.setItem('mobix_user', JSON.stringify(res.user))
      } catch {}
      return res
    },
    login: async (data: { username: string; password: string }) => {
      const res = await req<{ user: User; token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      try {
        localStorage.setItem('mobix_token', res.token)
        localStorage.setItem('mobix_user', JSON.stringify(res.user))
      } catch {}
      return res
    },
    me: async () => {
      return req<{ user: User }>('/auth/me')
    },
    logout: () => {
      try {
        localStorage.removeItem('mobix_token')
        localStorage.removeItem('mobix_user')
      } catch {}
    },
    getStoredUser: (): User | null => {
      try {
        const u = localStorage.getItem('mobix_user')
        return u ? JSON.parse(u) : null
      } catch {
        return null
      }
    },
  },
}

export const vnd = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n)

export const formatCompactVnd = (n: number) => {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)} triệu`
  }
  return `${(n / 1000).toFixed(0)}k`
}
