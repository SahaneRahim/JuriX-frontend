import { defineConfig, devices } from '@playwright/test';

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
    },
  ],
  webServer: [{
    // BUILD DE PRODUCTION, et non serveur de developpement.
    //
    // Vite compile chaque route a la premiere requete : le premier affichage
    // d'une page pouvait prendre plusieurs secondes, retardant d'autant
    // l'hydratation. C'etait la principale source de variance de cette suite.
    // Le build est compile une fois, puis servi tel quel.
    // `node build`, et non `vite preview` : c'est le serveur de production
    // (adapter-node), avec sa lecture de l'environnement et ORIGIN. vite
    // preview rend avec un serveur generique, et un mauvais adaptateur y
    // passerait inapercu. Sans ORIGIN, adapter-node suppose https : l'origine
    // de la page et celle des appels a l'API ne concorderaient plus.
    command: 'npm run build && node build',
    env: { PORT: '4173', HOST: '127.0.0.1', ORIGIN: 'http://localhost:4173' },
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
    command: 'node build',
    env: { PORT: '4174', HOST: '127.0.0.1', ORIGIN: 'http://localhost:4174', API_INTERNE: 'http://api-injoignable.invalid:8000' },
    url: 'http://localhost:4174/favicon.svg',
    reuseExistingServer: false,
    timeout: 30000,
  }],
});
