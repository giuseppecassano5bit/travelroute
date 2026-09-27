// Individua gli aeroporti candidati ai due capi del viaggio e, per i più vicini, calcola la tratta via terra
// con i mezzi pubblici (Transitous). Per gli altri, e quando Transitous non trova nulla, resta la stima stradale.
import { config } from '../config.js';
import { airportStop, candidateAirports, distanceKm } from './airports.js';
import { AIRPORT_AFTER_MIN, AIRPORT_BEFORE_MIN, rankPairs } from './ranking.js';
import { airportLinkPart, airportLinks, placeAccess } from './known-links.js';
import { groundConnections } from './transitous.js';
import { addFares, carFare, taxiFare, transitFare, ZERO } from './fares.js';

const ROAD_FACTOR = 1.3; // distanza stradale ≈ 1,3 × linea d'aria (stima grezza, dichiarata come tale)
const AVG_KMH = 70;

function withGroundEstimate(airport) {
  const roadKm = Math.round(airport.distanceKm * ROAD_FACTOR);
  return {
    ...airport,
    ground: {
      estimated: true, roadKm, driveMin: Math.round((roadKm / AVG_KMH) * 60),
      fare: carFare(roadKm), taxi: taxiFare(roadKm, airport.country),
    },
  };
}

// Capolinea della tratta: la fermata precalcolata, non il centro pista di OurAirports (irraggiungibile a piedi).
// atStop: la fermata è al terminal, quindi se Transitous non trova nulla non serve riprovare con radius.
// Se invece è la stazione del paese accanto il tratto a piedi dal terminal non è conteggiato (approximate).
function airportPlace(a, stop) {
  return {
    name: a.name, lat: stop.lat, lon: stop.lon, country: a.country,
    atStop: stop.atAirport, approximate: !stop.atAirport,
  };
}

// Il tratto luogo ↔ nodo (es. Bari Centrale) prima o dopo una tratta nota: Transitous (una richiesta in più,
// in cache) oppure un'altra tratta nota se il luogo è a piedi dal suo capolinea. Vince il più rapido.
async function hubAccess(place, hub, side, date) {
  const options = [];
  const [from, to] = side === 'from' ? [place, hub] : [hub, place];
  try {
    const t = await groundConnections(from, to, date);
    const best = t?.options.reduce((x, y) => (y.durationMin < x.durationMin ? y : x), t.options[0]);
    if (best) {
      const fare = transitFare(best.legs, place.country);
      options.push({
        min: best.durationMin, vehicles: best.transfers + 1, approximate: !!t.approximate, fare,
        parts: [{ type: 'transit', from: from.name, to: to.name, min: best.durationMin, transfers: best.transfers, fare }],
      });
    } else if (t?.walkMin != null) {
      options.push({ min: t.walkMin, vehicles: 0, fare: ZERO, parts: [{ type: 'walk', min: t.walkMin, to: to.name }] });
    }
  } catch (err) {
    console.error(`Transitous ${from.name} → ${to.name}:`, err.message);
  }
  const chain = placeAccess(place, hub, side, date);
  if (chain) options.push({ ...chain, vehicles: 1 });
  return options.sort((x, y) => x.min - y.min)[0] ?? null;
}

// Stima con una tratta nota assente dai dati aperti (known-links.json), es. Gravina → Bari Centrale →
// treno Ferrotramviaria → BRI. { min, transfers, approximate, parts } oppure null se non applicabile quel giorno.
async function knownRoute(place, airport, side, date) {
  let best = null;
  for (const leg of airportLinks(airport.iata, side)) {
    const hub = { ...(side === 'from' ? leg.from : leg.to), atStop: true };
    const access = await hubAccess(place, hub, side, date);
    if (!access) continue;
    // Si aspetta il treno dopo un volo o un cambio; chi arriva a piedi al nodo esce di casa all'ora giusta.
    const link = airportLinkPart(leg, date, side === 'to' || access.vehicles > 0);
    if (!link) continue;
    const min = access.min + link.waitMin + link.durationMin;
    if (best && best.min <= min) continue;
    best = {
      min,
      transfers: access.vehicles, // i mezzi dell'accesso + il treno noto, meno uno
      approximate: !!access.approximate,
      fare: addFares(access.fare, link.fare),
      parts: side === 'from' ? [...access.parts, link] : [link, ...access.parts],
    };
  }
  return best;
}

async function transitTo(place, ap, side, date) {
  const [from, to] = side === 'from' ? [place, ap] : [ap, place];
  try {
    const t = await groundConnections(from, to, date);
    return t && { ...t, options: t.options.map((o) => ({ ...o, fare: transitFare(o.legs, place.country) })) };
  } catch (err) {
    console.error(`Transitous ${from.name} → ${to.name}:`, err.message);
    return { error: true }; // un errore su una tratta non blocca le altre
  }
}

// transit: { options, walkMin } | null (nessun collegamento nei dati) | { error: true }; assente = non calcolato.
// Transitous è interrogato solo per i primi `airportsPerSide` aeroporti della lista; quelli senza fermata
// entro ~2,5 km (airport-stops.json) sono già "nessun mezzo pubblico nei dati" e non costano richieste.
// known: stima con una tratta nota assente dai dati aperti, solo per gli aeroporti che ne hanno una.
async function withTransit(airports, date, place, side) {
  if (!config.transitous.enabled) return airports;
  return Promise.all(airports.map(async (a, i) => {
    if (i >= config.transitous.airportsPerSide) return a;
    const stop = airportStop(a.iata);
    const [known, transit] = await Promise.all([
      airportLinks(a.iata, side).length ? knownRoute(place, a, side, date) : null,
      stop ? transitTo(place, airportPlace(a, stop), side, date) : null,
    ]);
    return { ...a, transit, ...(known && { known }) };
  }));
}

export async function planTrip({ origin, destination, date, priority }) {
  const fromAirports = candidateAirports(origin).map(withGroundEstimate);
  const toAirports = candidateAirports(destination).map(withGroundEstimate);
  if (!fromAirports.length || !toAirports.length) {
    const where = !fromAirports.length ? origin.name : destination.name;
    throw Object.assign(new Error(`Nessun aeroporto con voli di linea entro 300 km da ${where}`), { status: 422 });
  }
  // Senza orari dei voli cerchiamo i collegamenti del giorno scelto dalla mattina in poi, a entrambi i capi.
  const [from, to] = await Promise.all([
    withTransit(fromAirports, date, origin, 'from'),
    withTransit(toAirports, date, destination, 'to'),
  ]);
  return {
    origin, destination, date, priority,
    straightLineKm: Math.round(distanceKm(origin, destination)),
    fromAirports: from, toAirports: to,
    airportTime: { beforeMin: AIRPORT_BEFORE_MIN, afterMin: AIRPORT_AFTER_MIN },
    flights: rankPairs(from, to, priority),
  };
}
