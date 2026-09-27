# TravelRoute (nome provvisorio)

Itinerari porta a porta in Europa: tratta via terra → volo → tratta via terra, con aeroporti alternativi.

```
server/   API Node + Express (Render)      → npm --prefix server run dev   (porta 3001)
web/      React + Vite (Vercel)            → npm --prefix web run dev      (porta 5173)
```

## Dati locali
- `server/src/data/places.json` — ~68.700 luoghi europei con più di 1.000 abitanti (GeoNames, CC BY 4.0 → attribuzione nel footer)
- `server/src/data/airports.json` — 524 aeroporti europei con voli di linea (OurAirports); esclusi RU/BY, e UA finché lo spazio aereo è chiuso
- Rigenerazione: `npm --prefix server run data:build` (elenco paesi in `server/src/data/countries.js`)

I suggerimenti mentre si digita arrivano solo dal dataset locale. Nominatim viene chiamato solo se l'utente
preme "Cerca su OpenStreetMap", con 1 richiesta/s e cache permanente nella tabella `geocode_cache`.

## Modello: gratuito, non commerciale, open source
Nessuna pubblicità né affiliazione. È la condizione per usare l'API pubblica di Transitous; se un giorno il sito
verrà monetizzato, le tratte via terra dovranno passare a un'istanza MOTIS propria. Il vecchio codice
Travelpayouts/Aviasales è in `archive/travelpayouts/` (non importato, con istruzioni per ripristinarlo).

## Tratte via terra (Transitous / MOTIS)
- `server/src/services/transitous.js` chiama `https://api.transitous.org/api/v6/plan` per luogo → aeroporto e
  aeroporto → luogo, partenze del giorno scelto dalle 6:00 ora locale (`server/src/data/timezones.js`).
- Capolinea degli aeroporti: `server/src/data/airport-stops.json`, la fermata dei mezzi pubblici (non aerea) entro
  ~2,5 km da ogni aeroporto, preferendo quelle con "aeroporto" nel nome e le stazioni ferroviarie. Le coordinate
  OurAirports sono il centro pista e spesso non raggiungono nessuna strada. Si rigenera con
  `npm --prefix server run data:stops` (1 richiesta/s, ~9 min; `-- BLQ KRK` per aggiornarne solo alcuni).
- Mezzi pubblici cercati solo per i primi `TRANSITOUS_AIRPORTS_PER_SIDE` aeroporti per lato (default 4); tra
  questi, quelli senza fermata non costano richieste e mostrano "nessun mezzo pubblico nei dati".
- Esclusi i voli (`AIRPLANE`): Transitous ne contiene alcuni e proporrebbe giri assurdi. Tratto a piedi fino a 30 min.
- Se la fermata è al terminal, "nessun risultato" è definitivo. Altrimenti riprova una volta con `radius=2000`.
  Il risultato è marcato `approximate` (tratto a piedi non conteggiato), come ogni tratta verso una fermata
  che non è al terminal (es. la stazione del paese accanto).
- Cache nella tabella `ground_cache` (`GROUND_CACHE_HOURS`, default 24), anche per i "nessun risultato";
  massimo 2 richieste contemporanee per tutto il server.
- Condizioni d'uso (transitous.org/api): codice pubblicato con licenza open source, uso non commerciale,
  User-Agent con contatto (`TRANSITOUS_USER_AGENT`), link a transitous.org/sources nel footer,
  contattarli prima di volumi significativi (Matrix `#transitous:matrix.spline.de`).
- Lacune note (settembre 2026): FAL (Ferrovie Appulo Lucane) assenti; Ferrotramviaria/FNB ferma a giugno 2025
  (manca il treno per l'aeroporto di Bari); nessun collegamento dall'aeroporto di Plovdiv. Dove non c'è una
  tratta nota (sotto) il sito mostra la stima in auto e il link a Google Maps.

## Collegamenti noti assenti dai dati aperti (`server/src/data/known-links.json`)
Tratte che esistono ma mancano in Transitous, con **solo** durata tipica e frequenza media lette dall'orario
ufficiale (link, fonte, data di verifica): mai orari inventati. Oggi: Ferrotramviaria Bari Centrale ↔ aeroporto
BRI (20 min, lun–sab ogni ~30 min, festivi ogni 50) e FAL Gravina ↔ Bari Centrale (85 min, lun–sab ~ogni ora,
sospesa domenica e festivi; festività nazionali IT incluse Pasquetta in `services/known-links.js`).
- Per un aeroporto con una tratta nota il server stima luogo → nodo (es. Bari Centrale) con Transitous (una
  richiesta in più, in cache) oppure con un'altra tratta nota se il luogo è entro 30 min a piedi dal capolinea,
  poi aggiunge la tratta nota. L'attesa media (metà frequenza) si conta dopo un volo o un cambio, non partendo da casa.
- La stima sostituisce Transitous solo se è più rapida. Nel ranking: "più veloce" usa la stima così com'è,
  "equilibrato" aggiunge 15 min per cambio + 25 min (tra "approximate" +20 e auto +45).
- Il frontend la mostra come "Con treni non presenti nei dati aperti: stima", con link all'orario ufficiale.
- Da aggiornare a ogni cambio d'orario (FAL: 31/08/2026; Ferrotramviaria: 15/03/2026).

## Voli e classifica (`server/src/services/ranking.js`)
Nessuna API voli: durata stimata dalla distanza (30 min + 750 km/h) e link a Google Voli e Skyscanner
(senza affiliazione). Il totale porta a porta include 2 h in aeroporto prima del volo e 30 min all'uscita.
Due priorità, niente "più economico" (senza prezzi sarebbe inventato):
- **Più veloce**: tempi reali dei mezzi pubblici; dove mancano, la stima in auto pesa ×1,5 + 30 min.
- **Equilibrato**: come sopra, più 15 min per cambio, 45 min per tratta in auto, 20 min se manca il tratto a piedi.
Il server manda entrambi i punteggi: il frontend mostra i primi 5 itinerari e riordina senza nuova ricerca.

## Database
In locale, senza `DATABASE_URL`, si usa PGlite (`server/.pglite/`). Con `NODE_ENV=production` il server
**non parte** se mancano `DATABASE_URL`, `IP_HASH_SECRET` o `NOMINATIM_USER_AGENT`.

## Limite ricerche
Non ci sono account: ogni IP ha `DAILY_SEARCHES` ricerche al giorno (default 15), contate nel DB (`search_usage`)
con un hash troncato e salato dell'IP, mai l'indirizzo in chiaro. Serve a restare leggeri su Transitous.

## Licenza
Codice: [GNU AGPL-3.0 o successiva](LICENSE). Chi mette online una versione modificata deve pubblicarne i
sorgenti: il footer mostra il link "Codice sorgente" quando `VITE_SOURCE_URL` è impostata (obbligatorio in produzione).
I dati in `server/src/data/` restano con le loro licenze: GeoNames CC BY 4.0, OurAirports pubblico dominio,
fermate da Transitous (licenze delle fonti su transitous.org/sources), orari delle tratte note dai siti degli operatori.

## Promemoria legali (non nel codice)
- Se in futuro si monetizza: partita IVA, niente più Transitous pubblico (MOTIS proprio).
- Informativa privacy GDPR (hash salato dell'IP usato per il limite ricerche; nessun account né email).
- Se si introduce un abbonamento: recesso di 14 giorni per servizi digitali UE, salvo rinuncia esplicita all'acquisto.
