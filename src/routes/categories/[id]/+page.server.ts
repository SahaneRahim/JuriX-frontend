import { error } from '@sveltejs/kit';
import type { Config } from '@sveltejs/adapter-vercel';
import { API_URL, DELAI_API_MS } from '$lib/config';
import { identifiantDepuis } from '$lib/identifiant';
import { leverIndisponible, lireJson } from '$lib/panne';
import type { Category, FiltreLangue, Law, LawResume } from '$lib/types';
import { descriptionDepuis } from '$lib/seo';
import type { PageServerLoad } from './$types';

/**
 * Catégorie mise en cache par Vercel (ISR) pendant 10 min : c'était la page la
 * plus lente du site (2,6 à 4,4 s avant le premier octet, mesurés depuis le
 * Cameroun). Seul `lang`, le filtre que lit le `load`, entre dans la clé du
 * cache ; les autres paramètres n'atteignent pas la fonction.
 */
export const config: Config = {
  isr: { expiration: 600, allowQuery: ['lang'] },
};

/**
 * Longueur du début de texte demandée à l'API (`content_max_chars`) : la page
 * n'en montre qu'un extrait de 300 caractères (`descriptionDepuis`), et l'API
 * renvoyait chaque texte EN ENTIER, à chaque génération : 800 Ko pour les 16
 * documents du droit pénal, jusqu'à 3,6 Mo pour les 50 premiers d'une autre
 * catégorie. Le début suffit, mais nettoyé (marqueurs de page, tableaux,
 * markdown, blancs de l'OCR), il raccourcit : sur les 2 275 textes publiés du
 * corpus (vérifié le 28/10), 1 000 caractères changeaient encore un extrait,
 * 1 500 n'en changent plus aucun. 2 000 gardent une marge pour un préambule
 * plus bruité : 30 à 90 Ko de texte au lieu de 0,6 à 3,6 Mo. Une API qui
 * ignorerait ce paramètre rendrait le texte entier, comme avant.
 */
const DEBUT_DU_TEXTE = 2000;

/**
 * Documents d'une catégorie.
 *
 * Chargement SERVEUR : l'API renvoyait le texte intégral de chacun des 50
 * documents (820 Ko pour le droit pénal ; leur début seulement depuis
 * `DEBUT_DU_TEXTE`), que la page ne montre que sur deux lignes. Un `load` universel l'incrustait dans le HTML (1,6 Mo) et le rendait
 * en entier sous un line-clamp (2 s de calcul de mise en page mesurées) ; seul
 * un extrait part maintenant vers le navigateur.
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
 *
 * L'EN-TÊTE VIENT DE LA LISTE `GET /categories`, et non plus de
 * `GET /categories/{id}`. Les deux rendent le même `CategoryResponse` (nom,
 * description, icône, date, nombre de documents compté de la même façon) ;
 * mais le détail fait charger par l'ORM toutes les lois de la catégorie et
 * tous leurs articles pour n'en rendre que 206 octets : 1,9 s côté serveur
 * pour le droit pénal, 7,4 s pour la fonction publique (1 277 lois). La liste
 * est une seule requête agrégée (0,65 s). `limit=1000`, le maximum de l'API :
 * une catégorie absente de la liste répond 404, la liste doit donc être
 * complète (100 par défaut, pour 14 catégories aujourd'hui).
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

  const cible = new URLSearchParams({
    category_id: String(id),
    limit: '50',
    content_max_chars: String(DEBUT_DU_TEXTE),
  });
  if (lang !== 'all') cible.set('language', lang);

  // `allSettled` et non `all` : une panne réseau sur l'une des deux ne doit pas
  // faire rejeter l'autre, et surtout ne doit pas laisser de promesse non
  // traitée derrière elle.
  const signal = AbortSignal.timeout(DELAI_API_MS);
  const [reponseCategories, reponseLois] = await Promise.allSettled([
    fetch(`${API_URL}/categories?limit=1000`, { signal }),
    fetch(`${API_URL}/laws/?${cible}`, { signal }),
  ]);

  const lectureCategories = await lireJson<Category[]>(reponseCategories);
  const lectureLois = await lireJson<Law[]>(reponseLois);

  // API éteinte, en erreur ou hors délai : 503, au rendu comme en navigation.
  // Une catégorie sans sa liste ne vaut pas mieux, pour un robot, qu'une page
  // vide ; et mise en cache, une page amputée serait servie à tous pendant
  // 10 min, à la place de la bonne version. Un 503 n'est jamais gardé : Vercel
  // continue de servir la version précédente. `erreur` reste dans les données
  // pour la page, toujours vide.
  //
  // Le 404 se décide APRÈS que les deux promesses sont réglées (le lever plus
  // tôt laisserait la requête des lois en vol, sans consommateur), et sur une
  // liste lisible seulement : une liste en panne ne prouve pas l'absence.
  if (!lectureCategories.ok) leverIndisponible(`/categories/${id}`, lectureCategories.cause);
  const categorie = lectureCategories.valeur.find((c) => c.id === id);
  if (!categorie) {
    throw error(404, 'Catégorie introuvable');
  }
  if (!lectureLois.ok) leverIndisponible(`/categories/${id}`, lectureLois.cause);

  // Seuls les champs que la page affiche, et un extrait au lieu du texte.
  const documents: LawResume[] = lectureLois.valeur.map(({ id, title, publication_date, content }) => ({
    id,
    title,
    publication_date,
    content: descriptionDepuis(content, 300),
  }));
  return { categorie, documents, lang, erreur: '' };
};
