import { error } from '@sveltejs/kit';
import { API_URL, DELAI_API_MS } from '$lib/config';
import { identifiantDepuis } from '$lib/identifiant';
import { leverIndisponible, lireJson } from '$lib/panne';
import type { Category, FiltreLangue, Law, LawResume } from '$lib/types';
import { descriptionDepuis } from '$lib/seo';
import type { PageServerLoad } from './$types';

/**
 * Documents d'une catégorie.
 *
 * Chargement SERVEUR : l'API renvoie le texte intégral de chacun des 50
 * documents (820 Ko pour le droit pénal), que la page ne montre que sur deux
 * lignes. Un `load` universel l'incrustait dans le HTML (1,6 Mo) et le rendait
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
 */
export const load: PageServerLoad = async ({ fetch, params, url, isDataRequest }) => {
  // Contrôle avant tout appel : `/categories/abc` n'a aucune raison de
  // consommer une requête pour apprendre qu'il n'existe pas.
  const id = identifiantDepuis(params.id);
  if (id === null) {
    throw error(404, 'Catégorie introuvable');
  }

  const brut = url.searchParams.get('lang');
  const lang: FiltreLangue = brut === 'fr' || brut === 'en' ? brut : 'all';

  const cible = new URLSearchParams({ category_id: String(id), limit: '50' });
  if (lang !== 'all') cible.set('language', lang);

  // `allSettled` et non `all` : une panne réseau sur l'une des deux ne doit pas
  // faire rejeter l'autre, et surtout ne doit pas laisser de promesse non
  // traitée derrière elle.
  const signal = AbortSignal.timeout(DELAI_API_MS);
  const [reponseCategorie, reponseLois] = await Promise.allSettled([
    fetch(`${API_URL}/categories/${id}`, { signal }),
    fetch(`${API_URL}/laws/?${cible}`, { signal }),
  ]);

  // Le 404 se décide APRÈS que les deux promesses sont réglées. Le lever plus
  // tôt laisserait la requête des lois en vol, sans consommateur.
  if (reponseCategorie.status === 'fulfilled' && reponseCategorie.value.status === 404) {
    throw error(404, 'Catégorie introuvable');
  }

  // API éteinte, en erreur ou hors délai : au rendu serveur (premier
  // affichage, et tout ce que lit un robot), un 503 ($lib/panne). Une catégorie
  // sans sa liste ne vaut pas mieux, pour un robot, qu'une page vide.
  const lectureCategorie = await lireJson<Category>(reponseCategorie);
  const lectureLois = await lireJson<Law[]>(reponseLois);
  if (!lectureCategorie.ok || !lectureLois.ok) {
    if (!isDataRequest) {
      const cause = !lectureCategorie.ok ? lectureCategorie.cause : !lectureLois.ok ? lectureLois.cause : null;
      leverIndisponible(`/categories/${id}`, cause);
    }
    // Dans le navigateur (requête de données), si la catégorie est là mais pas
    // sa liste, l'en-tête s'affiche et l'erreur porte sur les documents seuls :
    // plus honnête qu'une page entièrement en erreur, et qu'une liste vide
    // silencieuse.
    return {
      categorie: lectureCategorie.ok ? lectureCategorie.valeur : null,
      documents: [] as LawResume[],
      lang,
      erreur: 'categories.errorLoad',
    };
  }

  // Seuls les champs que la page affiche, et un extrait au lieu du texte.
  const documents: LawResume[] = lectureLois.valeur.map(({ id, title, publication_date, content }) => ({
    id,
    title,
    publication_date,
    content: descriptionDepuis(content, 300),
  }));
  return { categorie: lectureCategorie.valeur, documents, lang, erreur: '' };
};
