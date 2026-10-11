import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

import { goto } from '$app/navigation';
import { authStore } from '$lib/stores/auth';
import { lireAEnvoyer, lirePersona, personaStore } from '$lib/stores/persona';
import {
  _reinitialiserEnvois,
  changerPersona,
  lireValeurDuCompte,
  reconcilierPersonaALaConnexion,
  refuserPourCetteSession,
  synchroniserPersonaAuDemarrage,
} from './persona-compte';

const UTILISATEUR = { id: 1, email: 'a@b.cm', role: 'user' as const };

function repondreAvec(...reponses: Array<Response | Error>) {
  const appels: Array<{ url: string; init?: RequestInit }> = [];
  const file = [...reponses];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    appels.push({ url, init });
    const suivante = file.shift() ?? new Response('{}', { status: 200 });
    if (suivante instanceof Error) throw suivante;
    return suivante;
  }));
  return appels;
}

const json = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } });

function connecte() {
  repondreAvec(); // authStore.login ne fait pas d'appel, mais logout si
  authStore.login(UTILISATEUR, 'jeton');
}

beforeEach(() => {
  // Chaque test part deconnecte : sinon tous ceux qui suivent le premier
  // `connecte()` tournaient deja connectes, « a la connexion » compris.
  repondreAvec();
  authStore.logout();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.cookie = 'jurix-persona-refus=; Path=/; Max-Age=0';
  personaStore._reinitialiser();
  _reinitialiserEnvois();
  vi.mocked(goto).mockClear();
});

describe('lireValeurDuCompte', () => {
  it('distingue profil, absence de profil et rien a adopter', () => {
    expect(lireValeurDuCompte({ persona: 'avocat' })).toBe('avocat');
    expect(lireValeurDuCompte({ persona: null })).toBeNull();
    expect(lireValeurDuCompte({ email: 'a@b.cm' })).toBeUndefined();
    expect(lireValeurDuCompte({ persona: 'astronaute' })).toBeUndefined();
  });
});

describe('au demarrage', () => {
  it('anonyme : aucun appel', async () => {
    const appels = repondreAvec();

    await synchroniserPersonaAuDemarrage();

    expect(appels).toHaveLength(0);
  });

  it('le profil du compte est adopte', async () => {
    connecte();
    repondreAvec(json({ persona: 'entrepreneur' }));

    await synchroniserPersonaAuDemarrage();

    expect(get(personaStore).persona).toBe('entrepreneur');
    expect(lirePersona()).toBe('entrepreneur');
  });

  it('un compte a null efface le profil local (le compte fait foi)', async () => {
    connecte();
    personaStore.appliquerDepuisCompte('avocat');
    repondreAvec(json({ persona: null }));

    await synchroniserPersonaAuDemarrage();

    expect(get(personaStore).persona).toBeNull();
  });

  it('un envoi en attente part au lieu de la lecture', async () => {
    connecte();
    const appels = repondreAvec(new Error('reseau'));
    await changerPersona('étudiant');
    expect(lireAEnvoyer()).toBe(true);

    const suivants = repondreAvec(json({ persona: 'étudiant' }));
    await synchroniserPersonaAuDemarrage();

    expect(appels[0].init?.method).toBe('PATCH');
    expect(suivants).toHaveLength(1);
    expect(suivants[0].init?.method).toBe('PATCH');
    expect(JSON.parse(String(suivants[0].init?.body))).toEqual({ persona: 'étudiant' });
    await vi.waitFor(() => expect(lireAEnvoyer()).toBe(false));
  });

  it('un envoi en attente ne fait pas attendre la page', async () => {
    connecte();
    repondreAvec(new Error('reseau'));
    await changerPersona('étudiant');
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {}))); // ne repond jamais

    await synchroniserPersonaAuDemarrage(); // rend la main quand meme

    expect(lireAEnvoyer()).toBe(true);
  });

  it('la lecture est abandonnee apres 4 s, le profil local reste', async () => {
    connecte();
    personaStore.appliquerDepuisCompte('avocat');
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) =>
      new Promise<Response>((_r, rejeter) => {
        init?.signal?.addEventListener('abort', () => rejeter(new DOMException('abandon', 'AbortError')));
      }),
    ));

    const enCours = synchroniserPersonaAuDemarrage();
    await vi.advanceTimersByTimeAsync(4000);
    await enCours;

    expect(get(personaStore).persona).toBe('avocat');
  });

  it('une deconnexion pendant la lecture : le profil du compte ne revient pas', async () => {
    connecte();
    let liberer: (r: Response) => void = () => {};
    vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? Promise.resolve(new Response('', { status: 200 })) // /auth/logout
        : new Promise<Response>((r) => { liberer = r; }),
    ));

    const enCours = synchroniserPersonaAuDemarrage();
    authStore.logout();
    liberer(json({ persona: 'avocat' }));
    await enCours;

    expect(get(personaStore).persona).toBeNull();
    expect(lirePersona()).toBeNull();
  });

  it('un profil choisi dans un autre onglet pendant la lecture l emporte', async () => {
    connecte();
    let liberer: (r: Response) => void = () => {};
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((r) => { liberer = r; })));

    const enCours = synchroniserPersonaAuDemarrage();
    localStorage.setItem('jurix-persona', 'avocat');
    personaStore.relire(); // ce que fait l'evenement storage
    liberer(json({ persona: null }));
    await enCours;

    expect(get(personaStore).persona).toBe('avocat');
  });

  it('une cle absente (backend ancien) ne change rien', async () => {
    connecte();
    personaStore.appliquerDepuisCompte('avocat');
    repondreAvec(json({ email: 'a@b.cm' }));

    await synchroniserPersonaAuDemarrage();

    expect(get(personaStore).persona).toBe('avocat');
  });

  it('un 401 en arriere-plan ne deconnecte pas et ne redirige pas', async () => {
    connecte();
    repondreAvec(json({ detail: 'expire' }, 401));

    await synchroniserPersonaAuDemarrage();

    expect(get(authStore).isAuthenticated).toBe(true);
    expect(goto).not.toHaveBeenCalled();
  });

  it('une erreur reseau ne change rien', async () => {
    connecte();
    personaStore.appliquerDepuisCompte('citoyen');
    repondreAvec(new Error('hors ligne'));

    await synchroniserPersonaAuDemarrage();

    expect(get(personaStore).persona).toBe('citoyen');
  });

  it('un choix fait pendant la lecture l emporte', async () => {
    connecte();
    let liberer: (r: Response) => void = () => {};
    vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) =>
      init?.method === 'PATCH'
        ? Promise.resolve(json({ persona: 'avocat' }))
        : new Promise<Response>((r) => { liberer = r; }),
    ));

    const enCours = synchroniserPersonaAuDemarrage();
    await changerPersona('avocat');
    liberer(json({ persona: 'citoyen' }));
    await enCours;

    expect(get(personaStore).persona).toBe('avocat');
  });
});

describe('les envois', () => {
  it('anonyme : un changement ne part pas sur le compte', async () => {
    const appels = repondreAvec();

    await changerPersona('avocat');

    expect(appels).toHaveLength(0);
    expect(get(personaStore).persona).toBe('avocat');
  });

  it('seul le dernier envoi leve le drapeau', async () => {
    connecte();
    let premier: (r: Response) => void = () => {};
    vi.stubGlobal('fetch', vi.fn()
      .mockImplementationOnce(() => new Promise<Response>((r) => { premier = r; }))
      .mockResolvedValueOnce(json({ detail: 'panne' }, 500)));

    const lent = changerPersona('avocat');
    await changerPersona('citoyen'); // echoue : citoyen reste a envoyer
    premier(json({ persona: 'avocat' })); // l'ancien envoi arrive apres
    await lent;

    expect(lireAEnvoyer()).toBe(true);
  });
  it('un 422 leve le drapeau : inutile de renvoyer', async () => {
    connecte();
    repondreAvec(json({ detail: 'invalide' }, 422));

    await changerPersona('avocat');

    expect(lireAEnvoyer()).toBe(false);
  });

  it('« Ne pas repondre » ne touche jamais le compte', async () => {
    connecte();
    const appels = repondreAvec();

    refuserPourCetteSession();

    expect(appels).toHaveLength(0);
    expect(get(personaStore).refuseCetteSession).toBe(true);
  });

  it('« Profil general » depuis l en-tete efface aussi le profil du compte', async () => {
    connecte();
    const appels = repondreAvec(json({ persona: null }));

    await changerPersona(null);

    expect(JSON.parse(String(appels[0].init?.body))).toEqual({ persona: null });
  });
});

describe('a la connexion', () => {
  it('le profil du compte l emporte', () => {
    personaStore.choisir('citoyen');

    reconcilierPersonaALaConnexion({ persona: 'avocat' });

    expect(get(personaStore).persona).toBe('avocat');
  });

  it('un compte sans profil n herite pas du choix du navigateur', async () => {
    personaStore.choisir('étudiant');
    connecte();

    reconcilierPersonaALaConnexion({ persona: null });
    const appels = repondreAvec(json({ persona: null }));
    await synchroniserPersonaAuDemarrage(); // visite suivante

    expect(appels.map((a) => a.init?.method ?? 'GET')).toEqual(['GET']);
  });

  it('un envoi en attente d une session precedente ne part jamais sur ce compte', async () => {
    // Alice choisit « avocat », l'envoi echoue, elle part sans se deconnecter.
    connecte();
    repondreAvec(new Error('reseau'));
    await changerPersona('avocat');
    expect(lireAEnvoyer()).toBe(true);

    // Bob se connecte sur le meme navigateur ; son compte n'a pas de profil.
    reconcilierPersonaALaConnexion({ persona: null });
    const appels = repondreAvec(json({ persona: null }));
    await synchroniserPersonaAuDemarrage();

    expect(lireAEnvoyer()).toBe(false);
    expect(appels.map((a) => a.init?.method ?? 'GET')).toEqual(['GET']);
  });
});
