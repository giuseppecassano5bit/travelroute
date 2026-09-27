import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { aviasalesSearchUrl, calendarWidgetSrc } from '../affiliate.js';
import { duration } from '../format.js';
import { FlightWidget } from './FlightWidget.jsx';

const PREVIEW_PAIRS = 6;
const eur = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const dayMonth = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });

// Tutte le combinazioni aeroporto di partenza × arrivo, ordinate per tratta via terra totale:
// la prima è quella che ti fa guidare meno ed è la scelta di default.
function buildPairs(trip) {
  const pairs = [];
  for (const a of trip.fromAirports) {
    for (const b of trip.toAirports) {
      if (a.iata === b.iata) continue;
      pairs.push({
        from: a.iata, to: b.iata, fromAirport: a, toAirport: b,
        groundKm: a.ground.roadKm + b.ground.roadKm,
        groundMin: a.ground.driveMin + b.ground.driveMin,
      });
    }
  }
  return pairs.sort((x, y) => x.groundKm - y.groundKm);
}

function PriceTag({ info, date }) {
  if (info === undefined) return <span className="price muted">…</span>;
  if (!info || info.error) return <span className="price muted">—</span>;
  if (info.onDate) return <span className="price">{eur.format(info.onDate.price)}</span>;
  return (
    <span className="price">
      da {eur.format(info.monthMin.price)}
      <small>il {dayMonth(info.monthMin.date)}, non il {dayMonth(date)}</small>
    </span>
  );
}

// Il genitore passa una key diversa a ogni ricerca: selezione e prezzi ripartono da zero.
export function Flights({ trip }) {
  const pairs = useMemo(() => buildPairs(trip), [trip]);
  const [selected, setSelected] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [prices, setPrices] = useState(null); // null = in caricamento, { enabled, prices }

  useEffect(() => {
    const ctrl = new AbortController();
    api.prices({ pairs, date: trip.date }, ctrl.signal)
      .then(setPrices)
      .catch((e) => { if (e.name !== 'AbortError') setPrices({ enabled: false }); });
    return () => ctrl.abort();
  }, [pairs, trip.date]);

  const priceOf = (p) => (prices ? prices.prices?.[`${p.from}-${p.to}`] ?? null : undefined);
  const showPrices = prices === null || prices.enabled;
  const cheapest = showPrices && prices?.prices
    ? pairs.reduce((best, p) => {
      const v = priceOf(p)?.onDate?.price;
      return v != null && (best == null || v < best.v) ? { p, v } : best;
    }, null)?.p
    : null;

  const current = pairs[selected];
  const visible = showAll ? pairs : pairs.slice(0, PREVIEW_PAIRS);
  if (!showAll && selected >= PREVIEW_PAIRS) visible.push(current);
  const bookingUrl = aviasalesSearchUrl({ from: current.from, to: current.to, date: trip.date });

  return (
    <section className="card flights">
      <h3>Voli da confrontare <span className="muted">· {dayMonth(trip.date)}, solo andata</span></h3>
      <div role="radiogroup" aria-label="Coppia di aeroporti" className="pairs">
        {visible.map((p) => {
          const i = pairs.indexOf(p);
          return (
            <button key={`${p.from}-${p.to}`} type="button" role="radio" aria-checked={i === selected}
              className={`pair${i === selected ? ' on' : ''}`} onClick={() => setSelected(i)}>
              <span className="route">
                <span className="iata">{p.from}</span> → <span className="iata">{p.to}</span>
                {cheapest === p && <span className="badge">più economico</span>}
                <small>
                  {p.fromAirport.city || p.fromAirport.name} → {p.toAirport.city || p.toAirport.name}
                  {' · '}~{p.groundKm} km via terra (~{duration(p.groundMin)})
                </small>
              </span>
              {showPrices && <PriceTag info={priceOf(p)} date={trip.date} />}
            </button>
          );
        })}
      </div>
      {pairs.length > PREVIEW_PAIRS && (
        <button type="button" className="link-button" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Mostra meno combinazioni' : `Mostra tutte le ${pairs.length} combinazioni`}
        </button>
      )}

      <p className="disclaimer strong">
        Prezzo indicativo — verifica il prezzo finale sul sito di prenotazione.
        {showPrices && ' I prezzi in elenco vengono dalle ricerche recenti di altri utenti Aviasales e possono non essere più disponibili.'}
      </p>

      <h4>Calendario prezzi {current.from} → {current.to}</h4>
      <FlightWidget
        key={`${current.from}-${current.to}`}
        src={calendarWidgetSrc(current)}
        fallback={(
          <p className="notice">
            Non riusciamo a mostrare il calendario dei voli (forse un blocco pubblicità lo impedisce).{' '}
            <a href={bookingUrl} target="_blank" rel="sponsored noopener">Cerca {current.from} → {current.to} su Aviasales</a>
          </p>
        )}
      />
      <a className="primary book" href={bookingUrl} target="_blank" rel="sponsored noopener">
        Vedi i voli {current.from} → {current.to} del {dayMonth(trip.date)} su Aviasales
      </a>

      <p className="affiliate-note">
        <strong>Link di affiliazione:</strong> se prenoti tramite i link di questa pagina riceviamo una piccola
        commissione da Aviasales/Travelpayouts. Per te il prezzo non cambia, e ci permette di tenere il sito gratuito.
      </p>
    </section>
  );
}
