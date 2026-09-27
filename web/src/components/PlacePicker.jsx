import { useEffect, useId, useRef, useState } from 'react';
import { api } from '../api.js';
import { flag, placeDetail } from '../format.js';

// Campo di ricerca luogo. I suggerimenti mentre si digita arrivano dal dataset locale del nostro
// server; OpenStreetMap (Nominatim) si interroga solo se l'utente lo chiede con l'apposito pulsante.
export function PlacePicker({ label, value, onChange, placeholder }) {
  const id = useId();
  const [text, setText] = useState(value ? value.name : '');
  const [options, setOptions] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState('idle'); // idle | loading | resolving | error
  const [error, setError] = useState('');
  const [fromOsm, setFromOsm] = useState(false);
  const skipNextSearch = useRef(!!value); // un luogo già scelto (es. l'esempio) non va ricercato

  useEffect(() => {
    if (skipNextSearch.current) { skipNextSearch.current = false; return; }
    const q = text.trim();
    if (q.length < 2) return; // il menu è comunque nascosto sotto i 2 caratteri
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setStatus('loading');
      try {
        setOptions(await api.searchPlaces(q, ctrl.signal));
        setFromOsm(false);
        setActive(0);
        setStatus('idle');
      } catch (e) {
        if (e.name !== 'AbortError') { setStatus('error'); setError(e.message); }
      }
    }, 200);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [text]);

  function choose(place) {
    skipNextSearch.current = true;
    setText(place.name);
    setOpen(false);
    onChange(place);
  }

  async function searchOsm() {
    setStatus('resolving');
    try {
      const results = await api.resolvePlace(text.trim());
      setOptions(results);
      setFromOsm(true);
      setActive(0);
      setStatus('idle');
      if (!results.length) { setStatus('error'); setError('Nessun risultato neanche su OpenStreetMap.'); }
    } catch (e) {
      setStatus('error');
      setError(e.message);
    }
  }

  function onKeyDown(e) {
    if (!open || !options.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % options.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i - 1 + options.length) % options.length); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(options[active]); }
    else if (e.key === 'Escape') setOpen(false);
  }

  const listId = `${id}-list`;
  const canSearchOsm = text.trim().length >= 3 && status !== 'loading' && !fromOsm;

  return (
    <div className="field place-picker">
      <label htmlFor={id} className="sr-only">{label}</label>
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        value={text}
        placeholder={placeholder}
        onChange={(e) => { setText(e.target.value); setOpen(true); if (value) onChange(null); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
      />
      {value && <p className="picked">{placeDetail(value)} {flag(value.country)}</p>}

      {open && text.trim().length >= 2 && (
        <div className="dropdown">
          <ul id={listId} role="listbox">
            {options.map((p, i) => (
              <li
                key={p.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => { e.preventDefault(); choose(p); }}
                onMouseEnter={() => setActive(i)}
              >
                <span className="flag" aria-hidden>{flag(p.country)}</span>
                <span>
                  <strong>{p.name}</strong>
                  <small>{fromOsm && p.label ? p.label : placeDetail(p)}</small>
                </span>
              </li>
            ))}
          </ul>
          {status === 'loading' && !options.length && <p className="hint">Cerco…</p>}
          {status === 'error' && <p className="hint error">{error}</p>}
          {canSearchOsm && (
            <button type="button" className="osm-button" onMouseDown={(e) => e.preventDefault()} onClick={searchOsm}>
              {status === 'resolving'
                ? 'Ricerca su OpenStreetMap…'
                : <>Non trovi il luogo? Cerca «{text.trim()}» su OpenStreetMap</>}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
