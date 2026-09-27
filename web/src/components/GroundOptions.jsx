import { changes, clock, duration, modeLabel } from '../format.js';

const SHORT_WALK_MIN = 5; // i trasferimenti a piedi più brevi non vengono elencati tra le tappe

function Leg({ leg }) {
  if (leg.mode === 'WALK') {
    return <li className="leg walk">A piedi {duration(leg.durationMin)} fino a {leg.to}</li>;
  }
  return (
    <li className="leg">
      <span className="leg-time">{clock(leg.start, leg.tz)}</span>
      <span>
        <strong>{modeLabel(leg.mode)}{leg.line && ` ${leg.line}`}</strong> da {leg.from} a {leg.to},
        arrivo {clock(leg.end, leg.tz)}
        {leg.agency && <small>{leg.agency}{leg.headsign && `, direzione ${leg.headsign}`}</small>}
      </span>
    </li>
  );
}

// Partenze reali del giorno scelto (dati Transitous), dalle 6:00. Ognuna si apre per vedere cambi e linee.
export function Departures({ transit }) {
  const best = transit.options.reduce((a, b) => (b.durationMin < a.durationMin ? b : a));
  return (
    <ul className="departures">
      {transit.options.map((o, i) => {
        const legs = o.legs.filter((l) => l.mode !== 'WALK' || l.durationMin >= SHORT_WALK_MIN);
        return (
          <li key={`${i}-${o.start}`}>
            <details>
              <summary>
                <span className="dep-times">{clock(o.start, o.tz)} – {clock(o.end, o.tz)}</span>
                <span className="dep-dur">{duration(o.durationMin)}</span>
                <span className="dep-changes">{changes(o.transfers)}</span>
                {o === best && <span className="tag">la più rapida</span>}
              </summary>
              <ol className="legs">{legs.map((l, j) => <Leg key={j} leg={l} />)}</ol>
            </details>
          </li>
        );
      })}
    </ul>
  );
}

// Tratte di una stima con treni noti ma assenti dai dati aperti (es. per l'aeroporto di Bari):
// solo durata tipica e frequenza dall'orario ufficiale, nessun orario inventato.
export function KnownParts({ known }) {
  return (
    <ol className="legs known-legs">
      {known.parts.map((p, i) => {
        if (p.type === 'walk') return <li key={i} className="leg walk">A piedi circa {duration(p.min)} fino a {p.to}</li>;
        if (p.type === 'transit') {
          return (
            <li key={i} className="leg">
              <span>
                <strong>Treni e bus</strong> da {p.from} a {p.to}: {duration(p.min)}, {changes(p.transfers)}
                <small>percorso dai dati aperti</small>
              </span>
            </li>
          );
        }
        return (
          <li key={i} className="leg">
            <span>
              <strong>{modeLabel(p.mode)} {p.operator}</strong> da {p.from} a {p.to}: circa {duration(p.durationMin)}
              {p.waitMin > 0 && `, più ${duration(p.waitMin)} di attesa media`}
              <small>
                {p.service}. <a href={p.timetableUrl} target="_blank" rel="noopener">Orario ufficiale</a>,
                {' '}dati verificati il {new Date(`${p.verifiedOn}T12:00:00`).toLocaleDateString('it-IT')}.
              </small>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
