// Paesi coperti dal servizio (codici ISO 3166-1 alpha-2, come in GeoNames e OurAirports).
// Russia (RU) e Bielorussia (BY) sono escluse del tutto: spazio aereo chiuso ai vettori UE.
export const EUROPE_COUNTRIES = new Set([
  // Unione Europea
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT',
  'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  // SEE, Svizzera, Regno Unito e microstati
  'IS', 'NO', 'LI', 'CH', 'GB', 'AD', 'MC', 'SM', 'VA',
  // Territori con codice proprio
  'GI', 'FO', 'IM', 'JE', 'GG', 'AX', 'SJ',
  // Balcani, Est Europa, Turchia
  'AL', 'BA', 'ME', 'MK', 'RS', 'XK', 'MD', 'UA', 'TR',
]);

// Paesi raggiungibili via terra ma senza voli civili operativi: i luoghi restano selezionabili,
// gli aeroporti no (per l'Ucraina si arriva da scali in Polonia, Romania, Moldavia…).
export const NO_FLIGHT_COUNTRIES = new Set(['UA']);
