// Copies the project's documents from the mAI Fitness repo into the hub, as
// HTML the business plan's "Documents" tab shows. Run it after they change:
//   npm run docs                      (repo at ../mAI_fitness)
//   MAI_REPO=/path/to/repo npm run docs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { marked } from 'marked'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const REPO = process.env.MAI_REPO || join(ROOT, '..', 'mAI_fitness')
const OUT = join(ROOT, 'public', 'docs')

const DOCS = [
  { slug: 'llancament', file: 'ai/LAUNCH.md', title: 'Llançament: on, quan i amb quins textos', group: 'Negoci' },
  { slug: 'beta', file: 'ai/BETA.md', title: 'Beta: com portar-la i plantilla de l’informe', group: 'Negoci' },
  { slug: 'roadmap', file: 'ai/ROADMAP.md', title: 'Roadmap, TODOs i millores futures', group: 'Negoci' },
  { slug: 'app', file: 'ai/AGENTS.md', title: 'Com funciona l’app (tècnic)', group: 'Tècnic' },
  { slug: 'disseny', file: 'ai/DESIGN.md', title: 'Sistema de disseny', group: 'Tècnic' },
  { slug: 'setup', file: 'SETUP.md', title: 'Configuració i comptes', group: 'Tècnic' },
]

if (!existsSync(REPO)) { console.error(`No trobo el repo a ${REPO} (MAI_REPO=...)`); process.exit(1) }
mkdirSync(OUT, { recursive: true })

const index = []
for (const d of DOCS) {
  const md = readFileSync(join(REPO, d.file), 'utf8')
  let updated = null
  try { updated = execFileSync('git', ['-C', REPO, 'log', '-1', '--format=%cs', '--', d.file], { encoding: 'utf8' }).trim() || null } catch {}
  writeFileSync(join(OUT, d.slug + '.html'), marked.parse(md, { gfm: true }))
  index.push({ slug: d.slug, title: d.title, group: d.group, source: d.file, updated })
  console.log(`${d.file} → docs/${d.slug}.html`)
}
writeFileSync(join(OUT, 'index.json'), JSON.stringify(index, null, 1))
