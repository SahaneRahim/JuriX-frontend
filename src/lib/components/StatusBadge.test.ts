/**
 * Le vocabulaire de ce composant a change.
 *
 * Il declarait `repealed`, `completed` et `failed` — trois statuts qui
 * n'existent nulle part dans l'API. Le modele Law (app/models/law.py:163)
 * definit draft, published, archived, pending, processing, refused. Les tests
 * suivent le contrat reel, et non plus l'ancien.
 */

import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import StatusBadge from './StatusBadge.svelte';

describe('StatusBadge', () => {
  it('traduit le libelle au lieu de l’ecrire en dur', () => {
    const { getByTestId } = render(StatusBadge, { status: 'published' });
    // Le libelle vient desormais du store de traductions : batch-upload
    // affichait l'enumeration anglaise brute alors que la cle existait.
    expect(getByTestId('status-badge').textContent?.trim()).toBe('Publié');
  });

  it('couvre les six statuts reels du modele Law', () => {
    for (const [statut, attendu] of [
      ['draft', 'Brouillon'],
      ['pending', 'En attente'],
      ['processing', 'Traitement...'],
      ['published', 'Publié'],
      ['refused', 'Refusé'],
      ['archived', 'Archivé'],
    ] as const) {
      const { getByTestId, unmount } = render(StatusBadge, { status: statut });
      expect(getByTestId('status-badge').textContent?.trim()).toBe(attendu);
      unmount();
    }
  });

  it('rend un statut inconnu visible plutot que de le masquer', () => {
    const { getByTestId } = render(StatusBadge, { status: 'inconnu' });
    const badge = getByTestId('status-badge');
    expect(badge.textContent?.trim()).toBe('inconnu');
    expect(badge.getAttribute('data-status')).toBe('inconnu');
  });

  it('n’anime que « processing », le seul etat ou un travail est en cours', () => {
    const { getByTestId, unmount } = render(StatusBadge, { status: 'processing' });
    expect(getByTestId('status-badge').className).toContain('animate-pulse');
    unmount();

    const rendu = render(StatusBadge, { status: 'published' });
    expect(rendu.getByTestId('status-badge').className).not.toContain('animate-pulse');
  });

  it('applique la taille demandee', () => {
    for (const [taille, classe] of [
      ['sm', 'text-xs'],
      ['md', 'text-sm'],
      ['lg', 'text-base'],
    ] as const) {
      const { getByTestId, unmount } = render(StatusBadge, { status: 'draft', size: taille });
      expect(getByTestId('status-badge').className).toContain(classe);
      unmount();
    }
  });

  it('utilise la taille moyenne par defaut', () => {
    const { getByTestId } = render(StatusBadge, { status: 'draft' });
    expect(getByTestId('status-badge').className).toContain('text-sm');
  });
});
