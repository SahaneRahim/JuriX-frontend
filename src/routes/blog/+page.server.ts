import { API_URL, DELAI_API_MS } from '$lib/config';
import { BLOG_POSTS, articlesDepuisLApi, avecLesArticlesDeLaRedaction, type BlogPost } from '$lib/data/blog';
import { decrirePanne } from '$lib/panne';
import type { PageServerLoad } from './$types';

/**
 * La liste du blog : les articles publiés ET publiables de l'API
 * (`articlesDepuisLApi` : un article publié avant la vérification n'y entre
 * jamais), et TOUJOURS les trois articles de la rédaction, du plus récent au
 * plus ancien (`avecLesArticlesDeLaRedaction`).
 *
 * POURQUOI SERVEUR, AVEC UN DÉLAI. Le `load` était universel et sans délai :
 * à chaque navigation, c'est le téléphone qui appelait l'API, et une API
 * figée retenait la page 45 s (revue du 29/10) au lieu de servir les
 * articles de la rédaction. Comme les autres pages publiques, il tourne au
 * serveur et attend l'API au plus DELAI_API_MS ($lib/config, qui n'importe
 * aucun store : $lib/api en charge, à éviter dans un `load`).
 *
 * PAS D'ISR, à dessein. Les autres pages publiques sont mises en cache par
 * Vercel ; celle-ci non : un article retiré du site (dépublié pour une
 * erreur) resterait listé, avec son résumé, jusqu'à l'expiration du cache.
 * Le but du propriétaire est qu'aucun contenu juridique faux n'atteigne un
 * lecteur : un retrait doit valoir tout de suite.
 *
 * PANNE DE L'API : les articles de la rédaction seuls, en 200, et la cause
 * dans le journal. Ils sont toujours justes (extraits relevés mot pour mot) ;
 * une liste momentanément plus courte vaut mieux qu'une page d'erreur. Un 404
 * est le cas normal d'une API sans route /blog (la production du 29/10) : rien
 * à journaliser.
 */
export const load: PageServerLoad = async ({ fetch }): Promise<{ posts: BlogPost[] }> => {
  let reponse: Response;
  try {
    reponse = await fetch(`${API_URL}/blog`, { signal: AbortSignal.timeout(DELAI_API_MS) });
  } catch (e) {
    console.warn(`[blog] /blog : API indisponible (${decrirePanne(e)}), articles de la rédaction seuls`);
    return { posts: BLOG_POSTS };
  }

  if (!reponse.ok) {
    if (reponse.status !== 404) {
      console.warn(`[blog] /blog : API en erreur (${decrirePanne(reponse)}), articles de la rédaction seuls`);
    }
    return { posts: BLOG_POSTS };
  }

  let brut: unknown;
  try {
    brut = await reponse.json();
  } catch (e) {
    console.warn(`[blog] /blog : réponse illisible (${decrirePanne(e)}), articles de la rédaction seuls`);
    return { posts: BLOG_POSTS };
  }
  return { posts: avecLesArticlesDeLaRedaction(articlesDepuisLApi(brut)) };
};
