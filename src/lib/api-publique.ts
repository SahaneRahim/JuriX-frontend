/**
 * Appels PUBLICS de l'API (sans jeton) ajoutés par la refonte UX, et lecture
 * des champs qu'elle apporte. Source : data/ux-impl/contrat-api.md (branche
 * `feat/ux-api` du backend, d99e23c).
 *
 * POURQUOI UN MODULE À PART, ET PAS $lib/api. $lib/api charge les stores du
 * navigateur (authentification, profil) et $app/navigation : importé par un
 * `load` serveur, il les instancierait sur le serveur, où ils deviennent des
 * singletons partagés par toutes les requêtes ($lib/config le rappelle). Les
 * routes d'ici sont publiques et servent des deux côtés : rendu serveur de
 * /search, des listes et de l'accueil du chat, aperçu d'une citation dans le
 * navigateur. Ce module n'importe que $lib/config, $lib/pagination et des types.
 *
 * LA NOUVELLE API N'EST PAS ENCORE DÉPLOYÉE. Chaque fonction se replie sans
 * erreur sur l'ancienne (contrat, §0 et §8) : une route qu'elle ne connaît pas
 * (404 « Not Found ») rend `null` ; un paramètre qu'elle ignore rend la forme
 * d'avant, normalisée ; et rien n'affirme ce que la réponse ne prouve pas
 * (ni total ni tri inventés, jamais « en vigueur »).
 *
 * `fetch` : passer celui du `load` (au serveur, src/hooks.server.ts le dirige
 * vers l'API interne) ; à défaut, celui du navigateur.
 */

import { API_URL, DELAI_API_MS } from '$lib/config';
import { TAILLE_PAGE_LOIS } from '$lib/pagination';
import type { Lecture } from '$lib/panne';
import type {
  AffinageDeRecherche,
  ArticleApercu,
  Changement,
  ChiffresDuCorpus,
  LangueDocument,
  LigneDeTexte,
  NatureEnBref,
  SearchFilters,
  SearchRequest,
  SearchResponse,
  SearchResult,
  StatutEnBref,
  StatutJuridique,
  TexteLie,
  TriDeRecherche,
  TriDesTextes,
} from '$lib/types';

/* -------------------------------------------------------------------------- */
/* Appel                                                                       */
/* -------------------------------------------------------------------------- */

export interface OptionsDAppel {
  /** Le `fetch` du `load` au serveur ; celui du navigateur par défaut. */
  fetch?: typeof fetch;
  /**
   * Abandon voulu par l'appelant (nouvelle frappe, feuille fermée). Il
   * REMPLACE le délai de $lib/config : `AbortSignal.any`, qui les combinerait,
   * manque encore à une partie des téléphones visés.
   */
  signal?: AbortSignal;
}

/**
 * Le délai de $lib/config, là où le navigateur sait le poser :
 * `AbortSignal.timeout` n'existe qu'à partir de Safari 16. Sans lui, l'appel
 * part quand même, sans borne : mieux qu'une exception qui ferait tout échouer.
 */
function signalDe(options: OptionsDAppel): AbortSignal | undefined {
  if (options.signal) return options.signal;
  return typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(DELAI_API_MS)
    : undefined;
}

/**
 * Le corps JSON d'un appel, ou la cause de l'échec, sans jamais lever : rejet
 * (réseau, délai), statut d'erreur, ou corps qui n'est pas du JSON (un proxy
 * qui répond à la place de l'API).
 */
async function lire(url: string, options: OptionsDAppel, init: RequestInit = {}): Promise<Lecture<unknown>> {
  let reponse: Response;
  try {
    reponse = await (options.fetch ?? fetch)(url, { ...init, signal: signalDe(options) });
  } catch (cause) {
    return { ok: false, cause };
  }
  if (!reponse.ok) return { ok: false, cause: reponse };
  try {
    return { ok: true, valeur: await reponse.json() };
  } catch (cause) {
    return { ok: false, cause };
  }
}

function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur);
}

/**
 * Un entier entre `min` et `max`, ou `defaut` : les paramètres viennent d'une
 * adresse (`?page=abc`, `?page=1e21`) et l'API refuserait le reste (422).
 */
function entierBorne(valeur: number | undefined, min: number, max: number, defaut: number): number {
  if (valeur === undefined || !Number.isFinite(valeur)) return defaut;
  return Math.min(max, Math.max(min, Math.floor(valeur)));
}

/** « AAAA-MM-JJ » en tête de chaîne : une date que `formatDate` sait lire. */
function estDateIso(valeur: unknown): valeur is string {
  return typeof valeur === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valeur);
}

/* -------------------------------------------------------------------------- */
/* GET /corpus : les chiffres du corpus (P4, état vide de P7, Q1)              */
/* -------------------------------------------------------------------------- */

/**
 * Les chiffres du corpus, ou `null` : ancienne API (route inconnue, 404),
 * panne, délai dépassé ou réponse d'une autre forme. Sur `null`, l'écran garde
 * un texte générique, SANS chiffre ni date : un nombre écrit en dur vieillirait
 * en silence.
 *
 * La réponse porte `Cache-Control: public, max-age=300` : le navigateur ne la
 * redemande pas à chaque ouverture du chat.
 */
export async function lireChiffresDuCorpus(options: OptionsDAppel = {}): Promise<ChiffresDuCorpus | null> {
  const lecture = await lire(`${API_URL}/corpus`, options);
  if (!lecture.ok) return null;
  const v = lecture.valeur;
  const valide =
    estObjet(v) &&
    typeof v.textes === 'number' &&
    typeof v.articles === 'number' &&
    estDateIso(v.liens_releves_le) &&
    estObjet(v.libelle_sources) &&
    Array.isArray(v.textes_par_nature) &&
    Array.isArray(v.sources);
  return valide ? (v as unknown as ChiffresDuCorpus) : null;
}

/* -------------------------------------------------------------------------- */
/* GET /laws/{id}/articles/{numero} : aperçu d'une citation (P3)               */
/* -------------------------------------------------------------------------- */

/**
 * L'aperçu d'un article (feuille d'une citation du chat), ou `null`.
 *
 * `null` couvre trois cas, que l'écran traite de la même façon : ouvrir le
 * texte à l'article (`adresseDeLArticle`) au lieu de la feuille.
 * - 404 de la nouvelle API : l'article n'existe pas dans ce texte, ou
 *   `article_id` désigne un morceau qui ne le porte pas ;
 * - 404 « Not Found » de l'ancienne API, qui ne connaît pas la route ;
 * - panne, délai dépassé, réponse d'une autre forme.
 * Aucune requête pour un numéro vide ou de plus de 64 caractères : l'API le
 * refuserait (422).
 *
 * @param numero `citation.article` du chat (« 35 », « 1er », « L 7 bis »)
 * @param articleId `citation.article_id` : choisit l'article parmi les
 *   homonymes d'une compilation (les quatre « 53 » du Code civil)
 */
export async function lireApercuDArticle(
  lawId: number,
  numero: string,
  articleId?: number | null,
  options: OptionsDAppel = {},
): Promise<ArticleApercu | null> {
  const n = numero.trim();
  if (!Number.isInteger(lawId) || lawId < 1 || !n || n.length > 64) return null;
  const requete = Number.isInteger(articleId) && (articleId as number) > 0 ? `?article_id=${articleId}` : '';
  const lecture = await lire(`${API_URL}/laws/${lawId}/articles/${encodeURIComponent(n)}${requete}`, options);
  if (!lecture.ok) return null;
  const v = lecture.valeur;
  const valide =
    estObjet(v) &&
    typeof v.contenu === 'string' &&
    typeof v.numero === 'string' &&
    estObjet(v.texte) &&
    estObjet(v.statut) &&
    typeof v.statut.etat_du_texte === 'string' &&
    Array.isArray(v.statut.changements);
  return valide ? (v as unknown as ArticleApercu) : null;
}

/**
 * Adresse d'un article dans la page de son texte : le paramètre `?article=`,
 * que la page lit déjà et qui reste hors de la clé du cache ISR
 * (src/routes/laws/[id]/+page.server.ts). « Lire dans le texte intégral »
 * (P3) et le repli d'un aperçu introuvable y mènent. Sans numéro (citation
 * d'un texte entier), la page du texte.
 */
export function adresseDeLArticle(lawId: number, numero?: string | null): string {
  const n = numero?.trim();
  return n ? `/laws/${lawId}?article=${encodeURIComponent(n)}` : `/laws/${lawId}`;
}

/* -------------------------------------------------------------------------- */
/* GET /laws/ : listes de textes par lots (P11)                                */
/* -------------------------------------------------------------------------- */

export interface DemandeDeListe {
  /** Domaine (`category_id`). */
  categorie?: number | null;
  langue?: LangueDocument | null;
  /** À partir de 1 ; un lot par page (« Afficher 20 de plus » pointe vers `?page=N+1`). */
  page?: number;
  /** 1 à 100 ; 20 par défaut (lots de 20, P11). */
  parPage?: number;
  /** `date_desc` par défaut, comme la nouvelle API en mode page. */
  tri?: TriDesTextes;
}

export interface ListeDeTextes {
  lignes: LigneDeTexte[];
  page: number;
  parPage: number;
  /** Nombre total de textes ; `null` sur l'ancienne API, qui ne le donne pas : masquer « N textes ». */
  total: number | null;
  /** Nombre de pages ; `null` sur l'ancienne API. */
  pages: number | null;
  /** Il existe un lot suivant (sur l'ancienne API : déduit d'une ligne demandée en plus). */
  suivante: boolean;
  /**
   * Tri garanti par l'API ; `null` sur l'ancienne, qui n'en applique aucun :
   * ne pas annoncer alors « du plus récent au plus ancien ».
   */
  tri: TriDesTextes | null;
}

/** Plafond de `page` de la nouvelle API (au-delà, 422). */
const PAGE_MAX = 10_000_000;

/** Les repères de ligne, recopiés seulement s'ils sont là : leur absence signale l'ancienne API. */
const CLES_DES_REPERES = ['objet', 'numero', 'date_signature', 'annee', 'date_publication_jo', 'statut'] as const;

type LigneBrute = Partial<LigneDeTexte> & { category?: { name?: string | null } | null } & Record<string, unknown>;

/**
 * Une ligne réduite à ce que les listes affichent. Ni texte (l'ancienne API
 * le renvoie pour chaque ligne), ni cote PRC, que les listes n'affichent plus
 * (P2, P11) : la page et son `__data.json` restent légers.
 */
function versLigne(brute: LigneBrute): LigneDeTexte {
  const ligne: LigneDeTexte = {
    id: Number(brute.id),
    title: String(brute.title ?? ''),
    type: brute.type ?? 'autre',
    language: brute.language ?? null,
    category_id: brute.category_id ?? null,
    // L'ancienne API n'a que la catégorie imbriquée (quand elle la charge).
    category_name: brute.category_name ?? brute.category?.name ?? null,
    publication_date: brute.publication_date ?? null,
    article_count: typeof brute.article_count === 'number' ? brute.article_count : 0,
  };
  const reperes: Record<string, unknown> = ligne as unknown as Record<string, unknown>;
  for (const cle of CLES_DES_REPERES) {
    if (cle in brute) reperes[cle] = brute[cle];
  }
  return ligne;
}

/**
 * Un lot de textes, sur l'une ou l'autre API, ou la cause de l'échec (pour
 * `leverIndisponible` de $lib/panne : une liste en panne n'est jamais servie
 * vide, sous ISR elle resterait en cache).
 *
 * UNE SEULE REQUÊTE POUR LES DEUX API. Elle porte les paramètres des deux
 * modes : la nouvelle API, voyant `page`, rend sa page légère triée
 * (`LawListPage`) et ignore `skip`, `limit` et `content_max_chars` ;
 * l'ancienne ignore `page`, `page_size` et `sort`, et rend le tableau nu
 * d'avant, sans texte (`content_max_chars=0`), avec une ligne de plus que le
 * lot pour savoir s'il existe une suite. Sans ces paramètres-là, l'ancienne
 * rendrait 100 lignes avec leur texte entier.
 */
export async function listerTextes(
  demande: DemandeDeListe = {},
  options: OptionsDAppel = {},
): Promise<Lecture<ListeDeTextes>> {
  const parPage = entierBorne(demande.parPage, 1, 100, TAILLE_PAGE_LOIS);
  const page = entierBorne(demande.page, 1, PAGE_MAX, 1);
  const tri: TriDesTextes = demande.tri ?? 'date_desc';

  const parametres = new URLSearchParams({
    page: String(page),
    page_size: String(parPage),
    sort: tri,
    skip: String((page - 1) * parPage),
    limit: String(parPage + 1),
    content_max_chars: '0',
  });
  if (demande.categorie != null) parametres.set('category_id', String(demande.categorie));
  if (demande.langue) parametres.set('language', demande.langue);

  const lecture = await lire(`${API_URL}/laws/?${parametres}`, options);
  if (!lecture.ok) return lecture;
  const v = lecture.valeur;

  // Ancienne API : le tableau nu, sans total ni ordre garanti (contrat §8).
  if (Array.isArray(v)) {
    const lignes = (v as LigneBrute[]).slice(0, parPage).map(versLigne);
    return {
      ok: true,
      valeur: { lignes, page, parPage, total: null, pages: null, suivante: v.length > parPage, tri: null },
    };
  }
  if (estObjet(v) && Array.isArray(v.items) && typeof v.total === 'number') {
    const pages = typeof v.pages === 'number' ? v.pages : Math.ceil(v.total / parPage);
    const pageRendue = typeof v.page === 'number' ? v.page : page;
    return {
      ok: true,
      valeur: {
        lignes: (v.items as LigneBrute[]).map(versLigne),
        page: pageRendue,
        parPage: typeof v.page_size === 'number' ? v.page_size : parPage,
        total: v.total,
        pages,
        suivante: pageRendue < pages,
        tri: v.sort === 'date_asc' || v.sort === 'date_desc' ? v.sort : tri,
      },
    };
  }
  return { ok: false, cause: new Error('GET /laws/ : réponse ni tableau ni page de textes') };
}

/* -------------------------------------------------------------------------- */
/* POST /search/ : recherche affinée (P7, P8)                                  */
/* -------------------------------------------------------------------------- */

export interface DemandeDeRecherche {
  query: string;
  /** « hybrid » par défaut (mots + sens), comme la page actuelle. */
  mode?: string;
  /** 1 à 50 ; 20 par défaut. */
  limit?: number;
  offset?: number;
  /** Délimite l'ensemble candidat en SQL ; `status` est toujours « published ». */
  filters?: Omit<SearchFilters, 'status'>;
  sort?: TriDeRecherche;
  refine?: AffinageDeRecherche;
  /** Demander les effectifs : bascule seul dans la recherche affinée. */
  facets?: boolean;
}

export interface ResultatDeRecherche {
  /** La réponse, marqueurs `<<PAGE:n>>` retirés des extraits et du texte. */
  reponse: SearchResponse;
  /**
   * Le serveur a appliqué tri, filtres et effectifs (`facets` présent). Faux
   * sur l'ancienne API, qui les ignore, et sur le parcours classique : masquer
   * alors puces de nature, compteurs, tri et filtres de domaine et de date
   * (ou les appliquer aux seuls résultats affichés, en le disant). Contrat §8.
   */
  affinee: boolean;
}

const ANNEE_MIN = 1900;
const ANNEE_MAX = 2100;

function annee(valeur: unknown): number | undefined {
  return Number.isInteger(valeur) && (valeur as number) >= ANNEE_MIN && (valeur as number) <= ANNEE_MAX
    ? (valeur as number)
    : undefined;
}

function jour(valeur: unknown): string | undefined {
  return typeof valeur === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valeur) ? valeur : undefined;
}

/**
 * `refine` réduit aux clés que l'API accepte (une autre donne 422), sans
 * valeur vide, bornes remises dans l'ordre (des bornes inversées donnent
 * aussi 422 : l'intention du lecteur est claire, on la respecte). `undefined`
 * s'il ne reste rien : un `refine` vide ferait passer pour rien par la
 * recherche affinée.
 */
export function affinageNettoye(refine: AffinageDeRecherche | undefined): AffinageDeRecherche | undefined {
  if (!refine) return undefined;
  const propre: AffinageDeRecherche = {};
  const types = (refine.types ?? []).filter((t) => typeof t === 'string' && t.trim() !== '');
  if (types.length) propre.types = types;
  const categories = (refine.category_ids ?? []).filter((id) => Number.isInteger(id) && id > 0);
  if (categories.length) propre.category_ids = categories;

  let [de, a] = [annee(refine.year_from), annee(refine.year_to)];
  if (de !== undefined && a !== undefined && de > a) [de, a] = [a, de];
  if (de !== undefined) propre.year_from = de;
  if (a !== undefined) propre.year_to = a;

  let [du, au] = [jour(refine.date_from), jour(refine.date_to)];
  if (du !== undefined && au !== undefined && du > au) [du, au] = [au, du];
  if (du !== undefined) propre.date_from = du;
  if (au !== undefined) propre.date_to = au;

  return Object.keys(propre).length ? propre : undefined;
}

/**
 * Le corps de `POST /search/`. Toujours `filters.status = "published"` : sans
 * lui, la recherche inclut les textes non publiés, effectifs compris
 * (contrat §6.1). `sort`, `refine` et `facets` ne partent que s'ils disent
 * quelque chose : sans eux, la recherche classique répond comme avant.
 */
export function corpsDeRecherche(demande: DemandeDeRecherche): SearchRequest {
  const corps: SearchRequest = {
    query: demande.query,
    mode: demande.mode ?? 'hybrid',
    limit: entierBorne(demande.limit, 1, 50, 20),
    offset: entierBorne(demande.offset, 0, Number.MAX_SAFE_INTEGER, 0),
    filters: { ...demande.filters, status: 'published' },
  };
  if (demande.sort) corps.sort = demande.sort;
  const refine = affinageNettoye(demande.refine);
  if (refine) corps.refine = refine;
  if (demande.facets) corps.facets = true;
  return corps;
}

/** Retire les marqueurs de page de l'OCR (`<<PAGE:12>>`), qu'aucun affichage ne doit montrer. */
export function sansMarqueursDePage(texte: string): string {
  return texte.replace(/<<PAGE:\s*\d+>>\s*/g, '');
}

function resultatNettoye(resultat: SearchResult): SearchResult {
  const highlights: Record<string, string> = {};
  for (const [cle, valeur] of Object.entries(resultat.highlights ?? {})) {
    highlights[cle] = typeof valeur === 'string' ? sansMarqueursDePage(valeur) : valeur;
  }
  return {
    ...resultat,
    highlights,
    content: typeof resultat.content === 'string' ? sansMarqueursDePage(resultat.content) : resultat.content,
    matched_articles: (resultat.matched_articles ?? []).map((a) => ({
      ...a,
      content_snippet: typeof a.content_snippet === 'string' ? sansMarqueursDePage(a.content_snippet) : a.content_snippet,
    })),
  };
}

/**
 * Une recherche, ou la cause de l'échec (réseau, délai, 422 d'une demande
 * invalide, réponse illisible). Pour le rendu serveur de /search (P8) comme
 * pour le navigateur.
 */
export async function rechercherTextes(
  demande: DemandeDeRecherche,
  options: OptionsDAppel = {},
): Promise<Lecture<ResultatDeRecherche>> {
  const lecture = await lire(`${API_URL}/search/`, options, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpsDeRecherche(demande)),
  });
  if (!lecture.ok) return lecture;
  const v = lecture.valeur;
  if (!estObjet(v) || !Array.isArray(v.results)) {
    return { ok: false, cause: new Error('POST /search/ : réponse sans liste de résultats') };
  }
  const reponse = v as unknown as SearchResponse;
  return {
    ok: true,
    valeur: {
      reponse: { ...reponse, results: reponse.results.map(resultatNettoye) },
      affinee: reponse.facets != null,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Lecture des champs nouveaux (page d'un texte, listes, recherche, chat)      */
/* -------------------------------------------------------------------------- */

/**
 * Le statut juridique d'un texte, ou `null` : clé absente (ancienne API),
 * calcul en échec côté serveur (`null`), ou forme inattendue. Sur `null`,
 * AUCUN encadré de statut, ou seulement « Version d'origine, non
 * consolidée » sans date de relevé ; jamais « En vigueur » (contrat §8).
 */
export function statutJuridiqueDe(loi: { statut_juridique?: StatutJuridique | null }): StatutJuridique | null {
  const s: unknown = loi.statut_juridique;
  const valide =
    estObjet(s) &&
    typeof s.etat === 'string' &&
    estDateIso(s.releve_le) &&
    Array.isArray(s.modifie_par) &&
    Array.isArray(s.modifie) &&
    estObjet(s.par_morceau);
  return valide ? (s as unknown as StatutJuridique) : null;
}

/** La date à montrer pour un texte (contrat §1.1), et ce qu'elle est. */
export type DateDeLActe =
  /** « Signé le 28 décembre 2021 » : la date de l'acte, pas de sa publication. */
  | { genre: 'signature'; date: string }
  /** « Publié au JO le … » : seule date de l'intitulé (deux Actes uniformes OHADA). */
  | { genre: 'journal_officiel'; date: string }
  /** L'année seule : le jour n'est pas sûr. */
  | { genre: 'annee'; annee: number }
  /** Ancienne API : `publication_date`, affichée comme avant, sans dire « signé » ni « publié ». */
  | { genre: 'date'; date: string };

/** Ce qu'il faut d'un texte pour dater l'acte : page, ligne de liste, résultat, `TexteLie`. */
export interface DatesDuTexte {
  date_signature?: string | null;
  annee?: number | null;
  date_publication_jo?: string | null;
  publication_date?: string | null;
  title?: string | null;
  titre?: string | null;
}

/**
 * La date d'un acte, dans l'ordre du contrat : date de signature, puis date du
 * JO, puis l'année, sinon rien. Jamais `publication_date` telle quelle sur la
 * nouvelle API : elle vaut un « 1er janvier de remplissage » quand l'intitulé
 * ne donne que l'année.
 *
 * Ancienne API (repères absents) : `publication_date` comme avant, sauf un
 * 1er janvier que l'intitulé ne confirme pas (« janv ») : l'année seule.
 * Le chat a `date_du_texte`, même règle que `date_signature`.
 */
export function dateDeLActe(texte: DatesDuTexte): DateDeLActe | null {
  if ('date_signature' in texte || 'annee' in texte) {
    if (estDateIso(texte.date_signature)) return { genre: 'signature', date: texte.date_signature.slice(0, 10) };
    if (estDateIso(texte.date_publication_jo)) {
      return { genre: 'journal_officiel', date: texte.date_publication_jo.slice(0, 10) };
    }
    if (Number.isInteger(texte.annee)) return { genre: 'annee', annee: texte.annee as number };
    return null;
  }
  const date = texte.publication_date;
  if (!estDateIso(date)) return null;
  const intitule = texte.title ?? texte.titre ?? '';
  if (date.slice(5, 10) === '01-01' && !/janv/i.test(intitule)) {
    return { genre: 'annee', annee: Number(date.slice(0, 4)) };
  }
  return { genre: 'date', date: date.slice(0, 10) };
}

/**
 * Jour d'ajout à JuriX (« Ajouté à JuriX le … »), qui remplace « Mis à jour
 * le » : `updated_at` est la dernière écriture en base, jamais une
 * modification de la loi. Ancienne API : le jour de `created_at`, même valeur.
 */
export function ajouteLe(loi: { ajoute_le?: string | null; created_at?: string | null }): string | null {
  if (estDateIso(loi.ajoute_le)) return loi.ajoute_le.slice(0, 10);
  if (estDateIso(loi.created_at)) return loi.created_at.slice(0, 10);
  return null;
}

/** Ordre des libellés du statut en bref (contrat §1.3). */
const ORDRE_DES_NATURES: readonly NatureEnBref[] = [
  'abroge',
  'remplace',
  'abroge_partiellement',
  'remplace_partiellement',
  'modifie',
  'complete',
];

/**
 * Les natures d'un statut en bref, dans l'ordre du contrat, sans les clés
 * inconnues (un ajout futur de l'API ne doit jamais s'afficher brut) ni les
 * effectifs nuls. Vide pour un statut absent ou nul.
 */
export function naturesDuStatut(statut: StatutEnBref | null | undefined): { nature: NatureEnBref; textes: number }[] {
  if (!estObjet(statut) || !estObjet(statut.natures)) return [];
  const natures = statut.natures as Partial<Record<NatureEnBref, unknown>>;
  return ORDRE_DES_NATURES.flatMap((nature) => {
    const n = natures[nature];
    return Number.isInteger(n) && (n as number) > 0 ? [{ nature, textes: n as number }] : [];
  });
}

/**
 * La ligne de statut d'une liste ou d'un résultat : « Abrogé en partie par
 * 11 textes et complété par 1 » (maquette recherche-p7a). Le nom (« textes »)
 * ne suit que le premier nombre. Vide sans statut : rien à écrire, ce qui
 * n'est jamais « en vigueur ».
 *
 * @param traduire `$tr` : clés `statut.bref.*` (abroge, remplace,
 *   abroge_partiellement, remplace_partiellement, modifie, complete, avec
 *   `{n}` ; texte, textes, et)
 */
export function phraseDuStatutEnBref(
  statut: StatutEnBref | null | undefined,
  traduire: (cle: string) => string,
): string {
  const morceaux = naturesDuStatut(statut).map(({ nature, textes }, i) => {
    const nombre = i === 0 ? `${textes} ${traduire(textes > 1 ? 'statut.bref.textes' : 'statut.bref.texte')}` : String(textes);
    return traduire(`statut.bref.${nature}`).replace('{n}', nombre);
  });
  if (!morceaux.length) return '';
  const et = ` ${traduire('statut.bref.et')} `;
  // Sans `Array.prototype.at`, absent de Safari avant 15.4.
  const dernier = morceaux[morceaux.length - 1];
  const phrase = morceaux.length === 1 ? dernier : `${morceaux.slice(0, -1).join(', ')}${et}${dernier}`;
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

/**
 * Les changements qui touchent un morceau d'article (`articles[].id` de
 * `GET /laws/{id}`) : marques « · modifié » du sommaire et encadré sous
 * l'article. Par `par_morceau`, exact, et non `par_article`, qui confond les
 * numéros en double des compilations.
 */
export function changementsDuMorceau(statut: StatutJuridique, articleId: number): Changement[] {
  const ids = statut.par_morceau[String(articleId)] ?? [];
  const tous = [...statut.modifie_par, ...statut.modifie];
  return ids.flatMap((id) => tous.filter((c) => c.id === id));
}

/** Clé d'un texte lié : sa cote, ou son titre pour un texte hors corpus. */
function cleDuTexte(texte: TexteLie): string {
  return texte.reference ?? texte.titre;
}

/**
 * Les textes modificatifs à nommer sous « Modifié depuis sa publication »
 * (contrat §3.5) : les changements reçus ni dépassés ni déjà intégrés au
 * texte affiché, regroupés par texte, dans l'ordre du relevé.
 */
export function modificationsActuelles(statut: StatutJuridique): { texte: TexteLie; changements: Changement[] }[] {
  const groupes = new Map<string, { texte: TexteLie; changements: Changement[] }>();
  for (const c of statut.modifie_par) {
    if (c.depasse || c.integre_au_texte) continue;
    const cle = cleDuTexte(c.texte);
    const groupe = groupes.get(cle) ?? { texte: c.texte, changements: [] };
    groupe.changements.push(c);
    groupes.set(cle, groupe);
  }
  return [...groupes.values()];
}

/** N de l'onglet « Historique (N) » : textes distincts, dans les deux sens, dépassés et intégrés compris. */
export function nombreDeTextesDeLHistorique(statut: StatutJuridique): number {
  return new Set([...statut.modifie_par, ...statut.modifie].map((c) => cleDuTexte(c.texte))).size;
}
