import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import {
  buildDatabaseGroundingSummary,
  resolveLocalDatabaseMatch,
} from './src/engine/aiGrounding.ts';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// API health endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    app: 'PediDose',
    version: '2.0.0',
    hasApiKey: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// Server-side Gemini AI Clinical Assistant endpoint
app.post('/api/gemini/assistant', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt string is required.' });
  }

  const cleanQuery = prompt.trim();
  const apiKey = process.env.GEMINI_API_KEY;

  // If no Gemini API Key is configured, seamlessly resolve via verified local database
  if (!apiKey) {
    const localMatch = resolveLocalDatabaseMatch(cleanQuery);
    if (localMatch) {
      return res.json({
        success: true,
        data: localMatch,
        source: 'local_database_fallback',
        notice: 'Resolved using verified local clinical database (Gemini API key not configured).',
      });
    }
    return res.json({
      success: false,
      error: 'No matching medication found in verified database.',
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const groundingContext = buildDatabaseGroundingSummary();

    const systemInstruction = `You are the clinical decision-support AI informatics engine for PediDose.
Your task is to parse pediatric medication queries, understand brand/generic names, correct spelling, and match the query to the VERIFIED PEDIATRIC DATABASE below.

MANDATORY CLINICAL SAFETY RULES:
1. NEVER invent, extrapolate, or hallucinate pediatric drug dosages, frequencies, or caps.
2. Dosing numbers (dosePerKg, dosesPerDay, maxSingleDose, maxDailyDose) MUST match the verified database exactly.
3. If information is not present in the verified database, you MUST return null for that field.
4. Output strictly structured JSON conforming to the schema.

${groundingContext}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Parse and extract clinical pediatric medication information for this user query: "${cleanQuery}". Return the matched verified medication record.`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            genericName: { type: Type.STRING },
            brandNames: { type: Type.ARRAY, items: { type: Type.STRING } },
            category: { type: Type.STRING },
            activeIngredients: { type: Type.ARRAY, items: { type: Type.STRING } },
            formulations: { type: Type.ARRAY, items: { type: Type.STRING } },
            indication: { type: Type.STRING },
            doseBasis: { type: Type.STRING, description: 'Must be mg/kg/day or mg/kg/dose or fixed_dose' },
            dosePerKg: { type: Type.NUMBER, nullable: true },
            frequency: { type: Type.STRING },
            dosesPerDay: { type: Type.INTEGER, nullable: true },
            maximumSingleDose: { type: Type.NUMBER, nullable: true },
            maximumDailyDose: { type: Type.NUMBER, nullable: true },
            route: { type: Type.STRING },
            ageRestrictions: { type: Type.ARRAY, items: { type: Type.STRING } },
            referenceSource: { type: Type.STRING },
            verificationStatus: { type: Type.STRING },
            clinicalExplanation: { type: Type.STRING },
          },
          required: [
            'genericName',
            'brandNames',
            'category',
            'activeIngredients',
            'formulations',
            'indication',
            'doseBasis',
            'frequency',
            'route',
            'verificationStatus',
          ],
        },
      },
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error('Empty response received from Gemini.');
    }

    const parsedData = JSON.parse(textOutput);
    return res.json({
      success: true,
      data: parsedData,
      source: 'gemini-3.8-flash',
    });
  } catch (error: any) {
    console.warn('[PediDose AI Engine] Gemini API error, engaging verified database fallback:', error?.message);

    // Graceful fallback to verified local database
    const localMatch = resolveLocalDatabaseMatch(cleanQuery);
    if (localMatch) {
      return res.json({
        success: true,
        data: localMatch,
        source: 'local_database_fallback',
        notice: 'Resolved using verified local clinical database (Gemini API fallback).',
      });
    }

    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to process AI medication query.',
    });
  }
});

async function startServer() {
  const publicDir = path.resolve(__dirname, 'public');
  app.use(
    express.static(publicDir, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('sw.js')) {
          res.setHeader('Service-Worker-Allowed', '/');
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        } else if (filePath.endsWith('manifest.json') || filePath.endsWith('manifest.webmanifest')) {
          res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
          res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        }
      },
    })
  );

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[PediDose] Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[PediDose] Server startup error:', err);
  process.exit(1);
});
