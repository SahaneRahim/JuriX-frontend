// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';

/**
 * L'en-tête tel que le serveur l'envoie, avant tout JavaScript.
 *
 * POURQUOI (proposition P8). Sur un téléphone lent, le visiteur voit et touche
 * ce HTML pendant que les scripts se téléchargent ; dans Opera Mini en mode
 * Extreme, ou avec les scripts bloqués, il n'aura jamais rien d'autre. La loupe
 * de l'en-tête ouvrait la palette (Ctrl K), qui n'existe qu'en JavaScript : un
 * appui avant l'hydratation ne faisait rien. Elle doit donc arriver en VRAI
 * lien vers /search, et ne devenir le bouton de la palette qu'au montage
 * (SiteHeader.test.ts vérifie ce second état). Un test e2e sans JavaScript le
 * vérifie aussi dans le navigateur (tests/e2e/navigation/ux-accueil.spec.ts).
 */

vi.mock('$app/environment', () => ({ browser: false, building: false, dev: false, version: 'test' }));
vi.mock('$app/navigation', () => ({ afterNavigate: () => {}, goto: async () => {} }));
vi.mock('$app/stores', async () => {
  const { readable } = await import('svelte/store');
  return {
    page: readable({ url: new URL('http://site/'), route: { id: '/(main)' }, params: {}, data: {}, error: null }),
  };
});

// Comme sur le serveur : ni `window` ni stockage, le temps du chargement et du
// rendu. src/tests/setup.ts pose un faux `window` pour les tests du
// navigateur ; les stores le prendraient pour un vrai (même procédé que
// src/lib/rendu-serveur.test.ts). Rendus aussitôt après : le `beforeEach` de
// setup.ts vide le stockage avant chaque test.
const globales = globalThis as Record<string, unknown>;
const sauvegarde = (['window', 'localStorage', 'sessionStorage'] as const).map((nom) => [nom, globales[nom]] as const);
for (const [nom] of sauvegarde) delete globales[nom];
let body = '';
try {
  const { default: SiteHeader } = await import('./SiteHeader.svelte');
  body = render(SiteHeader, { props: {} }).body;
} finally {
  for (const [nom, valeur] of sauvegarde) globales[nom] = valeur;
}

/** Les balises ouvrantes d'un HTML qui mènent à `href`, avec leurs attributs. */
function liensVers(html: string, href: string): string[] {
  return [...html.matchAll(/<a\b[^>]*>/g)].map((m) => m[0]).filter((balise) => balise.includes(`href="${href}"`));
}

describe('SiteHeader au rendu serveur', () => {
  it('envoie les deux loupes en liens vers /search, nommés', () => {
    // La loupe du bureau (xl et plus) et celle du téléphone (sous xl), plus
    // le lien « Recherche » de la navigation : trois liens vers /search.
    const loupes = liensVers(body, '/search').filter((balise) => balise.includes('aria-label='));
    expect(loupes).toHaveLength(2);
    for (const loupe of loupes) {
      expect(loupe).toMatch(/aria-label="Ouvrir la page de recherche"/);
      // De vrais liens jusqu'au montage : ni rôle de bouton ni boîte
      // annoncée, que rien n'ouvrirait sans JavaScript. Le montage les
      // ajoute au même élément (SiteHeader.test.ts).
      expect(loupe).not.toContain('role=');
      expect(loupe).not.toContain('aria-haspopup');
    }
  });

  it('n’envoie aucun bouton de palette, qui ne marcherait pas sans JavaScript', () => {
    expect(body).not.toMatch(/<button\b[^>]*aria-haspopup="dialog"[^>]*>\s*(<!--[^>]*-->\s*)*<svg[^>]*data-icone="search"/);
    // Le nom de la palette (« Recherche et actions rapides », interface en
    // français au rendu serveur) n'apparaît qu'au montage.
    expect(body).not.toContain('Recherche et actions rapides');
  });

  it('garde les repères des tests e2e', () => {
    for (const testid of ['site-header', 'site-logo', 'nav-mobile-toggle', 'nav-reglages-toggle', 'theme-toggle', 'lang-fr', 'lang-en', 'persona-toggle', 'nav-signup']) {
      expect(body, testid).toContain(`data-testid="${testid}"`);
    }
  });

  it('aligne la navigation sur le logo, sans grille centrée', () => {
    // Reste r3 n° 3 : la grille `1fr auto 1fr` décentrait les liens dès que
    // les actions dépassaient leur moitié de barre.
    expect(body).not.toContain('lg:grid-cols-[1fr_auto_1fr]');
    expect(body).toMatch(/<nav class="[^"]*lg:ml-2[^"]*"/);
  });
});
