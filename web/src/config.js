// Nome provvisorio: quando scegliamo quello definitivo si cambia solo qui (e in index.html).
export const APP_NAME = 'TravelRoute';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

// Oltre questa attesa mostriamo l'avviso "il server si sta svegliando" (cold start di Render).
export const SLOW_REQUEST_MS = 3000;

// Repository pubblico del codice (AGPL-3.0: chi usa il sito deve poter avere i sorgenti). Link nel footer.
export const SOURCE_URL = import.meta.env.VITE_SOURCE_URL || null;
