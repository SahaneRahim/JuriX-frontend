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

import type { TexteConsulte } from '$lib/types';
import type { CarteDeLaReponse } from './passages';
import PanneauDesPreuves from './PanneauDesPreuves.svelte';
import BarreDesArticlesCites from './BarreDesArticlesCites.svelte';

// jsdom n'a pas l'API Web Animations, dont les transitions de Svelte 5 ont besoin.
Element.prototype.animate = vi.fn(() => ({
  onfinish: null,
  cancel: vi.fn(),
  finished: Promise.resolve(),
  currentTime: 0,
})) as unknown as typeof Element.prototype.animate;

const carte = (numero: string, indexCitation: number): CarteDeLaReponse => ({
  lawId: 2274,
  numero,
  articleId: null,
  titre: 'Loi N°92/007 du 14 août 1992 portant Code du travail',
  reference: 'LOI-1992-007',
  statut: { etat: null, liens: [], lignes: [] },
  citations: [{ indexCitation, phrase: 'une phrase' }],
});
const CARTES = [carte('35', 0), carte('37', 1), carte('38', 2), carte('39', 3)];
const CONSULTES: TexteConsulte[] = [
  {
    law_id: 2285,
    law_reference: 'CODE-CIVIL',
    law_title: 'Code civil applicable au Cameroun, annoté de la jurisprudence de la Cour suprême',
    date_du_texte: null,
    articles: ['107'],
    statut: {
      etat: null,
      liens: [
        {
          nature: 'abroge_partiellement',
          libelle: 'abrogé en partie',
          par_titre: 'la Loi n° 2024/016 du 23 décembre 2024',
          par_date: '2024-12-23',
          par_reference: 'PRC-10257',
          par_law_id: 2156,
          articles: ['1 à 11'],
          par_articles: ['129'],
          portee: null,
        },
      ],
      lignes: ['Statut : … (PRC-10257)'],
    },
  },
];


const feuille = (autres: Record<string, unknown> = {}) =>
  render(PanneauDesPreuves, { props: { modale: true, ouvert: true, etat: 'pret', cartes: CARTES, idMessage: 7, ...autres } });

describe('PanneauDesPreuves : les deux formes', () => {
  beforeEach(() => {
    apercuDeLArticle.mockReset();
    apercuDeLArticle.mockResolvedValue(null);
  });
  afterEach(() => cleanup());

  it('feuille ouverte : modale, nommée par son titre, focus sur « Fermer », voile', async () => {
    const surFermer = vi.fn();
    const { getByRole, getByTestId, container } = feuille({ surFermer });

    const boite = getByRole('dialog');
    expect(boite.getAttribute('aria-modal')).toBe('true');
    expect(boite.getAttribute('data-mode')).toBe('feuille');
    expect(document.getElementById(boite.getAttribute('aria-labelledby')!)?.textContent).toBe('Articles cités');
  });

  it('feuille : la tabulation tourne dans la feuille, sans entrer dans une carte fermée', async () => {
    const { getByTestId, getAllByTestId } = feuille();
    const entetes = getAllByTestId('chat-article-cite');
    const dernier = entetes[entetes.length - 1];
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

  it('colonne d’ordinateur : non modale, sans rôle de boîte ni voile ; ses classes `lg:` la placent', () => {
    const { queryByRole, getByTestId, container } = render(PanneauDesPreuves, { props: { modale: false } });

    expect(queryByRole('dialog')).toBeNull();
    const panneau = getByTestId('chat-preview');
    expect(panneau.tagName).toBe('ASIDE');
    expect(panneau.getAttribute('aria-modal')).toBeNull();
    expect(panneau.getAttribute('data-mode')).toBe('panneau');
    expect(panneau.className).toContain('lg:w-[520px]');
    expect(panneau.className).toContain('lg:visible');
    expect(container.querySelector('.bg-zinc-950\\/40')).toBeNull();
  });

  it('feuille fermée : cachée au clavier (invisible), sans boîte', () => {
    const { queryByRole, getByTestId } = render(PanneauDesPreuves, { props: { modale: true, ouvert: false } });

    expect(queryByRole('dialog')).toBeNull();
    expect(getByTestId('chat-preview').className).toContain('invisible');
  });

  it('la région d’annonce du chat est DANS la boîte : hors d’une boîte aria-modal, rien n’est lu', async () => {
    const { getByRole, getByTestId, rerender } = feuille();

    const region = getByTestId('chat-preview-announce');
    expect(getByRole('dialog').contains(region)).toBe(true);
    expect(region.getAttribute('role')).toBe('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
    // Présente et vide dès l'ouverture : les lecteurs d'écran la connaissent
    // avant sa première phrase.
    expect(region.textContent?.trim()).toBe('');

    await rerender({ annonce: 'Réponse terminée.' });

    expect(getByTestId('chat-preview-announce').textContent?.trim()).toBe('Réponse terminée.');
  });

  it('devenue feuille ouverte, elle prend le focus resté dans la conversation', async () => {
    const dehors = document.createElement('textarea');
    document.body.appendChild(dehors);
    try {
      const { getByTestId, rerender } = render(PanneauDesPreuves, { props: { modale: false, ouvert: false } });
      dehors.focus();
      expect(document.activeElement).toBe(dehors);

      await rerender({ modale: true, ouvert: true });

      await waitFor(() => expect(document.activeElement).toBe(getByTestId('chat-preview-close')));
      expect(getByTestId('chat-preview').getAttribute('aria-modal')).toBe('true');
    } finally {
      dehors.remove();
    }
  });

  it('un appui sur le voile ferme ; le focus va à « Fermer » à l’ouverture', async () => {
    const surFermer = vi.fn();
    const { getByTestId, container } = feuille({ surFermer });

    await waitFor(() => expect(document.activeElement).toBe(getByTestId('chat-preview-close')));
    expect(getByTestId('chat-preview-close').textContent).toContain('Fermer');
    await fireEvent.click(container.querySelector('.bg-zinc-950\\/40') as HTMLElement);
    expect(surFermer).toHaveBeenCalledTimes(1);
  });

  it('la mention du Journal officiel reste au pied, hors de la zone qui défile', () => {
    const { getByTestId, container } = feuille();

    const pied = getByTestId('chat-preview-footer');
    expect(pied.textContent).toContain('Seul le texte publié au Journal officiel fait foi.');
    expect(container.querySelector('[data-zone-preuves]')?.contains(pied)).toBe(false);
  });
});

describe('PanneauDesPreuves : ses états (C6)', () => {
  beforeEach(() => {
    apercuDeLArticle.mockReset();
    apercuDeLArticle.mockResolvedValue(null);
  });
  afterEach(() => cleanup());

  it('vide : la pile et la phrase ; rien de plus', () => {
    const { getByTestId, queryByTestId } = render(PanneauDesPreuves, { props: { modale: false } });

    expect(getByTestId('chat-preuves-vide').textContent).toContain('Les articles cités apparaîtront ici');
    expect(queryByTestId('chat-preuves-nombre')).toBeNull();
  });

  it('recherche : deux à trois squelettes `mv-squelette`, jamais `animate-pulse`', () => {
    const { getByTestId, container } = render(PanneauDesPreuves, {
      props: { modale: false, etat: 'recherche', nombreDeTextes: 9 },
    });

    expect(getByTestId('chat-preuves-squelettes').children).toHaveLength(3);
    expect(container.querySelector('.mv-squelette')).not.toBeNull();
    expect(container.querySelector('[class*="animate-pulse"]')).toBeNull();
    expect(container.querySelector('[data-zone-preuves] [role="status"]')).toBeNull();
  });

  it('prêt : une carte par article, le nombre, trois lectures préchargées, cascade de 150 ms', async () => {
    const { getAllByTestId, getByTestId, container } = render(PanneauDesPreuves, {
      props: { modale: false, etat: 'pret', cartes: CARTES, idMessage: 7, nouvelles: true },
    });

    expect(getAllByTestId('chat-carte')).toHaveLength(4);
    expect(getByTestId('chat-preuves-nombre').textContent).toBe('4');
    await waitFor(() => expect(apercuDeLArticle).toHaveBeenCalledTimes(3));
    const entrees = container.querySelectorAll<HTMLElement>('.mv-carte');
    expect(Array.from(entrees).map((e) => e.style.getPropertyValue('--d'))).toEqual(['0ms', '150ms', '300ms', '450ms']);
  });

  it('des cartes déjà là n’entrent pas de nouveau', () => {
    const { container } = render(PanneauDesPreuves, {
      props: { modale: false, etat: 'pret', cartes: CARTES, idMessage: 7 },
    });

    expect(container.querySelector('.mv-carte')).toBeNull();
  });

  it('une carte ouverte à la fois, décidée par la page ; l’en-tête passe son rang', async () => {
    const surBasculer = vi.fn();
    const { getAllByTestId } = render(PanneauDesPreuves, {
      props: { modale: false, etat: 'pret', cartes: CARTES, idMessage: 7, carteOuverte: 1, surBasculer },
    });

    const cartes = getAllByTestId('chat-carte');
    expect(cartes.map((c) => c.getAttribute('data-ouverte'))).toEqual(['false', 'true', 'false', 'false']);
    await fireEvent.click(getAllByTestId('chat-article-cite')[2]);
    expect(surBasculer).toHaveBeenCalledWith(2);
  });

  it('sans citation : « Cette réponse ne cite aucun article. »', () => {
    const { getByTestId } = render(PanneauDesPreuves, { props: { modale: false, etat: 'aucun' } });

    expect(getByTestId('chat-preuves-aucun').textContent).toContain('ne cite aucun article');
  });

  it('« Textes consultés, non cités » repliés, puis dépliés, avec les articles lus (C5)', async () => {
    const { getByTestId, getAllByTestId } = render(PanneauDesPreuves, {
      props: { modale: false, etat: 'pret', cartes: CARTES, consultes: CONSULTES as TexteConsulte[], idMessage: 7 },
    });
    const bascule = getByTestId('chat-consultes-toggle');
    const liste = document.getElementById(bascule.getAttribute('aria-controls')!)!;

    expect(bascule.textContent).toContain('Textes consultés, non cités (1)');
    expect(bascule.getAttribute('aria-expanded')).toBe('false');
    expect(liste.classList.contains('hidden')).toBe(true);

    await fireEvent.click(bascule);

    expect(bascule.getAttribute('aria-expanded')).toBe('true');
    expect(liste.classList.contains('hidden')).toBe(false);
    const texte = getAllByTestId('chat-texte-consulte')[0];
    expect(texte.textContent).toContain('articles lus : 107');
    expect(texte.textContent).toContain('des articles de ce texte ont été modifiés depuis');
    expect(texte.getAttribute('target')).toBe('_blank');
    expect(texte.getAttribute('href')).toBe('/laws/2285?article=107');
  });
});

describe('BarreDesArticlesCites', () => {
  afterEach(() => cleanup());

  it('« N articles cités », 48 px, liée à la feuille ; ouvre avec son élément', async () => {
    const surOuvrir = vi.fn();
    const { getByTestId } = render(BarreDesArticlesCites, { props: { nombre: 3, ouverte: false, surOuvrir } });

    const barre = getByTestId('chat-barre-articles');
    expect(barre.textContent).toContain('3 articles cités');
    expect(barre.className).toContain('min-h-12');
    expect(barre.className).toContain('lg:hidden');
    expect(barre.getAttribute('aria-controls')).toBe('cites');
    expect(barre.getAttribute('aria-expanded')).toBe('false');
    await fireEvent.click(barre);
    expect(surOuvrir).toHaveBeenCalledWith(barre);
  });

  it('au singulier ; rien sans article ni texte ; à défaut d’article, les textes consultés', () => {
    const surOuvrir = vi.fn();
    expect(render(BarreDesArticlesCites, { props: { nombre: 1, ouverte: false, surOuvrir } }).getByTestId('chat-barre-articles').textContent).toContain('1 article cité');
    cleanup();
    expect(render(BarreDesArticlesCites, { props: { nombre: 0, ouverte: false, surOuvrir } }).queryByTestId('chat-barre-articles')).toBeNull();
    cleanup();
    expect(render(BarreDesArticlesCites, { props: { nombre: 0, consultes: 2, ouverte: false, surOuvrir } }).getByTestId('chat-barre-articles').textContent).toContain('Textes consultés, non cités (2)');
  });

  it('feuille ouverte : cachée, mais montée (elle reprendra le focus)', () => {
    const { getByTestId } = render(BarreDesArticlesCites, { props: { nombre: 2, ouverte: true, surOuvrir: vi.fn() } });

    expect(getByTestId('chat-barre-articles').className).toContain('hidden');
  });
});
