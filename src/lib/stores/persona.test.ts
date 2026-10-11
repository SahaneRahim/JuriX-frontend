import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

import { ecrireSessionChat, lireSessionChat } from '$lib/chat-session';
import {
  PERSONAS,
  champPersona,
  ecrireAEnvoyer,
  estRouteSansQuestion,
  estUnRobot,
  lireAEnvoyer,
  lirePersona,
  lireRefusSession,
  normaliserPersona,
  oublierPersona,
  personaDeLaSessionMemorisee,
  personaStore,
  questionAPoser,
} from './persona';

function viderLeCookie() {
  document.cookie = 'jurix-persona-refus=; Path=/; Max-Age=0';
}

describe('les profils', () => {
  it('etudiant est ecrit en NFC', () => {
    expect(PERSONAS).toContain('étudiant');
    for (const p of PERSONAS) expect(p).toBe(p.normalize('NFC'));
  });

  it('normalise ce qui designe un profil, et rien d autre', () => {
    expect(normaliserPersona('étudiant')).toBe('étudiant');
    expect(normaliserPersona('étudiant'.normalize('NFD'))).toBe('étudiant');
    for (const v of ['etudiant', 'Étudiant', '', 'general', null, 42, undefined]) {
      expect(normaliserPersona(v)).toBeNull();
    }
  });

  it('omet le profil general dans la requete, jamais null', () => {
    expect(champPersona(null)).toEqual({});
    expect(champPersona('avocat')).toEqual({ persona: 'avocat' });
  });
});

describe('ou et quand poser la question', () => {
  it.each([
    ['/admin', true],
    ['/admin/documents/batch-upload', true],
    ['/login', true],
    ['/signup', true],
    ['/forgot-password', true],
    ['/reset-password/[token]', true],
    ['/verify-email/[token]', true],
    [null, true],
    ['/(main)', false],
    ['/(main)/chat', false],
    ['/laws/[id]', false],
    ['/search', false],
    ['/about', false],
    ['/compare', false],
    ['/categories/[id]', false],
  ])('%s exclue : %s', (route, exclue) => {
    expect(estRouteSansQuestion(route)).toBe(exclue);
  });

  it('ne la pose pas aux robots d indexation', () => {
    expect(estUnRobot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(true);
    expect(estUnRobot('Mozilla/5.0 (Linux; Android 10) Chrome/120 Mobile Safari/537.36')).toBe(false);
  });

  it('la pose seulement sans profil, sans refus, hors erreur', () => {
    const sans = { persona: null, refuseCetteSession: false, choix: 0 };
    expect(questionAPoser(sans, '/', false, 'Firefox')).toBe(true);
    expect(questionAPoser({ ...sans, persona: 'avocat' }, '/', false, 'Firefox')).toBe(false);
    expect(questionAPoser({ ...sans, refuseCetteSession: true }, '/', false, 'Firefox')).toBe(false);
    expect(questionAPoser(sans, '/', true, 'Firefox')).toBe(false);
    expect(questionAPoser(sans, '/login', false, 'Firefox')).toBe(false);
    expect(questionAPoser(sans, '/', false, 'Googlebot')).toBe(false);
  });
});

describe('personaStore', () => {
  beforeEach(() => {
    viderLeCookie();
    personaStore._reinitialiser();
  });

  it('choisir memorise le profil et leve le refus', () => {
    personaStore.refuser();
    personaStore.choisir('avocat');

    expect(lirePersona()).toBe('avocat');
    expect(lireRefusSession()).toBe(false);
    expect(get(personaStore)).toMatchObject({ persona: 'avocat', refuseCetteSession: false });
  });

  it('refuser vaut pour la session, dans un cookie partage entre onglets', () => {
    personaStore.choisir('avocat');
    personaStore.refuser();

    expect(lirePersona()).toBeNull();
    expect(lireRefusSession()).toBe(true);
    expect(document.cookie).toContain('jurix-persona-refus=1');
    expect(sessionStorage.length).toBe(0);
  });

  it('seules les actions de l utilisateur comptent comme choix', () => {
    personaStore.choisir('citoyen');
    personaStore.appliquerDepuisCompte('entrepreneur');
    personaStore.relire();

    expect(get(personaStore).choix).toBe(1);
    expect(get(personaStore).persona).toBe('entrepreneur');
  });

  it('un choix efface la conversation memorisee d un autre profil, pas la sienne', () => {
    ecrireSessionChat('sid-citoyen', 'citoyen');
    personaStore.choisir('citoyen');
    expect(lireSessionChat()).toBe('sid-citoyen');

    personaStore.choisir('avocat');
    expect(lireSessionChat()).toBeNull();
  });

  it('un changement passif n efface jamais une conversation', () => {
    ecrireSessionChat('sid-avocat', 'avocat');

    personaStore.appliquerDepuisCompte('citoyen');

    expect(lireSessionChat()).toBe('sid-avocat');
  });

  it('une session d avant les profils vaut citoyen', () => {
    ecrireSessionChat('sid-ancienne');
    expect(personaDeLaSessionMemorisee()).toBe('citoyen');

    ecrireSessionChat('sid-generale', null);
    expect(personaDeLaSessionMemorisee()).toBeNull();
  });

  it('la deconnexion oublie le profil et pose le refus de session', () => {
    personaStore.choisir('étudiant');
    ecrireAEnvoyer(true);

    oublierPersona();

    expect(lirePersona()).toBeNull();
    expect(lireAEnvoyer()).toBe(false);
    expect(lireRefusSession()).toBe(true);
  });

  it('un stockage qui leve ne casse rien', () => {
    const casse = {
      getItem: () => { throw new Error('bloque'); },
      setItem: () => { throw new Error('bloque'); },
      removeItem: () => { throw new Error('bloque'); },
      clear: () => {},
    };
    vi.stubGlobal('localStorage', casse);
    try {
      expect(lirePersona()).toBeNull();
      expect(() => personaStore.choisir('avocat')).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
