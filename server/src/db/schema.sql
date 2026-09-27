-- Contatore ricerche per soggetto e giorno. Sta nel DB (non in memoria) così sopravvive ai riavvii.
-- subject = 'ip:<hash troncato con sale>': niente account, niente IP in chiaro.
CREATE TABLE IF NOT EXISTS search_usage (
  subject TEXT NOT NULL,
  day DATE NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (subject, day)
);

-- Cache permanente delle risposte Nominatim: la stessa query non viene mai richiesta due volte.
CREATE TABLE IF NOT EXISTS geocode_cache (
  query_key TEXT PRIMARY KEY,
  results JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Log anonimo delle ricerche (niente IP né email), utile per statistiche e SEO sulle tratte richieste.
CREATE TABLE IF NOT EXISTS search_log (
  id SERIAL PRIMARY KEY,
  origin JSONB NOT NULL,
  destination JSONB NOT NULL,
  travel_date DATE NOT NULL,
  priority TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cache delle tratte via terra calcolate da Transitous (condizioni d'uso: essere leggeri sulle loro risorse).
-- key = coordinate arrotondate di partenza e arrivo + data. result è NULL quando non c'è alcun collegamento:
-- memorizziamo anche il "nessun dato" per non ripetere la stessa richiesta.
CREATE TABLE IF NOT EXISTS ground_cache (
  key TEXT PRIMARY KEY,
  result JSONB,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
