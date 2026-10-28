/**
 * Les pages du site, telles que les ouvrent les specs du noir et blanc
 * (navigation/monochrome.spec.ts) et du redimensionnement
 * (navigation/redimensionnement.spec.ts).
 *
 * POURQUOI CE FICHIER EXISTE. Les deux specs parcourent les mêmes 21 pages,
 * dans le même état : une conversation affichée, une comparaison rendue, une
 * administration remplie. Une seule liste, pour qu'une page ajoutée au site
 * soit vérifiée par les deux, avec les mêmes doublures
 * (tests/e2e/doublures.ts).
 *
 * Pour chaque page, en plus de la façon de l'ouvrir :
 *  - `principal` : ce qui doit rester visible à toute largeur (le titre, le
 *    formulaire, la saisie du chat) ;
 *  - `action` : l'action principale, qui doit rester atteignable sur un écran
 *    court ;
 *  - `entete` : la barre de navigation de la page (site public, chat,
 *    administration), dont un seul mode doit se montrer à la fois.
 *
 * DONNÉES. Les identifiants (loi, catégorie, article du blog) viennent de la
 * vraie API, jamais du code : un jeu figé pourrit à la première réingestion.
 */

import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';

import type { Category } from '../../src/lib/types';
import {
  API,
  ARTICLES_DU_BLOG_ADMIN,
  COMPARAISON,
  DEBUT_REPONSE,
  LOIS,
  QUESTION,
  REPONSE_RECHERCHE,
  SESSION_DU_CHAT,
  UTILISATEURS,
  attendreLeRepos,
  boutonDEnvoi,
  exiger,
  lireListe,
  ouvrirAuServeur,
  saisieDuChat,
  simulerLAdministration,
  simulerLaComparaison,
  simulerLaRecherche,
  simulerLeChat,
  visible,
} from './doublures';
import { cliquerJusqualEffet, saisirJusqualEffet } from './hydratation';

/** La barre de navigation d'une page : un seul de ses deux modes se montre. */
export type Entete = 'site' | 'chat' | 'admin';

export interface PageDuSite {
  /** L'adresse, telle qu'elle apparaît dans le titre des tests. */
  nom: string;
  /**
   * Prépare la page (session, doublures), l'ouvre et attend son contenu.
   * Rend le chemin réellement ouvert : il nomme les captures.
   */
  ouvrir: (page: Page, request: APIRequestContext) => Promise<string>;
  principal: (page: Page) => Locator;
  action: (page: Page) => Locator;
  entete: Entete;
}

/** Le titre de la page : le premier <h1> affiché (celui du chat est réservé aux lecteurs d'écran). */
const titre = (page: Page): Locator => visible(page.locator('h1'));

/** Le contenu de la page, hors en-tête et pied de page. */
const contenu = (page: Page): Locator => page.locator('main').first();

/**
 * Une loi qui a des articles, et pas trop : son sommaire, ses barres
 * Précédent / Suivant et son bouton « Expliquer l'article » s'affichent, sans
 * une page de dix mille pixels à capturer. Lue une fois par processus.
 */
let loiRetenue: Promise<number | null> | null = null;
export function loiAvecArticles(request: APIRequestContext): Promise<number | null> {
  loiRetenue ??= lireListe<{ id: number; article_count?: number | null }>(request, '/laws/?limit=60').then(
    (lois) => {
      const candidates = lois
        .filter((loi) => (loi.article_count ?? 0) >= 3 && (loi.article_count ?? 0) <= 40)
        .sort((a, b) => (b.article_count ?? 0) - (a.article_count ?? 0));
      return (candidates[0] ?? lois.find((loi) => (loi.article_count ?? 0) > 0))?.id ?? null;
    },
  );
  return loiRetenue;
}

/** La catégorie la plus fournie : une catégorie vide n'aurait aucune carte. */
async function categorieFournie(request: APIRequestContext): Promise<number | null> {
  const categories = await lireListe<Category>(request, '/categories');
  const [premiere] = [...categories].sort((a, b) => (b.law_count ?? 0) - (a.law_count ?? 0));
  return premiere?.id ?? null;
}

/** Le premier article publié du blog, s'il en existe un. */
async function articleDuBlog(request: APIRequestContext): Promise<string | null> {
  const reponse = await request.get(`${API}/api/v1/blog`, { failOnStatusCode: false }).catch(() => null);
  if (!reponse?.ok()) return null;
  const articles = (await reponse.json().catch(() => [])) as { slug?: string }[];
  return Array.isArray(articles) ? (articles.find((a) => a.slug)?.slug ?? null) : null;
}

/** Une adresse qu'aucune route ne sert : la page d'erreur du site, en 404. */
export const ADRESSE_INCONNUE = '/page-qui-n-existe-pas-verification';

export const PAGES: PageDuSite[] = [
  {
    nom: '/',
    entete: 'site',
    ouvrir: async (page) => {
      await ouvrirAuServeur(page, '/');
      return '/';
    },
    principal: titre,
    // Le bouton de la barre de recherche du hero (sous sm, une flèche seule).
    action: (page) => page.locator('#contenu').getByRole('button', { name: 'Rechercher', exact: true }),
  },
  {
    nom: '/chat',
    entete: 'chat',
    ouvrir: async (page) => {
      // Une conversation affichée, et non l'écran vide : bulles, tableau,
      // sources et suggestions passent tous au contrôle. Réponse simulée,
      // jamais le modèle.
      await simulerLeChat(page);
      await page.goto('/chat');
      await saisirJusqualEffet(saisieDuChat(page), QUESTION, page.getByRole('log').getByText(DEBUT_REPONSE));
      await expect
        .poll(() => page.evaluate(() => localStorage.getItem('jurix-chat-session')))
        .toBe(SESSION_DU_CHAT);
      return '/chat';
    },
    principal: saisieDuChat,
    action: boutonDEnvoi,
  },
  {
    nom: '/laws',
    entete: 'site',
    ouvrir: async (page) => {
      await ouvrirAuServeur(page, '/laws');
      return '/laws';
    },
    principal: titre,
    action: (page) => contenu(page).locator('a[href^="/laws/"]').first(),
  },
  {
    nom: '/laws/[id]',
    entete: 'site',
    ouvrir: async (page, request) => {
      const id = await loiAvecArticles(request);
      exiger(id, 'aucune loi avec des articles : API injoignable ou corpus vide');
      await ouvrirAuServeur(page, `/laws/${id}`);
      await expect(page.getByTestId('law-error')).toHaveCount(0);
      return `/laws/${id}`;
    },
    principal: titre,
    // « Expliquer l'article » : l'action propre à la page (jamais cliquée ici,
    // elle appellerait le modèle).
    action: (page) => page.getByTestId('law-explain').first(),
  },
  {
    nom: '/categories/[id]',
    entete: 'site',
    ouvrir: async (page, request) => {
      const id = await categorieFournie(request);
      exiger(id, 'aucune catégorie : API injoignable');
      await ouvrirAuServeur(page, `/categories/${id}`);
      return `/categories/${id}`;
    },
    principal: titre,
    // Le champ qui filtre les textes de la catégorie.
    action: (page) => contenu(page).locator('input[type="text"]').first(),
  },
  {
    nom: '/search?q=travail',
    entete: 'site',
    ouvrir: async (page) => {
      // La recherche hybride appelle un modèle d'embeddings : simulée.
      await simulerLaRecherche(page);
      await page.goto('/search?q=travail');
      await expect(page.getByTestId('search-status')).toContainText(String(REPONSE_RECHERCHE.total));
      return '/search?q=travail';
    },
    principal: titre,
    action: (page) => contenu(page).locator('a[href^="/laws/"]').first(),
  },
  {
    nom: '/compare',
    entete: 'site',
    ouvrir: async (page) => {
      // La comparaison appelle le modèle : simulée, rendue avec un article
      // déplié, le plus long contenu de la grille.
      await simulerLaComparaison(page);
      await page.goto('/compare');
      await expect(page.getByTestId('compare-submit')).toBeEnabled();
      await page.getByTestId('compare-a').fill(COMPARAISON.subject_a);
      await page.getByTestId('compare-b').fill(COMPARAISON.subject_b);
      await cliquerJusqualEffet(page.getByTestId('compare-submit'), page.getByTestId('compare-result'));
      await cliquerJusqualEffet(page.getByTestId('compare-toggle-0-a'), page.getByTestId('compare-source-0-a'));
      return '/compare';
    },
    principal: titre,
    action: (page) => page.getByTestId('compare-submit'),
  },
  {
    nom: '/about',
    entete: 'site',
    ouvrir: async (page) => {
      await ouvrirAuServeur(page, '/about');
      return '/about';
    },
    principal: titre,
    action: (page) => contenu(page).locator('a[href^="mailto:"]').first(),
  },
  {
    nom: '/blog',
    entete: 'site',
    ouvrir: async (page) => {
      await ouvrirAuServeur(page, '/blog');
      return '/blog';
    },
    principal: titre,
    action: (page) => contenu(page).locator('a[href^="/blog/"]').first(),
  },
  {
    nom: '/blog/[slug]',
    entete: 'site',
    ouvrir: async (page, request) => {
      const slug = await articleDuBlog(request);
      exiger(slug, 'aucun article publié dans le blog');
      await ouvrirAuServeur(page, `/blog/${slug}`);
      return `/blog/${slug}`;
    },
    principal: titre,
    // « Poser la question à l'assistant » : la suite que propose l'article.
    action: (page) => contenu(page).locator('a[href^="/chat"]').first(),
  },
  {
    nom: '/login',
    entete: 'site',
    ouvrir: async (page) => {
      await ouvrirAuServeur(page, '/login');
      return '/login';
    },
    principal: titre,
    action: (page) => page.getByTestId('login-submit'),
  },
  {
    nom: '/signup',
    entete: 'site',
    ouvrir: async (page) => {
      await ouvrirAuServeur(page, '/signup');
      return '/signup';
    },
    principal: titre,
    action: (page) => page.getByTestId('signup-submit'),
  },
  {
    nom: '/forgot-password',
    entete: 'site',
    ouvrir: async (page) => {
      await ouvrirAuServeur(page, '/forgot-password');
      return '/forgot-password';
    },
    principal: titre,
    action: (page) => page.getByTestId('forgot-submit'),
  },
  {
    nom: '/reset-password',
    entete: 'site',
    ouvrir: async (page) => {
      await ouvrirAuServeur(page, '/reset-password');
      return '/reset-password';
    },
    principal: titre,
    action: (page) => page.getByTestId('lien-ask-new'),
  },
  {
    nom: '/verify-email',
    entete: 'site',
    ouvrir: async (page) => {
      await ouvrirAuServeur(page, '/verify-email');
      return '/verify-email';
    },
    principal: titre,
    action: (page) => page.getByTestId('lien-to-login'),
  },
  {
    nom: 'adresse inconnue (404)',
    entete: 'site',
    ouvrir: async (page) => {
      const statut = (await page.goto(ADRESSE_INCONNUE))?.status();
      expect(statut, `${ADRESSE_INCONNUE} : statut`).toBe(404);
      await expect(page.getByTestId('error-page')).toBeVisible();
      return ADRESSE_INCONNUE;
    },
    principal: titre,
    // Les destinations de la navigation, reprises par la page d'erreur.
    action: (page) => page.getByTestId('error-page').locator('nav a').first(),
  },
  {
    nom: '/admin',
    entete: 'admin',
    ouvrir: async (page) => {
      await simulerLAdministration(page);
      await page.goto('/admin');
      await expect(page.getByTestId('admin-profils')).toBeVisible();
      return '/admin';
    },
    principal: titre,
    action: (page) => page.getByTestId('admin-refresh'),
  },
  {
    nom: '/admin/users',
    entete: 'admin',
    ouvrir: async (page) => {
      await simulerLAdministration(page);
      await page.goto('/admin/users');
      await expect(visible(page.getByText(UTILISATEURS[1].email))).toBeVisible();
      return '/admin/users';
    },
    principal: titre,
    action: (page) => page.getByTestId('user-new'),
  },
  {
    nom: '/admin/documents',
    entete: 'admin',
    ouvrir: async (page) => {
      await simulerLAdministration(page);
      await page.goto('/admin/documents');
      await expect(visible(page.getByText(LOIS[0].title))).toBeVisible();
      return '/admin/documents';
    },
    principal: titre,
    action: (page) => page.getByTestId('doc-new'),
  },
  {
    nom: '/admin/documents/batch-upload',
    entete: 'admin',
    ouvrir: async (page) => {
      await simulerLAdministration(page);
      await page.goto('/admin/documents/batch-upload');
      // Le suivi des lots : le texte en échec et son message.
      await expect(visible(page.getByText(LOIS[0].title))).toBeVisible();
      return '/admin/documents/batch-upload';
    },
    principal: titre,
    // Toute la zone de dépôt est l'étiquette du champ de fichiers.
    action: (page) => page.locator('label[for="batch-files"]'),
  },
  {
    nom: '/admin/blog',
    entete: 'admin',
    ouvrir: async (page) => {
      await simulerLAdministration(page);
      await page.goto('/admin/blog');
      await expect(visible(page.getByText(ARTICLES_DU_BLOG_ADMIN[0].title))).toBeVisible();
      return '/admin/blog';
    },
    principal: titre,
    // « Générer un article IA » ouvre le générateur (sans rien générer).
    action: (page) => contenu(page).getByRole('button', { name: /Générer un article IA/ }),
  },
];

/**
 * Nom de fichier d'une page : le chemin sans « / » initial, « / » devenu
 * « _ », sans la requête ; « accueil » pour la racine, « erreur-404 » pour
 * l'adresse inconnue.
 */
export function nomDeCapture(chemin: string): string {
  if (chemin === ADRESSE_INCONNUE) return 'erreur-404';
  const sansRequete = chemin.split('?')[0].replace(/^\/+/, '').replace(/\/+$/, '');
  return sansRequete === '' ? 'accueil' : sansRequete.replace(/\//g, '_');
}

/** Ouvre la page puis attend qu'elle ne bouge plus (réseau, police, transitions). */
export async function ouvrirAuRepos(
  parcours: PageDuSite,
  page: Page,
  request: APIRequestContext,
): Promise<string> {
  const chemin = await parcours.ouvrir(page, request);
  await attendreLeRepos(page);
  return chemin;
}
