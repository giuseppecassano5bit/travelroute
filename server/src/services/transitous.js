// Tratte via terra con mezzi pubblici e cambi multipli da Transitous (https://transitous.org),
// istanza pubblica di MOTIS alimentata da dati aperti. Condizioni d'uso: progetto open source e non
// commerciale, poche richieste, User-Agent con contatto, link a transitous.org/sources nel sito.
// Per restare leggeri: cache nel DB, massimo MAX_PARALLEL richieste contemporanee per tutto il server.
import { config } from '../config.js';
import { query } from '../db/index.js';
import { localTimeToUtc } from '../data/timezones.js';
import { distanceKm } from './airports.js';

const API_URL = 'https://api.transitous.org/api/v6/plan';

// Tutti i mezzi pubblici tranne AIRPLANE: Transitous contiene alcuni voli (es. aeroporti sardi) e
// verso un aeroporto proporrebbe giri assurdi via Cagliari. I voli li gestiamo a parte.
const TRANSIT_MODES = [
  'TRAM', 'SUBWAY', 'FERRY', 'BUS', 'COACH', 'RAIL', 'HIGHSPEED_RAIL', 'LONG_DISTANCE', 'NIGHT_RAIL',
  'REGIONAL_FAST_RAIL', 'REGIONAL_RAIL', 'SUBURBAN', 'FUNICULAR', 'AERIAL_LIFT', 'OTHER',
].join(',');

// Con il limite predefinito di 15 minuti a piedi il centro di Karlovo non raggiunge la stazione (1,3 km)
// e non esce nessun risultato: 30 minuti coprono i centri paese e gli aeroporti con stazione vicina.
const MAX_WALK_SECONDS = 1800;
// Gli aeroporti partono già dalla fermata precalcolata (airport-stops.json). Se la ricerca non trova
// comunque nulla e la fermata non è al terminal (o manca, lato luogo dell'utente) la ripetiamo usando come
// partenza/arrivo tutte le fermate entro questo raggio; il tratto a piedi fino alla fermata non è conteggiato.
const FALLBACK_RADIUS_M = 2000;
const CACHE_VERSION = 'v3'; // da cambiare quando cambia la forma o il metodo di calcolo del risultato
const MAX_DURATION_MIN = 12 * 60; // oltre, è quasi sempre un giro senza senso: meglio la stima stradale
const MAX_OPTIONS = 5;
const SEARCH_FROM_HOUR = 6; // ora locale da cui cercare le partenze del giorno scelto
const MAX_PARALLEL = 2;

let active = 0;
const waiting = [];

async function limited(fn) {
  if (active >= MAX_PARALLEL) await new Promise((resolve) => waiting.push(resolve));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    waiting.shift()?.();
  }
}

const minutes = (seconds) => Math.round(seconds / 60);
// km percorsi da un tratto, per le tariffe a fasce: linea d'aria tra le due fermate × 1,2 (binari e strade girano).
const TRACK_FACTOR = 1.2;
const legKm = (l) => (l.from.lat != null && l.to.lat != null
  ? Math.round(distanceKm(l.from, l.to) * TRACK_FACTOR * 10) / 10 : undefined);
const lineOf = (l) => l.routeShortName || l.tripShortName || l.displayName || '';

function simplifyLeg(l, fromName, toName) {
  const name = (p, fallback) => (p.name === 'START' || p.name === 'END' ? fallback : p.name);
  return {
    mode: l.mode,
    from: name(l.from, fromName),
    to: name(l.to, toName),
    start: l.startTime,
    end: l.endTime,
    tz: l.from.tz ?? l.to.tz ?? null,
    durationMin: minutes(l.duration),
    ...(l.mode !== 'WALK' && {
      km: legKm(l),
      line: lineOf(l),
      agency: l.agencyName ?? '',
      headsign: l.headsign ?? '',
    }),
  };
}

function simplify(body, fromName, toName) {
  const options = (body.itineraries ?? [])
    .filter((it) => minutes(it.duration) <= MAX_DURATION_MIN)
    .map((it) => {
      const legs = it.legs.map((l) => simplifyLeg(l, fromName, toName));
      return {
        start: it.startTime,
        end: it.endTime,
        durationMin: minutes(it.duration),
        transfers: it.transfers,
        tz: legs.find((l) => l.tz)?.tz ?? null,
        legs,
      };
    })
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, MAX_OPTIONS);

  // Se la meta è a pochi passi Transitous risponde con un collegamento diretto a piedi.
  const walk = (body.direct ?? []).find((d) => d.legs?.length === 1 && d.legs[0].mode === 'WALK');
  if (!options.length && !walk) return null;
  return { options, walkMin: walk ? minutes(walk.duration) : null };
}

async function fetchPlan(from, to, when, radius) {
  const url = new URL(API_URL);
  url.search = new URLSearchParams({
    fromPlace: `${from.lat},${from.lon}`,
    toPlace: `${to.lat},${to.lon}`,
    time: when.toISOString(),
    transitModes: TRANSIT_MODES,
    maxPreTransitTime: String(MAX_WALK_SECONDS),
    maxPostTransitTime: String(MAX_WALK_SECONDS),
    detailedTransfers: 'false',
    ...(radius && { radius: String(radius) }),
  });
  const res = await limited(() => fetch(url, {
    headers: { 'User-Agent': config.transitous.userAgent, Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  }));
  if (!res.ok) throw Object.assign(new Error(`Transitous ${res.status}`), { status: 502 });
  const result = simplify(await res.json(), from.name, to.name);
  return result && radius ? { ...result, approximate: true } : result;
}

const inFlight = new Map(); // due ricerche uguali in contemporanea fanno una sola richiesta

// Collegamenti con i mezzi pubblici da `from` a `to` nel giorno `date`, cercando dalle 6 del mattino
// (ora locale del punto di partenza). from/to: { name, lat, lon, country, atStop?, approximate? }; per gli
// aeroporti le coordinate sono quelle della fermata precalcolata. Retry con radius solo se nessuno dei due capi
// è una fermata al terminal: lì "nessun risultato" vuol dire davvero nessun collegamento nei dati.
// Restituisce { options: [...], walkMin, approximate? } oppure null se Transitous non trova nulla.
export async function groundConnections(from, to, date) {
  const when = localTimeToUtc(date, SEARCH_FROM_HOUR, from.country);
  const key = `${CACHE_VERSION}|${from.lat.toFixed(3)},${from.lon.toFixed(3)}>${to.lat.toFixed(3)},${to.lon.toFixed(3)}@${when.toISOString()}`;
  const { rows } = await query('SELECT result FROM ground_cache WHERE key = $1 AND expires_at > now()', [key]);
  if (rows.length) return rows[0].result;
  if (inFlight.has(key)) return inFlight.get(key);

  const job = (async () => {
    const retry = !from.atStop && !to.atStop;
    let result = await fetchPlan(from, to, when) ?? (retry ? await fetchPlan(from, to, when, FALLBACK_RADIUS_M) : null);
    if (result && (from.approximate || to.approximate)) result = { ...result, approximate: true };
    await query(
      `INSERT INTO ground_cache (key, result, expires_at) VALUES ($1, $2, now() + make_interval(hours => $3))
       ON CONFLICT (key) DO UPDATE SET result = EXCLUDED.result, fetched_at = now(), expires_at = EXCLUDED.expires_at`,
      [key, result && JSON.stringify(result), config.transitous.cacheHours],
    );
    return result;
  })().finally(() => inFlight.delete(key));
  inFlight.set(key, job);
  return job;
}
