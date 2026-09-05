import { API_URL } from '$lib/api';
import { TAILLE_PAGE_LOIS } from '$lib/pagination';
import type { Category, Law } from '$lib/types';
import type { PageLoad } from './$types';

/**
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

  return {
    lang: lang === 'fr' || lang === 'en' ? lang : 'all',
    // Un identifiant de catégorie est un entier positif ; tout le reste vaut
    // « toutes », plutôt qu'une requête vouée à l'échec.
    category: Number.isInteger(Number(category)) && Number(category) > 0 ? String(Number(category)) : 'all',
    page: Number.isFinite(brutPage) && brutPage > 0 ? Math.floor(brutPage) : 0,
  };
}

export const load: PageLoad = async ({ fetch, url }) => {
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
  const [reponseLois, reponseCategories] = await Promise.allSettled([
    fetch(`${API_URL}/laws/?${params}`),
    fetch(`${API_URL}/categories`),
  ]);

  let categories: Category[] = [];
  if (reponseCategories.status === 'fulfilled' && reponseCategories.value.ok) {
    categories = await reponseCategories.value.json().catch(() => []);
  }

  if (reponseLois.status !== 'fulfilled' || !reponseLois.value.ok) {
    // Pas d'`error()` : une liste est une page qui existe même quand le backend
    // est éteint. Elle doit s'afficher avec son message et sa reprise.
    return { laws: [] as Law[], categories, hasMore: false, page, lang, category, erreur: 'laws.errorLoad' };
  }

  const donnees: Law[] = await reponseLois.value.json();
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
