import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';

const { apercuDeLArticle, copierDansLePressePapiers } = vi.hoisted(() => ({
  apercuDeLArticle: vi.fn(),
  copierDansLePressePapiers: vi.fn(),
}));

vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('$lib/stores/language', async () => {
  const { readable, writable } = await import('svelte/store');
  const { traduireEnTest } = await import('./traductions-de-test');
  return { tr: readable(traduireEnTest), language: writable({ current: 'fr' }), switchLanguage: () => {} };
});
vi.mock('./apercus', () => ({ apercuDeLArticle }));
vi.mock('$lib/components/loi/presse-papiers', () => ({ copierDansLePressePapiers }));

import type { ArticleApercu, TexteLie } from '$lib/types';
import type { CarteDeLaReponse } from './passages';
import CarteArticleCite from './CarteArticleCite.svelte';

const LOI_2026_002: TexteLie = {
  id: 1761,
  reference: 'PRC-10679',
  nature: 'loi',
  numero: '2026/002',
  titre: 'Loi N°2026/002 du 14 avril 2026 modifiant et complétant certaines dispositions de la Constitution',
  date_signature: '2026-04-14',
  annee: 2026,
  date_publication_jo: null,
  consultable: true,
};

/** D'après `GET /laws/2143/articles/6` (notes/api/exemples/apercu-2143-6.json), raccourci. */
const ARTICLE_6: ArticleApercu = {
  law_id: 2143,
  texte: {
    id: 2143,
    reference: 'PRC-6283',
    nature: 'loi',
    numero: '96/06',
    titre: 'Loi N°96/06 du 18 janvier 1996 portant révision de la Constitution du 02 juin 1972.',
    date_signature: '1996-01-18',
    annee: 1996,
    date_publication_jo: null,
    consultable: true,
  },
  numero: '6',
  titre: null,
  section: "TITRE PREMIER DE L'ÉTAT ET DE LA SOUVERAINETÉ",
  page: 8,
  article_ids: [75144, 75145],
  contenu:
    "(1) Le Président de la République est élu au suffrage universel direct, égal et secret, à la majorité des suffrages exprimés.\n<<PAGE:9>>(2) Le Président de la République est élu pour un mandat de sept (7) ans renouvelable une fois.\n(3) L'élection a lieu vingt (20) jours au moins et cinquante (50) jours au plus avant l'expiration des pouvoirs du Président de la République en exercice.",
  tronque: false,
  englobant: false,
  homonymes: [],
  statut: {
    releve_le: '2026-10-14',
    etat_du_texte: 'modifie',
    version_en_base: null,
    changements: [
      {
        id: 'c3',
        sens: 'modifie_par',
        type: 'modifie',
        nature_modification: 'modifie',
        libelle: 'modifié',
        texte: { ...LOI_2026_002, numero: '2008/001', date_signature: '2008-04-14' },
        etendue: 'articles',
        articles_cibles: ['6', '53'],
        section: null,
        articles_source: [],
        portee: null,
        depasse: true,
        depasse_par: LOI_2026_002,
        integre_au_texte: false,
      },
      {
        id: 'c4',
        sens: 'modifie_par',
        type: 'modifie',
        nature_modification: 'reecrit_en_entier',
        libelle: 'réécrit en entier',
        texte: LOI_2026_002,
        etendue: 'articles',
        articles_cibles: ['6'],
        section: null,
        articles_source: ['6'],
        portee: null,
        depasse: false,
        depasse_par: null,
        integre_au_texte: false,
      },
    ],
  },
};

const CARTE: CarteDeLaReponse = {
  lawId: 2143,
  numero: '6',
  articleId: 75144,
  titre: 'Loi N°96/06 du 18 janvier 1996 portant révision de la Constitution du 02 juin 1972.',
  reference: 'PRC-6283',
  statut: { etat: 'modifie', liens: [], lignes: [] },
  citations: [{ indexCitation: 0, phrase: "Le mandat présidentiel dure sept ans et n'est renouvelable qu'une fois ( )" }],
};

const ouvrir = (carte: CarteDeLaReponse, autres: Record<string, unknown> = {}) =>
  render(CarteArticleCite, { props: { carte, idCarte: 'carte-1', ouverte: true, surBasculer: vi.fn(), ...autres } });

describe('CarteArticleCite : le contenu de l’article (migré d’ApercuDeCitation)', () => {
  beforeEach(() => apercuDeLArticle.mockReset());
  afterEach(() => cleanup());

  it('le texte entier de l’article, le passage cité dans un <mark>, le statut de l’article', async () => {
    apercuDeLArticle.mockResolvedValue(ARTICLE_6);
    const { getByTestId, findByTestId } = ouvrir(CARTE, { citationActive: 0 });

    const texte = await findByTestId('chat-preview-text');
    expect(apercuDeLArticle).toHaveBeenCalledWith(2143, '6', 75144, expect.any(AbortSignal));
    // Marqueur de page retiré, langue du texte posée.
    expect(texte.textContent).not.toContain('<<PAGE');
    expect(texte.getAttribute('lang')).toBe('fr');
    expect(texte.className).toContain('font-texte');
    const marque = texte.querySelector('mark');
    expect(marque?.textContent).toBe('Le Président de la République est élu pour un mandat de sept (7) ans renouvelable une fois');
    expect(getByTestId('chat-carte-legende').textContent).toContain('Souligné');

    const statut = getByTestId('chat-preview-status').textContent ?? '';
    expect(statut).toContain('Loi n°\u00A096/06 du 18 janvier 1996 portant révision');
    expect(statut).toContain('Article modifié par la loi n°\u00A02026/002 du 14 avril 2026 : réécrit en entier.');
    expect(statut).toContain('Texte affiché : version d’origine, non consolidée.');
    // Le changement dépassé (2008/001) n'est pas présenté comme actuel.
    expect(statut).not.toContain('2008/001');
    expect(statut).not.toMatch(/vigueur/i);

    const lien = getByTestId('chat-preview-full');
    expect(lien.getAttribute('href')).toBe('/laws/2143?article=6');
    expect(lien.getAttribute('target')).toBe('_blank');
    expect(lien.textContent).toContain('Lire dans le texte intégral');
  });

  it('aperçu introuvable (ancienne API, 404) : le dire, garder le texte intégral', async () => {
    apercuDeLArticle.mockResolvedValue(null);
    const { findByTestId, getByTestId } = ouvrir(CARTE);

    expect((await findByTestId('chat-preview-unavailable')).textContent).toContain('n’est pas disponible');
    expect(getByTestId('chat-preview-full').getAttribute('href')).toBe('/laws/2143?article=6');
    // Le statut de la citation reste affiché, sans rien inventer.
    expect(getByTestId('chat-preview-status').textContent).toContain('Modifié.');
  });

  it('un texte cité sans article : aucun appel, son statut et le texte intégral', () => {
    const { getByTestId, queryByTestId } = ouvrir(
      { ...CARTE, numero: null, articleId: null, lawId: 2274, titre: 'Code du travail', statut: { etat: null, liens: [], lignes: [] } },
      { releveLe: '2026-10-14' },
    );

    expect(apercuDeLArticle).not.toHaveBeenCalled();
    expect(getByTestId('chat-preview-status').textContent).toContain(
      'Aucune modification relevée par JuriX au 14 oct. 2026.',
    );
    expect(queryByTestId('chat-preview-text')).toBeNull();
    expect(getByTestId('chat-preview-full').getAttribute('href')).toBe('/laws/2274');
    expect(getByTestId('chat-preview-full').textContent).toContain('Lire le texte intégral');
  });
});

/**
 * D'après `GET /laws/2274/articles/35?article_id=97421` (worktree feat/ux-api,
 * base locale du 29/10/2026), raccourci : le morceau « 35 » du Code du travail
 * porte les articles 35 à 38, et l'API ne le dit pas « englobant ».
 */
const ARTICLE_35_COLLE: ArticleApercu = {
  ...ARTICLE_6,
  law_id: 2274,
  texte: { ...ARTICLE_6.texte, id: 2274, numero: '92/007', titre: 'Loi N°92/007 du 14 août 1992 portant Code du travail' },
  numero: '35',
  section: 'Section III: De la suspension et de la résiliation du contrat de travail',
  article_ids: [97420, 97421],
  contenu:
    "(1) Pendant la durée du préavis, l'employeur et le travailleur sont tenus au respect de toutes les obligations réciproques qui leur incombent. (3) La partie à l'égard de laquelle ces obligations ne seraient pas respectées ne pourra se voir imposer un délai de préavis, sans préjudice des dommages-intérêts qu'elle jugerait bon de demander. Article 36.- (1) Toute rupture de contrat à durée indéterminée, sans préavis, emporte obligation pour la partie responsable de verser à lu se e e o n u ne out,l nature dont aurait bénéficié le travailleur. Article 37.- (1) En cas de rupture de contrat à durée indéterminée du fait de l'employeur, hormis le cas de faute lourde, le travailleur ayant accompli dans l'entreprise une durée de service continue au moins égale à deux (2) ans, a droit à une indemnité de licenciement distincte de celle du préavis. Article 38.- Le contrat de travail à durée déterminée ne peut cesser avant terme qu'en cas de faute lourde.",
  statut: { releve_le: '2026-10-14', etat_du_texte: 'aucune_modification_connue', version_en_base: null, changements: [] },
};

const CARTE_35: CarteDeLaReponse = {
  lawId: 2274,
  numero: '35',
  articleId: 97421,
  titre: 'Loi N°92/007 du 14 août 1992 portant Code du travail',
  reference: 'LOI-1992-007',
  statut: { etat: null, liens: [], lignes: [] },
  citations: [
    { indexCitation: 0, phrase: "Réponse directe : selon , l'indemnité de licenciement est due après deux ans de service continu" },
  ],
};

describe('CarteArticleCite : l’article cité, et lui seul', () => {
  beforeEach(() => apercuDeLArticle.mockReset());
  afterEach(() => cleanup());

  it('s’arrête avant l’article suivant que la base a collé au sien, et le dit', async () => {
    apercuDeLArticle.mockResolvedValue(ARTICLE_35_COLLE);
    const { findByTestId, getByTestId, queryByTestId } = ouvrir(CARTE_35, { citationActive: 0 });

    const texte = await findByTestId('chat-preview-text');
    expect(texte.textContent).toContain("qu'elle jugerait bon de demander.");
    expect(texte.textContent).not.toContain('Article 36');
    expect(texte.textContent).not.toContain('Article 37');
    // Le passage de l'article 37 n'est plus souligné sous le titre « Art. 35 »,
    // et la légende ne promet aucun souligné.
    expect(texte.querySelector('mark')).toBeNull();
    expect(queryByTestId('chat-preview-englobant')).toBeNull();
    expect(queryByTestId('chat-carte-legende')).toBeNull();
    expect(getByTestId('chat-preview-cut').textContent).toContain(
      'L’aperçu s’arrête avant l’article 36, que JuriX a enregistré avec celui-ci.',
    );
    // Le bruit de numérisation était dans l'article 36 : coupé avec lui.
    expect(queryByTestId('chat-preview-ocr')).toBeNull();
  });

  it('un paragraphe par alinéa, à la mesure de lecture de 34em (feuille de tablette)', async () => {
    apercuDeLArticle.mockResolvedValue(ARTICLE_35_COLLE);
    const { findByTestId } = ouvrir(CARTE_35);

    const texte = await findByTestId('chat-preview-text');
    // La base garde l'article sur une ligne : « … incombent. (3) La partie … ».
    const alineas = Array.from(texte.querySelectorAll('p')).map((p) => p.textContent ?? '');
    expect(alineas).toHaveLength(2);
    expect(alineas[0].startsWith('(1) Pendant la durée du préavis')).toBe(true);
    expect(alineas[0].endsWith('qui leur incombent.')).toBe(true);
    expect(alineas[1].startsWith('(3) La partie à l')).toBe(true);
    // 34em : environ 70 caractères par ligne, et non 85 à 90 sur 672 px.
    expect(texte.className).toContain('max-w-[34em]');
  });

  it('écran court : l’intitulé et le statut se suivent, séparés par un point médian masqué ailleurs', async () => {
    apercuDeLArticle.mockResolvedValue(ARTICLE_35_COLLE);
    const { findByTestId, getByTestId } = ouvrir(CARTE_35);
    await findByTestId('chat-preview-text');

    const separateur = getByTestId('chat-preview-status').querySelector('[aria-hidden="true"]');
    expect(separateur?.textContent).toBe(' · ');
    expect(separateur?.className).toContain('hidden');
    expect(separateur?.className).toContain('court:inline');
  });

  it('intitulé de section à la française : une espace insécable devant le deux-points', async () => {
    apercuDeLArticle.mockResolvedValue(ARTICLE_35_COLLE);
    const { findByTestId, container } = ouvrir(CARTE_35);
    await findByTestId('chat-preview-text');

    const section = Array.from(container.querySelectorAll('p')).find((p) => p.textContent?.startsWith('Section III'));
    expect(section?.textContent).toBe(`Section III${String.fromCharCode(0xa0)}: De la suspension et de la résiliation du contrat de travail`);
  });

  it('un passage mal lu à la numérisation est signalé, sans rien retirer du texte', async () => {
    apercuDeLArticle.mockResolvedValue({
      ...ARTICLE_35_COLLE,
      numero: '36',
      contenu: '(1) Toute rupture de contrat emporte obligation pour la partie responsable de verser à lu se e e o n u ne out,l nature dont aurait bénéficié le travailleur.',
    });
    const { findByTestId, getByTestId } = ouvrir({ ...CARTE_35, numero: '36' });

    expect((await findByTestId('chat-preview-text')).textContent).toContain('lu se e e o n u ne');
    expect(getByTestId('chat-preview-ocr').textContent).toContain('mal lus à la numérisation');
    expect(getByTestId('chat-preview-ocr').className).not.toMatch(/red-/);
  });

  it('un passage englobant, recadré sur l’en-tête de l’article, le dit autrement', async () => {
    apercuDeLArticle.mockResolvedValue({
      ...ARTICLE_35_COLLE,
      numero: '5',
      section: null,
      englobant: true,
      contenu: 'Fin du texte de l’article 2. Art..5- (1) Le texte de l’article 5. ARTICLE 6.- Le texte de l’article 6.',
    });
    const { findByTestId, getByTestId, queryByTestId } = ouvrir({ ...CARTE_35, numero: '5' });

    expect((await findByTestId('chat-preview-text')).textContent?.trim()).toBe('Art..5- (1) Le texte de l’article 5.');
    expect(getByTestId('chat-preview-englobant').textContent).toContain('il est tiré d’un passage qui en contient d’autres');
    expect(queryByTestId('chat-preview-cut')).toBeNull();
  });

  it('amène le passage souligné dans la vue de la zone qui défile, sans toucher au focus', async () => {
    // jsdom ne met rien en page : une zone de 400 px, et le passage 600 px plus
    // bas que le haut de la zone, hors de vue.
    const boite = (top: number, height: number) =>
      ({ top, bottom: top + height, height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
    const estLaZone = (el: Element) => el.hasAttribute('data-zone-preuves');
    const rectangle = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      return this.tagName === 'MARK' ? boite(700, 60) : estLaZone(this) ? boite(100, 400) : boite(0, 0);
    };
    const hauteur = Object.getOwnPropertyDescriptor(Element.prototype, 'clientHeight');
    Object.defineProperty(Element.prototype, 'clientHeight', {
      configurable: true,
      get: function (this: Element) {
        return estLaZone(this) ? 400 : 0;
      },
    });
    const zone = document.createElement('div');
    zone.setAttribute('data-zone-preuves', '');
    document.body.appendChild(zone);
    try {
      apercuDeLArticle.mockResolvedValue(ARTICLE_6);
      let defilement = 0;
      Object.defineProperty(zone, 'scrollTop', { configurable: true, get: () => defilement, set: (v: number) => (defilement = v) });
      const { findByTestId } = render(CarteArticleCite, {
        target: zone,
        props: { carte: CARTE, idCarte: 'c', ouverte: true, citationActive: 0, surBasculer: vi.fn() },
      });
      await findByTestId('chat-preview-text');

      // Le moins de défilement possible : le bas du passage (660) et la marge
      // (24), sous le bord bas de la zone (400).
      await waitFor(() => expect(defilement).toBe(284));
      expect(document.activeElement).toBe(document.body);
    } finally {
      HTMLElement.prototype.getBoundingClientRect = rectangle;
      if (hauteur) Object.defineProperty(Element.prototype, 'clientHeight', hauteur);
      zone.remove();
    }
  });
});

describe('CarteArticleCite : repliée, puis ouverte', () => {
  beforeEach(() => {
    apercuDeLArticle.mockReset();
    copierDansLePressePapiers.mockReset();
  });
  afterEach(() => cleanup());

  it('fermée : ni corps ni lecture ; nom, repères et statut prouvé ; l’en-tête dit son état', async () => {
    const surBasculer = vi.fn();
    const { getByTestId, queryByTestId } = ouvrir(CARTE_35, { ouverte: false, releveLe: '2026-10-14', surBasculer });

    const entete = getByTestId('chat-article-cite');
    expect(apercuDeLArticle).not.toHaveBeenCalled();
    expect(entete.getAttribute('aria-expanded')).toBe('false');
    expect(entete.textContent).toContain('Art. 35 — Code du travail');
    expect(entete.textContent).toContain('Loi n°\u00A092/007 du 14 août 1992 · aucune modification relevée par JuriX au 14 oct. 2026');
    expect(entete.textContent).not.toMatch(/vigueur|LOI-1992/);
    expect(queryByTestId('chat-preview-text')).toBeNull();
    const corps = document.getElementById(entete.getAttribute('aria-controls')!) as HTMLElement & { inert: boolean };
    expect(corps.inert || corps.hasAttribute('inert')).toBe(true);

    await fireEvent.click(entete);
    expect(surBasculer).toHaveBeenCalledTimes(1);
  });

  it('préchargée : la pastille de statut, jamais inventée ; pas de pastille sans aperçu', async () => {
    apercuDeLArticle.mockResolvedValue(ARTICLE_35_COLLE);
    const { findByTestId } = ouvrir(CARTE_35, { ouverte: false, precharger: true });
    expect((await findByTestId('chat-carte-statut')).textContent).toContain('Origine, non consolidée');
    cleanup();

    apercuDeLArticle.mockResolvedValue(null);
    const { queryByTestId } = ouvrir(CARTE_35, { ouverte: false, precharger: true });
    await waitFor(() => expect(apercuDeLArticle).toHaveBeenCalledTimes(2));
    expect(queryByTestId('chat-carte-statut')).toBeNull();
  });

  it('à l’ouverture, le statut est tamponné ; pendant la lecture, des squelettes, sans role="status"', async () => {
    apercuDeLArticle.mockReturnValue(new Promise(() => {}));
    const { getByTestId, container } = ouvrir(CARTE_35);

    expect(container.querySelector('.mv-squelette')).not.toBeNull();
    expect(container.querySelector('.animate-pulse, [class*="animate-pulse"]')).toBeNull();
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(getByTestId('chat-preview-status')).toBeTruthy();
    cleanup();

    apercuDeLArticle.mockResolvedValue(ARTICLE_35_COLLE);
    const { findByTestId } = ouvrir(CARTE_35);
    expect((await findByTestId('chat-preview-status')).querySelector('.mv-tamponner')).toBeNull();
    await findByTestId('chat-preview-text');
    expect(document.querySelector('[data-testid="chat-preview-status"] .mv-tamponner')).not.toBeNull();
  });

  it('une autre citation du même article déplace le souligné, sans changer le texte', async () => {
    apercuDeLArticle.mockResolvedValue({
      ...ARTICLE_6,
      contenu: 'Le travailleur licencié reçoit une indemnité de licenciement calculée selon son ancienneté dans entreprise.\nLa faute lourde prive le salarié employeur de toute indemnité compensatrice versée pendant le préavis.',
    });
    const carte = {
      ...CARTE,
      citations: [
        { indexCitation: 2, phrase: 'Le travailleur licencié reçoit une indemnité de licenciement selon son ancienneté' },
        { indexCitation: 5, phrase: 'La faute lourde prive le salarié de toute indemnité compensatrice' },
      ],
    };
    const { findByTestId, rerender, getByTestId } = ouvrir(carte, { citationActive: 2 });
    const texte = await findByTestId('chat-preview-text');
    const avant = texte.textContent;
    expect(texte.querySelectorAll('mark')).toHaveLength(1);
    expect(texte.querySelector('mark')?.textContent).toContain('indemnité de licenciement');

    await rerender({ citationActive: 5 });

    expect(getByTestId('chat-preview-text').querySelector('mark')?.textContent).toContain('faute lourde');
    expect(getByTestId('chat-preview-text').textContent).toBe(avant);
  });

  it('« Copier la référence » : la forme de la page d’un texte, « copiée » 1,8 s, annoncée', async () => {
    apercuDeLArticle.mockResolvedValue(ARTICLE_35_COLLE);
    copierDansLePressePapiers.mockResolvedValue(true);
    const surAnnonce = vi.fn();
    const { findByTestId, getByTestId } = ouvrir(CARTE_35, { surAnnonce });
    await findByTestId('chat-preview-text');

    await fireEvent.click(getByTestId('chat-carte-copier'));

    await waitFor(() => expect(getByTestId('chat-carte-copier').textContent).toContain('Référence copiée'));
    const copie = copierDansLePressePapiers.mock.calls[0][0] as string;
    expect(copie).toMatch(/^Art\. 35, /);
    expect(copie).toContain('92/007');
    expect(copie.split('\n')[1]).toMatch(/\/laws\/2274\?article=35$/);
    expect(surAnnonce).toHaveBeenCalledWith('Référence copiée');
  });

  it('copie refusée : le dire, sans faux « copiée »', async () => {
    apercuDeLArticle.mockResolvedValue(ARTICLE_35_COLLE);
    copierDansLePressePapiers.mockResolvedValue(false);
    const { findByTestId, getByTestId } = ouvrir(CARTE_35);
    await findByTestId('chat-preview-text');

    await fireEvent.click(getByTestId('chat-carte-copier'));

    expect((await findByTestId('chat-carte-copie-echec')).textContent).toContain('Copie impossible');
    expect(getByTestId('chat-carte-copier').textContent).not.toContain('copiée');
  });
});
