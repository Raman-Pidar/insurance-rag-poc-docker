import { Router } from 'express';
import crypto from 'node:crypto';
import { db } from '../db.js';
import { llm } from '../services/provider.js';
import { searchChunks } from '../services/vectorStore.js';

export const chatRouter = Router();
chatRouter.get('/chats', (_req, res) => res.json(db.prepare('SELECT * FROM chats ORDER BY updated_at DESC').all()));
chatRouter.post('/chats', (req, res) => {
  const id = crypto.randomUUID(); const now = new Date().toISOString();
  db.prepare('INSERT INTO chats (id,title,created_at,updated_at) VALUES (?,?,?,?)').run(id, 'New conversation', now, now);
  res.status(201).json({ id, title: 'New conversation', created_at: now, updated_at: now });
});
chatRouter.get('/chats/:id/messages', (req, res) => {
  const rows = db.prepare('SELECT * FROM messages WHERE chat_id=? ORDER BY created_at ASC').all(req.params.id) as Array<Record<string, unknown>>;
  res.json(rows.map(row => ({ ...row, citations: JSON.parse(String(row.citations || '[]')) })));
});

chatRouter.post('/chats/:id/messages', async (req, res) => {
  const question = String(req.body.message ?? '').trim();
  if (!question) return res.status(400).json({ error: 'Message cannot be empty.' });
  const chat = db.prepare('SELECT id FROM chats WHERE id=?').get(req.params.id);
  if (!chat) return res.status(404).json({ error: 'Conversation not found.' });
  const userId = crypto.randomUUID(); const assistantId = crypto.randomUUID(); const now = new Date().toISOString();
  db.prepare('INSERT INTO messages (id,chat_id,role,content,created_at) VALUES (?,?,?,?,?)').run(userId, req.params.id, 'user', question, now);
  const history = db.prepare(`SELECT role,content FROM messages WHERE chat_id=? ORDER BY created_at DESC LIMIT 8`).all(req.params.id).reverse() as Array<{ role: 'user'|'assistant'; content: string }>;
  res.setHeader('Content-Type', 'text/event-stream'); res.setHeader('Cache-Control', 'no-cache, no-transform'); res.setHeader('Connection', 'keep-alive'); res.flushHeaders();
  const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  try {
    send('status', { message: 'Searching policy documents…' });
    const [queryEmbedding] = await llm.embed([question]);
    const matches = await searchChunks(queryEmbedding, 6);
    // Cosine distance: lower is better. A generous threshold avoids false negatives in a small POC.
    const relevant = matches.filter(item => item.text && item.distance < 0.72);
    const citations = [...new Map(relevant.map(item => [String(item.metadata.documentId), {
      documentId: String(item.metadata.documentId), fileName: String(item.metadata.fileName ?? 'Policy document'),
      productName: String(item.metadata.productName ?? 'Insurance product'), chunkIndex: Number(item.metadata.chunkIndex ?? 0)
    }])).values()];
    const context = relevant.map((item, index) => `[Source ${index + 1}: ${item.metadata.fileName} | Product: ${item.metadata.productName} | Chunk: ${item.metadata.chunkIndex}]\n${item.text}`).join('\n\n---\n\n');
    const system = `You are a careful insurance policy assistant. Answer using ONLY the policy context supplied below. Do not infer coverage, exclusions, premiums, claim outcomes, or waiting periods from general knowledge. If the context does not contain the answer, say you cannot confirm from the available uploaded policy documents and suggest contacting the insurer. Distinguish policy wording from interpretation. Be clear and concise. When you use a source, cite it inline as [Source 1], [Source 2], etc. Never claim a policy guarantees coverage unless the text explicitly says so.\n\nPOLICY CONTEXT:\n${context || 'No relevant policy passages were found.'}`;
    send('citations', citations);
    let answer = '';
    await llm.streamChat([{ role: 'system', content: system }, ...history], token => { answer += token; send('token', { token }); });
    if (!answer.trim()) answer = 'I could not generate an answer. Please try again.';
    db.prepare('INSERT INTO messages (id,chat_id,role,content,citations,created_at) VALUES (?,?,?,?,?,?)').run(assistantId, req.params.id, 'assistant', answer, JSON.stringify(citations), new Date().toISOString());
    db.prepare('UPDATE chats SET title=CASE WHEN title=? THEN ? ELSE title END,updated_at=? WHERE id=?').run('New conversation', question.slice(0, 48), new Date().toISOString(), req.params.id);
    send('done', { messageId: assistantId });
  } catch (error) {
    send('error', { message: error instanceof Error ? error.message : 'Something went wrong.' });
  } finally { res.end(); }
});
