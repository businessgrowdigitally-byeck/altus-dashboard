/**
 * Última versão sincronizada com a nuvem, guardada NESTE aparelho (IndexedDB).
 *
 * É a "base" da combinação de três vias (base × aparelho × nuvem). Com ela o
 * app pode abrir sem internet e, quando a conexão volta, juntar o que foi feito
 * offline com o que outro aparelho salvou, sem apagar nenhum dos dois lados.
 * Sem IndexedDB (navegação privada antiga, por exemplo), tudo vira no-op e o
 * app se comporta como antes: precisa de internet para abrir.
 */

const DB = "altus-sync";
const STORE = "base";

export type SyncCacheEntry = {
  userId: string;
  /** `updated_at` da linha na nuvem que corresponde a `base`. */
  version: string | null;
  base: Record<string, unknown>;
  savedAt: string;
};

function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | null> {
  const db = await open();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => {
        db.close();
        resolve(req ? (req.result as T) : null);
      };
      tx.onerror = tx.onabort = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

export async function loadSyncCache(userId: string): Promise<SyncCacheEntry | null> {
  const entry = await run<SyncCacheEntry | undefined>("readonly", (s) => s.get(userId));
  return entry && entry.userId === userId && entry.base && typeof entry.base === "object"
    ? entry
    : null;
}

export async function saveSyncCache(
  userId: string,
  version: string | null,
  base: Record<string, unknown>,
): Promise<void> {
  const entry: SyncCacheEntry = { userId, version, base, savedAt: new Date().toISOString() };
  await run("readwrite", (s) => {
    s.put(entry, userId);
  });
}

/** Logout: o aparelho esquece a cópia sincronizada (de todas as contas). */
export async function clearSyncCache(): Promise<void> {
  await run("readwrite", (s) => {
    s.clear();
  });
}
