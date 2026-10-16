import { API_URL, DELAI_API_MS } from '$lib/config';
import { identifiantDepuis } from '$lib/identifiant';
import { TAILLE_PAGE_LOIS } from '$lib/pagination';
import { leverIndisponible, lireJson } from '$lib/panne';
import type { Category, Law, LoiDeListe } from '$lib/types';
import type { PageServerLoad } from './$types';

/**
 * Chargement SERVEUR, et non universel : la page n'affiche que le titre, la
 * référence, la date, le type et le nombre d'articles, alors que l'API renvoie
 * chaque texte EN ENTIER. Un `load` universel incrusterait ces réponses brutes
 * dans le HTML (300 à 350 Ko par page) ; celui-ci ne renvoie que l'utile, y
 * compris en navigation dans le navigateur.
 *
 * Filtres et pagination lus depuis l'URL, jamais depuis un état local.
 *
 * POURQUOI DÉPLACER L'ÉTAT DANS L'URL. Les filtres vivaient dans le composant :
 * toutes les combinaisons partageaient donc la MÊME adresse. Une liste filtrée
 * était impossible à partager, impossible à mettre en signet, et le retour
 * arrière du navigateur sautait la page entière au lieu de défaire le filtre.
 * Portés par l'URL, ils deviennent l'entrée d'un `load`, ce qui règle les trois
 * d'un coup.
 *
 * Toute valeur reçue est validée : ces paramètres viennent de l'extérieur, et un
 * `page=-5` non contrôlé produirait un `skip` négatif que l'API rejette.
 */
function parametres(url: URL) {
  const lang = url.searchParams.get('lang');
  const category = url.searchParams.get('category');
  const brutPage = Number(url.searchParams.get('page'));

  // Un identifiant de catégorie valide ($lib/identifiant) ; tout le reste vaut
  // « toutes », plutôt qu'une requête vouée à l'échec. La page est bornée pour
  // que `skip` reste un entier que l'API accepte : 99999999999 en catégorie
  // ou 1e21 en page faisaient échouer l'API (500, 422), et une adresse
  // malformée était servie comme une panne (503).
  const idCategorie = identifiantDepuis(category ?? '');
  return {
    lang: lang === 'fr' || lang === 'en' ? lang : 'all',
    category: idCategorie === null ? 'all' : String(idCategorie),
    page: Number.isFinite(brutPage) && brutPage > 0 ? Math.min(Math.floor(brutPage), PAGE_MAX) : 0,
  };
}

/** Dernière page demandable : au-delà, `skip` dépasserait un entier 32 bits. */
const PAGE_MAX = Math.floor(2_147_483_647 / TAILLE_PAGE_LOIS) - 1;

export const load: PageServerLoad = async ({ fetch, url, isDataRequest }) => {
  const { lang, category, page } = parametres(url);

  const params = new URLSearchParams({
    skip: String(page * TAILLE_PAGE_LOIS),
    // limit + 1 : une ligne de plus que la page suffit à savoir s'il existe une
    // suite, sans second appel de comptage. L'API ne renvoie pas de total.
    limit: String(TAILLE_PAGE_LOIS + 1),
  });
  if (lang !== 'all') params.set('language', lang);
  if (category !== 'all') params.set('category_id', category);

  // Les deux requêtes en parallèle : la liste des catégories ne dépend d'AUCUN
  // filtre, l'enchaîner derrière la liste des lois était une cascade gratuite
  // qui doublait le temps d'affichage.
  //
  // `allSettled` et non `all` : l'échec des catégories ne doit pas vider la
  // liste des documents. Les filtres sont un confort ; la liste est le contenu.
  const signal = AbortSignal.timeout(DELAI_API_MS);
  const [reponseLois, reponseCategories] = await Promise.allSettled([
    fetch(`${API_URL}/laws/?${params}`, { signal }),
    fetch(`${API_URL}/categories`, { signal }),
  ]);

  const lectureCategories = await lireJson<Category[]>(reponseCategories);
  const categories = lectureCategories.ok ? lectureCategories.valeur : [];

  const lectureLois = await lireJson<Law[]>(reponseLois);
  if (!lectureLois.ok) {
    // Au rendu serveur (premier affichage, et tout ce que lit un robot), un 503
    // ($lib/panne). En navigation dans le navigateur (requête de données), la
    // liste garde son message et sa reprise.
    if (!isDataRequest) leverIndisponible('/laws', lectureLois.cause);
    return { laws: [] as LoiDeListe[], categories, hasMore: false, page, lang, category, erreur: 'laws.errorLoad' };
  }

  // Seuls les champs que la liste affiche : l'API renvoie chaque texte EN
  // ENTIER, avec une douzaine de champs dont la page ne lit aucun.
  const donnees: LoiDeListe[] = lectureLois.valeur.map(
    ({ id, title, reference, publication_date, article_count, type }) => ({
      id,
      title,
      reference,
      publication_date,
      article_count,
      type,
    }),
  );
  const hasMore = donnees.length > TAILLE_PAGE_LOIS;

  return {
    laws: hasMore ? donnees.slice(0, TAILLE_PAGE_LOIS) : donnees,
    categories,
    hasMore,
    page,
    lang,
    category,
    erreur: '',
  };
};
