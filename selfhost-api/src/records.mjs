/**
 * Isolated JK Works record repository (not connected to public HTTP routes).
 * Requires a future, separately approved schema:
 * jk_records(owner_id uuid, store text, record_id text, data jsonb, updated_at timestamptz).
 * No migrations are performed by this module.
 */
const STORES = new Set(['clients', 'jobs']);
const ID = /^[a-zA-Z0-9_-]{1,128}$/;
function validate(ownerId, store, recordId) {
  if (typeof ownerId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(ownerId)) throw new TypeError('Invalid owner');
  if (!STORES.has(store)) throw new TypeError('Invalid store');
  if (recordId !== undefined && (typeof recordId !== 'string' || !ID.test(recordId))) throw new TypeError('Invalid record id');
}
export function createRecordRepository(db) {
  if (!db || typeof db.query !== 'function') throw new TypeError('Database required');
  return Object.freeze({
    async list(ownerId, store, limit = 100) {
      validate(ownerId, store);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new RangeError('Invalid limit');
      const result = await db.query(
        'SELECT record_id, data, updated_at FROM jk_records WHERE owner_id = $1 AND store = $2 ORDER BY record_id LIMIT $3',
        [ownerId, store, limit]
      );
      return result.rows;
    },
    async get(ownerId, store, recordId) {
      validate(ownerId, store, recordId);
      const result = await db.query(
        'SELECT record_id, data, updated_at FROM jk_records WHERE owner_id = $1 AND store = $2 AND record_id = $3 LIMIT 1',
        [ownerId, store, recordId]
      );
      return result.rows[0] ?? null;
    }
  });
}
