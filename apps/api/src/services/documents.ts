import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import { llm } from './provider.js';
import { upsertChunks } from './vectorStore.js';

export async function extractText(filePath: string, mimeType: string, originalName: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  const ext = path.extname(originalName).toLowerCase();
  if (mimeType === 'application/pdf' || ext === '.pdf') return (await pdf(buffer)).text;
  if (ext === '.docx' || mimeType.includes('wordprocessingml')) return (await mammoth.extractRawText({ buffer })).value;
  if (ext === '.txt' || mimeType.startsWith('text/')) return buffer.toString('utf8');
  throw new Error('Unsupported document type. Upload PDF, DOCX or TXT.');
}

export function chunkText(text: string, size = 1100, overlap = 180): string[] {
  const normalized = text.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(start + size, normalized.length);
    if (end < normalized.length) {
      const boundary = normalized.lastIndexOf(' ', end);
      if (boundary > start + size * 0.65) end = boundary;
    }
    const part = normalized.slice(start, end).trim();
    if (part.length > 40) chunks.push(part);
    if (end >= normalized.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

export async function indexDocument(args: { filePath: string; mimeType: string; originalName: string; documentId: string; productId: string; productName: string }) {
  const text = await extractText(args.filePath, args.mimeType, args.originalName);
  if (text.trim().length < 40) throw new Error('No readable text found in this document. Scanned PDFs need OCR, which is not included in this POC.');
  const chunks = chunkText(text);
  const batchSize = 64;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const embeddings = await llm.embed(batch);
    await upsertChunks(batch.map((chunk, j) => ({
      id: crypto.randomUUID(), text: chunk, embedding: embeddings[j],
      metadata: { documentId: args.documentId, productId: args.productId, productName: args.productName, fileName: args.originalName, chunkIndex: i + j }
    })));
  }
  return chunks.length;
}
