import type { Config } from '@sveltejs/adapter-vercel';
import { API_URL, DELAI_API_MS } from '$lib/config';
import { leverIndisponible } from '$lib/panne';
import type { Category } from '$lib/types';
import type { PageServerLoad } from './$types';

/**
 * Accueil mis en cache par Vercel (ISR) pendant 10 min.
 *
 * Sans cache, chaque visite attendait /categories avant le premier octet
 * (1,1 à 1,4 s mesurés depuis le Cameroun), alors que le seul élément qui en
 * dépend est la grille, sous le hero. En cache, la page part du réseau de
 * Vercel (0,15 s environ) ; la fonction ne tourne plus qu'à la première visite
 * d'un déploiement et aux régénérations, en arrière-plan.
 *
 * Aucun paramètre d'URL dans la clé du cache : la page n'en lit aucun (la
 * recherche part vers /search), et sans `allowQuery` Vercel les ignore tous,
 * `utm_*` compris, qui sinon créeraient chacun leur version de la page.
 */
export const config: Config = {
  isr: { expiration: 600 },
};

/**
 * Catégories de la page d'accueil, chargées AVANT le rendu.
 *
 * POURQUOI UN `load` PLUTÔT QU'UN `onMount`. Chargée dans `onMount`, la grille
 * des catégories n'apparaissait qu'après l'exécution du JavaScript : le HTML
 * expédié n'en contenait rien.
 *
 * POURQUOI SERVEUR, ET NON UNIVERSEL. Un `load` universel tournait aussi dans
 * le navigateur à chaque navigation vers l'accueil : le téléphone appelait
 * alors Railway lui-même (2,3 à 2,6 s depuis le Cameroun). Côté serveur, la
 * navigation lit le `__data.json` de la page, mis en cache avec elle.
 *
 * PANNE DE L'API : 503, au rendu comme en navigation. L'accueil répondait 200
 * avec une grille vide et un bouton « Réessayer » (83d8e36), pour rester
 * accessible pendant un démarrage à froid de Railway. Mis en cache, ce 200
 * serait servi à tous pendant 10 min, et remplacerait la bonne version si la
 * panne tombait sur une régénération. Un 503 n'est jamais gardé : Vercel
 * continue de servir la version précédente et réessaie 30 s plus tard. Seule la
 * toute première génération d'un déploiement peut encore montrer la page
 * d'erreur, avec son lien « Réessayer ». `erreur` reste dans les données pour
 * la page, toujours vide.
 */
export const load: PageServerLoad = async ({ fetch }) => {
  let cause: unknown;
  try {
    const reponse = await fetch(`${API_URL}/categories`, { signal: AbortSignal.timeout(DELAI_API_MS) });
    if (reponse.ok) {
      // Dans le try : un 200 qui n'est pas du JSON (un proxy qui répond à la
      // place de l'API) est une panne de l'API, pas une erreur de la page.
      const categories: Category[] = await reponse.json();
      return { categories, erreur: '' };
    }
    cause = reponse;
  } catch (e) {
    cause = e;
  }
  return leverIndisponible('/', cause);
};
