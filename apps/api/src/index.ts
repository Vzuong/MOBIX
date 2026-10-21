import { Hono } from 'hono'
import type { Context } from 'hono'

type Env = { Bindings: { DB: D1Database; CART: KVNamespace } }
type Line = { productId: number; qty: number }
type Product = { id: number; name: string; description: string; price: number; image: string }

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

app.get('/products', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM products ORDER BY id').all<Product>()
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

app.delete('/cart', async (c) => {
  const key = cartKey(c)
  if (!key) return c.json({ error: 'missing x-cart-id' }, 400)
  await c.env.CART.delete(key)
  return c.json({ items: [], total: 0, count: 0 })
})

export default app
