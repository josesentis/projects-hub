# mAI Hub

Tot el material de mAI Fitness que vivia en artifacts de Claude, en un sol web amb contrasenya:

- **Pla de negoci** (`negoci.html`): pla, publicar (calendari i textos de cada post), com funciona l'app, tasques, guies, estudi de mercat i **Documents**.
- **Documents**: llançament, beta, roadmap i TODOs, i la documentació tècnica, copiats del repo de l'app.
- **Proves pendents** (`proves.html`), **receptari base** (`receptari.html`) i **prototips** (`prototips.html`).

El que es marca (tasques, posts publicats, proves, vots del receptari) es desa a `data/` i ho veu tothom qui entra amb la contrasenya.

## En local

```bash
npm install
npm run password      # usuari i contrasenya → .htpasswd
npm start             # http://localhost:4321
```

- Per obrir-lo des del mòbil a la mateixa wifi: `HOST=0.0.0.0 npm start` i entra a `http://<ip-de-l'ordinador>:4321`.
- Per actualitzar els documents després de canviar-los a l'app: `npm run docs` (llegeix `../mAI_fitness`; o `MAI_REPO=/ruta npm run docs`).
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
- No hi ha documents de l'Outfit of the Day: aquest hub és només de mAI Fitness.
