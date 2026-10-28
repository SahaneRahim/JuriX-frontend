import { defineConfig, devices } from '@playwright/test';

// L'API que lit le site construit pour les tests : la meme que celle que les
// specs interrogent directement (`VITE_API_URL ?? 'http://localhost:8000'`).
//
// PIEGE : src/lib/config.ts prend « http://localhost:8000 » — la valeur de
// .env — pour « rien de precise » et, dans un build, se rabat sur l'API
// Railway de production. Le site teste aurait parle a la production, ou a un
// hote eteint, pendant que les specs lisaient la base locale. 127.0.0.1
// designe le meme backend sans declencher ce repli.
const API_DES_TESTS = (process.env.VITE_API_URL ?? 'http://localhost:8000').replace(
  /^http:\/\/localhost:/,
  'http://127.0.0.1:',
);

// Chrome de bureau sans sa taille d'ecran (1280x720) : le projet `responsif`
// fixe les siennes, describe par describe.
const { viewport: _tailleDeBureau, ...chromeSansTaille } = devices['Desktop Chrome'];

export default defineConfig({
  testDir: './tests/e2e',
  // Sequentiel et mono-processus : les specs partagent un backend reel sur
  // :8000, et `backend-down` coupe l'API par `page.route`. Le parallelisme
  // rendrait l'ordre — et donc les verdicts — dependants de l'ordonnanceur.
  // (Les commentaires precedents invoquaient Zerostep, retire du projet.)
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // AUCUNE reprise, meme en CI. Une reprise transforme un test instable en
  // test vert : elle cache l'information au lieu de la corriger. L'instabilite
  // observee ici venait de clics partis avant l'hydratation, corriges a la
  // source dans tests/e2e/hydratation.ts.
  retries: 0,
  workers: 1,
  timeout: 60000, // 60s per test
  reporter: [
    ['html'],
    ['list']
  ],
  use: {
    baseURL: 'http://localhost:4173',
    // Un profil deja choisi : sans lui, la question « Qui etes-vous ? »
    // couvrirait chaque page a la premiere visite, et chaque clic des specs
    // existants buterait sur elle. « citoyen » garde aussi le corps des
    // requetes du chat identique a l'ancien `persona: "citoyen"` en dur.
    // tests/e2e/navigation/persona.spec.ts repart d'un navigateur vide.
    storageState: {
      cookies: [],
      origins: [
        { origin: 'http://localhost:4173', localStorage: [{ name: 'jurix-persona', value: 'citoyen' }] },
      ],
    },
    // `on-first-retry` ne produisait JAMAIS de trace en local, ou retries vaut
    // 0 : un echec local ne laissait aucun element de diagnostic.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // Les tailles d'ecran ont leurs propres projets, ci-dessous : la suite
      // habituelle reste celle d'avant, au viewport de bureau.
      testIgnore: [
        'navigation/responsif.spec.ts',
        'navigation/monochrome.spec.ts',
        'navigation/redimensionnement.spec.ts',
      ],
    },
    {
      // Le site sur six tailles d'ecran, du telephone de 360 px au bureau, et
      // trois telephones courts pour le bouton flottant de l'accueil
      // (tests/e2e/navigation/responsif.spec.ts). La spec fixe elle-meme
      // chaque taille, emulation mobile et tactile comprises (`test.use` par
      // describe) : le projet ne fournit que le navigateur.
      //   npx playwright test --project=responsif
      name: 'responsif',
      testMatch: 'navigation/responsif.spec.ts',
      use: chromeSansTaille,
    },
    {
      // Le noir et blanc : aucune teinte peinte, sauf le rouge des erreurs, sur
      // 21 pages en 390x844 et 1440x900, clair et sombre, et sur ce qui ne
      // s'ouvre qu'a la demande (menus, palette, fenetres, tiroirs, erreurs) ;
      // l'interface anglaise sans reste de francais. Avec CAPTURES_DIR, une
      // capture par page et par taille (tests/e2e/navigation/monochrome.spec.ts).
      //   CAPTURES_DIR=… npx playwright test --project=monochrome
      name: 'monochrome',
      testMatch: 'navigation/monochrome.spec.ts',
      use: chromeSansTaille,
    },
    {
      // Le redimensionnement en direct, de 1920 a 320 px sans recharger, les
      // ecrans courts, les tiroirs et fenetres qui traversent un changement de
      // taille, et les cibles de 44 px au doigt
      // (tests/e2e/navigation/redimensionnement.spec.ts).
      //   npx playwright test --project=redimensionnement
      name: 'redimensionnement',
      testMatch: 'navigation/redimensionnement.spec.ts',
      use: chromeSansTaille,
    },
  ],
  webServer: [{
    // BUILD DE PRODUCTION, et non serveur de developpement.
    //
    // Vite compile chaque route a la premiere requete : le premier affichage
    // d'une page pouvait prendre plusieurs secondes, retardant d'autant
    // l'hydratation. C'etait la principale source de variance de cette suite.
    // Le build est compile une fois, puis servi tel quel.
    //
    // `vite preview`, et non plus `node build`. Le site est deploye sur Vercel
    // (svelte.config.js : adapter-vercel), dont le build ecrit .vercel/output
    // et plus aucun serveur Node dans build/. `node build` y relancait le
    // dernier build adapter-node reste sur le disque, sans la moindre erreur —
    // la suite testait du code perime — ou echouait sur un clone neuf. vite
    // preview sert la sortie propre a SvelteKit (.svelte-kit/output), la meme
    // quel que soit l'adaptateur, avec les memes hooks (src/hooks.server.ts) ;
    // l'environnement du processus, API_INTERNE comprise, arrive a
    // $env/dynamic/private comme avec node build. Ce qu'il ne fait pas
    // tourner, la fonction Vercel elle-meme, ne se verifie qu'au deploiement.
    //
    // Adresse et port en options : vite preview ne lit ni PORT ni HOST. ORIGIN
    // n'a plus d'objet : l'origine des pages vient de l'en-tete Host, donc
    // http://localhost:4173, celle de `baseURL`. --strictPort fait echouer le
    // demarrage si le port est pris, au lieu de glisser sur le suivant — 4174,
    // celui du second serveur.
    //
    // VITE_API_URL : voir API_DES_TESTS en tete de fichier. Figee dans le code
    // au build, et relue par le serveur de preview.
    command: 'npm run build && npx vite preview --host 127.0.0.1 --port 4173 --strictPort',
    env: { VITE_API_URL: API_DES_TESTS },
    url: 'http://localhost:4173',
    // JAMAIS de reutilisation : `reuseExistingServer` acceptait n'importe quel
    // serveur trouve sur le port, y compris un serveur de developpement lance
    // a la main sur du code ancien. Les tests passaient alors sur autre chose
    // que ce qu'on croyait mesurer — pire qu'instable, silencieusement faux.
    // Le port 4173 est distinct du 5173 du developpement, pour qu'ils
    // coexistent sans se confondre.
    reuseExistingServer: false,
    timeout: 180000,
  }, {
    // Le MEME build, servi une seconde fois avec une API injoignable :
    // API_INTERNE vise un nom qui ne se resout pas (.invalid, reserve a cet
    // usage), comme une adresse mal recopiee. C'est le seul moyen de faire echouer les
    // appels que le serveur fait lui-meme (page.route ne voit que ceux du
    // navigateur), donc de verifier les 503 du rendu serveur et la reecriture
    // de src/hooks.server.ts (tests/e2e/navigation/panne-api.spec.ts).
    // Demarre apres le premier, build compris : Playwright lance ses serveurs
    // l'un apres l'autre. La sonde vise un fichier : toutes les pages qui
    // appellent l'API y repondent 503.
    command: 'npx vite preview --host 127.0.0.1 --port 4174 --strictPort',
    env: { VITE_API_URL: API_DES_TESTS, API_INTERNE: 'http://api-injoignable.invalid:8000' },
    url: 'http://localhost:4174/favicon.svg',
    reuseExistingServer: false,
    timeout: 30000,
  }],
});
