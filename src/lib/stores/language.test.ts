import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { language, t, translations, switchLanguage } from './language';

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
    language.set({ current: 'fr' });
  });

  it('la langue par defaut est le francais', () => {
    expect(get(language).current).toBe('fr');
  });

  it('change la langue courante', () => {
    switchLanguage('en');
    expect(get(language).current).toBe('en');
    switchLanguage('fr');
    expect(get(language).current).toBe('fr');
  });
});

// Neuf tests ont ete retires avec le code qu'ils exercaient : languageFilter,
// toggleShowAll, languageStore et le champ showAllLanguages n'avaient plus
// aucun consommateur depuis la suppression de ShowAllLanguagesToggle.svelte.
// Des tests verts sur du code que personne n'appelle donnent une couverture
// qui rassure a tort.


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
