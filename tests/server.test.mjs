import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkWrite, apply } from '../lib/store.mjs'

const dir = mkdtempSync(join(tmpdir(), 'hub-'))
const PORT = 4400 + Math.floor(Math.random() * 500)
const BASE = `http://127.0.0.1:${PORT}`
let server

before(async () => {
  server = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT, HUB_DATA: join(dir, 'data') }, stdio: 'pipe' })
  await new Promise(res => server.stdout.once('data', res))
})
after(() => server.kill())

test('pages, and never dotfiles', async () => {
  assert.equal((await fetch(BASE + '/')).status, 200)
  assert.equal((await fetch(BASE + '/.gitignore')).status, 404)
  assert.equal((await fetch(BASE + '/api/../../package.json')).status, 404)
})

test('the store sets, merges and deletes documents, kept in data/<ns>/<collection>.json', async () => {
  const post = body => fetch(BASE + '/api/store', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json())
  await post({ ns: 'proves', c: 'todos', id: 't1', op: 'set', data: { text: 'Provar', done: false } })
  const merged = await post({ ns: 'proves', c: 'todos', id: 't1', op: 'update', data: { done: true } })
  assert.deepEqual(merged.t1, { text: 'Provar', done: true })
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 'data/proves/todos.json'), 'utf8')).t1, { text: 'Provar', done: true })
  await post({ ns: 'proves', c: 'todos', id: 't1', op: 'delete' })
  assert.deepEqual(await fetch(BASE + '/api/store?ns=proves&c=todos').then(r => r.json()), {})
})

test('the store refuses names that could leave data/', async () => {
  assert.equal((await fetch(BASE + '/api/store?ns=..&c=todos')).status, 400)
  const w = await fetch(BASE + '/api/store', { method: 'POST', body: JSON.stringify({ ns: 'a/b', c: 'x', id: '1', op: 'set', data: {} }) })
  assert.equal(w.status, 400)
})

test('the rules the Netlify function shares', () => {
  assert.equal(checkWrite({ ns: 'n', c: 'c', id: '1', op: 'push', data: {} }).error, 'bad_op')
  assert.equal(checkWrite({ ns: 'n', c: 'c', id: '1', op: 'set', data: [] }).error, 'bad_data')
  const before = { a: { x: 1 } }
  assert.deepEqual(apply(before, { id: 'a', op: 'update', data: { y: 2 } }), { a: { x: 1, y: 2 } })
  assert.deepEqual(before, { a: { x: 1 } })
})
