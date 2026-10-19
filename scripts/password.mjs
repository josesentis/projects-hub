// Sets the hub's password in .htpasswd (Apache format, $apr1$).
//   npm run password            → asks for the user and the password
//   npm run password -- jose    → asks only for the password
import { createInterface } from 'node:readline'
import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { apr1 } from './apr1.mjs'

const FILE = join(dirname(fileURLToPath(import.meta.url)), '..', '.htpasswd')

function ask(question, hidden = false) {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
  if (hidden) rl._writeToOutput = s => { if (s.startsWith(question)) process.stdout.write(s) }
  return new Promise(res => rl.question(question, a => { rl.close(); if (hidden) process.stdout.write('\n'); res(a.trim()) }))
}

const user = process.argv[2] || await ask('Usuari: ')
if (!/^[A-Za-z0-9_.-]+$/.test(user)) { console.error('Usuari no vàlid (lletres, números, _ . -)'); process.exit(1) }
const pw = await ask('Contrasenya: ', true)
if (pw.length < 8) { console.error('Mínim 8 caràcters'); process.exit(1) }
if (await ask('Repeteix-la: ', true) !== pw) { console.error('No coincideixen'); process.exit(1) }

const ITOA = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const salt = [...randomBytes(8)].map(b => ITOA[b & 63]).join('')
const lines = existsSync(FILE) ? readFileSync(FILE, 'utf8').split('\n').filter(l => l && !l.startsWith(user + ':')) : []
lines.push(`${user}:${apr1(pw, salt)}`)
writeFileSync(FILE, lines.join('\n') + '\n', { mode: 0o600 })
console.log(`Desat a .htpasswd per a "${user}".`)
