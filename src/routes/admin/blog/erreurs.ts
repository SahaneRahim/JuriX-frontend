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
 */
export type EtatRefuse = 'relecture_incomplete' | 'controle_a_relancer' | 'phrases_contredites' | 'citations_non_verifiees';
export const ETATS_REFUSES: readonly EtatRefuse[] = [
  'relecture_incomplete',
  'controle_a_relancer',
  'phrases_contredites',
  'citations_non_verifiees',
];

/** L'appel en cause : la génération d'un article, ou le contrôle IA d'un article enregistré. */
export type Action = 'generation' | 'controle';

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

/** Délai du client pour une génération : au-delà du délai du serveur (150 s, code `delai`). */
export const DELAI_DE_GENERATION_MS = 160_000;

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
 */
export function messageDErreur(erreur: ErreurDuBlog, t: (cle: string) => string, action: Action = 'generation'): string {
  if ((ETATS_REFUSES as readonly string[]).includes(erreur.code)) {
    const raison = erreur.detail || t(`admin.blog.etat.${erreur.code}`);
    return t('admin.blog.err.notPublishable').replace('{detail}', () => raison);
  }
  if (action === 'controle') {
    switch (erreur.code) {
      case 'sans_source':
        return t('admin.blog.err.checkNoSource');
      case 'reponse_invalide':
        return t('admin.blog.err.checkBadOutput');
      case 'delai':
        return t('admin.blog.err.checkTimeout');
      case 'delai_client':
        return t('admin.blog.err.checkClientTimeout');
      case 'non_active':
        return t('admin.blog.err.checkUnavailable');
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
