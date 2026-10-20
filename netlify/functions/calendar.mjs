// The hub's calendar (see lib/calendar.mjs). The feed, /cal/<CAL_TOKEN>.ics, is
// the only path outside the password (netlify/edge-functions/auth.mjs), so
// Google Calendar can read it; CAL_TOKEN is a long random value set in Netlify.
import { readDocs, repoFile } from '../../lib/blobs.mjs'
import { handle } from '../../lib/calendar.mjs'

export default async req => {
  const r = await handle(new URL(req.url), { token: process.env.CAL_TOKEN, readDocs, readFile: repoFile })
  if (!r) return new Response('Not found', { status: 404 })
  return new Response(r.body, { status: r.status, headers: { 'Content-Type': r.type, 'Cache-Control': 'no-store' } })
}

export const config = { path: ['/api/calendar', '/cal/*'] }
