import { useMemo, useRef, useState } from 'react';
import { duration, euros } from '../format.js';
import { cityOf, Journey, legMode } from './Journey.jsx';
import { PRIORITIES } from './SearchForm.jsx';
import { Legend } from './Legend.jsx';

const SHOWN = 6;

// Barra proporzionale: quanto pesano via terra, aeroporto e volo sul totale.
function MiniBar({ p, trip }) {
  const parts = [
    [legMode(p.before), p.before.min],
    ['wait', trip.airportTime.beforeMin],
    ['air', p.flightMin],
    ['wait', trip.airportTime.afterMin],
    [legMode(p.after), p.after.min],
  ];
  return (
    <span className="minibar" aria-hidden>
      {parts.map(([mode, min], i) => <span key={i} className={mode} style={{ flexGrow: min }} />)}
    </span>
  );
}

// Perché un'alternativa è meno affidabile, in una frase breve.
function caveat(p, from, to) {
  const notes = [];
  if (p.before.by === 'car') notes.push(`in auto fino a ${cityOf(from)}`);
  if (p.after.by === 'car') notes.push(`in auto da ${cityOf(to)}`);
  if (p.before.by === 'known' || p.after.by === 'known') notes.push('treni stimati da orario ufficiale');
  return notes.join(', ');
}

const pairKey = (p) => `${p.from}-${p.to}`;

// Il server ordina già per trip.priority, ma ogni coppia ha i punteggi di entrambe le priorità:
// cambiare ordinamento o scegliere un'alternativa non richiede una nuova ricerca.
export function Results({ trip }) {
  const [priority, setPriority] = useState(trip.priority);
  const [picked, setPicked] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const fromAirports = useMemo(() => new Map(trip.fromAirports.map((a) => [a.iata, a])), [trip]);
  const toAirports = useMemo(() => new Map(trip.toAirports.map((a) => [a.iata, a])), [trip]);
  const sorted = useMemo(
    () => [...trip.flights].sort((x, y) => x.scores[priority] - y.scores[priority] || x.totalMin - y.totalMin),
    [trip, priority],
  );
  const selected = sorted.find((p) => pairKey(p) === picked) ?? sorted[0];
  const shown = showAll ? sorted : sorted.slice(0, SHOWN);
  const journeyRef = useRef(null);

  // Su schermi stretti le alternative stanno sotto la linea del viaggio: dopo la scelta si torna su.
  function pick(p) {
    setPicked(pairKey(p));
    if (window.matchMedia('(max-width: 959px)').matches) {
      journeyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  return (
    <div className="results">
      <p className="trip-line">
        {trip.origin.name} → {trip.destination.name}, {trip.straightLineKm} km in linea d'aria
      </p>
      <a className="jump" href="#alt-title">Confronta tutte le {sorted.length} combinazioni di aeroporti</a>

      <div className="results-grid">
        <div ref={journeyRef} className="journey-anchor">
        <Journey
          trip={trip}
          pair={selected}
          fromAirport={fromAirports.get(selected.from)}
          toAirport={toAirports.get(selected.to)}
          recommended={selected === sorted[0]}
        />
        </div>

        <section className="alternatives" aria-labelledby="alt-title">
          <h3 id="alt-title">Tutte le combinazioni di aeroporti</h3>
          <div className="sort" role="radiogroup" aria-label="Ordina per">
            {PRIORITIES.map((p) => (
              <label key={p.value} className={priority === p.value ? 'on' : ''} title={p.hint}>
                <input type="radio" name="sort" value={p.value}
                  checked={priority === p.value} onChange={() => { setPriority(p.value); setPicked(null); }} />
                {p.label}
              </label>
            ))}
          </div>
          <p className="sort-hint">{PRIORITIES.find((p) => p.value === priority).hint}.</p>

          <ol className="alt-list">
            {shown.map((p) => {
              const from = fromAirports.get(p.from);
              const to = toAirports.get(p.to);
              const delta = p.totalMin - selected.totalMin;
              const note = caveat(p, from, to);
              return (
                <li key={pairKey(p)}>
                  <button type="button" className="alt" aria-pressed={p === selected}
                    onClick={() => pick(p)}>
                    <span className="alt-route">{cityOf(from)} – {cityOf(to)}</span>
                    <span className="alt-total">
                      {duration(p.totalMin)}
                      {p !== selected && delta !== 0 && (
                        <small className={delta > 0 ? 'slower' : 'faster'}>
                          {delta > 0 ? '+' : '−'}{duration(Math.abs(delta))}
                        </small>
                      )}
                    </span>
                    {p.price && <span className="alt-price">circa {euros(p.price)}</span>}
                    <MiniBar p={p} trip={trip} />
                    {note && <span className="alt-note">{note}</span>}
                  </button>
                </li>
              );
            })}
          </ol>
          {sorted.length > SHOWN && (
            <button type="button" className="text-button" onClick={() => setShowAll((v) => !v)}>
              {showAll ? 'Mostra meno combinazioni' : `Mostra tutte le ${sorted.length} combinazioni`}
            </button>
          )}
        </section>
      </div>

      <Legend compact />

      <details className="method">
        <summary>Come calcoliamo tempi e prezzi</summary>
        <ul>
          <li>Treni e bus sono quelli reali del giorno scelto, dai dati aperti di Transitous, per gli aeroporti più vicini.</li>
          <li>Alcuni treni che mancano dai dati aperti (per esempio per l'aeroporto di Bari) sono stimati dall'orario ufficiale, attesa media inclusa.</li>
          <li>Dove non troviamo né treni né bus usiamo una stima in auto; nella classifica pesa di più, perché serve un'auto o un taxi.</li>
          <li>Il volo è stimato dalla distanza (diretto, circa 750 km/h più 30 minuti). Contiamo 2 ore in aeroporto prima del volo e 30 minuti per uscire.</li>
          <li>"Più comodo" penalizza cambi, tratti in auto e stime; "Più veloce" guarda solo il tempo.</li>
          <li>
            I prezzi sono stime a persona, sola andata, senza sconti. Treni regionali e bus: tariffa a chilometri
            (Trenitalia Puglia 2026: 100 km = 8,80 €), fino al 40% in più per le regioni più care; biglietto urbano
            da 1,30 a 2,20 €. Alta velocità e pullman a lunga percorrenza hanno prezzi variabili: la forbice è ampia.
          </li>
          <li>
            Negli altri paesi scaliamo i prezzi con il livello dei prezzi dei trasporti Eurostat 2024 (per esempio
            Germania +40%, Bulgaria −33% rispetto all'Italia).
          </li>
          <li>
            Volo: tra 0,6 e 2 volte un prezzo tipico che cresce con la distanza, tarato sul prezzo medio di un biglietto
            Ryanair nel 2025–26 (50,60 €, bagagli e posto a sedere esclusi).
          </li>
          <li>Auto: carburante (6,5 litri ogni 100 km) e pedaggi; il parcheggio in aeroporto non è compreso.</li>
        </ul>
      </details>
    </div>
  );
}
