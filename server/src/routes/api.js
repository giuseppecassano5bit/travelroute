import { Router } from 'express';
import { z } from 'zod';
import { searchPlaces } from '../services/places.js';
import { resolvePlace } from '../services/geocode.js';
import { planTrip } from '../services/itinerary.js';
import { PRIORITIES } from '../services/ranking.js';
import { searchQuota } from '../middleware/searchQuota.js';
import { query } from '../db/index.js';

export const api = Router();

// Ricerca sul dataset locale: è l'unico endpoint usato mentre l'utente digita.
api.get('/places', (req, res) => {
  const q = z.string().trim().min(2).max(80).safeParse(req.query.q);
  if (!q.success) return res.status(400).json({ error: 'Parametro q non valido' });
  res.set('Cache-Control', 'public, max-age=86400');
  res.json(searchPlaces(q.data));
});

// Fallback Nominatim, solo su azione esplicita dell'utente (mai in autocomplete).
api.post('/places/resolve', async (req, res) => {
  const q = z.object({ q: z.string().trim().min(3).max(120) }).safeParse(req.body);
  if (!q.success) return res.status(400).json({ error: 'Testo da cercare non valido' });
  res.json(await resolvePlace(q.data.q));
});

// Il frontend invia sempre le coordinate del luogo scelto, mai solo il nome:
// "Gravina" in Puglia e "Gravina" di Catania sono luoghi diversi.
const place = z.object({
  id: z.string().max(40),
  name: z.string().trim().min(1).max(120),
  region: z.string().max(120).optional(),
  country: z.string().length(2),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

const futureDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((d) => Date.parse(d) >= Date.parse(new Date().toISOString().slice(0, 10)), 'Data nel passato');

const searchBody = z.object({
  origin: place,
  destination: place,
  date: futureDate,
  priority: z.enum(PRIORITIES).default('balanced'),
});

api.post('/search', searchQuota, async (req, res) => {
  const body = searchBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: z.prettifyError(body.error) });

  const trip = await planTrip(body.data);
  await query(
    'INSERT INTO search_log (origin, destination, travel_date, priority) VALUES ($1, $2, $3, $4)',
    [JSON.stringify(body.data.origin), JSON.stringify(body.data.destination), body.data.date, body.data.priority],
  );
  res.json(trip);
});
