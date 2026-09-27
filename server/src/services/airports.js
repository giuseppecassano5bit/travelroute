import { readFileSync } from 'node:fs';

const airports = JSON.parse(
  readFileSync(new URL('../data/airports.json', import.meta.url), 'utf8'),
);

// Fermata dei mezzi pubblici usata come capolinea di ogni aeroporto (npm run data:stops). Gli aeroporti
// assenti non hanno fermate entro ~2,5 km nei dati Transitous: per loro nessuna richiesta, solo la stima in auto.
const stops = JSON.parse(
  readFileSync(new URL('../data/airport-stops.json', import.meta.url), 'utf8'),
).stops;

export const airportStop = (iata) => stops[iata] ?? null;

export function distanceKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// Aeroporti candidati attorno a un punto. Il raggio è ampio di proposito: uno scalo grande
// a 250 km (es. Napoli da Gravina) spesso ha voli molto più economici di quello più vicino.
// Il ranking vero (costo/tempo della tratta via terra + volo) arriva nella fase 4.
export function candidateAirports(point, { maxKm = 300, limit = 6 } = {}) {
  return airports
    .map((a) => ({ ...a, distanceKm: Math.round(distanceKm(point, a)) }))
    .filter((a) => a.distanceKm <= maxKm)
    .sort((a, b) => (a.distanceKm - (a.large ? 40 : 0)) - (b.distanceKm - (b.large ? 40 : 0)))
    .slice(0, limit);
}
