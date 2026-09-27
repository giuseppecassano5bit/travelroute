// Fallback Nominatim per i luoghi assenti dal dataset locale.
// Policy OSM: niente autocomplete, max 1 richiesta/s per tutto il sito, User-Agent con contatto,
// risultati in cache. Viene chiamato solo quando l'utente preme esplicitamente "Cerca su OpenStreetMap".
import { config } from '../config.js';
import { query } from '../db/index.js';
import { normalize } from './places.js';
import { EUROPE_COUNTRIES } from '../data/countries.js';

let queue = Promise.resolve();

function throttled(fn) {
  const run = queue.then(fn);
  queue = run.catch(() => {}).then(() => new Promise((r) => setTimeout(r, 1100)));
  return run;
}

async function fetchNominatim(text) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.search = new URLSearchParams({
    q: text, format: 'jsonv2', limit: '5', addressdetails: '1', 'accept-language': 'it',
    countrycodes: [...EUROPE_COUNTRIES].join(',').toLowerCase(),
  });
  const res = await fetch(url, { headers: { 'User-Agent': config.nominatimUserAgent } });
  if (!res.ok) throw Object.assign(new Error('Servizio di geocoding non disponibile, riprova più tardi'), { status: 502 });
  return (await res.json()).map((p) => ({
    id: `n${p.osm_type?.[0] ?? ''}${p.osm_id}`,
    name: p.address?.city ?? p.address?.town ?? p.address?.village ?? p.address?.hamlet ?? p.name,
    region: p.address?.state ?? p.address?.county ?? '',
    country: p.address?.country_code?.toUpperCase() ?? '',
    lat: +(+p.lat).toFixed(4),
    lon: +(+p.lon).toFixed(4),
    label: p.display_name,
  }));
}

// Ogni testo viene chiesto a Nominatim al massimo una volta: poi si legge dal database.
export async function resolvePlace(text) {
  const key = normalize(text);
  const { rows: [cached] } = await query('SELECT results FROM geocode_cache WHERE query_key = $1', [key]);
  if (cached) return cached.results;

  const results = await throttled(() => fetchNominatim(text));
  await query(
    `INSERT INTO geocode_cache (query_key, results) VALUES ($1, $2)
     ON CONFLICT (query_key) DO NOTHING`,
    [key, JSON.stringify(results)],
  );
  return results;
}
