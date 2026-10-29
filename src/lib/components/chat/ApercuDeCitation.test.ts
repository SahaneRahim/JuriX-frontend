import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';

const { apercuDeLArticle } = vi.hoisted(() => ({ apercuDeLArticle: vi.fn() }));

vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('$lib/stores/language', async () => {
  const { readable, writable } = await import('svelte/store');
  const { traduireEnTest } = await import('./traductions-de-test');
  return { tr: readable(traduireEnTest), language: writable({ current: 'fr' }), switchLanguage: () => {} };
});
vi.mock('./apercus', () => ({ apercuDeLArticle }));

import type { ArticleApercu, TexteLie } from '$lib/types';
import type { CibleDApercu } from './apercus';
import ApercuDeCitation from './ApercuDeCitation.svelte';

// jsdom n'a pas l'API Web Animations, dont les transitions de Svelte 5 ont besoin.
Element.prototype.animate = vi.fn(() => ({
  onfinish: null,
  cancel: vi.fn(),
  finished: Promise.resolve(),
  currentTime: 0,
})) as unknown as typeof Element.prototype.animate;

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

const CIBLE: CibleDApercu = {
  cle: '1',
  lawId: 2143,
  numero: '6',
  articleId: 75144,
  libelle: 'Art. 6 — Loi n° 96/06',
  titre: 'Loi N°96/06 du 18 janvier 1996 portant révision de la Constitution du 02 juin 1972.',
  statut: { etat: 'modifie', liens: [], lignes: [] },
  phrases: ["Le mandat présidentiel dure sept ans et n'est renouvelable qu'une fois ( )"],
};

describe('ApercuDeCitation (P3)', () => {
  beforeEach(() => apercuDeLArticle.mockReset());
  afterEach(() => cleanup());

  it('feuille modale : nommée par son titre, focus sur « Fermer », voile', async () => {
    apercuDeLArticle.mockResolvedValue(ARTICLE_6);
    const surFermer = vi.fn();
    const { getByRole, getByTestId, container } = render(ApercuDeCitation, {
      props: { cible: CIBLE, modale: true, surFermer },
    });

    const boite = getByRole('dialog');
    expect(boite.getAttribute('aria-modal')).toBe('true');
    expect(boite.getAttribute('data-mode')).toBe('feuille');
    expect(document.getElementById(boite.getAttribute('aria-labelledby')!)?.textContent).toBe('Art. 6 — Loi n° 96/06');
    await waitFor(() => expect(document.activeElement).toBe(getByTestId('chat-preview-close')));
    expect(getByTestId('chat-preview-close').textContent).toContain('Fermer');

    await fireEvent.click(container.querySelector('.bg-zinc-950\\/40') as HTMLElement);
    expect(surFermer).toHaveBeenCalledTimes(1);
  });

  it('le texte entier de l’article, le passage cité en gras, le statut de l’article', async () => {
    apercuDeLArticle.mockResolvedValue(ARTICLE_6);
    const { getByTestId, findByTestId } = render(ApercuDeCitation, {
      props: { cible: CIBLE, modale: true, surFermer: vi.fn() },
    });

    const texte = await findByTestId('chat-preview-text');
    expect(apercuDeLArticle).toHaveBeenCalledWith(2143, '6', 75144, expect.any(AbortSignal));
    // Marqueur de page retiré, langue du texte posée.
    expect(texte.textContent).not.toContain('<<PAGE');
    expect(texte.getAttribute('lang')).toBe('fr');
    expect(texte.className).toContain('font-texte');
    const gras = texte.querySelector('strong');
    expect(gras?.textContent).toBe('Le Président de la République est élu pour un mandat de sept (7) ans renouvelable une fois');

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

  it('feuille modale : la tabulation tourne dans la feuille', async () => {
    apercuDeLArticle.mockResolvedValue(ARTICLE_6);
    const { getByTestId, findByTestId } = render(ApercuDeCitation, {
      props: { cible: CIBLE, modale: true, surFermer: vi.fn() },
    });
    await findByTestId('chat-preview-text');
    const dernier = getByTestId('chat-preview-full');
    // jsdom ne calcule pas de mise en page : chaque élément y passe pour affiché.
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', { configurable: true, get: () => document.body });
    try {
      dernier.focus();
      await fireEvent.keyDown(dernier, { key: 'Tab' });
      expect(document.activeElement).toBe(getByTestId('chat-preview-close'));
    } finally {
      delete (HTMLElement.prototype as unknown as { offsetParent?: unknown }).offsetParent;
    }
  });

  it('panneau d’ordinateur : non modal, sans voile', () => {
    apercuDeLArticle.mockResolvedValue(ARTICLE_6);
    const { getByRole, container } = render(ApercuDeCitation, {
      props: { cible: CIBLE, modale: false, surFermer: vi.fn() },
    });

    expect(getByRole('dialog').getAttribute('aria-modal')).toBeNull();
    expect(getByRole('dialog').getAttribute('data-mode')).toBe('panneau');
    expect(container.querySelector('.bg-zinc-950\\/40')).toBeNull();
  });

  it('la région d’annonce du chat est DANS la boîte : hors d’une boîte aria-modal, rien n’est lu', async () => {
    apercuDeLArticle.mockResolvedValue(ARTICLE_6);
    const { getByRole, getByTestId, rerender } = render(ApercuDeCitation, {
      props: { cible: CIBLE, modale: true, surFermer: vi.fn() },
    });

    const region = getByTestId('chat-preview-announce');
    expect(getByRole('dialog').contains(region)).toBe(true);
    expect(region.getAttribute('role')).toBe('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
    // Présente et vide dès l'ouverture : les lecteurs d'écran la connaissent
    // avant sa première phrase.
    expect(region.textContent?.trim()).toBe('');

    await rerender({ cible: CIBLE, modale: true, surFermer: vi.fn(), annonce: 'Réponse terminée.' });

    expect(getByTestId('chat-preview-announce').textContent?.trim()).toBe('Réponse terminée.');
  });

  it('aperçu introuvable (ancienne API, 404) : le dire, garder le texte intégral', async () => {
    apercuDeLArticle.mockResolvedValue(null);
    const { findByTestId, getByTestId } = render(ApercuDeCitation, {
      props: { cible: CIBLE, modale: true, surFermer: vi.fn() },
    });

    expect((await findByTestId('chat-preview-unavailable')).textContent).toContain('n’est pas disponible');
    expect(getByTestId('chat-preview-full').getAttribute('href')).toBe('/laws/2143?article=6');
    // Le statut de la citation reste affiché, sans rien inventer.
    expect(getByTestId('chat-preview-status').textContent).toContain('Modifié.');
  });

  it('un texte cité sans article : aucun appel, son statut et le texte intégral', () => {
    const { getByTestId, queryByTestId, getByText } = render(ApercuDeCitation, {
      props: {
        cible: { ...CIBLE, numero: null, articleId: null, lawId: 2274, libelle: 'Code du travail', statut: { etat: null, liens: [], lignes: [] } },
        modale: true,
        releveLe: '2026-10-14',
        surFermer: vi.fn(),
      },
    });

    expect(apercuDeLArticle).not.toHaveBeenCalled();
    expect(getByText('Texte cité dans la réponse')).toBeTruthy();
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

const CIBLE_35: CibleDApercu = {
  cle: '35',
  lawId: 2274,
  numero: '35',
  articleId: 97421,
  libelle: 'Art. 35 — Code du travail',
  titre: 'Loi N°92/007 du 14 août 1992 portant Code du travail',
  statut: { etat: null, liens: [], lignes: [] },
  phrases: ["Réponse directe : selon , l'indemnité de licenciement est due après deux ans de service continu"],
};

describe('ApercuDeCitation : l’article cité, et lui seul', () => {
  beforeEach(() => apercuDeLArticle.mockReset());
  afterEach(() => cleanup());

  it('s’arrête avant l’article suivant que la base a collé au sien, et le dit', async () => {
    apercuDeLArticle.mockResolvedValue(ARTICLE_35_COLLE);
    const { findByTestId, getByTestId, queryByTestId, getByText } = render(ApercuDeCitation, {
      props: { cible: CIBLE_35, modale: true, surFermer: vi.fn() },
    });

    const texte = await findByTestId('chat-preview-text');
    expect(texte.textContent).toContain("qu'elle jugerait bon de demander.");
    expect(texte.textContent).not.toContain('Article 36');
    expect(texte.textContent).not.toContain('Article 37');
    // Le passage de l'article 37 n'est plus mis en gras sous le titre « Art. 35 »,
    // et la légende ne promet aucun gras.
    expect(texte.querySelector('strong')).toBeNull();
    expect(queryByTestId('chat-preview-englobant')).toBeNull();
    expect(() => getByText('En gras : le passage le plus proche de la phrase de la réponse.')).toThrow();
    expect(getByTestId('chat-preview-cut').textContent).toContain(
      'L’aperçu s’arrête avant l’article 36, que JuriX a enregistré avec celui-ci.',
    );
    // Le bruit de numérisation était dans l'article 36 : coupé avec lui.
    expect(queryByTestId('chat-preview-ocr')).toBeNull();
  });

  it('un paragraphe par alinéa, à la mesure de lecture de 34em (feuille de tablette)', async () => {
    apercuDeLArticle.mockResolvedValue(ARTICLE_35_COLLE);
    const { findByTestId } = render(ApercuDeCitation, { props: { cible: CIBLE_35, modale: true, surFermer: vi.fn() } });

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
    const { findByTestId, getByTestId } = render(ApercuDeCitation, {
      props: { cible: CIBLE_35, modale: true, surFermer: vi.fn() },
    });
    await findByTestId('chat-preview-text');

    const separateur = getByTestId('chat-preview-status').querySelector('[aria-hidden="true"]');
    expect(separateur?.textContent).toBe(' · ');
    expect(separateur?.className).toContain('hidden');
    expect(separateur?.className).toContain('court:inline');
  });

  it('intitulé de section à la française : une espace insécable devant le deux-points', async () => {
    apercuDeLArticle.mockResolvedValue(ARTICLE_35_COLLE);
    const { findByTestId, container } = render(ApercuDeCitation, { props: { cible: CIBLE_35, modale: true, surFermer: vi.fn() } });
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
    const { findByTestId, getByTestId } = render(ApercuDeCitation, {
      props: { cible: { ...CIBLE_35, cle: '36', numero: '36' }, modale: true, surFermer: vi.fn() },
    });

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
    const { findByTestId, getByTestId, queryByTestId } = render(ApercuDeCitation, {
      props: { cible: { ...CIBLE_35, cle: '5', numero: '5' }, modale: true, surFermer: vi.fn() },
    });

    expect((await findByTestId('chat-preview-text')).textContent?.trim()).toBe('Art..5- (1) Le texte de l’article 5.');
    expect(getByTestId('chat-preview-englobant').textContent).toContain('il est tiré d’un passage qui en contient d’autres');
    expect(queryByTestId('chat-preview-cut')).toBeNull();
  });

  it('amène le passage en gras dans la vue à l’ouverture, le focus restant sur « Fermer »', async () => {
    // jsdom ne met rien en page : une zone de 400 px, un pied de 100 px, et le
    // gras 600 px plus bas que le haut de la zone, hors de vue.
    const boite = (top: number, height: number) =>
      ({ top, bottom: top + height, height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
    const estLaZone = (el: Element) => el.classList.contains('overflow-y-auto');
    const rectangle = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      return this.tagName === 'STRONG' ? boite(700, 60) : estLaZone(this) ? boite(100, 400) : boite(0, 0);
    };
    const mesures = {
      scrollHeight: (el: HTMLElement) => (estLaZone(el) ? 1200 : 0),
      clientHeight: (el: HTMLElement) => (estLaZone(el) ? 400 : 0),
      offsetHeight: (el: HTMLElement) => (el.dataset.testid === 'chat-preview-footer' ? 100 : 0),
    };
    // jsdom définit `offsetHeight` sur HTMLElement.prototype : il est rendu tel quel après le test.
    const originaux = Object.keys(mesures).map((nom) => [nom, Object.getOwnPropertyDescriptor(HTMLElement.prototype, nom)] as const);
    for (const [nom, mesure] of Object.entries(mesures)) {
      Object.defineProperty(HTMLElement.prototype, nom, { configurable: true, get: function (this: HTMLElement) { return mesure(this); } });
    }
    try {
      apercuDeLArticle.mockResolvedValue(ARTICLE_6);
      const { getByTestId, findByTestId } = render(ApercuDeCitation, { props: { cible: CIBLE, modale: true, surFermer: vi.fn() } });
      const zone = getByTestId('chat-preview').querySelector('.overflow-y-auto') as HTMLElement;
      let defilement = 0;
      Object.defineProperty(zone, 'scrollTop', { configurable: true, get: () => defilement, set: (v: number) => (defilement = v) });

      await findByTestId('chat-preview-text');

      // Le moins de défilement possible : le bas du gras (660) plus la marge
      // (24), juste au-dessus du pied (400 - 100 = 300 px visibles).
      await waitFor(() => expect(defilement).toBe(384));
      expect(document.activeElement).toBe(getByTestId('chat-preview-close'));
    } finally {
      HTMLElement.prototype.getBoundingClientRect = rectangle;
      for (const [nom, descripteur] of originaux) {
        if (descripteur) Object.defineProperty(HTMLElement.prototype, nom, descripteur);
        else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[nom];
      }
    }
  });

  it('le pied « Lire dans le texte intégral » et la mention du Journal officiel restent collés en bas', async () => {
    apercuDeLArticle.mockResolvedValue(ARTICLE_35_COLLE);
    const { findByTestId, getByTestId } = render(ApercuDeCitation, { props: { cible: CIBLE_35, modale: true, surFermer: vi.fn() } });
    await findByTestId('chat-preview-text');

    const pied = getByTestId('chat-preview-footer');
    expect(pied.className).toContain('sticky');
    expect(pied.className).toContain('bottom-0');
    expect(pied.contains(getByTestId('chat-preview-full'))).toBe(true);
    expect(pied.textContent).toContain('Seul le texte publié au Journal officiel fait foi.');
    // Hors de la zone du texte : il ne défile pas avec lui.
    expect(getByTestId('chat-preview-text').contains(pied)).toBe(false);
  });
});

describe('ApercuDeCitation, fenêtre redimensionnée', () => {
  afterEach(() => cleanup());

  it('devenu feuille modale, il prend le focus resté dans la conversation', async () => {
    apercuDeLArticle.mockResolvedValue(ARTICLE_6);
    const dehors = document.createElement('textarea');
    document.body.appendChild(dehors);
    try {
      const { getByTestId, rerender } = render(ApercuDeCitation, {
        props: { cible: CIBLE, modale: false, surFermer: vi.fn() },
      });
      dehors.focus();
      expect(document.activeElement).toBe(dehors);

      await rerender({ cible: CIBLE, modale: true, surFermer: vi.fn() });

      await waitFor(() => expect(document.activeElement).toBe(getByTestId('chat-preview-close')));
      expect(getByTestId('chat-preview').getAttribute('aria-modal')).toBe('true');
    } finally {
      dehors.remove();
    }
  });
});
