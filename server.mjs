// Local server for the hub: the same password as Apache (.htpasswd, $apr1$ or
// {SHA}), the pages in public/ and the store in data/ (same requests as
// public/api/store.php). No dependencies.
//   npm start                 → http://localhost:4321
//   PORT=8080 HOST=0.0.0.0 npm start   (to open it from the phone on the same wifi)
import { createServer } from 'node:http'
import { createHash, timingSafeEqual } from 'node:crypto'
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { join, normalize, extname, dirname } from 'node:path'
import { apr1 } from './scripts/apr1.mjs'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const PUBLIC = join(ROOT, 'public')
const DATA = process.env.HUB_DATA || join(ROOT, 'data')
const PORT = Number(process.env.PORT) || 4321
const HOST = process.env.HOST || '127.0.0.1'
const HTPASSWD = process.env.HUB_HTPASSWD || join(ROOT, '.htpasswd')

if (!existsSync(HTPASSWD)) {
  console.error('Falta la contrasenya. Crea-la amb: npm run password')
  process.exit(1)
}

// ── Password ──────────────────────────────────────────────────────────────
function check(user, password) {
  const users = Object.fromEntries(readFileSync(HTPASSWD, 'utf8').split('\n').filter(l => l.includes(':')).map(l => [l.slice(0, l.indexOf(':')), l.slice(l.indexOf(':') + 1).trim()]))
  const hash = users[user]
  if (!hash) return false
  let got
  if (hash.startsWith('$apr1$')) got = apr1(password, hash.split('$')[2])
  else if (hash.startsWith('{SHA}')) got = '{SHA}' + createHash('sha1').update(password).digest('base64')
  else return false
  const a = Buffer.from(got), b = Buffer.from(hash)
  return a.length === b.length && timingSafeEqual(a, b)
}

function authorized(req) {
  const m = /^Basic (.+)$/.exec(req.headers.authorization || '')
  if (!m) return false
  const raw = Buffer.from(m[1], 'base64').toString()
  const i = raw.indexOf(':')
  return i > 0 && check(raw.slice(0, i), raw.slice(i + 1))
}

// ── Store (same as public/api/store.php) ──────────────────────────────────
const NAME = /^[A-Za-z0-9_-]{1,64}$/
const ID = /^[A-Za-z0-9_.~:@+-]{1,200}$/
let queue = Promise.resolve()   // one write at a time

async function readDocs(ns, c) {
  try { return JSON.parse(await readFile(join(DATA, ns, c + '.json'), 'utf8')) } catch { return {} }
}

async function store(req, res, url) {
  const send = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)) }
  if (req.method === 'GET') {
    const ns = url.searchParams.get('ns') || '', c = url.searchParams.get('c') || ''
    if (!NAME.test(ns) || !NAME.test(c)) return send(400, { error: 'bad_name' })
    return send(200, await readDocs(ns, c))
  }
  if (req.method !== 'POST') return send(405, { error: 'method' })
  let body = ''
  for await (const chunk of req) { body += chunk; if (body.length > 2e6) return send(413, { error: 'too_big' }) }
  let input
  try { input = JSON.parse(body) } catch { return send(400, { error: 'bad_json' }) }
  const { ns, c, id, op, data } = input || {}
  if (!NAME.test(ns || '') || !NAME.test(c || '')) return send(400, { error: 'bad_name' })
  if (!ID.test(id || '')) return send(400, { error: 'bad_id' })
  if (op !== 'delete' && (typeof data !== 'object' || data === null || Array.isArray(data))) return send(400, { error: 'bad_data' })
  if (!['set', 'update', 'delete'].includes(op)) return send(400, { error: 'bad_op' })
  const job = queue.then(async () => {
    const docs = await readDocs(ns, c)
    if (op === 'set') docs[id] = data
    if (op === 'update') docs[id] = { ...(docs[id] || {}), ...data }
    if (op === 'delete') delete docs[id]
    await mkdir(join(DATA, ns), { recursive: true })
    await writeFile(join(DATA, ns, c + '.json'), JSON.stringify(docs, null, 1))
    return docs
  })
  queue = job.catch(() => {})
  send(200, await job)
}

// ── Static files ──────────────────────────────────────────────────────────
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8' }

async function serveFile(res, path) {
  let file = normalize(join(PUBLIC, path))
  if (!file.startsWith(PUBLIC) || /(^|\/)\./.test(path) || file.endsWith('.php')) { res.writeHead(404); return res.end('Not found') }
  try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html') } catch {}
  try {
    const body = await readFile(file)
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' })
    res.end(body)
  } catch { res.writeHead(404); res.end('Not found') }
}

createServer(async (req, res) => {
  if (!authorized(req)) {
    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Hub", charset="UTF-8"' })
    return res.end('Cal la contrasenya')
  }
  const url = new URL(req.url, 'http://local')
  try {
    if (url.pathname === '/api/store.php') return await store(req, res, url)
    await serveFile(res, decodeURIComponent(url.pathname))
  } catch (e) { console.error(e); res.writeHead(500); res.end('Error') }
}).listen(PORT, HOST, () => console.log(`Hub → http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`))
