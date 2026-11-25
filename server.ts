import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DEFAULT_VILLAGE_LAT = 12.2958;
const DEFAULT_VILLAGE_LNG = 76.6394;

interface GroundedPlace {
  title: string;
  uri: string;
  placeId?: string;
  reviewSnippets: Array<{ text: string; uri?: string }>;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Exposes only the browser-facing Google Maps JavaScript API key if injected server-side.
  // Never exposes GEMINI_API_KEY or any server-side secrets.
  app.get('/api/config/maps', (_req, res) => {
    const apiKey =
      process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
    res.json({ apiKey });
  });

  // Server-side Gemini API + Google Maps Grounding for discovering nearby civic facilities
  app.post('/api/gemini/maps-grounding', async (req, res) => {
    const rawQuery = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
    if (rawQuery.length < 2 || rawQuery.length > 300) {
      res.status(400).json({ error: 'Please provide a search query between 2 and 300 characters.' });
      return;
    }

    const rawLat = Number(req.body?.lat);
    const rawLng = Number(req.body?.lng);
    const latitude =
      Number.isFinite(rawLat) && rawLat >= -90 && rawLat <= 90 ? rawLat : DEFAULT_VILLAGE_LAT;
    const longitude =
      Number.isFinite(rawLng) && rawLng >= -180 && rawLng <= 180 ? rawLng : DEFAULT_VILLAGE_LNG;

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      res.status(503).json({
        error: 'Gemini API key is not configured on the server.',
      });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey: geminiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      const prompt = [
        'You are helping a Gram Panchayat civic portal user find nearby real-world civic facilities, public services, or repair suppliers.',
        `User request: ${rawQuery}`,
        'Provide a concise, factual summary of the nearest relevant verified locations returned by Google Maps.',
        'Do not invent places, hours, or addresses that are not grounded in Google Maps results.',
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: {
              latLng: { latitude, longitude },
            },
          },
        },
      });

      const answer = response.text || '';
      const candidate = response.candidates?.[0];
      const groundingMeta = candidate?.groundingMetadata as
        | {
            groundingChunks?: Array<{
              maps?: {
                title?: string;
                uri?: string;
                placeId?: string;
                placeAnswerSources?: {
                  reviewSnippets?: Array<{
                    reviewText?: string;
                    text?: string;
                    googleMapsUri?: string;
                    uri?: string;
                  }>;
                };
              };
            }>;
          }
        | undefined;

      const places: GroundedPlace[] = [];
      const seenUris = new Set<string>();
      for (const chunk of groundingMeta?.groundingChunks || []) {
        const maps = chunk?.maps;
        if (!maps?.uri || seenUris.has(maps.uri)) continue;
        seenUris.add(maps.uri);

        const snippets = (maps.placeAnswerSources?.reviewSnippets || [])
          .map((s) => ({
            text: (s.reviewText || s.text || '').trim(),
            uri: s.googleMapsUri || s.uri,
          }))
          .filter((s) => s.text.length > 0);

        places.push({
          title: maps.title || 'View on Google Maps',
          uri: maps.uri,
          placeId: maps.placeId,
          reviewSnippets: snippets,
        });
      }

      res.json({
        answer,
        places,
        coordinates: { lat: latitude, lng: longitude },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Maps grounding lookup failed.';
      const status =
        typeof err === 'object' && err !== null && 'status' in err
          ? Number((err as { status?: unknown }).status)
          : undefined;
      const isQuota =
        status === 429 ||
        message.includes('RESOURCE_EXHAUSTED') ||
        message.includes('429') ||
        message.includes('quota');

      if (isQuota) {
        res.status(429).json({
          status: 'RESOURCE_EXHAUSTED',
          error: 'Quota exceeded while querying nearby places.',
        });
        return;
      }

      console.error('Maps grounding error:', err);
      res.status(500).json({
        error: 'Unable to fetch nearby civic places right now. Please try again shortly.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GramDev server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start GramDev server:', err);
  process.exit(1);
});
