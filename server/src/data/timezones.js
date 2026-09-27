// Fuso orario principale di ogni paese coperto: serve a trasformare "le 6 del mattino del giorno scelto"
// in un orario UTC per Transitous. Canarie, Azzorre e Madera hanno un'ora in meno: per una ricerca
// "dalla mattina in poi" lo scarto è accettabile.
export const COUNTRY_TZ = {
  AT: 'Europe/Vienna', BE: 'Europe/Brussels', BG: 'Europe/Sofia', HR: 'Europe/Zagreb',
  CY: 'Asia/Nicosia', CZ: 'Europe/Prague', DK: 'Europe/Copenhagen', EE: 'Europe/Tallinn',
  FI: 'Europe/Helsinki', FR: 'Europe/Paris', DE: 'Europe/Berlin', GR: 'Europe/Athens',
  HU: 'Europe/Budapest', IE: 'Europe/Dublin', IT: 'Europe/Rome', LV: 'Europe/Riga',
  LT: 'Europe/Vilnius', LU: 'Europe/Luxembourg', MT: 'Europe/Malta', NL: 'Europe/Amsterdam',
  PL: 'Europe/Warsaw', PT: 'Europe/Lisbon', RO: 'Europe/Bucharest', SK: 'Europe/Bratislava',
  SI: 'Europe/Ljubljana', ES: 'Europe/Madrid', SE: 'Europe/Stockholm',
  IS: 'Atlantic/Reykjavik', NO: 'Europe/Oslo', LI: 'Europe/Vaduz', CH: 'Europe/Zurich',
  GB: 'Europe/London', AD: 'Europe/Andorra', MC: 'Europe/Monaco', SM: 'Europe/San_Marino',
  VA: 'Europe/Vatican', GI: 'Europe/Gibraltar', FO: 'Atlantic/Faroe', IM: 'Europe/Isle_of_Man',
  JE: 'Europe/Jersey', GG: 'Europe/Guernsey', AX: 'Europe/Mariehamn', SJ: 'Arctic/Longyearbyen',
  AL: 'Europe/Tirane', BA: 'Europe/Sarajevo', ME: 'Europe/Podgorica', MK: 'Europe/Skopje',
  RS: 'Europe/Belgrade', XK: 'Europe/Belgrade', MD: 'Europe/Chisinau', UA: 'Europe/Kyiv',
  TR: 'Europe/Istanbul',
};

// Minuti di scarto da UTC di un fuso in un certo istante (gestisce l'ora legale).
function offsetMinutes(timeZone, instant) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(instant).map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return (asUtc - instant.getTime()) / 60_000;
}

// "2026-10-13" + 6 in Italia → Date 2026-10-13T04:00:00Z
export function localTimeToUtc(date, hour, country) {
  const tz = COUNTRY_TZ[country] ?? 'Europe/Berlin';
  const naive = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00Z`);
  return new Date(naive.getTime() - offsetMinutes(tz, naive) * 60_000);
}
