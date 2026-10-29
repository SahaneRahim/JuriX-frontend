import { redirect } from '@sveltejs/kit';
import { adresseDeLArticle, lireChiffresDuCorpus, rechercherTextes } from '$lib/api-publique';
import { API_URL, DELAI_API_MS } from '$lib/config';
import { decrirePanne, lireJson } from '$lib/panne';
import type { Category } from '$lib/types';
import type { PageServerLoad } from './$types';
import { aDesAffinages, aDesFiltres, demandeAffinee, demandeClassique, lireParametres } from './parametres';
import {
  domainesDuPanneau,
  effectifsParNature,
  idsDesFacettes,
  resultatAffiche,
  type DonneesDeRecherche,
} from './resultats';

/*
 * /search RENDU AU SERVEUR (P8).
 *
 * La page chargeait ses résultats dans `onMount` : avant le JavaScript (réseau
 * lent, Opera Mini en mode Extreme), la recherche ne partait pas, et le HTML
 * servi ne contenait que des squelettes. Le formulaire GET (SearchBar, la page
 * d'un domaine, l'en-tête) arrive maintenant ici, et la page part complète :
 * résultats, effectifs, filtres, pagination. Avec JavaScript, filtres et pages
 * restent des navigations sans rechargement (le `__data.json` de ce `load`).
 *
 * PAS D'ISR. Une page par requête et par filtre : un cache n'y servirait
 * presque jamais deux fois la même adresse, et chaque adresse nouvelle
 * coûterait une génération. Pas de `config.isr` donc, et rien du visiteur
 * n'est lu (ni cookie ni en-tête) : seuls l'adresse et le `fetch` du `load`.
 *
 * PANNE DE L'API : la page s'affiche quand même, avec son message et
 * « Réessayer » (`search-error`), et la barre de recherche reste utilisable.
 * Le 503 des pages en cache (laws, catégories) n'a pas lieu d'être ici : rien
 * n'est gardé, et une erreur dans la page vaut mieux, pour qui cherche, que la
 * page d'erreur du site. La cause va au journal du serveur.
 */

/**
 * Les noms des domaines (`GET /categories`), identifiant par identifiant ; une
 * table vide en cas d'échec : la page nomme alors moins bien un filtre, elle
 * ne tombe pas pour autant.
 */
async function lireNomsDesDomaines(fetchApi: typeof fetch): Promise<Map<number, string>> {
  const [appel] = await Promise.allSettled([
    fetchApi(`${API_URL}/categories?limit=1000`, { signal: AbortSignal.timeout(DELAI_API_MS) }),
  ]);
  const lecture = await lireJson<Category[]>(appel);
  if (!lecture.ok || !Array.isArray(lecture.valeur)) return new Map();
  return new Map(
    lecture.valeur
      .filter((c) => Number.isInteger(c?.id) && typeof c.name === 'string')
      .map((c) => [c.id, c.name] as [number, string]),
  );
}

export const load: PageServerLoad = async ({ fetch, url }): Promise<DonneesDeRecherche> => {
  const parametres = lireParametres(url.searchParams);
  const debut: DonneesDeRecherche = {
    parametres,
    etat: 'debut',
    erreur: '',
    resultats: [],
    total: 0,
    affinee: false,
    candidats: null,
    natures: null,
    domaines: [],
    nomsDesDomaines: {},
    corpus: null,
  };
  // Aucune requête : la page « Commencez votre recherche », sans appel.
  if (!parametres.q) return debut;

  // Année du serveur (UTC) : « Cette année » et « 5 dernières années ».
  const annee = new Date().getUTCFullYear();

  // Toujours la recherche AFFINÉE d'abord (refine, sort, facets). L'ancienne
  // API ignore ces champs sans erreur et répond dans sa forme classique, sans
  // `facets` : c'est ainsi qu'on la reconnaît (contrat §0.3, §8).
  let lecture = await rechercherTextes(demandeAffinee(parametres, annee), { fetch });

  if (lecture.ok) {
    // « article 35 du code minier » : le serveur a reconnu le texte ET vérifié
    // que l'article y existe. On y va directement. Une redirection du serveur,
    // et non un `goto` après coup : le retour arrière ne repasse pas par la
    // recherche, qui y renverrait aussitôt.
    const { reponse } = lecture.valeur;
    if (reponse.direct_navigation && reponse.target_law_id && reponse.target_article) {
      redirect(303, adresseDeLArticle(reponse.target_law_id, reponse.target_article));
    }
    // Ancienne API et filtres de `refine` dans l'adresse (nature, case de
    // domaine, période : une adresse partagée) : elle les ignore, la réponse
    // n'en est PAS filtrée. Une seconde demande les passe en `filters`, que
    // l'ancienne API applique en SQL depuis toujours : résultats justes, sans
    // effectifs ni tri. Le périmètre d'une page de domaine (`perimetre=13`)
    // partait déjà en `filters` : seul, il ne coûte pas de seconde demande.
    if (!lecture.valeur.affinee && aDesAffinages(parametres)) {
      lecture = await rechercherTextes(demandeClassique(parametres, annee), { fetch });
    }
  }

  if (!lecture.ok) {
    console.error(`[recherche] /search : API indisponible (${decrirePanne(lecture.cause)})`);
    return {
      ...debut,
      etat: 'erreur',
      // Une réponse en erreur (4xx, 5xx) n'est pas une coupure du réseau : le
      // message le dit, pour qu'on ne cherche pas la panne de son côté.
      erreur: lecture.cause instanceof Response ? 'search.errorSearch' : 'search.errorServer',
    };
  }

  const { reponse, affinee } = lecture.valeur;
  const facettes = affinee ? reponse.facets : null;
  const total = Number.isInteger(reponse.total) ? reponse.total : reponse.results.length;
  const candidats = affinee && Number.isInteger(reponse.candidates) ? (reponse.candidates as number) : null;

  // Les domaines cochés dans la colonne : ceux des cases, et le périmètre, que
  // la colonne montre coché parmi eux (le décocher l'ôte).
  const coches = [...new Set([...parametres.perimetre, ...parametres.categories])];

  // Les noms des domaines cochés, seulement s'il les faut : un domaine coché
  // que les effectifs ne nomment pas (nouvelle API ; un périmètre où rien
  // n'est trouvé), ou le rappel des filtres de l'ancienne API, qui n'a pas
  // d'effectifs. Pas d'appel sinon : la colonne reconnaît les 14 domaines par
  // leur nom.
  const faceIds = idsDesFacettes(facettes?.categories);
  const besoinDeNoms = coches.length > 0 && (!affinee || coches.some((id) => !faceIds.has(id)));
  const noms = besoinDeNoms ? await lireNomsDesDomaines(fetch) : new Map<number, string>();

  // Rien trouvé du tout (ni avec ni sans filtre) : l'état vide cite le
  // périmètre du corpus (« 2 275 textes officiels camerounais, OHADA et
  // CIMA », GET /corpus, contrat §2). Ancienne API : 404, et un texte sans
  // chiffre. Pas d'appel quand des résultats existent, ni dans un périmètre :
  // rien dans un domaine ne dit rien du reste du corpus.
  const rienDuTout =
    total === 0 && (affinee ? candidats === 0 && parametres.perimetre.length === 0 : !aDesFiltres(parametres));
  const chiffres = rienDuTout ? await lireChiffresDuCorpus({ fetch }) : null;

  return {
    parametres,
    etat: 'resultats',
    erreur: '',
    resultats: reponse.results.map(resultatAffiche),
    total,
    affinee,
    candidats,
    natures: facettes ? effectifsParNature(facettes.types) : null,
    domaines: facettes ? domainesDuPanneau(facettes.categories, coches, noms) : [],
    nomsDesDomaines: Object.fromEntries(coches.filter((id) => noms.has(id)).map((id) => [id, noms.get(id) as string])),
    corpus: chiffres ? { textes: chiffres.textes, sources: chiffres.libelle_sources } : null,
  };
};
