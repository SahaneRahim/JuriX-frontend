import { error } from '@sveltejs/kit';
import { API_URL } from '$lib/api';
import type { Category, FiltreLangue, Law } from '$lib/types';
import type { PageLoad } from './$types';

/**
 * Documents d'une catégorie.
 *
 * DEUX DÉFAUTS CORRIGÉS ICI, l'un de performance, l'autre de vérité.
 *
 * 1. CASCADE. Le composant appelait `GET /categories/{id}` puis, une fois la
 *    réponse revenue, `GET /laws/?category_id=…` — alors que la seconde requête
 *    ne dépend que de l'identifiant, connu dès le départ. Les deux partent
 *    maintenant ensemble.
 *
 * 2. SOFT-404. Sans `load`, le rendu serveur répondait 200 pour une catégorie
 *    inexistante : l'adresse existait aux yeux d'un moteur, d'un client HTTP et
 *    d'un moniteur, et seul le contenu affiché disait le contraire. `error(404)`
 *    rend le statut conforme à ce que la page montre.
 */
export const load: PageLoad = async ({ fetch, params, url }) => {
  const id = Number(params.id);
  // Contrôle avant tout appel : `/categories/abc` n'a aucune raison de
  // consommer une requête pour apprendre qu'il n'existe pas.
  if (!Number.isInteger(id) || id <= 0) {
    throw error(404, 'Catégorie introuvable');
  }

  const brut = url.searchParams.get('lang');
  const lang: FiltreLangue = brut === 'fr' || brut === 'en' ? brut : 'all';

  const cible = new URLSearchParams({ category_id: String(id), limit: '50' });
  if (lang !== 'all') cible.set('language', lang);

  // `allSettled` et non `all` : une panne réseau sur l'une des deux ne doit pas
  // faire rejeter l'autre, et surtout ne doit pas laisser de promesse non
  // traitée derrière elle.
  const [reponseCategorie, reponseLois] = await Promise.allSettled([
    fetch(`${API_URL}/categories/${id}`),
    fetch(`${API_URL}/laws/?${cible}`),
  ]);

  // Le 404 se décide APRÈS que les deux promesses sont réglées. Le lever plus
  // tôt laisserait la requête des lois en vol, sans consommateur.
  if (reponseCategorie.status === 'fulfilled' && reponseCategorie.value.status === 404) {
    throw error(404, 'Catégorie introuvable');
  }

  if (reponseCategorie.status !== 'fulfilled' || !reponseCategorie.value.ok) {
    return { categorie: null, documents: [] as Law[], lang, erreur: 'categories.errorLoad' };
  }

  const categorie: Category = await reponseCategorie.value.json();

  let documents: Law[] = [];
  let erreur = '';
  if (reponseLois.status === 'fulfilled' && reponseLois.value.ok) {
    documents = await reponseLois.value.json().catch(() => []);
  } else {
    // La catégorie est là mais pas sa liste : l'en-tête peut s'afficher, et
    // l'erreur porte sur les documents seuls. C'est plus honnête qu'une page
    // entièrement en erreur, et plus honnête qu'une liste vide silencieuse.
    erreur = 'categories.errorLoad';
  }

  return { categorie, documents, lang, erreur };
};
