# Hub

Tot el que estic llançant, en un sol web amb contrasenya. Cada projecte té la seva pàgina:

- **mAI Fitness** (`public/mai/`): pla de negoci (pla, publicar amb els textos de cada post, com funciona, tasques, guies, estudi i **Documents**), proves pendents i receptari base.
- **Outfit of the Day** (`public/ootd/`): pla de negoci (pla, com funciona, tasques, estudi i **Documents**) i el prototip de l'estilista.
- **AI Slides to Figma** (`public/figma/`): les imatges de la Community, la fitxa per publicar i el README.

Què hi ha de cada projecte ho diu `hub.config.json`: les pàgines, els documents que es copien del seu repo i el color. Per afegir un projecte nou, s'hi afegeix una entrada i `npm run build`.

El que es marca (tasques, posts publicats, proves, vots del receptari) es desa per a tothom qui entra amb la contrasenya.

## En local

```bash
npm install
npm run build         # copia els documents dels repos i fa les pàgines
npm start             # http://localhost:4321
```

- En local no hi ha contrasenya, i el que marques es desa a `data/` (no a Netlify).
- Per obrir-lo des del mòbil a la mateixa wifi: `HOST=0.0.0.0 npm start` i entra a `http://<ip-de-l'ordinador>:4321`.
- Els repos es busquen al costat del hub (`../mAI_fitness`, `../outfit-of-the-day`, `../ai-slides-to-figma`). Quan canviïs un document en un repo, `npm run build` i fes commit del resultat: Netlify no fa el build, perquè allà no hi ha els repos.
- Tests: `npm test`.

## Publicat (Netlify)

La configuració és a `netlify.toml`: publica `public/` tal com és al repo, sense build, i hi afegeix la funció `netlify/functions/store.mjs` a `/api/store`.

- **Contrasenya:** la de Netlify (Site configuration → Access & security → Visitor access → Password protection).
- **Dades:** es desen a Netlify Blobs (store `hub`, una entrada `<pàgina>/<col·lecció>` per a cada una). Una col·lecció que encara no s'ha tocat a Netlify comença amb el que hi ha a `data/` al repo; a partir del primer canvi, mana el que hi ha a Blobs i `data/` ja no es llegeix.

## Com està fet

- Les pàgines són les dels artifacts, sense canvis de contingut. `assets/store.js` els dona la mateixa API de dades que tenien a Claude (`claude.use('db')`), però sobre `api/store` (la funció de Netlify, o `server.mjs` en local; les regles són a `lib/store.mjs`). Comprova si hi ha canvis cada 5 s.
- Les pàgines de projecte i la portada les genera `scripts/build.mjs` a partir de `hub.config.json`; no s'editen a mà.
