import type { Config } from '@sveltejs/adapter-vercel';
import { listerTextes } from '$lib/api-publique';
import { ordonnerLesDomaines } from '$lib/categories';
import { ligneAffichee, lotDepuis } from '$lib/components/listes/lots';
import { API_URL, DELAI_API_MS } from '$lib/config';
import { identifiantDepuis } from '$lib/identifiant';
import { TAILLE_PAGE_LOIS } from '$lib/pagination';
import { leverIndisponible, lireJson } from '$lib/panne';
import type { Category, FiltreLangue } from '$lib/types';
import type { PageServerLoad } from './$types';

/**
 * Liste mise en cache par Vercel (ISR) pendant 10 min : elle attendait l'API à
 * chaque visite (1,8 à 2,3 s avant le premier octet, mesurés depuis le
 * Cameroun) ; un document ingéré y apparaît au plus 10 min plus tard.
 *
 * La clé du cache porte les trois paramètres que lit `parametres()`, et eux
 * seuls : chaque filtre et chaque lot a sa version, et les autres paramètres
 * (`utm_*`…) n'atteignent pas la fonction. `page` compte désormais les lots
 * à partir de 1 (« Afficher 20 de plus » mène à `?page=2`, P11).
 */
export const config: Config = {
  isr: { expiration: 600, allowQuery: ['page', 'category', 'lang'] },
};

/**
 * Chargement SERVEUR, et non universel : la page n'affiche que les repères et
 * l'objet de chaque texte, alors que l'ancienne API renvoie chaque texte EN
 * ENTIER. Un `load` universel incrusterait ces réponses brutes dans le HTML ;
 * celui-ci ne renvoie que l'utile, y compris en navigation dans le navigateur.
 *
 * Filtres et lot lus depuis l'URL, jamais depuis un état local : une liste
 * filtrée se partage et se met en signet, et le retour arrière défait le
 * dernier filtre.
 *
 * Toute valeur reçue est validée : ces paramètres viennent de l'extérieur.
 * 99999999999 en catégorie faisait échouer l'API (500), et une adresse
 * malformée était servie comme une panne (503).
 */
function parametres(url: URL) {
  const brut = url.searchParams.get('lang');
  const category = url.searchParams.get('category');
  const idCategorie = identifiantDepuis(category ?? '');
  const lang: FiltreLangue = brut === 'fr' || brut === 'en' ? brut : 'all';
  return {
    lang,
    category: idCategorie === null ? 'all' : String(idCategorie),
    idCategorie,
    page: lotDepuis(url.searchParams.get('page')),
  };
}

export const load: PageServerLoad = async ({ fetch, url }) => {
  const { lang, category, idCategorie, page } = parametres(url);

  // Les deux requêtes en parallèle : la liste des catégories ne dépend d'AUCUN
  // filtre. `listerTextes` ne lève jamais : il rend la cause d'un échec.
  // Une seule requête pour les deux API (lots, tri par date, total sur la
  // nouvelle ; `skip`/`limit` sans texte sur l'ancienne) : $lib/api-publique.
  const [liste, [appelCategories]] = await Promise.all([
    listerTextes(
      {
        categorie: idCategorie,
        langue: lang === 'all' ? null : lang,
        page,
        parPage: TAILLE_PAGE_LOIS,
        // Du plus récent au plus ancien (P11) : l'ancienne API, qui n'a pas de
        // tri, l'ignore, et la page ne l'annonce alors pas.
        tri: 'date_desc',
      },
      { fetch },
    ),
    Promise.allSettled([fetch(`${API_URL}/categories`, { signal: AbortSignal.timeout(DELAI_API_MS) })]),
  ]);

  // PANNE DE L'API : 503 au rendu comme en navigation, y compris quand seules
  // les catégories manquent. Mise en cache, une liste incomplète serait servie
  // à tous pendant 10 min, et remplacerait la version complète si la panne
  // tombait sur une régénération ; un 503 n'est jamais gardé, et Vercel
  // continue de servir la version précédente. `erreur` reste dans les données
  // pour la page, toujours vide.
  const lectureCategories = await lireJson<Category[]>(appelCategories);
  if (!liste.ok) leverIndisponible('/laws', liste.cause);
  if (!lectureCategories.ok) leverIndisponible('/laws', lectureCategories.cause);

  const lot = liste.valeur;
  return {
    // Seuls les champs que la liste affiche (repères, objet, statut) : ni
    // texte, ni cote, ni langue.
    lignes: lot.lignes.map(ligneAffichee),
    page: lot.page,
    parPage: lot.parPage,
    total: lot.total,
    suivante: lot.suivante,
    tri: lot.tri,
    // La liste déroulante des domaines n'en lit que l'identifiant et le nom,
    // dans l'ordre de l'accueil et de la colonne de filtres de /search
    // (`ordonnerLesDomaines`) : un domaine au même rang partout, et non dans
    // l'ordre de l'API (Constitution, administration…).
    categories: ordonnerLesDomaines(lectureCategories.valeur).map(({ id, name }) => ({ id, name })),
    lang,
    category,
    erreur: '',
  };
};
