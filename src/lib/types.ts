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

/**
 * Un article tel que le sert `GET /laws/{id}`.
 *
 * Sert à remplacer la reconstruction du sommaire par expression régulière sur
 * `law.content`, qui trouvait 193 articles là où la base en compte 230, et qui
 * n'avait aucun moyen de connaître la page du PDF.
 */
export interface ArticleSummary {
  id: number;
  number: string;
  title: string | null;
  section: string | null;
  /** Page du PDF, 1-indexée. */
  page_number: number | null;
  kind: string | null;
}

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
  /** Servi uniquement par `GET /laws/{id}`, jamais par la liste. */
  articles?: ArticleSummary[];
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

  // Refonte UX (contrat-api.md §1.1 et §3, `GET /laws/{id}` seulement).
  // FACULTATIFS, et le resteront tant que le front peut partir avant l'API :
  // l'ancienne API ne les envoie pas. Tester la présence de la clé
  // (`'statut_juridique' in loi`), pas seulement sa valeur. Lecture prête à
  // l'emploi : `statutJuridiqueDe`, `dateDeLActe`, `ajouteLe` ($lib/api-publique).

  /** Date de l'acte (« Signé le … »). Nulle si seule l'année est sûre, ou si l'intitulé ne date que le JO. */
  date_signature?: string | null;
  /** Année de l'acte, sûre même quand le jour ne l'est pas. */
  annee?: number | null;
  /** Date du Journal officiel, SEULEMENT quand c'est la seule date de l'intitulé (deux Actes uniformes OHADA). */
  date_publication_jo?: string | null;
  /**
   * Jour d'ajout à JuriX (« Ajouté à JuriX le … ») : une date technique,
   * jamais juridique. Ancienne API : `created_at.slice(0, 10)`, même valeur.
   */
  ajoute_le?: string;
  /**
   * Statut prouvé par le relevé des liens entre textes. `null` quand son
   * calcul a échoué : même repli que l'absence de la clé (aucun encadré, et
   * surtout jamais « En vigueur », que rien ne prouve).
   */
  statut_juridique?: StatutJuridique | null;
}

/**
 * Les listes ne reçoivent que ce qu'elles affichent : leurs `load` serveur
 * trient les champs avant que la réponse parte vers le navigateur, l'API
 * renvoyant chaque texte EN ENTIER avec une douzaine de champs inutiles ici.
 */

/** Ligne de /laws (src/routes/laws/+page.server.ts). */
export type LoiDeListe = Pick<Law, 'id' | 'title' | 'reference' | 'publication_date' | 'article_count' | 'type'>;

/**
 * Document d'une catégorie (src/routes/categories/[id]/+page.server.ts).
 * `content` n'y porte qu'un extrait : rien de ce qui reçoit ce type ne doit le
 * prendre pour le document entier.
 */
export type LawResume = Pick<Law, 'id' | 'title' | 'publication_date'> & {
  /**
   * Extrait de 300 caractères, sans les marqueurs `<<PAGE:n>>`. Il sert au
   * filtre de la page, plus à l'affichage : le début brut de l'OCR (« 1 0 DEC
   * 2018 DECRETN° … ») faisait paraître la liste cassée.
   */
  content: string;
};

/**
 * `ArticleResponse`.
 *
 * Un article complet, avec son contenu. `GET /laws/{id}` ne rend PAS ce type :
 * il sert un `LawDetailResponse` dont `articles` est une liste
 * d'`ArticleSummary` (sans contenu, voir plus haut) — la fiche de loi lit ce
 * sommaire pour la page du PDF, et reconstruit le texte des articles depuis
 * `law.content`. Ce type-ci décrit les résultats de recherche et la carte
 * SearchResultCard.
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
/* Repères et statut prouvé — refonte UX (data/ux-impl/contrat-api.md)         */
/* -------------------------------------------------------------------------- */

/*
 * Ces types décrivent la branche `feat/ux-api`, PAS ENCORE DÉPLOYÉE. Un
 * champ nouveau posé sur un type existant (Law, SearchResult…) est donc
 * facultatif : l'ancienne API ne l'envoie pas. À l'intérieur d'une structure
 * nouvelle (StatutJuridique, Changement…), les champs suivent le schéma
 * OpenAPI de la branche (d99e23c) : si la structure est là, ils le sont aussi.
 * Une exception, `date_publication_jo`, absente d'une API faite des seules
 * branches de zone (contrat §8) : facultative partout, à lire comme `null`.
 *
 * Aucun de ces champs ne prouve qu'un texte est « en vigueur » : ce que le
 * relevé du 14 oct. 2026 ne contient pas, JuriX ne le sait pas (contrat §0.4).
 */

/** Résumé des changements ACTUELS d'un texte (`StatutJuridique.etat`, `StatutDeLArticle.etat_du_texte`). */
export type EtatDuTexte = 'aucune_modification_connue' | 'modifie' | 'abroge' | 'remplace';

/** Ce qu'un texte en a fait à un autre (`Changement.type`, `StatutJuridique.types`). */
export type TypeDeChangement = 'modifie' | 'complete' | 'abroge' | 'abroge_partiellement' | 'remplace';

/** Le type, ou « réécrit en entier » quand le relevé le dit : c'est lui qu'on traduit en anglais. */
export type NatureDeModification = TypeDeChangement | 'reecrit_en_entier';

/**
 * Un texte nommé par un lien, l'aperçu d'un article ou les chiffres du corpus.
 *
 * `id` n'est renseigné que si le texte est publié dans JuriX : c'est la seule
 * condition d'un lien `/laws/{id}`. Un texte absent du corpus, connu par son
 * seul intitulé, a `id` et `reference` nuls et `consultable` faux.
 */
export interface TexteLie {
  id: number | null;
  /** Cote interne (PRC-…) : jamais affichée (P2, P11). */
  reference: string | null;
  /** `laws.type`, accents compris ; « instruction » possible pour un texte hors corpus. */
  nature: string;
  /** Numéro propre de l'acte (« 2018/763 ») ; nul pour un code ou un traité. */
  numero: string | null;
  titre: string;
  date_signature: string | null;
  annee: number | null;
  date_publication_jo?: string | null;
  consultable: boolean;
}

/** Un lien prouvé entre deux textes (contrat §3.2). */
export interface Changement {
  /** « c1 », « c2 »… unique dans la réponse : la clé de `par_morceau` et `par_article`. */
  id: string;
  /** `modifie_par` : un autre texte a touché celui-ci ; `modifie` : celui-ci a touché l'autre. */
  sens: 'modifie_par' | 'modifie';
  type: TypeDeChangement;
  nature_modification: NatureDeModification;
  /** Libellé FRANÇAIS seulement (« réécrit en entier ») : en anglais, partir de `nature_modification`. */
  libelle: string;
  /** L'AUTRE texte du lien. */
  texte: TexteLie;
  etendue: 'articles' | 'texte' | 'inconnue';
  /** Articles du texte touché, plages gardées (« 34 à 101 »). Vide : voir `etendue`. */
  articles_cibles: string[];
  /** Le changement ne vaut que dans cette section (compilations comme le Code civil). */
  section: string | null;
  /** Morceaux du texte plus récent qui portent le changement ; parfois des pseudo-numéros (« DISPOSITIF »). */
  articles_source: string[];
  /** Phrase française du relevé, sans point final. */
  portee: string | null;
  /** Un texte plus récent a réécrit ou abrogé les mêmes dispositions : c'est de l'historique. */
  depasse: boolean;
  depasse_par: TexteLie | null;
  /** Le document affiché intègre déjà ce changement. */
  integre_au_texte: boolean;
}

/** Le document en base intègre déjà ces changements : ne pas écrire « version d'origine, non consolidée ». */
export interface VersionEnBase {
  consolidee: boolean;
  textes_integres: TexteLie[];
}

/**
 * Statut d'un texte, historique compris (`GET /laws/{id}` → `statut_juridique`).
 *
 * Sert à l'en-tête et à l'onglet « Historique » de la page d'un texte, et aux
 * marques « · modifié » du sommaire (`par_morceau`, exact, et non
 * `par_article`, qui a des collisions dans les compilations).
 */
export interface StatutJuridique {
  /** Date du relevé des liens : « aucune modification relevée par JuriX au … ». */
  releve_le: string;
  etat: EtatDuTexte;
  /**
   * Types actuels. `abroge` et `remplace` y figurent AUSSI quand ils ne visent
   * que des articles : pour dire le texte entier abrogé, lire `etat` ou `abroge`.
   */
  types: TypeDeChangement[];
  /** Le texte ENTIER est abrogé ou remplacé. */
  abroge: boolean;
  abroge_par: TexteLie | null;
  version_en_base: VersionEnBase | null;
  /** Ce que d'autres textes lui ont fait, du plus ancien au plus récent, historique compris. */
  modifie_par: Changement[];
  /** Ce que ce texte a fait à d'autres. */
  modifie: Changement[];
  /** Numéro d'article (majuscules, « 1er » → « 1 ») → identifiants de changements. Collisions possibles. */
  par_article: Record<string, string[]>;
  /** `articles[].id` (en chaîne) → identifiants de changements. Exact : c'est lui qu'on lit. */
  par_morceau: Record<string, string[]>;
}

/**
 * Clés de `StatutEnBref.natures`, dans l'ordre des libellés du contrat (§1.3).
 * `remplace_partiellement` est arrivée avec la revue du 28 octobre : une clé
 * inconnue d'un ajout futur est à ignorer, jamais à afficher telle quelle.
 */
export type NatureEnBref =
  | 'abroge'
  | 'remplace'
  | 'abroge_partiellement'
  | 'remplace_partiellement'
  | 'modifie'
  | 'complete';

/**
 * Résumé des changements actuels, sur les lignes de liste et de recherche.
 * `null` si aucun lien n'est connu, ce qui ne veut jamais dire « en vigueur ».
 * Sa date de relevé est celle de `GET /corpus` (`liens_releves_le`).
 */
export interface StatutEnBref {
  /** Vrai si et seulement si `natures` contient `abroge` ou `remplace`. */
  abroge: boolean;
  /** Nombre de textes distincts à l'origine des changements. */
  textes: number;
  natures: Partial<Record<NatureEnBref, number>>;
  date_dernier_texte: string;
}

/** Statut d'un article dans son aperçu (`ArticleApercu.statut`). */
export interface StatutDeLArticle {
  releve_le: string;
  etat_du_texte: EtatDuTexte;
  version_en_base: VersionEnBase | null;
  /** Changements qui touchent l'article ou qu'il porte, plus ceux du texte entier, historique compris. */
  changements: Changement[];
}

/** Un autre article du même numéro dans le texte (les quatre « 53 » du Code civil). */
export interface ArticleHomonyme {
  article_id: number;
  section: string | null;
}

/**
 * Aperçu d'un article, pour la feuille d'une citation du chat
 * (`GET /laws/{law_id}/articles/{numero}`, `ArticleApercuResponse`). Jamais la
 * loi entière : l'article seul, recousu s'il est en plusieurs morceaux.
 */
export interface ArticleApercu {
  law_id: number;
  texte: TexteLie;
  /** Sans suffixe de morceau : « 55 » pour 55.1 + 55.2. */
  numero: string;
  titre: string | null;
  section: string | null;
  /** Page du PDF, à partir de 1. */
  page: number | null;
  article_ids: number[];
  /** L'article entier, morceaux recousus. Le passage cité, c'est au front de le mettre en gras. */
  contenu: string;
  /** Coupé à 20 000 caractères : proposer « Lire dans le texte intégral ». */
  tronque: boolean;
  /** `contenu` est le morceau qui porte cet article AVEC d'autres : le dire au lecteur. */
  englobant: boolean;
  homonymes: ArticleHomonyme[];
  statut: StatutDeLArticle;
}

/** Repères d'un texte sur une ligne de liste ou de recherche (contrat §1.1, §1.2). Absents de l'ancienne API. */
export interface ReperesDuTexte {
  /** Objet en clair (« Révocation d'un magistrat ») ; nul : découpe pas sûre, afficher le titre. */
  objet?: string | null;
  numero?: string | null;
  date_signature?: string | null;
  annee?: number | null;
  date_publication_jo?: string | null;
  statut?: StatutEnBref | null;
}

/** Ordre des listes de textes (`GET /laws/?sort=`) : par `publication_date`, sans date en dernier. */
export type TriDesTextes = 'date_desc' | 'date_asc';

/**
 * Une ligne de liste de textes (`LawListLightItem`), réduite à ce que les
 * listes affichent : ni texte, ni cote PRC, ni champ d'administration.
 * Sur l'ancienne API, les repères manquent ($lib/api-publique.listerTextes).
 */
export interface LigneDeTexte extends ReperesDuTexte {
  id: number;
  title: string;
  type: LawType;
  language: LangueDocument | null;
  category_id: number | null;
  category_name: string | null;
  publication_date: string | null;
  article_count: number;
}

/** `LawListPage`, la page légère que rend `GET /laws/?page=` sur la nouvelle API. */
export interface PageDeTextes {
  items: LigneDeTexte[];
  total: number;
  page: number;
  page_size: number;
  /** ⌈total / page_size⌉, 0 si `total` est nul. */
  pages: number;
  sort: TriDesTextes;
}

/** Une nature du corpus et son nombre de textes publiés. */
export interface NatureDuCorpus {
  nature: string;
  textes: number;
}

/** Provenance des textes publiés (la somme des `textes` égale `ChiffresDuCorpus.textes`). */
export interface SourceDuCorpus {
  code: 'prc' | 'ohada' | 'cima' | 'autres';
  libelle: { fr: string; en: string };
  textes: number;
}

/**
 * `GET /corpus` (`CorpusResponse`) : les chiffres de l'accueil du chat et de
 * l'état vide de la recherche. Route nouvelle : 404 sur l'ancienne API, et
 * alors aucun chiffre ni aucune date (texte générique).
 */
export interface ChiffresDuCorpus {
  textes: number;
  /** Un article en plusieurs morceaux (55.1, 55.2) compte une fois. */
  articles: number;
  textes_par_nature: NatureDuCorpus[];
  texte_le_plus_recent: TexteLie | null;
  /** Dernier texte AJOUTÉ à JuriX (date technique). */
  dernier_ajout_le: string | null;
  /** Date du relevé des liens entre textes : la date du statut en bref des listes. */
  liens_releves_le: string;
  sources: SourceDuCorpus[];
  /** Le périmètre en une phrase (« textes officiels camerounais, OHADA et CIMA »). */
  libelle_sources: { fr: string; en: string };
  /** Heure du calcul (UTC). */
  calcule_le: string;
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

/** Tri de la recherche affinée (contrat §6.1) ; les textes sans date passent en dernier. */
export type TriDeRecherche = 'pertinence' | 'date_desc' | 'date_asc';

/**
 * `SearchRefine` : filtres appliqués à l'ensemble candidat, sans le recalculer.
 *
 * Ces clés, ET ELLES SEULES : la nouvelle API rend 422 sur une clé inconnue
 * (« nature » pour « types »), pour qu'une liste non filtrée ne s'affiche plus
 * comme filtrée. Clés différentes en ET, valeurs d'une même liste en OU. Des
 * bornes inversées donnent aussi 422.
 */
export interface AffinageDeRecherche {
  /** Natures ; accents, casse, « _ » et « - » ignorés (« decret », « acte_uniforme »). */
  types?: string[];
  category_ids?: number[];
  /** Année de l'acte, de 1900 à 2100, bornes incluses. */
  year_from?: number;
  year_to?: number;
  /** « AAAA-MM-JJ », bornes incluses. */
  date_from?: string;
  date_to?: string;
}

export interface SearchRequest {
  query: string;
  mode: string;
  filters?: SearchFilters;
  limit: number;
  offset: number;
  /*
   * Recherche affinée (contrat §6). L'un de ces trois champs fait passer la
   * requête par l'ensemble candidat ; sans eux, la recherche classique répond
   * exactement comme avant. L'ancienne API les IGNORE : tester `facets` dans
   * la réponse ($lib/api-publique.rechercherTextes le fait).
   */
  sort?: TriDeRecherche;
  refine?: AffinageDeRecherche;
  /** `true` bascule seul dans la recherche affinée (qui rend toujours ses effectifs). */
  facets?: boolean;
}

/** Effectif d'une nature dans les résultats affinés. */
export interface FacetteValeur {
  value: string;
  count: number;
}

/** Effectif d'un domaine ; un domaine absent vaut 0 (compléter avec `GET /categories`). */
export interface FacetteCategorie {
  id: number | null;
  name: string | null;
  count: number;
}

/** Effectif d'une année ; `value` nulle : textes sans date, rangés en dernier. */
export interface FacetteAnnee {
  value: number | null;
  count: number;
}

/**
 * Effectifs DISJONCTIFS de la recherche affinée : chacun compte les résultats
 * qui passent tous les filtres de `refine` sauf le sien. « Tous » = somme de
 * `types[].count`. Calculés sur l'ensemble candidat (6 à 62 textes mesurés),
 * pas sur tout le corpus : de l'ordre de la dizaine, jamais « Décrets (412) ».
 */
export interface FacettesDeRecherche {
  types: FacetteValeur[];
  categories: FacetteCategorie[];
  years: FacetteAnnee[];
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

/**
 * Un résultat de recherche. Les repères (`objet`, `numero`, dates, `statut` en
 * bref) arrivent sur les deux parcours de la nouvelle API ; absents de
 * l'ancienne (`ReperesDuTexte`, tous facultatifs).
 */
export interface SearchResult extends ReperesDuTexte {
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
  search_time_ms: number;
  filters_applied?: Record<string, unknown> | null;
  /**
   * « article 35 du code minier » : le backend a identifié le document ET
   * vérifié que l'article y existe. La page de recherche navigue alors
   * directement, sans afficher de liste. Ces trois champs étaient lus sans
   * être déclarés ici.
   */
  direct_navigation: boolean;
  target_law_id: number | null;
  target_article: string | null;

  /*
   * Recherche affinée (contrat §6.2). Nuls sur le parcours classique de la
   * nouvelle API, ABSENTS de l'ancienne, qui ignore `sort`, `refine` et
   * `facets` : seul `facets != null` prouve que le tri et les filtres envoyés
   * ont été appliqués.
   */
  /** Tri appliqué (« pertinence » par défaut). */
  sort?: string | null;
  /** Taille de l'ensemble candidat AVANT `refine`. */
  candidates?: number | null;
  facets?: FacettesDeRecherche | null;
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

/* -------------------------------------------------------------------------- */
/* Mode comparaison — POST /api/v1/compare                                     */
/* -------------------------------------------------------------------------- */

/**
 * Un article cité par une cellule de la grille.
 *
 * `content` porte le texte INTÉGRAL, et c'est délibéré : c'est lui qu'on
 * déplie sous la cellule. Sans ce texte à l'écran, une citation surnuméraire —
 * un article réel mais qui ne dit pas ce que la cellule affirme — reste
 * invisible. C'est le seul filet contre ce cas, mesuré une fois sur treize.
 */
export interface SourceRef {
  article_id: number | null;
  law_id: number;
  law_title: string;
  reference: string;
  number: string;
  article_title: string | null;
  page_number: number | null;
  content: string;
}

export interface ComparisonCell {
  value: string;
  /** Vide = le corpus ne répond pas. Jamais « pas encore cité ». */
  sources: SourceRef[];
}

export interface ComparisonRow {
  criterion: string;
  a: ComparisonCell;
  b: ComparisonCell;
}

export interface ComparisonResponse {
  subject_a: string;
  subject_b: string;
  language: string;
  rows: ComparisonRow[];
  key_differences: string[];
  blind_spots: string[];
  articles_a: SourceRef[];
  articles_b: SourceRef[];
  /** Numéros cités par le modèle sans article correspondant. Toujours affichés. */
  unmatched_citations: string[];
  retrieval_time_ms: number;
  generation_time_ms: number;
}

/* -------------------------------------------------------------------------- */
/* Conversations du chat — app/schemas/rag.py                                  */
/* -------------------------------------------------------------------------- */

/**
 * Une conversation dans le panneau latéral, SANS ses messages.
 *
 * Le détail complet passe par `ConversationDetail` : charger les messages dans
 * la liste ferait transiter tout l'historique du compte à chaque ouverture du
 * panneau.
 *
 * `title` est `null` pour les conversations antérieures à la colonne, et pour
 * les conversations anonymes — mais celles-là n'apparaissent dans la liste de
 * personne, puisqu'elles n'ont pas de propriétaire.
 */
export interface ConversationSummary {
  session_id: string;
  title: string | null;
  persona: string;
  language: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessage {
  id: number;
  /** `user` ou `assistant`. */
  role: string;
  content: string;
  sources?: unknown[] | null;
  confidence?: number | null;
  created_at: string;
}

export interface ConversationDetail extends ConversationSummary {
  messages: ConversationMessage[];
}

/* -------------------------------------------------------------------------- */
/* Citations et progression du chat — refonte UX (contrat-api.md §7)           */
/* -------------------------------------------------------------------------- */

/*
 * Le dernier événement du flux (`done: true`) et `POST /rag/ask` gagnent
 * quatre listes ; les événements d'avant le premier mot gagnent `progression`.
 * L'ancienne API n'envoie ni l'un ni l'autre : revenir alors à `sources`
 * (affichage d'avant), sans liens dans la phrase ni alertes (contrat §8).
 *
 * Une conversation RECHARGÉE (`GET /rag/conversations/{id}`) n'a jamais ces
 * listes : les positions des citations ne sont pas gardées en base (§9).
 */

/** Le lien prouvé le plus fort (`StatutProuve.etat`). */
export type EtatProuve = 'modifie' | 'complete' | 'abroge' | 'abroge_partiellement' | 'remplace';

/** Un lien que le modèle a lu pour l'extrait cité (§7.2). */
export interface LienProuve {
  nature: EtatProuve;
  libelle: string;
  /** Écrit pour une phrase : « la Loi N°2008/001 du 14 avril 2008 ». */
  par_titre: string;
  par_date: string;
  par_reference: string | null;
  /** Lien `/laws/{id}` ; nul si le texte n'est pas publié dans JuriX : pas de lien. */
  par_law_id: number | null;
  /** Vide : le lien vise le texte entier. */
  articles: string[];
  par_articles: string[];
  portee: string | null;
}

/**
 * Ce que le modèle a lu du statut d'un extrait. `etat` nul et `liens` vides :
 * rien de prouvé, ce qui n'est PAS « en vigueur ». Pour un texte entier, `etat`
 * ne compte que les liens qui le visent tout entier : `etat` nul avec des
 * `liens` veut dire « des articles de ce texte ont été modifiés depuis ».
 */
export interface StatutProuve {
  etat: EtatProuve | null;
  /** Du plus récent au plus ancien. */
  liens: LienProuve[];
  /** Lignes lues par le modèle, pour audit : références internes (« (PRC-6284) »), NE PAS AFFICHER. */
  lignes: string[];
}

/**
 * Une citation reconnue dans la réponse, liée à son texte.
 *
 * `debut` et `fin` sont en unités UTF-16 (fin exclue), sur le texte BRUT
 * affiché, markdown compris : `texte.slice(debut, fin) === texte_cite`. Poser
 * les liens avant le rendu markdown, ou garder la correspondance des positions.
 * Un passage cité ne contient jamais `*` ni `_`.
 */
export interface CitationPositionnee {
  debut: number;
  fin: number;
  texte_cite: string;
  law_id: number;
  /** « 35 » pour un article en plusieurs morceaux ; nul pour un texte cité sans article (lien vers `/laws/{law_id}`). */
  article: string | null;
  /** Le morceau lu par le modèle : il choisit l'article parmi les homonymes de l'aperçu. */
  article_id: number | null;
  reference: string;
  titre: string;
  /** Même règle que `date_signature`. */
  date_du_texte: string | null;
  statut: StatutProuve;
}

/** Une citation qu'aucun texte consulté ne porte : soulignée en tirets, avec l'alerte. */
export interface CitationIntrouvable {
  debut: number;
  fin: number;
  texte_cite: string;
  /** `article_non_consulte` : l'article n'est pas parmi les extraits lus ; `texte_non_consulte` : aucun texte lu ne répond au nom écrit. */
  raison: 'article_non_consulte' | 'texte_non_consulte';
}

/** « Articles cités » : une entrée par article cité, dans l'ordre du texte. */
export interface SourceCitee {
  law_id: number;
  law_reference: string;
  law_title: string;
  article_number: string | null;
  article_id: number | null;
  /** 300 caractères au plus. */
  excerpt: string;
  relevance_score: number;
  date_du_texte: string | null;
  statut: StatutProuve;
}

/** « Textes consultés, non cités » : remis au modèle, aucune citation n'en vient. */
export interface TexteConsulte {
  law_id: number;
  law_reference: string;
  law_title: string;
  date_du_texte: string | null;
  /** Numéros des articles lus. */
  articles: string[];
  /** Statut du texte entier. */
  statut: StatutProuve;
}

/** Les quatre listes du dernier événement et de `RAGResponse` ; absentes de l'ancienne API. */
export interface CitationsDeLaReponse {
  citations?: CitationPositionnee[];
  citations_introuvables?: CitationIntrouvable[];
  articles_cites?: SourceCitee[];
  textes_consultes_non_cites?: TexteConsulte[];
}

/** Étapes du chat avant le premier mot, dans cet ordre ; `redaction` manque quand rien n'est trouvé. */
export type EtapeDuChat = 'recherche' | 'textes_trouves' | 'redaction';

/** Un texte trouvé par la recherche, annoncé par l'étape `textes_trouves`. */
export interface TexteTrouve {
  law_id: number;
  law_reference: string;
  law_title: string;
  date_du_texte: string | null;
  /** Articles de ce texte remontés par la recherche. */
  nb_articles: number;
}

/**
 * Une étape du chat en flux (`progression`), avant le premier mot. Le libellé
 * est prêt à afficher, dans la langue de la question ; les compteurs
 * n'existent qu'à l'étape `textes_trouves`.
 */
export interface ProgressionDuChat {
  etape: EtapeDuChat;
  libelle: string;
  nb_articles?: number;
  nb_textes?: number;
  /** Du mieux classé au moins bien classé. */
  textes?: TexteTrouve[];
}

/**
 * Champs ajoutés aux événements du flux (`$lib/flux.EvenementDeFlux`) :
 * `progression` (avec `chunk: ""` et `done: false`, et déjà `session_id` et
 * `persona`, à garder : une réponse ARRÊTÉE n'a jamais de dernier événement),
 * puis les quatre listes sur le dernier événement.
 */
export interface AjoutsDuFlux extends CitationsDeLaReponse {
  progression?: ProgressionDuChat;
}
