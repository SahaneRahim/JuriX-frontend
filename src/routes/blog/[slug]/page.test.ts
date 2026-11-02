import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BLOG_POSTS, articleDepuisLApi, type BlogPost } from '$lib/data/blog';
import { ARTICLE_ANCIEN, ARTICLE_ANCIEN_PUBLIC, ECRIT_PAR_LE_MODELE } from '$lib/data/blog-anciens-de-test';
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
// Les métadonnées : un espion, pour lire ce que la page leur passe (un
// composant Svelte 5 est une fonction appelée avec ses propriétés).
const meta = vi.hoisted(() => ({ MetaSeo: vi.fn() }));
vi.mock('$lib/components/MetaSeo.svelte', () => ({ default: meta.MetaSeo }));

/**
 * Un article de l'API, lu comme le lit la page (`articleDepuisLApi`) : une
 * citation vérifiée par le serveur, et une citation du générateur d'origine,
 * jamais vérifiée.
 */
const GENERE: BlogPost = articleDepuisLApi({
  slug: 'licenciement-economique',
  title: BLOG_POSTS[1].title,
  category: 'Travail',
  publishedAt: '2026-10-29',
  context: BLOG_POSTS[1].context,
  botAnalysis: {
    ...BLOG_POSTS[1].botAnalysis,
    citations: [
      // Vérifiée ; le repli du générateur d'origine a laissé la cote comme nom
      // du texte et dans l'intitulé.
      {
        law_id: 2274,
        article_number: '35',
        reference: 'PRC-4722',
        title: 'Article 35 - PRC-4722',
        excerpt: 'Pendant la durée du préavis…',
        url: '/laws/2274?article=35',
        verifie: true,
      },
      // Non vérifiée : texte inconnu du modèle, l'identifiant de l'exemple du prompt.
      { law_id: 1, article_number: '?', reference: 'Loi camerounaise', title: 'Objet de l’article', excerpt: 'Extrait…' },
    ],
  },
  isPublished: true,
})!;

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
    // Toutes ses citations sont vérifiées : ni encart, ni carte « non vérifiée ».
    expect(container.querySelector('[data-testid="blog-avis-non-verifie"]')).toBeNull();
    expect(container.textContent).not.toContain('Citation non vérifiée');

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
    // Vérifiée : la cote retirée de l'intitulé, la citation se nomme par son
    // article ; le lien est celui du serveur ; l'extrait, relevé dans la base,
    // est dans la police du texte officiel.
    expect(cartes[0].querySelector('a')?.getAttribute('href')).toBe('/laws/2274?article=35');
    expect(cartes[0].querySelector('h4')?.textContent?.trim()).toBe('Article 35');
    expect(cartes[0].querySelector('blockquote')?.className).toContain('font-texte');
    // Non vérifiée (law_id 1) : ni lien, ni extrait, ni intitulé du modèle.
    expect(cartes[1].getAttribute('data-testid')).toBe('citation-non-verifiee');
    expect(cartes[1].querySelector('a, blockquote')).toBeNull();
    expect(cartes[1].textContent).toContain('Citation non vérifiée');
    expect(cartes[1].textContent).not.toMatch(/Extrait…|Objet de l’article/);
    expect(container.querySelector('h1')?.className).not.toContain('font-titre');
  });

  it('article relu par une personne : titre en serif, relecteur nommé', () => {
    const { container } = render(Page, { props: { data: { post: { ...BLOG_POSTS[0], reluPar: 'A. Ngono' } } } });

    expect(container.querySelector('h1')?.className).toContain('font-titre');
    expect(container.textContent).toContain('Relu par A. Ngono');
  });
});

describe('/blog/[slug] : revue du 29/10', () => {
  /** Un article de l'API à la manière du générateur d'origine : Markdown, liste numérotée, résumé long. */
  const BRUT: BlogPost = {
    ...GENERE,
    title: '**Coupure d’eau** : ce que peut le bailleur',
    excerpt: 'Le bailleur ne peut pas couper l’eau. '.repeat(20),
    suggestedChatQuestion: '',
    botAnalysis: {
      summary: '**Non** : le bailleur ne peut pas couper l’eau (PRC-4722).',
      keyPoints: ['*Interdit* sans décision de justice.'],
      citations: [],
      citizenImpact: '1. Écrivez au bailleur.\n2. Saisissez le juge.',
    },
  };

  it('liens de partage depuis l’adresse de la page, jamais un domaine écrit en dur', () => {
    const { container } = render(Page, { props: { data: { post: BLOG_POSTS[0] } } });
    const partages = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href^="https://api.whatsapp.com"], a[href^="https://www.linkedin.com"], a[href^="https://twitter.com"]'));
    expect(partages).toHaveLength(3);
    for (const lien of partages) {
      expect(lien.href).not.toContain('jurix.cm');
      expect(decodeURIComponent(lien.href)).toContain('http://localhost/blog/article');
    }
  });

  it('description bornée par le helper du site, type « article », titre sans Markdown ni suffixe', () => {
    meta.MetaSeo.mockClear();
    render(Page, { props: { data: { post: BRUT } } });
    const proprietes = meta.MetaSeo.mock.calls.at(-1)![1] as { titre: string; description: string; type: string };
    expect(proprietes.type).toBe('article');
    expect(proprietes.description.length).toBeLessThanOrEqual(155);
    expect(proprietes.description).not.toContain('**');
    expect(proprietes.titre).toBe('Coupure d’eau : ce que peut le bailleur');
  });

  it('le Markdown résiduel et les cotes ne s’affichent pas ; la liste de l’impact garde ses lignes', () => {
    const { container, getByText } = render(Page, { props: { data: { post: BRUT } } });
    const texte = container.textContent ?? '';
    expect(texte).not.toContain('*');
    expect(texte).not.toMatch(/PRC-\d/);
    expect(container.querySelector('h1')?.textContent?.trim()).toBe('Coupure d’eau\u202F: ce que peut le bailleur');
    const impact = getByText(/Écrivez au bailleur/);
    expect(impact.className).toContain('whitespace-pre-line');
    expect(impact.textContent).toContain('\n2. Saisissez le juge.');
  });

  it('sans question suggérée, le bouton mène au chat sans question vide', () => {
    const { container } = render(Page, { props: { data: { post: BRUT } } });
    expect(container.querySelector('a[href="/chat"]')).not.toBeNull();
    expect(container.querySelector('a[href="/chat?q="]')).toBeNull();
  });

  it('une analyse de forme inattendue ne fait pas planter la page', () => {
    const bancal = {
      ...BRUT,
      botAnalysis: { summary: null, keyPoints: [{ point: 'objet' }, 'Texte'], citations: null, citizenImpact: undefined },
    } as unknown as BlogPost;
    const { container } = render(Page, { props: { data: { post: bancal } } });
    expect(container.textContent).not.toContain('[object Object]');
    expect(container.textContent).toContain('Texte');
  });
});

describe('/blog/[slug] : le rendu d’une citation non vérifiée (revue croisée du 29/10)', () => {
  // Depuis le 30/10, un article qui porte une citation non vérifiée n'est
  // plus servi au public : son chargement répond 404 (chargement.test.ts).
  // Ce rendu reste celui de l'aperçu de l'administration (CorpsDeLArticle),
  // où un tel article se relit avant d'être repris, et la défense de la page
  // si une donnée de ce genre l'atteignait. La ligne 1 de jurix_dev, servie
  // par l'API du 29/10 (extraits du modèle compris) ou réduite (sans extrait
  // ni lien) : les deux formes donnent le même rendu.
  it.each([
    ['API du 29/10 (extraits du modèle dans la réponse)', ARTICLE_ANCIEN],
    ['route publique du contrat du 30/10 (ni extrait ni lien)', ARTICLE_ANCIEN_PUBLIC],
  ])('%s : « Citation non vérifiée », ni extrait, ni lien, ni explication', (_nom, brut) => {
    const post = articleDepuisLApi(brut)!;
    const { container, getByTestId, getAllByTestId } = render(Page, { props: { data: { post } } });

    // L'encart le dit avant l'analyse.
    const encart = getByTestId('blog-avis-non-verifie');
    expect(encart).toHaveTextContent('Références non vérifiées.');
    expect(encart).toHaveAttribute('role', 'note');

    const cartes = getAllByTestId('citation-non-verifiee');
    expect(cartes).toHaveLength(2);
    // Le texte et le numéro, en clair, sous « Citation non vérifiée »
    // (toHaveTextContent ramène l'espace insécable à une espace).
    expect(cartes[0].querySelector('h4')?.textContent?.trim()).toBe('Citation non vérifiée');
    expect(cartes[0]).toHaveTextContent('Article 1719 · Code Civil / Droit des obligations');
    expect(cartes[1]).toHaveTextContent('Article 299 · Loi portant Code Pénal camerounais');

    // Rien de ce que le modèle a écrit dans les citations : « trois mois à
    // trois ans » pour l'article 299, qui dit « dix (10) jours à un (01) an ».
    const texte = container.textContent ?? '';
    for (const ecrit of ECRIT_PAR_LE_MODELE) expect(texte, ecrit).not.toContain(ecrit);
    expect(container.querySelector('blockquote')).toBeNull();
    // Aucun lien vers un texte : ni le texte 1, ni un autre.
    expect(container.querySelector('main a[href^="/laws"]')).toBeNull();
  });

  it('un article où seule une citation n’est pas vérifiée : l’autre reste une citation vérifiée', () => {
    const post = articleDepuisLApi({
      ...ARTICLE_ANCIEN,
      botAnalysis: {
        ...ARTICLE_ANCIEN.botAnalysis,
        citations: [
          {
            law_id: 2236,
            article_number: '299',
            reference: 'Code pénal (loi n° 2016/007)',
            title: 'Violation de domicile',
            excerpt: 'Est puni d’un emprisonnement de dix (10) jours à un (01) an…',
            url: '/laws/2236?article=299',
            verifie: true,
          },
          ARTICLE_ANCIEN.botAnalysis.citations[0],
        ],
      },
    })!;
    const { container, getAllByTestId, getByTestId } = render(Page, { props: { data: { post } } });
    expect(getByTestId('blog-avis-non-verifie')).toBeInTheDocument();
    expect(getAllByTestId('citation-non-verifiee')).toHaveLength(1);
    expect(container.querySelector('main a[href="/laws/2236?article=299"]')).not.toBeNull();
    expect(container.querySelectorAll('blockquote')).toHaveLength(1);
    expect(container.querySelector('blockquote')?.textContent).toContain('dix (10) jours à un (01) an');
  });

  it('une citation vérifiée au numéro d’une autre forme (« L 104 ») garde son numéro et son lien', () => {
    const post = articleDepuisLApi({
      slug: 'assurance',
      title: 'Assurance',
      botAnalysis: {
        summary: 'Résumé.',
        citations: [
          {
            law_id: 2290,
            article_number: 'L 104',
            reference: 'Code CIMA',
            title: '',
            excerpt: 'Le contrat d’assurance…',
            url: '/laws/2290?article=L%20104',
            verifie: true,
          },
        ],
      },
    })!;
    const { container } = render(Page, { props: { data: { post } } });
    const lien = container.querySelector<HTMLAnchorElement>('main ul.grid a');
    expect(lien?.getAttribute('href')).toBe('/laws/2290?article=L%20104');
    expect(lien?.textContent?.trim()).toBe('Article L 104');
  });
});

describe('/blog/[slug] : contrat du 30/10', () => {
  it('la suite d’un article se dit « (suite) » à côté du numéro ; son extrait commence par « […] »', () => {
    const post = articleDepuisLApi({
      slug: 'licenciement-abusif',
      title: 'Licenciement abusif',
      botAnalysis: {
        summary: 'Résumé.',
        citations: [
          {
            law_id: 2274,
            article_number: '39',
            reference: 'Loi N°92/007 du 14 août 1992 portant Code du travail',
            title: 'Toute rupture abusive peut donner lieu à des dommages-intérêts.',
            excerpt: 'Article 39.- (1) Toute rupture abusive du contrat peut donner lieu à des dommages-intérêts.',
            url: '/laws/2274?article=39',
            verifie: true,
          },
          {
            law_id: 2274,
            article_number: '39',
            reference: 'Loi N°92/007 du 14 août 1992 portant Code du travail',
            title: 'Le salaire de référence est celui des douze derniers mois.',
            excerpt: '[…] (6) Le salaire à prendre en considération aux alinéas précédents est le salaire moyen mensuel brut des douze (12) derniers mois.',
            url: '/laws/2274?article=39',
            verifie: true,
            suite: true,
          },
        ],
      },
      isPublished: true,
      etat_publication: 'publiable',
    })!;
    const { container } = render(Page, { props: { data: { post } } });
    const reperes = Array.from(container.querySelectorAll('main ul.grid > li p[id$="-reperes"]')).map((p) => p.textContent?.trim());
    // Deux cartes de l'article 39 : le début, puis la suite, enfin distinctes.
    expect(reperes).toEqual([
      'Article 39\u00a0· Loi N°92/007 du 14 août 1992 portant Code du travail',
      'Article 39\u00a0(suite)\u00a0· Loi N°92/007 du 14 août 1992 portant Code du travail',
    ]);
    expect(container.querySelectorAll('blockquote')[1].textContent).toContain('[…] (6) Le salaire');
  });

  it('aucun renvoi « (extrait N) » dans la prose de la page', () => {
    const post = articleDepuisLApi({
      slug: 'licenciement-abusif',
      title: 'Licenciement abusif',
      context: 'Un salarié est licencié sans motif.',
      botAnalysis: {
        summary: 'L’employeur doit prouver le motif légitime (extrait 5).',
        keyPoints: [
          'Une indemnité compense le préavis non respecté (extrait 2).',
          'Les dommages-intérêts ne se confondent pas avec elle (extraits 5 et 9).',
        ],
        citations: [],
        citizenImpact: 'Saisissez la juridiction compétente (extrait 5).',
      },
      isPublished: true,
      etat_publication: 'publiable',
    })!;
    const { container } = render(Page, { props: { data: { post } } });
    expect(container.textContent).not.toMatch(/extraits?\s+\d/);
    expect(container.textContent).toContain('Une indemnité compense le préavis non respecté.');
  });
});
