/**
 * Le blog de bout en bout, dans Chromium : le parcours du contrat du 29/10
 * (générer un BROUILLON, le relire, le publier), les défauts relevés par les
 * revues du 29/10, et le contrat du 30/10 (« Relecture + contrôle IA ») :
 * chaque phrase avec son verdict, les sources à côté du texte, une case par
 * partie relue, « Publier » désactivé tant que l'article n'est pas publiable,
 * un seul PUT pour publier, « Retirer du site » réduit à
 * `{"is_published": false}`, les articles d'avant la vérification « À
 * reprendre ».
 *
 * L'API. L'administration est rendue dans le navigateur : ses appels sont
 * interceptés (`page.route`), aucun modèle n'est appelé. Ceux d'un article
 * passent par la doublure du serveur du contrat (`serveurDuBlog`,
 * src/routes/admin/blog/donnees-de-test.ts), la même que les tests vitest.
 * Les pages publiques sont rendues par le serveur, dont `page.route` ne voit
 * pas les appels : elles lisent l'API des tests (VITE_API_URL), qui n'a pas de
 * route /blog à ce jour, comme la production du 29/10. C'est le cas vérifié
 * ici : les trois articles de la rédaction restent servis. Le serveur de :4174
 * (API injoignable) donne la panne. Les autres cas des pages publiques
 * (article de l'API publiable ou non, brouillon, article d'avant la
 * vérification en 404, 503 sur un article de l'API) sont couverts par
 * src/routes/blog/chargement.test.ts et les tests des pages (vitest) : les
 * simuler ici demanderait de modifier la doublure partagée
 * (tests/e2e/doublure-de-l-api.mjs).
 */
import { expect, test, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';

import { ARTICLE_ANCIEN, ECRIT_PAR_LE_MODELE } from '../../../src/lib/data/blog-anciens-de-test';
import {
  BROUILLON,
  CITATION_VERIFIEE,
  PARTIES,
  PHRASES_AVEC_CONTRADICTION,
  PUBLIE,
  SOURCES,
  phrase,
  serveurDuBlog,
} from '../../../src/routes/admin/blog/donnees-de-test';
import { SUPERADMIN, connecter, intercepterLApi, ouvrirAuServeur } from '../doublures';

const EN_PANNE = 'http://localhost:4174';

/** Le premier article de la rédaction, lu dans le fichier source (comme pages-du-site.ts). */
const SLUG_DE_LA_REDACTION = (() => {
  const source = fs.readFileSync(new URL('../../../src/lib/data/blog.ts', import.meta.url), 'utf8');
  return [...source.matchAll(/\bslug:\s*'([^']+)'/g)].map((m) => m[1]);
})();

/**
 * La ligne 1 de jurix_dev (26/10, publiée avant la vérification) telle que la
 * rend l'administration : citations écrites par le modèle, jamais vérifiées,
 * ni contrôle IA ni relecture ; cachée du public.
 */
const ANCIEN_ADMIN = {
  ...ARTICLE_ANCIEN,
  avertissements: [
    'Citation 1 : non vérifiée (écrite avant la vérification par le serveur). Retirez-la, ou remplacez-la par un article de la base.',
    'Citation 2 : non vérifiée (écrite avant la vérification par le serveur). Retirez-la, ou remplacez-la par un article de la base.',
  ],
  controle_ia: null,
  relecture: { parties: {}, par: null, le: null },
  etat_publication: 'citations_non_verifiees',
};

/**
 * L'administration en superadmin, avec la liste donnée. Les appels non
 * simulés reçoivent un 404 (doublures.ts) : rien ne part vers une vraie API.
 */
async function administration(page: Page, liste: unknown, statutDeLaListe = 200) {
  await connecter(page, SUPERADMIN);
  await intercepterLApi(page, (methode, chemin) => {
    if (chemin === '/auth/me') return { json: { ...SUPERADMIN, persona: 'citoyen' } };
    if (methode === 'GET' && chemin === '/blog/admin/all') return { json: liste, statut: statutDeLaListe };
    return undefined;
  });
}

/**
 * Les appels d'un article (PUT, contrôle, relecture de l'article) passent par
 * la doublure du serveur du contrat ; la liste aussi. Rend la doublure.
 */
async function brancherLeServeur(page: Page, serveur: ReturnType<typeof serveurDuBlog>, id: number) {
  await page.route(new RegExp(`/api/v1/blog/(${id}(/controle)?|admin/${id}|admin/all)$`), async (route) => {
    const requete = route.request();
    const chemin = new URL(requete.url()).pathname.replace(/^.*?\/api\/v1/, '');
    const reponse = serveur.repondre(requete.method(), chemin, requete.postData() ? requete.postDataJSON() : undefined);
    await route.fulfill({ status: reponse.statut, contentType: 'application/json', body: JSON.stringify(reponse.corps) });
  });
  return serveur;
}

/** Réponse JSON, Retry-After lisible d'une autre origine (comme l'exposerait l'API). */
const repondre = (route: Route, statut: number, corps: unknown, entetes: Record<string, string> = {}) =>
  route.fulfill({
    status: statut,
    contentType: 'application/json',
    headers: { 'access-control-expose-headers': 'Retry-After', ...entetes },
    body: JSON.stringify(corps),
  });

async function ouvrirLeGenerateur(page: Page) {
  await page.getByRole('button', { name: /Générer un article IA/ }).click();
  await page.getByLabel(/Sujet ou question d’actualité/).fill('Un bailleur peut-il expulser sans juge ?');
}

/** Coche les six cases « J'ai relu cette partie contre les sources ». */
async function toutRelire(page: Page) {
  for (const partie of PARTIES) await page.getByTestId(`blog-case-${partie}`).check();
}

test.afterEach(async ({ page }) => {
  // Une requête volontairement sans réponse ne doit pas faire échouer la fin du test.
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

test.describe('Pages publiques, API sans route /blog (production du 29/10)', () => {
  test('/blog liste les trois articles de la rédaction', async ({ page }) => {
    await ouvrirAuServeur(page, '/blog');
    for (const slug of SLUG_DE_LA_REDACTION) {
      await expect(page.locator(`main a[href="/blog/${slug}"]`), slug).toHaveCount(1);
    }
  });

  test('un article de la rédaction : métadonnées d’article, partage depuis l’adresse de la page', async ({ page }) => {
    const [slug] = SLUG_DE_LA_REDACTION;
    await ouvrirAuServeur(page, `/blog/${slug}`);
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect((description ?? '').length).toBeGreaterThan(0);
    expect((description ?? '').length).toBeLessThanOrEqual(155);
    for (const nom of ['Partager sur WhatsApp', 'Partager sur LinkedIn', 'Partager sur X (Twitter)']) {
      const lien = decodeURIComponent((await page.getByTitle(nom).getAttribute('href')) ?? '');
      expect(lien, nom).toContain(`http://localhost:4173/blog/${slug}`);
      expect(lien, nom).not.toContain('jurix.cm');
    }
  });

  test('le HTML du serveur porte déjà les bons liens de partage (avant le JavaScript)', async ({ request }) => {
    const [slug] = SLUG_DE_LA_REDACTION;
    const html = await (await request.get(`/blog/${slug}`)).text();
    expect(html).not.toContain('jurix.cm');
    expect(html).toContain(encodeURIComponent(`http://localhost:4173/blog/${slug}`));
  });

  test('une adresse inconnue : 404 ; celle d’un article d’avant la vérification aussi', async ({ request }) => {
    const reponse = await request.get('/blog/article-qui-n-existe-pas', { failOnStatusCode: false });
    expect(reponse.status()).toBe(404);
    // La ligne 1 de jurix_dev : cachée du public (décision du propriétaire du 30/10).
    const ancien = await request.get(`/blog/${ARTICLE_ANCIEN.slug}`, { failOnStatusCode: false });
    expect(ancien.status()).toBe(404);
    for (const ecrit of ECRIT_PAR_LE_MODELE) expect(await ancien.text(), ecrit).not.toContain(ecrit);
  });

  test('un article de la rédaction : des citations vérifiées, ni encart ni carte « non vérifiée »', async ({ page }) => {
    const [slug] = SLUG_DE_LA_REDACTION;
    await ouvrirAuServeur(page, `/blog/${slug}`);
    await expect(page.locator('main blockquote.font-texte').first()).toBeVisible();
    await expect(page.locator('main a[href^="/laws/"]').first()).toBeVisible();
    await expect(page.getByTestId('blog-avis-non-verifie')).toHaveCount(0);
    await expect(page.getByTestId('citation-non-verifiee')).toHaveCount(0);
    await expect(page.getByText('Citation non vérifiée')).toHaveCount(0);
  });
});

test.describe('Pages publiques, API injoignable (:4174)', () => {
  test('/blog et les articles de la rédaction restent servis', async ({ request }) => {
    const liste = await request.get(`${EN_PANNE}/blog`, { failOnStatusCode: false });
    expect(liste.status()).toBe(200);
    const html = await liste.text();
    for (const slug of SLUG_DE_LA_REDACTION) expect(html).toContain(`href="/blog/${slug}"`);
    const article = await request.get(`${EN_PANNE}/blog/${SLUG_DE_LA_REDACTION[0]}`, { failOnStatusCode: false });
    expect(article.status()).toBe(200);
  });

  test('un autre article : 503 « momentanément indisponible », et non 404', async ({ request }) => {
    const reponse = await request.get(`${EN_PANNE}/blog/article-de-l-api`, { failOnStatusCode: false });
    expect(reponse.status()).toBe(503);
    expect(await reponse.text()).toContain('<title>Service momentanément indisponible — JuriX</title>');
  });
});

test.describe('Administration du blog', () => {
  test('API sans blog : la page le dit, sans « Générer » ni liste vide', async ({ page }) => {
    await administration(page, { detail: 'Not Found' }, 404);
    await page.goto('/admin/blog');
    await expect(page.getByTestId('blog-non-active')).toContainText('pas encore activé sur l’API');
    await expect(page.getByRole('button', { name: /Générer un article IA/ })).toHaveCount(0);
    await expect(page.getByText(/Aucun article/)).toHaveCount(0);
    await expect(page.getByText(/Erreur HTTP 404/)).toHaveCount(0);
  });

  test('générer, relire chaque phrase contre les sources, corriger, relancer le contrôle, publier en un seul envoi', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await administration(page, []);
    // La génération rend un brouillon dont le résumé est CONTREDIT par l'extrait 3 (l'essai réel du 30/10).
    const contredit = {
      ...BROUILLON,
      controle_ia: { ...BROUILLON.controle_ia, phrases: PHRASES_AVEC_CONTRADICTION },
      etat_publication: 'phrases_contredites',
    };
    const serveur = serveurDuBlog(contredit, {
      phrasesDuControle: (article) => [
        phrase('n1', 'contexte', 0, String(article.context), 'hors_sources', [], 'Le décor de l’article.'),
        phrase('n2', 'resume', 0, String((article.botAnalysis as { summary: string }).summary), 'soutenue', [3], 'Conforme à l’extrait 3.'),
      ],
    });
    await page.route('**/api/v1/blog/generate', async (route) => {
      // Une génération qui prend un peu de temps : l'attente doit se voir.
      await new Promise((fin) => setTimeout(fin, 2_500));
      await repondre(route, 201, { post: serveur.article(), sources: SOURCES, avertissements: [] });
    });
    await page.goto('/admin/blog');
    await expect(page.getByText('Aucun article', { exact: false })).toBeVisible();
    await brancherLeServeur(page, serveur, BROUILLON.id);
    await ouvrirLeGenerateur(page);
    await page.getByRole('button', { name: /Générer le brouillon/ }).click();

    // L'attente : durée honnête, contrôle compris, chronomètre, « Arrêter » qui a le focus.
    const attente = page.getByTestId('blog-generation-en-cours');
    await expect(attente).toContainText('contrôle IA de chaque phrase compris');
    await expect(attente.getByRole('button', { name: 'Arrêter' })).toBeFocused();
    await expect(page.getByTestId('blog-chrono')).toHaveText(/0:0[1-9]/);

    // La relecture s'ouvre : chaque phrase et son verdict, les sources À CÔTÉ du texte.
    // La fenêtre change de nom avec la vue (« Modifier l’article » en édition) :
    // la suite la désigne par son rôle.
    await expect(page.getByRole('dialog', { name: 'Relecture de l’article' })).toBeVisible();
    const fenetre = page.getByRole('dialog');
    const sources = fenetre.getByTestId('blog-sources');
    await expect(sources).toContainText('Sources retrouvées (3)');
    const texte = (await fenetre.getByTestId('blog-relecture').boundingBox())!;
    const panneau = (await sources.boundingBox())!;
    expect(panneau.x).toBeGreaterThan(texte.x + texte.width - 1);
    await expect(sources).toBeInViewport();

    const resume = fenetre.getByTestId('blog-partie-resume');
    const verdict = resume.getByTestId('blog-verdict');
    await expect(verdict).toHaveText('Contredite par l’extrait 3');
    // En rouge : c'est une erreur, la seule teinte du site.
    expect(await verdict.evaluate((el) => getComputedStyle(el).color)).toMatch(/^rgb\(185, 28, 28\)$|^oklch\(0\.505 0\.213 27\.518\)$/);
    await expect(fenetre.getByTestId('blog-partie-impact').getByTestId('blog-verdict')).toHaveText('À vérifier');
    await expect(fenetre.getByTestId('blog-partie-contexte').getByTestId('blog-verdict')).toHaveText('Hors des sources');
    // La raison, à la demande.
    const raison = resume.locator('[id^="raison-"]');
    await expect(raison).toBeHidden();
    await resume.getByRole('button', { name: /Pourquoi/ }).click();
    await expect(raison).toContainText('la juridiction prononce l’expulsion');
    // Le numéro de l'extrait ouvre la source : elle reçoit le focus, dépliée.
    await verdict.getByRole('button', { name: 'Afficher l’extrait 3' }).click();
    await expect(page.locator('#source-3')).toBeFocused();
    await expect(page.locator('#source-3')).toContainText('La juridiction compétente statuant à bref délai');
    await page.screenshot({ path: test.info().outputPath('relecture-contredite-1440.png') });

    // Publier : désactivé, et il dit pourquoi.
    const publier = fenetre.getByRole('button', { name: 'Publier', exact: true });
    await expect(publier).toHaveAttribute('aria-disabled', 'true');
    await expect(fenetre.getByTestId('blog-blocages')).toContainText('1 phrase(s) contredite(s) par les sources');

    // Corriger : le résumé, puis une citation retirée et une explication réécrite.
    await fenetre.getByRole('button', { name: /Édition/ }).click();
    await expect(page.getByRole('dialog', { name: 'Modifier l’article' })).toBeVisible();
    await fenetre.getByLabel(/^Analyse juridique/).fill('Le bailleur doit saisir la juridiction compétente pour obtenir l’expulsion.');
    const citations = fenetre.getByTestId('blog-citation');
    await citations.nth(1).getByRole('button', { name: 'Retirer' }).click();
    await expect(citations).toHaveCount(1);
    await citations.first().getByLabel('Explication').fill('Entrer chez autrui contre son gré est puni.');
    await fenetre.getByRole('button', { name: /Relecture/ }).click();
    await expect(fenetre.getByTestId('blog-partie-resume')).toContainText('Modifié, non enregistré');
    await expect(fenetre.getByTestId('blog-case-resume')).toBeDisabled();

    // « Enregistrer et relancer le contrôle IA » : le brouillon d'abord, puis le contrôle.
    await fenetre.getByTestId('blog-relancer-controle').click();
    await expect(fenetre.getByTestId('blog-fenetre-statut')).toContainText('Contrôle IA terminé à');
    await expect(fenetre.getByTestId('blog-partie-resume').getByTestId('blog-verdict')).toHaveText('Soutenue par l’extrait 3');
    const envois = serveur.envois.filter((e) => e.methode !== 'GET');
    expect(envois.map((e) => `${e.methode} ${e.chemin}`)).toEqual(['PUT /blog/12', 'POST /blog/12/controle']);
    expect(envois[0].corps).toMatchObject({
      is_published: false,
      bot_analysis: { citations: [{ ...CITATION_VERIFIEE, title: 'Entrer chez autrui contre son gré est puni.' }] },
    });

    // Relire chaque partie, puis publier : UN SEUL PUT.
    await toutRelire(page);
    await expect(fenetre.getByTestId('blog-publiable')).toContainText('Prêt à publier');
    await expect(publier).not.toHaveAttribute('aria-disabled');
    await page.screenshot({ path: test.info().outputPath('relecture-prete-1440.png') });
    await publier.click();
    await expect(fenetre).toBeHidden();
    const publication = serveur.envois.filter((e) => e.methode === 'PUT').at(-1)!;
    expect(serveur.envois.filter((e) => e.methode === 'PUT')).toHaveLength(2);
    expect(publication.corps).toMatchObject({
      is_published: true,
      relecture: { parties: { contexte: true, resume: true, points_cles: true, impact: true, explications: true, question: true } },
    });
    expect(serveur.article()).toMatchObject({ isPublished: true, etat_publication: 'publiable' });
    await expect(page.getByTestId('blog-avis')).toContainText('est publié sur /blog');
    const ligne = page.locator('li', { has: page.locator('#titre-article-12') });
    await expect(ligne).toContainText('Publié');
    await expect(ligne.getByRole('link', { name: 'Voir sur le site' })).toHaveAttribute('href', `/blog/${BROUILLON.slug}`);
  });

  test('le serveur refuse la publication (422) : sa raison, au premier plan, et rien n’est publié', async ({ page }) => {
    await administration(page, [BROUILLON]);
    const serveur = await brancherLeServeur(page, serveurDuBlog(BROUILLON), BROUILLON.id);
    await page.route('**/api/v1/blog/12', (route) =>
      route.request().method() === 'PUT'
        ? repondre(route, 422, { detail: 'Le texte a changé depuis le contrôle IA : relancez-le.', code: 'controle_a_relancer' })
        : route.fallback(),
    );
    await page.goto('/admin/blog');
    await page.getByRole('button', { name: 'Modifier', exact: true }).click();
    const fenetre = page.getByRole('dialog');
    await fenetre.getByRole('button', { name: /Relecture/ }).click();
    await toutRelire(page);
    await fenetre.getByRole('button', { name: 'Publier', exact: true }).click();
    const alerte = fenetre.getByRole('alert');
    await expect(alerte).toContainText('Publication refusée par le serveur');
    await expect(alerte).toContainText('Le texte a changé depuis le contrôle IA');
    const devant = await alerte.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    });
    expect(devant).toBe(true);
    expect(serveur.article().isPublished).toBe(false);
    await expect(page.locator('li', { has: page.locator('#titre-article-12') })).toContainText('Brouillon');
  });

  const ERREURS: [string, (route: Route) => Promise<void>, RegExp][] = [
    ['503 saturation', (route) => repondre(route, 503, { detail: 's', code: 'saturation' }, { 'Retry-After': '10' }), /Le modèle est saturé/],
    ['429 quota', (route) => repondre(route, 429, { detail: 'q', code: 'quota' }, { 'Retry-After': '60' }), /quota du modèle est épuisé/],
    ['422 sans source', (route) => repondre(route, 422, { detail: 'x', code: 'sans_source' }), /Aucun texte publié dans JuriX ne couvre ce sujet/],
    [
      '422 de FastAPI',
      (route) => repondre(route, 422, { detail: [{ loc: ['body', 'topic'], msg: 'String should have at most 300 characters', type: 'string_too_long' }] }),
      // Espaces insécables avant les deux-points (typographie française).
      /Sujet\s:\strop long/,
    ],
    ['502 réponse invalide', (route) => repondre(route, 502, { detail: 'j', code: 'reponse_invalide' }), /pas rendu un article lisible/],
    ['504 délai', (route) => repondre(route, 504, { detail: 'd', code: 'delai' }), /150 secondes/],
    ['réseau coupé', (route) => route.abort('failed'), /n’a pas pu être joint/],
  ];

  for (const [nom, gestionnaire, attendu] of ERREURS) {
    test(`génération en échec (${nom}) : un message lisible`, async ({ page }) => {
      await administration(page, []);
      await page.route('**/api/v1/blog/generate', gestionnaire);
      await page.goto('/admin/blog');
      await ouvrirLeGenerateur(page);
      await page.getByRole('button', { name: /Générer le brouillon/ }).click();
      const alerte = page.getByTestId('blog-generation-erreur');
      await expect(alerte).toContainText(attendu);
      await expect(alerte).not.toContainText(/\[object Object\]|Failed to fetch|Load failed/);
      // Le focus revient sur « Générer », le sujet reste saisi.
      await expect(page.getByRole('button', { name: /Générer le brouillon/ })).toBeFocused();
      await expect(page.getByLabel(/Sujet ou question d’actualité/)).toHaveValue('Un bailleur peut-il expulser sans juge ?');
    });
  }

  test('le contrôle IA en échec (504) : un message propre au contrôle, rien de perdu', async ({ page }) => {
    await administration(page, [BROUILLON]);
    await brancherLeServeur(page, serveurDuBlog(BROUILLON), BROUILLON.id);
    await page.route('**/api/v1/blog/12/controle', (route) => repondre(route, 504, { detail: 'd', code: 'delai' }));
    await page.goto('/admin/blog');
    await page.getByRole('button', { name: 'Modifier', exact: true }).click();
    const fenetre = page.getByRole('dialog');
    await fenetre.getByRole('button', { name: /Relecture/ }).click();
    await fenetre.getByTestId('blog-relancer-controle').click();
    await expect(fenetre.getByRole('alert')).toContainText('Le serveur a abandonné le contrôle IA (délai dépassé). Rien n’est perdu');
    await expect(fenetre.getByTestId('blog-relancer-controle')).toHaveText(/Relancer le contrôle IA/);
    // Le contrôle précédent reste affiché, rien n'a bougé.
    await expect(fenetre.getByTestId('blog-phrase')).toHaveCount(7);
  });

  test('« Arrêter » coupe l’attente et prévient que le brouillon peut apparaître', async ({ page }) => {
    await administration(page, []);
    await page.route('**/api/v1/blog/generate', () => {
      // Jamais de réponse.
    });
    await page.goto('/admin/blog');
    await ouvrirLeGenerateur(page);
    await page.getByRole('button', { name: /Générer le brouillon/ }).click();
    await page.getByRole('button', { name: 'Arrêter' }).click();
    await expect(page.getByTestId('blog-generation-avis')).toContainText('Génération arrêtée');
    await expect(page.getByTestId('blog-generation-en-cours')).toHaveCount(0);
  });

  test('sans réponse, le client abandonne à 160 s', async ({ page }) => {
    await page.clock.install();
    await administration(page, []);
    await page.route('**/api/v1/blog/generate', () => {
      // Jamais de réponse.
    });
    await page.goto('/admin/blog');
    await ouvrirLeGenerateur(page);
    await page.getByRole('button', { name: /Générer le brouillon/ }).click();
    await expect(page.getByTestId('blog-generation-en-cours')).toBeVisible();
    await page.clock.runFor(95_000);
    await expect(page.getByTestId('blog-generation-en-cours')).toContainText('Plus long que d’habitude');
    await page.clock.runFor(66_000);
    await expect(page.getByTestId('blog-generation-erreur')).toContainText('au bout de 160 secondes');
  });

  test('« Voir » d’un brouillon ouvre l’aperçu de l’administration, jamais l’adresse publique', async ({ page }) => {
    await administration(page, [BROUILLON]);
    await page.goto('/admin/blog');
    const ligne = page.locator('li', { has: page.locator('#titre-article-12') });
    await expect(ligne).toBeVisible();
    await expect(ligne.getByRole('link')).toHaveCount(0);
    await ligne.getByRole('button', { name: 'Voir l’aperçu du brouillon' }).click();
    await expect(page.getByRole('dialog', { name: 'Aperçu de l’article' })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/admin/blog');
    expect(page.context().pages()).toHaveLength(1);
  });

  test('la fenêtre : une sélection glissée jusqu’au voile ne la ferme pas ; le focus revient à « Modifier »', async ({ page }) => {
    await administration(page, [BROUILLON]);
    await page.goto('/admin/blog');
    const modifier = page.getByRole('button', { name: 'Modifier', exact: true });
    await modifier.click();
    const fenetre = page.getByRole('dialog', { name: 'Modifier l’article' });
    await expect(fenetre).toBeVisible();

    // Sélection commencée dans le titre, relâchée sur le voile (coin haut gauche).
    const titre = fenetre.getByLabel(/^Titre/);
    const boite = (await titre.boundingBox())!;
    await page.mouse.move(boite.x + boite.width - 10, boite.y + boite.height / 2);
    await page.mouse.down();
    await page.mouse.move(5, 5, { steps: 8 });
    await page.mouse.up();
    await expect(fenetre).toBeVisible();

    // Un vrai clic sur le voile, sans modification : elle se ferme, le focus revient.
    await page.mouse.click(5, 5);
    await expect(fenetre).toBeHidden();
    await expect(modifier).toBeFocused();
  });

  test('un échec d’enregistrement s’affiche dans la fenêtre, au premier plan', async ({ page }) => {
    await administration(page, [BROUILLON]);
    await page.route('**/api/v1/blog/12', (route) => repondre(route, 503, { detail: 's', code: 'saturation' }));
    await page.goto('/admin/blog');
    await page.getByRole('button', { name: 'Modifier', exact: true }).click();
    const fenetre = page.getByRole('dialog', { name: 'Modifier l’article' });
    await fenetre.getByRole('button', { name: 'Enregistrer le brouillon' }).click();
    const alerte = fenetre.getByRole('alert');
    await expect(alerte).toContainText('Le modèle est saturé');
    // Au premier plan : l'élément sous le centre de l'alerte est l'alerte elle-même.
    const devant = await alerte.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    });
    expect(devant).toBe(true);
    await page.screenshot({ path: test.info().outputPath('erreur-dans-la-fenetre.png') });
  });
});

test.describe('Administration : articles d’avant la vérification, retrait, articles en ligne', () => {
  test('article publié avant la vérification : « À reprendre », sans lien public ; « Citation non vérifiée », sans extrait', async ({ page }) => {
    await administration(page, [ANCIEN_ADMIN]);
    await page.goto('/admin/blog');
    const ligne = page.locator('li', { has: page.locator('#titre-article-1') });
    await expect(ligne.getByTestId('blog-a-reprendre')).toHaveText(/À reprendre\s:\spublié avant la vérification/);
    await expect(ligne.locator('a[href^="/blog/"]')).toHaveCount(0);
    // Deux citations non vérifiées, deux points : le serveur et le front ne s'additionnent plus.
    await expect(ligne).toContainText('2 à vérifier');
    await page.screenshot({ path: test.info().outputPath('liste-article-a-reprendre.png') });
    await ligne.getByRole('button', { name: 'Modifier', exact: true }).click();
    const fenetre = page.getByRole('dialog', { name: 'Modifier l’article' });
    await expect(fenetre.getByTestId('blog-citation-etat')).toHaveText(['Citation non vérifiée', 'Citation non vérifiée']);
    await expect(fenetre.getByTestId('blog-citation').locator('blockquote')).toHaveCount(0);
    for (const ecrit of ECRIT_PAR_LE_MODELE.filter((e) => !e.startsWith('Obligations'))) {
      await expect(fenetre.getByText(ecrit, { exact: false }), ecrit).toHaveCount(0);
    }
    await expect(fenetre.getByRole('button', { name: 'Publier les modifications' })).toHaveAttribute('aria-disabled', 'true');
    await expect(fenetre.getByTestId('blog-blocages')).toContainText('2 citation(s) non vérifiée(s)');

    await fenetre.getByRole('button', { name: /Aperçu/ }).click();
    const apercu = page.getByTestId('blog-apercu');
    await expect(apercu.getByTestId('blog-avis-non-verifie')).toBeVisible();
    await expect(apercu.getByTestId('citation-non-verifiee')).toHaveCount(2);
    await expect(apercu.getByTestId('citation-non-verifiee').first()).toContainText('Article 1719');
    await expect(apercu.locator('a[href^="/laws"]')).toHaveCount(0);
    for (const ecrit of ECRIT_PAR_LE_MODELE) await expect(apercu.getByText(ecrit, { exact: false }), ecrit).toHaveCount(0);
  });

  test('« Retirer du site » avec une modification en cours : exactement {"is_published": false}, et l’article est retiré', async ({ page }) => {
    await administration(page, [PUBLIE]);
    const serveur = await brancherLeServeur(page, serveurDuBlog(PUBLIE), PUBLIE.id);
    await page.goto('/admin/blog');
    await page.getByRole('button', { name: 'Modifier', exact: true }).click();
    const fenetre = page.getByRole('dialog', { name: 'Modifier l’article' });
    // L'administrateur a commencé à corriger le résumé, et vide l'impact pour le réécrire.
    await fenetre.getByLabel(/^Analyse juridique/).fill('Résumé en cours de correction.');
    await fenetre.getByLabel(/^Impact citoyen/).fill('');
    await fenetre.getByRole('button', { name: 'Retirer du site' }).click();

    await expect(fenetre.getByTestId('blog-fenetre-statut')).toContainText('Retiré du site');
    expect(serveur.envois.filter((e) => e.methode === 'PUT').map((e) => e.corps)).toEqual([{ is_published: false }]);
    await expect(fenetre.getByRole('alert')).toHaveCount(0);
    await expect(page.locator('li', { has: page.locator('#titre-article-13') })).toContainText('Brouillon');
    // La correction reste dans le formulaire.
    await expect(fenetre.getByLabel(/^Analyse juridique/)).toHaveValue('Résumé en cours de correction.');
  });

  test('article en ligne : le texte relu changé bloque « Publier les modifications » ; la rubrique seule part en un seul PUT', async ({ page }) => {
    await administration(page, [PUBLIE]);
    const serveur = await brancherLeServeur(page, serveurDuBlog(PUBLIE), PUBLIE.id);
    await page.goto('/admin/blog');
    await page.getByRole('button', { name: 'Modifier', exact: true }).click();
    const fenetre = page.getByRole('dialog', { name: 'Modifier l’article' });
    const resume = fenetre.getByLabel(/^Analyse juridique/);
    await resume.fill('Selon l’article 312 du Code pénal, le bailleur…');
    const publier = fenetre.getByRole('button', { name: 'Publier les modifications' });
    await expect(publier).toHaveAttribute('aria-disabled', 'true');
    await expect(fenetre.getByTestId('blog-blocages')).toContainText('retirez l’article du site, enregistrez le brouillon');
    await publier.focus();
    await page.keyboard.press('Enter');
    await expect(fenetre.getByTestId('blog-blocages')).toBeFocused();
    expect(serveur.envois.filter((e) => e.methode === 'PUT')).toHaveLength(0);

    // Annuler la saisie du résumé ; changer la rubrique seule.
    await resume.fill(PUBLIE.botAnalysis.summary);
    await fenetre.getByLabel(/^Rubrique/).fill('Logement');
    await expect(publier).not.toHaveAttribute('aria-disabled');
    await publier.click();
    await expect(fenetre).toBeHidden();
    const puts = serveur.envois.filter((e) => e.methode === 'PUT');
    expect(puts).toHaveLength(1);
    expect(puts[0].corps).toMatchObject({ category: 'Logement', is_published: true });
    await expect(page.locator('li', { has: page.locator('#titre-article-13') })).toContainText('Publié');
  });
});

test.describe('Fenêtre de relecture au téléphone', () => {
  for (const [largeur, hauteur] of [
    [390, 844],
    [320, 568],
  ]) {
    test(`${largeur}×${hauteur} : rien ne dépasse, le pied et ses boutons restent à l’écran, dans les trois vues`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: hauteur });
      await administration(page, [{ ...BROUILLON, avertissements: ['L’article 286 du Code pénal n’est porté par aucune source.'] }]);
      await page.goto('/admin/blog');
      await page.getByRole('button', { name: 'Voir l’aperçu du brouillon' }).click();
      const fenetre = page.getByRole('dialog');
      await expect(fenetre).toBeVisible();
      for (const vue of ['Relecture', 'Aperçu', 'Édition']) {
        await fenetre.getByRole('button', { name: new RegExp(vue) }).click();
        const deborde = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        expect(deborde, vue).toBe(false);
        for (const nom of ['Enregistrer le brouillon', 'Publier']) {
          await expect(fenetre.getByRole('button', { name: nom, exact: true })).toBeInViewport();
        }
        await page.screenshot({ path: test.info().outputPath(`relecture-${largeur}-${vue === 'Aperçu' ? 'apercu' : vue === 'Édition' ? 'edition' : 'relecture'}.png`) });
      }
      // Les cases de relecture se touchent au doigt (44 px).
      await fenetre.getByRole('button', { name: /Relecture/ }).click();
      const caseALaMain = fenetre.locator('label', { has: page.getByTestId('blog-case-resume') });
      await caseALaMain.scrollIntoViewIfNeeded();
      expect((await caseALaMain.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    });

    test(`${largeur}×${hauteur} : un article en ligne, « Retirer du site » et « Publier les modifications » restent à l’écran`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: hauteur });
      await administration(page, [PUBLIE]);
      await page.goto('/admin/blog');
      await page.getByRole('button', { name: 'Modifier', exact: true }).click();
      const fenetre = page.getByRole('dialog');
      await expect(fenetre).toBeVisible();
      const deborde = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      expect(deborde).toBe(false);
      for (const nom of ['Retirer du site', 'Publier les modifications']) {
        const bouton = fenetre.getByRole('button', { name: nom, exact: true });
        await expect(bouton).toBeInViewport();
        // Une cible de 44 px au moins, au doigt.
        expect((await bouton.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      await page.screenshot({ path: test.info().outputPath(`relecture-${largeur}-en-ligne.png`) });
    });
  }
});
