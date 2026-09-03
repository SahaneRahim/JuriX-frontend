import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit()],
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
