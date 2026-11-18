import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });
export const db = new Database(config.databasePath);
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS products (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT '', category TEXT DEFAULT '', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS documents (
 id TEXT PRIMARY KEY, product_id TEXT NOT NULL, original_name TEXT NOT NULL, stored_name TEXT NOT NULL,
 mime_type TEXT NOT NULL, status TEXT NOT NULL, chunk_count INTEGER DEFAULT 0, error TEXT,
 created_at TEXT NOT NULL, FOREIGN KEY(product_id) REFERENCES products(id)
);
CREATE TABLE IF NOT EXISTS chats (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
 id TEXT PRIMARY KEY, chat_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL,
 citations TEXT DEFAULT '[]', created_at TEXT NOT NULL, FOREIGN KEY(chat_id) REFERENCES chats(id)
);
`);
