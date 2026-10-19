import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apr1 } from '../scripts/apr1.mjs'

const dir = mkdtempSync(join(tmpdir(), 'hub-'))
const PORT = 4400 + Math.floor(Math.random() * 500)
const BASE = `http://127.0.0.1:${PORT}`
const auth = (u, p) => ({ Authorization: 'Basic ' + Buffer.from(`${u}:${p}`).toString('base64') })
const OK = auth('jose', 'secret-pass')
let server

before(async () => {
  writeFileSync(join(dir, '.htpasswd'), `jose:${apr1('secret-pass', 'Ab3dEf9h')}\n`)
  server = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT, HUB_DATA: join(dir, 'data'), HUB_HTPASSWD: join(dir, '.htpasswd') }, stdio: 'pipe' })
  await new Promise(res => server.stdout.once('data', res))
})
after(() => server.kill())

test('apr1 matches Apache (openssl passwd -apr1)', () => {
  assert.equal(apr1('test123', 'abcdefgh'), '$apr1$abcdefgh$tbBaQr8bvJpOyzoypIHIO0')
})

test('nothing is served without the password, or with a wrong one', async () => {
  for (const headers of [{}, auth('jose', 'nope'), auth('other', 'secret-pass')]) {
    const r = await fetch(BASE + '/index.html', { headers })
    assert.equal(r.status, 401)
    assert.match(r.headers.get('www-authenticate'), /Basic/)
  }
  assert.equal((await fetch(BASE + '/api/store.php?ns=proves&c=todos')).status, 401)
})

test('with it: pages, and never dotfiles or php sources', async () => {
  assert.equal((await fetch(BASE + '/', { headers: OK })).status, 200)
  assert.equal((await fetch(BASE + '/.htaccess', { headers: OK })).status, 404)
  assert.equal((await fetch(BASE + '/api/../../.htpasswd', { headers: OK })).status, 404)
})

test('the store sets, merges and deletes documents, kept in data/<ns>/<collection>.json', async () => {
  const post = body => fetch(BASE + '/api/store.php', { method: 'POST', headers: { ...OK, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json())
  await post({ ns: 'proves', c: 'todos', id: 't1', op: 'set', data: { text: 'Provar', done: false } })
  const merged = await post({ ns: 'proves', c: 'todos', id: 't1', op: 'update', data: { done: true } })
  assert.deepEqual(merged.t1, { text: 'Provar', done: true })
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 'data/proves/todos.json'), 'utf8')).t1, { text: 'Provar', done: true })
  await post({ ns: 'proves', c: 'todos', id: 't1', op: 'delete' })
  assert.deepEqual(await fetch(BASE + '/api/store.php?ns=proves&c=todos', { headers: OK }).then(r => r.json()), {})
})

test('the store refuses names that could leave data/', async () => {
  const r = await fetch(BASE + '/api/store.php?ns=..&c=todos', { headers: OK })
  assert.equal(r.status, 400)
  const w = await fetch(BASE + '/api/store.php', { method: 'POST', headers: OK, body: JSON.stringify({ ns: 'a/b', c: 'x', id: '1', op: 'set', data: {} }) })
  assert.equal(w.status, 400)
})
