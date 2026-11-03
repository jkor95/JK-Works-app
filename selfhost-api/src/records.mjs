/**
 * Isolated JK Works record repository (not connected to public HTTP routes).
 * Requires a future, separately approved schema:
 * jk_records(owner_id uuid, store text, record_id text, data jsonb, updated_at timestamptz).
 * No migrations are performed by this module.
 */
const STORES = new Set(['clients', 'jobs']);
const ID = /^[a-zA-Z0-9_-]{1,128}$/;
function validate(ownerId, store, recordId) {
  if (typeof ownerId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ownerId)) throw new TypeError('Invalid owner');
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
    async create(ownerId, store, recordId, data) {
      validate(ownerId, store, recordId);
      if (!data || typeof data !== 'object' || Array.isArray(data) || JSON.stringify(data).length > 65536) throw new TypeError('Invalid record data');
      const result = await db.query(
        'INSERT INTO jk_records (owner_id, store, record_id, data) VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT DO NOTHING RETURNING record_id, data, updated_at',
        [ownerId, store, recordId, JSON.stringify(data)]
      );
      return result.rows[0] ?? null;
    },
    async update(ownerId, store, recordId, data) {
      validate(ownerId, store, recordId);
      if (!data || typeof data !== 'object' || Array.isArray(data) || JSON.stringify(data).length > 65536) throw new TypeError('Invalid record data');
      const result = await db.query(
        'UPDATE jk_records SET data = $4::jsonb, updated_at = NOW() WHERE owner_id = $1 AND store = $2 AND record_id = $3 RETURNING record_id, data, updated_at',
        [ownerId, store, recordId, JSON.stringify(data)]
      );
      return result.rows[0] ?? null;
    },
    async remove(ownerId, store, recordId) {
      validate(ownerId, store, recordId);
      const result = await db.query(
        'DELETE FROM jk_records WHERE owner_id = $1 AND store = $2 AND record_id = $3 RETURNING record_id',
        [ownerId, store, recordId]
      );
      return Boolean(result.rows[0]);
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
