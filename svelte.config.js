import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/**
 * Le front est un site STATIQUE : `npm run build` rend un dossier de fichiers
 * (build/) que n'importe quel serveur web sert tel quel. Aucune page n'a de
 * code serveur (+page.server, +server, hooks.server) : tout passe par l'API.
 *
 * En production, Caddy le sert sur la meme VM que l'API (deploiement/oracle
 * dans le depot backend), et renvoie index.html pour toute route inconnue :
 * c'est `fallback` qui rend les liens profonds (/laws/123) utilisables.
 *
 * @type {import('@sveltejs/kit').Config}
 */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: 'index.html',
      precompress: false,
      strict: true
    })
  }
};

export default config;
