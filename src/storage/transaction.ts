// ============================================================================
// Transaction helper — runs a function inside a single IDB transaction.
// ----------------------------------------------------------------------------
// Multi-step writes (toggle + reorder, save + delete-values, etc.) wrap their
// store operations in `withTransaction()` so a partial failure aborts every
// change atomically. Callers receive the resolved value once the transaction
// has fully committed (we wait for `oncomplete`, not just the last request).
// ============================================================================

import { openDB, txComplete, type StoreName } from './idb';

export type TxMode = 'readonly' | 'readwrite';

export async function withTransaction<T>(
  stores: StoreName | StoreName[],
  mode: TxMode,
  fn: (tx: IDBTransaction) => T | Promise<T>,
): Promise<T> {
  const db = await openDB();
  const tx = db.transaction(stores, mode);

  let result: T;
  try {
    result = await fn(tx);
  } catch (e) {
    try { tx.abort(); } catch { /* may already be aborted */ }
    throw e;
  }

  // Wait for the transaction to fully commit before returning.
  await txComplete(tx);
  return result;
}
