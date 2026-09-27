// Legenda della linea del viaggio, come su una mappa: dice anche quanto fidarsi di ogni tratto.
const ITEMS = [
  ['rail', 'Treni, bus, tram e metro', 'orari reali del giorno scelto, dai dati aperti'],
  ['known', 'Treni che mancano nei dati aperti', 'durata e prezzo dall\'orario ufficiale'],
  ['air', 'Volo', 'durata e prezzo stimati dalla distanza'],
  ['car', 'Auto', 'dove non troviamo mezzi pubblici: tempo e costo stimati'],
  ['wait', 'Attesa in aeroporto', '2 ore prima del volo, 30 minuti dopo'],
];

export function Legend({ compact }) {
  return (
    <ul className={`legend${compact ? ' compact' : ''}`}>
      {ITEMS.map(([mode, name, trust]) => (
        <li key={mode}>
          <span className={`swatch ${mode}`} aria-hidden />
          <span><strong>{name}</strong> {trust}</span>
        </li>
      ))}
    </ul>
  );
}
