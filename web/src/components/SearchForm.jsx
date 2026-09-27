import { useState } from 'react';
import { PlacePicker } from './PlacePicker.jsx';

// Nessuna priorità "più economico": i prezzi sono solo stime, non abbastanza per una classifica.
// "balanced" pesa di più cambi, tratti in auto e stime: per chi legge è il viaggio più comodo.
export const PRIORITIES = [
  { value: 'balanced', label: 'Più comodo', hint: 'meno cambi, niente auto se possibile' },
  { value: 'fastest', label: 'Più veloce', hint: 'il minor tempo porta a porta' },
];

const today = () => new Date().toISOString().slice(0, 10);

// La ricerca è una frase: "Da … a … il …". La priorità si sceglie dopo, sui risultati, senza nuova ricerca.
// initial: valori già scelti (l'esempio della prima pagina); per cambiarli il genitore rimonta il modulo con key.
export function SearchForm({ onSearch, busy, initial }) {
  const [origin, setOrigin] = useState(initial?.origin ?? null);
  const [destination, setDestination] = useState(initial?.destination ?? null);
  const [date, setDate] = useState(initial?.date ?? '');

  const ready = origin && destination && date && !busy;

  function submit(e) {
    e.preventDefault();
    if (ready) onSearch({ origin, destination, date, priority: 'balanced' });
  }

  return (
    <form className="search" onSubmit={submit}>
      <div className="sentence">
        <div className="line">
          <span className="word">Da</span>
          <PlacePicker label="Partenza" value={origin} onChange={setOrigin} placeholder="città o paese" />
        </div>
        <div className="line">
          <span className="word">a</span>
          <PlacePicker label="Destinazione" value={destination} onChange={setDestination} placeholder="destinazione" />
        </div>
        <div className="line">
          <span className="word">il</span>
          <span className="field date-field">
            <label htmlFor="date" className="sr-only">Data di partenza</label>
            <input id="date" type="date" required min={today()} value={date} onChange={(e) => setDate(e.target.value)} />
          </span>
        </div>
      </div>
      <div className="search-foot">
        <button type="submit" className="go" disabled={!ready}>
          {busy ? 'Cerco treni e bus per gli aeroporti…' : 'Trova il viaggio'}
        </button>
        <p className="hint">
          {busy
            ? 'Di solito servono da 5 a 20 secondi.'
            : 'Confrontiamo tutti gli aeroporti fino a 300 km da partenza e arrivo, con treni e bus per arrivarci e ripartire, e ti diciamo quanto costa più o meno.'}
        </p>
      </div>
    </form>
  );
}
