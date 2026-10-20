// The hub's calendar, for Google Calendar to subscribe to: mAI Fitness's
// publishing plan and every task that has a date, not yet done. Shared by the
// Netlify function (netlify/functions/calendar.mjs) and server.mjs.
//   /cal/<token>.ics   the feed, outside the password: the token is the key
//   /api/calendar      for the hub's calendar page: the feed's link and the events

// Publishing plans: written in the page itself (one `{ id: '…', date: '…', … }`
// per line), what was posted in the store.
const PLANS = [
  { ns: 'mai-negoci', c: 'posts', project: 'mAI', file: 'public/mai/negoci.html', page: 'mai/negoci.html#publicar' },
]
const CHANNELS = { linkedin: 'LinkedIn', x: 'X', meneame: 'Menéame', reddit: 'Reddit', indiehackers: 'Indie Hackers', directoris: 'Directoris', premsa: 'Premsa', producthunt: 'Product Hunt', hn: 'Hacker News' }

// Tasks: the boards and lists, each with an optional `date` (YYYY-MM-DD).
const TASKS = [
  { ns: 'mai-negoci', c: 'cards', project: 'mAI', page: 'mai/negoci.html#tasques', title: d => d.title, notes: d => d.why, done: d => d.col === 'done' },
  { ns: 'ootd-negoci', c: 'cards', project: 'OOTD', page: 'ootd/negoci.html#tasques', title: d => d.title, notes: d => d.why, done: d => d.col === 'done' },
  { ns: 'figma-tasques', c: 'todos', project: 'Figma', page: 'figma/tasques.html', title: d => d.text, notes: d => d.how, done: d => d.done },
]

const DAY = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^\d{1,2}:\d{2}$/
const POST_MINUTES = 30

// The plan entries of a page: the quoted fields before `tips`.
export function planPosts(html) {
  const posts = []
  for (const line of html.split('\n')) {
    if (!/^\s*\{ id: '/.test(line)) continue
    const head = line.split(/, tips: \[/)[0], post = {}
    for (const m of head.matchAll(/(\w+): (?:'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)")/g)) post[m[1]] = (m[2] ?? m[3]).replace(/\\(.)/g, '$1')
    if (post.id && DAY.test(post.date || '') && post.title) posts.push(post)
  }
  return posts
}

// readDocs(ns, c) → {id: doc}; readFile(path from the hub's root) → text.
export async function events({ readDocs, readFile }) {
  const out = []
  for (const p of PLANS) {
    const [html, state] = await Promise.all([readFile(p.file), readDocs(p.ns, p.c)])
    for (const post of planPosts(html)) {
      if (state[post.id]?.done) continue
      out.push({
        uid: `${p.ns}.${p.c}.${post.id}`, date: post.date, time: TIME.test(post.time || '') ? post.time : null,
        title: `${p.project} · ${post.title}`, page: p.page,
        notes: [[CHANNELS[post.ch], post.lang].filter(Boolean).join(' · '), post.video ? (/^(Sense|Captura)/.test(post.video) ? post.video : 'Vídeo: ' + post.video) : ''].filter(Boolean).join('\n'),
      })
    }
  }
  for (const t of TASKS) {
    for (const [id, d] of Object.entries(await readDocs(t.ns, t.c))) {
      if (!DAY.test(d.date || '') || t.done(d)) continue
      out.push({ uid: `${t.ns}.${t.c}.${id}`, date: d.date, time: null, title: `${t.project} · ${t.title(d)}`, notes: t.notes(d) || '', page: t.page })
    }
  }
  return out.sort((a, b) => (a.date + (a.time || '').padStart(5, '0')).localeCompare(b.date + (b.time || '').padStart(5, '0')))
}

// ── iCalendar ───────────────────────────────────────────────────────────────
// Madrid's offset from UTC, in minutes, at a moment.
function madridOffset(t) {
  const name = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Madrid', timeZoneName: 'longOffset' }).formatToParts(t).find(p => p.type === 'timeZoneName').value
  const m = name.match(/([+-])(\d{2}):(\d{2})/)
  return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0
}
// A day and hour in Madrid, as a moment.
export function madrid(date, time) {
  const [y, mo, d] = date.split('-').map(Number), [h, mi] = time.split(':').map(Number)
  const local = Date.UTC(y, mo - 1, d, h, mi)
  return new Date(local - madridOffset(local - madridOffset(local) * 60000) * 60000)
}

const utc = t => t.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const day = s => s.replace(/-/g, '')
const nextDay = s => { const t = new Date(s + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + 1); return day(t.toISOString().slice(0, 10)) }
const text = s => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

// Lines of at most 75 bytes, continued with a space (RFC 5545), never splitting a character.
const enc = new TextEncoder()
function fold(line) {
  const parts = []; let cur = '', size = 0
  for (const ch of line) {
    const n = enc.encode(ch).length
    if (size + n > (parts.length ? 74 : 75)) { parts.push(cur); cur = ''; size = 0 }
    cur += ch; size += n
  }
  parts.push(cur)
  return parts.join('\r\n ')
}

// base: the hub's address with a trailing slash, for each event's link.
export function ics(list, base, now = new Date()) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hub//Calendari//CA', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:Hub', 'X-WR-TIMEZONE:Europe/Madrid', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H']
  for (const e of list) {
    const start = e.time ? madrid(e.date, e.time) : null
    lines.push('BEGIN:VEVENT', `UID:${e.uid}@hub`, `DTSTAMP:${utc(now)}`,
      start ? `DTSTART:${utc(start)}` : `DTSTART;VALUE=DATE:${day(e.date)}`,
      start ? `DTEND:${utc(new Date(start.getTime() + POST_MINUTES * 60000))}` : `DTEND;VALUE=DATE:${nextDay(e.date)}`,
      `SUMMARY:${text(e.title)}`, `DESCRIPTION:${text([e.notes, base + e.page].filter(Boolean).join('\n\n'))}`, `URL:${base + e.page}`,
      'TRANSP:TRANSPARENT', 'END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}

// Both routes. Returns {status, type, body}, or null for any other path.
export async function handle(url, { token, readDocs, readFile }) {
  const base = url.origin + '/'
  if (url.pathname === '/api/calendar') {
    const list = await events({ readDocs, readFile })
    return { status: 200, type: 'application/json; charset=utf-8', body: JSON.stringify({ feed: token ? `${base}cal/${token}.ics` : null, events: list }) }
  }
  const m = url.pathname.match(/^\/cal\/([^/]+)\.ics$/)
  if (!m && !url.pathname.startsWith('/cal/')) return null
  if (!token || !m || m[1] !== token) return { status: 404, type: 'text/plain; charset=utf-8', body: 'Not found' }
  return { status: 200, type: 'text/calendar; charset=utf-8', body: ics(await events({ readDocs, readFile }), base) }
}
