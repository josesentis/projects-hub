// The pages were Claude artifacts and keep their data through `claude.use('db')`.
// This file gives them the same small API, backed by api/store (a Netlify
// function on Netlify Blobs, or server.mjs locally): one set of documents per
// page and collection.
// Use: <script src="assets/store.js" data-ns="negoci"></script>
(() => {
  const me = document.currentScript
  const NS = me.dataset.ns
  const API = new URL('api/store', me.src.replace(/assets\/store\.js.*$/, '')).href
  const POLL_MS = 5000

  const cache = {}                 // collection -> {id: doc}
  const listeners = []             // {col, id?, fn}

  async function load(col) {
    const r = await fetch(`${API}?ns=${NS}&c=${encodeURIComponent(col)}`, { cache: 'no-store' })
    if (!r.ok) throw Object.assign(new Error('load'), { code: 'http_' + r.status })
    cache[col] = await r.json()
    return cache[col]
  }
  async function write(col, id, op, data) {
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ns: NS, c: col, id, op, data }) })
    if (!r.ok) throw Object.assign(new Error('write'), { code: 'http_' + r.status })
    cache[col] = await r.json()
    notify(col)
  }

  const snapDoc = (id, data) => ({ id, exists: data != null, data: () => data == null ? undefined : structuredClone(data) })
  const snapCol = (docs, limit) => ({ docs: Object.entries(docs || {}).slice(0, limit ?? Infinity).map(([id, d]) => snapDoc(id, d)) })

  function notify(col) {
    for (const l of listeners) if (l.col === col) l.id ? l.fn(snapDoc(l.id, cache[col]?.[l.id])) : l.fn(snapCol(cache[col], l.limit))
  }
  setInterval(async () => {
    const cols = [...new Set(listeners.map(l => l.col))]
    for (const c of cols) {
      const before = JSON.stringify(cache[c])
      try { await load(c) } catch { continue }
      if (JSON.stringify(cache[c]) !== before) notify(c)
    }
  }, POLL_MS)

  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

  function collection(col, limit) {
    return {
      limit: n => collection(col, n),
      get: async () => snapCol(await load(col), limit),
      add: async data => { const id = newId(); await write(col, id, 'set', data); return { id } },
      doc: id => doc(col + '/' + id),
      onSnapshot(fn, onErr) {
        const l = { col, limit, fn }; listeners.push(l)
        load(col).then(() => fn(snapCol(cache[col], limit)), e => onErr?.(e))
        return () => listeners.splice(listeners.indexOf(l), 1)
      },
    }
  }
  function doc(path) {
    const i = path.lastIndexOf('/'); const col = path.slice(0, i), id = path.slice(i + 1)
    return {
      get: async () => snapDoc(id, (await load(col))[id]),
      set: data => write(col, id, 'set', data),
      update: data => write(col, id, 'update', data),
      delete: () => write(col, id, 'delete'),
      onSnapshot(fn, onErr) {
        const l = { col, id, fn }; listeners.push(l)
        load(col).then(() => fn(snapDoc(id, cache[col][id])), e => onErr?.(e))
        return () => listeners.splice(listeners.indexOf(l), 1)
      },
    }
  }

  const db = { collection: c => collection(c), doc }
  window.claude = { use: async name => (name === 'db' ? db : null) }
})()
