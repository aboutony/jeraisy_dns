/* ============================================================
   JERAISY DNS — Offline-First Sync Queue
   IndexedDB-backed queue for factory dead-zone resilience.
   Auto-flushes when connection restores.
   ============================================================ */

import type { QueueEntry, QueueStatus } from '../store/types';

// ── IndexedDB Constants ───────────────────────────────────────
const DB_NAME = 'jeraisy-dns-sync';
const DB_VERSION = 1;
const STORE_NAME = 'queue';
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 2000;

// ── IndexedDB Helper ──────────────────────────────────────────
function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('status', 'status', { unique: false });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// ── Generate Unique ID ────────────────────────────────────────
function generateId(): string {
    return `q-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// ── Sync Queue Service ────────────────────────────────────────
export const SyncQueue = {

    /**
     * Enqueue an operation for offline sync.
     * The entry is persisted to IndexedDB immediately.
     */
    async enqueue(
        endpoint: string,
        method: 'GET' | 'POST' | 'PUT' | 'PATCH',
        payload: unknown
    ): Promise<QueueEntry> {
        const entry: QueueEntry = {
            id: generateId(),
            timestamp: new Date().toISOString(),
            endpoint,
            method,
            payload,
            retryCount: 0,
            maxRetries: MAX_RETRIES,
            status: 'pending',
        };

        try {
            const db = await openDatabase();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(entry);
            await new Promise<void>((resolve, reject) => {
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
            db.close();
        } catch (error) {
            console.error('[SyncQueue] Failed to enqueue:', error);
            // Fallback to memory-only (will be lost on reload)
        }

        console.log(`[SyncQueue] Enqueued: ${method} ${endpoint} (id: ${entry.id})`);
        return entry;
    },

    /**
     * Get all pending entries from the queue.
     */
    async getPending(): Promise<QueueEntry[]> {
        try {
            const db = await openDatabase();
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const index = store.index('status');
            const request = index.getAll('pending');

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    db.close();
                    resolve(request.result as QueueEntry[]);
                };
                request.onerror = () => {
                    db.close();
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('[SyncQueue] Failed to get pending entries:', error);
            return [];
        }
    },

    /**
     * Update a queue entry's status.
     */
    async updateStatus(id: string, status: QueueStatus, errorMessage?: string): Promise<void> {
        try {
            const db = await openDatabase();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const getRequest = store.get(id);

            await new Promise<void>((resolve, reject) => {
                getRequest.onsuccess = () => {
                    const entry = getRequest.result as QueueEntry;
                    if (entry) {
                        entry.status = status;
                        if (errorMessage) entry.errorMessage = errorMessage;
                        if (status === 'processing') entry.retryCount++;
                        store.put(entry);
                    }
                    resolve();
                };
                getRequest.onerror = () => reject(getRequest.error);
            });

            await new Promise<void>((resolve, reject) => {
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
            db.close();
        } catch (error) {
            console.error(`[SyncQueue] Failed to update entry ${id}:`, error);
        }
    },

    /**
     * Remove completed entries from the queue.
     */
    async clearCompleted(): Promise<string[]> {
        const cleared: string[] = [];
        try {
            const db = await openDatabase();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const index = store.index('status');
            const request = index.getAll('completed');

            await new Promise<void>((resolve, reject) => {
                request.onsuccess = () => {
                    const entries = request.result as QueueEntry[];
                    entries.forEach((entry) => {
                        store.delete(entry.id);
                        cleared.push(entry.id);
                    });
                    resolve();
                };
                request.onerror = () => reject(request.error);
            });

            await new Promise<void>((resolve, reject) => {
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
            db.close();
        } catch (error) {
            console.error('[SyncQueue] Failed to clear completed:', error);
        }
        return cleared;
    },

    /**
     * Flush the queue: process all pending entries sequentially.
     * Called automatically when connection restores, or manually via UI.
     * Uses the provided executor function to actually send the requests.
     */
    async flush(
        executor: (entry: QueueEntry) => Promise<boolean>
    ): Promise<{ processed: number; failed: number }> {
        const pending = await this.getPending();
        let processed = 0;
        let failed = 0;

        console.log(`[SyncQueue] Flushing ${pending.length} pending entries...`);

        for (const entry of pending) {
            if (entry.retryCount >= entry.maxRetries) {
                await this.updateStatus(entry.id, 'failed', 'Max retries exceeded');
                failed++;
                continue;
            }

            await this.updateStatus(entry.id, 'processing');

            try {
                const success = await executor(entry);
                if (success) {
                    await this.updateStatus(entry.id, 'completed');
                    processed++;
                } else {
                    // Exponential backoff delay before next attempt
                    const delay = RETRY_BASE_DELAY_MS * Math.pow(2, entry.retryCount);
                    await new Promise((resolve) => setTimeout(resolve, delay));
                    await this.updateStatus(entry.id, 'pending', 'Execution returned false');
                    failed++;
                }
            } catch (error) {
                const msg = error instanceof Error ? error.message : 'Unknown error';
                await this.updateStatus(entry.id, 'pending', msg);
                failed++;
            }
        }

        // Clean up completed entries
        if (processed > 0) {
            await this.clearCompleted();
        }

        console.log(`[SyncQueue] Flush complete: ${processed} processed, ${failed} failed`);
        return { processed, failed };
    },

    /**
     * Get queue statistics for the UI status bar.
     */
    async getStats(): Promise<{ pending: number; failed: number; total: number }> {
        try {
            const db = await openDatabase();
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const allRequest = store.getAll();

            return new Promise((resolve, reject) => {
                allRequest.onsuccess = () => {
                    db.close();
                    const entries = allRequest.result as QueueEntry[];
                    resolve({
                        pending: entries.filter((e) => e.status === 'pending').length,
                        failed: entries.filter((e) => e.status === 'failed').length,
                        total: entries.length,
                    });
                };
                allRequest.onerror = () => {
                    db.close();
                    reject(allRequest.error);
                };
            });
        } catch {
            return { pending: 0, failed: 0, total: 0 };
        }
    },
};

// ── Auto-Flush Listener ───────────────────────────────────────
// Automatically flush the queue when the browser comes back online.
if (typeof window !== 'undefined') {
    window.addEventListener('online', async () => {
        console.log('[SyncQueue] Connection restored — auto-flushing queue...');
        const { processed, failed } = await SyncQueue.flush(async (entry) => {
            // Dynamic import to avoid circular dependency
            const { default: axios } = await import('axios');
            try {
                const url = `${import.meta.env.VITE_ORACLE_API_URL || 'https://api.jeraisy.sa/oracle/v1'}${entry.endpoint}`;
                await axios({ method: entry.method.toLowerCase(), url, data: entry.payload });
                return true;
            } catch {
                return false;
            }
        });
        console.log(`[SyncQueue] Auto-flush result: ${processed} synced, ${failed} pending`);
    });
}

export default SyncQueue;
