import { describe, expect, it } from 'vitest';
import { _ordreProvisoire, nomCategorie, ordonnerLesDomaines } from '$lib/categories';
import { nomCourtDuDomaine, ORDRE_DES_DOMAINES } from './domaines';
import {
  cleSelonNombre,
  dateDesReperes,
  intituleDuTexte,
  natureEtNumero,
  nomDuCode,
  numeroAffiche,
  reperesDuTexte,
  SEPARATEUR,
  titreDecoupe,
  type TexteRepere,
} from './reperes';

/**
 * Les repères d'une ligne de liste ou de recherche (P7, P11), sur des données
 * RÉELLES : les exemples de data/ux-impl/contrat-api.md (§5.2, §6.2) et les
 * lignes de l'ancienne API (data/ux-recherche/maquettes/donnees).
 */

const TEXTES: Record<string, string> = {
  'badge.law': 'Loi',
  'badge.decree': 'Décret',
  'badge.ordinance': 'Ordonnance',
  'badge.arrete': 'Arrêté',
  'badge.text': 'Texte',
  'badge.constitution': 'Constitution',
  'listes.nature.acteUniforme': 'Acte uniforme OHADA',
  'listes.numero': 'n°\u00a0{n}',
  'listes.dateJo': 'JO du {date}',
  'listes.articles.one': '{n}\u00a0article',
  'listes.articles.other': '{n}\u00a0articles',
};
const traduire = (cle: string) => TEXTES[cle] ?? cle;
const NBSP = '\u00a0';

/** Nouvelle API, GET /laws/?category_id=13&page=2 (contrat §5.2). */
const DECRET: TexteRepere = {
  title:
    "Décret N°2026/285 du 31 août 2026 portant nomination des Officiers Magistrats chargés de l'Action publique devant les Chambres Militaires des Cours d'Appel",
  type: 'décret',
  publication_date: '2026-08-31',
  article_count: 3,
  category_name: 'Fonction Publique',
  objet: "Nomination des Officiers Magistrats chargés de l'Action publique devant les Chambres Militaires des Cours d'Appel",
  numero: '2026/285',
  date_signature: '2026-08-31',
  annee: 2026,
  date_publication_jo: null,
  statut: null,
};

/** Nouvelle API, résultat de recherche (contrat §6.2) : le Code civil, sans numéro ni date. */
const CODE_CIVIL: TexteRepere = {
  title: 'Code civil applicable au Cameroun, annoté de la jurisprudence de la Cour suprême',
  type: 'autre',
  publication_date: null,
  category_name: 'Droit Civil et Procédure Civile',
  objet: null,
  numero: null,
  date_signature: null,
  annee: null,
  date_publication_jo: null,
};

/** Ancienne API : aucun repère, la ligne d'avant (data/ux-recherche/maquettes/donnees/textes-tous.json). */
const ANCIENNE: TexteRepere = {
  title: "Décret N°2018/763 du 10 décembre 2018 portant révocation d'un Magistrat.",
  type: 'décret',
  publication_date: '2018-12-10',
  article_count: 4,
};

describe('natureEtNumero', () => {
  it('nature et numéro de l’API', () => {
    expect(natureEtNumero(DECRET, traduire)).toBe(`Décret n°${NBSP}2026/285`);
  });

  it('le nom court d’un code sans numéro', () => {
    expect(natureEtNumero(CODE_CIVIL, traduire)).toBe('Code civil');
    expect(nomDuCode('Code des assurances des États membres de la CIMA, édition 2019, et Traité instituant…')).toBe(
      'Code des assurances CIMA',
    );
  });

  it('un « code » trop long pour un repère garde sa nature', () => {
    const titre =
      'Code de conduite relatif à la prévention et à la répression des actes de piraterie, des vols à main armée';
    expect(nomDuCode(titre)).toBeNull();
    expect(natureEtNumero({ title: titre, type: 'autre', numero: null }, traduire)).toBe('Texte');
  });

  it('un acte uniforme se nomme « Acte uniforme OHADA »', () => {
    const acte: TexteRepere = { title: 'Acte uniforme relatif à la médiation du 23 novembre 2017', type: 'acte uniforme', numero: null };
    expect(natureEtNumero(acte, traduire)).toBe('Acte uniforme OHADA');
  });

  it('les sigles du numéro en capitales : un même cabinet, une même casse d’une ligne à l’autre', () => {
    // GET /laws/?category_id=13 : « 0600/cab/pr » au premier lot, « 0525/CAB/PR » au deuxième.
    const arrete: TexteRepere = { title: 'Arrêté N°0600/cab/pr du 3 octobre 2025', type: 'arrêté', numero: '0600/cab/pr' };
    expect(natureEtNumero(arrete, traduire)).toBe(`Arrêté n°${NBSP}0600/CAB/PR`);
    expect(natureEtNumero({ ...arrete, numero: '0525/CAB/PR' }, traduire)).toBe(`Arrêté n°${NBSP}0525/CAB/PR`);
  });

  it('numeroAffiche : seuls les segments de lettres sont des sigles', () => {
    expect(numeroAffiche('0593/cab/pr')).toBe('0593/CAB/PR');
    expect(numeroAffiche('00029/dgsn/Sg/DRH')).toBe('00029/DGSN/SG/DRH');
    expect(numeroAffiche('67-lf-7')).toBe('67-LF-7');
    // Déjà justes, ou sans lettre : inchangés.
    for (const numero of ['2018/9387/CAB/PM', '00000127/MINFI/MINCOMMERCE', '92/007', '2026/285']) {
      expect(numeroAffiche(numero)).toBe(numero);
    }
    // Un adverbe de rang n'est pas un sigle ; un segment mêlé de chiffres n'est pas touché.
    expect(numeroAffiche('2003/006/bis')).toBe('2003/006/bis');
    expect(numeroAffiche('2003/006bis')).toBe('2003/006bis');
  });

  it('ancienne API : la nature seule, jamais un numéro deviné dans l’intitulé', () => {
    // L'intitulé d'un texte qui en MODIFIE un autre cite le numéro de l'autre :
    // le lire ici donnerait à la loi 2021/022 le numéro 90/053.
    expect(natureEtNumero(ANCIENNE, traduire)).toBe('Décret');
    const modificatif: TexteRepere = {
      title: 'Loi portant modification de certaines dispositions de la loi n° 90/053 du 19 décembre 1990',
      type: 'loi',
    };
    expect(natureEtNumero(modificatif, traduire)).toBe('Loi');
  });
});

describe('dateDesReperes', () => {
  it('la date de signature, en forme courte et insécable', () => {
    expect(dateDesReperes(DECRET, 'fr', traduire)).toBe(`31${NBSP}août${NBSP}2026`);
    expect(dateDesReperes({ ...DECRET, date_signature: '1994-10-07' }, 'fr', traduire)).toBe(`7${NBSP}oct.${NBSP}1994`);
  });

  it('« JO du … » quand seul le Journal officiel date le texte', () => {
    const acte: TexteRepere = {
      title: "Acte uniforme relatif au système comptable des entités à but non lucratif, publié au Journal officiel de l'OHADA",
      type: 'acte uniforme',
      date_signature: null,
      annee: 2023,
      date_publication_jo: '2023-02-22',
    };
    expect(dateDesReperes(acte, 'fr', traduire)).toBe(`JO du 22${NBSP}févr.${NBSP}2023`);
  });

  it('l’année seule quand le jour n’est pas sûr, rien sans date', () => {
    expect(dateDesReperes({ ...CODE_CIVIL, annee: 1992 }, 'fr', traduire)).toBe('1992');
    expect(dateDesReperes(CODE_CIVIL, 'fr', traduire)).toBeNull();
  });

  it('ancienne API : publication_date, sauf un 1er janvier de remplissage', () => {
    expect(dateDesReperes(ANCIENNE, 'fr', traduire)).toBe(`10${NBSP}déc.${NBSP}2018`);
    expect(dateDesReperes({ title: 'Loi de 1967', type: 'loi', publication_date: '1967-01-01' }, 'fr', traduire)).toBe(
      '1967',
    );
  });
});

describe('reperesDuTexte', () => {
  it('liste de textes : nature et numéro, date, nombre d’articles (P11)', () => {
    expect(reperesDuTexte(DECRET, { langue: 'fr', traduire, suite: 'articles' })).toBe(
      [`Décret n°${NBSP}2026/285`, `31${NBSP}août${NBSP}2026`, `3${NBSP}articles`].join(SEPARATEUR),
    );
  });

  it('recherche : le domaine, sous le nom que lui donne tout le site (P7)', () => {
    expect(reperesDuTexte(CODE_CIVIL, { langue: 'fr', traduire, suite: 'domaine' })).toBe(
      ['Code civil', nomCategorie('Droit Civil et Procédure Civile', 'fr')].join(SEPARATEUR),
    );
  });

  it('un article au singulier, aucun pour zéro (extraction en échec)', () => {
    expect(reperesDuTexte({ ...ANCIENNE, article_count: 1 }, { langue: 'fr', traduire, suite: 'articles' })).toMatch(
      /1\u00a0article$/,
    );
    expect(reperesDuTexte({ ...ANCIENNE, article_count: 0 }, { langue: 'fr', traduire, suite: 'articles' })).toBe(
      ['Décret', `10${NBSP}déc.${NBSP}2018`].join(SEPARATEUR),
    );
  });

  it('le point de séparation ne commence jamais une ligne', () => {
    expect(SEPARATEUR.startsWith('\u00a0')).toBe(true);
  });
});

describe('intitulé affiché', () => {
  it('l’objet en clair, sinon l’intitulé officiel entier', () => {
    expect(intituleDuTexte(DECRET)).toBe(DECRET.objet);
    expect(intituleDuTexte(CODE_CIVIL)).toBe(CODE_CIVIL.title);
    expect(intituleDuTexte(ANCIENNE)).toBe(ANCIENNE.title);
    expect(intituleDuTexte({ ...DECRET, objet: '   ' })).toBe(DECRET.title);
  });

  it('signale l’objet découpé, pour compléter le nom du lien', () => {
    expect(titreDecoupe(DECRET)).toBe(true);
    expect(titreDecoupe(CODE_CIVIL)).toBe(false);
    expect(titreDecoupe(ANCIENNE)).toBe(false);
  });
});

describe('domaines (Q2)', () => {
  it('la colonne de filtres range les domaines dans l’ordre de l’accueil (Q2 A)', () => {
    // Un domaine au même rang sur l'accueil et dans la colonne de /search.
    expect([...ORDRE_DES_DOMAINES]).toEqual([..._ordreProvisoire()]);
    const accueil = ordonnerLesDomaines([...ORDRE_DES_DOMAINES].reverse().map((name) => ({ name })));
    expect(accueil.map(({ name }) => name)).toEqual([...ORDRE_DES_DOMAINES]);
  });

  it('le nom de $lib/categories, le même partout sur le site, dans les deux langues', () => {
    for (const langue of ['fr', 'en'] as const) {
      expect(nomCourtDuDomaine('Droit du Travail et Sécurité Sociale', langue)).toBe(
        nomCategorie('Droit du Travail et Sécurité Sociale', langue),
      );
    }
  });

  it('un domaine inconnu garde son nom, et rien sans nom', () => {
    expect(nomCourtDuDomaine('Droit spatial', 'fr')).toBe('Droit spatial');
    expect(nomCourtDuDomaine(null, 'fr')).toBe('');
  });
});

describe('cleSelonNombre', () => {
  it('0 et 1 au singulier en français, 1 seulement en anglais', () => {
    expect(cleSelonNombre('x', 0, 'fr')).toBe('x.one');
    expect(cleSelonNombre('x', 1, 'fr')).toBe('x.one');
    expect(cleSelonNombre('x', 2, 'fr')).toBe('x.other');
    expect(cleSelonNombre('x', 0, 'en')).toBe('x.other');
    expect(cleSelonNombre('x', 1, 'en')).toBe('x.one');
  });
});
