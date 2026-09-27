// Fase 4: combinazioni aeroporto di partenza × arrivo con totale porta a porta e punteggi per le due priorità.
// I prezzi sono solo indicativi (fares.js), quindi non entrano nella classifica: "più veloce" ed "equilibrato".
import { distanceKm } from './airports.js';
import { addFares, flightFare, ZERO } from './fares.js';

// Durata indicativa di un volo diretto: ~30 min fissi (rullaggio, salita, discesa) + 750 km/h di crociera.
// Nessun orario reale: il sito la mostra sempre come stima e rimanda ai motori di ricerca voli.
const FLIGHT_FIXED_MIN = 30;
const FLIGHT_KMH = 750;

// Attese in aeroporto incluse nel totale: arrivo 2 h prima del volo, 30 min per uscire dopo l'atterraggio.
export const AIRPORT_BEFORE_MIN = 120;
export const AIRPORT_AFTER_MIN = 30;

// Dove i dati aperti non hanno mezzi pubblici il tempo in auto è ottimistico (serve un'auto, un parcheggio
// o un taxi, e magari un mezzo che non conosciamo è molto più lento): nel ranking pesa di più.
const CAR_FACTOR = 1.5;
const CAR_EXTRA_MIN = 30;
// "Equilibrato": meno cambi, meno cammino, preferibilmente senza auto.
const BALANCED_TRANSFER_MIN = 15;
const BALANCED_CAR_MIN = 45;
const BALANCED_APPROX_MIN = 20; // manca il tratto a piedi fino alla prima fermata
// Tratta con un collegamento noto ma assente dai dati aperti (known-links.json): la stima include già l'attesa
// media (metà frequenza); in "equilibrato" pesa un po' più di una tratta approssimata e meno dell'auto.
const BALANCED_KNOWN_MIN = 25;

// Il tempo via terra più realistico che abbiamo: miglior collegamento Transitous o stima con una tratta nota
// (known, se più rapida), altrimenti la stima in auto. by dice al frontend quale dei tre è;
// checked=false se Transitous non è stato interrogato per quell'aeroporto.
function groundLeg(a) {
  const options = a.transit?.options ?? [];
  const known = a.known;
  if (options.length) {
    const best = options.reduce((x, y) => (y.durationMin < x.durationMin ? y : x));
    if (!known || known.min >= best.durationMin) {
      return {
        min: best.durationMin, by: 'transit', transfers: best.transfers, approximate: !!a.transit.approximate,
        fare: best.fare,
      };
    }
  } else if (a.transit?.walkMin != null) {
    return { min: a.transit.walkMin, by: 'walk', transfers: 0, fare: ZERO };
  }
  if (known) return { min: known.min, by: 'known', transfers: known.transfers, fare: known.fare };
  return {
    min: a.ground.driveMin, by: 'car', checked: a.transit !== undefined && !a.transit?.error, fare: a.ground.fare,
  };
}

function legScores(leg) {
  if (leg.by !== 'car') {
    return {
      fastest: leg.min,
      balanced: leg.min + leg.transfers * BALANCED_TRANSFER_MIN
        + (leg.approximate ? BALANCED_APPROX_MIN : 0) + (leg.by === 'known' ? BALANCED_KNOWN_MIN : 0),
    };
  }
  const fastest = Math.round(leg.min * CAR_FACTOR + CAR_EXTRA_MIN);
  return { fastest, balanced: fastest + BALANCED_CAR_MIN };
}

export const PRIORITIES = ['fastest', 'balanced'];

// Tutte le combinazioni, ordinate per la priorità scelta. Ogni coppia porta entrambi i punteggi, così il
// frontend può riordinare senza una nuova ricerca (e senza nuove richieste a Transitous).
export function rankPairs(fromAirports, toAirports, priority) {
  const pairs = [];
  for (const a of fromAirports) {
    for (const b of toAirports) {
      if (a.iata === b.iata) continue;
      const km = Math.round(distanceKm(a, b));
      const flightMin = Math.round(FLIGHT_FIXED_MIN + (km / FLIGHT_KMH) * 60);
      const before = groundLeg(a);
      const after = groundLeg(b);
      const fixed = flightMin + AIRPORT_BEFORE_MIN + AIRPORT_AFTER_MIN;
      const s1 = legScores(before);
      const s2 = legScores(after);
      const flightPrice = flightFare(km);
      pairs.push({
        from: a.iata, to: b.iata, km, flightMin, flightPrice, before, after,
        totalMin: before.min + fixed + after.min,
        price: addFares(before.fare, flightPrice, after.fare),
        scores: { fastest: s1.fastest + fixed + s2.fastest, balanced: s1.balanced + fixed + s2.balanced },
      });
    }
  }
  return pairs.sort((x, y) => x.scores[priority] - y.scores[priority] || x.totalMin - y.totalMin);
}
