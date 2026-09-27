import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { config } from './config.js';
import { initDb } from './db/index.js';
import { api } from './routes/api.js';

await initDb();

const app = express();
app.set('trust proxy', 1); // Render sta dietro un proxy: serve per req.ip corretto
app.use(helmet());
app.use(cors({ origin: config.corsOrigin, exposedHeaders: ['X-Searches-Remaining'] }));
app.use(express.json({ limit: '20kb' }));

// Usato anche dal frontend per "svegliare" Render al caricamento della pagina (cold start ~1 min).
app.get('/health', (_req, res) => res.json({ ok: true }));

// Anti-flood per IP, in memoria: protegge solo da raffiche. Le quote vere stanno nel DB (searchQuota).
app.use('/api', rateLimit({ windowMs: 60_000, limit: 120 }), api);

app.use((err, _req, res, _next) => {
  const status = err.status ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 && status !== 502 ? 'Errore interno' : err.message });
});

app.listen(config.port, () => console.log(`API su http://localhost:${config.port}`));
