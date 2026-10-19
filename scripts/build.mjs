// Builds the hub from hub.config.json: each project's documents (copied from
// its repo as HTML), each project's page and the hub's front page.
//   npm run build        (after changing a document in a repo, or the config)
// The repos are found relative to the hub (e.g. ../mAI_fitness). A missing
// repo keeps the documents already built.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { marked } from 'marked'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC = join(ROOT, 'public')
const config = JSON.parse(readFileSync(join(ROOT, 'hub.config.json'), 'utf8'))

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const git = (repo, ...args) => { try { return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim() } catch { return '' } }
const DATE = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : ''

function buildDocs(p) {
  const repo = join(ROOT, p.repo)
  const out = join(PUBLIC, p.id, 'docs')
  if (!existsSync(repo)) { console.warn(`${p.name}: no trobo ${p.repo}; mantinc els documents que ja hi ha`); return readIndex(out) }
  mkdirSync(out, { recursive: true })
  const index = []
  for (const d of p.docs) {
    const file = join(repo, d.file)
    if (!existsSync(file)) { console.warn(`${p.name}: falta ${d.file}`); continue }
    writeFileSync(join(out, d.slug + '.html'), marked.parse(readFileSync(file, 'utf8'), { gfm: true }))
    index.push({ slug: d.slug, title: d.title, group: d.group, source: d.file, updated: git(repo, 'log', '-1', '--format=%cs', '--', d.file) || null })
  }
  writeFileSync(join(out, 'index.json'), JSON.stringify(index, null, 1))
  console.log(`${p.name}: ${index.length} documents`)
  return index
}
function readIndex(dir) { try { return JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8')) } catch { return [] } }

const head = (title, depth) => `<!doctype html>
<html lang="ca">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex">
<title>${esc(title)}</title>
<link rel="stylesheet" href="${depth}assets/hub.css">
</head>`

const card = (c, color) => `    <a class="card${c.big ? ' big' : ''}" href="${esc(c.href)}"${color ? ` style="--accent:${esc(color)}"` : ''}>
      <span class="tag">${esc(c.tag)}</span>
      <h2>${esc(c.title)}</h2>
      <p>${esc(c.text)}</p>
    </a>`

function projectPage(p, docs, last) {
  const ownDocsTab = p.pages.some(x => x.href.includes('#documents'))
  const links = p.links.map(l => `<a href="${esc(l.href)}">${esc(l.label)}</a>`).join(' · ')
  return `${head(p.name, '../')}
<body style="--accent:${esc(p.color)}">
<script src="../assets/hub-bar.js"></script>
<main class="hub">
  <header class="hero">
    <span class="eyebrow">${esc(p.kind)} · ${esc(p.status)}</span>
    <h1>${esc(p.name)}</h1>
    <p class="lede">${esc(p.tagline)}</p>
    <p class="meta">${[links, last ? `Últim canvi al codi: ${esc(DATE(last.date))} («${esc(last.subject)}»)` : ''].filter(Boolean).join(' · ')}</p>
  </header>
${p.images?.length ? `  <div class="shots">\n${p.images.map(i => `    <img src="${esc(i.src)}" alt="${esc(i.alt)}" loading="lazy">`).join('\n')}\n  </div>\n` : ''}${p.pages.length ? `  <div class="grid">\n${p.pages.map(c => card(c)).join('\n')}\n  </div>\n` : ''}${ownDocsTab ? '' : `  <section class="docs-section">
    <h2>Documents</h2>
    <p class="meta" id="docsMeta"></p>
    <div class="docs-layout">
      <nav class="docs-nav" id="docsNav" aria-label="Documents"></nav>
      <article class="md" id="docBody" aria-live="polite"><p class="meta">Carregant…</p></article>
    </div>
  </section>
`}</main>
${ownDocsTab ? '' : '<link rel="stylesheet" href="../assets/docs.css">\n<script src="../assets/docs-viewer.js"></script>\n'}</body>
</html>
`
}

function frontPage(rows) {
  return `${head(config.title, '')}
<body>
<main class="hub">
  <header class="hero">
    <span class="eyebrow">${rows.length} projectes</span>
    <h1>${esc(config.title)}</h1>
    <p class="lede">${esc(config.lede)}</p>
  </header>
  <div class="projects">
${rows.map(({ p, docs, last }) => `    <a class="project" href="${esc(p.id)}/index.html" style="--accent:${esc(p.color)}">
      <span class="eyebrow">${esc(p.kind)}</span>
      <h2>${esc(p.name)}</h2>
      <p>${esc(p.tagline)}</p>
      <span class="pill">${esc(p.status)}</span>
      <span class="meta">${[p.pages.length ? `${p.pages.length} pàgines` : '', `${docs.length} documents`, last ? `últim canvi: ${esc(DATE(last.date))}` : ''].filter(Boolean).join(' · ')}</span>
    </a>`).join('\n')}
  </div>
</main>
</body>
</html>
`
}

const rows = []
for (const p of config.projects) {
  const docs = buildDocs(p)
  const repo = join(ROOT, p.repo)
  const [date, subject] = git(repo, 'log', '-1', '--format=%cs%x09%s').split('\t')
  const last = date ? { date, subject } : null
  mkdirSync(join(PUBLIC, p.id), { recursive: true })
  writeFileSync(join(PUBLIC, p.id, 'index.html'), projectPage(p, docs, last))
  rows.push({ p, docs, last })
}
writeFileSync(join(PUBLIC, 'index.html'), frontPage(rows))
console.log('index.html i les pàgines de projecte, fetes')
