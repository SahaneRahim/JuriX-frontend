import { describe, expect, it } from 'vitest';
import { FOOTER_LINKS, LIEN_ACCUEIL, NAV_LINKS, ONGLETS_DU_BAS, PAGES_DE_COMPTE, barreDuBasSur } from '$lib/nav';
import { translations } from '$lib/stores/language';

/**
 * Le manifeste des liens du site (src/lib/nav.ts), tel que la refonte A
 * l'a réparti (décision H3).
 *
 * POURQUOI. L'en-tête, le panneau du menu mobile, le pied de page, le menu
 * du chat et la page d'erreur lisent ces listes : un lien retiré par
 * mégarde disparaît de cinq endroits à la fois, et une clé mal recopiée
 * affiche « nav.chat » à l'écran. tests/e2e/navigation/link-integrity.spec.ts
 * vérifie que les liens répondent et qu'ils sont dans la page ; ici, ce qu'ils
 * sont, sans navigateur.
 */

const hrefs = (liens: readonly { href: string }[]) => liens.map((lien) => lien.href);

describe('NAV_LINKS : les quatre liens de l’en-tête', () => {
  it('« Assistant IA » en tête, puis Parcourir, Comparer et Blog', () => {
    // « Assistant IA » est la demande d'origine du projet : le bouton ouvre le chat.
    expect(NAV_LINKS.map((lien) => [lien.href, lien.key])).toEqual([
      ['/chat', 'nav.chat'],
      ['/laws', 'nav.parcourir'],
      ['/compare', 'nav.compare'],
      ['/blog', 'nav.blog'],
    ]);
  });

  it('ne garde ni « Accueil » (le logo y mène), ni « Recherche », ni « À propos »', () => {
    expect(hrefs(NAV_LINKS)).not.toContain('/');
    expect(hrefs(NAV_LINKS)).not.toContain('/search');
    expect(hrefs(NAV_LINKS)).not.toContain('/about');
  });

  it('range une catégorie et un texte sous « Parcourir », la conversation sous « Assistant IA »', () => {
    const actifs = (chemin: string) => NAV_LINKS.filter((lien) => lien.isActive(chemin)).map((lien) => lien.href);
    expect(actifs('/chat')).toEqual(['/chat']);
    expect(actifs('/laws')).toEqual(['/laws']);
    expect(actifs('/laws/42')).toEqual(['/laws']);
    expect(actifs('/categories/13')).toEqual(['/laws']);
    expect(actifs('/compare')).toEqual(['/compare']);
    expect(actifs('/blog/un-article')).toEqual(['/blog']);
    // Sur l'accueil, aucun lien de la barre : c'est le logo qui est courant.
    expect(actifs('/')).toEqual([]);
    expect(LIEN_ACCUEIL.isActive('/')).toBe(true);
    expect(LIEN_ACCUEIL.isActive('/laws')).toBe(false);
  });
});

describe('FOOTER_LINKS : tous les liens du site', () => {
  it('l’accueil en tête, les quatre de l’en-tête, puis Recherche, Contacts utiles et À propos', () => {
    expect(hrefs(FOOTER_LINKS)).toEqual(['/', '/chat', '/laws', '/compare', '/blog', '/search', '/annuaire', '/about']);
    expect(FOOTER_LINKS[0]).toBe(LIEN_ACCUEIL);
  });

  it('contient chaque lien de l’en-tête, le même objet : une seule définition par lien', () => {
    for (const lien of NAV_LINKS) expect(FOOTER_LINKS).toContain(lien);
  });

  it('n’a aucun lien en double', () => {
    expect(new Set(hrefs(FOOTER_LINKS)).size).toBe(FOOTER_LINKS.length);
  });
});

describe('les libellés', () => {
  it('existent en français et en anglais', () => {
    for (const { key } of FOOTER_LINKS) {
      expect(translations.fr[key as keyof typeof translations.fr], `${key} (fr)`).toBeTruthy();
      expect(translations.en[key as keyof typeof translations.en], `${key} (en)`).toBeTruthy();
    }
  });

  it('nomment « Assistant IA » comme le mode du même nom, dans les deux langues', () => {
    expect(translations.fr['nav.chat']).toBe(translations.fr['mode.chat']);
    expect(translations.en['nav.chat']).toBe(translations.en['mode.chat']);
  });
});

describe('PAGES_DE_COMPTE', () => {
  it('liste les cinq pages de compte', () => {
    expect([...PAGES_DE_COMPTE]).toEqual(['/login', '/signup', '/forgot-password', '/reset-password', '/verify-email']);
  });
});

describe('la barre d’onglets du bas (refonte A, H6)', () => {
  it('trois onglets : Accueil, Assistant IA, Parcourir, les mêmes liens que l’en-tête', () => {
    expect(ONGLETS_DU_BAS.map((lien) => [lien.href, lien.key])).toEqual([
      ['/', 'nav.home'],
      ['/chat', 'nav.chat'],
      ['/laws', 'nav.parcourir'],
    ]);
    expect(ONGLETS_DU_BAS[0]).toBe(LIEN_ACCUEIL);
    for (const onglet of ONGLETS_DU_BAS.slice(1)) expect(NAV_LINKS).toContain(onglet);
  });

  it('paraît sur les pages publiques, page d’erreur comprise', () => {
    for (const chemin of ['/', '/laws', '/laws/42', '/categories/13', '/search', '/compare', '/blog', '/blog/un-article', '/about', '/page-inconnue']) {
      expect(barreDuBasSur(chemin), chemin).toBe(true);
    }
  });

  it('jamais sur /chat, dans l’administration ni sur les pages de compte', () => {
    for (const chemin of ['/chat', '/admin', '/admin/users', ...PAGES_DE_COMPTE, '/reset-password/jeton', '/verify-email/jeton']) {
      expect(barreDuBasSur(chemin), chemin).toBe(false);
    }
    // Un préfixe n'est pas une page : /chatons ou /administration resteraient publiques.
    expect(barreDuBasSur('/chatons')).toBe(true);
    expect(barreDuBasSur('/administration')).toBe(true);
  });
});
