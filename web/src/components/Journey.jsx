import { changes, duration, euros, mapsTransitUrl } from '../format.js';
import { Departures, KnownParts } from './GroundOptions.jsx';

// OurAirports scrive alcune città con la provincia, es. "Foggia (FG)": qui basta il nome.
export const cityOf = (a) => (a.city || a.name).replace(/\s*\([^)]*\)$/, '');

// Ricerca voli su motori esterni, senza affiliazioni: il sito è non commerciale.
const googleFlightsUrl = (from, to, date) =>
  `https://www.google.com/travel/flights?${new URLSearchParams({ q: `Flights from ${from} to ${to} on ${date} one way`, hl: 'it' })}`;

const skyscannerUrl = (from, to, date) =>
  `https://www.skyscanner.it/trasporti/voli/${from.toLowerCase()}/${to.toLowerCase()}/${date.slice(2).replaceAll('-', '')}/`;

// Colore/stile del tratto sulla linea: mezzi reali, stima con treni noti, auto, a piedi, attesa, volo.
export const legMode = (g) => ({ transit: 'rail', known: 'known', car: 'car', walk: 'walk' }[g.by]);

// Titolo del tratto via terra, nella lingua di chi viaggia.
export function groundTitle(g) {
  if (g.by === 'transit') return `${duration(g.min)} con treni e bus, ${changes(g.transfers)}`;
  if (g.by === 'known') return `circa ${duration(g.min)} in treno, ${changes(g.transfers)} (stima)`;
  if (g.by === 'walk') return `${duration(g.min)} a piedi`;
  return `circa ${duration(g.min)} in auto`;
}

function GroundBody({ leg, airport, from, to }) {
  const maps = <a href={mapsTransitUrl(from, to)} target="_blank" rel="noopener">Percorso con i mezzi su Google Maps</a>;
  const transit = airport.transit;
  if (leg.by === 'transit') {
    return (
      <>
        <p className="seg-note">
          Partenze del giorno scelto, dalle 6:00.
          {transit.approximate && ' Non è contato il tratto a piedi fino alla prima fermata (fino a 2 km).'}
        </p>
        <Departures transit={transit} />
        <p className="seg-note">Orari da dati aperti: qualche operatore può mancare. {maps}</p>
      </>
    );
  }
  if (leg.by === 'known') {
    return (
      <>
        <p className="seg-note">
          Questi treni non sono nei dati aperti: la durata viene dall'orario ufficiale e include l'attesa media.
          Controlla gli orari prima di partire.
        </p>
        <KnownParts known={airport.known} />
        {transit?.options?.length > 0 && (
          <details className="more">
            <summary>Solo con i dati aperti: da {duration(Math.min(...transit.options.map((o) => o.durationMin)))}</summary>
            <Departures transit={transit} />
          </details>
        )}
        <p className="seg-note">{maps}</p>
      </>
    );
  }
  if (leg.by === 'walk') return <p className="seg-note">{maps}</p>;
  return (
    <p className="seg-note">
      Circa {airport.ground.roadKm} km su strada.{' '}
      {leg.checked
        ? 'Nei dati aperti non ci sono treni o bus per questo tratto: il tempo è una stima in auto.'
        : 'Treni e bus li cerchiamo solo per gli aeroporti più vicini: il tempo è una stima in auto.'}
      {' '}Il prezzo è carburante e pedaggi con un'auto tua, parcheggio escluso; in taxi circa{' '}
      {euros(airport.ground.taxi)}. {maps}
    </p>
  );
}

const Stop = ({ name, detail, end }) => (
  <li className={`stop${end ? ' end' : ''}`}>
    <span className="rail" aria-hidden />
    <div>
      <p className="stop-name">{name}</p>
      {detail && <p className="stop-detail">{detail}</p>}
    </div>
  </li>
);

const Seg = ({ mode, title, price, children }) => (
  <li className={`seg ${mode}`}>
    <span className="rail" aria-hidden />
    <div className="seg-body">
      <p className="seg-title">
        <span>{title}</span>
        {price && <span className="seg-price">{price}</span>}
      </p>
      {children}
    </div>
  </li>
);

// Il viaggio scelto come linea verticale: fermate (luoghi e aeroporti) e tratti colorati per mezzo.
export function Journey({ trip, pair, fromAirport, toAirport, recommended }) {
  const { origin, destination, date, airportTime } = trip;
  return (
    <article className="journey" aria-live="polite">
      <header className="journey-head">
        <p className="journey-kind">{recommended ? 'Il viaggio che ti consigliamo' : 'Il viaggio che hai scelto'}</p>
        <div className="journey-figures">
          <h2>
            <span className="total">{duration(pair.totalMin)}</span> porta a porta
          </h2>
          {pair.price && (
            <p className="journey-price">
              <span className="total">{euros(pair.price)}</span> a persona, stima
            </p>
          )}
        </div>
        <p className="journey-sub">
          Volando da {cityOf(fromAirport)} a {cityOf(toAirport)},{' '}
          {new Date(`${date}T12:00:00`).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}.
          Il volo è stimato dalla distanza: orari e prezzi veri dei voli li trovi con i pulsanti qui sotto.
        </p>
      </header>

      <ol className="route" key={`${pair.from}-${pair.to}`}>
        <Stop name={origin.name} detail="Partenza" />
        <Seg mode={legMode(pair.before)} title={groundTitle(pair.before)} price={euros(pair.before.fare)}>
          <GroundBody leg={pair.before} airport={fromAirport} from={origin} to={fromAirport} />
        </Seg>
        <Stop name={`Aeroporto di ${cityOf(fromAirport)} (${fromAirport.iata})`} detail={fromAirport.name} />
        <Seg mode="wait" title={`${duration(airportTime.beforeMin)} in aeroporto prima del volo`} />
        <Seg mode="air" title={`Volo per ${cityOf(toAirport)}, circa ${duration(pair.flightMin)}`} price={euros(pair.flightPrice)}>
          <p className="seg-note">
            {pair.km} km. Durata e prezzo stimati per un volo diretto con bagaglio a mano piccolo: controlla che la
            rotta esista, a che ora parte e quanto costa davvero.
          </p>
          <p className="flight-links">
            <a className="button-link" href={googleFlightsUrl(pair.from, pair.to, date)} target="_blank" rel="noopener">Cerca su Google Voli</a>
            <a className="button-link" href={skyscannerUrl(pair.from, pair.to, date)} target="_blank" rel="noopener">Cerca su Skyscanner</a>
          </p>
        </Seg>
        <Stop name={`Aeroporto di ${cityOf(toAirport)} (${toAirport.iata})`} detail={toAirport.name} />
        <Seg mode="wait" title={`Circa ${duration(airportTime.afterMin)} per uscire dall'aeroporto`} />
        <Seg mode={legMode(pair.after)} title={groundTitle(pair.after)} price={euros(pair.after.fare)}>
          <GroundBody leg={pair.after} airport={toAirport} from={toAirport} to={destination} />
        </Seg>
        <Stop name={destination.name} detail="Arrivo" end />
      </ol>
    </article>
  );
}
