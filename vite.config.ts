import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit()],
  build: {
    // Jamais de police incrustee en base64 : le sous-ensemble de Material
    // Icons (src/lib/polices, 3 Ko) passe sous le seuil de 4 Ko de Vite. Dans
    // la feuille de style, il en grossirait le chemin critique a chaque
    // deploiement qui touche une classe ; et src/hooks.server.ts ne pourrait
    // plus le precharger (une adresse data: au lieu d'un fichier). Seul, il
    // reste un fichier immuable, en cache un an. Les autres fichiers gardent
    // le seuil par defaut (undefined).
    assetsInlineLimit: (fichier) => (fichier.endsWith('.woff2') ? false : undefined)
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,ts}']
  },
  // Sans la condition 'browser', Vite resout Svelte vers son build serveur et
  // tout render() de @testing-library/svelte echoue sur "mount(...) is not
  // available on the server". La condition doit etre posee a la racine, pas
  // dans test : c'est la resolution du plugin sveltekit() qu'elle corrige.
  // Conditionnee a VITEST pour ne rien changer aux builds dev et production.
  resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
  server: {
    port: 5173
  }
});
