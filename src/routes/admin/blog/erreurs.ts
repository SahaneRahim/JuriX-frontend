/**
 * Les erreurs de l'API du blog, lues puis dites dans la langue de
 * l'administration.
 *
 * POURQUOI CE MODULE. La page affichait `new Error(data.detail || …)` :
 * - un 422 de FastAPI porte un `detail` TABLEAU, et l'administrateur lisait
 *   « [object Object] » (sujet trop court, champ manquant ; revue du 29/10) ;
 * - une panne du modèle sortait en 500 sans en-têtes CORS : le navigateur
 *   bloquait la réponse et l'alerte disait « Failed to fetch », en anglais ;
 * - un enregistrement en échec n'affichait pas le `detail` de l'API.
 * Le contrat du 29/10 donne à chaque erreur un code (`entree_invalide`,
 * `sans_source`, `quota`, `saturation`, `recherche_indisponible`,
 * `reponse_invalide`, `delai`, `slug_pris`) et un `detail` en français : un
 * seul endroit les lit, pour le générateur, la fenêtre de relecture et la
 * liste.
 *
 * Le code est cherché au premier niveau du corps (`{"detail": "…", "code":
 * "…"}`) ou dans un `detail` objet (`{"detail": {"detail"|"message": "…",
 * "code": "…"}}`, la forme d'une HTTPException dont le détail est un
 * dictionnaire). Sans code, le statut HTTP en donne un : une API d'avant le
 * contrat reste lisible.
 */

export type CodeDErreur =
  | 'entree_invalide'
  | 'sans_source'
  | 'quota'
  | 'saturation'
  | 'recherche_indisponible'
  | 'reponse_invalide'
  | 'delai'
  | 'slug_pris'
  | 'introuvable'
  | EtatRefuse
  | 'relecture_perimee'
  | 'article_en_ligne'
  | 'non_active'
  | 'interdit'
  | 'reseau'
  | 'delai_client'
  | 'arrete'
  | 'serveur'
  | 'inattendue';

/**
 * Les refus de publication du contrat du 30/10 : une 422 dont le code est
 * l'état de publication de l'article (« publiable » seul permet de publier).
 * « sources_absentes » : avenant du tour 4 ; « phrases_a_confirmer » : avenant
 * du tour 7 (une phrase de règle ni réécrite ni confirmée).
 */
export type EtatRefuse =
  | 'relecture_incomplete'
  | 'phrases_a_confirmer'
  | 'controle_a_relancer'
  | 'phrases_contredites'
  | 'citations_non_verifiees'
  | 'sources_absentes';
export const ETATS_REFUSES: readonly EtatRefuse[] = [
  'relecture_incomplete',
  'phrases_a_confirmer',
  'controle_a_relancer',
  'phrases_contredites',
  'citations_non_verifiees',
  'sources_absentes',
];

/**
 * L'appel en cause : la génération d'un article, le contrôle IA d'un article
 * enregistré, ou la reconstruction de ses sources (`POST /blog/{id}/sources`).
 */
export type Action = 'generation' | 'controle' | 'sources';

export interface ErreurDeChamp {
  /** Le chemin du champ dans le corps (« topic », « bot_analysis.citations.0 »). */
  champ: string;
  /** Le type d'erreur de Pydantic (« string_too_short », « missing »…). */
  type: string;
  message: string;
}

export interface ErreurDuBlog {
  code: CodeDErreur;
  statut: number | null;
  /** Le `detail` texte de l'API, en français selon le contrat ; '' sans lui. */
  detail: string;
  /** Les erreurs de champ d'un 422 de validation (FastAPI). */
  champs: ErreurDeChamp[];
  /** Secondes avant de réessayer (Retry-After, ou le corps), ou `null`. */
  reessayerDans: number | null;
}

/**
 * Délai du client pour une génération et son contrôle automatique : au-delà
 * du délai du serveur (190 s pour les deux, code `delai`). Mesuré avec
 * mistral-large-4 pour le contrôle (essai réel du 04/11) : 121,7 et 124,4 s
 * côté client ; le panneau dit « plus long que d'habitude » passé
 * `ATTENTE_LONGUE_DE_GENERATION_S`.
 */
export const DELAI_DE_GENERATION_MS = 200_000;
export const ATTENTE_LONGUE_DE_GENERATION_S = 130;

/**
 * Passé ce délai, le panneau de génération parle du contrôle et non plus de la
 * rédaction. POURQUOI : `/blog/generate` est UNE requête, qui ne dit pas où elle
 * en est ; mais la rédaction dure 10 à 20 s mesurées, et le contrôle jusqu'à
 * 105 s : « Rédaction du brouillon… » restait affiché pendant tout le contrôle.
 * Le message suit donc l'horloge, et dit « en principe ».
 */
export const FIN_PROBABLE_DE_LA_REDACTION_S = 20;

/**
 * Délai du client pour un contrôle IA seul (`POST /blog/{id}/controle`) : au-delà
 * du délai du serveur (`DELAI_CONTROLE_S`, 165 s, code `delai`), avec la même
 * marge de 10 s que la génération et les sources. POURQUOI pas 200 s comme la
 * génération (jusqu'au tour 6) : un contrôle seul n'a pas de rédaction avant
 * lui ; mesuré avec mistral-large-4, 40 à 105 s pour un article en un appel.
 * Passé `ATTENTE_LONGUE_DU_CONTROLE_S`, la fenêtre dit « plus long que
 * d'habitude ».
 */
export const DELAI_DU_CONTROLE_MS = 175_000;
export const ATTENTE_LONGUE_DU_CONTROLE_S = 110;

/**
 * Délai du client pour reconstruire les sources : la recherche de la
 * génération, sans le modèle (2,6 à 3,8 s mesurées le 30/10 sur jurix_dev).
 * Au-delà du délai du serveur (`DELAI_SOURCES_S`, 60 s, code `delai`, « rien
 * n'est changé »), comme pour la génération (190 s, puis 200 côté client) :
 * à 60 s des deux côtés, le client abandonnait parfois au moment où le
 * serveur répondait, et sa phrase remplaçait celle, plus exacte, du serveur.
 */
export const DELAI_DES_SOURCES_MS = 70_000;

/**
 * Avenant du tour 5 :
 * - `relecture_perimee` (422) : des cases cochées contre un autre contrôle
 *   que celui que le serveur a enregistré (relancé ailleurs entre-temps) ;
 *   rien n'est appliqué ;
 * - `article_en_ligne` (409) : relancer le contrôle d'un article publié
 *   demande `{"confirmer": true}` ; le modèle n'est pas appelé.
 */
const CODES_DU_CONTRAT: ReadonlySet<string> = new Set([
  'entree_invalide',
  'sans_source',
  'quota',
  'saturation',
  'recherche_indisponible',
  'reponse_invalide',
  'delai',
  'slug_pris',
  'introuvable',
  ...ETATS_REFUSES,
  'relecture_perimee',
  'article_en_ligne',
]);

type Objet = Record<string, unknown>;
const estObjet = (v: unknown): v is Objet => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Le code d'erreur que donne un statut HTTP, faute de code dans le corps. */
function codeDuStatut(statut: number): CodeDErreur {
  if (statut === 400 || statut === 422) return 'entree_invalide';
  if (statut === 401 || statut === 403) return 'interdit';
  if (statut === 404) return 'introuvable';
  if (statut === 409) return 'slug_pris';
  if (statut === 429) return 'quota';
  if (statut === 502) return 'reponse_invalide';
  if (statut === 503) return 'saturation';
  if (statut === 504) return 'delai';
  if (statut >= 500) return 'serveur';
  return 'inattendue';
}

/**
 * Secondes d'attente : `Retry-After` en secondes ou en date HTTP, sinon un
 * nombre du corps (`retry_after`, `reessayer_dans`). L'en-tête n'est lisible
 * d'une autre origine que si l'API l'expose (CORS `expose_headers`) : le corps
 * sert de repli.
 */
function delaiDeReprise(reponse: Response, corps: unknown): number | null {
  const entete = reponse.headers.get('Retry-After');
  if (entete) {
    const secondes = Number(entete.trim());
    if (Number.isFinite(secondes) && secondes >= 0) return Math.ceil(secondes);
    const date = Date.parse(entete);
    if (Number.isFinite(date)) return Math.max(0, Math.ceil((date - Date.now()) / 1000));
  }
  if (estObjet(corps)) {
    for (const cle of ['retry_after', 'reessayer_dans']) {
      const valeur = Number(corps[cle]);
      if (corps[cle] !== undefined && Number.isFinite(valeur) && valeur >= 0) return Math.ceil(valeur);
    }
  }
  return null;
}

/** Les erreurs de champ d'un `detail` tableau (validation de FastAPI). */
function erreursDeChamp(detail: unknown): ErreurDeChamp[] {
  if (!Array.isArray(detail)) return [];
  return detail.filter(estObjet).map((d) => ({
    champ: Array.isArray(d.loc)
      ? d.loc.filter((morceau) => morceau !== 'body' && morceau !== 'query' && morceau !== 'path').join('.')
      : '',
    type: typeof d.type === 'string' ? d.type : '',
    message: typeof d.msg === 'string' ? d.msg : '',
  }));
}

/**
 * Lit une réponse en échec de l'API du blog. Ne lève jamais : un corps
 * illisible (proxy, page HTML) laisse le statut parler.
 */
export async function erreurDeReponse(reponse: Response): Promise<ErreurDuBlog> {
  let corps: unknown = null;
  try {
    corps = await reponse.json();
  } catch {
    corps = null;
  }

  const detailBrut = estObjet(corps) ? corps.detail : undefined;
  const codeBrut = estObjet(corps)
    ? typeof corps.code === 'string'
      ? corps.code
      : estObjet(detailBrut) && typeof detailBrut.code === 'string'
        ? detailBrut.code
        : ''
    : '';
  const detail =
    typeof detailBrut === 'string'
      ? detailBrut
      : estObjet(detailBrut)
        ? [detailBrut.detail, detailBrut.message].find((x): x is string => typeof x === 'string') ?? ''
        : '';

  let code: CodeDErreur = CODES_DU_CONTRAT.has(codeBrut) ? (codeBrut as CodeDErreur) : codeDuStatut(reponse.status);
  // « Not Found » de Starlette : c'est la ROUTE qui manque, pas un article.
  // Sur l'API de production du 29/10, toutes les routes du blog répondent
  // ainsi : le blog n'y est pas encore déployé.
  if (reponse.status === 404 && detail === 'Not Found' && !codeBrut) code = 'non_active';

  return {
    code,
    statut: reponse.status,
    detail: detail.trim(),
    champs: erreursDeChamp(detailBrut),
    reessayerDans: delaiDeReprise(reponse, corps),
  };
}

/**
 * Une erreur levée pendant l'appel (pas de réponse) :
 * - arrêt demandé par l'administrateur (`raison` « admin ») ou délai du
 *   client dépassé (« delai ») : `AbortError` ;
 * - réseau coupé, API arrêtée, réponse bloquée par CORS : `TypeError`
 *   (« Failed to fetch » sous Chrome, « Load failed » sous Safari).
 */
export function erreurDExecution(e: unknown, raison: 'admin' | 'delai' | null = null): ErreurDuBlog {
  const nom = (e as { name?: unknown } | null)?.name;
  let code: CodeDErreur = 'inattendue';
  if (nom === 'AbortError' || nom === 'TimeoutError') code = raison === 'admin' ? 'arrete' : 'delai_client';
  else if (e instanceof TypeError) code = 'reseau';
  return { code, statut: null, detail: '', champs: [], reessayerDans: null };
}

/** « 45 s », « 2 min » : l'attente annoncée. */
export function dureeLisible(secondes: number, t: (cle: string) => string): string {
  if (secondes < 90) return t('admin.blog.delay.seconds').replace('{n}', String(Math.max(1, secondes)));
  return t('admin.blog.delay.minutes').replace('{n}', String(Math.ceil(secondes / 60)));
}

/** Le nom d'un champ du corps, tel que l'interface le nomme ; le chemin brut à défaut. */
function nomDuChamp(champ: string, t: (cle: string) => string): string {
  // Du plus précis au plus général : « bot_analysis.summary » se nomme par
  // « summary » ; les indices de liste (« citations.0 ») ne nomment rien.
  const morceaux = champ.split('.').filter((m) => !/^\d+$/.test(m));
  for (let i = morceaux.length - 1; i >= 0; i--) {
    const cle = `admin.blog.field.${morceaux[i]}`;
    const nom = t(cle);
    if (nom !== cle) return nom;
  }
  return champ || '?';
}

/** Une erreur de champ en une phrase traduite (« Sujet : trop court »). */
function phraseDeChamp(erreur: ErreurDeChamp, t: (cle: string) => string): string {
  const champ = nomDuChamp(erreur.champ, t);
  const cle = erreur.type.startsWith('string_too_short')
    ? 'admin.blog.err.tooShort'
    : erreur.type.startsWith('string_too_long')
      ? 'admin.blog.err.tooLong'
      : erreur.type === 'missing'
        ? 'admin.blog.err.missing'
        : '';
  if (cle) return t(cle).replace('{champ}', () => champ);
  return `${champ} : ${erreur.message || erreur.type}`;
}

/** Remplace `{delai}` par l'attente annoncée, ou prend la variante sans délai. */
function avecDelai(erreur: ErreurDuBlog, cle: string, t: (cle: string) => string): string {
  if (erreur.reessayerDans === null) return t(cle);
  return t(`${cle}In`).replace('{delai}', dureeLisible(erreur.reessayerDans, t));
}

/**
 * Le message à afficher. Les codes connus ont leur phrase traduite ; un 422
 * de saisie dit QUEL champ pose problème (le `detail` texte de l'API, en
 * français, ou les erreurs de champ de FastAPI) ; jamais « [object Object] ».
 *
 * Un texte venu de l'API s'insère par une FONCTION de remplacement : passé
 * en chaîne, `replace` y interpréterait « $& » ou « $' » (un montant en
 * dollars dans un titre ou un détail suffirait à le déformer).
 *
 * `action` : le contrôle IA d'un article enregistré (`POST /blog/{id}/controle`)
 * a ses propres phrases pour un échec du modèle ou un délai. Celles de la
 * génération disent « aucun brouillon n'a été créé », faux pour un contrôle :
 * le brouillon est là, rien n'est perdu, seul le contrôle est à relancer.
 *
 * Un refus de publication (422 dont le code est l'état de l'article) montre
 * la raison donnée par le serveur, en français ; sans elle, celle de l'état.
 * Le serveur ouvre sa raison par « Publication refusée : » : retiré, pour ne
 * pas lire « Publication refusée par le serveur : Publication refusée : … »
 * (revue du tour 3).
 *
 * `action` « sources » : reconstruire les sources d'un article (avenant du
 * tour 4). Rien n'est perdu en cas d'échec ; « aucun texte ne couvre ce
 * sujet » dit quoi changer (le titre et le contexte guident la recherche).
 *
 * Le contrôle d'un article SANS SOURCES répond 422 `sources_absentes` (API du
 * tour 4, `SourcesAbsentesError`) : le même code que le refus de publier un
 * tel article. Pour un contrôle, ce n'est pas une publication refusée : le
 * contrôle n'a pas été lancé, et il faut reconstruire les sources d'abord.
 *
 * Avenant du tour 5 : une relecture périmée (422 `relecture_perimee`) dit que
 * rien n'est enregistré et pourquoi ; la fenêtre y ajoute les parties à
 * relire, une fois l'article relu. Un contrôle refusé faute de place (422
 * `entree_invalide` : « raccourcissez-le ») dit que le contrôle n'a pas été
 * lancé, avec la raison du serveur, et non « Saisie refusée ».
 */
export function messageDErreur(erreur: ErreurDuBlog, t: (cle: string) => string, action: Action = 'generation'): string {
  if (action === 'controle' && erreur.code === 'sources_absentes') return t('admin.blog.err.checkNoSources');
  if (erreur.code === 'relecture_perimee') return t('admin.blog.err.reviewStale');
  if ((ETATS_REFUSES as readonly string[]).includes(erreur.code)) {
    // « Publication refusée : <raison> », ou « Publication refusée. » seul
    // (motif_du_refus, sans raison) : alors la raison de l'état.
    const raison =
      erreur.detail.replace(/^Publication refusée\s*(?::\s*|\.\s*$)/i, '').trim() || t(`admin.blog.etat.${erreur.code}`);
    return t('admin.blog.err.notPublishable').replace('{detail}', () => raison);
  }
  if (action === 'controle') {
    switch (erreur.code) {
      case 'sans_source':
        // Ce que le serveur dit de faire (« Citez au moins un article de la
        // base… »), à la suite de la phrase du front : au tour 3, seule
        // celle-ci s'affichait, sans dire comment en sortir.
        return erreur.detail
          ? `${t('admin.blog.err.checkNoSource')} ${t('admin.blog.err.serverSays').replace('{detail}', () => erreur.detail)}`
          : t('admin.blog.err.checkNoSource');
      case 'reponse_invalide':
        return t('admin.blog.err.checkBadOutput');
      case 'delai':
        return t('admin.blog.err.checkTimeout');
      case 'delai_client':
        return t('admin.blog.err.checkClientTimeout');
      case 'non_active':
        return t('admin.blog.err.checkUnavailable');
      case 'article_en_ligne':
        return t('admin.blog.err.checkOnline');
      case 'entree_invalide':
        if (erreur.champs.length === 0 && erreur.detail) {
          return t('admin.blog.err.checkRefused').replace('{detail}', () => erreur.detail);
        }
    }
  }
  if (action === 'sources') {
    switch (erreur.code) {
      case 'sans_source':
        return t('admin.blog.err.sourcesNone');
      case 'delai':
        return t('admin.blog.err.sourcesTimeout');
      case 'delai_client':
        return t('admin.blog.err.sourcesClientTimeout');
      case 'non_active':
        return t('admin.blog.err.sourcesUnavailable');
      case 'reponse_invalide':
        return t('admin.blog.err.sourcesBadOutput');
      case 'entree_invalide':
      case 'slug_pris':
        // Le serveur peut refuser de reconstruire (un article qui a déjà ses
        // sources, par exemple, en 422 ou en 409) : sa raison, en clair. Un
        // 409 sans code n'est pas ici une adresse prise.
        return erreur.detail
          ? t('admin.blog.err.sourcesRefused').replace('{detail}', () => erreur.detail)
          : t('admin.blog.err.server').replace('{status}', String(erreur.statut ?? '?'));
    }
  }
  switch (erreur.code) {
    case 'entree_invalide':
      if (erreur.champs.length > 0) {
        return t('admin.blog.err.invalid').replace('{detail}', () => erreur.champs.map((c) => phraseDeChamp(c, t)).join(' ; '));
      }
      return erreur.detail ? t('admin.blog.err.invalid').replace('{detail}', () => erreur.detail) : t('admin.blog.err.invalidGeneric');
    case 'sans_source':
      return t('admin.blog.err.noSource');
    case 'quota':
      return avecDelai(erreur, 'admin.blog.err.quota', t);
    case 'saturation':
      return avecDelai(erreur, 'admin.blog.err.busy', t);
    case 'recherche_indisponible':
      return avecDelai(erreur, 'admin.blog.err.searchDown', t);
    case 'reponse_invalide':
      return t('admin.blog.err.badOutput');
    case 'delai':
      return t('admin.blog.err.timeout');
    case 'delai_client':
      return t('admin.blog.err.clientTimeout');
    case 'arrete':
      return t('admin.blog.stopped');
    case 'slug_pris':
      return t('admin.blog.err.slugTaken');
    case 'introuvable':
      return t('admin.blog.err.notFound');
    case 'non_active':
      return t('admin.blog.notActive');
    case 'interdit':
      return t('admin.blog.err.forbidden');
    case 'reseau':
      return t('admin.blog.err.network');
    case 'serveur':
      return t('admin.blog.err.server').replace('{status}', String(erreur.statut ?? '?'));
    default:
      return erreur.statut
        ? t('admin.blog.err.server').replace('{status}', String(erreur.statut))
        : t('admin.blog.err.unexpected');
  }
}
