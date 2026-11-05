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
 * DEUX LISTES DEPUIS LA REFONTE A (décision H3, docs/refonte/PASSATION.md).
 * L'en-tête ne montre plus que les quatre liens des maquettes ; le reste du
 * site garde une liste complète :
 * - `NAV_LINKS`, les quatre liens de l'en-tête (« Assistant IA », « Parcourir »,
 *   « Comparer », « Blog »), lus par la barre de bureau et le panneau du menu
 *   mobile ; la page d'erreur s'en sert pour ne pas répéter, à partir de lg,
 *   ceux que la barre affiche déjà. « Assistant IA » y est obligatoire : c'est
 *   la demande d'origine du projet (« le bouton Assistant IA doit ouvrir le
 *   chat »). « Accueil » n'y est plus : le logo est le lien d'accueil, et il
 *   porte `aria-current="page"` sur l'accueil (SiteHeader.svelte).
 * - `FOOTER_LINKS`, tous les liens, « Accueil » en tête : ceux d'avant la
 *   refonte, plus `/chat`. Lue par le pied de page (privée de `/`, que son logo
 *   porte déjà), par le menu du chat et par la page d'erreur (dont le pied de
 *   page n'a pas de liens). « Recherche » et « À propos », sortis de
 *   l'en-tête, restent ainsi atteignables partout : le pied de page est le
 *   seul retour des pages longues (`/laws`, `/laws/[id]`, `/categories/[id]`)
 *   une fois l'en-tête défilé hors de l'écran.
 *
 * Le test Playwright `tests/e2e/navigation/link-integrity.spec.ts` parcourt
 * les deux listes : chaque lien doit répondre, ceux de `NAV_LINKS` être dans
 * l'en-tête, ceux de `FOOTER_LINKS` dans le pied de page. La garantie « chaque
 * lien mène quelque part » devient vérifiable au lieu d'être seulement
 * affirmée. Ajouter une entrée ici la fait tester automatiquement ; en ajouter
 * une ailleurs ne la teste pas.
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

/**
 * L'accueil. Hors de l'en-tête, où le logo le remplace (et reprend son
 * prédicat pour `aria-current`) ; en tête de `FOOTER_LINKS`.
 */
export const LIEN_ACCUEIL: NavLink = { href: '/', key: 'nav.home', isActive: (p) => p === '/' };

export const NAV_LINKS: readonly NavLink[] = [
  // « Assistant IA » et non « Chat » : le nom du mode dans tout le site
  // (`mode.chat`). Sa clé est distincte (`nav.chat`, même texte) : un lien de
  // ce manifeste porte sa propre clé.
  { href: '/chat', key: 'nav.chat', isActive: (p) => p.startsWith('/chat') },
  // « Parcourir » mène à la liste de tous les textes, et non à l'ancre
  // `/#domaines` de l'accueil (décision H4). La page d'une catégorie
  // (/categories/13) y est rangée, comme dans le fil d'Ariane d'un texte :
  // aucune entrée n'y serait active sinon.
  {
    href: '/laws',
    key: 'nav.parcourir',
    isActive: (p) => p.startsWith('/laws') || p.startsWith('/categories'),
  },
  { href: '/compare', key: 'nav.compare', isActive: (p) => p.startsWith('/compare') },
  { href: '/blog', key: 'nav.blog', isActive: (p) => p.startsWith('/blog') },
] as const;

export const FOOTER_LINKS: readonly NavLink[] = [
  LIEN_ACCUEIL,
  ...NAV_LINKS,
  // `/search` existe depuis longtemps mais n'était atteignable que depuis un
  // lien secondaire de `/laws` : le pied de page le garde, en plus de la loupe
  // (palette Ctrl K) de l'en-tête.
  { href: '/search', key: 'nav.search', isActive: (p) => p.startsWith('/search') },
  { href: '/about', key: 'nav.about', isActive: (p) => p === '/about' },
] as const;

/**
 * Les pages de compte, dont la carte porte déjà le bouton principal de la
 * page (« Se connecter », « Envoyer le lien »…). L'en-tête y fait de « Créer
 * un compte » un bouton secondaire ; la barre d'onglets du bas de la refonte
 * (décision H6) n'y paraîtra pas. Une page de compte est l'une d'elles ou une
 * de leurs sous-pages (`/reset-password/<jeton>`).
 */
export const PAGES_DE_COMPTE: readonly string[] = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
] as const;

/**
 * Les trois onglets de la barre du bas, sous md (refonte A, décision H6) :
 * Accueil, Assistant IA, Parcourir. Les mêmes objets que l'accueil et les
 * deux premiers liens de l'en-tête : un lien n'a qu'une définition, et son
 * prédicat d'état actif (« Parcourir » reste actif sur /laws/42 et sur
 * /categories/13) vaut pour l'onglet comme pour la barre du bureau. Pas
 * d'onglet « Chercher » : le mode « Recherche » du champ unique suffit (A1
 * § 3).
 */
export const ONGLETS_DU_BAS: readonly NavLink[] = [
  LIEN_ACCUEIL,
  ...NAV_LINKS.filter((lien) => lien.href === '/chat' || lien.href === '/laws'),
];

/**
 * La barre d'onglets du bas paraît-elle sur ce chemin ?
 *
 * Non sur /chat (sa saisie est en bas de l'écran, au-dessus du clavier : une
 * barre fixe de 64 px la réduirait, et l'onglet « Assistant IA » y mènerait à
 * la page même), ni dans l'administration (sa propre barre latérale), ni sur
 * les pages de compte, dont la carte porte déjà l'action de la page. Oui
 * partout ailleurs, page d'erreur comprise : elle est le retour le plus
 * proche du pouce. Lu par la barre (BarreDOnglets.svelte) et par le pied de
 * page, qui lui réserve sa place.
 */
export function barreDuBasSur(chemin: string): boolean {
  const sous = (racine: string) => chemin === racine || chemin.startsWith(`${racine}/`);
  if (sous('/chat') || sous('/admin')) return false;
  return !PAGES_DE_COMPTE.some(sous);
}
