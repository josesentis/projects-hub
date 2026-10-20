// The store's rules, shared by the Netlify function (netlify/functions/store.mjs)
// and the local server (server.mjs): one set of documents per page and
// collection, {id: doc}, changed one document at a time.
export const NAME = /^[A-Za-z0-9_-]{1,64}$/
export const ID = /^[A-Za-z0-9_.~:@+-]{1,200}$/
export const MAX_BODY = 2e6

// Checks a read (?ns=&c=). Returns {ns, c} or {error}.
export function checkRead(ns, c) {
  if (!NAME.test(ns || '') || !NAME.test(c || '')) return { error: 'bad_name' }
  return { ns, c }
}

// Checks a write body. Returns {ns, c, id, op, data} or {error}.
export function checkWrite(input) {
  const { ns, c, id, op, data } = input || {}
  if (!NAME.test(ns || '') || !NAME.test(c || '')) return { error: 'bad_name' }
  if (!ID.test(id || '')) return { error: 'bad_id' }
  if (!['set', 'update', 'delete'].includes(op)) return { error: 'bad_op' }
  if (op !== 'delete' && (typeof data !== 'object' || data === null || Array.isArray(data))) return { error: 'bad_data' }
  return { ns, c, id, op, data }
}

// Applies a checked write to a collection's documents and returns the new set.
export function apply(docs, { id, op, data }) {
  const out = { ...docs }
  if (op === 'set') out[id] = data
  if (op === 'update') out[id] = { ...(out[id] || {}), ...data }
  if (op === 'delete') delete out[id]
  return out
}
