// Ricerca luoghi sul dataset locale GeoNames: è questa che alimenta il campo di ricerca
// mentre l'utente digita. Nominatim non viene mai chiamato da qui.
import { readFileSync } from 'node:fs';

export const normalize = (s) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/['’`.\-]/g, ' ').replace(/\s+/g, ' ').trim();

const places = JSON.parse(readFileSync(new URL('../data/places.json', import.meta.url), 'utf8'))
  .map(([id, name, region, country, lat, lon, population, altNames]) => ({
    place: { id: `g${id}`, name, region, country, lat, lon },
    population,
    keys: [...new Set([name, ...altNames].map(normalize))], // keys[0] è il nome ufficiale
  }));

const NO_MATCH = 99;

// Nome identico < inizia con il testo < una parola interna inizia con il testo.
// I nomi alternativi (spesso rumorosi: "Bari" è anche un nome di Parigi) pesano meno del nome ufficiale.
function matchRank(keys, q) {
  let best = NO_MATCH;
  keys.forEach((k, i) => {
    const kind = k === q ? 0 : k.startsWith(q) ? 2 : k.includes(` ${q}`) ? 4 : NO_MATCH;
    best = Math.min(best, kind + (i > 0 && kind !== NO_MATCH ? 1 : 0));
  });
  return best;
}

export function searchPlaces(text, { limit = 8 } = {}) {
  const q = normalize(text);
  if (q.length < 2) return [];
  const hits = [];
  for (const p of places) {
    const rank = matchRank(p.keys, q);
    if (rank !== NO_MATCH) hits.push({ rank, p });
  }
  // A parità di corrispondenza vince il luogo più popoloso (il dataset è già ordinato per popolazione).
  return hits
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map(({ p }) => p.place);
}
