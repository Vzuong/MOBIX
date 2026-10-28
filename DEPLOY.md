# MOBIX — Hệ Thống Bán Lẻ Smartphone Flagship & Gaming

Tài liệu kiến trúc hệ thống và hướng dẫn triển khai ứng dụng thương mại điện tử **MOBIX** lên nền tảng **Cloudflare Workers Edge**.

---

## 1. Kiến trúc hệ thống (Cloudflare Serverless Architecture)

Ứng dụng được xây dựng theo mô hình **Mobile-First** hiện đại, kết hợp trọn vẹn hệ sinh thái Serverless phân tán toàn cầu của Cloudflare:

```
                            [ Trình duyệt / Mobile App ]
                                         │
                    ┌────────────────────┴────────────────────┐
                    │  Cloudflare Workers (Reverse Proxy)     │
                    └────────────────────┬────────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
     [ Static Assets (Frontend) ]                     [ Hono API (Backend) ]
     React 18 + Vite + TypeScript                     Hono Serverless Framework
     (Dist bundle / SPA Routing)                      Routing, Business Logic
                                                                 │
                                ┌────────────────────────────────┴────────────────┐
                                ▼                                                 ▼
                   [ Cloudflare D1 (SQLite) ]                        [ Cloudflare KV (Redis-like) ]
                   - Lưu danh mục Smartphone                         - Lưu phiên giỏ hàng (Cart)
                   - Thông số kỹ thuật (RAM, CPU, Pin)              - TTL 30 ngày tự hủy
                   - Bảng giá, thương hiệu, đánh giá                 - Key: cart:{client_uuid}
```

### Chi tiết các tầng công nghệ:
- **Frontend SPA**: React 18, Vite, TypeScript, Vanilla CSS (Mobile-First, OLED Dark Mode, Glassmorphism, Zero-dependency).
- **Backend Edge**: [Hono](https://hono.dev/) chạy trên Cloudflare Worker với độ trễ phản hồi cực thấp (0ms cold start).
- **Database (D1)**: Cơ sở dữ liệu quan hệ SQLite phân tán (`mobix-db` / `store-db`), lưu trữ bảng `products` với đầy đủ thông số kỹ thuật (Chip, Màn hình, RAM/ROM, Pin, Camera, Kháng nước).
- **Key-Value Cache (KV)**: Lưu trữ tạm thời trạng thái giỏ hàng (`CART`) theo UUID của người dùng, tự động dọn dẹp sau 30 ngày không hoạt động.
- **Trợ lý ảo MOBIX AI**: Tích hợp thuật toán tư vấn smartphone thông minh qua endpoint `/api/chat` (tư vấn theo tầm giá, nhu cầu gaming, camera, pin trâu hoặc thương hiệu).
- **Cloudflare R2** *(Sẵn sàng mở rộng)*: Lưu trữ media hình ảnh chất lượng cao độc lập tương tự AWS S3.

---

## 2. Chuẩn bị môi trường & Chạy Local

### Cài đặt dependencies
Tại thư mục gốc dự án:
```bash
npm install
```

### Khởi tạo Database D1 ở môi trường Local
Tạo bảng và nạp sẵn 12 mẫu smartphone flagship mẫu:
```bash
npm run db:init
```

### Khởi chạy chế độ phát triển (Development Mode)
Chạy đồng thời cả Frontend (port `5173`) và Backend Hono API (port `8787`):
```bash
npm run dev
```
- **Frontend URL**: `http://localhost:5173`
- **Backend API URL**: `http://localhost:8787/api`

---

## 3. Các bước Triển khai (Deploy) lên Cloudflare

### Bước 1: Đăng nhập Cloudflare CLI
Mở terminal ở thư mục gốc và đăng nhập tài khoản Cloudflare:
```bash
npx wrangler login
```

---

### Bước 2: Tạo Cloudflare D1 Database (Remote)
Tạo cơ sở dữ liệu D1 trên Cloudflare:
```bash
npx wrangler d1 create store-db
```
*(Nếu bạn đặt tên khác, ví dụ `mobix-db`, hãy đồng bộ tên trong file `wrangler.toml`)*.

Terminal sẽ trả về thông tin dạng:
```toml
[[d1_databases]]
binding = "DB"
database_name = "store-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```
👉 Hãy copy chuỗi **`database_id`** này.

---

### Bước 3: Tạo Cloudflare KV Namespace (Remote)
Tạo vùng lưu trữ Key-Value cho giỏ hàng:
```bash
npx wrangler kv namespace create CART
```
Terminal sẽ trả về:
```toml
[[kv_namespaces]]
binding = "CART"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```
👉 Hãy copy chuỗi **`id`** này.

---

### Bước 4: Cập nhật cấu hình vào `apps/api/wrangler.toml`
Mở file [apps/api/wrangler.toml](file:///d:/storez/apps/api/wrangler.toml) và điền `database_id` và `id` KV vừa tạo:

```toml
name = "mobix"
main = "src/index.ts"
compatibility_date = "2025-01-01"

[assets]
directory = "../web/dist"
not_found_handling = "single-page-application"
run_worker_first = ["/api/*"]

[[d1_databases]]
binding = "DB"
database_name = "store-db"
database_id = "DÁN_DATABASE_ID_CỦA_BẠN_VÀO_ĐÂY"

[[kv_namespaces]]
binding = "CART"
id = "DÁN_ID_KV_CỦA_BẠN_VÀO_ĐÂY"
```

---

### Bước 5: Khởi tạo bảng dữ liệu và sản phẩm lên Cloudflare Remote
Chạy lệnh khởi tạo cơ sở dữ liệu trên cloud:
```bash
npm run db:init:remote -w apps/api
```

---

### Bước 6: Tiến hành Deploy ứng dụng
Tại thư mục gốc, chỉ cần chạy 1 lệnh duy nhất:
```bash
npm run deploy
```

> **Quy trình tự động hóa:**
> 1. Tự động biên dịch giao diện React + CSS sang thư mục tĩnh tối ưu `apps/web/dist`.
> 2. Đẩy toàn bộ Assets tĩnh và Worker Hono lên mạng lưới Edge toàn cầu của Cloudflare.

Khi hoàn tất, terminal sẽ in ra URL trang web của bạn:
```text
https://mobix.<subdomain-của-bạn>.workers.dev
```

---

## 4. Bảng tổng hợp các lệnh thường dùng

| Lệnh | Ý nghĩa |
| :--- | :--- |
| `npm run dev` | Chạy cả Frontend (`:5173`) và Backend API (`:8787`) ở localhost |
| `npm run db:init` | Khởi tạo bảng & 12 smartphone mẫu cho database D1 ở **local** |
| `npm run db:init:remote` | Khởi tạo bảng & nạp dữ liệu cho D1 trên **Cloudflare Cloud** |
| `npm run build` | Biên dịch bundle frontend React vào `apps/web/dist` |
| `npm run deploy` | Build frontend và deploy toàn bộ hệ thống lên Cloudflare Worker |
| `npm run typecheck` | Kiểm tra toàn bộ lỗi kiểu dữ liệu TypeScript (Frontend & Backend) |

---

## 5. Danh sách API Endpoints

- `GET /api/products` — Lấy danh sách điện thoại (hỗ trợ `?brand=Apple` hoặc `?q=iPhone`).
- `GET /api/cart` — Lấy giỏ hàng chi tiết (kèm thông tin sản phẩm và tổng tiền).
- `POST /api/cart/items` — Thêm sản phẩm vào giỏ (`{ "productId": 1 }`).
- `PUT /api/cart/items/:id` — Cập nhật số lượng (`{ "qty": 2 }`, đặt `<= 0` để xóa).
- `DELETE /api/cart` — Xóa sạch toàn bộ giỏ hàng.
- `POST /api/chat` — Trợ lý ảo AI tư vấn điện thoại (`{ "message": "máy chụp ảnh đẹp dưới 20tr" }`).
