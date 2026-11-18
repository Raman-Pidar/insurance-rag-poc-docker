const API = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, init);
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error ?? `Request failed (${response.status})`); }
  return response.json() as Promise<T>;
}
export function streamMessage(chatId: string, message: string, handlers: { onToken: (token: string) => void; onCitations: (citations: Citation[]) => void; onError: (message: string) => void; onDone: () => void; onStatus: (message: string) => void }) {
  return fetch(`${API}/chats/${chatId}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) }).then(async response => {
    if (!response.ok || !response.body) throw new Error('Could not connect to the assistant.');
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n'); buffer = events.pop() ?? '';
      for (const event of events) {
        const lines = event.split('\n'); const type = lines.find(x => x.startsWith('event:'))?.slice(6).trim();
        const dataLine = lines.find(x => x.startsWith('data:'))?.slice(5).trim(); if (!type || !dataLine) continue;
        const data = JSON.parse(dataLine);
        if (type === 'token') handlers.onToken(data.token);
        if (type === 'citations') handlers.onCitations(data);
        if (type === 'status') handlers.onStatus(data.message);
        if (type === 'error') handlers.onError(data.message);
        if (type === 'done') handlers.onDone();
      }
    }
  });
}
export interface Citation { documentId: string; fileName: string; productName: string; chunkIndex: number }
export interface Message { id: string; chat_id: string; role: 'user'|'assistant'; content: string; citations: Citation[] }
export interface Chat { id: string; title: string; updated_at: string }
