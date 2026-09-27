import { useEffect, useState } from 'react';
import { api, onSlowChange } from './api.js';
import { APP_NAME, SOURCE_URL } from './config.js';
import { SearchForm } from './components/SearchForm.jsx';
import { Results } from './components/Results.jsx';
import { Example } from './components/Example.jsx';
import { Legend } from './components/Legend.jsx';
import { LogoMark } from './components/Logo.jsx';

export default function App() {
  const [trip, setTrip] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [slow, setSlow] = useState(false);
  const [preset, setPreset] = useState({ key: 0, values: null });

  useEffect(() => {
    const off = onSlowChange(setSlow);
    api.wake().catch(() => {}); // sveglia il server mentre l'utente compila il modulo
    return off;
  }, []);

  async function search(params) {
    setBusy(true);
    setError('');
    try {
      setTrip(await api.search(params));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const loadExample = (values) => setPreset((p) => ({ key: p.key + 1, values }));

  return (
    <>
      <header className="site-header">
        <a className="brand" href="/" aria-label={`${APP_NAME}, pagina iniziale`}>
          <LogoMark />
          <span className="logo">{APP_NAME}</span>
        </a>
        <nav className="site-nav" aria-label="Informazioni">
          <a href="#come-leggere">Come leggere il viaggio</a>
          <a href="#fonti">Da dove vengono i dati</a>
          {SOURCE_URL && <a href={SOURCE_URL} target="_blank" rel="noreferrer">Codice sorgente</a>}
        </nav>
      </header>

      <main>
        <section className={`hero${trip ? ' with-results' : ''}`}>
          <div className="hero-search">
            <h1 className="hero-title">Il viaggio intero, da porta a porta</h1>
            <p className="hero-lead">
              Treni e bus per l'aeroporto, il volo, e di nuovo treni e bus fino all'arrivo, in tutta Europa.
              Con i tempi del giorno che scegli e quanto costa più o meno.
            </p>
            <SearchForm key={preset.key} initial={preset.values} onSearch={search} busy={busy} />
          </div>
          {!trip && <Example onUse={loadExample} />}
        </section>

        {slow && (
          <div className="notice" role="status">
            <span className="spinner" aria-hidden />
            Il server si sta avviando: la prima ricerca può richiedere fino a un minuto.
          </div>
        )}
        {error && <p className="error-box" role="alert">{error}</p>}
        {trip && <Results key={`${trip.origin.id}|${trip.destination.id}|${trip.date}`} trip={trip} />}

        <section id="come-leggere" className="info">
          <h2>Come leggere il viaggio</h2>
          <p className="info-lead">
            Ogni viaggio è una linea, come sulle mappe dei treni. Il tipo di tratto ti dice anche quanto è sicuro il dato.
          </p>
          <Legend />
        </section>

        <section id="fonti" className="info sources">
          <h2>Da dove vengono i dati</h2>
          <dl>
            <div>
              <dt>Treni, bus, tram e metro</dt>
              <dd>
                Orari del giorno scelto da <a href="https://transitous.org" target="_blank" rel="noreferrer">Transitous</a>,
                che raccoglie i dati aperti di centinaia di aziende di trasporto europee (per l'Italia Trenitalia e le reti
                di molte città e regioni). Dove un'azienda manca usiamo il suo orario ufficiale e lo scriviamo.
              </dd>
            </div>
            <div>
              <dt>Prezzi</dt>
              <dd>
                Stime a persona, sola andata: tariffe regionali ufficiali per treni e bus (per esempio la tariffa Trenitalia
                Puglia 2026), il prezzo medio dei voli low cost per gli aerei, i prezzi Eurostat per gli altri paesi.
                Il prezzo vero lo vedi sul sito di chi vende il biglietto.
              </dd>
            </div>
            <div>
              <dt>Voli</dt>
              <dd>
                Non abbiamo gli orari dei voli: stimiamo durata e prezzo dalla distanza e ti mandiamo su Google Voli
                e Skyscanner per quelli veri. Nessun link è pubblicitario.
              </dd>
            </div>
            <div>
              <dt>Luoghi e aeroporti</dt>
              <dd>
                <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a> (CC BY 4.0),{' '}
                <a href="https://ourairports.com/" target="_blank" rel="noreferrer">OurAirports</a> e, se lo chiedi,{' '}
                <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>.
              </dd>
            </div>
          </dl>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-brand">
          <LogoMark size={24} />
          <p>
            {APP_NAME} è un progetto gratuito, non commerciale e open source: nessuna pubblicità, nessun link di
            affiliazione, nessun account. Per limitare il numero di ricerche al giorno conserviamo solo un'impronta
            cifrata del tuo indirizzo IP.
            {SOURCE_URL && (
              <> <a href={SOURCE_URL} target="_blank" rel="noreferrer">Codice sorgente</a> con licenza AGPL-3.0.</>
            )}
          </p>
        </div>
        <p>
          Orari dei mezzi pubblici da <a href="https://transitous.org" target="_blank" rel="noreferrer">Transitous</a> (MOTIS),
          con i dati delle <a href="https://transitous.org/sources/" target="_blank" rel="noreferrer">fonti elencate qui</a> e
          i rispettivi termini di licenza. Luoghi da GeoNames (CC BY 4.0), aeroporti da OurAirports, ricerca indirizzi
          © contributori OpenStreetMap. Prezzi dei trasporti per paese: Eurostat.
        </p>
      </footer>
    </>
  );
}
