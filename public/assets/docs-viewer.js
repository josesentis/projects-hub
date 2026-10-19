// Documents: docs/index.json + one HTML file per document (npm run docs).
(() => {
  const $ = id => document.getElementById(id)
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  let docs = [], current = null
  const remembered = () => { try { return localStorage.getItem('hub.doc:' + location.pathname) } catch { return null } }
  const remember = slug => { try { localStorage.setItem('hub.doc:' + location.pathname, slug) } catch {} }

  function nav() {
    const groups = [...new Set(docs.map(d => d.group))]
    $('docsNav').innerHTML = groups.map(g => `<div><h3>${esc(g)}</h3>${docs.filter(d => d.group === g).map(d =>
      `<button type="button" data-slug="${esc(d.slug)}" aria-current="${d.slug === current}">${esc(d.title)}</button>`).join('')}</div>`).join('')
  }

  async function open(slug) {
    const d = docs.find(x => x.slug === slug) || docs[0]
    if (!d) return
    current = d.slug; remember(d.slug); nav()
    $('docBody').innerHTML = '<p class="meta">Carregant…</p>'
    try {
      const r = await fetch('docs/' + d.slug + '.html', { cache: 'no-cache' })
      if (!r.ok) throw new Error()
      $('docBody').innerHTML = `<p class="doc-src">${esc(d.source)}${d.updated ? ' · actualitzat el ' + esc(d.updated) : ''}</p>` + await r.text()
    } catch { $('docBody').innerHTML = '<p class="meta">No s\'ha pogut carregar aquest document.</p>'; return }
    for (const t of $('docBody').querySelectorAll('table')) { const w = document.createElement('div'); w.className = 'tbl'; t.before(w); w.append(t) }
    for (const q of $('docBody').querySelectorAll('blockquote')) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn sm'; b.textContent = 'Copiar'
      b.addEventListener('click', async () => {
        const text = [...q.querySelectorAll('p')].map(p => p.innerText).join('\n\n')
        try { await navigator.clipboard.writeText(text); b.textContent = 'Copiat' } catch { b.textContent = 'No s\'ha pogut copiar' }
        setTimeout(() => { b.textContent = 'Copiar' }, 1600)
      })
      q.append(b)
    }
  }

  $('docsNav').addEventListener('click', e => {
    const b = e.target.closest('button[data-slug]'); if (!b) return
    open(b.dataset.slug); $('docBody').scrollIntoView({ block: 'start' })
  })

  fetch('docs/index.json', { cache: 'no-cache' }).then(r => r.json()).then(list => {
    docs = list
    const dates = list.map(d => d.updated).filter(Boolean).sort()
    $('docsMeta').textContent = `${list.length} documents${dates.length ? ' · l\'últim canvi és del ' + dates.at(-1) : ''}.`
    open(remembered() || list[0]?.slug)
  }).catch(() => { $('docBody').innerHTML = '<p class="meta">Encara no hi ha documents: executa <code>npm run docs</code>.</p>' })
})()

