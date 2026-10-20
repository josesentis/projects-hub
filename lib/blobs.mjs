// The store on Netlify Blobs, for the Netlify functions: one blob per page and
// collection, "<ns>/<collection>" = {id: doc}. A collection that has never been
// written starts from data/<ns>/<collection>.json in the repo, so what was saved
// before the move to Netlify is kept.
import { getStore } from '@netlify/blobs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const blobs = () => getStore({ name: 'hub', consistency: 'strong' })

// A file of the repo that netlify.toml includes with the functions.
export async function repoFile(path) {
  for (const root of [process.cwd(), process.env.LAMBDA_TASK_ROOT].filter(Boolean)) {
    try { return await readFile(join(root, path), 'utf8') } catch {}
  }
  throw new Error('missing ' + path)
}

export async function seed(ns, c) {
  try { return JSON.parse(await repoFile(join('data', ns, c + '.json'))) } catch { return {} }
}

export async function readDocs(ns, c) {
  return (await blobs().get(`${ns}/${c}`, { type: 'json' })) ?? await seed(ns, c)
}
