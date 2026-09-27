import { useEffect, useRef, useState } from 'react';
import { WIDGET_TIMEOUT_MS } from '../config.js';

// Carica uno script-widget di Travelpayouts dentro un contenitore dedicato.
// Il widget si inserisce accanto al proprio <script>: a ogni cambio di src svuotiamo il
// contenitore (script + widget vecchi) prima di caricare il nuovo, così non si accumulano copie.
// Il genitore lo rimonta con una key diversa per ogni tratta, quindi lo stato riparte da 'loading'.
export function FlightWidget({ src, fallback }) {
  const box = useRef(null);
  const [status, setStatus] = useState('loading'); // loading | ready | failed

  useEffect(() => {
    const el = box.current;
    let done = false;
    const finish = (s) => { if (!done) { done = true; setStatus(s); } };

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.charset = 'utf-8';
    script.onerror = () => finish('failed'); // bloccato da adblock o rete assente
    el.replaceChildren(script);

    // Lo script può caricarsi ma non disegnare nulla (es. errore interno): lo capiamo dall'altezza.
    const observer = new ResizeObserver(() => { if (el.offsetHeight > 40) finish('ready'); });
    observer.observe(el);
    const timer = setTimeout(() => finish(el.offsetHeight > 40 ? 'ready' : 'failed'), WIDGET_TIMEOUT_MS);

    return () => {
      done = true;
      clearTimeout(timer);
      observer.disconnect();
      el.replaceChildren();
    };
  }, [src]);

  return (
    <div className="widget">
      {status === 'loading' && (
        <p className="hint"><span className="spinner" aria-hidden /> Caricamento del calendario prezzi…</p>
      )}
      {status === 'failed' && fallback}
      <div ref={box} className="widget-box" hidden={status === 'failed'} />
    </div>
  );
}
