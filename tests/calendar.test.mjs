import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { planPosts, events, ics, madrid, handle } from '../lib/calendar.mjs'

const html = readFileSync('public/mai/negoci.html', 'utf8')
const docs = {
  'mai-negoci/posts': { 'w2-reddit': { done: true } },
  'mai-negoci/cards': { a: { title: 'Amb data', date: '2026-10-24', why: 'Per què, amb; comes' }, b: { title: 'Sense data' }, c: { title: 'Feta', date: '2026-10-24', col: 'done' } },
  'figma-tasques/todos': { t: { text: 'Llista', date: '2026-10-25', done: false } },
}
const io = { readDocs: async (ns, c) => docs[`${ns}/${c}`] || {}, readFile: async () => html }

test('the publishing plan is read from the page, quotes and all', () => {
  const posts = planPosts(html)
  const hn = posts.find(p => p.id === 'w2-hn')
  assert.deepEqual([hn.date, hn.time, hn.ch, hn.title], ['2026-10-21', '15:00', 'hn', 'Show HN a Hacker News'])
  assert.equal(posts.find(p => p.id === 'w3-x-ca').title, "X en català: una història petita de l'app")
  assert.match(posts.find(p => p.id === 'd2').title, /^Directoris \(2\): There's/)
  assert.ok(posts.length >= 15)
})

test('events: plan posts not posted, and tasks with a date not done', async () => {
  const list = await events(io)
  const ids = list.map(e => e.uid)
  assert.ok(ids.includes('mai-negoci.posts.w2-hn'))
  assert.ok(!ids.includes('mai-negoci.posts.w2-reddit'))
  assert.ok(ids.includes('mai-negoci.cards.a') && ids.includes('figma-tasques.todos.t'))
  assert.ok(!ids.includes('mai-negoci.cards.b') && !ids.includes('mai-negoci.cards.c'))
  assert.deepEqual(list.map(e => e.date), [...list.map(e => e.date)].sort())
})

test('Madrid hours, summer and winter', () => {
  assert.equal(madrid('2026-10-21', '15:00').toISOString(), '2026-10-21T13:00:00.000Z')
  assert.equal(madrid('2027-01-12', '9:01').toISOString(), '2027-01-12T08:01:00.000Z')
})

test('the .ics: escaped, folded at 75 bytes, all-day tasks', async () => {
  const out = ics(await events(io), 'https://hub.example/', new Date('2026-10-20T10:00:00Z'))
  assert.ok(out.startsWith('BEGIN:VCALENDAR\r\n') && out.endsWith('END:VCALENDAR\r\n'))
  assert.match(out, /DTSTART:20261021T130000Z\r\nDTEND:20261021T133000Z/)
  assert.match(out, /DTSTART;VALUE=DATE:20261024\r\nDTEND;VALUE=DATE:20261025/)
  assert.match(out, /Per què\\, amb\\; comes/)
  for (const line of out.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75, line)
})

test('the feed needs the token', async () => {
  const opts = { token: 'secret', ...io }
  assert.equal((await handle(new URL('https://h/cal/secret.ics'), opts)).status, 200)
  assert.equal((await handle(new URL('https://h/cal/other.ics'), opts)).status, 404)
  assert.equal((await handle(new URL('https://h/cal/x.ics'), { ...opts, token: undefined })).status, 404)
  assert.equal(await handle(new URL('https://h/mai/'), opts), null)
  assert.equal(JSON.parse((await handle(new URL('https://h/api/calendar'), opts)).body).feed, 'https://h/cal/secret.ics')
})
