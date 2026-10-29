import { estUneCoteInterne } from '$lib/sources';
import { translations, type Language } from '$lib/stores/language';

export interface BlogCitation {
  lawId: number;
  articleNumber?: string;
  /**
   * Le texte cité, tel qu'on le nomme (« Code pénal (loi n° 2016/007) »).
   * Pour un article de l'API, c'est souvent la COTE INTERNE du texte
   * (`law.reference`, « PRC-4722 », que le générateur recopie : backend
   * app/services/blog_generator_service.py) : `referenceAffichable` l'écarte.
   */
  reference: string;
  title: string;
  excerpt: string;
  /**
   * L'extrait a été relevé MOT POUR MOT dans la base (articles statiques
   * seulement) : il s'affiche entre guillemets, dans la police du texte
   * officiel (Q5). Absent pour un article de l'API, dont le modèle écrit
   * lui-même l'extrait : il reste en Inter, comme tout ce que l'IA rédige.
   */
  verifie?: boolean;
}

export interface BlogPost {
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
   * (`genereParIA`).
   */
  category: 'Immobilier' | 'Travail' | 'Numérique' | 'Affaires' | 'Famille';
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
}

/*
 * Articles servis quand l'API n'en a aucun.
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
 * Le nom du texte cité, à afficher, ou `null`. Le générateur d'articles
 * remplit `reference` avec `law.reference`, la cote interne, pour la plupart
 * des textes (backend app/services/blog_generator_service.py) : un article de
 * l'API aurait montré « PRC-4722 » dans chacune de ses citations. La cote est
 * écartée ; un nom écrit par le modèle ou la rédaction reste.
 */
export function referenceAffichable(citation: Pick<BlogCitation, 'reference'>): string | null {
  const reference = (citation.reference ?? '').trim();
  return reference && !estUneCoteInterne(reference) ? reference : null;
}

/**
 * Le numéro d'article cité, ou `null`. Le générateur écrit « ? » quand la
 * recherche ne lui en donne pas : ce n'est pas un numéro.
 */
export function articleDeCitation(citation: Pick<BlogCitation, 'articleNumber'>): string | null {
  const numero = String(citation.articleNumber ?? '').trim();
  return /\d/.test(numero) ? numero : null;
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
