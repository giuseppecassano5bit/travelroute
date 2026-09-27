// Limite giornaliero di ricerche per IP, salvato nel database (sopravvive ai riavvii del server).
// Non ci sono account: nel DB finisce solo un hash troncato dell'IP, mai l'indirizzo in chiaro.
import { createHash } from 'node:crypto';
import { config } from '../config.js';
import { query } from '../db/index.js';

const ipSubject = (ip) =>
  `ip:${createHash('sha256').update(`${config.ipHashSecret}:${ip ?? ''}`).digest('hex').slice(0, 24)}`;

export async function searchQuota(req, res, next) {
  const limit = config.dailySearchLimit;

  // Incremento atomico: due richieste simultanee non possono leggere lo stesso contatore.
  const { rows: [usage] } = await query(
    `INSERT INTO search_usage (subject, day, count) VALUES ($1, CURRENT_DATE, 1)
     ON CONFLICT (subject, day) DO UPDATE SET count = search_usage.count + 1
     RETURNING count`,
    [ipSubject(req.ip)],
  );
  res.set('X-Searches-Remaining', String(Math.max(0, limit - usage.count)));
  if (usage.count > limit) {
    return res.status(429).json({
      error: `Hai usato le ${limit} ricerche disponibili per oggi. Riprova domani: il limite serve a non `
        + 'sovraccaricare i servizi gratuiti di orari che il sito usa.',
    });
  }
  next();
}
