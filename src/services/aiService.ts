/**
 * PediDose AI Assistant Client Service
 * Calls server-side Gemini endpoint; falls back gracefully to local database.
 */

import { StructuredMedicationAiResponse } from '../types/ai.ts';
import { resolveLocalDatabaseMatch } from '../engine/aiGrounding.ts';
import {
  cacheAiResponse,
  getCachedAiResponse,
  isNetworkOnline,
} from './offlineStorage.ts';

export interface AiQueryResult {
  data: StructuredMedicationAiResponse | null;
  error: string | null;
  source: 'gemini-3.8-flash' | 'local_database_fallback' | 'offline_cached' | string;
  notice?: string;
  isOffline?: boolean;
}

export async function queryAiAssistant(prompt: string): Promise<AiQueryResult> {
  const cleanPrompt = prompt.trim();
  if (!cleanPrompt) {
    return {
      data: null,
      error: 'Please enter a medication name or clinical question.',
      source: 'local_database_fallback',
    };
  }

  const isOnline = isNetworkOnline();

  // If offline, attempt immediate retrieval from offline cache first
  if (!isOnline) {
    const cached = await getCachedAiResponse(cleanPrompt);
    if (cached) {
      return {
        data: cached.response,
        error: null,
        source: 'offline_cached',
        notice: `Retrieved from offline local cache (Cached on ${new Date(cached.cachedAt).toLocaleDateString()}).`,
        isOffline: true,
      };
    }

    const localMatch = resolveLocalDatabaseMatch(cleanPrompt);
    if (localMatch) {
      return {
        data: localMatch,
        error: null,
        source: 'local_database_fallback',
        notice: 'Offline mode active: Resolved from verified local formulary database.',
        isOffline: true,
      };
    }

    return {
      data: null,
      error: `Offline mode: "${cleanPrompt}" is not cached or present in the offline verified formulary. Connect to the network or check medication spelling.`,
      source: 'local_database_fallback',
      isOffline: true,
    };
  }

  // Attempt online server query
  try {
    const res = await fetch('/api/gemini/assistant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: cleanPrompt }),
    });

    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}`);
    }

    const json = await res.json();
    if (json.success && json.data) {
      // Cache response for offline viewing
      await cacheAiResponse(cleanPrompt, json.data, json.source || 'gemini-3.8-flash');

      return {
        data: json.data,
        error: null,
        source: json.source || 'gemini-3.8-flash',
        notice: json.notice || 'Live verified pediatric database retrieval.',
        isOffline: false,
      };
    }

    return {
      data: null,
      error: json.error || 'Medicine not found in verified database. No unverified doses will be generated.',
      source: json.source || 'gemini-3.8-flash',
      isOffline: false,
    };
  } catch (err: any) {
    // If online query fails, check offline cache
    const cached = await getCachedAiResponse(cleanPrompt);
    if (cached) {
      return {
        data: cached.response,
        error: null,
        source: 'offline_cached',
        notice: `Database unavailable online; showing cached information (Cached on ${new Date(cached.cachedAt).toLocaleDateString()}).`,
        isOffline: true,
      };
    }

    // Fall back to client-side verified local database
    const localMatch = resolveLocalDatabaseMatch(cleanPrompt);
    if (localMatch) {
      await cacheAiResponse(cleanPrompt, localMatch, 'local_database_fallback');
      return {
        data: localMatch,
        error: null,
        source: 'local_database_fallback',
        notice: 'AI service unavailable online; resolved from verified offline database.',
        isOffline: true,
      };
    }

    return {
      data: null,
      error: `Unable to resolve "${cleanPrompt}". AI service is currently unavailable and no matching verified record exists in the local database.`,
      source: 'local_database_fallback',
      isOffline: !isOnline,
    };
  }
}
