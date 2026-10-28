DROP TABLE IF EXISTS products;
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  price INTEGER NOT NULL, -- VND
  original_price INTEGER, -- VND giá niêm yết
  image TEXT NOT NULL,
  chip TEXT NOT NULL,
  screen TEXT NOT NULL,
  ram_rom TEXT NOT NULL,
  battery TEXT NOT NULL,
  rating REAL DEFAULT 5.0,
  tag TEXT DEFAULT '', -- e.g. 'HOT', 'MỚI', 'TRẢ GÓP 0%'
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
