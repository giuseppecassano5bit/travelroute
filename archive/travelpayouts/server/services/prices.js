// Prezzi indicativi dalla Data API di Travelpayouts/Aviasales (cache delle ricerche fatte dagli
// utenti Aviasales nelle ultime 48 ore). Non sono prezzi in tempo reale: il frontend li mostra
// sempre con il disclaimer "Prezzo indicativo". Il token non lascia mai il server.
import { config } from '../config.js';
import { query } from '../db/index.js';

const API_URL = 'https://api.travelpayouts.com/aviasales/v3/prices_for_dates';
const CURRENCY = 'eur';
const MAX_PARALLEL = 4; // prices_for_dates ammette 600 richieste/minuto: restiamo molto sotto

export const pricesEnabled = () => Boolean(config.travelpayouts.token);

// Una sola chiamata per tratta e mese: con one_way=true l'API raggruppa per data e restituisce
// il biglietto più economico di ogni giorno, così abbiamo sia il prezzo del giorno scelto sia il minimo del mese.
async function fetchMonth(origin, destination, month) {
  const url = new URL(API_URL);
  url.search = new URLSearchParams({
    origin, destination, departure_at: month, one_way: 'true', direct: 'false',
    sorting: 'price', currency: CURRENCY, limit: '31', page: '1',
  });
  const res = await fetch(url, {
    headers: { 'X-Access-Token': config.travelpayouts.token, 'Accept-Encoding': 'gzip, deflate' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw Object.assign(new Error(`Travelpayouts ${res.status}`), { status: 502 });
  const body = await res.json();
  if (!body.success) throw Object.assign(new Error(`Travelpayouts: ${body.error}`), { status: 502 });
  const days = (body.data ?? []).map((t) => ({
    date: t.departure_at.slice(0, 10), // data locale di partenza (l'orario include già il fuso)
    price: t.price,
    transfers: t.transfers,
    airline: t.airline,
    durationMin: t.duration_to ?? t.duration,
  }));
  return days.length ? days : null;
}

const inFlight = new Map(); // evita chiamate doppie se due utenti chiedono la stessa tratta insieme

async function monthPrices(origin, destination, month) {
  const key = `${origin}-${destination}-${month}`;
  const { rows } = await query(
    `SELECT result FROM price_cache
     WHERE origin = $1 AND destination = $2 AND month = $3 AND currency = $4 AND expires_at > now()`,
    [origin, destination, month, CURRENCY],
  );
  if (rows.length) return rows[0].result;
  if (inFlight.has(key)) return inFlight.get(key);

  const job = (async () => {
    const result = await fetchMonth(origin, destination, month);
    await query(
      `INSERT INTO price_cache (origin, destination, month, currency, result, expires_at)
       VALUES ($1, $2, $3, $4, $5, now() + make_interval(hours => $6))
       ON CONFLICT (origin, destination, month, currency)
       DO UPDATE SET result = EXCLUDED.result, fetched_at = now(), expires_at = EXCLUDED.expires_at`,
      [origin, destination, month, CURRENCY, result && JSON.stringify(result), config.travelpayouts.cacheHours],
    );
    return result;
  })().finally(() => inFlight.delete(key));
  inFlight.set(key, job);
  return job;
}

// pairs: [{ from: 'BRI', to: 'VNO' }, ...] → { 'BRI-VNO': { onDate, monthMin } | null }
export async function pricesForPairs(pairs, date) {
  const month = date.slice(0, 7);
  const out = {};
  const queue = [...pairs];
  async function worker() {
    for (let p = queue.shift(); p; p = queue.shift()) {
      const key = `${p.from}-${p.to}`;
      try {
        const days = await monthPrices(p.from, p.to, month);
        if (!days) { out[key] = null; continue; }
        const onDate = days.find((d) => d.date === date) ?? null;
        const monthMin = days.reduce((min, d) => (d.price < min.price ? d : min));
        out[key] = { onDate, monthMin };
      } catch (err) {
        console.error(`Prezzi ${key}:`, err.message);
        out[key] = { error: true }; // un errore su una tratta non blocca le altre
      }
    }
  }
  await Promise.all(Array.from({ length: MAX_PARALLEL }, worker));
  return { currency: CURRENCY.toUpperCase(), month, prices: out };
}
