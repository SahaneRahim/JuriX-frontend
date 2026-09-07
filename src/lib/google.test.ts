import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('chargerGis', () => {
  beforeEach(() => {
    vi.resetModules();
    document.head.innerHTML = '';
  });

  it('rend false sans identifiant client, sans injecter de script', async () => {
    // C'est le cas de la CI et de tout deploiement qui n'active pas Google :
    // le bouton ne doit pas etre rendu, et la page doit rester fonctionnelle.
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
    const { chargerGis } = await import('./google');

    expect(await chargerGis()).toBe(false);
    expect(document.getElementById('gsi-client')).toBeNull();
  });

  it('injecte le script une seule fois, meme appele deux fois', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'un-id.apps.googleusercontent.com');
    const { chargerGis } = await import('./google');

    const premier = chargerGis();
    const second = chargerGis();
    // Simule le chargement reussi du script injecte.
    document.getElementById('gsi-client')?.dispatchEvent(new Event('load'));

    expect(await premier).toBe(true);
    expect(await second).toBe(true);
    expect(document.querySelectorAll('#gsi-client')).toHaveLength(1);
  });

  it('rend false si le script ne charge pas', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'un-id.apps.googleusercontent.com');
    const { chargerGis } = await import('./google');

    const promesse = chargerGis();
    document.getElementById('gsi-client')?.dispatchEvent(new Event('error'));

    expect(await promesse).toBe(false);
  });

  it('googleDisponible reflete la presence de l identifiant', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
    const sans = await import('./google');
    expect(sans.googleDisponible()).toBe(false);

    vi.resetModules();
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'un-id');
    const avec = await import('./google');
    expect(avec.googleDisponible()).toBe(true);
  });
});
