import { browser } from '$app/environment';
import { API_URL, DELAI_API_MS } from '$lib/config';
import { leverIndisponible } from '$lib/panne';
import type { Category } from '$lib/types';
import type { PageLoad } from './$types';

/**
 * Catégories de la page d'accueil, chargées AVANT le rendu.
 *
 * POURQUOI UN `load` PLUTÔT QU'UN `onMount`. Chargée dans `onMount`, la grille
 * des catégories n'apparaissait qu'après l'exécution du JavaScript : le HTML
 * expédié n'en contenait rien. Un `load` universel la fait rendre par le
 * serveur, avec la page.
 *
 * Le `fetch` vient du paramètre, jamais du global : c'est lui qui transmet la
 * réponse du serveur au client, ce qui évite le SECOND appel réseau que le même
 * code referait à l'hydratation.
 */
export const load: PageLoad = async ({ fetch }) => {
  let cause: unknown;
  try {
    const reponse = await fetch(`${API_URL}/categories`, { signal: AbortSignal.timeout(DELAI_API_MS) });
    if (reponse.ok) {
      const categories: Category[] = await reponse.json();
      return { categories, erreur: '' };
    }
    cause = reponse;
  } catch (e) {
    cause = e;
  }

  // En production serverless (Vercel + Railway), le backend peut être en
  // cold start et mettre plus de temps à répondre. On préfère rendre la page
  // normalement avec un message d'erreur plutôt que de servir un 503 brut :
  // l'utilisateur peut cliquer « Réessayer » une fois le backend réveillé.
  // Le 503 est réservé aux erreurs franches côté serveur (hors timeout).
  const estTimeout = cause instanceof DOMException && cause.name === 'TimeoutError';
  const estErreurReseau = cause instanceof TypeError && !estTimeout;
  if (!browser && !estTimeout && !estErreurReseau) leverIndisponible('/', cause);
  return { categories: [] as Category[], erreur: 'categories.errorLoad' };
};
