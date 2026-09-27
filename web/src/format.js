const regionNames = new Intl.DisplayNames(['it'], { type: 'region' });

export const countryName = (code) => {
  try { return regionNames.of(code); } catch { return code; }
};

export const flag = (code) =>
  /^[A-Z]{2}$/.test(code ?? '') ? String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0))) : '';

// "Apulia, Italia" — la regione è ciò che distingue gli omonimi (Gravina in Puglia / di Catania).
export const placeDetail = (p) =>
  [p.region && p.region !== p.name ? p.region : null, countryName(p.country)].filter(Boolean).join(', ');

export const duration = (min) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
};

// Orario "14:05" nel fuso della fermata (un treno bulgaro va mostrato in ora bulgara, non in quella di chi guarda).
export const clock = (iso, timeZone) =>
  new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', ...(timeZone && { timeZone }) });

export const dayMonth = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });

const MODE_LABELS = {
  WALK: 'a piedi', BUS: 'bus', COACH: 'pullman', TRAM: 'tram', SUBWAY: 'metro', METRO: 'metro', FERRY: 'traghetto',
  RAIL: 'treno', HIGHSPEED_RAIL: 'alta velocità', LONG_DISTANCE: 'treno', NIGHT_RAIL: 'treno notte',
  REGIONAL_FAST_RAIL: 'regionale veloce', REGIONAL_RAIL: 'regionale', SUBURBAN: 'suburbano',
  FUNICULAR: 'funicolare', AERIAL_LIFT: 'funivia',
};
export const modeLabel = (mode) => MODE_LABELS[mode] ?? 'mezzo';

export const changes = (n) => (n === 0 ? 'diretto' : n === 1 ? '1 cambio' : `${n} cambi`);

// Percorso con i mezzi pubblici su Google Maps: ripiego quando i dati aperti non coprono la tratta.
export const mapsTransitUrl = (from, to) =>
  `https://www.google.com/maps/dir/?${new URLSearchParams({
    api: '1', origin: `${from.lat},${from.lon}`, destination: `${to.lat},${to.lon}`, travelmode: 'transit',
  })}`;

// Prezzi stimati { lo, hi } in euro. Si arrotonda verso l'esterno (il minimo in giù, il massimo in su), a 1 € sotto
// i 20 € e a 5 € sopra: la forbice resta onesta e le cifre non fingono una precisione che non hanno.
const roundDown = (x) => (x < 20 ? Math.floor(x) : Math.floor(x / 5) * 5);
const roundUp = (x) => (x < 20 ? Math.ceil(x) : Math.ceil(x / 5) * 5);
const eur = (x) => (Number.isInteger(x) ? String(x) : x.toFixed(2).replace('.', ','));

export function euros(fare) {
  if (!fare) return '';
  if (fare.hi === 0) return 'gratis';
  if (fare.hi - fare.lo < 0.01) return `${eur(Math.round(fare.hi * 100) / 100)} €`;
  const lo = Math.max(roundDown(fare.lo), 1);
  const hi = Math.max(roundUp(fare.hi), lo + 1);
  return `${lo}–${hi} €`;
}
