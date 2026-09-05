import { API_URL } from '$lib/api';
import type { Category } from '$lib/types';
import type { PageLoad } from './$types';

/**
 * Catégories de la page d'accueil, chargées AVANT le rendu.
 *
 * POURQUOI UN `load` PLUTÔT QU'UN `onMount`. L'adaptateur Vercel rend déjà
 * chaque page dans une fonction serverless : le coût du rendu serveur était donc
 * payé, mais son bénéfice perdu, puisque le HTML expédié ne contenait qu'une
 * coquille vide et que la grille des catégories n'apparaissait qu'après
 * l'exécution du JavaScript. Un `load` universel remplit cette coquille.
 *
 * Le `fetch` vient du paramètre, jamais du global : c'est lui qui transmet la
 * réponse du serveur au client, ce qui évite le SECOND appel réseau que le même
 * code referait à l'hydratation.
 */
export const load: PageLoad = async ({ fetch }) => {
  try {
    const reponse = await fetch(`${API_URL}/categories`);
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);

    const categories: Category[] = await reponse.json();
    return { categories, erreur: '' };
  } catch {
    // Ni `error()` ni exception : un backend éteint doit laisser la page
    // s'afficher avec son message et sa reprise, pas la transformer en 500.
    // C'est la politique d'erreur posée à l'étape 3, et le rendu serveur en
    // rendrait l'écart bien plus visible qu'auparavant.
    return { categories: [] as Category[], erreur: 'categories.errorLoad' };
  }
};
