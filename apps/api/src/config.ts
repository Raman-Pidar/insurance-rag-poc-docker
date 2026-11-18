import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.resolve(apiDir, '../../.env') });

export const config = {
  port: Number(process.env.PORT ?? 4000),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  databasePath: path.resolve(apiDir, process.env.DATABASE_PATH ?? './data/app.sqlite'),
  uploadDir: path.resolve(apiDir, process.env.UPLOAD_DIR ?? './uploads'),
  maxFileSize: Number(process.env.MAX_FILE_SIZE_MB ?? 20) * 1024 * 1024,
  chromaUrl: process.env.CHROMA_URL ?? 'http://localhost:8000',
  collection: process.env.CHROMA_COLLECTION ?? 'insurance_policy_chunks',
  llmBaseUrl: (process.env.LLM_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, ''),
  llmApiKey: process.env.LLM_API_KEY ?? '',
  llmModel: process.env.LLM_MODEL ?? 'gpt-4o-mini',
  embeddingModel: process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small'
};
