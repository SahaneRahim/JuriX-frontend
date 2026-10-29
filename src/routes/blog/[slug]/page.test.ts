import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BLOG_POSTS, type BlogPost } from '$lib/data/blog';
import Page from './+page.svelte';

/**
 * La page d'un article du blog, montée dans jsdom avec les vrais textes de
 * l'interface : lien des citations sur leur intitulé, vers l'article cité
 * (Q3 A, P2), jamais de cote interne, et le titre en Inter tant qu'aucune
 * personne n'a relu l'article (Q5), avec l'étiquette d'un article généré.
 */

vi.mock('$app/stores', async () => {
  const { writable } = await import('svelte/store');
  return { page: writable({ url: new URL('http://localhost/blog/article'), state: {}, params: { slug: 'article' } }) };
});
// En-tête, pied de page et métadonnées : hors du sujet, et chacun tire ses
// propres stores. Un composant Svelte 5 est une fonction.
vi.mock('$lib/components/SiteHeader.svelte', () => ({ default: () => {} }));
vi.mock('$lib/components/SiteFooter.svelte', () => ({ default: () => {} }));
vi.mock('$lib/components/MetaSeo.svelte', () => ({ default: () => {} }));

/** Un article de l'API tel que le rend le générateur (backend blog_generator_service.py). */
const GENERE: BlogPost = {
  ...BLOG_POSTS[1],
  slug: 'licenciement-economique',
  genereParIA: true,
  botAnalysis: {
    ...BLOG_POSTS[1].botAnalysis,
    citations: [
      // Repli du générateur : la cote comme nom du texte et dans l'intitulé.
      { lawId: 2274, articleNumber: '35.1', reference: 'PRC-4722', title: 'Article 35.1 - PRC-4722', excerpt: 'Pendant la durée du préavis…' },
      // Texte inconnu du modèle : l'identifiant de l'exemple du prompt.
      { lawId: 1, articleNumber: '?', reference: 'Loi camerounaise', title: 'Objet de l’article', excerpt: 'Extrait…' },
    ],
  },
};

afterEach(() => cleanup());

describe('/blog/[slug]', () => {
  it('article de la rédaction : liens vers l’article cité, posés sur l’intitulé, extraits vérifiés en Literata', () => {
    const { container, getByRole } = render(Page, { props: { data: { post: BLOG_POSTS[0] } } });

    const liens = Array.from(container.querySelectorAll<HTMLAnchorElement>('main li a'));
    // Depuis l'audit r2, chaque point clé a son article : 1737 et 1134 du Code
    // civil, 29 de l'Acte uniforme OHADA sur les voies d'exécution.
    expect(liens.map((a) => a.getAttribute('href'))).toEqual([
      '/laws/2285?article=1736',
      '/laws/2236?article=299',
      '/laws/2285?article=1737',
      '/laws/2285?article=1134',
      '/laws/2281?article=29',
    ]);
    // Le lien est l'intitulé, étendu à la carte, et décrit par ses repères.
    expect(liens[0].closest('h4')).not.toBeNull();
    expect(liens[0].className).toContain('after:inset-0');
    const reperes = document.getElementById(liens[0].getAttribute('aria-describedby') ?? '');
    expect(reperes?.textContent?.trim()).toBe('Article 1736\u00a0· Code civil applicable au Cameroun');
    // Plus de pied répété (Q3 A), plus de pastille d'« assistance sur mesure ».
    expect(container.textContent).not.toContain('Consulter le texte complet');
    expect(container.textContent).not.toContain('sur mesure');
    // L'extrait relevé mot pour mot : la police du texte officiel.
    expect(container.querySelector('blockquote')?.className).toContain('font-texte');

    // Titre en Inter (aucun relecteur), équilibré ; pas d'étiquette « généré ».
    const titre = getByRole('heading', { level: 1 });
    expect(titre.className).not.toContain('font-titre');
    expect(titre.className).toContain('text-balance');
    expect(container.querySelector('[data-testid="blog-genere-par-ia"]')).toBeNull();
    expect(container.textContent).toContain('Rédigé avec l');
    // Date et durée séparées par le point médian des listes (P11), et non
    // plus par une puce « • ».
    expect(container.querySelector('header')?.textContent).toMatch(/2026\u00a0· 4 min de lecture/);
    expect(container.querySelector('header')?.textContent).not.toContain('•');
    // Deux voix au plus : rien en chasse fixe.
    expect(container.querySelector('.font-mono')).toBeNull();
  });

  it('article généré : étiquette « Généré par IA », ni cote ni lien deviné', () => {
    const { container, getByTestId } = render(Page, { props: { data: { post: GENERE } } });

    expect(getByTestId('blog-genere-par-ia').textContent).toContain('Généré par IA');
    expect(container.textContent).not.toMatch(/PRC-\d/);

    const cartes = Array.from(container.querySelectorAll('main ul.grid > li'));
    expect(cartes).toHaveLength(2);
    // La cote retirée de l'intitulé : la citation se nomme par son article.
    expect(cartes[0].querySelector('a')?.getAttribute('href')).toBe('/laws/2274?article=35.1');
    expect(cartes[0].querySelector('h4')?.textContent?.trim()).toBe('Article 35.1');
    // law_id 1 : pas de lien vers un texte sans rapport.
    expect(cartes[1].querySelector('a')).toBeNull();
    // L'extrait écrit par le modèle reste en Inter.
    expect(cartes[0].querySelector('blockquote')?.className).not.toContain('font-texte');
    expect(container.querySelector('h1')?.className).not.toContain('font-titre');
  });

  it('article relu par une personne : titre en serif, relecteur nommé', () => {
    const { container } = render(Page, { props: { data: { post: { ...BLOG_POSTS[0], reluPar: 'A. Ngono' } } } });

    expect(container.querySelector('h1')?.className).toContain('font-titre');
    expect(container.textContent).toContain('Relu par A. Ngono');
  });
});
