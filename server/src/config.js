// Configurazione centralizzata letta dalle variabili d'ambiente.
const isProduction = process.env.NODE_ENV === 'production';

export const config = {
  isProduction,
  port: Number(process.env.PORT ?? 3001),
  databaseUrl: process.env.DATABASE_URL || null, // assente → PGlite locale, solo in sviluppo
  // Sale per l'hash degli IP nel limite ricerche: senza, dall'hash si risalirebbe all'IP provando tutti gli indirizzi.
  ipHashSecret: process.env.IP_HASH_SECRET ?? 'dev-only-secret-change-me',
  corsOrigin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:5173'],
  nominatimUserAgent:
    process.env.NOMINATIM_USER_AGENT ?? 'travelroute-dev/0.1 (sviluppo locale)',
  // Transitous (MOTIS) per le tratte via terra con cambi. Condizioni d'uso: progetto open source e non
  // commerciale, User-Agent con nome, versione e contatto, link a transitous.org/sources nel sito.
  // Senza TRANSITOUS_USER_AGENT riusa quello di Nominatim, che contiene già un contatto.
  transitous: {
    enabled: process.env.TRANSITOUS_ENABLED !== 'false',
    userAgent: process.env.TRANSITOUS_USER_AGENT
      || process.env.NOMINATIM_USER_AGENT
      || 'travelroute-dev/0.1 (sviluppo locale)',
    cacheHours: Number(process.env.GROUND_CACHE_HOURS ?? 24),
    airportsPerSide: Number(process.env.TRANSITOUS_AIRPORTS_PER_SIDE ?? 4),
  },
  // Ricerche itinerario al giorno per IP (non ci sono account).
  dailySearchLimit: Number(process.env.DAILY_SEARCHES ?? 15),
};

// In produzione niente fallback silenziosi: un DB su file locale sparirebbe al primo riavvio di Render.
const missing = [
  !config.databaseUrl && 'DATABASE_URL (connection string di Neon/Supabase)',
  config.ipHashSecret.startsWith('dev-only') && 'IP_HASH_SECRET',
  !process.env.NOMINATIM_USER_AGENT && 'NOMINATIM_USER_AGENT (con un contatto reale)',
].filter(Boolean);

if (isProduction && missing.length) {
  console.error(`\n✖ Avvio bloccato: variabili mancanti in produzione:\n  - ${missing.join('\n  - ')}\n`);
  process.exit(1);
}
