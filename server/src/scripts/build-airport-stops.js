// Precalcola, per ogni aeroporto di airports.json, la fermata dei mezzi pubblici da usare come capolinea
// delle tratte via terra:  src/data/airport-stops.json  ← Transitous /api/v1/map/stops
// Le coordinate OurAirports sono il centro della pista, spesso lontano da strade e fermate: partire dalla
// fermata evita la seconda richiesta con radius=2000, e gli aeroporti senza fermate non costano richieste.
// Una richiesta al secondo (~9 minuti per ~520 aeroporti). Da rieseguire ogni tanto: `npm run data:stops`
// (opzionale: `npm run data:stops -- BLQ KRK` per aggiornare solo alcuni aeroporti).
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import { distanceKm } from '../services/airports.js';

const API_URL = 'https://api.transitous.org/api/v1/map/stops';
const SEARCH_M = 2500; // ~30 min a piedi, come maxPreTransitTime nelle ricerche
const DELAY_MS = 1000;
const file = (name) => fileURLToPath(new URL(`../data/${name}`, import.meta.url));

// "Aeroporto" nelle lingue dei paesi coperti: una fermata che si chiama così è quasi sempre al terminal,
// mentre la più vicina al centro pista può essere un paese dall'altra parte delle piste.
const AIRPORT_WORDS = new RegExp([
  'airport', 'aeroport', 'aéroport', 'aeropuerto', 'aeroporto', 'aerodrom', 'flughafen', 'flugplatz',
  'luchthaven', 'lufthavn', 'flygplats', 'lentoasema', 'lotnisko', 'letiště', 'letisko', 'repülőtér',
  'zračna luka', 'zracna luka', 'aerodromas', 'lidosta', 'lennujaam', 'flugvöllur', 'havalimanı',
  'αεροδρόμιο', 'αερολιμένας', 'летище', 'аеродром', 'аэропорт', 'terminal',
].join('|'), 'i');
const RAIL = /RAIL|SUBWAY|SUBURBAN|TRAM|LONG_DISTANCE/;

function pick(airport, stops) {
  const scored = stops
    .filter((s) => s.modes?.some((m) => m !== 'AIRPLANE')) // Transitous contiene anche alcuni voli
    .map((s) => ({ s, m: distanceKm(airport, s) * 1000 }))
    .filter(({ m }) => m <= SEARCH_M)
    .map(({ s, m }) => {
      const atAirport = AIRPORT_WORDS.test(s.name) || s.name.includes(airport.iata);
      // metri "virtuali": il nome con "aeroporto" vale 2 km, una stazione ferroviaria 300 m
      return { s, m, atAirport, score: m - (atAirport ? 2000 : 0) - (s.modes.some((x) => RAIL.test(x)) ? 300 : 0) };
    })
    .sort((a, b) => a.score - b.score);
  if (!scored.length) return null;
  const { s, m, atAirport } = scored[0];
  // atAirport=false: fermata vicina ma non al terminal (es. stazione del paese accanto), il tratto a piedi
  // dal terminal non è conteggiato e il risultato va segnalato come approssimato.
  return {
    name: s.name, lat: +s.lat.toFixed(5), lon: +s.lon.toFixed(5),
    distanceM: Math.round(m), modes: s.modes, atAirport, nearby: scored.length,
  };
}

async function stopsAround(a) {
  const dLat = SEARCH_M / 111_320;
  const dLon = dLat / Math.cos((a.lat * Math.PI) / 180);
  const url = `${API_URL}?min=${a.lat - dLat},${a.lon - dLon}&max=${a.lat + dLat},${a.lon + dLon}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': config.transitous.userAgent, Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Transitous ${res.status}`);
  return res.json();
}

const airports = JSON.parse(await readFile(file('airports.json'), 'utf8'));
const only = process.argv.slice(2).map((c) => c.toUpperCase());
let previous = {};
try { previous = JSON.parse(await readFile(file('airport-stops.json'), 'utf8')).stops; } catch { /* primo giro */ }

const stops = only.length ? { ...previous } : {};
const todo = only.length ? airports.filter((a) => only.includes(a.iata)) : airports;
let failed = 0;
for (const [i, a] of todo.entries()) {
  try {
    const stop = pick(a, await stopsAround(a));
    if (stop) stops[a.iata] = stop;
    else delete stops[a.iata];
    console.log(`${i + 1}/${todo.length} ${a.iata} ${stop ? `→ ${stop.name} (${stop.distanceM} m, ${stop.modes.join('/')})` : '— nessuna fermata'}`);
  } catch (err) {
    failed++;
    if (previous[a.iata]) stops[a.iata] = previous[a.iata]; // meglio il dato vecchio che nessuno
    console.error(`${a.iata}: ${err.message}`);
  }
  await new Promise((r) => setTimeout(r, DELAY_MS));
}

// Una riga per aeroporto: le differenze tra un aggiornamento e l'altro restano leggibili.
const rows = Object.keys(stops).sort().map((k) => `    ${JSON.stringify(k)}: ${JSON.stringify(stops[k])}`);
await writeFile(file('airport-stops.json'), `{
  "source": "Transitous (https://transitous.org/sources/), /api/v1/map/stops",
  "generatedAt": "${new Date().toISOString().slice(0, 10)}",
  "stops": {
${rows.join(',\n')}
  }
}
`);
console.log(`\n${rows.length}/${airports.length} aeroporti con una fermata entro ${SEARCH_M} m; errori: ${failed}`);
if (failed) process.exitCode = 1;
