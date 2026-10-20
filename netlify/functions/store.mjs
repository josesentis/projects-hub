// Shared store for the pages (see public/assets/store.js), on Netlify Blobs:
// one blob per page and collection, "<ns>/<collection>" = {id: doc}.
// A collection that has never been written starts from data/<ns>/<collection>.json
// in the repo, so what was saved before the move to Netlify is kept.
// Access is protected by Netlify's site password.
import { getStore } from '@netlify/blobs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { checkRead, checkWrite, apply, MAX_BODY } from '../../lib/store.mjs'

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } })
const blobs = () => getStore({ name: 'hub', consistency: 'strong' })

async function seed(ns, c) {
  for (const root of [process.cwd(), process.env.LAMBDA_TASK_ROOT].filter(Boolean)) {
    try { return JSON.parse(await readFile(join(root, 'data', ns, c + '.json'), 'utf8')) } catch {}
  }
  return {}
}

export default async req => {
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const r = checkRead(url.searchParams.get('ns'), url.searchParams.get('c'))
    if (r.error) return json(400, r)
    return json(200, (await blobs().get(`${r.ns}/${r.c}`, { type: 'json' })) ?? await seed(r.ns, r.c))
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
