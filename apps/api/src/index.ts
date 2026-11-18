import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { adminRouter } from './routes/admin.js';
import { chatRouter } from './routes/chat.js';

const app = express();
app.use(cors({ origin: config.webOrigin }));
app.use(express.json({ limit: '1mb' }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'insurance-rag-api' }));
app.use('/api/admin', adminRouter);
app.use('/api', chatRouter);
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
});
app.listen(config.port, () => console.log(`API listening on http://localhost:${config.port}`));
