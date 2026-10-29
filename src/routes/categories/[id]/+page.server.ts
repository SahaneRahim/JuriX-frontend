import { error } from '@sveltejs/kit';
import type { Config } from '@sveltejs/adapter-vercel';
import { listerTextes } from '$lib/api-publique';
import { ligneAffichee, lotDepuis } from '$lib/components/listes/lots';
import { API_URL, DELAI_API_MS } from '$lib/config';
import { identifiantDepuis } from '$lib/identifiant';
import { TAILLE_PAGE_LOIS } from '$lib/pagination';
import { leverIndisponible, lireJson } from '$lib/panne';
import type { Category, FiltreLangue } from '$lib/types';
import type { PageServerLoad } from './$types';

/**
 * Catégorie mise en cache par Vercel (ISR) pendant 10 min : c'était la page la
 * plus lente du site (2,6 à 4,4 s avant le premier octet, mesurés depuis le
 * Cameroun). Les deux paramètres que lit le `load` entrent dans la clé du
 * cache, eux seuls : `lang`, et `page`, le lot de 20 textes (« Afficher 20 de
 * plus » mène à `?page=2`, P11). Les autres paramètres n'atteignent pas la
 * fonction.
 */
export const config: Config = {
  isr: { expiration: 600, allowQuery: ['lang', 'page'] },
};

/**
 * Documents d'une catégorie, par lots de 20, du plus récent au plus ancien.
 *
 * P11 : plus d'extrait de texte. C'était le début brut de l'OCR (« 1 0 DEC
 * 2018 DECRETN° 2018/763 DU portant… »), répété sur chaque carte ; il ne
 * servait plus qu'au filtre local du champ de recherche, qui cherche
 * désormais VRAIMENT dans les textes du domaine (formulaire GET vers /search,
 * P8). L'API n'envoie donc plus aucun texte (`listerTextes`), là où elle
 * envoyait le début de 50 documents, 30 à 90 Ko.
 *
 * DEUX DÉFAUTS CORRIGÉS ICI, l'un de performance, l'autre de vérité.
 *
 * 1. CASCADE. Le composant appelait `GET /categories/{id}` puis, une fois la
 *    réponse revenue, `GET /laws/?category_id=…` — alors que la seconde requête
 *    ne dépend que de l'identifiant, connu dès le départ. Les deux partent
 *    maintenant ensemble.
 *
 * 2. SOFT-404. Sans `load`, le rendu serveur répondait 200 pour une catégorie
 *    inexistante. `error(404)` rend le statut conforme à ce que la page montre.
 *
 * L'EN-TÊTE VIENT DE LA LISTE `GET /categories`, et non de
 * `GET /categories/{id}`. Les deux rendent le même `CategoryResponse` ; mais
 * le détail fait charger par l'ORM toutes les lois de la catégorie et tous
 * leurs articles pour n'en rendre que 206 octets : 1,9 s côté serveur pour le
 * droit pénal, 7,4 s pour la fonction publique (1 277 lois). La liste est une
 * seule requête agrégée (0,65 s). `limit=1000`, le maximum de l'API : une
 * catégorie absente de la liste répond 404, la liste doit donc être complète.
 */
export const load: PageServerLoad = async ({ fetch, params, url }) => {
  // Contrôle avant tout appel : `/categories/abc` n'a aucune raison de
  // consommer une requête pour apprendre qu'il n'existe pas.
  const id = identifiantDepuis(params.id);
  if (id === null) {
    throw error(404, 'Catégorie introuvable');
  }

  const brut = url.searchParams.get('lang');
  const lang: FiltreLangue = brut === 'fr' || brut === 'en' ? brut : 'all';
  const page = lotDepuis(url.searchParams.get('page'));

  // Les deux appels ensemble. `listerTextes` ne lève jamais (il rend la cause
  // d'un échec) ; `allSettled` : une panne réseau sur les catégories ne laisse
  // aucune promesse rejetée sans consommateur.
  const [[appelCategories], liste] = await Promise.all([
    Promise.allSettled([fetch(`${API_URL}/categories?limit=1000`, { signal: AbortSignal.timeout(DELAI_API_MS) })]),
    listerTextes(
      { categorie: id, langue: lang === 'all' ? null : lang, page, parPage: TAILLE_PAGE_LOIS, tri: 'date_desc' },
      { fetch },
    ),
  ]);

  const lectureCategories = await lireJson<Category[]>(appelCategories);

  // API éteinte, en erreur ou hors délai : 503, au rendu comme en navigation.
  // Une catégorie sans sa liste ne vaut pas mieux, pour un robot, qu'une page
  // vide ; et mise en cache, une page amputée serait servie à tous pendant
  // 10 min, à la place de la bonne version. Un 503 n'est jamais gardé : Vercel
  // continue de servir la version précédente. `erreur` reste dans les données
  // pour la page, toujours vide.
  //
  // Le 404 se décide APRÈS que les deux appels sont réglés, et sur une liste
  // de catégories lisible seulement : une liste en panne ne prouve pas
  // l'absence.
  if (!lectureCategories.ok) leverIndisponible(`/categories/${id}`, lectureCategories.cause);
  const categorie = lectureCategories.valeur.find((c) => c.id === id);
  if (!categorie) {
    throw error(404, 'Catégorie introuvable');
  }
  if (!liste.ok) leverIndisponible(`/categories/${id}`, liste.cause);

  const lot = liste.valeur;
  return {
    categorie,
    // Seuls les champs que la liste affiche (repères, objet, statut).
    lignes: lot.lignes.map(ligneAffichee),
    page: lot.page,
    parPage: lot.parPage,
    total: lot.total,
    suivante: lot.suivante,
    tri: lot.tri,
    lang,
    erreur: '',
  };
};
