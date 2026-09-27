import { API_URL, SLOW_REQUEST_MS } from './config.js';

// Ascoltatori dello stato "richiesta lenta": il server gratuito di Render dorme dopo 15 minuti
// di inattività e la prima richiesta può impiegare circa un minuto.
const slowListeners = new Set();
let pending = 0;
let slowTimer;

export function onSlowChange(fn) {
  slowListeners.add(fn);
  return () => slowListeners.delete(fn);
}

const emitSlow = (slow) => slowListeners.forEach((fn) => fn(slow));

function track(promise) {
  if (pending++ === 0) slowTimer = setTimeout(() => emitSlow(true), SLOW_REQUEST_MS);
  return promise.finally(() => {
    if (--pending === 0) { clearTimeout(slowTimer); emitSlow(false); }
  });
}

// tracked=false: richieste che possono essere lente per motivi propri, senza avviso di cold start.
async function request(path, { method = 'GET', body, signal, tracked = true } = {}) {
  const call = fetch(`${API_URL}${path}`, {
    method,
    signal,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const res = await (tracked ? track(call) : call);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Errore ${res.status}`);
  return data;
}

export const api = {
  wake: () => request('/health'),
  searchPlaces: (q, signal) => request(`/api/places?q=${encodeURIComponent(q)}`, { signal }),
  resolvePlace: (q) => request('/api/places/resolve', { method: 'POST', body: { q } }),
  // La ricerca interroga Transitous e può richiedere qualche secondo anche a server sveglio:
  // l'avviso di cold start lo gestisce già wake() al caricamento della pagina.
  search: (body) => request('/api/search', { method: 'POST', body, tracked: false }),
};
