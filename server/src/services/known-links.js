// Passo 3: collegamenti che esistono ma mancano dai dati aperti (es. treno Ferrotramviaria Bari Centrale ↔
// aeroporto, FAL Gravina ↔ Bari). known-links.json ha solo durata tipica e frequenza media dagli orari
// ufficiali: il risultato è sempre una stima dichiarata, con il link all'orario ufficiale, mai orari inventati.
import { readFileSync } from 'node:fs';
import { airportStop, distanceKm } from './airports.js';
import { knownLinkFare } from './fares.js';

const data = JSON.parse(readFileSync(new URL('../data/known-links.json', import.meta.url), 'utf8'));

// Tratto a piedi dal luogo dell'utente al capolinea di un collegamento noto (stessi 30 min di Transitous).
const WALK_KMH = 4.5;
const WALK_ROAD_FACTOR = 1.3;
const MAX_WALK_MIN = 30;

function node(id) {
  const n = data.nodes[id];
  if (!n.airport) return { id, ...n };
  const stop = airportStop(n.airport);
  return stop && { id, name: `${stop.name} (${n.airport})`, lat: stop.lat, lon: stop.lon, country: 'IT', airport: n.airport };
}

// Ogni collegamento vale nei due sensi: lo espandiamo in tratte orientate from → to.
const legs = data.links.flatMap((l) => {
  const [a, b] = [node(l.a), node(l.b)];
  if (!a || !b) return [];
  return [{ ...l, from: a, to: b }, { ...l, from: b, to: a }];
});

// Festività nazionali: i treni vanno con l'orario festivo (FAL non circola). Solo IT per ora.
const FIXED_HOLIDAYS = { IT: ['01-01', '01-06', '04-25', '05-01', '06-02', '08-15', '11-01', '12-08', '12-25', '12-26'] };

function easterMonday(year) { // algoritmo di Meeus/Jones/Butcher
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const h = (19 * a + b - Math.floor(b / 4) - Math.floor((b - Math.floor((8 * b + 13) / 25)) / 3) + 15) % 30;
  const l = (32 + 2 * (b % 4) + 2 * Math.floor(c / 4) - h - (c % 4)) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const d = new Date(Date.UTC(year, month - 1, day + 1));
  return d.toISOString().slice(5, 10);
}

function isHoliday(date, country) {
  const d = new Date(`${date}T12:00:00Z`);
  const md = date.slice(5, 10);
  return d.getUTCDay() === 0 || (FIXED_HOLIDAYS[country] ?? []).includes(md)
    || (country === 'IT' && md === easterMonday(d.getUTCFullYear()));
}

// Frequenza media del giorno scelto, o null se quel giorno il servizio non c'è.
const headwayOn = (leg, date) => leg.headwayMin[isHoliday(date, leg.from.country) ? 'holiday' : 'weekday'];

const walkMin = (from, to) => Math.round((distanceKm(from, to) * WALK_ROAD_FACTOR / WALK_KMH) * 60);

// Descrizione di una tratta nota per il frontend. waitMin: attesa media (metà frequenza), contata solo quando
// il treno non si può scegliere in anticipo (dopo un volo o un cambio); partendo da casa si esce all'ora giusta.
function linkPart(leg, headway, withWait) {
  return {
    type: 'link', id: leg.id, operator: leg.operator, mode: leg.mode,
    from: leg.from.name, to: leg.to.name, durationMin: leg.durationMin, headwayMin: headway,
    waitMin: withWait ? Math.round(headway / 2) : 0,
    service: leg.service, timetableUrl: leg.timetableUrl, source: leg.source, gap: leg.gap, verifiedOn: leg.verifiedOn,
    fare: knownLinkFare(leg, leg.from.country), fareSource: leg.fareSource,
  };
}

// Tratte note che arrivano all'aeroporto (side 'from') o ne partono (side 'to').
export function airportLinks(iata, side) {
  return legs.filter((l) => (side === 'from' ? l.to.airport === iata : l.from.airport === iata));
}

// Collegamento noto tra il luogo dell'utente e il nodo `hub`, se il luogo è a piedi dal capolinea.
// side 'from': luogo → capolinea → hub (si esce di casa all'ora giusta, niente attesa).
// side 'to': hub → capolinea → luogo (si arriva da un cambio, attesa media inclusa).
export function placeAccess(place, hub, side, date) {
  const options = [];
  for (const l of legs) {
    const [end, far] = side === 'from' ? [l.to, l.from] : [l.from, l.to];
    if (end.id !== hub.id || far.airport) continue;
    const headway = headwayOn(l, date);
    const walk = walkMin(place, far);
    if (!headway || walk > MAX_WALK_MIN) continue;
    const link = linkPart(l, headway, side === 'to');
    const walkPart = { type: 'walk', min: walk, to: side === 'from' ? far.name : place.name };
    options.push({
      min: walk + link.waitMin + link.durationMin,
      transfers: 0,
      fare: link.fare,
      parts: side === 'from' ? [walkPart, link] : [link, walkPart],
    });
  }
  return options.sort((x, y) => x.min - y.min)[0] ?? null;
}

// Tratta nota di un aeroporto nel giorno scelto (con l'attesa media se si arriva da un volo o da un cambio).
export function airportLinkPart(leg, date, withWait) {
  const headway = headwayOn(leg, date);
  return headway ? linkPart(leg, headway, withWait) : null;
}
