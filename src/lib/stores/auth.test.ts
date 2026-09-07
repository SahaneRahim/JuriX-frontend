import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: true }));

import { ecrireSessionChat, lireSessionChat } from '$lib/chat-session';
import { authStore } from './auth';

const UTILISATEUR = { id: 1, email: 'a@b.cm', role: 'user' as const };

describe('authStore et la session de chat', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 200 })));
  });

  it('la connexion efface la conversation en cours', () => {
    // Sinon le session_id herite d'une session anonyme — ou du compte
    // precedent sur le meme navigateur — ferait repondre 404 a chaque
    // question, le serveur refusant desormais le session_id d'autrui.
    ecrireSessionChat('conversation-precedente');

    authStore.login(UTILISATEUR, 'jeton');

    expect(lireSessionChat()).toBeNull();
  });

  it('la deconnexion efface la conversation en cours', () => {
    authStore.login(UTILISATEUR, 'jeton');
    ecrireSessionChat('ma-conversation');

    authStore.logout();

    expect(lireSessionChat()).toBeNull();
  });

  it('la connexion enregistre le jeton et l utilisateur', () => {
    authStore.login(UTILISATEUR, 'jeton-abc');

    expect(localStorage.getItem('jurix-auth-token')).toBe('jeton-abc');
    let etat: { isAuthenticated: boolean; user: { email: string } | null } | undefined;
    authStore.subscribe((s) => (etat = s))();
    expect(etat?.isAuthenticated).toBe(true);
    expect(etat?.user?.email).toBe('a@b.cm');
  });

  it('la deconnexion vide tout', () => {
    authStore.login(UTILISATEUR, 'jeton-abc');

    authStore.logout();

    expect(localStorage.getItem('jurix-auth-token')).toBeNull();
    expect(localStorage.getItem('jurix-auth-user')).toBeNull();
    let etat: { isAuthenticated: boolean } | undefined;
    authStore.subscribe((s) => (etat = s))();
    expect(etat?.isAuthenticated).toBe(false);
  });
});
