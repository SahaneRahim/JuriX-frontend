import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';

vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('$lib/stores/language', async () => {
  const { readable, writable } = await import('svelte/store');
  const { traduireEnTest } = await import('./traductions-de-test');
  return { tr: readable(traduireEnTest), language: writable({ current: 'fr' }), switchLanguage: () => {} };
});

import type { SourceCitee, TexteConsulte } from '$lib/types';
import SourcesDeLaReponse from './SourcesDeLaReponse.svelte';

/** `articles_cites` et `textes_consultes_non_cites` de la réponse réelle du contrat (§7.3), raccourcis. */
const ARTICLES: SourceCitee[] = [
  {
    law_id: 2274,
    law_reference: 'LOI-1992-007',
    law_title: 'Loi N°92/007 du 14 août 1992 portant Code du travail',
    article_number: '35',
    article_id: 97421,
    excerpt: '(6) Le salaire à prendre en considération …',
    relevance_score: 0.95,
    date_du_texte: '1992-08-14',
    statut: { etat: null, liens: [], lignes: [] },
  },
  {
    law_id: 2279,
    law_reference: 'DEC-1994-199',
    law_title: 'Décret N°94/199 du 07 octobre 1994 portant Statut Général de la Fonction Publique de l’État',
    article_number: '120',
    article_id: 90163,
    excerpt: '(1) Outre les éventuels droits à pension …',
    relevance_score: 0.72,
    date_du_texte: '1994-10-07',
    statut: { etat: null, liens: [], lignes: [] },
  },
];
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

describe('SourcesDeLaReponse (P3)', () => {
  afterEach(() => cleanup());

  it('« Articles cités » : nom court, identité et statut, sans « en vigueur » ni cote', () => {
    const { getByText, getAllByTestId, container } = render(SourcesDeLaReponse, {
      props: { idMessage: 7, articles: ARTICLES, consultes: CONSULTES, releveLe: '2026-10-14' },
    });

    expect(getByText('Articles cités (2)')).toBeTruthy();
    const lignes = getAllByTestId('chat-article-cite');
    expect(lignes).toHaveLength(2);
    expect(lignes[0].textContent).toContain('Art. 35 — Code du travail');
    expect(lignes[0].textContent).toContain('Loi n°\u00A092/007 du 14 août 1992 · aucune modification relevée par JuriX au 14 oct. 2026');
    expect(lignes[0].getAttribute('href')).toBe('/laws/2274?article=35');
    expect(lignes[0].getAttribute('aria-haspopup')).toBe('dialog');
    // Un décret : son objet pour nom, comme un code, et ses repères dessous,
    // le numéro une seule fois et le jour sans zéro (capture chat-citations r2).
    expect(lignes[1].textContent).toContain('Art. 120 — Statut Général de la Fonction Publique de l’État');
    expect(lignes[1].textContent).toContain('Décret n°\u00A094/199 du 7 octobre 1994 · aucune modification relevée');
    expect(lignes[1].textContent?.split('94/199')).toHaveLength(2);
    expect(container.textContent).not.toMatch(/vigueur|PRC-|LOI-1992/);
  });

  it('un article cité ouvre l’aperçu d’un clic simple', async () => {
    const surArticle = vi.fn();
    const { getAllByTestId } = render(SourcesDeLaReponse, {
      props: { idMessage: 7, articles: ARTICLES, consultes: [], surArticle },
    });

    await fireEvent.click(getAllByTestId('chat-article-cite')[1]);

    expect(surArticle).toHaveBeenCalledWith(1, getAllByTestId('chat-article-cite')[1]);
  });

  it('« Textes consultés, non cités » repliés, puis dépliés, avec les articles lus', async () => {
    const { getByTestId, getAllByTestId } = render(SourcesDeLaReponse, {
      props: { idMessage: 7, articles: ARTICLES, consultes: CONSULTES },
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

  it('rien du tout quand les deux listes sont vides', () => {
    const { container } = render(SourcesDeLaReponse, { props: { idMessage: 7 } });

    expect(container.textContent?.trim()).toBe('');
  });
});
