import { numeroAAfficher } from '$lib/article';
import { estUneCoteInterne } from '$lib/sources';
import { translations, type Language } from '$lib/stores/language';

export interface BlogCitation {
  lawId: number;
  articleNumber?: string;
  /**
   * Le texte cité, tel qu'on le nomme (« Code pénal (loi n° 2016/007) »).
   * Le générateur d'origine y recopiait la COTE INTERNE du texte
   * (`law.reference`, « PRC-4722 ») ; celui du contrat du 29/10 y écrit le
   * titre du texte, lu dans la base. Des lignes anciennes peuvent encore
   * porter une cote : `referenceAffichable` l'écarte.
   */
  reference: string;
  /**
   * L'intitulé de la citation : ce que l'article dit, en une ligne
   * (« Violation de domicile »). Pour un article de l'API, c'est
   * l'explication écrite par le modèle puis relue par l'administrateur
   * (`explicationDeCitation`).
   */
  title: string;
  excerpt: string;
  /**
   * Le lien que le SERVEUR a construit pour une citation vérifiée
   * (`/laws/{id}?article=N`, contrat du 29/10), relu par `adresseDuServeur`.
   * Absent pour les articles de la rédaction, dont le lien se calcule
   * (`adresseDeCitation`), et pour toute citation non vérifiée, qui n'a
   * jamais de lien (contrat du 30/10).
   */
  url?: string;
  /**
   * L'extrait a été relevé MOT POUR MOT dans la base : par la rédaction pour
   * les articles statiques, par le SERVEUR pour ceux de l'API (contrat du
   * 29/10 : la citation est construite depuis l'extrait retrouvé, jamais
   * écrite par le modèle). Il s'affiche alors entre guillemets, dans la
   * police du texte officiel (Q5).
   *
   * Pour un article de l'API, `true` exige les TROIS marques du contrat du
   * 30/10 : `verifie: true`, un extrait et un lien du serveur
   * (`citationBruteVerifiee`). Sinon la citation est NON VÉRIFIÉE : elle
   * s'affiche « Citation non vérifiée », avec son texte et son numéro en
   * clair, sans lien, sans extrait et sans explication, sur la page publique
   * comme dans l'administration. POURQUOI (revue croisée du 29/10) : les
   * articles publiés avant le contrat (lignes 1 à 3 de jurix_dev) portent des
   * extraits ÉCRITS PAR LE MODÈLE, et la page les montrait entre guillemets
   * comme du texte de loi : « trois mois à trois ans » pour l'article 299 du
   * Code pénal, qui dit « dix (10) jours à un (01) an ».
   */
  verifie?: boolean;
  /**
   * L'extrait est la SUITE d'un article, pas son début (contrat du 30/10 :
   * un morceau « 35.2 » qui commence au milieu de l'article 39). Il commence
   * par « […] », et la carte le dit à côté du numéro : « Article 39 (suite) ».
   * Sans cette mention, l'article sur le licenciement du 30/10 montrait deux
   * cartes « Article 39 » que seul le « […] » de tête distinguait.
   */
  suite?: boolean;
}

/**
 * L'état de publication d'un article de l'API (contrat du 30/10), calculé par
 * le serveur. Seul « publiable » permet de publier : toutes les citations
 * vérifiées, un contrôle IA à jour sans phrase « contredite », et chaque
 * partie relue par une personne. Les routes publiques ne servent que les
 * articles publiés ET publiables.
 */
export const ETATS_DE_PUBLICATION = [
  'publiable',
  'relecture_incomplete',
  'controle_a_relancer',
  'phrases_contredites',
  'citations_non_verifiees',
] as const;
export type EtatDePublication = (typeof ETATS_DE_PUBLICATION)[number];

/** L'état de publication lu dans une réponse, ou `null` s'il manque ou n'est pas l'un du contrat. */
export function etatDePublication(valeur: unknown): EtatDePublication | null {
  return typeof valeur === 'string' && (ETATS_DE_PUBLICATION as readonly string[]).includes(valeur)
    ? (valeur as EtatDePublication)
    : null;
}

export interface BlogPost {
  /** Identifiant de l'API (articles de l'API seulement). */
  id?: number;
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  formattedDate: string;
  readingTime: string;
  /**
   * La rubrique, seule étiquette de l'article sur /blog comme sur sa page
   * (`nomRubrique`). Il n'y a plus de badge propre à la carte à la une : il
   * disait « Bail et logement » d'un article que le filtre « Immobilier »
   * affichait. Un article du modèle porte en plus « Généré par IA »
   * (`genereParIA`). Texte libre : celle d'un article de l'API est choisie
   * par le modèle ou par l'administrateur (« Immobilier & Logement »).
   */
  category: string;
  author: {
    name: string;
    role: string;
  };
  context: string;
  botAnalysis: {
    summary: string;
    keyPoints: string[];
    citations: BlogCitation[];
    citizenImpact: string;
  };
  suggestedChatQuestion: string;
  tags: string[];
  /**
   * Article écrit par le modèle (les articles de l'API, `POST /blog/generate`) :
   * la page l'étiquette « Généré par IA » et garde son titre en Inter (Q5).
   */
  genereParIA?: boolean;
  /**
   * Nom de la personne qui a relu l'article, quand il l'a été. Seul un
   * article écrit ou relu par une personne a son titre en serif (Q5 : une
   * analyse générée habillée de la serif officielle paraîtrait plus sûre
   * qu'elle ne l'est). Aucune donnée ne le dit aujourd'hui, ni l'API
   * (app/models/blog.py n'a pas de relecteur) ni les articles ci-dessous :
   * les titres restent en Inter.
   */
  reluPar?: string | null;
  /**
   * `false` : un brouillon de l'API. La page publique n'en sert jamais
   * (404) : une API qui en renverrait un par erreur (le code d'origine du
   * blog servait les brouillons par leur adresse) ne doit pas le rendre
   * public. Absent pour les articles de la rédaction, tous publiés.
   */
  publie?: boolean;
  /**
   * Article de l'API que le serveur dit « publiable » (`etat_publication`),
   * et dont toutes les citations sont vérifiées. Les pages publiques ne
   * servent QUE ceux-là (décision du propriétaire du 30/10) : un article
   * publié avant la vérification (lignes 1 à 3 de jurix_dev), dont la prose
   * écrite de mémoire disait « plafonnée entre 1 et 12 mois de salaire » quand
   * l'article 39 du Code du travail dit l'inverse, n'est plus servi à son
   * adresse (404) ni listé, même si une API le renvoyait. Il reste dans la
   * base, visible et corrigeable dans l'administration. Absent pour les
   * articles de la rédaction.
   */
  publiable?: boolean;
}

/*
 * Articles de la rédaction : TOUJOURS listés sur /blog, avec ceux de l'API
 * (`avecLesArticlesDeLaRedaction`), et servis à leur adresse même quand l'API
 * est en panne. Ils ne servaient auparavant que si l'API n'avait aucun
 * article : le premier article publié par l'administration les aurait fait
 * disparaître de la liste, alors que ce sont les seuls dont chaque extrait a
 * été relevé mot pour mot par une personne.
 *
 * LES CITATIONS SONT VÉRIFIÉES (relevé du 29/10/2026 sur jurix_dev, en lecture
 * seule : data/ux-front/hors-zones/outils/verifier_extraits.py dans le dépôt
 * du backend). Chacune vise le bon texte (`lawId`) et un article que la page
 * du texte sait ouvrir (`?article=N`, P2), et son extrait est la base mot pour
 * mot (« […] » marque une coupe). Auparavant, les identifiants menaient à
 * d'autres textes (/laws/2 était un décret de convocation du corps électoral,
 * /laws/14 et /laws/18 deux décrets de 2013), et les extraits, écrits à la
 * main, n'avaient pas été comparés à la base : seul celui de l'article 1736
 * du Code civil s'y lisait mot pour mot ; l'« article 74 » de la loi sur la
 * cybersécurité traite de la vie privée, et les articles 37 et 40 du Code du
 * travail ne disaient pas ce qui leur était prêté.
 *
 * Intitulés : celui de l'article quand il en porte un (« Violation de
 * domicile », Code pénal), sinon l'objet de l'extrait cité, en clair.
 *
 * Les articles 36 à 40 du Code du travail ne sont pas cités : la base les a
 * collés au paragraphe de l'article 35 (morceaux 97420-97421), et la page du
 * texte ne peut pas les ouvrir un par un. Le reste de l'analyse (points clés,
 * impact) est un texte de la rédaction, non relu par une personne (`reluPar`).
 *
 * PAS DE RÈGLE SANS SON ARTICLE (audit r2 du 29/10/2026). Le surtitre de
 * /blog promet des « articles cités à l'appui ». Trois phrases n'avaient
 * aucun appui, et l'une contredisait la base :
 * - bail : « préavis notifié par acte d'huissier ou lettre avec accusé de
 *   réception » (rien de tel au Code civil, dont l'article 1736 ne renvoie
 *   qu'à « l'usage des lieux ») et « hausse du loyer seulement par clause
 *   d'indexation ». Remplacées par les articles 1737 (fin du bail écrit) et
 *   1134 (force obligatoire du contrat), cités. Le point voisin, « seule une
 *   décision judiciaire exécutoire permet l'intervention des forces de
 *   l'ordre », disait plus que son texte : il cite désormais l'article 29 de
 *   l'Acte uniforme OHADA sur les voies d'exécution (le concours de la force
 *   publique aux décisions et autres titres exécutoires) ;
 * - travail : « la mention « sous réserve de mes droits » permet de contester
 *   devant l'Inspection du travail dans un délai de 6 mois ». Le Code du
 *   travail dit autre chose : la mention « pour solde de tout compte » n'est
 *   pas opposable au travailleur (article 69, alinéa 3), et l'action en
 *   paiement du salaire, indemnités de rupture comprises, se prescrit par
 *   trois ans (article 74, alinéa 1). L'encart les nomme, sans carte de
 *   citation, comme les articles 36 à 40 : l'OCR les a collés au passage
 *   de l'article 67 (morceaux 97435 et 97436), et la page du texte ne sait
 *   pas les ouvrir un par un (une carte n'y mènerait qu'au début du code).
 * Extraits relevés mot pour mot dans laws.content et dans les morceaux
 * (data/ux-front/correctifs-r2/verifier.py et extraits-verifies.json, dépôt
 * du backend) ; les articles 1737 et 1134 du Code civil et 29 de l'Acte
 * uniforme sont reconnus par le découpage de la page (decoupage.ts), qui
 * sait donc les ouvrir.
 */
export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'litiges-locatifs-resiliation-bail-expulsion-abusive',
    title: 'Expulsions et hausses de loyer : ce que dit réellement la loi camerounaise',
    excerpt: 'Face aux augmentations unilatérales de loyers et aux expulsions sans préavis, que disent les textes camerounais ?',
    date: '2026-10-24',
    formattedDate: '24 octobre 2026',
    readingTime: '4 min',
    category: 'Immobilier',
    author: {
      name: 'Rédaction Juridique & IA',
      role: 'Veille réglementaire',
    },
    context:
      'Dans les grandes métropoles comme Douala et Yaoundé, de nombreux locataires font face à des hausses soudaines de loyer ou à des menaces d’expulsion immédiate. Beaucoup ignorent que la loi camerounaise et le droit communautaire encadrent strictement les conditions de rupture de bail et interdisent formellement l’expulsion forcée sans titre exécutoire de justice.',
    botAnalysis: {
      summary:
        'Un bailleur ne peut pas expulser un locataire de son propre chef, couper l’eau ou changer les serrures, même en cas d’impayé de loyer. Quand le bail a été fait sans écrit, le congé doit respecter les délais fixés par l’usage des lieux (Code civil, article 1736), et seule une décision de justice permet d’autoriser une expulsion.',
      keyPoints: [
        'Interdiction absolue de se faire justice soi-même : entrer ou se maintenir dans le domicile d’autrui contre son gré est puni comme une violation de domicile (Code pénal, article 299).',
        'Un bail écrit prend fin de plein droit au terme qu’il fixe, sans qu’il soit nécessaire de donner congé (Code civil, article 1737). Fait sans écrit, il ne prend fin que par un congé donné dans les délais d’usage du lieu (article 1736).',
        'Le loyer est fixé par le bail, et « les conventions légalement formées tiennent lieu de loi à ceux qui les ont faites » (Code civil, article 1134) : une hausse en cours de bail doit être prévue par le contrat ou acceptée par le locataire.',
        'En cas de litige, les forces de l’ordre prêtent leur concours à l’exécution d’une décision de justice ou d’un autre titre exécutoire : « la formule exécutoire vaut réquisition directe de la force publique » (Acte uniforme OHADA sur les voies d’exécution, article 29).',
      ],
      citations: [
        {
          lawId: 2285,
          articleNumber: '1736',
          reference: 'Code civil applicable au Cameroun',
          title: 'Le congé d’un bail fait sans écrit',
          excerpt:
            "Si le bail a été fait sans écrit, l'une des parties ne pourra donner congé à l'autre qu'en observant les délais fixés par l'usage des lieux.",
          verifie: true,
        },
        {
          lawId: 2236,
          articleNumber: '299',
          reference: 'Code pénal (loi n°\u00a02016/007)',
          title: 'Violation de domicile',
          excerpt:
            "Est puni d'un emprisonnement de dix (10) jours à un (01) an et d'une amende de cinq mille (5 000) à cinquante mille (50 000) francs ou de l'une de ces deux peines seulement, celui qui s'introduit ou se maintient dans le domicile d'autrui contre son gré.",
          verifie: true,
        },
        {
          lawId: 2285,
          articleNumber: '1737',
          reference: 'Code civil applicable au Cameroun',
          title: 'La fin d’un bail fait par écrit',
          excerpt:
            "Le bail cesse de plein droit à l'expiration du terme fixé, lorsqu'il a été fait par écrit, sans qu'il soit nécessaire de donner congé.",
          verifie: true,
        },
        {
          lawId: 2285,
          articleNumber: '1134',
          reference: 'Code civil applicable au Cameroun',
          title: 'La force obligatoire du contrat',
          excerpt: 'Les conventions légalement formées tiennent lieu de loi à ceux qui les ont faites.',
          verifie: true,
        },
        {
          lawId: 2281,
          articleNumber: '29',
          reference: 'Acte uniforme OHADA sur les voies d’exécution (révisé en 2023)',
          title: 'Le concours de la force publique',
          // Deux alinéas qui se suivent dans la base, joints par une espace.
          excerpt:
            "L'État est tenu de prêter son concours à l'exécution des décisions et des autres titres exécutoires. La formule exécutoire vaut réquisition directe de la force publique.",
          verifie: true,
        },
      ],
      citizenImpact:
        'Si votre propriétaire exige votre départ sans respecter le délai de congé ou tente de bloquer l’accès à votre logement, vous pouvez saisir le procureur ou le juge des référés pour obtenir le maintien dans les lieux.',
    },
    suggestedChatQuestion:
      'Quelles sont les démarches juridiques urgentes si mon bailleur menace de m’expulser sans préavis écrit ?',
    tags: ['Bail', 'Loyers', 'Immobilier', 'Expulsion', 'Droits du locataire'],
  },
  {
    slug: 'rupture-contrat-travail-preavis-indemnites-licenciement',
    title: 'Fin de contrat et licenciement : comment calculer vos indemnités légales',
    excerpt: 'Licenciement économique ou faute présumée : tour d’horizon des droits des salariés et des obligations de l’employeur.',
    date: '2026-10-18',
    formattedDate: '18 octobre 2026',
    readingTime: '5 min',
    category: 'Travail',
    author: {
      name: 'Rédaction Juridique & IA',
      role: 'Veille droit social',
    },
    context:
      'Les restructurations d’entreprises et suppressions de postes suscitent de vives inquiétudes chez les salariés. Entre préavis non payé, calcul contesté des indemnités de licenciement et rupture abusive, les recours prévus par le Code du travail camerounais sont méconnus mais très protecteurs.',
    botAnalysis: {
      summary:
        'Tout licenciement d’un travailleur sous contrat à durée indéterminée (CDI) doit être motivé par une cause légitime (faute lourde, inaptitude ou motif économique). À défaut, le licenciement est réputé abusif et ouvre droit à des dommages et intérêts en plus des indemnités de préavis et de licenciement.',
      keyPoints: [
        'L’indemnité de licenciement est due dès lors que le travailleur justifie de deux années consécutives dans l’entreprise.',
        'La durée du préavis dépend de l’ancienneté et de la classification professionnelle du travailleur ; un arrêté du ministre chargé du Travail la fixe.',
        'Pendant la durée du préavis, le salarié a droit à un jour de liberté par semaine pour rechercher un nouvel emploi, avec plein salaire (article 35).',
        'Au moment du départ, l’employeur doit remettre au travailleur un certificat de travail (article 44).',
      ],
      citations: [
        {
          lawId: 2274,
          articleNumber: '35',
          reference: 'Code du travail (loi n°\u00a092/007)',
          title: 'Le jour de liberté pendant le préavis',
          excerpt:
            "En vue de la recherche d'un autre emploi, le travailleur bénéficie pendant la durée du préavis d'un jour de liberté par semaine pris, à son choix, globalement ou heure par heure et payé à plein salaire.",
          verifie: true,
        },
        {
          lawId: 2274,
          articleNumber: '44',
          reference: 'Code du travail (loi n°\u00a092/007)',
          title: 'Le certificat de travail',
          excerpt:
            "A l'expiration du contrat de travail, quel que soit le motif de sa résiliation, l'employeur doit délivrer au travailleur, au moment du départ, un certificat de travail indiquant exclusivement la date de son entrée, celle de sa sortie, la nature et les dates des emplois successivement occupés.",
          verifie: true,
        },
      ],
      citizenImpact:
        'Avant de signer un reçu pour solde de tout compte, exigez le décompte écrit et détaillé des sommes versées. Signer ce reçu ne vous fait pas renoncer aux droits que vous tenez de votre contrat : la mention « pour solde de tout compte » ne vous est pas opposable (Code du travail, article 69). Un salaire ou une indemnité de rupture impayés se réclament pendant trois ans (article 74).',
    },
    suggestedChatQuestion:
      'Comment calculer l’indemnité de licenciement et le préavis pour un salarié ayant 4 ans d’ancienneté ?',
    tags: ['Licenciement', 'Travail', 'Indemnités', 'Préavis', 'Salaires'],
  },
  {
    slug: 'arnaques-mobile-money-e-commerce-recours-legaux',
    title: 'Arnaques au Mobile Money et achats en ligne : les recours légaux au Cameroun',
    excerpt: 'Faux transferts, comptes piratés, produits jamais livrés : comment la loi vous protège et comment porter plainte.',
    date: '2026-10-10',
    formattedDate: '10 octobre 2026',
    readingTime: '4 min',
    category: 'Numérique',
    author: {
      name: 'Rédaction Juridique & IA',
      role: 'Technologies & Droit',
    },
    context:
      'Avec la montée en puissance des commerces sur WhatsApp et Facebook et la généralisation des paiements mobiles, les escroqueries numériques explosent. Beaucoup de victimes pensent qu’Internet est une zone de non-droit où il est impossible d’obtenir réparation.',
    botAnalysis: {
      summary:
        'Le Code pénal punit l’escroquerie, c’est-à-dire le fait de tromper une victime par des manœuvres ou en affirmant ou dissimulant un fait, de cinq à dix ans d’emprisonnement et d’une amende. La loi de 2010 sur la cybersécurité et la cybercriminalité oblige par ailleurs les opérateurs à conserver pendant dix ans les données de connexion et de trafic.',
      keyPoints: [
        'L’escroquerie est punie de cinq à dix ans d’emprisonnement et d’une amende de 100 000 à 1 000 000 de francs (Code pénal, article 318).',
        'La capture d’écran et les relevés de transaction électronique constituent des preuves légales recevables devant les juridictions.',
        'L’ANTIC (Agence Nationale des TIC) et la Division spéciale de la police judiciaire disposent de cellules dédiées au traçage des numéros fraudeurs.',
        'En cas d’erreur de transfert de bonne foi, le refus de restituer les fonds constitue un abus de confiance ou une rétention indue.',
      ],
      citations: [
        {
          lawId: 2236,
          articleNumber: '318',
          reference: 'Code pénal (loi n°\u00a02016/007)',
          title: 'Vol, abus de confiance, escroquerie',
          excerpt:
            "Est puni d'un emprisonnement de cinq (5) à dix (10) ans et d'une amende de cent mille (100 000) à un million (1 000 000) de francs, celui qui porte atteinte à la fortune d'autrui : […] c) par escroquerie, c'est-à-dire en déterminant fallacieusement la victime soit par des manœuvres, soit en affirmant ou dissimulant un fait.",
          verifie: true,
        },
        {
          lawId: 2271,
          articleNumber: '25',
          reference: 'Loi n°\u00a02010/012 relative à la cybersécurité et la cybercriminalité',
          title: 'La conservation des données de connexion et de trafic',
          excerpt:
            "Les opérateurs de réseaux et les fournisseurs de services de communications électroniques ont l'obligation de conserver les données de connexion et de trafic pendant une période de dix (10) ans.",
          verifie: true,
        },
      ],
      citizenImpact:
        'En cas d’arnaque : 1) Notifiez immédiatement l’opérateur pour bloquer la transaction ; 2) Conservez toutes les captures d’écran et identifiants de transaction ; 3) Déposez plainte auprès de la division de la Police Judiciaire chargée de la cybercriminalité.',
    },
    suggestedChatQuestion:
      'Quels sont les recours juridiques si j’ai envoyé de l’argent par Mobile Money à un faux vendeur qui m’a bloqué ?',
    tags: ['Cybercriminalité', 'Mobile Money', 'Fraude', 'E-commerce', 'ANTIC'],
  },
];

export function getPostBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

/**
 * Rubrique d'un article dans la langue de l'interface.
 *
 * POURQUOI. La rubrique vient de l'API, en français et en texte libre (le
 * générateur d'articles en choisit une : « Immobilier & Logement », « Travail
 * & Emploi »…). L'interface anglaise l'affichait telle quelle dans les filtres,
 * les badges et le fil d'Ariane, seul « Tous » étant traduit.
 *
 * Les traductions sont des clés `blog.rubrique.<nom sans accents, en
 * minuscules, mots joints par des tirets>` de src/lib/stores/language.ts (FR
 * et EN). Une rubrique composée inconnue (« Famille & Emploi ») est traduite
 * partie par partie ; s'il manque une partie, le nom revient tel quel : mieux
 * vaut du français exact qu'un mélange des deux langues. En français, le nom
 * de l'API est rendu sans changement.
 */
export function nomRubrique(nom: string | null | undefined, lang: Language): string {
  const brut = (nom ?? '').trim();
  if (!brut || lang === 'fr') return brut;
  const table = translations[lang] as Record<string, string | undefined>;
  const entier = table[cleRubrique(brut)];
  if (entier) return entier;

  // Parties aux indices pairs, séparateurs (« & », « , », « et ») aux indices
  // impairs, grâce aux parenthèses capturantes du découpage.
  const morceaux = brut.split(/(\s*&\s*|\s*,\s*|\s+et\s+)/);
  const traduits: string[] = [];
  for (let i = 0; i < morceaux.length; i++) {
    if (i % 2 === 1) {
      traduits.push(/\bet\b/.test(morceaux[i]) ? ' and ' : morceaux[i]);
      continue;
    }
    const partie = table[cleRubrique(morceaux[i])];
    if (!partie) return brut;
    traduits.push(partie);
  }
  return traduits.join('');
}

/** Clé de traduction d'une rubrique : « Économie & Fiscalité » → `blog.rubrique.economie-fiscalite`. */
export function cleRubrique(nom: string): string {
  const mots = nom
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `blog.rubrique.${mots}`;
}

/* -------------------------------------------------------------------------- */
/* Citations d'un article : ce qui s'en affiche                                */
/* -------------------------------------------------------------------------- */

/**
 * La cote interne d'un texte (« PRC-4722 », « LOI-1992-007 ») : reconnue par
 * $lib/sources, qui en a besoin pour le chat, et reprise ici pour les
 * citations du blog. Une seule liste des formes de cote à tenir.
 */
export { estUneCoteInterne };
const COTE_DANS_UN_TEXTE = /\s*[-–—(,]?\s*\b(?:PRC|LOI|ORD|DEC|OHADA|CODE|CIMA)(?:-[A-Z0-9]+)+\b\)?/g;

/**
 * Une cote entre parenthèses dans une phrase (« … est interdite (PRC-4722). »).
 * Le générateur d'origine en semait dans les points clés et l'impact (relevé
 * du 29/10 : « (PRC-4722) », « (Art. OHADA-AUDCG) ») ; elle ne dit rien au
 * lecteur, qui ne peut pas la chercher.
 */
const COTE_ENTRE_PARENTHESES = /\s*\((?:Art\.?\s*)?(?:PRC|LOI|ORD|DEC|OHADA|CODE|CIMA)(?:-[A-Z0-9]+)+\)/g;

/**
 * Le nom du texte cité, à afficher, ou `null`. Le générateur d'origine
 * remplissait `reference` avec la cote interne (« PRC-4722 ») ou un nom
 * inventé qui la contenait (« Prescription relative… (PRC-4722) », relevé du
 * 29/10) : la cote est écartée, seule ou à l'intérieur du nom ; un nom sans
 * cote reste.
 */
export function referenceAffichable(citation: Pick<BlogCitation, 'reference'>): string | null {
  const reference = (citation.reference ?? '').trim();
  if (!reference || estUneCoteInterne(reference)) return null;
  const sansCote = reference.replace(COTE_DANS_UN_TEXTE, '').replace(/[\s\-–—:,]+$/, '').trim();
  return sansCote || null;
}

/**
 * Le numéro d'article cité, ou `null`.
 *
 * Seulement un vrai numéro, de ceux que la page du texte sait ouvrir
 * (`numeroAAfficher` de $lib/article : « 299 », « 12 bis », « 55.2 », « 1 »
 * pour « 1er »). Auparavant, toute valeur qui contenait un chiffre passait :
 * le run réel du 29/10 a affiché « Article Non numéroté explicitement dans
 * l'extrait, mais inspiré de l'article 10… » et construit des liens cassés
 * (`?article=1351%20(et%20jurisprudence)`). « ? » (le générateur d'origine
 * sans numéro) n'en est pas un non plus.
 */
export function articleDeCitation(citation: Pick<BlogCitation, 'articleNumber'>): string | null {
  return numeroAAfficher(String(citation.articleNumber ?? ''));
}

/**
 * L'intitulé d'une citation, sans cote : le générateur l'écrit
 * « Article 35.1 - PRC-4722 » quand le modèle n'en donne pas. Vide si rien ne
 * reste (l'appelant nomme alors la citation par son article).
 */
export function titreDeCitation(citation: Pick<BlogCitation, 'title'>): string {
  return (citation.title ?? '').replace(COTE_DANS_UN_TEXTE, '').replace(/[\s\-–—:,]+$/, '').trim();
}

/**
 * L'adresse de l'article cité dans la page du texte (`?article=N`, P2), ou du
 * texte seul sans numéro ; `null` sans identifiant de texte sûr.
 *
 * 1 n'en est pas un : c'est la valeur par défaut du schéma des citations
 * (backend app/api/routes/blog.py) et celle de l'exemple que le prompt du
 * générateur donne au modèle (`"law_id": 1`). Une citation dont le modèle
 * ignore le texte la porte, et le lien ouvrait un décret de nomination de
 * 2013 sans rapport (le texte 1 de la base).
 */
export function adresseDeCitation(citation: Pick<BlogCitation, 'lawId' | 'articleNumber'>): string | null {
  const id = Number(citation.lawId);
  if (!Number.isInteger(id) || id <= 1) return null;
  const numero = articleDeCitation(citation);
  return numero ? `/laws/${id}?article=${encodeURIComponent(numero)}` : `/laws/${id}`;
}

/**
 * Le lien d'une citation tel que le SERVEUR l'a construit
 * (`adresse_de_l_article` : `/laws/{id}?article=<numéro encodé>`), ou `null`.
 *
 * Seule une adresse INTERNE de la page du texte cité est acceptée, et pour le
 * texte même de la citation : le lien est posé dans un `href`, et une valeur
 * venue de la base ne doit mener ni ailleurs (`javascript:`, autre domaine)
 * ni vers un autre texte que celui que la carte nomme. Une adresse refusée
 * rend la citation non vérifiée (`citationBruteVerifiee`).
 */
const ADRESSE_DU_SERVEUR = /^\/laws\/([1-9]\d{0,8})(?:\?article=[A-Za-z0-9%._~-]{1,120})?$/;

export function adresseDuServeur(valeur: unknown, lawId: number): string | null {
  if (typeof valeur !== 'string') return null;
  const adresse = valeur.trim();
  const trouve = ADRESSE_DU_SERVEUR.exec(adresse);
  return trouve && Number(trouve[1]) === lawId ? adresse : null;
}

/**
 * Vrai si une citation de l'API (objet brut, tel que le rend une route) est
 * VÉRIFIÉE : `verifie: true`, un extrait et un lien du serveur.
 *
 * POURQUOI LES TROIS (contrat du 30/10). `verifie` seul ne suffit pas : une
 * réponse publique ne porte, pour une citation non vérifiée, ni extrait ni
 * lien ; une citation sans l'un ou l'autre n'a donc rien de vérifié à
 * montrer. Et seul `true` vaut : `verifie` absent (API d'avant le contrat,
 * lignes anciennes) est un refus, jamais un accord par défaut.
 *
 * La même règle pour la page publique, l'aperçu, l'édition et les points à
 * vérifier de l'administration : une citation n'est jamais « vérifiée » ici
 * et « non vérifiée » là.
 */
export function citationBruteVerifiee(brut: Record<string, unknown>): boolean {
  const lawId = Number(brut.law_id ?? brut.lawId);
  return (
    brut.verifie === true &&
    Number.isInteger(lawId) &&
    chaine(brut.excerpt ?? brut.extrait).trim() !== '' &&
    adresseDuServeur(brut.url, lawId) !== null
  );
}

/**
 * Un numéro que la base peut porter sans que la page du texte sache l'ouvrir
 * (« L 104 », relevé de la revue du 29/10 : 7 citations publiées) : au plus
 * 20 caractères, lettres, chiffres, espaces, points, tirets ou barres, dont
 * au moins un chiffre. Une phrase (« Non numéroté explicitement… ») ou un
 * intitulé de la base (« CONTENU ») n'en est pas un.
 */
const NUMERO_DE_LA_BASE = /^(?=\D*\d)[\p{L}\d](?:[\p{L}\d .\-/]{0,18}[\p{L}\d])?$/u;

/**
 * Le numéro d'article à écrire sur la carte d'une citation, ou `null`.
 *
 * Citation NON VÉRIFIÉE : seulement un vrai numéro (`articleDeCitation`), le
 * texte qui la porte ayant été écrit par le modèle. Citation VÉRIFIÉE : son
 * numéro vient de la base par le serveur ; un numéro d'une forme que la page
 * du texte ne reconnaît pas (« L 104 ») s'écrit tel quel au lieu de
 * disparaître de la carte.
 */
export function numeroDeLaCitation(citation: Pick<BlogCitation, 'articleNumber' | 'verifie'>): string | null {
  const reconnu = articleDeCitation(citation);
  if (reconnu || citation.verifie !== true) return reconnu;
  const brut = String(citation.articleNumber ?? '').trim();
  return NUMERO_DE_LA_BASE.test(brut) ? brut : null;
}

/**
 * « Article 39 », « Article 39 (suite) », « Extrait légal », ou '' : le nom
 * d'une citation par son article, sur la carte publique comme dans
 * l'administration. « (suite) » reste collé au numéro (espace insécable).
 * Sans numéro : « Extrait légal » pour une citation vérifiée (son extrait vient
 * de la base), rien pour une citation non vérifiée.
 */
export function articleNomme(
  citation: Pick<BlogCitation, 'articleNumber' | 'verifie' | 'suite'>,
  t: (cle: string) => string,
): string {
  const numero = numeroDeLaCitation(citation);
  const nom = numero ? `${t('blog.article')} ${numero}` : citation.verifie === true ? t('blog.legalExcerpt') : '';
  return nom && citation.suite === true ? `${nom}\u00a0${t('blog.suite')}` : nom;
}

/**
 * Le lien d'une carte de citation, ou `null`. Une citation non vérifiée n'en
 * a JAMAIS (contrat du 30/10) : un lien vers « l'article 299 du Code pénal »
 * sous un intitulé écrit par le modèle donnait à sa règle l'autorité du texte
 * officiel. Vérifiée : le lien du serveur, sinon (articles de la rédaction)
 * celui que calcule `adresseDeCitation`.
 */
export function lienDeCitation(citation: BlogCitation): string | null {
  if (citation.verifie !== true) return null;
  return citation.url ?? adresseDeCitation(citation);
}

/**
 * Le nombre de citations NON VÉRIFIÉES d'un article : la page le signale en
 * tête de l'article, /blog l'étiquette et ne le met pas à la une.
 */
export function citationsNonVerifiees(post: Pick<BlogPost, 'botAnalysis'> | null | undefined): number {
  const citations: unknown = post?.botAnalysis?.citations;
  if (!Array.isArray(citations)) return 0;
  return citations.filter((c) => (c as BlogCitation | null)?.verifie !== true).length;
}

/* -------------------------------------------------------------------------- */
/* Articles de l'API : lecture défensive                                       */
/* -------------------------------------------------------------------------- */

type Objet = Record<string, unknown>;

function estObjet(valeur: unknown): valeur is Objet {
  return typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur);
}

/** Une chaîne de l'API, ou '' : un nombre devient sa chaîne, tout le reste ''. */
function chaine(valeur: unknown): string {
  if (typeof valeur === 'string') return valeur;
  if (typeof valeur === 'number' && Number.isFinite(valeur)) return String(valeur);
  return '';
}

/**
 * Les chaînes non vides d'une liste. Tout autre élément est écarté : un
 * point clé rendu en objet par le modèle (`{"point": …}`, forme courante)
 * s'affichait « [object Object] » et faisait planter la page de l'article
 * (`insecables` appelait `.replace` sur un objet : 500, revue du 29/10).
 */
export function listeDeTextes(valeur: unknown): string[] {
  if (!Array.isArray(valeur)) return [];
  return valeur
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * Où l'API range l'explication d'une citation, par ordre de préférence. Le
 * contrat du 29/10 dit qu'elle se relit et se modifie, sans nommer le champ :
 * le front lit les trois noms et, à l'enregistrement, réécrit celui qu'il a
 * trouvé (src/routes/admin/blog/relecture.ts). `title` est le champ
 * d'aujourd'hui (to_dict, articles de la rédaction).
 */
export const CLES_D_EXPLICATION = ['explication', 'explanation', 'title'] as const;
export type CleDExplication = (typeof CLES_D_EXPLICATION)[number];

/** Le champ d'explication PRÉSENT dans la citation (même vide), `title` à défaut. */
export function cleDExplication(citation: Objet): CleDExplication {
  return CLES_D_EXPLICATION.find((cle) => typeof citation[cle] === 'string') ?? 'title';
}

/** L'explication à afficher : le premier champ d'explication non vide. */
export function explicationDeCitation(citation: Objet): string {
  for (const cle of CLES_D_EXPLICATION) {
    const valeur = chaine(citation[cle]).trim();
    if (valeur) return valeur;
  }
  return '';
}

/**
 * Une citation de l'API, ou `null` si ce n'est pas un objet : une citation
 * `null` faisait échouer le chargement, et la page devenait un 404.
 *
 * Une citation NON VÉRIFIÉE (`citationBruteVerifiee`) ne garde que son texte
 * et son numéro, à écrire en clair (contrat du 30/10) : son extrait, son
 * explication et son lien sont écartés DÈS LA LECTURE, et non au seul
 * affichage. Le chargement des pages publiques tourne au serveur et SvelteKit
 * recopie ses données dans le HTML pour l'hydratation : un extrait gardé ici
 * et masqué par le composant aurait tout de même été servi, lisible dans la
 * source de la page et par les robots. L'explication part aussi : écrite par
 * le modèle (« Violation de domicile et entrave à la jouissance », ligne 1
 * de jurix_dev), elle peut dire du texte ce qu'il ne dit pas.
 */
export function citationDepuisLApi(brut: unknown): BlogCitation | null {
  if (!estObjet(brut)) return null;
  const lawId = Number(brut.law_id ?? brut.lawId);
  const numero = chaine(brut.article_number ?? brut.articleNumber).trim();
  const reperes = {
    lawId: Number.isInteger(lawId) ? lawId : 0,
    articleNumber: numero || undefined,
    reference: chaine(brut.reference ?? brut.law_title).trim(),
  };
  if (!citationBruteVerifiee(brut)) {
    return { ...reperes, title: '', excerpt: '', verifie: false };
  }
  return {
    ...reperes,
    title: sansRenvoisAuxExtraits(explicationDeCitation(brut)),
    excerpt: chaine(brut.excerpt ?? brut.extrait).trim(),
    url: adresseDuServeur(brut.url, reperes.lawId) ?? undefined,
    verifie: true,
    ...(brut.suite === true ? { suite: true } : {}),
  };
}

/**
 * Un renvoi à la numérotation INTERNE des extraits remis au modèle :
 * « (extrait 2) », « (extraits 5 et 9) », « [extrait 3] », « (cf. source 4) »,
 * « [2] ». L'essai réel du 30/10 en a publié cinq dans les points clés de
 * l'article sur le licenciement : la page montrait quatre cartes sans numéro,
 * le lecteur ne pouvait résoudre aucun de ces renvois, et « (extrait 9) »
 * passait pour une référence officielle. Le serveur les retire désormais de
 * la prose ; le front les retire aussi, pour tout article déjà enregistré.
 * Seule la prose est touchée, jamais l'extrait d'une citation, recopié mot
 * pour mot de la base.
 */
const RENVOI_A_UN_EXTRAIT =
  /[ \t\u00a0]*[([]\s*(?:(?:cf\.?|voir|voyez)\s+)?(?:l['’]\s*)?(?:les\s+)?(?:extraits?|sources?)\s*(?:n[°o]s?\s*)?\d+(?:\s*(?:,|;|et|ou|à|-|–|&)\s*(?:n[°o]\s*)?\d+)*\s*[)\]]/giu;
const RENVOI_NUMERIQUE = /[ \t\u00a0]*\[\s*\d{1,3}(?:\s*[,;–-]\s*\d{1,3})*\s*\]/g;

/** La prose sans renvoi aux extraits (« (extrait 2) »), ni espace laissée en tête. */
export function sansRenvoisAuxExtraits(texte: unknown): string {
  const brut = chaine(texte);
  const propre = brut.replace(RENVOI_A_UN_EXTRAIT, '').replace(RENVOI_NUMERIQUE, '');
  return propre === brut ? brut : propre.replace(/^[ \t]+/gm, '');
}

/** Une date lisible, ou '' (la page écrit alors « Récemment »). */
function dateDeLApi(valeur: unknown): string {
  const texte = chaine(valeur).trim();
  return texte && Number.isFinite(Date.parse(texte)) ? texte : '';
}

/**
 * Un article de l'API (forme de to_dict, camelCase ou snake_case) mis à la
 * forme des articles de la rédaction, ou `null` sans adresse ni titre.
 *
 * POURQUOI SI DÉFENSIF. Ni l'API d'origine ni le front ne vérifiaient la
 * forme de l'analyse écrite par le modèle : un point clé en objet faisait
 * planter la page (500), une citation `null` la faisait passer en 404. Tout
 * champ est lu comme du texte, toute liste filtrée. Une seule lecture pour la
 * liste, la page de l'article et l'aperçu de l'administration.
 */
export function articleDepuisLApi(brut: unknown): BlogPost | null {
  if (!estObjet(brut)) return null;
  const slug = chaine(brut.slug).trim();
  const titre = chaine(brut.title).trim();
  if (!slug || !titre) return null;

  const analyse: Objet = estObjet(brut.botAnalysis)
    ? brut.botAnalysis
    : estObjet(brut.bot_analysis)
      ? brut.bot_analysis
      : {};
  // La prose sans renvoi aux extraits (« (extrait 2) ») : voir
  // `sansRenvoisAuxExtraits`. Retirés ici, à la lecture, et non au seul
  // affichage : ces données partent aussi dans la description de la page et
  // dans le HTML du rendu serveur.
  const prose = (valeur: unknown) => sansRenvoisAuxExtraits(valeur).trim();
  const resume = prose(analyse.summary);
  const contexte = prose(brut.context);
  const date = dateDeLApi(brut.publishedAt ?? brut.published_at);
  const id = Number(brut.id);
  const citations = Array.isArray(analyse.citations)
    ? analyse.citations.map(citationDepuisLApi).filter((c): c is BlogCitation => c !== null)
    : [];

  return {
    ...(Number.isInteger(id) && id > 0 ? { id } : {}),
    slug,
    title: sansRenvoisAuxExtraits(titre).trim() || titre,
    // L'API n'a pas de champ « excerpt » : le résumé de l'analyse, à défaut
    // le début du contexte. La page n'affiche pas ce chapô quand il répète
    // l'un ou l'autre (`chapo`, blog/[slug]) ; il reste la description.
    excerpt: resume || (contexte ? `${contexte.slice(0, 160)}…` : ''),
    date,
    formattedDate: date
      ? new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
      : '',
    readingTime: chaine(brut.readingTime ?? brut.reading_time).trim() || '4 min',
    // Rubrique de repli : celle que l'interface sait traduire et illustrer
    // (`blog.rubrique.actualite-juridique`, icône du journal), plutôt qu'une
    // rubrique précise (« Affaires ») qui n'aurait rien à voir avec l'article.
    category: chaine(brut.category).trim() || 'Actualité juridique',
    author: { name: 'Rédaction Juridique & IA', role: 'Veille réglementaire' },
    context: contexte,
    botAnalysis: {
      summary: resume,
      keyPoints: listeDeTextes(analyse.keyPoints ?? analyse.key_points).map(prose).filter(Boolean),
      citations,
      citizenImpact: prose(analyse.citizenImpact ?? analyse.citizen_impact),
    },
    suggestedChatQuestion: prose(brut.suggestedQuestion ?? brut.suggested_question),
    tags: listeDeTextes(brut.tags),
    // Écrit par le modèle (`POST /blog/generate`) : étiquette « Généré par
    // IA » et titre en Inter (Q5). Relu par l'administrateur avant sa
    // publication, mais l'API ne nomme pas le relecteur (`reluPar`).
    genereParIA: true,
    publie: !(brut.isPublished === false || brut.is_published === false),
    // Les deux conditions du contrat du 30/10 que le front sait relire : l'état
    // du serveur (contrôle IA à jour, relecture complète, aucune phrase
    // contredite) et des citations toutes vérifiées. Un état absent n'est
    // jamais un accord : dans le doute, l'article n'est pas servi.
    publiable:
      etatDePublication(brut.etat_publication ?? brut.etatPublication) === 'publiable' &&
      citations.every((c) => c.verifie === true),
  };
}

/** Vrai si un article de l'API peut être servi au public : publié ET publiable. */
export function servableAuPublic(post: Pick<BlogPost, 'publie' | 'publiable'> | null | undefined): boolean {
  return post?.publie !== false && post?.publiable === true;
}

/**
 * Les articles PUBLIÉS ET PUBLIABLES d'une réponse de `GET /blog`, chacun une
 * seule fois (le premier d'une adresse l'emporte). Un brouillon, un article
 * publié avant la vérification ou tout article que le serveur ne dit pas
 * « publiable » est écarté, comme tout élément illisible : la route publique
 * du contrat ne les sert déjà plus, et une API qui en renverrait un par
 * erreur ne doit pas le rendre public.
 */
export function articlesDepuisLApi(brut: unknown): BlogPost[] {
  if (!Array.isArray(brut)) return [];
  const vus = new Set<string>();
  const articles: BlogPost[] = [];
  for (const element of brut) {
    const article = articleDepuisLApi(element);
    if (!article || !servableAuPublic(article) || vus.has(article.slug)) continue;
    vus.add(article.slug);
    articles.push(article);
  }
  return articles;
}

/** Le moment de publication, pour le tri ; 0 sans date lisible (en fin de liste). */
function horodatage(post: BlogPost): number {
  const t = Date.parse(post.date);
  return Number.isFinite(t) ? t : 0;
}

/**
 * La liste de /blog : les articles de l'API ET ceux de la rédaction, une
 * fois chacun, du plus récent au plus ancien.
 *
 * À adresse égale, celui de l'API l'emporte : c'est celui que la page de
 * l'article sert quand l'API répond (blog/[slug]/+page.server.ts), et un
 * administrateur peut avoir repris un article de la rédaction dans la base
 * pour le corriger. À date égale, l'API passe devant (tri stable).
 */
export function avecLesArticlesDeLaRedaction(articlesDeLApi: readonly BlogPost[]): BlogPost[] {
  const vus = new Set<string>();
  const tous: BlogPost[] = [];
  for (const post of [...articlesDeLApi, ...BLOG_POSTS]) {
    if (vus.has(post.slug)) continue;
    vus.add(post.slug);
    tous.push(post);
  }
  return tous.sort((a, b) => horodatage(b) - horodatage(a));
}

/* -------------------------------------------------------------------------- */
/* Texte affiché                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Le texte du modèle sans son Markdown résiduel, pour l'affichage.
 *
 * POURQUOI. Le modèle écrit en Markdown et la page affiche du texte brut
 * (aucun {@html}, règle du lint) : le run réel du 29/10 montrait des « ** »
 * dans le résumé, les points clés, les extraits, l'impact et l'aperçu de
 * l'administration. On retire ici les marques, pas le texte : gras et
 * italique (« **mot** », « *mot* »), titres en début de ligne (« ### »),
 * puces « * » (devenues « • »), et les « ** » orphelins d'une marque
 * coupée. Un astérisque seul (« article 5* ») reste : il peut avoir un sens.
 * Les cotes internes entre parenthèses (« (PRC-4722) ») partent aussi : le
 * lecteur ne peut rien en faire. Les retours à la ligne restent ; les blocs
 * qui peuvent en porter les affichent (`whitespace-pre-line`).
 *
 * Les champs de l'administration gardent le texte brut, Markdown compris :
 * c'est là qu'on le corrige.
 */
export function sansMarkdown(texte: unknown): string {
  return chaine(texte)
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
    .replace(/^([ \t]*)[*+][ \t]+(?=\S)/gm, '$1• ')
    .replace(/\*\*(?=\S)([^*\n]*?\S)\*\*/g, '$1')
    .replace(/(^|[^\p{L}\p{N}*])\*(?=[^\s*])([^*\n]*?[^\s*])\*(?![\p{L}\p{N}*])/gmu, '$1$2')
    .replace(/\*{2,}/g, '')
    .replace(COTE_ENTRE_PARENTHESES, '');
}

/**
 * Typographie française, posée à l'affichage. Les articles viennent de
 * l'API, et les chaînes de l'interface, avec des espaces ordinaires devant
 * « ? ! : ; », autour des guillemets et dans les nombres : le navigateur
 * coupait la ligne entre un mot et sa ponctuation (le « ? » d'un titre
 * tombait seul sur une ligne) ou au milieu d'un nombre (« 43 / 000 »).
 * L'espace fine insécable (U+202F) les soude. Seules les espaces déjà
 * présentes changent : une phrase anglaise (« dispute? ») reste telle
 * quelle. Les métadonnées (MetaSeo) gardent le texte d'origine.
 *
 * Une seule fonction pour /blog, l'article et l'aperçu de l'administration
 * (elle était recopiée dans les deux pages), et tolérante : une valeur qui
 * n'est pas du texte rend '' au lieu de planter le rendu.
 */
export function insecables(texte: unknown): string {
  return (
    chaine(texte)
      .replace(/[ \u00A0]+(?=[?!:;»])/g, '\u202F')
      .replace(/«[ \u00A0]+/g, '«\u202F')
      .replace(/(\d)[ \u00A0](?=\d{3}(?!\d))/g, '$1\u202F')
      // Inversion du sujet (« a-t-il », « peut-on ») : trait d'union
      // insécable (U+2011). Le navigateur coupait la ligne après « a- », et
      // « t-il » ouvrait la ligne suivante.
      .replace(/-t-(il|elle|on|ils|elles)(?![\p{L}])/gu, '\u2011t\u2011$1')
      .replace(/(\p{L})-(il|elle|on|ils|elles|je|tu|nous|vous)(?![\p{L}])/gu, '$1\u2011$2')
  );
}

/** Ce que la page affiche d'un texte de l'article : sans Markdown, typographie française. */
export function texteAffiche(texte: unknown): string {
  return insecables(sansMarkdown(texte));
}
