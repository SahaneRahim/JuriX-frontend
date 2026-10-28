import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// PRÉCHARGEMENT DES PAGES : data-sveltekit-preload-data="hover", posé sur le
// <body> de src/app.html. Ses raisons sont écrites ici et non à côté de
// l'attribut : app.html est le gabarit de chaque page, envoyé tel quel, et
// chacun de ses commentaires part dans chaque réponse HTML, à chaque visiteur.
//
// Au survol d'un lien (au toucher sur téléphone), SvelteKit demande le code de
// la route EN MÊME TEMPS que son __data.json (en cache chez Vercel), sans les
// enchaîner : un data-sveltekit-preload-code="hover" n'y ajoutait rien.
//
// Pas de preload-code="viewport" : il téléchargerait ET exécuterait, juste
// après l'hydratation, le code de chaque route dont un lien est à l'écran
// (environ huit depuis l'en-tête, 40 à 60 Ko compressés), sur des téléphones
// modestes et des forfaits au mégaoctet, pour ne gagner que le téléchargement
// de ce code, déjà parallèle à celui des données, et seulement à la première
// visite de chaque route. S'il le faut un jour, le poser sur les seules listes
// de documents (vers /laws/[id], la route la plus lourde), pas sur le <body>.

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
