import { describe, expect, it } from 'vitest';

import { PERSONAS } from '$lib/stores/persona';
import {
  SUGGESTIONS,
  SUGGESTIONS_A_L_ACCUEIL,
  questionAffichee,
  suggestionsDeLAccueil,
  suggestionsPour,
} from './suggestions';

const JEUX = [...PERSONAS, 'general'] as const;

describe('questionAffichee', () => {
  it('colle le « ? » au dernier mot, pour qu’il ne tombe jamais seul sur sa ligne', () => {
    expect(questionAffichee('Quels sont mes droits en garde à vue ?')).toBe('Quels sont mes droits en garde à vue\u202f?');
    for (const question of SUGGESTIONS.fr.general) expect(questionAffichee(question)).not.toContain(' ?');
  });

  it('ne touche pas à l’anglais, qui n’a pas d’espace devant le « ? »', () => {
    for (const question of SUGGESTIONS.en.general) expect(questionAffichee(question)).toBe(question);
  });
});

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
    // « licenciement » n'est plus interdit : le Code du travail (loi 92/007)
    // est dans le corpus depuis le 2026-10-14.
    const tout = JSON.stringify(SUGGESTIONS).toLowerCase();
    for (const interdit of ['jurisprudence', 'case law', 'cas pratique']) {
      expect(tout).not.toContain(interdit);
    }
  });

  it('en francais, l apostrophe typographique, comme le reste de l interface', () => {
    for (const jeu of JEUX) {
      for (const q of SUGGESTIONS.fr[jeu]) expect(q).not.toContain("'");
    }
    expect(SUGGESTIONS.fr.general).toContain('Que risque l’auteur d’une escroquerie sur internet ?');
  });

  it('le profil general a son propre jeu', () => {
    expect(suggestionsPour(null, 'fr')).toBe(SUGGESTIONS.fr.general);
    expect(suggestionsPour('avocat', 'en')).toBe(SUGGESTIONS.en.avocat);
  });

  it.each(JEUX)('%s : l accueil montre les trois premieres, dans l ordre', (jeu) => {
    // P4 : trois questions validees sous les trois messages d'accueil.
    const persona = jeu === 'general' ? null : jeu;
    for (const langue of ['fr', 'en'] as const) {
      const accueil = suggestionsDeLAccueil(persona, langue);
      expect(accueil).toHaveLength(SUGGESTIONS_A_L_ACCUEIL);
      expect(accueil).toEqual(SUGGESTIONS[langue][jeu].slice(0, 3));
    }
  });
});
