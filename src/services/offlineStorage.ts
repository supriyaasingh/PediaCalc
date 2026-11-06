/**
 * PediDose Offline Clinical Decision Support Storage
 * IndexedDB and Local Storage Engine for reliable offline operation
 * in clinical settings with intermittent or no connectivity.
 */

import { MedicationRecord, DatabaseMetadata } from '../types/medication.ts';
import { MEDICATION_DATABASE, DATABASE_METADATA } from '../data/medicationDatabase.ts';
import { StructuredMedicationAiResponse } from '../types/ai.ts';

const DB_NAME = 'pedidose_offline_db';
const DB_VERSION = 1;

export interface OfflineMetadata extends DatabaseMetadata {
  lastSyncTimestamp: number;
  isOfflineReady: boolean;
  storageDriver: 'indexeddb' | 'localstorage' | 'memory';
}

export interface CachedAiItem {
  query: string;
  normalizedQuery: string;
  response: StructuredMedicationAiResponse;
  source: string;
  cachedAt: number;
}

// In-memory fallback if IndexedDB and localStorage are inaccessible
let memoryMedications: Record<string, MedicationRecord> = {};
let memoryMetadata: OfflineMetadata = {
  ...DATABASE_METADATA,
  lastSyncTimestamp: Date.now(),
  isOfflineReady: true,
  storageDriver: 'memory',
};
let memoryAiCache: Record<string, CachedAiItem> = {};

/**
 * Checks if browser IndexedDB is supported and accessible
 */
function isIndexedDbAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
  } catch {
    return false;
  }
}

/**
 * Opens the IndexedDB instance
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDbAvailable()) {
      return reject(new Error('IndexedDB is not available'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('medications')) {
        db.createObjectStore('medications', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('ai_cache')) {
        db.createObjectStore('ai_cache', { keyPath: 'normalizedQuery' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open database'));
  });
}

/**
 * Initializes and seeds the offline database with verified medication monographs
 */
export async function initOfflineDatabase(): Promise<OfflineMetadata> {
  // Always seed in-memory cache as immediate fallback
  MEDICATION_DATABASE.forEach((med) => {
    memoryMedications[med.id] = med;
  });

  if (!isIndexedDbAvailable()) {
    // Try localStorage fallback
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('pedidose_db_version', DATABASE_METADATA.version);
        window.localStorage.setItem('pedidose_db_last_updated', DATABASE_METADATA.lastUpdated);
        memoryMetadata.storageDriver = 'localstorage';
      }
    } catch {
      memoryMetadata.storageDriver = 'memory';
    }
    return memoryMetadata;
  }

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['medications', 'metadata'], 'readwrite');
      const medStore = tx.objectStore('medications');
      const metaStore = tx.objectStore('metadata');

      MEDICATION_DATABASE.forEach((med) => {
        medStore.put(med);
      });

      const meta: OfflineMetadata = {
        ...DATABASE_METADATA,
        lastSyncTimestamp: Date.now(),
        isOfflineReady: true,
        storageDriver: 'indexeddb',
      };

      metaStore.put({ key: 'main', ...meta });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    return {
      ...DATABASE_METADATA,
      lastSyncTimestamp: Date.now(),
      isOfflineReady: true,
      storageDriver: 'indexeddb',
    };
  } catch (err) {
    console.warn('[PediDose Offline] IndexedDB seeding warning, falling back to memory/local:', err);
    return memoryMetadata;
  }
}

/**
 * Retrieves all offline medications from storage
 */
export async function getOfflineMedications(): Promise<MedicationRecord[]> {
  if (!isIndexedDbAvailable()) {
    return Object.values(memoryMedications).length > 0
      ? Object.values(memoryMedications)
      : MEDICATION_DATABASE;
  }

  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('medications', 'readonly');
      const store = tx.objectStore('medications');
      const request = store.getAll();

      request.onsuccess = () => {
        if (request.result && request.result.length > 0) {
          resolve(request.result);
        } else {
          // If store is empty, seed and return bundled database
          initOfflineDatabase().then(() => resolve(MEDICATION_DATABASE));
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    return MEDICATION_DATABASE;
  }
}

/**
 * Retrieves a single medication by ID from offline storage
 */
export async function getOfflineMedicationById(id: string): Promise<MedicationRecord | null> {
  const all = await getOfflineMedications();
  return all.find((m) => m.id === id) || null;
}

/**
 * Retrieves database offline sync metadata
 */
export async function getOfflineMetadata(): Promise<OfflineMetadata> {
  if (!isIndexedDbAvailable()) {
    return memoryMetadata;
  }

  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction('metadata', 'readonly');
      const store = tx.objectStore('metadata');
      const request = store.get('main');

      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result);
        } else {
          resolve({
            ...DATABASE_METADATA,
            lastSyncTimestamp: Date.now(),
            isOfflineReady: true,
            storageDriver: 'indexeddb',
          });
        }
      };
      request.onerror = () => resolve(memoryMetadata);
    });
  } catch {
    return memoryMetadata;
  }
}

/**
 * Caches an AI assistant response locally for offline viewing
 */
export async function cacheAiResponse(
  query: string,
  response: StructuredMedicationAiResponse,
  source: string
): Promise<void> {
  const normalizedQuery = query.trim().toLowerCase();
  const item: CachedAiItem = {
    query,
    normalizedQuery,
    response,
    source,
    cachedAt: Date.now(),
  };

  memoryAiCache[normalizedQuery] = item;

  if (!isIndexedDbAvailable()) return;

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('ai_cache', 'readwrite');
      const store = tx.objectStore('ai_cache');
      store.put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[PediDose Offline] Unable to persist AI cache to IndexedDB:', err);
  }
}

/**
 * Retrieves a cached AI assistant response for a given query
 */
export async function getCachedAiResponse(query: string): Promise<CachedAiItem | null> {
  const normalizedQuery = query.trim().toLowerCase();

  // Check memory cache first
  if (memoryAiCache[normalizedQuery]) {
    return memoryAiCache[normalizedQuery];
  }

  if (!isIndexedDbAvailable()) return null;

  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction('ai_cache', 'readonly');
      const store = tx.objectStore('ai_cache');
      const request = store.get(normalizedQuery);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Checks connectivity status reliably
 */
export function isNetworkOnline(): boolean {
  if (typeof window !== 'undefined' && typeof window.navigator !== 'undefined') {
    return window.navigator.onLine !== false;
  }
  return true;
}
