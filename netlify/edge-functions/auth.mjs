// The hub's password, in place of Netlify's site protection (which can't leave
// a path out): every request asks for HUB_PASSWORD (any user name) except the
// calendar feed, /cal/<token>.ics, which Google Calendar reads without one.
// HUB_PASSWORD is set in Netlify → Environment variables.
const ask = () => new Response('Cal la contrasenya del hub.', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Hub", charset="UTF-8"', 'Content-Type': 'text/plain; charset=utf-8' } })

function password(header) {
  const [scheme, value] = (header || '').split(' ')
  if (scheme !== 'Basic' || !value) return null
  try {
    const raw = new TextDecoder().decode(Uint8Array.from(atob(value), c => c.charCodeAt(0)))
    return raw.slice(raw.indexOf(':') + 1)
  } catch { return null }
}

// Same time whatever the guess, so it can't be found a letter at a time.
function same(a, b) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b)
  let diff = x.length ^ y.length
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ (y[i % y.length] ?? 0)
  return diff === 0
}

export default async (req, context) => {
  const expected = Netlify.env.get('HUB_PASSWORD')
  if (!expected) return new Response('Falta HUB_PASSWORD a Netlify.', { status: 503 })
  const given = password(req.headers.get('authorization'))
  if (given === null || !same(given, expected)) return ask()
  return context.next()
}

export const config = { path: '/*', excludedPath: ['/cal/*'] }
