import { translations, type Language } from '$lib/stores/language';

export interface BlogCitation {
  lawId: number;
  articleNumber?: string;
  reference: string;
  title: string;
  excerpt: string;
}

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  formattedDate: string;
  readingTime: string;
  category: 'Immobilier' | 'Travail' | 'Numérique' | 'Affaires' | 'Famille';
  /**
   * Clé de traduction du badge de l'article à la une (`blog.badge.*`,
   * src/lib/stores/language.ts), affichée par `$tr`. Un libellé français
   * écrit ici (ou par les chargeurs de /blog) restait en français dans
   * l'interface anglaise.
   */
  badge: string;
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
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'litiges-locatifs-resiliation-bail-expulsion-abusive',
    title: 'Expulsions et hausses de loyer : ce que dit réellement la loi camerounaise',
    excerpt: 'Face aux augmentations unilatérales de loyers et aux expulsions sans préavis, quels sont vos droits exacts selon les textes en vigueur ?',
    date: '2026-10-24',
    formattedDate: '24 octobre 2026',
    readingTime: '4 min',
    category: 'Immobilier',
    badge: 'blog.badge.weekly',
    author: {
      name: 'Rédaction Juridique & IA',
      role: 'Veille réglementaire',
    },
    context:
      'Dans les grandes métropoles comme Douala et Yaoundé, de nombreux locataires font face à des hausses soudaines de loyer ou à des menaces d’expulsion immédiate. Beaucoup ignorent que la loi camerounaise et le droit communautaire encadrent strictement les conditions de rupture de bail et interdisent formellement l’expulsion forcée sans titre exécutoire de justice.',
    botAnalysis: {
      summary:
        'Un bailleur ne peut pas expulser un locataire de son propre chef, couper l’eau ou changer les serrures, même en cas d’impayé de loyer. La loi impose un préavis obligatoire d’au moins trois à six mois selon la nature du bail et exige obligatoirement une décision du juge des référés pour autoriser une expulsion.',
      keyPoints: [
        'Interdiction absolue de se faire justice soi-même : l’expulsion forcée extrajudiciaire est une infraction pénale (violation de domicile).',
        'Le préavis légal doit être notifié par acte d’huissier de justice ou lettre avec accusé de réception.',
        'La hausse du loyer en cours de bail n’est autorisée que si elle est prévue expressément par une clause d’indexation au contrat.',
        'En cas de litige, seule une décision judiciaire exécutoire permet l’intervention des forces de l’ordre.',
      ],
      citations: [
        {
          lawId: 2,
          articleNumber: '1736',
          reference: 'Code Civil applicable au Cameroun',
          title: 'Du contrat de louage des choses et des baux d’habitation',
          excerpt:
            'Si le bail a été fait sans écrit, l’une des parties ne pourra donner congé à l’autre qu’en observant les délais fixés par l’usage des lieux.',
        },
        {
          lawId: 1,
          articleNumber: '299',
          reference: 'Code Pénal camerounais (Loi n° 2016/007)',
          title: 'Violation de domicile et entrave à la jouissance paisible',
          excerpt:
            'Est puni d’un emprisonnement et d’une amende quiconque s’introduit dans le domicile d’autrui contre son gré ou s’y maintient sans droit.',
        },
      ],
      citizenImpact:
        'Si votre propriétaire exige votre départ sans préavis écrit de 3 mois ou tente de bloquer l’accès à votre logement, vous pouvez immédiatement saisir le procureur ou le juge des référés pour obtenir le maintien dans les lieux avec astreinte financière.',
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
    badge: 'blog.badge.labour',
    author: {
      name: 'Rédaction Juridique & IA',
      role: 'Veille droit social',
    },
    context:
      'Les restructurations d’entreprises et suppressions de postes suscitent de vives inquiétudes chez les salariés. Entre préavis non payé, calcul contesté des indemnités de licenciement et rupture abusive, les recours prévus par le Code du Travail camerounais sont méconnus mais très protecteurs.',
    botAnalysis: {
      summary:
        'Tout licenciement d’un travailleur sous contrat à durée indéterminée (CDI) doit être motivé par une cause légitime (faute lourde, inaptitude ou motif économique). À défaut, le licenciement est réputé abusif et ouvre droit à des dommages et intérêts en plus des indemnités de préavis et de licenciement.',
      keyPoints: [
        'L’indemnité de licenciement est due dès lors que le travailleur justifie de deux années consécutives dans l’entreprise.',
        'La durée du préavis varie selon la catégorie professionnelle et l’ancienneté (de 1 mois à 3 mois).',
        'Pendant la durée du préavis, le salarié a droit à un jour de liberté par semaine pour rechercher un nouvel emploi, avec plein salaire.',
        'L’employeur est tenu de remettre sans délai un certificat de travail et le reçu pour solde de tout compte.',
      ],
      citations: [
        {
          lawId: 14,
          articleNumber: '37',
          reference: 'Code du Travail camerounais (Loi n° 92/007)',
          title: 'De la résiliation du contrat à durée indéterminée',
          excerpt:
            'Tout licenciement abusif donne lieu à des dommages-intérêts fixés par le tribunal sans pouvoir être inférieurs à trois mois de salaire.',
        },
        {
          lawId: 14,
          articleNumber: '40',
          reference: 'Code du Travail camerounais (Loi n° 92/007)',
          title: 'Du préavis de rupture et des heures de recherche d’emploi',
          excerpt:
            'La rupture sans préavis ou sans que le délai de préavis ait été intégralement observé emporte l’obligation de verser une indemnité compensatrice.',
        },
      ],
      citizenImpact:
        'Avant de signer un solde de tout compte, exigez le décompte écrit détaillé. La mention « sous réserve de mes droits » vous permet de contester les montants devant l’Inspection du Travail dans un délai de 6 mois.',
    },
    suggestedChatQuestion:
      'Comment calculer l’indemnité de licenciement et le préavis pour un salarié ayant 4 ans d’ancienneté ?',
    tags: ['Licenciement', 'Travail', 'Indemnités', 'Préavis', 'Salaires'],
  },
  {
    slug: 'arnaques-mobile-money-e-commerce-recours-legaux',
    title: 'Arnaques Mobile Money & Achats en ligne : les recours légaux au Cameroun',
    excerpt: 'Faux transferts, comptes piratés, produits jamais livrés : comment la loi sur la cybercriminalité vous protège et comment porter plainte.',
    date: '2026-10-10',
    formattedDate: '10 octobre 2026',
    readingTime: '4 min',
    category: 'Numérique',
    badge: 'blog.badge.cybercrime',
    author: {
      name: 'Rédaction Juridique & IA',
      role: 'Technologies & Droit',
    },
    context:
      'Avec la montée en puissance des commerces sur WhatsApp et Facebook et la généralisation des paiements mobiles, les escroqueries numériques explosent. Beaucoup de victimes pensent qu’Internet est une zone de non-droit où il est impossible d’obtenir réparation.',
    botAnalysis: {
      summary:
        'La loi camerounaise sur la cybersécurité et la cybercriminalité assimile les fraudes électroniques et usurpations d’identité à des délits graves punis de peines de prison ferme et d’amendes substantielles. Les opérateurs télécoms ont par ailleurs l’obligation légale d’identifier les titulaires de cartes SIM.',
      keyPoints: [
        'L’escroquerie par moyen électronique est punie de peines pouvant aller jusqu’à 5 à 10 ans de prison ferme.',
        'La capture d’écran et les relevés de transaction électronique constituent des preuves légales recevables devant les juridictions.',
        'L’ANTIC (Agence Nationale des TIC) et la Division spéciale de la police judiciaire disposent de cellules dédiées au traçage des numéros fraudeurs.',
        'En cas d’erreur de transfert de bonne foi, le refus de restituer les fonds constitue un abus de confiance ou une rétention indue.',
      ],
      citations: [
        {
          lawId: 18,
          articleNumber: '74',
          reference: 'Loi n° 2010/012 relative à la cybersécurité et la cybercriminalité',
          title: 'Des infractions commises par voie de communications électroniques',
          excerpt:
            'Est puni d’un emprisonnement de deux à cinq ans et d’une amende quiconque, au moyen d’un procédé électronique, trompe une personne pour se faire remettre des fonds.',
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
