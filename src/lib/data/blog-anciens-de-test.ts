/**
 * Données de TEST : un article du blog publié AVANT le contrat du 29/10, tel
 * que l'API le sert.
 *
 * C'est la ligne 1 de jurix_dev (créée le 26/10, publiée, citations jamais
 * vérifiées), lue en lecture seule par la revue croisée du 29/10 et passée
 * au `to_dict` du modèle de l'API (data/blog/revue-croisee/api/ligne1.to_dict.json,
 * dépôt du backend). Ses extraits ont été ÉCRITS PAR LE MODÈLE : celui de
 * l'article 299 du Code pénal dit « trois mois à trois ans », quand le texte
 * en base dit « dix (10) jours à un (01) an ». Ses deux citations visent le
 * texte 1, la valeur par défaut de l'ancien générateur.
 *
 * Aucun import : la spec Playwright du blog le lit aussi.
 */

/** La ligne 1 telle que la rendait l'API du 29/10 : `verifie: false`, extraits compris. */
export const ARTICLE_ANCIEN = {
  id: 1,
  slug: 'expulsion-locative-loi-cameroun',
  title: "Litige Bailleur-Locataire : Votre propriétaire a-t-il le droit de couper l'eau ou le courant ?",
  category: 'Immobilier & Logement',
  publishedAt: '2026-10-26',
  readingTime: '3 min',
  context:
    "Face à des loyers impayés, de plus en plus de propriétaires au Cameroun coupent l'accès à l'eau, à l'électricité, ou cadenassent les portes des locataires pour les forcer à quitter les lieux. Ces pratiques très courantes suscitent de vifs débats sur leur légalité.",
  botAnalysis: {
    summary:
      'En droit camerounais, la justice privée et les voies de fait sont strictement interdites. Même en cas de non-paiement prolongé de loyer, un bailleur ne peut en aucun cas se faire justice lui-même en coupant l\'eau, le courant ou en barricadant un logement.',
    keyPoints: [
      "Le bailleur a l'obligation légale de délivrer un logement décent et d'en assurer la jouissance paisible.",
      'La coupure d\'eau, d\'électricité ou le changement de serrure constitue une « voie de fait » et une violation de domicile réprimée pénalement.',
    ],
    citations: [
      {
        title: 'Obligations principales du bailleur',
        law_id: 1,
        excerpt:
          "Le bailleur est obligé, par la nature du contrat, et sans qu'il soit besoin d'aucune stipulation particulière : 1° De délivrer au preneur la chose louée ; 2° D'entretenir cette chose en état de servir pour l'usage pour lequel elle a été louée ; 3° D'en faire jouir paisiblement le preneur pendant la durée du bail.",
        reference: 'Code Civil / Droit des obligations',
        article_number: '1719',
        verifie: false,
      },
      {
        title: 'Violation de domicile et entrave à la jouissance',
        law_id: 1,
        excerpt:
          "Est puni d'un emprisonnement de trois mois à trois ans et d'une amende quiconque s'introduit ou se maintient dans le domicile d'autrui contre son gré, ou porte atteinte à sa jouissance par voies de fait.",
        reference: 'Loi portant Code Pénal camerounais',
        article_number: '299',
        verifie: false,
      },
    ],
    citizenImpact:
      "Si votre propriétaire vous coupe l'eau ou le courant, vous êtes en droit de porter plainte pour voie de fait et d'obtenir le rétablissement immédiat en urgence (référé), même si vous devez des arriérés de loyer.",
  },
  suggestedQuestion:
    "Mon bailleur me menace d'expulsion et veut couper le courant pour 2 mois d'impayés au Cameroun. Quels sont mes recours légaux exacts ?",
  tags: ['bail', 'locataire', 'loyer', 'expulsion', 'immobilier'],
  isPublished: true,
};

/**
 * La même ligne servie par une route PUBLIQUE du contrat du 30/10 : une
 * citation non vérifiée n'y porte ni `excerpt` ni `url`.
 */
export const ARTICLE_ANCIEN_PUBLIC = {
  ...ARTICLE_ANCIEN,
  botAnalysis: {
    ...ARTICLE_ANCIEN.botAnalysis,
    citations: ARTICLE_ANCIEN.botAnalysis.citations.map(({ law_id, reference, article_number, verifie }) => ({
      law_id,
      reference,
      article_number,
      verifie,
    })),
  },
};

/** Ce que le modèle a écrit dans ses citations, et qu'aucune page ne doit montrer. */
export const ECRIT_PAR_LE_MODELE = [
  'trois mois à trois ans',
  'Le bailleur est obligé',
  'Obligations principales du bailleur',
  'entrave à la jouissance',
] as const;
