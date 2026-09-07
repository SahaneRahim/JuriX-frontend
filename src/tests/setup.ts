import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock browser environment.
// `global.window || {}` produisait le type `Window | {}`, que TypeScript refuse
// d'assigner a `global.window`. jsdom/happy-dom fournissent deja `window` :
// l'affectation ne sert que de garde-fou si l'environnement ne le fait pas.
if (!global.window) {
  global.window = {} as unknown as Window & typeof globalThis;
}

// Stockage local et de session : une VRAIE implementation en memoire.
//
// C'etaient auparavant quatre `vi.fn()` sans corps. `getItem` rendait donc
// toujours `undefined`, quoi qu'on ait ecrit — et tout test qui ecrivait puis
// relisait passait sans rien prouver. Un test de persistance de session
// affirmant `toBeNull()` apres un `setItem` etait vert, alors que le code
// aurait pu ne rien enregistrer du tout.
//
// Un stockage qui avale les ecritures est pire qu'aucun stockage : il rend les
// tests optimistes en silence.
function stockageEnMemoire(): Storage {
  let donnees: Record<string, string> = {};
  return {
    getItem: (cle: string) => (cle in donnees ? donnees[cle] : null),
    setItem: (cle: string, valeur: string) => {
      donnees[cle] = String(valeur);
    },
    removeItem: (cle: string) => {
      delete donnees[cle];
    },
    clear: () => {
      donnees = {};
    },
    key: (index: number) => Object.keys(donnees)[index] ?? null,
    get length() {
      return Object.keys(donnees).length;
    },
  } as Storage;
}

global.localStorage = stockageEnMemoire();
global.sessionStorage = stockageEnMemoire();

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Isolation entre tests : vider le stockage, plutot que remettre a zero des
// compteurs d'appels qui n'existent plus.
beforeEach(() => {
  // Appels optionnels : un test peut remplacer la globale par son propre
  // stub, qui ne porte pas forcement toute la surface de Storage.
  localStorage?.clear?.();
  sessionStorage?.clear?.();
});
