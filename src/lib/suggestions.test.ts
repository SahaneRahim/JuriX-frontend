import { describe, expect, it } from 'vitest';

import { PERSONAS } from '$lib/stores/persona';
import { SUGGESTIONS, suggestionsPour } from './suggestions';

const JEUX = [...PERSONAS, 'general'] as const;

describe('suggestions du chat', () => {
  it.each(JEUX)('%s : 3 ou 4 questions, autant en FR qu en EN', (jeu) => {
    const fr = SUGGESTIONS.fr[jeu];
    const en = SUGGESTIONS.en[jeu];

    expect(fr.length).toBeGreaterThanOrEqual(3);
    expect(fr.length).toBeLessThanOrEqual(4);
    expect(en.length).toBe(fr.length);
    expect(new Set(fr).size).toBe(fr.length);
    expect(new Set(en).size).toBe(en.length);
  });

  it('chaque question respecte les bornes du serveur, puisqu un clic l envoie', () => {
    // RAGRequest.question : 5 a 1000 caracteres.
    for (const langue of ['fr', 'en'] as const) {
      for (const jeu of JEUX) {
        for (const q of SUGGESTIONS[langue][jeu]) {
          expect(q.length).toBeGreaterThanOrEqual(5);
          expect(q.length).toBeLessThanOrEqual(1000);
        }
      }
    }
  });

  it('aucune question hors du corpus (ni jurisprudence ni methode)', () => {
    const tout = JSON.stringify(SUGGESTIONS).toLowerCase();
    for (const interdit of ['jurisprudence', 'case law', 'cas pratique', 'licenciement']) {
      expect(tout).not.toContain(interdit);
    }
  });

  it('le profil general a son propre jeu', () => {
    expect(suggestionsPour(null, 'fr')).toBe(SUGGESTIONS.fr.general);
    expect(suggestionsPour('avocat', 'en')).toBe(SUGGESTIONS.en.avocat);
  });
});
