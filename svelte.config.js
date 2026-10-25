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
      // Région des fonctions : iad1 (Washington), celle par défaut, tant que
      // l'API tourne chez Railway en us-east4 (Virginie). Chaque rendu non mis
      // en cache appelle l'API ; depuis iad1, elle est à 2 ms. fra1 ne ferait
      // gagner que 60 ms environ sur le trajet bord de Vercel -> fonction, et
      // en ajouterait 90 à chaque appel à l'API.
      //
      // À passer à `regions: ['fra1']` dans le MÊME déploiement que l'API sur
      // Railway EU West et la base chez Neon (Francfort) : environ 150 ms de
      // moins par page non mise en cache. Changer aussi la région par défaut
      // du projet dans les réglages Vercel : le cache ISR durable suit
      // celle-là, pas cette option. Avec l'ISR, la région ne joue plus qu'aux
      // premières générations et aux régénérations.
    })
  }
};

export default config;
