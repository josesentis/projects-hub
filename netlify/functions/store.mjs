// Shared store for the pages (see public/assets/store.js), on Netlify Blobs
// (see lib/blobs.mjs). Behind the hub's password (netlify/edge-functions/auth.mjs).
import { blobs, seed, readDocs } from '../../lib/blobs.mjs'
import { checkRead, checkWrite, apply, MAX_BODY } from '../../lib/store.mjs'

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } })

export default async req => {
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const r = checkRead(url.searchParams.get('ns'), url.searchParams.get('c'))
    if (r.error) return json(400, r)
    return json(200, await readDocs(r.ns, r.c))
  }
  if (req.method !== 'POST') return json(405, { error: 'method' })
  const body = await req.text()
  if (body.length > MAX_BODY) return json(413, { error: 'too_big' })
  let input
  try { input = JSON.parse(body) } catch { return json(400, { error: 'bad_json' }) }
  const w = checkWrite(input)
  if (w.error) return json(400, w)

  // Blobs have no locks: write only if nobody else did since we read, else retry.
  const store = blobs(), key = `${w.ns}/${w.c}`
  for (let i = 0; i < 5; i++) {
    const cur = await store.getWithMetadata(key, { type: 'json' })
    const docs = apply(cur ? cur.data : await seed(w.ns, w.c), w)
    const res = await store.setJSON(key, docs, cur ? { onlyIfMatch: cur.etag } : { onlyIfNew: true })
    if (res.modified) return json(200, docs)
  }
  return json(409, { error: 'busy' })
}

export const config = { path: '/api/store' }
