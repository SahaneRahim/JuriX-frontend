/**
 * Manifeste des liens de navigation du site public.
 *
 * POURQUOI CE MODULE EXISTE. Les liens du header étaient écrits deux fois — une
 * fois dans `src/routes/(main)/+layout.svelte`, une seconde à la main dans
 * `src/routes/search/+page.svelte` — et les deux copies avaient divergé : un
 * lien vers `/categories` (route inexistante) a dû être corrigé séparément dans
 * chacune, et le bouton flottant « assistant » pointait vers `/` d'un côté et
 * `/chat` de l'autre.
 *
 * Quatre consommateurs lisent désormais cette liste : la navigation de bureau,
 * le panneau mobile, le pied de page, et le test Playwright
 * `tests/e2e/navigation/link-integrity.spec.ts`. C'est ce dernier point qui
 * compte : la garantie « chaque lien mène quelque part » devient vérifiable au
 * lieu d'être seulement affirmée. Ajouter une entrée ici la fait tester
 * automatiquement ; en ajouter une ailleurs ne la teste pas.
 *
 * `/search` figure dans la liste : la page existe depuis longtemps mais n'était
 * atteignable que depuis un lien secondaire de `/laws`.
 */

export interface NavLink {
  /** Cible. Doit correspondre à une route réelle sous src/routes/. */
  href: string;
  /** Clé de traduction, résolue par `$tr` (src/lib/stores/language.ts). */
  key: string;
  /**
   * Le lien est-il « actif » pour ce chemin ?
   *
   * Un prédicat plutôt qu'une comparaison d'égalité : `/laws` doit rester
   * souligné quand on lit `/laws/42`, sans quoi l'utilisateur perd le repère de
   * la section où il se trouve dès qu'il ouvre un document.
   */
  isActive: (pathname: string) => boolean;
}

export const NAV_LINKS: readonly NavLink[] = [
  { href: '/', key: 'nav.home', isActive: (p) => p === '/' },
  { href: '/laws', key: 'nav.documents', isActive: (p) => p.startsWith('/laws') },
  { href: '/search', key: 'nav.search', isActive: (p) => p.startsWith('/search') },
  { href: '/about', key: 'nav.about', isActive: (p) => p === '/about' },
] as const;
