# Archivio: integrazione Travelpayouts / Aviasales (fase 2, in pausa)

Codice scritto il 2026-09-27 e tolto dal sito attivo lo stesso giorno, quando il progetto è diventato
**gratuito, non commerciale e open source** (vincolo di Transitous per le tratte via terra).
Serve solo se in futuro il sito verrà monetizzato: in quel caso Transitous non sarà più utilizzabile
e le tratte via terra dovranno passare a un'istanza MOTIS propria.

Nessuno di questi file è importato dal codice attivo.

## Contenuto
| File | Ruolo |
|---|---|
| `server/services/prices.js` | Prezzi indicativi dalla Data API Aviasales (`prices_for_dates`), cache nella tabella `price_cache` |
| `web/affiliate.js` | Link di affiliazione (`tp.media/r`) e URL del widget calendario prezzi (promo_id 4041) |
| `web/components/Flights.jsx` | Elenco coppie di aeroporti con prezzi + widget + link Aviasales |
| `web/components/FlightWidget.jsx` | Caricamento dello script-widget con fallback se bloccato da adblock |

## Parti rimosse da file ancora attivi (da reinserire per ripristinare)

`server/src/config.js`, dentro `config`:
```js
travelpayouts: {
  token: process.env.TRAVELPAYOUTS_TOKEN || null,
  marker: process.env.TRAVELPAYOUTS_MARKER || null,
  cacheHours: Number(process.env.PRICE_CACHE_HOURS ?? 6),
},
```

`server/src/services/airports.js` (helper rimosso perché non più usato):
```js
const knownIata = new Set(airports.map((a) => a.iata));
export const isKnownAirport = (iata) => knownIata.has(iata);
```

`server/src/routes/api.js`:
```js
import { isKnownAirport } from '../services/airports.js';
import { pricesEnabled, pricesForPairs } from '../services/prices.js';

// Prezzi indicativi minimi per le coppie di aeroporti già mostrate all'utente (max 6 × 6).
// Accetta solo IATA del nostro dataset: così nessuno può usare il nostro token per tratte arbitrarie.
const pricesQuery = z.object({
  date: futureDate,
  pairs: z.string().max(400).transform((s) => s.split(',')).pipe(
    z.array(z.string().regex(/^[A-Z]{3}-[A-Z]{3}$/)).min(1).max(36),
  ),
});

api.get('/prices', async (req, res) => {
  if (!pricesEnabled()) return res.json({ enabled: false });
  const q = pricesQuery.safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: 'Parametri non validi' });
  const pairs = [...new Set(q.data.pairs)].map((p) => {
    const [from, to] = p.split('-');
    return { from, to };
  });
  if (pairs.some((p) => !isKnownAirport(p.from) || !isKnownAirport(p.to) || p.from === p.to)) {
    return res.status(400).json({ error: 'Aeroporto sconosciuto' });
  }
  res.set('Cache-Control', 'public, max-age=900');
  res.json({ enabled: true, ...(await pricesForPairs(pairs, q.data.date)) });
});
```

`server/src/db/schema.sql` (la tabella può restare nei DB già creati, è innocua):
```sql
CREATE TABLE IF NOT EXISTS price_cache (
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  month TEXT NOT NULL,
  currency TEXT NOT NULL,
  result JSONB,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (origin, destination, month, currency)
);
```

`web/src/config.js`:
```js
export const TP_MARKER = import.meta.env.VITE_TP_MARKER ?? '';
export const TP_TRS = import.meta.env.VITE_TP_TRS ?? '';
export const WIDGET_TIMEOUT_MS = 10000;
```

`web/src/api.js`, dentro `api`:
```js
prices: ({ pairs, date }, signal) =>
  request(`/api/prices?date=${date}&pairs=${pairs.map((p) => `${p.from}-${p.to}`).join(',')}`, { signal, tracked: false }),
```

Variabili d'ambiente: `server/.env` → `TRAVELPAYOUTS_TOKEN`, `TRAVELPAYOUTS_MARKER`, `PRICE_CACHE_HOURS`;
`web/.env` → `VITE_TP_MARKER`, `VITE_TP_TRS`. Nel footer va ripristinata la dichiarazione di affiliazione.

## Fatti verificati (2026-09-27)
- Marker = ID account 782374; nessun Progetto creato su Travelpayouts (widget bloccati finché non esiste).
- Data API Aviasales: aperta a qualunque account con token, limite 600 richieste/min per `prices_for_dates`.
- Search API (prezzi in tempo reale): richiede 50.000 utenti attivi al mese.
- Con monetizzazione servono partita IVA e informativa sulle affiliazioni.
