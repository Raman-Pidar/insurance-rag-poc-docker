import { ChromaClient } from 'chromadb';
import { config } from '../config.js';

const client = new ChromaClient({ path: config.chromaUrl });
let collectionPromise: ReturnType<ChromaClient['getOrCreateCollection']> | undefined;
const collection = () => collectionPromise ??= client.getOrCreateCollection({ name: config.collection, metadata: { 'hnsw:space': 'cosine' } });

export async function upsertChunks(items: Array<{ id: string; text: string; embedding: number[]; metadata: Record<string, string | number> }>) {
  const col = await collection();
  await col.upsert({ ids: items.map(x => x.id), documents: items.map(x => x.text), embeddings: items.map(x => x.embedding), metadatas: items.map(x => x.metadata) });
}

export async function searchChunks(embedding: number[], limit = 5) {
  const col = await collection();
  const result = await col.query({ queryEmbeddings: [embedding], nResults: limit });
  return (result.ids[0] ?? []).map((id, index) => ({
    id,
    text: result.documents?.[0]?.[index] ?? '',
    metadata: (result.metadatas?.[0]?.[index] ?? {}) as Record<string, string | number>,
    distance: result.distances?.[0]?.[index] ?? 1
  }));
}
