/**
 * PiArt Permanent Storage Manager (IndexedDB + SQLite Backend Dual-Persistence)
 * Provides persistent memory across browser reloads, pauses, and restarts.
 */

class PiStorageManager {
  constructor() {
    this.dbName = 'PiArtPermanentDB';
    this.dbVersion = 1;
    this.idb = null;
    this.isIDBReady = false;
    this.lastSavedDigitCount = 0;
    this.isSaving = false;
    this.onStatusChangeCallbacks = [];
  }

  async init() {
    return new Promise((resolve) => {
      if (!window.indexedDB) {
        console.warn("IndexedDB not supported, falling back to SQLite and memory only.");
        resolve(false);
        return;
      }

      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('chunks')) {
          const chunkStore = db.createObjectStore('chunks', { keyPath: 'chunkId', autoIncrement: true });
          chunkStore.createIndex('startIdx', 'startIdx', { unique: false });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      };

      request.onsuccess = (e) => {
        this.idb = e.target.result;
        this.isIDBReady = true;
        resolve(true);
      };

      request.onerror = (e) => {
        console.warn("IndexedDB open error:", e);
        resolve(false);
      };
    });
  }

  onStatusChange(callback) {
    this.onStatusChangeCallbacks.push(callback);
  }

  notifyStatus(status) {
    for (const cb of this.onStatusChangeCallbacks) {
      cb(status);
    }
  }

  // Save chunk and streamer state into IndexedDB
  async saveToIDB(startIdx, digitStr, streamerState, totalDigits) {
    if (!this.isIDBReady || !this.idb) return false;

    return new Promise((resolve) => {
      try {
        const tx = this.idb.transaction(['chunks', 'meta'], 'readwrite');
        const chunkStore = tx.objectStore('chunks');
        const metaStore = tx.objectStore('meta');

        if (digitStr && digitStr.length > 0) {
          chunkStore.add({
            startIdx: startIdx,
            length: digitStr.length,
            digits: digitStr,
            createdAt: Date.now()
          });
        }

        if (streamerState) {
          metaStore.put({ key: 'streamer_state', value: streamerState });
        }
        if (totalDigits !== undefined) {
          metaStore.put({ key: 'total_digits', value: totalDigits });
        }
        metaStore.put({ key: 'last_saved', value: Date.now() });

        tx.oncomplete = () => resolve(true);
        tx.onerror = (err) => {
          console.warn("IDB transaction error:", err);
          resolve(false);
        };
      } catch (err) {
        console.warn("IDB save error:", err);
        resolve(false);
      }
    });
  }

  // Load everything from IndexedDB
  async loadFromIDB() {
    if (!this.isIDBReady || !this.idb) return null;

    return new Promise((resolve) => {
      try {
        const tx = this.idb.transaction(['chunks', 'meta'], 'readonly');
        const chunkStore = tx.objectStore('chunks');
        const metaStore = tx.objectStore('meta');

        const chunksReq = chunkStore.getAll();
        const stateReq = metaStore.get('streamer_state');
        const totalReq = metaStore.get('total_digits');

        tx.oncomplete = () => {
          const chunks = chunksReq.result || [];
          // Sort chunks by startIdx
          chunks.sort((a, b) => a.startIdx - b.startIdx);
          
          let fullDigitsStr = "";
          for (const chunk of chunks) {
            fullDigitsStr += chunk.digits;
          }

          const streamerState = stateReq.result ? stateReq.result.value : null;
          const totalDigits = totalReq.result ? totalReq.result.value : fullDigitsStr.length;

          if (fullDigitsStr.length > 0 || streamerState) {
            resolve({
              digits: fullDigitsStr,
              streamerState: streamerState,
              totalDigits: fullDigitsStr.length || totalDigits,
              source: 'indexeddb'
            });
          } else {
            resolve(null);
          }
        };

        tx.onerror = (err) => {
          console.warn("IDB load error:", err);
          resolve(null);
        };
      } catch (e) {
        console.warn("IDB read exception:", e);
        resolve(null);
      }
    });
  }

  // Clear IndexedDB completely
  async clearIDB() {
    if (!this.isIDBReady || !this.idb) return false;

    return new Promise((resolve) => {
      try {
        const tx = this.idb.transaction(['chunks', 'meta'], 'readwrite');
        tx.objectStore('chunks').clear();
        tx.objectStore('meta').clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  // Save to SQLite server backend
  async saveToSQLite(startIdx, digitStr, streamerState) {
    try {
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_idx: startIdx,
          digits: digitStr,
          streamer_state: streamerState
        })
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  }

  // Load from SQLite server backend
  async loadFromSQLite() {
    try {
      const res = await fetch('/api/load');
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'ok' && (data.digits || data.streamer_state)) {
          return {
            digits: data.digits || "",
            streamerState: data.streamer_state || null,
            totalDigits: data.total_digits || (data.digits ? data.digits.length : 0),
            source: 'sqlite'
          };
        }
      }
    } catch (e) {
      // Server not reachable
    }
    return null;
  }

  // Reset SQLite backend
  async resetSQLite() {
    try {
      await fetch('/api/reset', { method: 'POST' });
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Unified Load: Tries SQLite backend first; if empty or offline, falls back to IndexedDB.
   */
  async load() {
    this.notifyStatus({ state: 'loading', message: 'Kalıcı hafıza taranıyor...' });

    // Try SQLite server first
    const sqliteData = await this.loadFromSQLite();
    const idbData = await this.loadFromIDB();

    let result = null;

    if (sqliteData && sqliteData.digits && sqliteData.digits.length > 0) {
      result = sqliteData;
      // Sync SQLite data to IndexedDB for offline parity
      if (idbData === null || idbData.digits.length < sqliteData.digits.length) {
        await this.clearIDB();
        await this.saveToIDB(0, sqliteData.digits, sqliteData.streamerState, sqliteData.totalDigits);
      }
    } else if (idbData && idbData.digits && idbData.digits.length > 0) {
      result = idbData;
      // If server is active but empty, sync IndexedDB data up to server
      this.saveToSQLite(0, idbData.digits, idbData.streamerState);
    }

    if (result && result.digits.length > 0) {
      this.lastSavedDigitCount = result.digits.length;
      this.notifyStatus({
        state: 'ready',
        count: result.digits.length,
        source: result.source,
        message: `Kayıtlı: ${result.digits.length.toLocaleString('tr-TR')} basamak`
      });
      return result;
    }

    this.lastSavedDigitCount = 0;
    this.notifyStatus({
      state: 'empty',
      count: 0,
      message: 'Kalıcı Hafıza Hazır (0 basamak)'
    });
    return null;
  }

  /**
   * Unified Save: Flushes incremental digits and streamer state to IndexedDB and SQLite
   */
  async save(engine, streamerState) {
    if (this.isSaving) return;
    const currentTotal = engine.totalDigits;
    const startIdx = this.lastSavedDigitCount;

    if (currentTotal < startIdx) {
      // Reset scenario
      return;
    }

    let digitStr = "";
    if (currentTotal > startIdx) {
      const unsavedSlice = engine.getSlice(startIdx, currentTotal);
      for (let i = 0; i < unsavedSlice.length; i++) {
        digitStr += unsavedSlice[i];
      }
    }

    // Nothing new to save and no state
    if (digitStr.length === 0 && !streamerState) return;

    this.isSaving = true;
    this.notifyStatus({ state: 'saving', count: currentTotal, message: 'Kalıcı hafızaya kaydediliyor...' });

    try {
      // 1. Save to IndexedDB (Instant client-side)
      await this.saveToIDB(startIdx, digitStr, streamerState, currentTotal);

      // 2. Save to SQLite Backend (Async server-side)
      this.saveToSQLite(startIdx, digitStr, streamerState);

      this.lastSavedDigitCount = currentTotal;
      this.notifyStatus({
        state: 'saved',
        count: currentTotal,
        message: `Kayıtlı: ${currentTotal.toLocaleString('tr-TR')} basamak`
      });
    } catch (err) {
      console.warn("Save error:", err);
      this.notifyStatus({
        state: 'error',
        count: this.lastSavedDigitCount,
        message: 'Kayıt hatası!'
      });
    } finally {
      this.isSaving = false;
    }
  }

  /**
   * Unified Clear / Reset
   */
  async clear() {
    this.lastSavedDigitCount = 0;
    await this.clearIDB();
    await this.resetSQLite();
    this.notifyStatus({
      state: 'empty',
      count: 0,
      message: 'Kalıcı Hafıza Sıfırlandı (0 basamak)'
    });
  }
}

window.PiStorageManager = PiStorageManager;
