import { beforeEach, describe, expect, it } from 'vitest';
import { ecrireSessionChat, effacerSessionChat, lireSessionChat } from './chat-session';

describe('chat-session', () => {
  beforeEach(() => localStorage.clear());

  it('rend null quand rien n est enregistre', () => {
    expect(lireSessionChat()).toBeNull();
  });

  it('conserve un identifiant d une visite a l autre', () => {
    ecrireSessionChat('9f1c-abcd');
    expect(lireSessionChat()).toBe('9f1c-abcd');
  });

  it('traite une valeur vide comme absente', () => {
    // Envoyer `session_id: ""` au serveur creerait une conversation neuve a
    // chaque message, ce qui est exactement le defaut que ce module corrige.
    localStorage.setItem('jurix-chat-session', '   ');
    expect(lireSessionChat()).toBeNull();
  });

  it('efface', () => {
    ecrireSessionChat('9f1c-abcd');
    effacerSessionChat();
    expect(lireSessionChat()).toBeNull();
  });

  it('ecrire null efface aussi', () => {
    ecrireSessionChat('9f1c-abcd');
    ecrireSessionChat(null);
    expect(lireSessionChat()).toBeNull();
  });
});
