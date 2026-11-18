import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { z } from 'zod';
import { db } from '../db.js';
import { config } from '../config.js';
import { indexDocument } from '../services/documents.js';

fs.mkdirSync(config.uploadDir, { recursive: true });
const storage = multer.diskStorage({ destination: config.uploadDir, filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`) });
const upload = multer({ storage, limits: { fileSize: config.maxFileSize }, fileFilter: (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  cb(null, ['.pdf', '.docx', '.txt'].includes(ext));
} });
export const adminRouter = Router();

adminRouter.get('/products', (_req, res) => res.json(db.prepare('SELECT * FROM products ORDER BY created_at DESC').all()));
adminRouter.post('/products', (req, res) => {
  const schema = z.object({ name: z.string().trim().min(2), description: z.string().optional().default(''), category: z.string().optional().default('') });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Product name must contain at least 2 characters.' });
  const product = { id: crypto.randomUUID(), ...parsed.data, created_at: new Date().toISOString() };
  db.prepare('INSERT INTO products (id,name,description,category,created_at) VALUES (@id,@name,@description,@category,@created_at)').run(product);
  return res.status(201).json(product);
});
adminRouter.get('/documents', (_req, res) => res.json(db.prepare(`SELECT d.*, p.name AS product_name FROM documents d JOIN products p ON p.id=d.product_id ORDER BY d.created_at DESC`).all()));
adminRouter.post('/documents', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Choose a PDF, DOCX or TXT file.' });
  const productId = String(req.body.productId ?? '');
  const product = db.prepare('SELECT * FROM products WHERE id=?').get(productId) as { id: string; name: string } | undefined;
  if (!product) { fs.unlinkSync(req.file.path); return res.status(400).json({ error: 'Select a valid product before uploading.' }); }
  const documentId = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO documents (id,product_id,original_name,stored_name,mime_type,status,created_at) VALUES (?,?,?,?,?,'processing',?)`)
    .run(documentId, productId, req.file.originalname, req.file.filename, req.file.mimetype, now);
  res.status(202).json({ id: documentId, status: 'processing', message: 'Upload accepted. Indexing has started.' });
  try {
    const count = await indexDocument({ filePath: req.file.path, mimeType: req.file.mimetype, originalName: req.file.originalname, documentId, productId, productName: product.name });
    db.prepare('UPDATE documents SET status=?,chunk_count=? WHERE id=?').run('ready', count, documentId);
  } catch (error) {
    db.prepare('UPDATE documents SET status=?,error=? WHERE id=?').run('failed', error instanceof Error ? error.message : 'Indexing failed', documentId);
  }
});
