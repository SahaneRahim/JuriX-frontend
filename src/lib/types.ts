/**
 * Types métier partagés — décalque des schémas Pydantic du backend.
 *
 * POURQUOI CE MODULE EXISTE. Le front portait 34 annotations `any` explicites et
 * aucun type métier. Chaque frontière de module perdait donc son type : une
 * faute de frappe sur un nom de champ, un champ renommé côté backend ou une
 * comparaison impossible ne se voyaient qu'à l'exécution, sur la page concernée.
 * `strict: true` était hors d'atteinte tant que ces types n'existaient pas —
 * c'est ce fichier qui le débloque.
 *
 * SOURCE DE VÉRITÉ : `JuriX-backend-main/app/schemas/{law,search,user}.py`. Les
 * noms de champs sont en snake_case parce que c'est ainsi qu'ils passent sur le
 * fil — les convertir ici créerait un écart silencieux avec le JSON reçu.
 *
 * PIÈGE DES DATES. Le backend déclare `datetime` et `date`, mais JSON n'a pas de
 * type date : tout arrive en chaîne ISO. Le type est donc `string`, jamais
 * `Date`. C'est exactement le genre d'erreur que ce module doit fermer :
 * `formatDate` a déjà rencontré des `Invalid Date` nés de cette confusion.
 *
 * Ce fichier n'importe rien de `svelte` ni de `$app` : il doit rester utilisable
 * depuis un `load` universel, un composant, un test et un script.
 */

/* -------------------------------------------------------------------------- */
/* Énumérations validées côté serveur                                          */
/* -------------------------------------------------------------------------- */

/**
 * Statuts du cycle de vie d'un document.
 *
 * `pending | processing | refused` appartiennent à l'ingestion et n'existent pas
 * dans les trois statuts « éditoriaux » : les omettre a déjà provoqué une erreur
 * 500 côté backend, où `LawResponse` rejetait sa propre réponse dès qu'un
 * document était en cours de traitement. Ne pas les retirer d'ici non plus.
 */
export type LawStatus =
  | 'draft'
  | 'published'
  | 'archived'
  | 'pending'
  | 'processing'
  | 'refused';

/** `validate_type` de `LawBase` ; le backend normalise en minuscules. */
export type LawType =
  | 'loi'
  | 'décret'
  | 'ordonnance'
  | 'arrêté'
  | 'circulaire'
  | 'instruction'
  | 'décision'
  | 'acte uniforme'
  | 'autre';

/**
 * Langue d'un DOCUMENT — à ne pas confondre avec la langue de l'interface, que
 * porte `$lib/stores/language`. Les deux valent 'fr' | 'en' et se sont déjà
 * mélangées une fois (`laws/+page.svelte` a dû aliaser le store en
 * `langueInterface` pour lever l'ambiguïté).
 */
export type LangueDocument = 'fr' | 'en';

/** `pattern="^(user|admin|superadmin)$"` dans `UserBase`. */
export type RoleUtilisateur = 'user' | 'admin' | 'superadmin';

/**
 * Filtre de langue de l'interface : les deux langues, plus « toutes ».
 *
 * `'all'` n'est pas une valeur du backend — c'est l'absence du paramètre
 * `language` dans la requête. Le type l'a rendu explicite après un défaut réel :
 * `categories/[id]` typait son filtre `Language` alors qu'un troisième bouton y
 * assignait `"all"`.
 */
export type FiltreLangue = LangueDocument | 'all';

/* -------------------------------------------------------------------------- */
/* Catégories — CategoryResponse                                               */
/* -------------------------------------------------------------------------- */

export interface Category {
  id: number;
  name: string;
  description: string | null;
  /** Emoji, 10 caractères au plus côté serveur. Souvent nul : prévoir un repli. */
  icon: string | null;
  /** Chaîne ISO. */
  created_at: string;
  /** Calculé par le serveur, toujours présent (0 par défaut). */
  law_count: number;
}

/* -------------------------------------------------------------------------- */
/* Documents — LawResponse                                                     */
/* -------------------------------------------------------------------------- */

export interface Law {
  id: number;
  reference: string;
  title: string;
  type: LawType;
  /**
   * Texte intégral, en markdown issu de l'OCR. Contient les marqueurs de page
   * `<<PAGE:n>>` insérés à l'ingestion : tout affichage doit les retirer
   * (`$lib/seo.descriptionDepuis` le fait).
   */
  content: string;
  language: LangueDocument | null;
  category_id: number | null;
  status: LawStatus;
  /** Chaîne ISO de date seule (`2026-05-04`), ou nulle. */
  publication_date: string | null;

  // Détection automatique (v2.1)
  detected_language: LangueDocument | null;
  language_confidence: number | null;
  suggested_categories: number[] | null;
  category_confidence: number | null;

  // Fichier d'origine
  file_id: string | null;
  original_filename: string | null;

  /** Toujours présent (0 par défaut). Zéro article = extraction en échec. */
  article_count: number;
  created_at: string;
  updated_at: string | null;

  /**
   * Catégorie imbriquée, chargée par `GET /laws/{id}` seulement lorsque la
   * relation existe. `category_id` peut être renseigné sans que `category` le
   * soit selon l'endpoint : ne pas dériver l'un de l'autre.
   */
  category: Category | null;
}

/**
 * `ArticleResponse`.
 *
 * ATTENTION : `GET /laws/{id}` rend un `LawResponse`, qui ne porte PAS de champ
 * `articles` — seul `LawDetailResponse` en a un, et aucun endpoint du front ne
 * l'appelle. La fiche de loi reconstruit sa table des matières en analysant
 * `law.content`. Ce type sert aux réponses de recherche et à un futur endpoint,
 * pas à la page de détail.
 */
export interface Article {
  id: number;
  law_id: number;
  number: string;
  title: string | null;
  content: string;
  order: number;
  created_at: string;
  has_embedding: boolean;
}

/* -------------------------------------------------------------------------- */
/* Recherche — app/schemas/search.py                                           */
/* -------------------------------------------------------------------------- */

export interface SearchFilters {
  language?: LangueDocument;
  category_ids?: number[];
  types?: string[];
  status?: LawStatus;
  year_from?: number;
  year_to?: number;
}

export interface SearchRequest {
  query: string;
  mode: string;
  filters?: SearchFilters;
  limit: number;
  offset: number;
}

/** Article correspondant, imbriqué dans un `SearchResult`. */
export interface ArticleMatch {
  article_id: number;
  number: string;
  title: string | null;
  /** Extrait déjà surligné par `ts_headline` : contient des balises `<mark>`. */
  content_snippet: string;
  relevance_score: number;
}

export interface SearchResult {
  /**
   * Identifiant du DOCUMENT. Il n'existe pas de champ `id` sur ce type — le
   * front écrit encore `result.law_id ?? result.id` par prudence, ce qui est du
   * code mort : `law_id` est requis côté serveur.
   */
  law_id: number;
  reference: string;
  title: string;
  type: LawType;
  language: LangueDocument | null;
  status: LawStatus;
  category_id: number | null;
  category_name: string | null;
  publication_date: string | null;
  relevance_score: number;
  /**
   * Calculé par le serveur sur le POIDS des lexèmes (poids A = titre), pas
   * deviné sur la chaîne : c'est ce qui permet à « société » de reconnaître
   * « sociétés » dans un titre, là où un `includes()` échouerait.
   */
  match_scope: 'title' | 'body';
  matched_articles: ArticleMatch[];
  /**
   * Extraits surlignés par champ, balises `<mark>` comprises. À rendre par
   * `$lib/highlight.highlightSegments`, jamais par `{@html}` : le contenu vient
   * de documents ingérés, et le jeton d'authentification est en clair dans
   * `localStorage`.
   */
  highlights: Record<string, string>;
  content: string | null;
}

export interface SearchResponse {
  query: string;
  mode: string;
  results: SearchResult[];
  total: number;
}

/* -------------------------------------------------------------------------- */
/* Comptes — app/schemas/user.py                                               */
/* -------------------------------------------------------------------------- */

export interface User {
  id: number;
  email: string;
  username: string;
  full_name: string | null;
  role: RoleUtilisateur;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  last_login_at: string | null;
  /** Présent sur `UserAdminResponse` seulement. */
  updated_at?: string;
}

/* -------------------------------------------------------------------------- */
/* Tableau de bord d'administration — app/api/routes/analytics.py              */
/* -------------------------------------------------------------------------- */

export interface AnalyticsOverview {
  total_laws: number;
  /** Décompte par code langue ; les clés dépendent des données présentes. */
  by_language: Record<string, number>;
  /** Décompte par statut du cycle de vie. */
  by_status?: Record<string, number>;
  recent_laws: number;
  timestamp?: string;
}

export interface AnalyticsUsage {
  window_days: number;
  conversations: number;
  questions_asked: number;
  answers_generated: number;
  searches: number;
  active_users: number;
  /** Heures les plus actives, mesurées sur `messages` et `search_events`. */
  peak_hours?: { hour: number; count: number }[];
  median_answer_time_ms: number;
  personas_usage?: Record<string, number>;
  timestamp?: string;
}

/**
 * `GET /analytics/search` ne prend aucun paramètre et renvoie aujourd'hui des
 * valeurs codées en dur, marquées `"note": "Mock data"` côté backend. Le sélecteur
 * 7/30 jours de l'interface a été retiré pour cette raison : il aurait laissé
 * croire à un filtre qui n'existe pas.
 */
export interface AnalyticsSearch {
  window_days: number;
  total_searches: number;
  /**
   * Médiane, et non moyenne : une seule requête froide à trois secondes
   * déplace la moyenne et ne dit rien de l'expérience courante.
   */
  median_response_time_ms: number;
  p95_response_time_ms: number;
  max_response_time_ms: number;
  cache_hit_rate_percent: number;
  /** Répartition entre les modes `text`, `semantic` et `hybrid`. */
  modes_usage?: Record<string, number>;
  popular_queries?: { query: string; count: number }[];
  /** Ce que les gens cherchent et que le corpus ne contient pas. */
  queries_without_results?: { query: string; count: number }[];
  timestamp?: string;
}

/* -------------------------------------------------------------------------- */
/* Charges utiles envoyées au backend                                          */
/* -------------------------------------------------------------------------- */

/**
 * `PUT /laws/admin/{id}` — `LawUpdate` côté serveur : tous les champs sont
 * facultatifs, seuls ceux présents sont écrits.
 *
 * `category_id` est un NOMBRE ici alors que le `<select>` porte une chaîne : la
 * conversion est faite par l'appelant, et c'est précisément ce que le type
 * force à ne pas oublier.
 */
export interface LawUpdatePayload {
  title?: string;
  content?: string;
  reference?: string;
  language?: LangueDocument | string;
  category_id?: number;
  type?: LawType;
  status?: LawStatus;
  publication_date?: string | null;
}

/** `POST /laws/admin/ingest` — déclenche la chaîne d'ingestion d'un fichier. */
export interface IngestPayload {
  file_id: string;
  original_filename: string;
  title: string;
  reference: string;
  /**
   * Nombre : `UploadModal` lie son `<select>` à un identifiant numérique, là où
   * `EditModal` lie le sien à une chaîne et convertit avant l'envoi. L'écart est
   * réel entre les deux écrans — le noter évite une « correction » qui casserait
   * celui qu'on ne regarde pas.
   */
  category_id?: number;
}

/* -------------------------------------------------------------------------- */
/* WebSocket de l'import en lot — app/api/routes/batch_upload.py               */
/* -------------------------------------------------------------------------- */

/**
 * Messages du suivi d'import en lot, en union discriminée sur `type`.
 *
 * Le backend en émet SEPT ; l'interface n'en traite que cinq. `progress`
 * (batch_upload.py:67) et `error` (batch_upload.py:196) tombent dans un `switch`
 * sans branche : une erreur signalée par le serveur pendant l'import n'apparaît
 * nulle part à l'écran. L'union les déclare pour que le trou soit visible dans
 * le type plutôt qu'invisible dans le code.
 */
export type MessageLotWS =
  | { type: 'progress'; [k: string]: unknown }
  | { type: 'upload_progress'; [k: string]: unknown }
  | { type: 'file_created'; filename: string; law_id: number }
  | { type: 'error'; error: string; filename?: string }
  | { type: 'processing_start'; law_id: number }
  | { type: 'processing_complete'; law_id: number; status: 'published' | 'refused' }
  | { type: 'processing_error'; law_id: number; error: string };
