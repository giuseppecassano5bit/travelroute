// Prezzi indicativi, sempre come intervallo { lo, hi } in euro: nessuna API ci dà i prezzi reali, quindi il sito
// li mostra come "circa" e rimanda ai siti degli operatori. Ogni parametro ha la sua fonte qui accanto; il metodo
// è riassunto anche nella pagina ("Come stimiamo i prezzi"). Tutti i prezzi sono a persona, sola andata, adulti.
import { readFileSync } from 'node:fs';

const { levels } = JSON.parse(readFileSync(new URL('../data/price-levels.json', import.meta.url), 'utf8'));
const EU_AVERAGE_LEVEL = 1.18; // media UE-27 rispetto all'Italia, stessa fonte di price-levels.json

// Quanto costano i trasporti nel paese rispetto all'Italia (Eurostat, servizi di trasporto 2024).
export const priceLevel = (country) => levels[country] ?? EU_AVERAGE_LEVEL;

// Biglietto urbano (bus, tram, metro in città): da 1,30 € (minimo della tariffa regionale Puglia) a 2,20 €
// (Milano). Più tratti urbani consecutivi usano di solito lo stesso biglietto a tempo.
const URBAN_TICKET = { lo: 1.3, hi: 2.2 };
const URBAN_MODES = new Set(['TRAM', 'SUBWAY', 'METRO', 'FUNICULAR', 'AERIAL_LIFT', 'CABLE_CAR']);
const URBAN_BUS_MAX_KM = 15; // un bus più corto di così lo trattiamo come urbano

// Treni regionali e bus extraurbani: tariffa a fasce chilometriche. Tariffa Trenitalia 39/14 Puglia, valida
// dall'11/02/2026: 100 km = 8,80 €, 200 km = 17,60 €, minimo 1,30 € → circa 0,088 €/km. Altre regioni costano
// di più (Emilia-Romagna 2026: 21–30 km = 3,70 € contro 2,60 € in Puglia), da cui il +40% del massimo.
const REGIONAL_EUR_KM = 0.088;
const REGIONAL_MIN = 1.3;
const REGIONAL_SPREAD = 1.4;

// Alta velocità: prezzo dinamico, dalle offerte in anticipo al biglietto base (stima grezza).
const FAST = { loKm: 0.04, loMin: 9.9, hiKm: 0.17, hiMin: 29.9 };
// Intercity e treni notte: a chilometri come i regionali, con supplementi fino a circa 0,15 €/km (stima grezza;
// in Est Europa costano meno della media dei trasporti, per esempio in Bulgaria).
const INTERCITY_MODES = new Set(['LONG_DISTANCE', 'NIGHT_RAIL']);
const INTERCITY = { loKm: 0.06, loMin: REGIONAL_MIN, hiKm: 0.15, hiMin: 2.2 };
// Autobus a lunga percorrenza (FlixBus e simili): prezzo dinamico, stima grezza.
const COACH = { loKm: 0.03, loMin: 4.99, hiKm: 0.09, hiMin: 15 };
const FERRY = { loKm: 0.15, loMin: 3, hiKm: 0.4, hiMin: 10 };

// Velocità medie per stimare i km dei risultati in cache salvati prima che avessimo le coordinate dei tratti.
const KMH_BY_MODE = { HIGHSPEED_RAIL: 150, LONG_DISTANCE: 100, NIGHT_RAIL: 80, COACH: 70, FERRY: 25 };
const DEFAULT_KMH = 40;

// Auto propria: consumo 6,5 l/100 km a circa 1,85 €/l ≈ 0,12 €/km di solo carburante; il massimo aggiunge
// l'autostrada (in Italia circa 0,08 €/km). Parcheggio in aeroporto escluso. Il taxi è mostrato a parte.
const CAR_EUR_KM = { lo: 0.12, hi: 0.2 };
// Taxi: scatto più tariffa a km, soste e supplementi esclusi (stima grezza).
const TAXI = { start: 5, loKm: 1.3, hiKm: 2 };

// Volo: nessuna API prezzi. Stima tarata sul prezzo medio Ryanair dell'anno fiscale 2026 (50,60 € a biglietto,
// bagagli e servizi extra esclusi, in media altri 24 €): da circa 0,6× (prenotando presto) a 2× (all'ultimo
// momento o compagnia tradizionale) di un prezzo tipico che cresce con la distanza.
const FLIGHT = { base: 25, eurKm: 0.02, loFactor: 0.6, loMin: 15, hiFactor: 2 };

const cents = (x) => Math.round(x * 100) / 100;
const range = (lo, hi) => ({ lo: cents(lo), hi: cents(hi) });
export const ZERO = range(0, 0);
export const addFares = (...fares) => range(fares.reduce((s, f) => s + f.lo, 0), fares.reduce((s, f) => s + f.hi, 0));
const scaleFare = (f, k) => range(f.lo * k, f.hi * k);
const dynamic = (p, km) => range(Math.max(p.loMin, p.loKm * km), Math.max(p.hiMin, p.hiKm * km));
const regional = (km) => {
  const lo = Math.max(REGIONAL_MIN, REGIONAL_EUR_KM * km);
  return range(lo, lo * REGIONAL_SPREAD);
};

const legKm = (l) => l.km ?? (l.durationMin / 60) * (KMH_BY_MODE[l.mode] ?? DEFAULT_KMH);

function kindOf(l) {
  if (URBAN_MODES.has(l.mode) || (l.mode === 'BUS' && legKm(l) <= URBAN_BUS_MAX_KM)) return 'urban';
  if (l.mode === 'HIGHSPEED_RAIL') return 'fast';
  if (INTERCITY_MODES.has(l.mode)) return 'intercity';
  if (l.mode === 'COACH' || l.mode === 'FERRY') return l.mode.toLowerCase();
  return 'regional';
}

// Un itinerario Transitous (lista di tratti) nel paese `country`. Tratti consecutivi dello stesso tipo e della
// stessa azienda sono un solo biglietto: urbano a tempo, oppure regionale a fasce sulla somma dei km.
export function transitFare(legs, country) {
  const tickets = [];
  for (const l of legs) {
    if (l.mode === 'WALK') continue;
    const kind = kindOf(l);
    const last = tickets.at(-1);
    if (last && last.kind === kind && last.agency === l.agency && ['urban', 'regional'].includes(kind)) {
      last.km += legKm(l);
    } else {
      tickets.push({ kind, agency: l.agency, km: legKm(l) });
    }
  }
  const fares = tickets.map((t) => ({
    urban: URBAN_TICKET,
    regional: regional(t.km),
    fast: dynamic(FAST, t.km),
    intercity: dynamic(INTERCITY, t.km),
    coach: dynamic(COACH, t.km),
    ferry: dynamic(FERRY, t.km),
  })[t.kind]);
  return scaleFare(addFares(...fares), priceLevel(country));
}

// Tratta nota (known-links.json): prezzo dell'operatore (fareEur) oppure la fascia chilometrica della sua tariffa
// regionale (fareKm, stessa tabella dei treni regionali). Sono prezzi pubblicati, quindi senza forbice.
export function knownLinkFare(link, country) {
  const eur = link.fareEur ?? Math.max(REGIONAL_MIN, REGIONAL_EUR_KM * (link.fareKm ?? 0));
  return scaleFare(range(eur, eur), priceLevel(country));
}

export const carFare = (roadKm) => range(CAR_EUR_KM.lo * roadKm, CAR_EUR_KM.hi * roadKm);
export const taxiFare = (roadKm, country) =>
  scaleFare(range(TAXI.start + TAXI.loKm * roadKm, TAXI.start + TAXI.hiKm * roadKm), priceLevel(country));

export function flightFare(km) {
  const typical = FLIGHT.base + FLIGHT.eurKm * km;
  return range(Math.max(FLIGHT.loMin, typical * FLIGHT.loFactor), typical * FLIGHT.hiFactor);
}
