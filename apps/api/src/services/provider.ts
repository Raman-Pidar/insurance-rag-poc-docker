import { config } from '../config.js';

// Provider boundary: swap this implementation for Anthropic/Gemini/etc. without changing RAG orchestration.
export interface LlmMessage { role: 'system' | 'user' | 'assistant'; content: string }
export interface LlmProvider {
  embed(texts: string[]): Promise<number[][]>;
  streamChat(messages: LlmMessage[], onToken: (token: string) => void): Promise<void>;
}

export class OpenAICompatibleProvider implements LlmProvider {
  private async request(path: string, body: unknown) {
    const response = await fetch(`${config.llmBaseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(config.llmApiKey ? { Authorization: `Bearer ${config.llmApiKey}` } : {}) },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error(`LLM provider error (${response.status}): ${await response.text()}`);
    return response;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const response = await this.request('/embeddings', { model: config.embeddingModel, input: texts });
    const data = await response.json() as { data: Array<{ embedding: number[]; index: number }> };
    return data.data.sort((a, b) => a.index - b.index).map(item => item.embedding);
  }

  async streamChat(messages: LlmMessage[], onToken: (token: string) => void): Promise<void> {
    const response = await this.request('/chat/completions', { model: config.llmModel, messages, temperature: 0.2, stream: true });
    if (!response.body) throw new Error('LLM provider returned an empty stream');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') return;
        try {
          const parsed = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> };
          const token = parsed.choices?.[0]?.delta?.content;
          if (token) onToken(token);
        } catch { /* Ignore non-JSON SSE keep-alive frames. */ }
      }
    }
  }
}

export const llm: LlmProvider = new OpenAICompatibleProvider();
