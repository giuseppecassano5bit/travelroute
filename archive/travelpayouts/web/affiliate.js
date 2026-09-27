// Link e widget di affiliazione Travelpayouts/Aviasales. Tutto ciò che porta a una prenotazione
// deve passare di qui, così il marker è sempre presente e la commissione viene attribuita.
import { TP_MARKER, TP_TRS } from './config.js';

const AVIASALES_PROGRAM_ID = '4114'; // parametro p dei link tp.media per il programma Aviasales
const CALENDAR_PROMO_ID = '4041'; // widget "Calendario prezzi" di Aviasales

// Pagina risultati Aviasales per una tratta di sola andata: /search/BRI2710VNO1 = BRI, 27/10, VNO, 1 adulto.
export function aviasalesSearchUrl({ from, to, date }) {
  const [, mm, dd] = date.split('-');
  const target = `https://www.aviasales.com/search/${from}${dd}${mm}${to}1`;
  if (!TP_MARKER) return target;
  if (!TP_TRS) return `${target}?marker=${encodeURIComponent(TP_MARKER)}`;
  const params = new URLSearchParams({
    marker: TP_MARKER, trs: TP_TRS, p: AVIASALES_PROGRAM_ID, u: target, campaign_id: '100',
  });
  return `https://tp.media/r?${params}`;
}

// Script del widget calendario prezzi per una coppia di aeroporti.
export function calendarWidgetSrc({ from, to }) {
  const params = new URLSearchParams({
    currency: 'eur', locale: 'it', searchUrl: 'www.aviasales.com/search',
    origin: from, destination: to, one_way: 'true', only_direct: 'false',
    period: 'year', range: '7,14', powered_by: 'false',
    promo_id: CALENDAR_PROMO_ID, campaign_id: '100',
  });
  if (TP_MARKER) params.set('shmarker', TP_MARKER);
  if (TP_TRS) params.set('trs', TP_TRS);
  return `https://tpembd.com/content?${params}`;
}
