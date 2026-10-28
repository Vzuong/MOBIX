import { Hono } from 'hono'
import type { Context } from 'hono'
import { extractIntent, scoreAndRankProducts, generateAdvice } from './advisor'

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

export type User = {
  id: number
  username: string
  phone: string
  role: string
  created_at: string
}

type Env = { Bindings: { DB: D1Database; CART: KVNamespace } }
type Line = { productId: number; qty: number }

const app = new Hono<Env>().basePath('/api')

const CART_TTL = 60 * 60 * 24 * 30 // 30 ngày

// Giỏ hàng gắn với cart id do client sinh (lưu ở localStorage)
const cartKey = (c: Context<Env>) => {
  const id = c.req.header('x-cart-id')
  return id && /^[\w-]{8,64}$/.test(id) ? `cart:${id}` : null
}

const readLines = async (c: Context<Env>, key: string) =>
  (await c.env.CART.get<Line[]>(key, 'json')) ?? []

const writeLines = (c: Context<Env>, key: string, lines: Line[]) =>
  c.env.CART.put(key, JSON.stringify(lines), { expirationTtl: CART_TTL })

// Ghép dòng giỏ hàng với thông tin sản phẩm từ D1
const hydrate = async (c: Context<Env>, lines: Line[]) => {
  if (!lines.length) return { items: [], total: 0, count: 0 }
  const marks = lines.map(() => '?').join(',')
  const { results } = await c.env.DB.prepare(`SELECT * FROM products WHERE id IN (${marks})`)
    .bind(...lines.map((l) => l.productId))
    .all<Product>()
  const byId = new Map(results.map((p) => [p.id, p]))
  const items = lines.flatMap((l) => {
    const product = byId.get(l.productId)
    return product ? [{ product, qty: l.qty }] : []
  })
  return {
    items,
    total: items.reduce((s, i) => s + i.product.price * i.qty, 0),
    count: items.reduce((s, i) => s + i.qty, 0),
  }
}

// Lấy danh sách điện thoại (hỗ trợ lọc theo hãng và tìm kiếm từ khoá)
app.get('/products', async (c) => {
  const brand = c.req.query('brand')
  const q = c.req.query('q')?.trim().toLowerCase()

  let sql = 'SELECT * FROM products'
  const params: unknown[] = []
  const conditions: string[] = []

  if (brand && brand !== 'All') {
    conditions.push('LOWER(brand) = LOWER(?)')
    params.push(brand)
  }
  if (q) {
    conditions.push('(LOWER(name) LIKE ? OR LOWER(chip) LIKE ? OR LOWER(description) LIKE ? OR LOWER(tag) LIKE ?)')
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`)
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ')
  }
  sql += ' ORDER BY id ASC'

  const stmt = c.env.DB.prepare(sql)
  const { results } = params.length > 0 ? await stmt.bind(...params).all<Product>() : await stmt.all<Product>()
  c.header('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600')
  return c.json(results)
})

app.get('/cart', async (c) => {
  const key = cartKey(c)
  if (!key) return c.json({ error: 'missing x-cart-id' }, 400)
  return c.json(await hydrate(c, await readLines(c, key)))
})

// Thêm 1 sản phẩm vào giỏ
app.post('/cart/items', async (c) => {
  const key = cartKey(c)
  if (!key) return c.json({ error: 'missing x-cart-id' }, 400)
  const { productId } = await c.req.json<{ productId: number }>()
  const exists = await c.env.DB.prepare('SELECT 1 FROM products WHERE id = ?').bind(productId).first()
  if (!exists) return c.json({ error: 'product not found' }, 404)

  const lines = await readLines(c, key)
  const line = lines.find((l) => l.productId === productId)
  if (line) line.qty += 1
  else lines.push({ productId, qty: 1 })
  await writeLines(c, key, lines)
  return c.json(await hydrate(c, lines))
})

// Đặt số lượng (qty <= 0 thì xóa khỏi giỏ)
app.put('/cart/items/:id', async (c) => {
  const key = cartKey(c)
  if (!key) return c.json({ error: 'missing x-cart-id' }, 400)
  const productId = Number(c.req.param('id'))
  const { qty } = await c.req.json<{ qty: number }>()

  let lines = await readLines(c, key)
  lines = qty > 0
    ? lines.map((l) => (l.productId === productId ? { ...l, qty: Math.min(qty, 99) } : l))
    : lines.filter((l) => l.productId !== productId)
  await writeLines(c, key, lines)
  return c.json(await hydrate(c, lines))
})

// Xóa sạch giỏ hàng
app.delete('/cart', async (c) => {
  const key = cartKey(c)
  if (!key) return c.json({ error: 'missing x-cart-id' }, 400)
  await c.env.CART.delete(key)
  return c.json({ items: [], total: 0, count: 0 })
})

// ============================================================================
// HỆ THỐNG XÁC THỰC TÀI KHOẢN (AUTH API)
// ============================================================================
async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder()
  const data = enc.encode(password + ':mobix_salt_2026')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

function generateToken(userId: number, username: string): string {
  const payload = JSON.stringify({ userId, username, exp: Date.now() + 30 * 24 * 3600 * 1000 })
  const base64 = btoa(encodeURIComponent(payload))
  return `${userId}.${base64}`
}

function verifyToken(authHeader?: string | null): { userId: number; username: string } | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  const token = authHeader.slice(7).trim()
  try {
    const [idStr, base64] = token.split('.')
    if (!idStr || !base64) return null
    const json = decodeURIComponent(atob(base64))
    const payload = JSON.parse(json)
    if (payload.exp && payload.exp < Date.now()) return null
    if (payload.userId !== Number(idStr)) return null
    return { userId: payload.userId, username: payload.username }
  } catch {
    return null
  }
}

// 1. Đăng ký tài khoản mới (username, phone, password)
app.post('/auth/register', async (c) => {
  const { username, phone, password } = await c.req.json<{
    username?: string
    phone?: string
    password?: string
  }>()

  const cleanUser = username?.trim()
  const cleanPhone = phone?.trim()

  if (!cleanUser || cleanUser.length < 3) {
    return c.json({ error: 'Tên tài khoản phải có ít nhất 3 ký tự' }, 400)
  }
  if (!cleanPhone || cleanPhone.length < 9) {
    return c.json({ error: 'Vui lòng nhập số điện thoại nhận hàng hợp lệ (từ 9 - 11 chữ số)' }, 400)
  }
  if (!password || password.length < 6) {
    return c.json({ error: 'Mật khẩu phải có độ dài từ 6 ký tự trở lên' }, 400)
  }

  // Kiểm tra tên tài khoản đã tồn tại chưa
  const existing = await c.env.DB.prepare('SELECT 1 FROM users WHERE LOWER(username) = LOWER(?)')
    .bind(cleanUser)
    .first()
  if (existing) {
    return c.json({ error: 'Tên tài khoản này đã có người đăng ký, vui lòng chọn tên khác' }, 400)
  }

  const passwordHash = await hashPassword(password)
  await c.env.DB.prepare(
    'INSERT INTO users (username, phone, password_hash, role) VALUES (?, ?, ?, ?)'
  )
    .bind(cleanUser, cleanPhone, passwordHash, 'customer')
    .run()

  const user = await c.env.DB.prepare(
    'SELECT id, username, phone, role, created_at FROM users WHERE LOWER(username) = LOWER(?)'
  )
    .bind(cleanUser)
    .first<User>()

  if (!user) {
    return c.json({ error: 'Đăng ký không thành công, vui lòng thử lại' }, 500)
  }

  const token = generateToken(user.id, user.username)
  return c.json({ user, token })
})

// 2. Đăng nhập tài khoản (username, password)
app.post('/auth/login', async (c) => {
  const { username, password } = await c.req.json<{
    username?: string
    password?: string
  }>()

  const cleanUser = username?.trim()
  if (!cleanUser || !password) {
    return c.json({ error: 'Vui lòng nhập đầy đủ tên tài khoản và mật khẩu' }, 400)
  }

  const user = await c.env.DB.prepare(
    'SELECT id, username, phone, password_hash, role, created_at FROM users WHERE LOWER(username) = LOWER(?)'
  )
    .bind(cleanUser)
    .first<User & { password_hash: string }>()

  if (!user) {
    return c.json({ error: 'Tên tài khoản hoặc mật khẩu không chính xác' }, 401)
  }

  const inputHash = await hashPassword(password)
  if (inputHash !== user.password_hash) {
    return c.json({ error: 'Tên tài khoản hoặc mật khẩu không chính xác' }, 401)
  }

  const token = generateToken(user.id, user.username)
  const safeUser: User = {
    id: user.id,
    username: user.username,
    phone: user.phone,
    role: user.role,
    created_at: user.created_at,
  }

  return c.json({ user: safeUser, token })
})

// 3. Lấy thông tin tài khoản hiện tại từ Token
app.get('/auth/me', async (c) => {
  const session = verifyToken(c.req.header('authorization'))
  if (!session) {
    return c.json({ error: 'Chưa đăng nhập hoặc phiên đã hết hạn' }, 401)
  }

  const user = await c.env.DB.prepare(
    'SELECT id, username, phone, role, created_at FROM users WHERE id = ?'
  )
    .bind(session.userId)
    .first<User>()

  if (!user) {
    return c.json({ error: 'Không tìm thấy thông tin tài khoản' }, 404)
  }

  return c.json({ user })
})

// Chatbot thông minh tư vấn chọn điện thoại (BIX AI Advisor)
app.post('/chat', async (c) => {
  const { message } = await c.req.json<{ message?: string }>()
  if (!message || typeof message !== 'string' || message.trim() === '') {
    return c.json({
      reply: 'Chào bạn! Mình là BIX 🤖 - Trợ lý công nghệ AI của MOBIX. Bạn đang tìm mua mẫu điện thoại nào hoặc cần tư vấn tầm giá bao nhiêu ạ?',
      suggestions: [
        'Con máy chụp ảnh ngon nhất?',
        'iPhone với Xiaomi máy nào quay phim tốt hơn?',
        'Máy chơi game tốt nhất trong tầm giá?',
        'Máy gập nào đáng mua?',
      ],
      products: [],
    })
  }

  // Lấy toàn bộ sản phẩm thực tế từ cơ sở dữ liệu D1
  const { results: allProducts } = await c.env.DB.prepare('SELECT * FROM products ORDER BY id ASC').all<Product>()

  // 1. Phân tích ý định & ngân sách
  const intent = extractIntent(message)

  // 2. Chấm điểm & xếp hạng mức độ phù hợp của từng sản phẩm
  const ranked = scoreAndRankProducts(allProducts, intent)

  // 3. Tạo lời khuyên tư vấn thực tế kèm ưu - nhược điểm và danh sách sản phẩm khớp 100%
  const response = generateAdvice(intent, ranked, allProducts)

  return c.json(response)
})

export default app
