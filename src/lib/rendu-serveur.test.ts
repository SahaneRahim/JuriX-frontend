// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

/**
 * Les modules de `$lib` se chargent sans navigateur.
 *
 * Les pages sont rendues par le serveur (adapter-node) : un module qui lit
 * `window` ou `localStorage` des son chargement ne casse pas une page, il les
 * casse TOUTES, en 500. Aucun autre test ne le verrait : setup.ts installe un
 * faux `window` et un stockage pour les tests du navigateur, et vite.config.ts
 * force la resolution « browser » sous vitest.
 *
 * Chaque module est donc charge ici comme sur le serveur : `browser` faux, et
 * ni `window`, ni `localStorage`, ni `sessionStorage`.
 */
vi.mock('$app/environment', () => ({ browser: false, building: false, dev: false, version: 'test' }));

// Les modules réservés aux tests (`*-de-test.ts`) ne sont importés par aucun
// code de l'application : le serveur ne les charge jamais.
const modules = import.meta.glob([
  './**/*.ts',
  '!./**/*.test.ts',
  '!./**/*.spec.ts',
  '!./**/*.d.ts',
  '!./**/*-de-test.ts',
]);

const GLOBALES_DU_NAVIGATEUR = ['window', 'localStorage', 'sessionStorage'] as const;

describe('rendu serveur', () => {
  it("n'utilise pas un localStorage du processus quand window manque", async () => {
    // Node 25 expose un localStorage global, propre au processus et partage par
    // tous les visiteurs du serveur. Les gardes testent donc `window` d'abord :
    // un stockage present sans window ne doit jamais etre lu ni ecrit.
    const globales = globalThis as Record<string, unknown>;
    const sauvegarde = GLOBALES_DU_NAVIGATEUR.map((nom) => [nom, globales[nom]] as const);
    const acces: string[] = [];
    const piege = new Proxy({} as Storage, {
      get: (_cible, propriete) => {
        acces.push(String(propriete));
        return () => null;
      },
    });
    delete globales.window;
    globales.localStorage = piege;
    globales.sessionStorage = piege;
    try {
      vi.resetModules();
      const persona = await import('./stores/persona');
      const session = await import('./chat-session');
      persona.lirePersona();
      persona.lireAEnvoyer();
      persona.ecrireAEnvoyer(true);
      session.lireSessionChat();
      session.lirePersonaSessionChat();
      session.ecrireSessionChat('sid', 'avocat');
      expect(acces).toEqual([]);
    } finally {
      for (const [nom, valeur] of sauvegarde) globales[nom] = valeur;
    }
  });

  it('trouve les modules a verifier', () => {
    expect(Object.keys(modules)).toContain('./stores/auth.ts');
  });

  it.each(Object.keys(modules))('%s se charge sans window ni localStorage', async (chemin) => {
    const globales = globalThis as Record<string, unknown>;
    const sauvegarde = GLOBALES_DU_NAVIGATEUR.map((nom) => [nom, globales[nom]] as const);
    for (const nom of GLOBALES_DU_NAVIGATEUR) delete globales[nom];
    try {
      vi.resetModules();
      await expect(modules[chemin]()).resolves.toBeDefined();
    } finally {
      for (const [nom, valeur] of sauvegarde) globales[nom] = valeur;
    }
  });
});
