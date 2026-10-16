import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/**
 * Le front est rendu par un serveur Node (adapter-node) : `npm run build` rend
 * build/, que `node build` sert. Les pages publiques (accueil, textes,
 * categories, a propos) arrivent remplies : les moteurs de recherche et les
 * apercus de liens (WhatsApp...) lisent leur contenu sans executer de
 * JavaScript. Les pages privees (admin, chat) restent rendues dans le
 * navigateur : elles dependent du jeton, garde dans localStorage.
 *
 * En production, Caddy passe au serveur Node tout ce qui n'est pas /api, sur la
 * meme VM que l'API (deploiement/oracle dans le depot backend). Le serveur a
 * besoin de ORIGIN (https://<domaine>) et de API_INTERNE (http://api:8000) :
 * voir src/hooks.server.ts.
 *
 * precompress : les fichiers statiques sortent aussi en .br et .gz, que le
 * serveur sert tels quels.
 *
 * @type {import('@sveltejs/kit').Config}
 */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      out: 'build',
      precompress: true
    })
  }
};

export default config;
