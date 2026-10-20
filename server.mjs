// Local server for the hub: the pages in public/ and the store in data/ (same
// requests and rules as netlify/functions/store.mjs, but on files). No password:
// it is only for this computer or the same wifi. No dependencies.
//   npm start                 → http://localhost:4321
//   PORT=8080 HOST=0.0.0.0 npm start   (to open it from the phone on the same wifi)
import { createServer } from 'node:http'
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { join, normalize, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkRead, checkWrite, apply, MAX_BODY } from './lib/store.mjs'

const ROOT = dirname(fileURLToPath(import.meta.url))
const PUBLIC = join(ROOT, 'public')
const DATA = process.env.HUB_DATA || join(ROOT, 'data')
const PORT = Number(process.env.PORT) || 4321
const HOST = process.env.HOST || '127.0.0.1'

// ── Store ─────────────────────────────────────────────────────────────────
let queue = Promise.resolve()   // one write at a time

async function readDocs(ns, c) {
  try { return JSON.parse(await readFile(join(DATA, ns, c + '.json'), 'utf8')) } catch { return {} }
}

async function store(req, res, url) {
  const send = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)) }
  if (req.method === 'GET') {
    const r = checkRead(url.searchParams.get('ns'), url.searchParams.get('c'))
    if (r.error) return send(400, r)
    return send(200, await readDocs(r.ns, r.c))
  }
  if (req.method !== 'POST') return send(405, { error: 'method' })
  let body = ''
  for await (const chunk of req) { body += chunk; if (body.length > MAX_BODY) return send(413, { error: 'too_big' }) }
  let input
  try { input = JSON.parse(body) } catch { return send(400, { error: 'bad_json' }) }
  const w = checkWrite(input)
  if (w.error) return send(400, w)
  const job = queue.then(async () => {
    const docs = apply(await readDocs(w.ns, w.c), w)
    await mkdir(join(DATA, w.ns), { recursive: true })
    await writeFile(join(DATA, w.ns, w.c + '.json'), JSON.stringify(docs, null, 1))
    return docs
  })
  queue = job.catch(() => {})
  send(200, await job)
}

// ── Static files ──────────────────────────────────────────────────────────
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8' }

async function serveFile(res, path) {
  let file = normalize(join(PUBLIC, path))
  if (!file.startsWith(PUBLIC) || /(^|\/)\./.test(path)) { res.writeHead(404); return res.end('Not found') }
  try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html') } catch {}
  try {
    const body = await readFile(file)
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' })
    res.end(body)
  } catch { res.writeHead(404); res.end('Not found') }
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://local')
  try {
    if (url.pathname === '/api/store') return await store(req, res, url)
    await serveFile(res, decodeURIComponent(url.pathname))
  } catch (e) { console.error(e); res.writeHead(500); res.end('Error') }
}).listen(PORT, HOST, () => console.log(`Hub → http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`))
