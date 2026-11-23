/**
 * TEST-ONLY JK Works selfhost records client.
 *
 * NOT imported by the production app. Does not replace Supabase Auth,
 * Storage, Edge, tombstone synchronization or public requests.
 * Requires an explicit loopback address and a fictitious bearer token.
 */
export function createIsolatedRecordsClient({ baseUrl, accessToken, fetchImpl = fetch }) {
  const url = new URL(baseUrl);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
      !['http:', 'https:'].includes(url.protocol) ||
      url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      !/^[-A-Za-z0-9_.]{8,4096}$/.test(accessToken || '') ||
      typeof fetchImpl !== 'function') {
    throw new Error('isolated_loopback_configuration_required');
  }
  const stores = new Set(['clients', 'jobs', 'timeEntries']);

  function pathFor(store, id) {
    if (!stores.has(store)) throw new Error('unsupported_store');
    if (id === undefined) return '/v1/records/' + store;
    if (typeof id !== 'string' || id.length === 0 || id.length > 160 ||
        id.includes('/') || id === '.' || id === '..')
      throw new Error('invalid_record_id');
    return '/v1/records/' + store + '/' + encodeURIComponent(id);
  }

  async function request(path, method = 'GET', payload, headers = {}) {
    const h = { Authorization: 'Bearer ' + accessToken, Accept: 'application/json', ...headers };
    if (payload !== undefined) h['Content-Type'] = 'application/json';
    const response = await fetchImpl(new URL(path, url), {
      method, headers: h, redirect: 'error',
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) })
    });
    if (!response || typeof response.status !== 'number' ||
        typeof response.json !== 'function') throw new Error('invalid_http_response');
    const body = await response.json();
    if (!response.ok) {
      const error = new Error('selfhost_http_' + response.status);
      error.status = response.status;
      throw error;
    }
    return body;
  }

  return Object.freeze({
    session: () => request('/v1/session'),
    list: (store, { limit = 100, after } = {}) => {
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('invalid_limit');
      const query = new URLSearchParams({ limit: String(limit) });
      if (after !== undefined) query.set('after', after);
      return request(pathFor(store) + '?' + query);
    },
    get: (store, id) => request(pathFor(store, id)),
    create: (store, id, data) => request(pathFor(store), 'POST', { record_id: id, data }),
    update: (store, id, data, expectedVersion) => {
      if (typeof expectedVersion !== 'string' || !expectedVersion)
        throw new Error('expected_version_required');
      return request(pathFor(store, id), 'PUT', { data, expected_version: expectedVersion });
    }
  });
}
