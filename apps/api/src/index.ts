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
  camera: string
  stock: number
  rating: number
  tag: string
  description: string
}

export type Policy = {
  id: number
  title: string
  slug: string
  category: string
  content: string
}

export type User = {
  id: number
  username: string
  phone: string
  role: string
  created_at: string
}

type Env = {
  Bindings: {
    DB: D1Database
    CART: KVNamespace
    AI: Ai
    VECTORIZE: VectorizeIndex
  }
}

type Line = { productId: number; qty: number }

const app = new Hono<Env>().basePath('/api')

// Hàm định dạng tiền VNĐ cho văn bản AI
function formatVndPrice(price: number): string {
  if (price >= 1_000_000) {
    const m = price / 1_000_000
    return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)} triệu`
  }
  return `${(price / 1_000).toFixed(0)}k`
}

// Đồng bộ toàn bộ sản phẩm và chính sách vào Cloudflare Vectorize bằng model BGE-M3
async function syncVectorStore(env: Env['Bindings']) {
  const { results: products } = await env.DB.prepare('SELECT * FROM products ORDER BY id ASC').all<Product>()
  const { results: policies } = await env.DB.prepare('SELECT * FROM policies ORDER BY id ASC').all<Policy>()

  const items: { id: string; text: string; metadata: Record<string, string | number> }[] = []

  for (const p of products) {
    const text = `Sản phẩm ${p.name} thương hiệu ${p.brand}, giá bán ${p.price} VNĐ (${formatVndPrice(p.price)}). ` +
      `Trang bị chip ${p.chip}, màn hình ${p.screen}, RAM và bộ nhớ trong ${p.ram_rom}, dung lượng pin ${p.battery}. ` +
      `Hệ thống camera: ${p.camera || 'Chất lượng cao'}. Tình trạng kho: ${p.stock} máy sẵn có. ` +
      `Đặc điểm: ${p.description}. Nhãn: ${p.tag}. Đánh giá: ${p.rating} sao.`
    items.push({
      id: `prod_${p.id}`,
      text,
      metadata: { type: 'product', productId: p.id, name: p.name, brand: p.brand, price: p.price },
    })
  }

  for (const pol of policies) {
    const text = `Chính sách ${pol.title} (${pol.category}): ${pol.content}`
    items.push({
      id: `policy_${pol.id}`,
      text,
      metadata: { type: 'policy', policyId: pol.id, title: pol.title, category: pol.category },
    })
  }

  if (items.length === 0) {
    return { ok: true, synced: 0 }
  }

  const BATCH_SIZE = 10
  const vectors: VectorizeVector[] = []

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE)
    const texts = chunk.map((c) => c.text)

    const embedRes = (await env.AI.run('@cf/baai/bge-m3', { text: texts })) as { data?: number[][] }
    const embeddings = embedRes.data || []

    for (let j = 0; j < chunk.length; j++) {
      if (embeddings[j] && embeddings[j].length > 0) {
        vectors.push({
          id: chunk[j].id,
          values: embeddings[j],
          metadata: chunk[j].metadata,
        })
      }
    }
  }

  if (vectors.length > 0) {
    await env.VECTORIZE.upsert(vectors)
  }

  return {
    ok: true,
    message: 'Đã đồng bộ toàn bộ dữ liệu vào Cloudflare Vectorize thành công!',
    total_synced: vectors.length,
    products_count: products.length,
    policies_count: policies.length,
    embedding_model: '@cf/baai/bge-m3',
  }
}

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
    conditions.push('(LOWER(name) LIKE ? OR LOWER(chip) LIKE ? OR LOWER(description) LIKE ? OR LOWER(tag) LIKE ? OR LOWER(camera) LIKE ?)')
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`)
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

// Lấy danh sách chính sách bán hàng & hỗ trợ khách hàng
app.get('/policies', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM policies ORDER BY id ASC').all<Policy>()
  c.header('Cache-Control', 'public, max-age=300, s-maxage=600')
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

// ============================================================================
// ĐƠN HÀNG & TRA CỨU ĐƠN HÀNG (ORDERS & ORDER TRACKING)
// ============================================================================

async function ensureOrdersTable(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_code TEXT UNIQUE NOT NULL,
      phone TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      total_amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'Đang xử lý',
      items_json TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run()

  // Kiểm tra có đơn mẫu chưa, nếu chưa thêm 1 đơn mẫu để người dùng thử nghiệm
  const sample = await db.prepare('SELECT 1 FROM orders WHERE order_code = ?').bind('MBX-888999').first()
  if (!sample) {
    const sampleItems = [
      {
        id: 1,
        name: 'iPhone 18 Pro Max 256GB',
        price: 41990000,
        qty: 1,
        image: 'https://eplehuset.no/cdn/shop/files/iPhone_18_Pro_Max_Burgundy_PDP_Image_Position_1__no-NO_47b90b79-4d9e-4cee-91c9-78e8381445e8.png?v=1788993474&width=2200'
      }
    ]
    await db.prepare(`
      INSERT INTO orders (order_code, phone, customer_name, address, city, payment_method, total_amount, status, items_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      'MBX-888999',
      '0988888888',
      'Hoàng Vương',
      'Tòa nhà Landmark 72, Phạm Hùng',
      'Hà Nội',
      'Chuyển khoản VietQR',
      41990000,
      'Đang giao hàng',
      JSON.stringify(sampleItems)
    ).run()
  }
}

// 1. Tạo đơn hàng mới sau khi đặt hàng
app.post('/orders', async (c) => {
  try {
    await ensureOrdersTable(c.env.DB)
    const body = await c.req.json<{
      order_code?: string
      phone?: string
      customer_name?: string
      address?: string
      city?: string
      payment_method?: string
      total_amount?: number
      items?: any[]
    }>()

    const order_code = body.order_code?.trim() || `MBX-${Math.floor(100000 + Math.random() * 900000)}`
    const phone = body.phone?.replace(/[\s.-]/g, '').trim() || ''
    const customer_name = body.customer_name?.trim() || 'Khách hàng'
    const address = body.address?.trim() || ''
    const city = body.city?.trim() || 'Toàn quốc'
    const payment_method = body.payment_method?.trim() || 'Thanh toán khi nhận hàng (COD)'
    const total_amount = body.total_amount || 0
    const items = Array.isArray(body.items) ? body.items : []

    if (!phone) {
      return c.json({ ok: false, error: 'Vui lòng cung cấp số điện thoại nhận hàng' }, 400)
    }

    await c.env.DB.prepare(`
      INSERT INTO orders (order_code, phone, customer_name, address, city, payment_method, total_amount, status, items_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Đang xử lý', ?)
    `).bind(
      order_code,
      phone,
      customer_name,
      address,
      city,
      payment_method,
      total_amount,
      JSON.stringify(items)
    ).run()

    return c.json({
      ok: true,
      order_code,
      order: {
        order_code,
        phone,
        customer_name,
        address,
        city,
        payment_method,
        total_amount,
        status: 'Đang xử lý',
        items
      }
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return c.json({ ok: false, error: `Lỗi lưu đơn hàng: ${msg}` }, 500)
  }
})

// 2. Tra cứu đơn hàng bằng Mã đơn hàng HOẶC Số điện thoại (hoặc cả hai)
app.post('/orders/lookup', async (c) => {
  try {
    await ensureOrdersTable(c.env.DB)
    const body = await c.req.json<{
      order_code?: string
      phone?: string
      query?: string
    }>().catch(() => ({} as any))

    let cleanCode = (body.order_code || '').trim().toUpperCase()
    let cleanPhone = (body.phone || '').replace(/[\s.-]/g, '').trim()
    const query = (body.query || '').trim()

    // Hỗ trợ tìm kiếm thông minh từ 1 ô input duy nhất
    if (query) {
      const qDigits = query.replace(/[\s.-]/g, '')
      if (/^\d{8,11}$/.test(qDigits)) {
        cleanPhone = qDigits
      } else {
        cleanCode = query.toUpperCase()
      }
    }

    if (!cleanCode && !cleanPhone) {
      return c.json({
        ok: false,
        error: 'Vui lòng nhập Mã đơn hàng hoặc Số điện thoại đặt hàng để tra cứu'
      }, 400)
    }

    let rows: any[] = []

    if (cleanCode && cleanPhone) {
      // 1. Ưu tiên tìm khớp cả mã đơn VÀ số điện thoại
      const resBoth = await c.env.DB.prepare(`
        SELECT * FROM orders
        WHERE UPPER(order_code) = ?
          AND (REPLACE(REPLACE(phone, ' ', ''), '.', '') = ? OR phone LIKE ?)
        ORDER BY id DESC LIMIT 10
      `).bind(cleanCode, cleanPhone, `%${cleanPhone.slice(-8)}%`).all<any>()

      rows = resBoth.results || []

      // Nếu không khớp cả hai, kiểm tra theo mã đơn trước
      if (rows.length === 0) {
        const resCode = await c.env.DB.prepare(`
          SELECT * FROM orders WHERE UPPER(order_code) = ? OR UPPER(order_code) = ? ORDER BY id DESC LIMIT 10
        `).bind(cleanCode, cleanCode.startsWith('MBX-') ? cleanCode : `MBX-${cleanCode}`).all<any>()
        rows = resCode.results || []
      }

      // Nếu vẫn không có, kiểm tra theo SĐT
      if (rows.length === 0) {
        const resPhone = await c.env.DB.prepare(`
          SELECT * FROM orders
          WHERE REPLACE(REPLACE(phone, ' ', ''), '.', '') = ?
             OR phone LIKE ?
             OR phone = ?
          ORDER BY id DESC LIMIT 10
        `).bind(cleanPhone, `%${cleanPhone.slice(-8)}%`, cleanPhone).all<any>()
        rows = resPhone.results || []
      }
    } else if (cleanCode) {
      // Chỉ tra cứu theo Mã đơn hàng
      const resCode = await c.env.DB.prepare(`
        SELECT * FROM orders
        WHERE UPPER(order_code) = ?
           OR UPPER(order_code) = ?
           OR UPPER(order_code) LIKE ?
        ORDER BY id DESC LIMIT 10
      `).bind(
        cleanCode,
        cleanCode.startsWith('MBX-') ? cleanCode : `MBX-${cleanCode}`,
        `%${cleanCode}%`
      ).all<any>()
      rows = resCode.results || []
    } else if (cleanPhone) {
      // Chỉ tra cứu theo Số điện thoại
      const resPhone = await c.env.DB.prepare(`
        SELECT * FROM orders
        WHERE REPLACE(REPLACE(phone, ' ', ''), '.', '') = ?
           OR phone LIKE ?
           OR phone = ?
        ORDER BY id DESC LIMIT 10
      `).bind(cleanPhone, `%${cleanPhone.slice(-8)}%`, cleanPhone).all<any>()
      rows = resPhone.results || []
    }

    if (!rows || rows.length === 0) {
      return c.json({
        ok: false,
        error: cleanCode && cleanPhone
          ? 'Không tìm thấy đơn hàng khớp với mã đơn hoặc số điện thoại này. Vui lòng kiểm tra lại!'
          : cleanCode
          ? `Không tìm thấy đơn hàng với mã "${cleanCode}". Vui lòng kiểm tra lại chính xác!`
          : `Không tìm thấy đơn hàng nào gắn với số điện thoại "${cleanPhone}".`
      }, 404)
    }

    const parseOrder = (row: any) => {
      let items = []
      try {
        items = typeof row.items_json === 'string' ? JSON.parse(row.items_json) : (row.items_json || [])
      } catch {}
      return {
        id: row.id,
        order_code: row.order_code,
        phone: row.phone,
        customer_name: row.customer_name,
        address: row.address,
        city: row.city,
        payment_method: row.payment_method,
        total_amount: row.total_amount,
        status: row.status,
        created_at: row.created_at,
        items
      }
    }

    const orders = rows.map(parseOrder)

    return c.json({
      ok: true,
      order: orders[0],
      orders: orders,
      total_found: orders.length
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return c.json({ ok: false, error: `Lỗi tra cứu: ${msg}` }, 500)
  }
})

// API đồng bộ dữ liệu vào Vectorize (có thể gọi từ curl hoặc background)
app.post('/sync-vectors', async (c) => {
  try {
    const res = await syncVectorStore(c.env)
    return c.json(res)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return c.json({ ok: false, error: msg }, 500)
  }
})

app.get('/sync-vectors', async (c) => {
  try {
    const res = await syncVectorStore(c.env)
    return c.json(res)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return c.json({ ok: false, error: msg }, 500)
  }
})

// Bộ nhớ tạm trong isolate Worker để tránh query CSDL D1 lặp lại liên tục
let memoryProducts: Product[] | null = null
let memoryProductsTime = 0
async function getCachedProducts(db: D1Database): Promise<Product[]> {
  const now = Date.now()
  if (memoryProducts && now - memoryProductsTime < 300_000) {
    return memoryProducts
  }
  const { results } = await db.prepare('SELECT * FROM products ORDER BY id ASC').all<Product>()
  memoryProducts = results || []
  memoryProductsTime = now
  return memoryProducts
}

// Phản hồi siêu tốc (< 15ms) cho các câu hỏi gợi ý phổ biến và câu hỏi thường gặp với phong cách dí dỏm, duyên dáng
function getInstantSuggestionReply(query: string, allProducts: Product[]): { reply: string; suggestions: string[]; products: Product[] } | null {
  const q = query.trim().toLowerCase().replace(/[?.,!]/g, '')

  // Nếu câu hỏi có chứa ngân sách cụ thể (VD: 15 triệu, dưới 10tr, 20 củ...) hoặc hãng cụ thể,
  // cần chuyển sang phân tích động để gợi ý máy chính xác theo tầm tiền khách yêu cầu
  const hasSpecificFilter = /\d+\s*(?:tr|triệu|củ|m)|\b(dưới|khoảng|tầm giá)\s*\d+/i.test(q)

  // 1. Chụp ảnh ngon nhất / camera đỉnh nhất (chỉ áp dụng khi hỏi chung chung, không kèm tầm tiền riêng)
  if (!hasSpecificFilter && q.includes('chụp ảnh') && (q.includes('ngon') || q.includes('đỉnh') || q.includes('đẹp') || q.includes('nhất'))) {
    const x300 = allProducts.find((p) => p.name.includes('X300 Ultra')) || allProducts[0]
    const mi17 = allProducts.find((p) => p.name.includes('Xiaomi 17 Ultra')) || allProducts[1]
    const ip18 = allProducts.find((p) => p.name.includes('iPhone 18 Pro Max')) || allProducts[2]
    return {
      reply: `Dạ em BIX chào anh/chị nha! Nếu để bình chọn "hoa hậu nhiếp ảnh" tại MOBIX thì cuộc chiến này gắt lắm á, nhưng em xin đề cử 3 siêu phẩm đáng đồng tiền bát gạo nhất nè:\n\n` +
        `1. **${x300.name} (${formatVndPrice(x300.price)}):** Cụm camera ZEISS chụp chân dung da dẻ trắng hồng tự nhiên không cần qua 7749 filter app, zoom xa nét căng đi concert "đu idol" là khỏi bàn cãi!\n` +
        `2. **${mi17.name} (${formatVndPrice(mi17.price)}):** Cảm biến khổng lồ 1 inch phối hợp thấu kính Leica huyền thoại, nước ảnh sâu hoắm mang chất điện ảnh vintage cực nghệ!\n` +
        `3. **${ip18.name} (${formatVndPrice(ip18.price)}):** Chân ái cho tín đồ quay video/TikTok, màu sắc chân thực và chống rung mượt như đặt trên gimbal.\n\n` +
        `Anh/chị thường thích chụp chân dung người thân hay phong cảnh du lịch hơn để em tư vấn màu hợp phong thủy cho mình nhé ạ! ✨`,
      suggestions: [
        'So sánh vivo X300 Ultra với Xiaomi 17 Ultra',
        'iPhone 18 Pro Max giá bao nhiêu?',
        'Chính sách trả góp 0%',
      ],
      products: [x300, mi17, ip18].filter(Boolean),
    }
  }

  // 2. Chơi game đỉnh nhất / chiến game 144hz
  if (!hasSpecificFilter && (q.includes('chơi game') || q.includes('chiến game') || q.includes('game đỉnh') || q.includes('cày game') || q.includes('144hz'))) {
    const rog = allProducts.find((p) => p.name.includes('ROG Phone 8 Pro')) || allProducts[0]
    const mi17t = allProducts.find((p) => p.name.includes('Xiaomi 17T Pro')) || allProducts[1]
    return {
      reply: `Dạ em chào anh/chị! Muốn combat mượt như lụa, leo rank không lo máy biến thành "vỉ nướng" thì nghía ngay 2 chiến thần này bên em nha:\n\n` +
        `1. **${rog.name} (${formatVndPrice(rog.price)}):** "Quái vật làng game" với màn hình 165Hz siêu tốc, tản nhiệt buồng hơi mát rượi, bấm chiêu là lụm mạng liền tay!\n` +
        `2. **${mi17t.name} (${formatVndPrice(mi17t.price)}):** Màn AMOLED 144Hz, chip Dimensity 9500 siêu khỏe, pin khủng 7000mAh cày game xuyên màn đêm mà giá hạt dẻ hơn nhiều.\n\n` +
        `Anh/chị hay chiến Liên Quân, PUBG hay Genshin Impact để em mách mức setting đồ họa mượt mà nhất nhé! 🎮`,
      suggestions: [
        'ASUS ROG Phone 8 Pro có sẵn hàng không?',
        'Xiaomi 17T Pro pin dùng được mấy tiếng?',
        'Chính sách bảo hành 1 đổi 1',
      ],
      products: [rog, mi17t].filter(Boolean),
    }
  }

  // 3. Chính sách trả góp 0%
  if (q.includes('trả góp') || q.includes('góp 0%') || q.includes('mua góp')) {
    return {
      reply: `Dạ em BIX xin báo tin mừng là chính sách trả góp 0% tại MOBIX siêu dễ thở luôn anh/chị ơi! 💳\n\n` +
        `• **Thủ tục thần tốc:** Chỉ cần CCCD gắn chip (hoặc thẻ tín dụng), duyệt hồ sơ online trong 5 - 10 phút là rinh máy về ngay.\n` +
        `• **Lãi suất 0%:** Chia nhỏ tiền máy ra mỗi tháng chỉ bằng vài ly trà sữa hay bữa ăn sáng, không lo "đau ví"!\n` +
        `• **Kỳ hạn linh hoạt:** Tùy chọn 3, 6, 9 hoặc 12 tháng.\n` +
        `• **Trả trước siêu mềm:** Trả trước từ 0đ hoặc 20 - 30% tùy nhu cầu.\n\n` +
        `Anh/chị đang ngắm chiếc máy nào để em tính thử số tiền góp mỗi tháng hạt dẻ cho mình nha! 😊`,
      suggestions: [
        'Con máy chụp ảnh ngon nhất?',
        'Máy nào chơi game đỉnh nhất?',
        'Chính sách bảo hành 1 đổi 1',
      ],
      products: [],
    }
  }

  // 4. Chính sách bảo hành 1 đổi 1
  if (q.includes('bảo hành') || q.includes('1 đổi 1') || q.includes('đổi mới')) {
    return {
      reply: `Dạ khách yêu yên tâm tuyệt đối khi mua sắm tại MOBIX nhé ạ! Quyền lợi của khách là ưu tiên số 1 bên em: 🛡️\n\n` +
        `• **Bao xài 1 đổi 1 trong 30 ngày:** Máy có bất kỳ lỗi phần cứng nào từ nhà sản xuất là bên em đổi ngay máy mới toanh nguyên seal, không sửa chữa chắp vá!\n` +
        `• **Bảo hành chính hãng 12 - 24 tháng:** Bảo hành toàn diện nguồn, màn hình tại tất cả TTBH chính hãng Apple, Samsung, Xiaomi... trên toàn quốc.\n` +
        `• **Hỗ trợ máy dùng tạm:** Trong thời gian gửi hãng kiểm tra, bên em cấp luôn máy khác cho anh/chị xài đỡ gián đoạn công việc.\n\n` +
        `Anh/chị cần em hỗ trợ kiểm tra thông tin hoặc bảo hành cho máy nào không ạ?`,
      suggestions: [
        'Chính sách trả góp 0%',
        'Hotline hỗ trợ 1800 6933',
        'Xem điện thoại hot hôm nay',
      ],
      products: [],
    }
  }

  // 5. Máy gập nào đáng mua?
  if (q.includes('máy gập') || q.includes('màn hình gập') || q.includes('điện thoại gập') || q.includes('fold')) {
    const fold8 = allProducts.find((p) => p.name.includes('Fold8')) || allProducts[0]
    const flip6 = allProducts.find((p) => p.name.includes('Flip6')) || allProducts[1]
    const duo = allProducts.find((p) => p.name.includes('iPhone Duo')) || allProducts[2]
    return {
      reply: `Dạ chào anh/chị! Dòng màn hình gập năm nay công nghệ đỉnh cao lắm rồi ạ, mở ra gập vào bao phê, toát thần thái "chủ tịch" liền: ✨\n\n` +
        `1. **${fold8.name} (${formatVndPrice(fold8.price)}):** Mở ra như máy tính bảng 7.6 inch, chia đôi màn hình vừa xem chứng khoán vừa họp việc, bút S Pen ký tài liệu siêu tiện.\n` +
        `2. **${flip6.name} (${formatVndPrice(flip6.price)}):** Gập vỏ sò nhỏ xinh như hộp phấn, bỏ túi áo gọn hơ, gập 90 độ đặt lên bàn tự chụp ảnh quay TikTok không cần chân tripod!\n` +
        `3. **${duo.name} (${formatVndPrice(duo.price)}):** Siêu phẩm gập đầu tiên của Apple, khung titan siêu mỏng nhẹ và đẳng cấp.\n\n` +
        `Anh/chị thích kiểu gập ngang mở rộng như cuốn sổ hay kiểu gập dọc nhỏ gọn bỏ túi áo ạ?`,
      suggestions: [
        'Samsung Galaxy Z Fold8 giá bao nhiêu?',
        'Samsung Galaxy Z Flip6 có màu gì?',
        'Chính sách trả góp 0%',
      ],
      products: [fold8, flip6, duo].filter(Boolean),
    }
  }

  // 6. iPhone với Xiaomi máy nào quay phim tốt hơn?
  if (q.includes('iphone') && q.includes('xiaomi') && q.includes('quay phim')) {
    const ip18 = allProducts.find((p) => p.name.includes('iPhone 18 Pro Max')) || allProducts[0]
    const mi17 = allProducts.find((p) => p.name.includes('Xiaomi 17 Ultra')) || allProducts[1]
    return {
      reply: `Dạ em tư vấn thật lòng không thiên vị bên nào nè anh/chị: 🎬\n\n` +
        `• **Về quay phim:** **${ip18.name}** vẫn là "bá vương" không đối thủ! Chống rung mượt mà như dùng gimbal, màu da tự nhiên và quan trọng là tải lên Facebook/TikTok không bao giờ bị giảm chất lượng.\n` +
        `• **Về chụp ảnh tĩnh:** **${mi17.name}** lại có phần nhỉnh hơn nhờ thấu kính Leica và cảm biến 1 inch, chụp chân dung hay phong cảnh xóa phông có chiều sâu điện ảnh rất cuốn.\n\n` +
        `Nếu anh/chị mua máy để làm vlog, quay video sáng tạo nội dung thì chốt ngay iPhone, còn thích mê chụp ảnh nghệ thuật thì Xiaomi 17 Ultra là chân ái ạ! Anh/chị nghiêng về nhu cầu nào hơn ạ?`,
      suggestions: [
        'iPhone 18 Pro Max giá bao nhiêu?',
        'Xiaomi 17 Ultra giá bao nhiêu?',
        'Chính sách trả góp 0%',
      ],
      products: [ip18, mi17].filter(Boolean),
    }
  }

  return null
}

// Chatbot thông minh tư vấn chọn điện thoại (BIX AI Advisor - Tối ưu phản hồi nhanh & dí dỏm)
app.post('/chat', async (c) => {
  const { message } = await c.req.json<{ message?: string }>().catch(() => ({ message: '' }))
  if (!message || typeof message !== 'string' || message.trim() === '') {
    return c.json({
      reply: 'Dạ em chào anh/chị! Em là **BIX** 🤖 - Chuyên viên tư vấn điện thoại tại MOBIX.\nAnh/chị đang cần tìm máy chụp ảnh sống ảo siêu nét, cày game mượt mà màn 144Hz, pin trâu hay cần tìm trong tầm ngân sách bao nhiêu để em mách nước ngay cho mình nhé!',
      suggestions: [
        'Con máy chụp ảnh ngon nhất?',
        'iPhone với Xiaomi máy nào quay phim tốt hơn?',
        'Máy chơi game tốt nhất trong tầm giá?',
        'Máy gập nào đáng mua?',
        'Chính sách trả góp 0%',
      ],
      products: [],
    })
  }

  const userQuery = message.trim()

  // 1. Lấy danh sách sản phẩm từ Cache bộ nhớ (0ms, không tốn thời gian truy vấn D1)
  const allProducts = await getCachedProducts(c.env.DB)
  const intent = extractIntent(userQuery)

  // 0. Xử lý tra cứu đơn hàng trực tiếp trong chat nếu người dùng hỏi
  const orderCodeMatch = userQuery.match(/MBX-?\d{5,8}/i)
  const phonePatternMatch = userQuery.match(/(?:(?:\+84|0)[3|5|7|8|9]\d{8})/i)
  const isOrderQuery = /đơn hàng|tra cứu đơn|kiểm tra đơn|tình trạng đơn/i.test(userQuery)

  if (orderCodeMatch || (isOrderQuery && phonePatternMatch)) {
    try {
      await ensureOrdersTable(c.env.DB)
      let foundOrder: any = null
      if (orderCodeMatch) {
        let code = orderCodeMatch[0].toUpperCase()
        if (!code.startsWith('MBX-') && code.startsWith('MBX')) code = 'MBX-' + code.slice(3)
        foundOrder = await c.env.DB.prepare('SELECT * FROM orders WHERE UPPER(order_code) = ?').bind(code).first()
      }
      if (!foundOrder && phonePatternMatch) {
        const ph = phonePatternMatch[0]
        foundOrder = await c.env.DB.prepare('SELECT * FROM orders WHERE phone LIKE ? ORDER BY id DESC LIMIT 1').bind(`%${ph.slice(-8)}%`).first()
      }

      if (foundOrder) {
        let items: any[] = []
        try { items = JSON.parse(foundOrder.items_json) } catch {}
        const itemsList = items.map((it: any) => `${it.name} (x${it.qty})`).join(', ') || 'Kiện hàng MOBIX'
        const formattedTotal = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(foundOrder.total_amount)
        return c.json({
          reply: `Dạ BIX đã kiểm tra đơn hàng **${foundOrder.order_code}** của khách hàng **${foundOrder.customer_name}** ạ:\n\n` +
                 `📦 **Trạng thái:** ${foundOrder.status}\n` +
                 `📱 **Sản phẩm:** ${itemsList}\n` +
                 `📍 **Địa chỉ nhận:** ${foundOrder.address}, ${foundOrder.city}\n` +
                 `💰 **Tổng thanh toán:** ${formattedTotal}\n\n` +
                 `Bạn cũng có thể xem toàn bộ lộ trình giao hàng trực quan tại nút **📦 Tra cứu đơn** ở góc trên trang web nhé!`,
          suggestions: [
            'Hotline miễn phí 1800 6933',
            'Chính sách bảo hành 1 đổi 1',
            'Xem điện thoại hot hôm nay',
          ],
          products: [],
        })
      }
    } catch {}
  }

  // 0. Phản hồi siêu tốc tức thì (< 15ms) cho các câu hỏi gợi ý phổ biến (Tránh gọi LLM nặng)
  const instantSuggestion = getInstantSuggestionReply(userQuery, allProducts)
  if (instantSuggestion) {
    return c.json(instantSuggestion)
  }

  // 0. Xử lý câu hỏi về danh tính AI (tên, model, phiên bản)
  if (intent.isIdentity) {
    return c.json({
      reply: 'Dạ em là **BIX** 🤖 - Chuyên viên tư vấn công nghệ kiêm "tay săn deal smartphone" khét tiếng tại MOBIX nè anh/chị! Em được huấn luyện trên nền tảng Cloudflare Workers AI với kho dữ liệu máy thực tế từ shop. Anh/chị cần tìm máy chụp ảnh sống ảo, chiến game mượt như bôi bơ hay thủ tục trả góp 0% thì cứ để em lo hết nha!',
      suggestions: [
        'Con máy chụp ảnh ngon nhất?',
        'Máy nào chơi game đỉnh nhất?',
        'Chính sách trả góp 0%',
        'Chính sách bảo hành 1 đổi 1',
      ],
      products: [],
    })
  }

  // 0. Xử lý câu hỏi ngoài phạm vi (bên thứ ba, toán học, chuyện phiếm)
  if (intent.isOutOfScope) {
    return c.json({
      reply: 'Dạ anh/chị ơi, em là chuyên viên tư vấn điện thoại tại MOBIX nên vụ này nằm ngoài "vùng phủ sóng" của em rồi ạ! 😅 Nếu anh/chị cần tìm smartphone xịn sò, cày game mượt hay chính sách trả góp 0% tại shop thì em bao nhiệt tình hỗ trợ mình liền nhé!',
      suggestions: [
        'Con máy chụp ảnh ngon nhất?',
        'Máy nào chơi game đỉnh nhất?',
        'Chính sách trả góp 0%',
        'Chính sách bảo hành 1 đổi 1',
      ],
      products: [],
    })
  }

  try {
    let matchedProducts: Product[] = []
    let matchedPolicies: Policy[] = []

    const hasSpecificIntent =
      intent.wantsPhoto ||
      intent.wantsVideo ||
      intent.wantsGaming ||
      intent.wantsBattery ||
      intent.wantsFoldable ||
      intent.maxBudget !== undefined ||
      intent.isGeneralBest ||
      intent.isSuperlative ||
      intent.brandPreference !== undefined ||
      intent.specificModel !== undefined ||
      intent.isComparison

    // FAST-BYPASS SIÊU TỐC: Nếu khách đã nêu rõ nhu cầu (giá, ảnh, game, pin...), thuật toán chuyên gia
    // xử lý ngay trong < 1ms từ RAM, mang lại câu trả lời dí dỏm, chuẩn giá và phản hồi tức thì (< 15ms)
    if (hasSpecificIntent) {
      const ranked = scoreAndRankProducts(allProducts, intent)
      const adviceRes = generateAdvice(intent, ranked, allProducts)
      return c.json(adviceRes)
    } else if (intent.isPolicy) {
      // Tìm chính sách cụ thể từ D1 nếu hỏi về bảo hành/trả góp
      let polCategory = ''
      const qLow = userQuery.toLowerCase()
      if (qLow.includes('trả góp')) polCategory = 'installment'
      else if (qLow.includes('bảo hành') || qLow.includes('1 đổi 1')) polCategory = 'warranty'
      else if (qLow.includes('giao hàng') || qLow.includes('ship')) polCategory = 'shipping'
      else if (qLow.includes('đổi trả')) polCategory = 'returns'
      else if (qLow.includes('thu cũ') || qLow.includes('lên đời')) polCategory = 'trade-in'
      else if (qLow.includes('thanh toán') || qLow.includes('cod')) polCategory = 'payment'

      if (polCategory) {
        const { results: specificPolicies } = await c.env.DB.prepare('SELECT * FROM policies WHERE category = ?')
          .bind(polCategory)
          .all<Policy>()
        matchedPolicies = specificPolicies
      } else {
        const { results: allPols } = await c.env.DB.prepare('SELECT * FROM policies LIMIT 5').all<Policy>()
        matchedPolicies = allPols
      }
    } else {
      // Nếu là câu hỏi tự do không khớp mẫu: Gọi mô hình Vectorize tìm kiếm ngữ nghĩa
      const queryEmbed = (await c.env.AI.run('@cf/baai/bge-m3', { text: [userQuery] })) as { data?: number[][] }
      const queryVector = queryEmbed.data?.[0]

      if (queryVector && queryVector.length > 0) {
        let searchRes = await c.env.VECTORIZE.query(queryVector, {
          topK: 4,
          returnMetadata: 'all',
        })

        const prodIds = searchRes.matches
          .filter((m) => m.id.startsWith('prod_'))
          .map((m) => Number(m.id.replace('prod_', '')))
          .filter((id) => !isNaN(id))

        if (prodIds.length > 0) {
          const prodMap = new Map(allProducts.map((p) => [p.id, p]))
          matchedProducts = prodIds.flatMap((id: number) => {
            const p = prodMap.get(id)
            return p ? [p] : []
          }).slice(0, 3)
        }
      }

      if (matchedProducts.length === 0) {
        const ranked = scoreAndRankProducts(allProducts, intent)
        matchedProducts = ranked.slice(0, 3).map((r) => r.product)
      }
    }

    // Giới hạn tối đa 3 sản phẩm đắt giá nhất
    matchedProducts = matchedProducts.slice(0, 3)

    // 3. Xây dựng ngữ cảnh RAG cho Model LLM
    let contextText = ''
    if (matchedProducts.length > 0) {
      contextText += '=== SẢN PHẨM PHÙ HỢP TỪ KHO HÀNG MOBIX ===\n'
      for (const p of matchedProducts) {
        contextText +=
          `- ${p.name} (${p.brand}) - Giá: ${formatVndPrice(p.price)}\n` +
          `  + Cấu hình: ${p.chip}, Màn hình: ${p.screen}\n` +
          `  + Camera: ${p.camera}\n` +
          `  + Pin: ${p.battery}\n` +
          `  + Điểm nổi bật: ${p.description}\n\n`
      }
    }

    if (matchedPolicies.length > 0) {
      contextText += '=== CHÍNH SÁCH MOBIX ===\n'
      for (const pol of matchedPolicies) {
        contextText += `- ${pol.title}: ${pol.content}\n`
      }
    }

    const systemPrompt = `Bạn là BIX 🤖 - Chuyên viên tư vấn smartphone "vừa am hiểu công nghệ, vừa dí dỏm duyên dáng" tại hệ thống MOBIX (https://mobix.vn).

PHONG CÁCH TƯ VẤN (BẮT BUỘC):
- Xưng "em", gọi khách là "anh/chị" hoặc "bạn". Giọng điệu hào hứng, lễ phép, tươi vui, nói chuyện tự nhiên và có nét dí dỏm thông minh (không sến súa, không cộc cằn).
- Tuyệt đối cấm xưng "tôi", cấm nói giọng robot hay các câu mở đầu rập khuôn kiểu: "Dựa trên dữ liệu...", "Bạn đang tìm kiếm một chiếc điện thoại...".
- Mở đầu thẳng thắn, hào hứng và duyên dáng, ví dụ:
  + "Dạ em chào anh/chị! Kèo này thơm nha, để em mách nước mấy chiếc máy chân ái đúng gu mình nè:"
  + "Dạ em BIX chào anh/chị! Tìm máy chiến game mà không ngắm mấy em này là hơi tiếc đó nha:"
  + "Dạ em chào anh/chị! Tầm tiền này chọn máy chụp ảnh thì bên em có ngay 2 'hoa hậu nhiếp ảnh' cực cháy:"
- Sử dụng lối ví von công nghệ hài hước, đời thường:
  + Camera: "chụp chân dung da dẻ hồng hào không cần 7749 filter app", "zoom xa bắt trọn idol ở concert", "quay video mượt như đặt trên gimbal".
  + Game & cấu hình: "combat mượt như bôi bơ", "fps đứng im như tượng, không lo nóng máy thành vỉ nướng".
  + Pin: "pin trâu cày từ sáng đến tối mịt, lướt TikTok mỏi cả tay vẫn chưa hết pin".
  + Giá & trả góp: "mỗi tháng góp nhẹ nhàng chỉ bằng vài ly trà sữa là có flagship lướt bao sang".
  + Máy gập: "mở ra toát thần thái chủ tịch, gập lại nhét túi quần gọn hơ".
- LUÔN KÈM GIÁ BÁN cụ thể (triệu đồng) ngay cạnh tên máy, ví dụ: "1. vivo X300 Ultra 5G (35.9 triệu)".
- TỐI ĐA 2 ĐẾN 3 MÁY PHÙ HỢP NHẤT. Mỗi máy chỉ 1-2 câu điểm nhấn đắt giá, KHÔNG viết dài dòng lê thê.
- KHÔNG đọc chép mã cảm biến khô khan (như Sony IMX, LYT-900, khẩu độ f/1.6...).
- Kết thúc bằng một câu hỏi gợi mở duyên dáng, vui vẻ.`

    const userPrompt = `[DỮ LIỆU SẢN PHẨM & CHÍNH SÁCH THỰC TẾ]:\n${
      contextText || 'Kho hàng MOBIX đầy đủ các mẫu smartphone flagship và tầm trung.'
    }\n\n[CÂU HỎI CỦA KHÁCH HÀNG]:\n${userQuery}\n\n[YÊU CẦU]: Trả lời thật dí dỏm, tự nhiên, súc tích (khoảng 150-200 từ), nêu bật ưu điểm thực tế kèm giá bán.`

    // 4. Gọi Model LLM (ưu tiên Llama 3.1 8B tốc độ siêu nhanh ~0.6s, fallback 70B Fast và 3.2 3B)
    let aiReply = ''
    try {
      const aiChatRes = (await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct' as any, {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 320,
        temperature: 0.65,
      })) as { response?: string }
      aiReply = aiChatRes.response || ''
    } catch {
      try {
        const fallbackChatRes = (await c.env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast' as any, {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 320,
          temperature: 0.65,
        })) as { response?: string }
        aiReply = fallbackChatRes.response || ''
      } catch {
        const fallbackChatRes = (await c.env.AI.run('@cf/meta/llama-3.2-3b-instruct' as any, {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 300,
          temperature: 0.6,
        })) as { response?: string }
        aiReply = fallbackChatRes.response || ''
      }
    }

    const reply =
      aiReply ||
      'Chào bạn! Mình có thể hỗ trợ tư vấn chi tiết về cấu hình, camera hoặc chính sách trả góp của các dòng máy tại MOBIX ạ.'

    // Lọc ra danh sách các máy THỰC SỰ được AI đề cập và tư vấn trong câu trả lời
    let finalProducts: Product[] = []
    if (!intent.isPolicy) {
      const replyLower = reply.toLowerCase()
      const mentioned: { product: Product; index: number }[] = []

      // Tìm trong danh sách sản phẩm ứng viên
      for (const p of matchedProducts) {
        const fullName = p.name.toLowerCase()
        let pos = replyLower.indexOf(fullName)

        if (pos === -1) {
          // Bỏ bớt thông số phụ: 5G, ram/rom...
          const cleanName = fullName
            .replace(/\b(5g|16gb\/512gb|12gb\/256gb|8gb\/128gb|256gb|128gb|512gb)\b/gi, '')
            .replace(/\s+/g, ' ')
            .trim()
          pos = replyLower.indexOf(cleanName)
        }

        if (pos === -1) {
          // Từ khoá model chính (ví dụ: "rog phone 8", "gt8 pro", "17 ultra", "x300 ultra", "s26 ultra")
          const brand = p.brand.toLowerCase()
          const modelPart = fullName
            .replace(brand, '')
            .replace(/\b(5g|16gb\/512gb|12gb\/256gb|8gb\/128gb|256gb|128gb|512gb)\b/gi, '')
            .trim()
          const keyTokens = modelPart.split(/\s+/).slice(0, 2).join(' ')
          if (keyTokens.length >= 3 && replyLower.includes(keyTokens)) {
            pos = replyLower.indexOf(keyTokens)
          }
        }

        if (pos !== -1) {
          mentioned.push({ product: p, index: pos })
        }
      }

      // Sắp xếp đúng theo thứ tự AI đã nhắc tới trong bài viết
      mentioned.sort((a, b) => a.index - b.index)

      // Nếu tìm thấy máy được AI nhắc, CHỈ giữ đúng các máy đó!
      if (mentioned.length > 0) {
        finalProducts = mentioned.map((m) => m.product)
      } else {
        // Nếu AI không nhắc đến sản phẩm nào (từ chối, câu hỏi ngoài lề, kiến thức chung) -> KHÔNG HIỆN THẺ SẢN PHẨM NÀO!
        finalProducts = []
      }
    }

    const suggestions: string[] = []
    if (finalProducts.length > 0) {
      suggestions.push(`${finalProducts[0].name} có hàng không?`)
      if (finalProducts.length > 1) {
        suggestions.push(`So sánh ${finalProducts[0].name} với ${finalProducts[1].name}`)
      }
    } else {
      suggestions.push('Con máy chụp ảnh ngon nhất?', 'Máy nào chơi game đỉnh nhất?')
    }
    suggestions.push('Chính sách trả góp 0%', 'Chính sách bảo hành 1 đổi 1')

    return c.json({
      reply,
      suggestions: suggestions.slice(0, 4),
      products: finalProducts,
    })
  } catch (aiError) {
    console.error('Lỗi khi gọi Workers AI (chuyển sang fallback an toàn):', aiError)
    // Fallback an toàn đảm bảo hệ thống không bao giờ gặp lỗi 500
    const ranked = scoreAndRankProducts(allProducts, intent)
    const fallbackResponse = generateAdvice(intent, ranked, allProducts)
    return c.json(fallbackResponse)
  }
})

export default app
