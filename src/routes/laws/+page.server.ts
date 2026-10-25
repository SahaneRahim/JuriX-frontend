import type { Config } from '@sveltejs/adapter-vercel';
import { API_URL, DELAI_API_MS } from '$lib/config';
import { identifiantDepuis } from '$lib/identifiant';
import { TAILLE_PAGE_LOIS } from '$lib/pagination';
import { leverIndisponible, lireJson } from '$lib/panne';
import type { Category, Law, LoiDeListe } from '$lib/types';
import type { PageServerLoad } from './$types';

/**
 * Liste mise en cache par Vercel (ISR) pendant 10 min : elle attendait l'API à
 * chaque visite (1,8 à 2,3 s avant le premier octet, mesurés depuis le
 * Cameroun) ; un document ingéré y apparaît au plus 10 min plus tard.
 *
 * La clé du cache porte les trois paramètres que lit `parametres()`, et eux
 * seuls : chaque filtre et chaque page a sa version, et les autres paramètres
 * (`utm_*`…) n'atteignent pas la fonction.
 */
export const config: Config = {
  isr: { expiration: 600, allowQuery: ['page', 'category', 'lang'] },
};

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

export const load: PageServerLoad = async ({ fetch, url }) => {
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
  // qui doublait le temps d'affichage. `allSettled` : aucune promesse rejetée
  // ne reste sans consommateur.
  const signal = AbortSignal.timeout(DELAI_API_MS);
  const [reponseLois, reponseCategories] = await Promise.allSettled([
    fetch(`${API_URL}/laws/?${params}`, { signal }),
    fetch(`${API_URL}/categories`, { signal }),
  ]);

  // PANNE DE L'API : 503 au rendu comme en navigation, y compris quand seules
  // les catégories manquent. Sans cache, la liste s'affichait sans ses filtres
  // (un confort) plutôt que pas du tout. Mise en cache, cette liste incomplète
  // serait servie à tous pendant 10 min, et remplacerait la version complète
  // si la panne tombait sur une régénération ; un 503 n'est jamais gardé, et
  // Vercel continue de servir la version précédente. `erreur` reste dans les
  // données pour la page, toujours vide.
  const lectureLois = await lireJson<Law[]>(reponseLois);
  const lectureCategories = await lireJson<Category[]>(reponseCategories);
  if (!lectureLois.ok) leverIndisponible('/laws', lectureLois.cause);
  if (!lectureCategories.ok) leverIndisponible('/laws', lectureCategories.cause);

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
    categories: lectureCategories.valeur,
    hasMore,
    page,
    lang,
    category,
    erreur: '',
  };
};
