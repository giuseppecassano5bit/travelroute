// Genera i dataset locali usati per la selezione dei luoghi (niente autocomplete su Nominatim):
//   src/data/places.json   ← GeoNames cities1000 (CC BY 4.0: citare "GeoNames" nel sito)
//   src/data/airports.json ← OurAirports (pubblico dominio)
// Eseguire con `npm run data:build` e committare i JSON generati.
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { unzipSync, strFromU8 } from 'fflate';
import { EUROPE_COUNTRIES, NO_FLIGHT_COUNTRIES } from '../data/countries.js';

const GEONAMES = 'https://download.geonames.org/export/dump';
const OURAIRPORTS = 'https://davidmegginson.github.io/ourairports-data/airports.csv';
const out = (name) => fileURLToPath(new URL(`../data/${name}`, import.meta.url));

// Sotto questa popolazione non indicizziamo i nomi alternativi (Londra, Parigi, Monaco di Baviera…):
// tenerli per tutti i 70k luoghi triplicherebbe il file senza benefici reali.
const ALT_NAMES_MIN_POP = 100_000;

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download fallito ${url}: ${res.status}`);
  return res;
}

function parseCsvLine(line) {
  const cols = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { cols.push(cur); cur = ''; }
    else cur += c;
  }
  cols.push(cur);
  return cols;
}

// Solo nomi in alfabeto latino: gli utenti digitano "Londra", non "Лондон".
const LATIN = /^[\p{Script=Latin}\s'’.\-]+$/u;
const round4 = (n) => Math.round(n * 1e4) / 1e4;

async function buildPlaces() {
  const admin1 = new Map(
    (await (await download(`${GEONAMES}/admin1CodesASCII.txt`)).text())
      .trim().split('\n').map((l) => l.split('\t')).map(([code, name]) => [code, name]),
  );

  const zip = unzipSync(new Uint8Array(await (await download(`${GEONAMES}/cities1000.zip`)).arrayBuffer()));
  const rows = strFromU8(zip['cities1000.txt']).trim().split('\n').map((l) => l.split('\t'));

  // Formato compatto a tuple: [geonameId, nome, regione, paese, lat, lon, popolazione, nomiAlternativi]
  const places = rows
    .filter((r) => EUROPE_COUNTRIES.has(r[8]) && r[6] === 'P' && r[7] !== 'PPLX' && r[7] !== 'PPLH')
    .map((r) => {
      const pop = Number(r[14]) || 0;
      const alt = pop >= ALT_NAMES_MIN_POP
        ? [...new Set(r[3].split(',').filter((n) => n && n !== r[1] && LATIN.test(n) && n.length <= 40))]
        : [];
      return [Number(r[0]), r[1], admin1.get(`${r[8]}.${r[10]}`) ?? '', r[8], round4(+r[4]), round4(+r[5]), pop, alt];
    })
    .sort((a, b) => b[6] - a[6]);

  await writeFile(out('places.json'), JSON.stringify(places));
  console.log(`places.json: ${places.length} luoghi`);
}

async function buildAirports() {
  const [header, ...rows] = (await (await download(OURAIRPORTS)).text()).trim().split('\n');
  const cols = parseCsvLine(header);
  const col = Object.fromEntries(cols.map((c, i) => [c, i]));

  const airports = rows
    .map(parseCsvLine)
    .filter((r) =>
      ['large_airport', 'medium_airport'].includes(r[col.type]) &&
      r[col.scheduled_service] === 'yes' &&
      /^[A-Z]{3}$/.test(r[col.iata_code]) &&
      EUROPE_COUNTRIES.has(r[col.iso_country]) &&
      !NO_FLIGHT_COUNTRIES.has(r[col.iso_country]))
    .map((r) => ({
      iata: r[col.iata_code],
      name: r[col.name],
      city: r[col.municipality],
      country: r[col.iso_country],
      lat: round4(+r[col.latitude_deg]),
      lon: round4(+r[col.longitude_deg]),
      large: r[col.type] === 'large_airport',
    }));

  await writeFile(out('airports.json'), JSON.stringify(airports));
  console.log(`airports.json: ${airports.length} aeroporti`);
}

await Promise.all([buildPlaces(), buildAirports()]);
