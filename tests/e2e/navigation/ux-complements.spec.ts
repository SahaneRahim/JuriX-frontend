/**
 * Compléments de la refonte UX : ce que les autres specs ux-* ne vérifiaient
 * pas encore dans un vrai navigateur, d'après le choix du propriétaire
 * (data/ux-recherche/propositions/propositions.json du dépôt backend).
 *
 * POURQUOI CE FICHIER EXISTE. La vérification de bout en bout du 28/10 a
 * relevé des trous entre le choix et les specs :
 *  - P8 : sans JavaScript, ux-accueil vérifiait l'ADRESSE envoyée par le
 *    formulaire de l'accueil, pas que /search arrive avec ses résultats ; les
 *    filtres de /search (onglets, colonne, pagination) n'étaient éprouvés que
 *    par leur ancre, jamais suivis sans JavaScript ; le repli de l'ancienne API
 *    (rappels de filtre en liens) ne l'était pas du tout.
 *  - P11 : seule /laws était suivie jusqu'à `?page=2` sans JavaScript, pas la
 *    page d'un domaine ; la ligne de repères n'était pas lue.
 *  - P2 : les trois actions de l'article n'étaient pas comparées à l'article
 *    LU après « Suivant », ni le fil d'Ariane.
 *  - P5 : l'arrivée par un lien direct vers un texte (le cas que P5 corrige,
 *    un lien partagé sur WhatsApp) n'était pas vérifiée. Les QUATRE profils
 *    proposés dans le fil se vérifient dans QuestionDuProfil.test.ts, et la
 *    question dans le fil, au navigateur, dans persona.spec.ts.
 *  - P4 : la ligne d'état n'était vue qu'avec son repli (« Préparation de la
 *    réponse… ») : aucun événement de progression simulé ; « Arrêter » n'était
 *    jugé que sur l'écran, pas sur l'interruption réelle de la requête.
 *  - P1 : le statut n'était lu que sur le premier texte venu, sans liens ;
 *    jamais sur un texte modifié (la Constitution) avec ses textes
 *    modificatifs, ses marques « · modifié » et l'encadré d'un article.
 *  - Q1 : un titre « d'une seule couleur » et l'IA nommée une seule fois.
 *
 * DONNÉES. Les pages rendues par le serveur lisent la vraie API (sautées
 * quand elle est éteinte, échouées avec E2E_EXIGER_BACKEND=1) ; /search
 * reçoit ses résultats de la doublure côté serveur (`enregistrerLaRecherche`),
 * sans appel au modèle d'embeddings ; le chat est entièrement simulé, flux
 * compris, sans appel au modèle.
 *
 * Lancer : npx playwright test tests/e2e/navigation/ux-complements.spec.ts --project=chromium
 */

import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

import type { Category, SearchResponse, StatutJuridique, TexteLie } from '../../../src/lib/types';
import {
  AGENT_MOBILE,
  API,
  REPONSE_RECHERCHE,
  enregistrerLaRecherche,
  exiger,
  intercepterLApi,
  lireListe,
  ouvrirAuServeur,
  saisieDuChat,
} from '../doublures';
import { cliquerJusqualEffet, saisirJusqualEffet } from '../hydratation';
import { loiAvecArticles } from '../pages-du-site';

const TELEPHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: AGENT_MOBILE };
const BUREAU = { viewport: { width: 1440, height: 900 } };

/** Les lignes d'une liste de textes ou de résultats (liste à filets, `role="list"`). */
const lignes = (page: Page): Locator => page.locator('#contenu ul[role="list"] > li');

/** Une date telle que l'écrit $lib/format (`formatDate`, `formatDateCourte`), en français. */
function dateFr(iso: string, mois: 'long' | 'short' = 'long'): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: mois,
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Un rouge saturé (rouge des erreurs) : jamais pour un statut juridique. */
async function couleursRouges(zone: Locator): Promise<string[]> {
  const couleurs = await zone.evaluate((element) =>
    [element, ...element.querySelectorAll('*')].flatMap((e) => {
      const s = getComputedStyle(e);
      return [s.color, s.backgroundColor, s.borderTopColor];
    }),
  );
  return couleurs.filter((c) => {
    const m = /rgba?\((\d+), (\d+), (\d+)/.exec(c);
    return m !== null && Number(m[1]) > 150 && Number(m[2]) < 110 && Number(m[3]) < 110;
  });
}

// ---------------------------------------------------------------------------
// Q1 : un titre d'une seule couleur, l'IA nommée une fois
// ---------------------------------------------------------------------------

test.describe('Accueil : le titre et le sous-titre (Q1 A)', () => {
  test.use(BUREAU);

  test('un titre d’une seule couleur ; l’IA nommée une seule fois, avec sa garantie', async ({ page }) => {
    await ouvrirAuServeur(page, '/');
    const titre = page.locator('h1');
    // « IA » gris seul sur sa ligne : le défaut que Q1 corrige. Aucune partie
    // du titre n'a sa propre couleur.
    const couleurs = await titre.evaluate((h1) => [h1, ...h1.querySelectorAll('*')].map((e) => getComputedStyle(e).color));
    expect(new Set(couleurs).size).toBe(1);
    await expect(titre).toHaveCSS('text-wrap', /balance/);

    // Le sous-titre suit le titre : la seule mention de l'IA au-dessus de la
    // liste, avec ce qu'elle garantit.
    const sousTitre = titre.locator('xpath=following-sibling::p[1]');
    await expect(sousTitre).toContainText('l’assistant IA répond en citant les articles');
    const contenu = (await page.locator('#contenu').innerText()).split('Parcourir par domaine')[0];
    expect(contenu.match(/\bIA\b/g) ?? []).toHaveLength(2); // l'onglet « Assistant IA » et le sous-titre
  });
});

// ---------------------------------------------------------------------------
// P8 et P7 sans JavaScript : de l'accueil aux résultats, filtres en liens
// ---------------------------------------------------------------------------

test.describe('Sans JavaScript : la recherche aboutit (P8)', () => {
  test.use({ javaScriptEnabled: false });

  test.describe('téléphone', () => {
    test.use(TELEPHONE);

    test('le formulaire de l’accueil arrive sur /search AVEC ses résultats', async ({ page }) => {
      await enregistrerLaRecherche(page.request, ['bail commercial']);
      await ouvrirAuServeur(page, '/');
      const champ = page.locator('#contenu').getByRole('searchbox', { name: 'Rechercher', exact: true });
      await champ.fill('bail commercial');
      await champ.press('Enter');

      await expect(page).toHaveURL(/\/search\?q=bail\+commercial$/);
      await expect(page.getByTestId('search-status')).toContainText(String(REPONSE_RECHERCHE.total));
      await expect(lignes(page)).toHaveCount(REPONSE_RECHERCHE.results.length);
      await expect(lignes(page).first().locator('h2 a')).toHaveAttribute('href', /^\/laws\/\d+$/);
      await expect(page.locator('#contenu')).not.toContainText(/\bPRC-\d+/);
    });
  });

  test.describe('bureau', () => {
    test.use(BUREAU);

    test('onglets de nature, colonne de filtres et pagination partent sans JavaScript', async ({ page }) => {
      await enregistrerLaRecherche(page.request, ['travail']);
      await page.goto('/search?q=travail');

      // Un onglet de nature est un lien.
      const nature = page.getByRole('group', { name: 'Nature du texte' });
      await nature.getByRole('link', { name: /^Lois\b/ }).click();
      await expect(page).toHaveURL(/\/search\?q=travail&nature=loi$/);
      await expect(nature.getByRole('link', { name: /^Lois\b/ })).toHaveAttribute('aria-current', 'true');

      // La colonne est un formulaire GET : un domaine coché part avec la nature en cours.
      await page.getByRole('checkbox', { name: /^Travail et sécurité sociale/ }).check();
      await page.getByRole('button', { name: 'Appliquer les filtres', exact: true }).click();
      await expect(page).toHaveURL(/[?&]categorie=4(&|$)/);
      const adresse = new URL(page.url());
      expect(adresse.searchParams.get('q')).toBe('travail');
      expect(adresse.searchParams.get('nature')).toBe('loi');
      await expect(page.getByRole('checkbox', { name: /^Travail et sécurité sociale/ })).toBeChecked();

      // « Réinitialiser » est un lien : filtres et tri retirés, la requête gardée.
      await page.getByTestId('search-reset').click();
      await expect(page).toHaveURL(/\/search\?q=travail$/);

      // Les numéros de page sont des liens vers le haut des résultats.
      await page.getByTestId('search-page-2').click();
      await expect(page).toHaveURL(/\/search\?q=travail&page=2#resultats$/);
      await expect(page.getByTestId('search-page-2')).toHaveAttribute('aria-current', 'page');
      await expect(lignes(page).first()).toBeVisible();
    });

    test('ancienne API : filtres appliqués, rappelés par des liens qui les retirent', async ({ page }) => {
      // La forme de l'ancienne API : ni `sort`, ni `candidates`, ni `facets`.
      const { sort: _s, candidates: _c, facets: _f, ...ancienne } = REPONSE_RECHERCHE;
      await enregistrerLaRecherche(page.request, ['licenciement ancien'], ancienne as SearchResponse);
      await ouvrirAuServeur(page, '/search?q=licenciement+ancien&nature=loi&categorie=4');

      // Ni onglets, ni colonne, ni tri : l'ancienne API ne compte rien.
      await expect(page.getByRole('group', { name: 'Nature du texte' })).toHaveCount(0);
      await expect(page.locator('#filtres-recherche')).toHaveCount(0);
      await expect(page.getByTestId('search-sort')).toHaveCount(0);
      await expect(lignes(page).first()).toBeVisible();

      // Guillemets à espaces fines insécables (U+202F) dans les libellés.
      const retirerLeDomaine = page.getByRole('link', { name: /^Retirer le filtre «\s*Travail et sécurité sociale\s*»$/ });
      await expect(page.getByRole('link', { name: /^Retirer le filtre «\s*Lois\s*»$/ })).toBeVisible();
      await retirerLeDomaine.click();
      await expect(page).toHaveURL(/\/search\?q=licenciement\+ancien&nature=loi$/);
    });
  });
});

// ---------------------------------------------------------------------------
// P11 : la page d'un domaine par lots, sans JavaScript ; la ligne de repères
// ---------------------------------------------------------------------------

/** Le domaine le plus fourni (plus de 20 textes : un second lot existe). */
async function domaineAvecDeuxLots(request: APIRequestContext): Promise<Category | null> {
  const categories = await lireListe<Category>(request, '/categories');
  const [premier] = [...categories].sort((a, b) => (b.law_count ?? 0) - (a.law_count ?? 0));
  return premier && (premier.law_count ?? 0) > 20 ? premier : null;
}

test.describe('Listes de textes (P11 A)', () => {
  test.describe('sans JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test('page d’un domaine : « Afficher 20 de plus » ouvre ?page=2, qui renvoie au lot précédent', async ({
      page,
      request,
    }) => {
      const domaine = await domaineAvecDeuxLots(request);
      exiger(domaine, 'aucun domaine de plus de 20 textes, ou API injoignable');
      await ouvrirAuServeur(page, `/categories/${domaine.id}`);
      await expect(lignes(page)).toHaveCount(20);

      const plus = page.getByRole('link', { name: /^Afficher \d+ de plus$/ });
      await expect(plus).toHaveAttribute('href', `/categories/${domaine.id}?page=2`);
      await plus.click();

      await expect(page).toHaveURL(new RegExp(`/categories/${domaine.id}\\?page=2$`));
      await expect(page.getByRole('link', { name: /textes précédents$/ })).toHaveAttribute(
        'href',
        `/categories/${domaine.id}`,
      );
      expect(await lignes(page).count()).toBeGreaterThan(0);
      await expect(page.locator('#contenu')).not.toContainText(/\bPRC-\d+/);
    });
  });

  test('/laws : repères « Nature n° … · date · N articles », puis l’objet ; ordre annoncé', async ({ page, request }) => {
    const lot = await request
      .get(`${API}/api/v1/laws/?page=1&page_size=20&sort=date_desc`, { failOnStatusCode: false })
      .catch(() => null);
    exiger(lot?.ok(), 'API injoignable');
    const corps = await lot!.json();
    // Ancienne API : un tableau nu, ni repères ni ordre garanti (contrat §8).
    test.skip(Array.isArray(corps), 'ancienne API : pas de lots ni de repères');

    await ouvrirAuServeur(page, '/laws');
    await expect(page.getByText('Du plus récent au plus ancien')).toBeVisible();
    const premiere = lignes(page).first();
    const [ligneDeReperes, objet] = [premiere.locator('p').first(), premiere.locator('h2')];
    // « Décret n° 2026/285 · 31 août 2026 · 3 articles » : nature, numéro,
    // date, nombre d'articles. `\s` partout : le séparateur commence par une
    // espace insécable (« · », $lib/components/listes/reperes), qu'une
    // expression régulière ne voit pas comme une espace ordinaire.
    await expect(ligneDeReperes).toHaveText(/^\S.*\s·\s.+\s·\s\d+\sarticles?$/);
    const attendu = corps.items[0];
    await expect(objet).toHaveText(attendu.objet ?? attendu.title);
  });
});

// ---------------------------------------------------------------------------
// P2 : les trois actions suivent l'article LU ; P10 : le fil d'Ariane aussi
// ---------------------------------------------------------------------------

test.describe('Page d’un texte : l’article lu partout (P2, P10)', () => {
  test('après deux « Suivant » : adresse, fil d’Ariane et les trois actions désignent l’article lu', async ({
    page,
    context,
    request,
  }) => {
    const id = await loiAvecArticles(request);
    exiger(id, 'aucune loi avec des articles : API injoignable ou corpus vide');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await ouvrirAuServeur(page, `/laws/${id}`);

    const suivant = page.locator('.article-navigation button').last();
    const titreDeLArticle = page.locator('article.article h2');
    // Deux « Suivant », chacun attendu à son effet (hydratation comprise) :
    // un clic parti avant l'hydratation ne fait rien, et serait répété.
    for (let fois = 0; fois < 2; fois++) {
      const avant = await titreDeLArticle.innerText();
      await expect(async () => {
        if ((await titreDeLArticle.innerText()) === avant) await suivant.click();
        await expect(titreDeLArticle).not.toHaveText(avant, { timeout: 1_000 });
      }).toPass({ timeout: 15_000 });
    }
    const numero = new URL(page.url()).searchParams.get('article');
    exiger(numero, 'pas de troisième article');
    await expect(titreDeLArticle).toContainText(`Article ${numero}`);

    // Le fil d'Ariane va jusqu'à l'article lu.
    await expect(page.locator('.breadcrumb [aria-current="location"]')).toContainText(`Article ${numero}`);

    await page.getByTestId('law-copy-reference').click();
    const reference = await page.evaluate(() => navigator.clipboard.readText());
    expect(reference).toMatch(new RegExp(`^Art\\. ${numero}\\b`));
    expect(reference).toContain(`/laws/${id}?article=${numero}`);

    await page.getByTestId('law-copy-text').click();
    const texte = await page.evaluate(() => navigator.clipboard.readText());
    // Le début de l'article affiché (texte brut du premier paragraphe : le
    // rendu replie les blancs, la copie non), sa référence et la mention de valeur.
    const debut = ((await page.locator('article.article .article-content p').first().textContent()) ?? '')
      .trim()
      .slice(0, 40);
    expect(debut.length).toBeGreaterThan(0);
    expect(texte).toContain(debut);
    expect(texte).toContain(`Art. ${numero}`);
    expect(texte).toContain('Seul le texte publié au Journal officiel fait foi.');

    // Le troisième bouton : sur ordinateur, « Copier le lien » copie
    // l'adresse de l'article lu (le partage du système ne sert qu'au doigt,
    // ActionsDeLArticle.svelte). Il remplace le lien wa.me
    // (`law-share-article`) depuis les corrections qui ont suivi la
    // vérification r1 du 29/10.
    await page.getByTestId('law-copy-link').click();
    const lien = await page.evaluate(() => navigator.clipboard.readText());
    expect(lien).toMatch(new RegExp(`^https?://[^/]+/laws/${id}\\?article=${numero}(#.*)?$`));
    for (const copie of [reference, texte, lien]) expect(copie).not.toMatch(/\bPRC-\d+/);
  });
});

test.describe('Page d’un texte : l’« Article premier » (P10)', () => {
  test('écrit en toutes lettres, il ouvre le sommaire et la lecture article par article', async ({
    page,
    request,
  }) => {
    // La Constitution écrit « Article premier: » : le découpage du front ne
    // reconnaissait que les chiffres, et son article 1 n'était lisible qu'en
    // texte entier, hors de tout article (vérification r1 du 29/10).
    const reponse = await request
      .get(`${API}/api/v1/laws/${TEXTE_MODIFIE}`, { failOnStatusCode: false })
      .catch(() => null);
    exiger(reponse?.ok(), `texte ${TEXTE_MODIFIE} illisible : API injoignable`);
    const loi = (await reponse!.json()) as { content?: string | null };
    test.skip(!/^\s*Article\s+premier\b/im.test(loi.content ?? ''), `texte ${TEXTE_MODIFIE} : pas d’« Article premier »`);

    await ouvrirAuServeur(page, `/laws/${TEXTE_MODIFIE}`);
    await expect(page.locator('article.article h2')).toHaveText(/^Article\s*1er$/);
    await expect(page.getByTestId('law-toc').locator('a[href="#art-1"]')).toHaveCount(1);
  });
});

// ---------------------------------------------------------------------------
// P1 : le statut prouvé, avec et sans liens
// ---------------------------------------------------------------------------

/**
 * Un texte modifié du relevé : la Constitution (loi 96/06), l'exemple le plus
 * complet du contrat de l'API (§3.4) — deux textes modificatifs, une
 * réécriture, un complément et un changement dépassé. Un identifiant en dur,
 * à contre-courant du reste des specs : aucune liste de l'API ne permet de la
 * trouver autrement. Son absence (ancienne API, base réingérée) saute le test
 * au lieu de le faire mentir ; E2E_TEXTE_MODIFIE en désigne un autre.
 */
const TEXTE_MODIFIE = Number(process.env.E2E_TEXTE_MODIFIE ?? 2143);

interface DetailDuTexte {
  id: number;
  date_signature?: string | null;
  ajoute_le?: string;
  statut_juridique?: StatutJuridique | null;
}

async function lireLeTexte(request: APIRequestContext, id: number): Promise<DetailDuTexte | null> {
  const reponse = await request.get(`${API}/api/v1/laws/${id}`, { failOnStatusCode: false }).catch(() => null);
  return reponse?.ok() ? ((await reponse.json()) as DetailDuTexte) : null;
}

test.describe('Statut d’un texte (P1 A, étapes 1 et 2)', () => {
  test('un texte modifié : textes modificatifs liés, « Historique (N) », marques et encadré d’article', async ({
    page,
    request,
  }) => {
    const loi = await lireLeTexte(request, TEXTE_MODIFIE);
    const statut = loi?.statut_juridique;
    exiger(statut, `texte ${TEXTE_MODIFIE} illisible, ou ancienne API (pas de statut_juridique)`);
    const actuels = statut.modifie_par.filter((c) => !c.depasse && !c.integre_au_texte);
    test.skip(statut.etat !== 'modifie' || actuels.length === 0, `texte ${TEXTE_MODIFIE} : plus de modification relevée`);

    await ouvrirAuServeur(page, `/laws/${TEXTE_MODIFIE}`);
    const encadre = page.getByTestId('law-status');
    await expect(encadre).toHaveAttribute('data-etat', 'modifie');
    await expect(encadre).toContainText('Modifié depuis sa publication.');
    await expect(encadre).toContainText('Texte affiché : version d’origine, non consolidée.');
    await expect(encadre).toContainText(`Textes modificatifs connus de JuriX au ${dateFr(statut.releve_le, 'short')}`);
    await expect(encadre.getByRole('link', { name: 'Signaler' })).toHaveAttribute('href', /^mailto:/);
    await expect(encadre).not.toContainText(/en vigueur/i);

    // Une ligne par texte modificatif actuel, liée à sa page quand il est publié.
    const textes = new Map<string, TexteLie>(actuels.map((c) => [c.texte.reference ?? c.texte.titre, c.texte]));
    await expect(encadre.locator('li')).toHaveCount(textes.size);
    for (const texte of textes.values()) {
      const ligne = encadre.locator('li').filter({ hasText: texte.numero ?? texte.titre });
      await expect(ligne).toHaveCount(1);
      if (texte.consultable && texte.id) await expect(ligne.locator(`a[href="/laws/${texte.id}"]`)).toHaveCount(1);
    }

    // Dates : celle de l'acte, et l'entrée dans JuriX, jamais « Mis à jour le ».
    if (loi?.date_signature) await expect(page.getByTestId('law-date')).toHaveText(`Signé le ${dateFr(loi.date_signature)}`);
    if (loi?.ajoute_le) await expect(page.getByTestId('law-added')).toHaveText(`Ajouté à JuriX le ${dateFr(loi.ajoute_le)}`);
    await expect(page.locator('#contenu')).not.toContainText('Mis à jour le');

    // « Historique (N) » : N textes distincts, dépassés compris.
    const distincts = new Set(
      [...statut.modifie_par, ...statut.modifie].map((c) => c.texte.reference ?? c.texte.titre),
    ).size;
    await expect(page.getByTestId('law-tab-historique')).toHaveText(`Historique (${distincts})`);

    // « · modifié » dans le sommaire, pour chaque article touché.
    const sommaire = page.getByTestId('law-toc');
    const touches = Object.keys(statut.par_article);
    for (const numero of touches) {
      const entree = sommaire.getByRole('link').filter({ hasText: new RegExp(`^Art\\.\\s${numero}(er)?\\b`) });
      if ((await entree.count()) === 0) continue; // numéro absent du découpage du front
      await expect(entree.first()).toContainText('· modifié');
    }
    await expect(sommaire.getByRole('link').filter({ hasText: '· modifié' }).first()).toBeVisible();

    // L'encadré d'un article réécrit : le texte qui l'a réécrit, lié, et ce qu'il a fait.
    const reecrit = actuels.find((c) => c.nature_modification === 'reecrit_en_entier' && c.articles_cibles.length);
    if (reecrit) {
      const numero = reecrit.articles_cibles[0];
      await page.goto(`/laws/${TEXTE_MODIFIE}?article=${numero}`);
      await expect(page.locator('article.article h2')).toContainText(`Article ${numero}`, { timeout: 15_000 });
      const encadreDArticle = page.getByTestId('law-article-status');
      await expect(encadreDArticle).toContainText('Article modifié par la loi');
      await expect(encadreDArticle).toContainText(`${reecrit.texte.numero}`);
      await expect(encadreDArticle).toContainText('réécrit en entier');
      if (reecrit.texte.id) await expect(encadreDArticle.locator(`a[href="/laws/${reecrit.texte.id}"]`).first()).toBeVisible();
      expect(await couleursRouges(encadreDArticle)).toEqual([]);
    }

    // L'historique montre toute la chaîne : chaque texte lié, dépassés compris.
    await cliquerJusqualEffet(page.getByTestId('law-tab-historique'), page.getByTestId('law-history'));
    const historique = page.getByTestId('law-history');
    for (const c of statut.modifie_par) await expect(historique).toContainText(c.texte.numero ?? c.texte.titre);
    expect(await couleursRouges(historique)).toEqual([]);
    expect(await couleursRouges(encadre)).toEqual([]);
  });

  test('un texte sans lien relevé : version d’origine datée, ni onglet ni marque', async ({ page, request }) => {
    const id = await loiAvecArticles(request);
    exiger(id, 'aucune loi avec des articles : API injoignable ou corpus vide');
    const loi = await lireLeTexte(request, id);
    const statut = loi?.statut_juridique;
    test.skip(!statut, 'ancienne API : pas de statut_juridique (vérifié par ux-lecteur)');
    test.skip(
      statut!.etat !== 'aucune_modification_connue' || statut!.version_en_base !== null,
      `texte ${id} : des liens sont relevés`,
    );

    await ouvrirAuServeur(page, `/laws/${id}`);
    const encadre = page.getByTestId('law-status');
    await expect(encadre).toHaveAttribute('data-etat', 'origine');
    await expect(encadre).toHaveText(
      `Version d’origine, non consolidée. Aucune modification relevée par JuriX au ${dateFr(statut!.releve_le, 'short')}. Signaler`,
    );
    if (loi?.date_signature) await expect(page.getByTestId('law-date')).toHaveText(`Signé le ${dateFr(loi.date_signature)}`);
    if (loi?.ajoute_le) await expect(page.getByTestId('law-added')).toHaveText(`Ajouté à JuriX le ${dateFr(loi.ajoute_le)}`);
    await expect(page.getByTestId('law-tab-historique')).toHaveCount(0);
    await expect(page.getByTestId('law-toc')).not.toContainText('· modifié');
    await expect(page.getByTestId('law-article-status')).toHaveCount(0);
    // Ni pastille « En vigueur », ni rouge.
    await expect(page.locator('#contenu')).not.toContainText(/en vigueur/i);
    expect(await couleursRouges(encadre)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// P5 : jamais à l'arrivée, même par un lien direct
// ---------------------------------------------------------------------------

test.describe('P5 : « Qui êtes-vous ? »', () => {
  // Navigateur vide : aucun profil choisi ni refusé.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('aucune boîte à l’arrivée par un lien direct vers un article', async ({ page, request }) => {
    const id = await loiAvecArticles(request);
    exiger(id, 'aucune loi avec des articles : API injoignable ou corpus vide');
    // Le lien tel qu'il circule sur WhatsApp : un texte, à un article.
    await ouvrirAuServeur(page, `/laws/${id}?article=2`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('article.article h2')).toBeVisible();

    await expect(page.getByTestId('persona-dialog')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// P4 : la ligne d'état suit les étapes du serveur ; « Arrêter » coupe la requête
// ---------------------------------------------------------------------------

/**
 * Un flux du chat TENU par le test. `page.route` livre un corps d'un bloc :
 * les étapes et le texte arriveraient ensemble, et la ligne d'état ne se
 * verrait jamais. Ici, `fetch` est enveloppé avant tout script de la page :
 * la requête vers /rag/ask/stream reçoit un corps que le test alimente
 * événement par événement (`window.__pousserFlux`), et l'interruption de sa
 * requête (AbortSignal) est notée dans `window.__fluxInterrompu`.
 */
async function tenirLeFlux(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    const fetchDOrigine = window.fetch.bind(window);
    w.__fluxInterrompu = false;
    w.__fluxOuverts = 0;
    window.fetch = (entree: RequestInfo | URL, options?: RequestInit): Promise<Response> => {
      const adresse = typeof entree === 'string' ? entree : entree instanceof URL ? entree.href : entree.url;
      if (!adresse.includes('/rag/ask/stream')) return fetchDOrigine(entree, options);
      w.__fluxOuverts = (w.__fluxOuverts as number) + 1;
      const encodeur = new TextEncoder();
      let flux!: ReadableStreamDefaultController<Uint8Array>;
      const corps = new ReadableStream<Uint8Array>({ start: (c) => void (flux = c) });
      w.__pousserFlux = (evenement: unknown) => flux.enqueue(encodeur.encode(`data: ${JSON.stringify(evenement)}\n\n`));
      w.__finirFlux = () => flux.close();
      const signal = options?.signal;
      const interrompre = () => {
        w.__fluxInterrompu = true;
        try {
          flux.error(new DOMException('The user aborted a request.', 'AbortError'));
        } catch {
          // Flux déjà fermé.
        }
      };
      if (signal?.aborted) {
        interrompre();
        return Promise.reject(new DOMException('The user aborted a request.', 'AbortError'));
      }
      signal?.addEventListener('abort', interrompre, { once: true });
      return Promise.resolve(new Response(corps, { status: 200, headers: { 'content-type': 'text/event-stream' } }));
    };
  });
}

const pousser = (page: Page, evenement: Record<string, unknown>) =>
  page.evaluate((e) => (window as unknown as { __pousserFlux: (e: unknown) => void }).__pousserFlux(e), evenement);

/** Les trois étapes de la nouvelle API (contrat §7.1 a), session et profil dès la première. */
const DEBUT = { chunk: '', done: false, session_id: 'sid-p4-etapes', persona: 'citoyen' };
const RECHERCHE = { ...DEBUT, progression: { etape: 'recherche', libelle: 'Recherche dans les textes…' } };
const TEXTES_TROUVES = {
  ...DEBUT,
  progression: {
    etape: 'textes_trouves',
    libelle: '6 articles trouvés dans 3 textes',
    nb_articles: 6,
    nb_textes: 3,
    textes: [
      { law_id: 2274, law_reference: 'LOI-1992-007', law_title: 'Loi N°92/007 du 14 août 1992 portant Code du travail', date_du_texte: '1992-08-14', nb_articles: 4 },
      { law_id: 2285, law_reference: 'CODE-CIVIL', law_title: 'Code civil applicable au Cameroun', date_du_texte: null, nb_articles: 2 },
    ],
  },
};
const REDACTION = { ...DEBUT, progression: { etape: 'redaction', libelle: 'Rédaction de la réponse…' } };

test.describe('P4 : la ligne d’état et « Arrêter »', () => {
  test.beforeEach(async ({ page }) => {
    await tenirLeFlux(page);
    await intercepterLApi(page, (methode, chemin) =>
      chemin === '/corpus' ? { json: { detail: 'Not Found' }, statut: 404 } : undefined,
    );
  });

  test('accueil sans point pulsé ; les étapes du serveur s’écrivent, la passée cochée', async ({ page }) => {
    await page.goto('/chat');
    await expect(page.getByTestId('chat-disclaimer')).toBeVisible();
    await expect(page.locator('[class*="animate-pulse"], [class*="animate-ping"], [class*="animate-bounce"]')).toHaveCount(0);

    await saisirJusqualEffet(saisieDuChat(page), 'Quelles indemnités en cas de licenciement ?', page.getByTestId('chat-progress'));
    const etat = page.getByTestId('chat-progress');
    await expect(page.getByRole('log')).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByRole('button', { name: 'Arrêter la réponse' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Envoyer', exact: true })).toHaveCount(0);

    await pousser(page, RECHERCHE);
    await expect(etat).toContainText('Recherche dans les textes…');

    await pousser(page, TEXTES_TROUVES);
    await expect(etat.locator('li')).toHaveCount(2);
    await expect(etat.locator('li').last()).toContainText('6 articles trouvés : Code du travail');
    // L'étape passée porte sa coche, dite aux lecteurs d'écran.
    await expect(etat.locator('li').first()).toContainText('Recherche dans les textes…');
    await expect(etat.locator('li').first().locator('.sr-only')).toHaveText(/terminé/);

    await pousser(page, REDACTION);
    await expect(etat.locator('li').last()).toContainText('Rédaction de la réponse…');

    // Le premier mot remplace la ligne d'état ; la fin rend « Envoyer ».
    await pousser(page, { chunk: 'Selon le Code du travail, l’indemnité est due.', done: false });
    await expect(page.getByRole('log')).toContainText('l’indemnité est due');
    await expect(etat).toHaveCount(0);
    await pousser(page, { chunk: '', done: true, session_id: 'sid-p4-etapes', sources: [] });
    await page.evaluate(() => (window as unknown as { __finirFlux: () => void }).__finirFlux());
    await expect(page.getByRole('log')).not.toHaveAttribute('aria-busy', 'true');
    await expect(page.getByRole('button', { name: 'Envoyer', exact: true })).toBeVisible();
  });

  test('« Arrêter » interrompt la requête ; la session vient de la première étape', async ({ page }) => {
    await page.goto('/chat');
    await saisirJusqualEffet(saisieDuChat(page), 'Quelles indemnités en cas de licenciement ?', page.getByTestId('chat-progress'));
    await pousser(page, RECHERCHE);
    await pousser(page, { chunk: 'Selon l’article 35', done: false });
    await expect(page.getByRole('log')).toContainText('Selon l’article 35');

    await page.getByRole('button', { name: 'Arrêter la réponse' }).click();

    await expect.poll(() => page.evaluate(() => (window as unknown as { __fluxInterrompu: boolean }).__fluxInterrompu)).toBe(true);
    await expect(page.getByTestId('chat-stopped')).toContainText('Réponse arrêtée avant la fin.');
    // Le texte reçu reste ; ce n'est pas une panne.
    await expect(page.getByRole('log')).toContainText('Selon l’article 35');
    await expect(page.getByTestId('chat-error')).toHaveCount(0);
    // Une réponse arrêtée n'a pas de dernier événement : la session est celle de la première étape.
    expect(await page.evaluate(() => localStorage.getItem('jurix-chat-session'))).toContain('sid-p4-etapes');
    expect(await page.evaluate(() => (window as unknown as { __fluxOuverts: number }).__fluxOuverts)).toBe(1);
  });
});
