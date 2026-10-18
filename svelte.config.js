import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/**
 * Adaptateur Vercel pour le déploiement serverless du frontend SvelteKit.
 *
 * @type {import('@sveltejs/kit').Config}
 */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      runtime: 'nodejs22.x'
    })
  }
};

export default config;
