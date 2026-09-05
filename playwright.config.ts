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
  webServer: {
    // BUILD DE PRODUCTION, et non serveur de developpement.
    //
    // Vite compile chaque route a la premiere requete : le premier affichage
    // d'une page pouvait prendre plusieurs secondes, retardant d'autant
    // l'hydratation. C'etait la principale source de variance de cette suite.
    // Le build est compile une fois, puis servi tel quel.
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    // JAMAIS de reutilisation : `reuseExistingServer` acceptait n'importe quel
    // serveur trouve sur le port, y compris un serveur de developpement lance
    // a la main sur du code ancien. Les tests passaient alors sur autre chose
    // que ce qu'on croyait mesurer — pire qu'instable, silencieusement faux.
    // Le port 4173 est distinct du 5173 du developpement, pour qu'ils
    // coexistent sans se confondre.
    reuseExistingServer: false,
    timeout: 180000,
  },
});
