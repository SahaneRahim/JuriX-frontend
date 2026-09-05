import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import {
  language,
  t,
  translations,
  languageFilter,
  switchLanguage,
  toggleShowAll,
  languageStore,
  type Language
} from './language';

// Mock browser environment
vi.stubGlobal('localStorage', {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn()
});

describe('language store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store to default state
    language.set({ current: 'fr', showAllLanguages: false });
  });

  it('should have default French language', () => {
    const state = get(language);
    expect(state.current).toBe('fr');
    expect(state.showAllLanguages).toBe(false);
  });

  it('should filter by language when showAllLanguages is false', () => {
    const filter = get(languageFilter);
    expect(filter).toBe('fr');
  });

  it('should return null filter when showAllLanguages is true', () => {
    language.set({ current: 'fr', showAllLanguages: true });
    const filter = get(languageFilter);
    expect(filter).toBe(null);
  });

  it('should toggle showAllLanguages correctly', () => {
    const initialState = get(language);
    expect(initialState.showAllLanguages).toBe(false);

    toggleShowAll();
    const afterToggle = get(language);
    expect(afterToggle.showAllLanguages).toBe(true);

    toggleShowAll();
    const afterSecondToggle = get(language);
    expect(afterSecondToggle.showAllLanguages).toBe(false);
  });

  it('should update current language', () => {
    language.update(state => ({ ...state, current: 'en' }));
    const state = get(language);
    expect(state.current).toBe('en');
  });

  it('should maintain showAllLanguages state when changing language', () => {
    language.set({ current: 'fr', showAllLanguages: true });
    language.update(state => ({ ...state, current: 'en' }));

    const state = get(language);
    expect(state.current).toBe('en');
    expect(state.showAllLanguages).toBe(true);
  });

  describe('languageFilter derived store', () => {
    it('should return current language when showAllLanguages is false', () => {
      language.set({ current: 'en', showAllLanguages: false });
      expect(get(languageFilter)).toBe('en');
    });

    it('should return null when showAllLanguages is true', () => {
      language.set({ current: 'en', showAllLanguages: true });
      expect(get(languageFilter)).toBe(null);
    });

    it('should react to changes in language store', () => {
      language.set({ current: 'fr', showAllLanguages: false });
      expect(get(languageFilter)).toBe('fr');

      toggleShowAll();
      expect(get(languageFilter)).toBe(null);

      toggleShowAll();
      expect(get(languageFilter)).toBe('fr');
    });
  });

  describe('legacy languageStore compatibility', () => {
    it('should support legacy set method', () => {
      languageStore.set('en');
      const state = get(language);
      expect(state.current).toBe('en');
    });

    it('should support legacy toggle method', () => {
      language.set({ current: 'fr', showAllLanguages: false });
      languageStore.toggle();
      const state = get(language);
      expect(state.current).toBe('en');
    });

    it('should support legacy reset method', () => {
      language.set({ current: 'en', showAllLanguages: true });
      languageStore.reset();
      const state = get(language);
      expect(state.current).toBe('fr');
      expect(state.showAllLanguages).toBe(false);
    });
  });
});

describe('t()', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rend la traduction quand la cle existe', () => {
    expect(t('common.retry', 'fr')).toBe('Réessayer');
    expect(t('common.retry', 'en')).toBe('Retry');
  });

  it('rend la cle elle-meme quand elle manque', () => {
    // Repli delibere : laid mais lisible, et preferable a une chaine vide ou a
    // une exception en production.
    expect(t('cle.qui.nexiste.pas', 'fr')).toBe('cle.qui.nexiste.pas');
  });

  it('avertit en developpement sur une cle inconnue', () => {
    // Le defaut que cela ferme : une faute de frappe sur une cle ne se voyait
    // qu'a l'ecran, par hasard, souvent sur une branche d'erreur rarement
    // atteinte. Rien ne la signalait.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    t('cle.absente.unique.aaa', 'fr');
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toContain('cle.absente.unique.aaa');
  });

  it('n avertit qu une seule fois par cle', () => {
    // Une cle manquante rendue dans une boucle produirait des centaines de
    // lignes identiques et noierait tout le reste.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (let i = 0; i < 5; i++) t('cle.absente.unique.bbb', 'fr');
    expect(warn).toHaveBeenCalledOnce();
  });

  it('les deux blocs de langue portent exactement les memes cles', () => {
    // L'asymetrie est le defaut le plus discret : l'interface reste correcte
    // tant qu'on ne bascule pas de langue.
    const fr = Object.keys(translations.fr);
    const en = Object.keys(translations.en);
    expect(fr.filter((k) => !en.includes(k)), 'manquantes en anglais').toEqual([]);
    expect(en.filter((k) => !fr.includes(k)), 'manquantes en francais').toEqual([]);
  });
});
