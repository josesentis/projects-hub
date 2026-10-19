# Hub

Tot el que estic llançant, en un sol web amb contrasenya. Cada projecte té la seva pàgina:

- **mAI Fitness** (`public/mai/`): pla de negoci (pla, publicar amb els textos de cada post, com funciona, tasques, guies, estudi i **Documents**), proves pendents, receptari base i prototips.
- **Outfit of the Day** (`public/ootd/`): pla de negoci (pla, com funciona, tasques, estudi i **Documents**) i el prototip de l'estilista.
- **AI Slides to Figma** (`public/figma/`): les imatges de la Community, la fitxa per publicar i el README.

Què hi ha de cada projecte ho diu `hub.config.json`: les pàgines, els documents que es copien del seu repo i el color. Per afegir un projecte nou, s'hi afegeix una entrada i `npm run build`.

El que es marca (tasques, posts publicats, proves, vots del receptari) es desa a `data/` i ho veu tothom qui entra amb la contrasenya.

## En local

```bash
npm install
npm run password      # usuari i contrasenya → .htpasswd
npm run build         # copia els documents dels repos i fa les pàgines
npm start             # http://localhost:4321
```

- Per obrir-lo des del mòbil a la mateixa wifi: `HOST=0.0.0.0 npm start` i entra a `http://<ip-de-l'ordinador>:4321`.
- Els repos es busquen al costat del hub (`../mAI_fitness`, `../outfit-of-the-day`, `../ai-slides-to-figma`). Quan canviïs un document en un repo, `npm run build`.
- Tests: `npm test`.

## Publicat (Apache amb PHP)

1. Puja la carpeta sencera al servidor. La carpeta `public/` és l'arrel del web. `data/` i `.htpasswd` han de quedar al costat, fora de `public/`.
2. A `public/.htaccess`, posa a `AuthUserFile` la ruta absoluta del `.htpasswd` al servidor.
3. `data/` ha de ser escrivible per PHP (`chmod -R 775 data`, o el que demani el teu hosting).
4. Si el hosting només et deixa una carpeta, posa `data/` dins de `public/`. El seu `.htaccess` la tanca, però llavors defineix `HUB_DATA` (`SetEnv HUB_DATA /ruta/a/public/data` a `.htaccess`).

`public/api/store.php` desa les dades a Apache. `server.mjs` fa el mateix en local. La contrasenya és la mateixa als dos llocs (format `$apr1$`, el de `htpasswd -m`).

## Com està fet

- Les pàgines són les dels artifacts, sense canvis de contingut. `assets/store.js` els dona la mateixa API de dades que tenien a Claude (`claude.use('db')`), però sobre `api/store.php`. Comprova si hi ha canvis cada 5 s.
- Els prototips (`*.dc.html`) es dibuixen amb `assets/dc-lite.js`, un motor petit per a les plantilles `{{…}}`, `<sc-for>` i `<sc-if>` del canvas de disseny.
- Les pàgines de projecte i la portada les genera `scripts/build.mjs` a partir de `hub.config.json`; no s'editen a mà.
