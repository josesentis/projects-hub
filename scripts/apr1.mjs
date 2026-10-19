// Apache "$apr1$" password hash (what `htpasswd -m` writes), so .htpasswd works
// the same in Apache and in server.mjs.
import { createHash } from "node:crypto"

const md5 = b => createHash('md5').update(b).digest()
const ITOA = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const to64 = (v, n) => { let s = ''; while (n--) { s += ITOA[v & 0x3f]; v >>= 6 } return s }

export function apr1(password, salt) {
  const pw = Buffer.from(password), sl = Buffer.from(salt.slice(0, 8)), magic = Buffer.from('$apr1$')
  let fin = md5(Buffer.concat([pw, sl, pw]))
  const parts = [pw, magic, sl]
  for (let n = pw.length; n > 0; n -= 16) parts.push(fin.subarray(0, Math.min(n, 16)))
  for (let i = pw.length; i; i >>= 1) parts.push(i & 1 ? Buffer.from([0]) : pw.subarray(0, 1))
  fin = md5(Buffer.concat(parts))
  for (let i = 0; i < 1000; i++) {
    const p = [i & 1 ? pw : fin]
    if (i % 3) p.push(sl)
    if (i % 7) p.push(pw)
    p.push(i & 1 ? fin : pw)
    fin = md5(Buffer.concat(p))
  }
  const f = fin
  const out = to64((f[0] << 16) | (f[6] << 8) | f[12], 4) + to64((f[1] << 16) | (f[7] << 8) | f[13], 4) +
    to64((f[2] << 16) | (f[8] << 8) | f[14], 4) + to64((f[3] << 16) | (f[9] << 8) | f[15], 4) +
    to64((f[4] << 16) | (f[10] << 8) | f[5], 4) + to64(f[11], 2)
  return `$apr1$${salt.slice(0, 8)}$${out}`
}
