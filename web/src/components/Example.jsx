// Un viaggio vero calcolato dal sito (lunedì 28 settembre 2026), per far vedere subito che cosa si ottiene.
// Numeri copiati dal risultato: se cambiano i dati si aggiorna a mano, non è un risultato in tempo reale.
const EXAMPLE = {
  origin: { id: 'g3175860', name: 'Gravina in Puglia', region: 'Apulia', country: 'IT', lat: 40.8175, lon: 16.4191 },
  destination: { id: 'g730565', name: 'Karlovo', region: 'Plovdiv', country: 'BG', lat: 42.6333, lon: 24.8 },
};

const STEPS = [
  { stop: 'Gravina in Puglia' },
  { mode: 'known', text: 'Treno FAL fino a Bari, poi treno per l\'aeroporto', time: '2 h 15 min', price: '10,60 €' },
  { stop: 'Aeroporto di Bari' },
  { mode: 'wait', text: 'In aeroporto', time: '2 h' },
  { mode: 'air', text: 'Volo per Sofia', time: 'circa 1 h 15 min', price: '20–75 €' },
  { stop: 'Aeroporto di Sofia' },
  { mode: 'rail', text: 'Metro M4 e treno BDŽ per Karlovo', time: '2 h 18 min', price: '6–16 €' },
  { stop: 'Karlovo, Bulgaria', end: true },
];

// Il prossimo lunedì: l'esempio è calcolato di lunedì (la FAL non circola la domenica).
function nextMonday() {
  const d = new Date();
  d.setDate(d.getDate() + (((8 - d.getDay()) % 7) || 7));
  return d.toISOString().slice(0, 10);
}

export function Example({ onUse }) {
  return (
    <aside className="example" aria-labelledby="example-title">
      <h2 id="example-title" className="example-title">Un viaggio calcolato da noi</h2>
      <p className="example-sub">Da un paese della Murgia a una cittadina bulgara, un lunedì.</p>
      <ol className="mini-route">
        {STEPS.map((s, i) => (s.stop
          ? <li key={i} className={`mini-stop${s.end ? ' end' : ''}${i === 0 ? ' start' : ''}`}><span className="rail" aria-hidden />{s.stop}</li>
          : (
            <li key={i} className={`mini-seg ${s.mode}`}>
              <span className="rail" aria-hidden />
              <span className="mini-text">{s.text}<small>{s.time}</small></span>
              {s.price && <span className="mini-price">{s.price}</span>}
            </li>
          )))}
      </ol>
      <p className="example-total">
        <strong>8 h 19 min</strong> porta a porta, <strong>circa 35–100 €</strong> a persona
      </p>
      <button type="button" className="ghost" onClick={() => onUse({ ...EXAMPLE, date: nextMonday() })}>
        Usa questo esempio nella ricerca
      </button>
    </aside>
  );
}
