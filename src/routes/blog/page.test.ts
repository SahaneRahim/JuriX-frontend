import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BLOG_POSTS, type BlogPost } from '$lib/data/blog';
import Page from './+page.svelte';

/**
 * La liste du blog, montée dans jsdom avec les vrais textes de l'interface :
 * un seul lien par carte, posé sur le titre (Q3 A), aucune chasse fixe ni
 * point qui pulse (Q1 A, Q5 A), et aucun chiffre ni promesse sans donnée.
 */

vi.mock('$app/stores', async () => {
  const { writable } = await import('svelte/store');
  return { page: writable({ url: new URL('http://localhost/blog'), state: {}, params: {} }) };
});
vi.mock('$lib/components/SiteHeader.svelte', () => ({ default: () => {} }));
vi.mock('$lib/components/SiteFooter.svelte', () => ({ default: () => {} }));
vi.mock('$lib/components/MetaSeo.svelte', () => ({ default: () => {} }));

// jsdom n'a pas l'API Web Animations, dont les transitions de Svelte 5 ont besoin.
Element.prototype.animate = vi.fn(() => ({
  onfinish: null,
  cancel: vi.fn(),
  finished: Promise.resolve(),
  currentTime: 0,
})) as unknown as typeof Element.prototype.animate;

afterEach(() => cleanup());

describe('/blog', () => {
  it('un lien par article, sur son titre, étendu à la carte', () => {
    const { container } = render(Page, { props: { data: { posts: BLOG_POSTS } } });

    for (const post of BLOG_POSTS) {
      const liens = container.querySelectorAll(`a[href="/blog/${post.slug}"]`);
      expect(liens, post.slug).toHaveLength(1);
      expect(liens[0].closest('h2, h3'), post.slug).not.toBeNull();
      expect(liens[0].className).toContain('after:inset-0');
    }
    expect(container.textContent).not.toContain('Consulter');
    expect(container.textContent).not.toContain('Lire le décryptage complet');
  });

  it('deux voix, aucun point qui pulse, rien d’affirmé sans donnée', () => {
    const { container } = render(Page, { props: { data: { posts: BLOG_POSTS } } });

    expect(container.querySelector('.font-mono')).toBeNull();
    expect(container.querySelector('[class*="animate-pulse"]')).toBeNull();
    const texte = container.textContent ?? '';
    expect(texte).not.toMatch(/2\s?200|43\s?000|temps réel|Chaque semaine|en vigueur|de la semaine/);
    expect(texte).toContain('Analyses rédigées avec l’IA');
    expect(texte).toContain('Le droit face à l’actualité');
  });

  it('date et durée séparées par le point médian des listes, et non par une puce', () => {
    const { container } = render(Page, { props: { data: { posts: BLOG_POSTS } } });
    const texte = container.textContent ?? '';
    expect(texte).not.toContain('•');
    // « 24 octobre 2026 · 4 min de lecture », l'espace insécable avant le point.
    expect(texte.match(/2026\u00a0· \d+ min de lecture/g)).toHaveLength(BLOG_POSTS.length);
  });

  it('la tuile à la une montre l’icône de la rubrique, domaine juridique ou non', () => {
    // « Immobilier » et « Numérique » ne sont pas des domaines juridiques :
    // la tuile y montrait l'icône d'un domaine inconnu (scroll-text).
    const iconeDeLaTuile = (rubrique: string) => {
      const post = { ...BLOG_POSTS[0], category: rubrique as BlogPost['category'] };
      const { container, unmount } = render(Page, { props: { data: { posts: [post] } } });
      const nom = container.querySelector('section[aria-label="Article à la une"] article > div:last-child svg')?.getAttribute('data-icone');
      unmount();
      return nom;
    };
    expect(iconeDeLaTuile('Immobilier')).toBe('house');
    expect(iconeDeLaTuile('Immobilier & Logement')).toBe('house');
    expect(iconeDeLaTuile('Numérique')).toBe('monitor-smartphone');
    expect(iconeDeLaTuile('Consommation')).toBe('shopping-cart');
    expect(iconeDeLaTuile('Actualité juridique')).toBe('newspaper');
    // Une rubrique qui nomme un domaine garde l'icône du domaine.
    expect(iconeDeLaTuile('Travail & Emploi')).toBe('hard-hat');
    expect(iconeDeLaTuile('Droit pénal')).toBe('gavel');
    // Inconnue : le texte juridique générique.
    expect(iconeDeLaTuile('Sport')).toBe('scroll-text');
  });

  it('les cartes de la grille partagent leurs rangées : les titres voisins s’alignent', () => {
    // À 768 px, la date d'une carte passait sous sa rubrique, pas celle de
    // sa voisine, et les deux titres démarraient à 24 px l'un de l'autre.
    const { container } = render(Page, { props: { data: { posts: BLOG_POSTS } } });
    const cartes = [...container.querySelectorAll('section[aria-label="Autres décryptages"] ul > li')];
    expect(cartes).toHaveLength(BLOG_POSTS.length - 1);
    for (const carte of cartes) {
      expect(carte.classList.contains('grid-rows-subgrid')).toBe(true);
      expect(carte.classList.contains('row-span-3')).toBe(true);
      // Trois blocs, un par rangée : repères (en haut de la leur), titre, extrait.
      expect(carte.children).toHaveLength(3);
      expect(carte.children[0].classList.contains('self-start')).toBe(true);
    }
  });
});
