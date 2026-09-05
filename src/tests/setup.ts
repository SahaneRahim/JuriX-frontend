import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock browser environment.
// `global.window || {}` produisait le type `Window | {}`, que TypeScript refuse
// d'assigner a `global.window`. jsdom/happy-dom fournissent deja `window` :
// l'affectation ne sert que de garde-fou si l'environnement ne le fait pas.
if (!global.window) {
  global.window = {} as unknown as Window & typeof globalThis;
}

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
// `as unknown as Storage` et non `as any` : le double cast dit exactement ce
// qu'on affirme — cet objet TIENT LIEU de Storage sans en implementer toute la
// surface (`length`, `key()`). `any` desactivait le controle sur la ligne
// entiere, y compris sur le nom de la globale.
global.localStorage = localStorageMock as unknown as Storage;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.sessionStorage = sessionStorageMock as unknown as Storage;

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

// Reset mocks before each test
beforeEach(() => {
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  sessionStorageMock.getItem.mockClear();
  sessionStorageMock.setItem.mockClear();
  sessionStorageMock.removeItem.mockClear();
});
