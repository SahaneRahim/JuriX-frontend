import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';

vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('$lib/stores/language', async () => {
  const { readable, writable } = await import('svelte/store');
  const { traduireEnTest } = await import('./traductions-de-test');
  return { tr: readable(traduireEnTest), language: writable({ current: 'fr' }), switchLanguage: () => {} };
});

import { insecablesDuTexte } from '$lib/texte';
import type { CitationPositionnee } from '$lib/types';
import { marquerLesCitations } from './citations';
import { pucesDeLaReponse } from './libelles';
import LigneCitee from './LigneCitee.svelte';
import { traduireEnTest } from './traductions-de-test';

/**
 * Une ligne d'une réponse et sa puce de citation (refonte A, décision C1),
 * montée seule : ce que TexteDeReponse lui passe (`puces`, `nouvelles`), et ce
 * qu'elle en fait. La puce S'AJOUTE au renvoi : elle ne le remplace pas, ne
 * le touche pas, et reste un lien EN LIGNE, que redimensionnement.spec.ts
 * exempte, comme le renvoi, de la cible de 44 px (lien pris dans une phrase).
 */

const TEXTE = 'Selon l’article 37 du Code du travail, l’indemnité est due ; voir aussi la loi n° 92/007.';

function citation(texteCite: string, article: string | null): CitationPositionnee {
  const debut = TEXTE.indexOf(texteCite);
  return {
    debut,
    fin: debut + texteCite.length,
    texte_cite: texteCite,
    law_id: 2274,
    article,
    article_id: article ? 97437 : null,
    reference: 'LOI-1992-007',
    titre: 'Loi N°92/007 du 14 août 1992 portant Code du travail',
    date_du_texte: '1992-08-14',
    statut: { etat: null, liens: [], lignes: [] },
  };
}

function rendre(props: Record<string, unknown> = {}) {
  const marque = marquerLesCitations(TEXTE, {
    citations: [citation('article 37 du Code du travail', '37'), citation('loi n° 92/007', null)],
  })!;
  const puces = new Map(
    [...pucesDeLaReponse([0, 1], marque.citations, traduireEnTest)].map(([i, p]) => [i, { ...p, delai: p.rang * 350 }]),
  );
  return render(LigneCitee, {
    props: { texte: marque.texte, marque: true, citations: marque.citations, puces, ...props },
  });
}

describe('LigneCitee : la puce de citation', () => {
  afterEach(() => cleanup());

  it('un lien en ligne après son renvoi : pastille, jamais un bloc ni un bouton', () => {
    const { getAllByTestId } = rendre();

    const puce = getAllByTestId('chat-puce')[0];
    expect(puce.tagName).toBe('A');
    expect(puce.previousElementSibling?.getAttribute('data-testid')).toBe('chat-citation');
    // Aucune classe qui la sortirait de la ligne : un `inline-block` de 24 px
    // échouerait à la règle des 44 px au doigt.
    const classes = puce.className.split(/\s+/);
    for (const interdite of ['block', 'inline-block', 'inline-flex', 'flex', 'grid', 'absolute', 'fixed']) {
      expect(classes).not.toContain(interdite);
    }
    // La pastille de A3 § 4 : bordée, ronde, 12 px demi-gras ; des bords
    // dessinés de chaque côté d'une coupure de ligne.
    for (const recette of ['rounded-full', 'border', 'border-zinc-300', 'bg-white', 'text-xs', 'font-semibold']) {
      expect(classes).toContain(recette);
    }
    expect(puce.className).toContain('box-decoration-break:clone');
  });

  it('le renvoi reste celui d’avant : même texte, même icône, même lien', () => {
    const { getAllByTestId } = rendre();

    const renvoi = getAllByTestId('chat-citation')[0];
    expect(renvoi.textContent).toBe(insecablesDuTexte('l’article 37 du Code du travail'));
    expect(renvoi.querySelector('svg[data-icone="section"]')).not.toBeNull();
    expect(renvoi.getAttribute('href')).toBe('/laws/2274?article=37');
    expect(renvoi.querySelector('[data-testid="chat-puce"]')).toBeNull();
  });

  it('un texte cité sans article : la puce porte le nom du texte, et mène au texte', () => {
    const { getAllByTestId } = rendre();

    const puce = getAllByTestId('chat-puce')[1];
    expect(puce.textContent).toBe('Code du travail');
    expect(puce.getAttribute('href')).toBe('/laws/2274');
    // Sans article, pas de passage à montrer : son aperçu dit le texte.
    expect(puce.getAttribute('aria-label')).toBe('Code du travail\u202F: voir le texte');
  });

  it('un clic simple ouvre l’aperçu avec la puce pour déclencheur ; les clics modifiés restent des liens', async () => {
    const surCitation = vi.fn();
    const { getAllByTestId } = rendre({ surCitation });
    const puce = getAllByTestId('chat-puce')[0];

    for (const modificateur of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { button: 1 }]) {
      await fireEvent.click(puce, modificateur);
    }
    expect(surCitation).not.toHaveBeenCalled();

    await fireEvent.click(puce);
    expect(surCitation).toHaveBeenCalledOnce();
    expect(surCitation).toHaveBeenCalledWith(0, puce);
  });

  it('nouvelles : le geste « citer » et son délai ; sinon, rien', async () => {
    const { getAllByTestId, rerender } = rendre({ nouvelles: true });

    const [premiere, seconde] = getAllByTestId('chat-puce');
    expect(premiere.classList.contains('mv-citer')).toBe(true);
    expect(premiere.style.getPropertyValue('--d')).toBe('0ms');
    expect(seconde.style.getPropertyValue('--d')).toBe('350ms');

    await rerender({ nouvelles: false });
    expect(premiere.classList.contains('mv-citer')).toBe(false);
    expect(premiere.style.getPropertyValue('--d')).toBe('');
  });

  it('active : la puce s’inverse, le renvoi garde sa mise en évidence', () => {
    const { getAllByTestId } = rendre({ citationActive: 0 });

    const puce = getAllByTestId('chat-puce')[0];
    expect(puce.className).toContain('bg-zinc-950');
    expect(puce.className.split(/\s+/)).not.toContain('bg-white');
    expect(getAllByTestId('chat-citation')[0].className).toContain('bg-zinc-100');
    expect(getAllByTestId('chat-puce')[1].className.split(/\s+/)).toContain('bg-white');
  });

  it('sans entrée dans `puces` (ou sans marques), pas de puce', () => {
    const avecMarques = rendre({ puces: new Map() });
    expect(avecMarques.queryAllByTestId('chat-puce')).toHaveLength(0);
    expect(avecMarques.getAllByTestId('chat-citation')).toHaveLength(2);
    cleanup();

    const sansMarques = render(LigneCitee, { props: { texte: TEXTE } });
    expect(sansMarques.queryAllByTestId('chat-puce')).toHaveLength(0);
  });
});
