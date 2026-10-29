/**
 * Vérification r3 de la refonte UX (29/10) : les derniers trous entre le
 * choix du propriétaire (data/ux-recherche/propositions/propositions.json du
 * dépôt backend) et les specs ux-*.
 *
 * POURQUOI CE FICHIER EXISTE.
 *  - P10 : « chapitres en h2, articles en h3 avec ancre #art-N et lien
 *    direct ». ux-lecteur juge les ancres et le lien direct sur le premier
 *    texte venu, souvent sans division : les niveaux de titre n'y étaient
 *    jamais lus. Un lecteur d'écran navigue par titres ; un article en h2
 *    au même rang que son chapitre, ou un niveau sauté, le perd. Ici, sur la
 *    Constitution, découpée en titres, en texte entier, avec l'encadré de
 *    l'article réécrit (P1 étape 2) dans ce mode aussi.
 *  - P5 : « jamais à l'arrivée » n'était vérifié que sur /, /about, /chat et
 *    un lien direct vers un texte. Les autres portes d'entrée d'un lien
 *    partagé (une recherche, un domaine, la liste, le blog) ne l'étaient pas.
 *  - P7 : « Poser cette question à l'assistant » mène à /chat?q=… ; rien ne
 *    vérifiait que la question y arrive, PRÉ-REMPLIE et non envoyée (un envoi
 *    d'office dépenserait un appel au modèle pour une phrase que l'on n'a pas
 *    écrite).
 *  - P3 : la feuille d'aperçu est MODALE sur téléphone (focus enfermé), et
 *    « Lire dans le texte intégral » doit mener à l'article cité, pas au
 *    début du texte ; « Textes consultés, non cités » est replié et s'ouvre.
 *    ux-chat ne jugeait que l'adresse du lien et l'état replié.
 *  - P2/P3 : un lien `?article=N` vers un article que le découpage de la page
 *    ne trouvait pas (en-tête « Article 36.- » au milieu d'une ligne, Code du
 *    travail) ouvrait un AUTRE article (« Article 2 ») sous une adresse qui
 *    dit « article=36 » (vérification r3). Le découpage coupe désormais ces
 *    lignes, et un article vraiment absent ouvre le texte entier avec un avis.
 *  - Aucune clé de traduction à l'écran : ux-r2 lit l'accueil, la page d'un
 *    texte, l'état vide d'un onglet de /search et le chat SANS chiffres du
 *    corpus. Les listes (/laws, un domaine, leurs lots 2), une recherche avec
 *    résultats, une recherche qui ne trouve rien et l'accueil du chat AVEC
 *    les chiffres de GET /corpus ne l'étaient pas : trois clés manquaient à
 *    language.ts sans qu'aucune spec ne le voie (vérification r3 du 29/10 :
 *    « laws.searchForText », « listes.plageSurTotal »,
 *    « chat.welcome.scopeLastAdded »).
 *
 * DONNÉES. Les pages rendues par le serveur lisent la vraie API (sautées
 * quand elle est éteinte, échouées avec E2E_EXIGER_BACKEND=1) ; /search reçoit
 * ses résultats de la doublure côté serveur (`enregistrerLaRecherche`), sans
 * appel au modèle d'embeddings ; le chat est simulé, sans appel au modèle.
 *
 * Lancer : npx playwright test tests/e2e/navigation/ux-r3.spec.ts --project=chromium
 */

import fs from 'node:fs';

import { expect, test, type Page } from '@playwright/test';

import type { Category, SearchResponse, StatutJuridique } from '../../../src/lib/types';
import {
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

/**
 * La Constitution (loi 96/06) : découpée en titres (« TITRE PREMIER DE L'ÉTAT
 * ET DE LA SOUVERAINETÉ »…), et modifiée (son article 6 réécrit en entier par
 * la loi 2026/002, contrat de l'API §3.4). Un identifiant en dur, comme dans
 * ux-complements.spec.ts : aucune liste de l'API ne permet de la trouver
 * autrement. E2E_TEXTE_MODIFIE en désigne un autre.
 */
const TEXTE_DECOUPE = Number(process.env.E2E_TEXTE_MODIFIE ?? 2143);

test.describe('P10 : le texte entier, titre par titre', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('chapitres en h2, articles en h3 avec ancre et lien direct, aucun niveau sauté', async ({ page, request }) => {
    const reponse = await request
      .get(`${API}/api/v1/laws/${TEXTE_DECOUPE}`, { failOnStatusCode: false })
      .catch(() => null);
    exiger(reponse?.ok(), `texte ${TEXTE_DECOUPE} illisible : API injoignable`);
    const loi = (await reponse!.json()) as { statut_juridique?: StatutJuridique | null };

    await ouvrirAuServeur(page, `/laws/${TEXTE_DECOUPE}`);
    const texteEntier = page.getByTestId('law-full-text');
    await cliquerJusqualEffet(page.getByTestId('law-mode-texte'), texteEntier);

    const chapitres = texteEntier.locator('h2');
    test.skip((await chapitres.count()) === 0, `texte ${TEXTE_DECOUPE} : aucune division reconnue`);

    // Chaque article : son titre en h3 (sous un chapitre en h2), son ancre
    // `art-N` et un lien direct vers elle.
    const articles = texteEntier.locator('article[id^="art-"]');
    expect(await articles.count()).toBeGreaterThan(1);
    const releves = await articles.evaluateAll((elements) =>
      elements.map((article) => ({
        id: article.id,
        niveau: article.querySelector('[data-titre-article]')?.tagName ?? '',
        lien: article.querySelectorAll(`a[href="#${article.id}"]`).length,
      })),
    );
    for (const releve of releves) {
      expect(releve.id, JSON.stringify(releve)).toMatch(/^art-[^\s#]+$/);
      expect(releve.niveau, `titre de ${releve.id}`).toBe('H3');
      expect(releve.lien, `lien direct de ${releve.id}`).toBe(1);
    }

    // Aucun niveau sauté dans le contenu : h1, puis h2, puis h3. Un titre
    // ne descend jamais de plus d'un rang sous le précédent.
    const niveaux = await page
      .locator('#contenu')
      .locator('h1, h2, h3, h4, h5, h6')
      .evaluateAll((titres) =>
        titres.filter((t) => (t as HTMLElement).offsetParent !== null).map((t) => Number(t.tagName.slice(1))),
      );
    expect(niveaux[0]).toBe(1);
    for (let i = 1; i < niveaux.length; i++) {
      expect(niveaux[i] - niveaux[i - 1], `titres ${niveaux.slice(0, i + 1).join(' > ')}`).toBeLessThanOrEqual(1);
    }

    // Nouvelle API : l'article réécrit le dit aussi en texte entier (P1).
    const statut = loi.statut_juridique;
    const reecrit = statut?.modifie_par.find(
      (c) => !c.depasse && !c.integre_au_texte && c.nature_modification === 'reecrit_en_entier' && c.articles_cibles.length,
    );
    if (reecrit) {
      const article = texteEntier.locator(`article#art-${reecrit.articles_cibles[0]}`);
      await article.scrollIntoViewIfNeeded();
      const encadre = article.getByTestId('law-article-status');
      await expect(encadre).toContainText('Article modifié par la loi');
      await expect(encadre).toContainText('réécrit en entier');
      if (reecrit.texte.id) await expect(encadre.locator(`a[href="/laws/${reecrit.texte.id}"]`).first()).toBeVisible();
    }
  });

  test('un lien `#art-N` ouvre l’article lu, fil d’Ariane compris', async ({ page }) => {
    // Un vrai chargement, comme un lien ouvert depuis une autre application.
    const statut = (await page.goto(`/laws/${TEXTE_DECOUPE}#art-6`))?.status() ?? 0;
    exiger(statut !== 503 && statut < 400, `/laws/${TEXTE_DECOUPE} : statut ${statut}`);
    await expect(page.locator('article.article h2')).toContainText('Article 6', { timeout: 15_000 });
    await expect(page.locator('.breadcrumb [aria-current="location"]')).toContainText('Article 6');
    // L'adresse désigne toujours l'article 6, par l'ancre reçue ou par
    // `?article=6` si la page l'a réécrite (P2).
    await expect(page).toHaveURL(new RegExp(`/laws/${TEXTE_DECOUPE}(\\?article=6(#.*)?|#art-6)$`));
  });
});

test.describe('P2/P3 : un article cité que le découpage ne trouve pas', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  // Le Code du travail (2274) écrit 144 en-têtes « Article N.- », dont 62
  // seulement en début de ligne : les articles 36 à 40, ceux du licenciement,
  // que le chat cite souvent (« Lire dans le texte intégral »), ouvraient
  // « Article 2 » (vérification r3, 29/10).
  test('/laws/2274?article=36 ouvre l’article 36, pas un autre sous la même adresse', async ({ page, request }) => {
    const loi = await request.get(`${API}/api/v1/laws/2274`, { failOnStatusCode: false }).catch(() => null);
    exiger(loi?.ok(), 'Code du travail (2274) illisible : API injoignable ou base réingérée');
    const contenu = ((await loi!.json()) as { content?: string | null }).content ?? '';
    test.skip(!/Article\s+36\s*\.-/.test(contenu), 'plus d’article 36 dans le texte en base');

    await ouvrirAuServeur(page, '/laws/2274?article=36');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('article.article h2')).toContainText(/Article\s*36\b/, { timeout: 5_000 });
    await expect(page.getByTestId('article-introuvable')).toHaveCount(0);
  });

  test('un article absent du texte ouvre le texte entier avec un avis, pas un autre article', async ({ page }) => {
    await ouvrirAuServeur(page, '/laws/2274?article=9999');
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('article-introuvable')).toContainText('9999', { timeout: 5_000 });
    await expect(page.locator('article.article')).toHaveCount(0);
    await expect(page.locator('.article-entier').first()).toBeVisible();
  });

  // Le décret 2017/398 (197) : seul l'article 3 est reconnu ; les deux
  // premiers, que l'OCR n'a pas su lire, sont dans l'ouverture du texte. Elle
  // restait repliée sous l'avis « affiché en entier », derrière un résumé qui
  // ne promettait qu'« intitulé, visas et préambule » (revue du 29/10). Le
  // test unitaire lisait `textContent`, qui compte un `<details>` replié.
  test('/laws/197?article=2 : l’ouverture, où l’OCR a laissé le passage, est dépliée', async ({ page, request }) => {
    const loi = await request.get(`${API}/api/v1/laws/197`, { failOnStatusCode: false }).catch(() => null);
    exiger(loi?.ok(), 'décret 2017/398 (197) illisible : API injoignable ou base réingérée');
    const contenu = ((await loi!.json()) as { content?: string | null }).content ?? '';
    test.skip(!contenu.includes('vendredi 28 et samedi 29 juillet 2017'), 'passage absent du texte en base');

    await ouvrirAuServeur(page, '/laws/197?article=2');
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('article-introuvable')).toContainText('2', { timeout: 5_000 });
    await expect(page.getByTestId('law-opening')).toHaveAttribute('open', '');
    await expect(page.getByTestId('law-opening').getByText(/vendredi 28 et samedi 29 juillet 2017/)).toBeVisible();
  });
});

test.describe('P10 : un texte d’un seul article, avec une ouverture', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  // L'arrêté d'avancement de 193 inspecteurs (1797) : le découpage ne
  // reconnaît que son article 2, et le tableau des promus reste dans
  // l'ouverture. Sans `?article=`, la page n'offrait pas de bascule, et la
  // lecture article par article ne le montrait nulle part (revue du 29/10).
  test('/laws/1797 : la bascule mène au texte entier, ouverture dépliée', async ({ page, request }) => {
    const loi = await request.get(`${API}/api/v1/laws/1797`, { failOnStatusCode: false }).catch(() => null);
    exiger(loi?.ok(), 'arrêté 1797 illisible : API injoignable ou base réingérée');
    const contenu = ((await loi!.json()) as { content?: string | null }).content ?? '';
    test.skip(!contenu.includes('ABISSAMA BOLAMO ALAIN'), 'tableau des promus absent du texte en base');

    await ouvrirAuServeur(page, '/laws/1797');
    test.skip((await page.getByTestId('law-toc').getByRole('link').count()) !== 1, 'pas un texte d’un seul article');
    await cliquerJusqualEffet(page.getByTestId('law-mode-texte'), page.getByTestId('law-full-text'));
    await expect(page.getByTestId('law-opening')).toHaveAttribute('open', '');
    await expect(page.getByTestId('law-full-text').getByText(/ABISSAMA BOLAMO ALAIN/).first()).toBeVisible();
  });
});

test.describe('P5 : aucune boîte « Qui êtes-vous ? » à l’arrivée, quelle que soit la porte', () => {
  // Navigateur vide : aucun profil choisi ni refusé.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('une recherche partagée (/search?q=…)', async ({ page }) => {
    await enregistrerLaRecherche(page.request, ['bail commercial r3']);
    await ouvrirAuServeur(page, '/search?q=bail+commercial+r3');
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('persona-dialog')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('la liste des textes, un domaine et le blog', async ({ page, request }) => {
    const [domaine] = await lireListe<Category>(request, '/categories');
    exiger(domaine, 'aucun domaine : API injoignable');
    for (const chemin of ['/laws', `/categories/${domaine.id}`, '/blog']) {
      await ouvrirAuServeur(page, chemin);
      await page.waitForLoadState('networkidle');
      await expect(page.getByTestId('persona-dialog'), chemin).toHaveCount(0);
      await expect(page.getByRole('dialog'), chemin).toHaveCount(0);
    }
  });
});

test.describe('P7 : « Poser cette question à l’assistant »', () => {
  test('/chat?q=… pré-remplit la question sans l’envoyer', async ({ page }) => {
    const envois: string[] = [];
    await intercepterLApi(page, (methode, chemin) => {
      if (chemin === '/corpus') return { json: { detail: 'Not Found' }, statut: 404 };
      if (chemin === '/rag/ask/stream') {
        envois.push(chemin);
        return { flux: [{ chunk: '', done: true, sources: [] }] };
      }
      return undefined;
    });
    await page.goto('/chat?q=licenciement%20%C3%A9conomique');
    await expect(saisieDuChat(page)).toHaveValue('licenciement économique');
    await page.waitForLoadState('networkidle');
    expect(envois).toEqual([]);
    await expect(page.getByTestId('chat-progress')).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// Aucune clé de traduction à l'écran, sur les pages que ux-r2 ne lit pas
// ---------------------------------------------------------------------------

/**
 * Le premier mot des clés de language.ts (« accueil », « chat », « laws »…),
 * lu dans le fichier source comme le font ux-r2 et monochrome : le module
 * importe `$app/environment`, que la spec ne sait pas résoudre.
 */
function prefixesDesCles(): string[] {
  const source = fs.readFileSync(new URL('../../../src/lib/stores/language.ts', import.meta.url), 'utf8');
  const prefixes = new Set<string>();
  for (const m of source.matchAll(/^\s*'([a-z][A-Za-z0-9_]*)\.[^']+'\s*:/gm)) prefixes.add(m[1]);
  return [...prefixes];
}
const PREFIXES = prefixesDesCles();

/**
 * Les mots de l'écran qui ont la forme d'une clé (« laws.searchForText ») :
 * nœuds de texte rendus (texte réservé aux lecteurs d'écran compris) et noms
 * posés en attribut. Le texte officiel (`[lang]` posé sur une loi, un article
 * ou un extrait) est mis à part : l'OCR y colle parfois deux mots autour d'un
 * point (« la loi.Le »). Même lecture que ux-r2.spec.ts.
 */
async function clesAffichees(page: Page): Promise<string[]> {
  return page.evaluate((prefixes) => {
    const cle = new RegExp(`^(?:${prefixes.join('|')})\\.[a-z][A-Za-z0-9_]*(?:\\.[A-Za-z0-9_]+)*$`);
    const trouvees = new Set<string>();
    const lire = (texte: string | null) => {
      for (const brut of (texte ?? '').split(/[\s()[\]«»“”"‘’',:;·—–]+/)) {
        const mot = brut.replace(/[.…!?]+$/, '');
        if (cle.test(mot)) trouvees.add(mot);
      }
    };
    const horsDuTexteOfficiel = (element: Element) => !element.closest('script, style, noscript, [lang]:not(html)');
    const marcheur = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let noeud = marcheur.nextNode(); noeud; noeud = marcheur.nextNode()) {
      const parent = noeud.parentElement;
      if (!parent || !horsDuTexteOfficiel(parent) || parent.getClientRects().length === 0) continue;
      lire(noeud.textContent);
    }
    for (const element of document.querySelectorAll('[aria-label], [title], [placeholder], [alt]')) {
      if (!horsDuTexteOfficiel(element)) continue;
      for (const attribut of ['aria-label', 'title', 'placeholder', 'alt']) lire(element.getAttribute(attribut));
    }
    return [...trouvees].sort();
  }, PREFIXES);
}

async function poserLaLangue(page: Page, langue: 'fr' | 'en'): Promise<void> {
  await page.addInitScript((valeur) => localStorage.setItem('jurix-language', valeur), langue);
}

/** Attend que la page soit montée : la langue de l'interface n'est appliquée qu'après. */
async function attendreLaLangue(page: Page, langue: 'fr' | 'en'): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('lang', langue);
  await page.waitForLoadState('networkidle');
}

/** Une recherche qui ne trouve rien, ni avec ni sans filtre (contrat §6.2). */
const RIEN_DU_TOUT: SearchResponse = {
  ...REPONSE_RECHERCHE,
  query: 'xylophone quantique r3',
  results: [],
  total: 0,
  candidates: 0,
  facets: { types: [], categories: [], years: [] },
};

/** Les chiffres de GET /corpus (contrat §2), pour l'accueil du chat. */
const CORPUS = {
  textes: 2275,
  articles: 27157,
  textes_par_nature: [{ nature: 'décret', textes: 1702 }],
  texte_le_plus_recent: null,
  dernier_ajout_le: '2026-10-14',
  liens_releves_le: '2026-10-14',
  sources: [],
  libelle_sources: { fr: 'textes officiels camerounais, OHADA et CIMA', en: 'official texts of Cameroon, OHADA and CIMA' },
  calcule_le: '2026-10-28T16:34:58Z',
};

test.describe('Aucune clé de traduction à l’écran (listes, recherche, accueil du chat)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const langue of ['fr', 'en'] as const) {
    test.describe(`interface ${langue}`, () => {
      test('/laws et son lot 2, un domaine et son lot 2', async ({ page, request }) => {
        const categories = await lireListe<Category>(request, '/categories');
        const [domaine] = [...categories].sort((a, b) => (b.law_count ?? 0) - (a.law_count ?? 0));
        exiger(domaine, 'aucun domaine : API injoignable');
        await poserLaLangue(page, langue);
        const relevees: Record<string, string[]> = {};
        for (const chemin of ['/laws', '/laws?page=2', `/categories/${domaine.id}`, `/categories/${domaine.id}?page=2`]) {
          await ouvrirAuServeur(page, chemin);
          await attendreLaLangue(page, langue);
          relevees[chemin] = await clesAffichees(page);
        }
        // Jugées ensemble : un échec nomme les clés de chaque page.
        expect(relevees).toEqual(Object.fromEntries(Object.keys(relevees).map((chemin) => [chemin, []])));
      });

      test('/search : des résultats, puis une recherche qui ne trouve rien', async ({ page }) => {
        await enregistrerLaRecherche(page.request, ['bail commercial cles r3']);
        await enregistrerLaRecherche(page.request, [RIEN_DU_TOUT.query], RIEN_DU_TOUT);
        await poserLaLangue(page, langue);
        await ouvrirAuServeur(page, '/search?q=bail+commercial+cles+r3');
        await attendreLaLangue(page, langue);
        await expect(page.getByTestId('search-status')).toBeVisible();
        const resultats = await clesAffichees(page);
        await ouvrirAuServeur(page, `/search?q=${encodeURIComponent(RIEN_DU_TOUT.query)}`);
        await attendreLaLangue(page, langue);
        await expect(page.getByTestId('search-status')).toBeVisible();
        expect({ resultats, rien: await clesAffichees(page) }).toEqual({ resultats: [], rien: [] });
      });

      test('chat : l’accueil avec les chiffres du corpus (nouvelle API)', async ({ page }) => {
        await intercepterLApi(page, (methode, chemin) => {
          if (chemin === '/corpus') return { json: CORPUS };
          if (chemin === '/rag/conversations') return { json: [] };
          return undefined;
        });
        await poserLaLangue(page, langue);
        await page.goto('/chat');
        await attendreLaLangue(page, langue);
        await expect(page.getByTestId('chat-suggestion').first()).toBeVisible();
        // Le périmètre chiffré : le premier message cite le nombre de textes.
        await expect(page.getByRole('log')).toContainText(/2[\s\u202f\u00a0,]?275/);
        expect(await clesAffichees(page)).toEqual([]);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// P3 : la feuille d'aperçu, au clavier et jusqu'au texte intégral
// ---------------------------------------------------------------------------

const QUESTION = 'Quelles indemnités en cas de licenciement ?';
const TEXTE =
  "Selon l'article 35 de la loi n° 92/007, l'indemnité de licenciement est due après deux ans de service. L'article 312 du Code pénal réprime les abus.";
const CITE = 'article 35 de la loi n° 92/007';
const RIEN = { etat: null, liens: [], lignes: [] };

/** Le dernier événement de la nouvelle API (contrat §7.1 c) : une citation, un texte consulté non cité. */
const FIN = {
  chunk: '',
  done: true,
  session_id: 'sid-ux-r3',
  persona: 'citoyen',
  intent: 'juridique',
  sources: [],
  citations: [
    {
      debut: TEXTE.indexOf(CITE),
      fin: TEXTE.indexOf(CITE) + CITE.length,
      texte_cite: CITE,
      law_id: 2274,
      article: '35',
      article_id: 97421,
      reference: 'LOI-1992-007',
      titre: 'Loi N°92/007 du 14 août 1992 portant Code du travail',
      date_du_texte: '1992-08-14',
      statut: RIEN,
    },
  ],
  citations_introuvables: [],
  articles_cites: [
    {
      law_id: 2274,
      law_reference: 'LOI-1992-007',
      law_title: 'Loi N°92/007 du 14 août 1992 portant Code du travail',
      article_number: '35',
      article_id: 97421,
      excerpt: '(1) En cas de rupture du contrat…',
      relevance_score: 0.9,
      date_du_texte: '1992-08-14',
      statut: RIEN,
    },
  ],
  textes_consultes_non_cites: [
    {
      law_id: 2285,
      law_reference: 'CODE-CIVIL',
      law_title: 'Code civil applicable au Cameroun, annoté de la jurisprudence de la Cour suprême',
      date_du_texte: null,
      articles: ['107'],
      statut: RIEN,
    },
  ],
};

/** L'aperçu de l'article 35 (forme de `GET /laws/{id}/articles/{numero}`, contrat §4). */
const APERCU_35 = {
  law_id: 2274,
  texte: {
    id: 2274,
    reference: 'LOI-1992-007',
    nature: 'loi',
    numero: '92/007',
    titre: 'Loi N°92/007 du 14 août 1992 portant Code du travail',
    date_signature: '1992-08-14',
    annee: 1992,
    date_publication_jo: null,
    consultable: true,
  },
  numero: '35',
  titre: null,
  section: null,
  page: 12,
  article_ids: [97421],
  contenu:
    "(1) En cas de rupture du contrat, le travailleur ayant accompli dans l'entreprise une durée de service continue au moins égale à deux ans a droit à une indemnité de licenciement.\n(2) Un arrêté fixe les modalités de calcul.",
  tronque: false,
  englobant: false,
  homonymes: [],
  statut: { releve_le: '2026-10-14', etat_du_texte: 'aucune_modification_connue', version_en_base: null, changements: [] },
};

/**
 * Le chat simulé dans le NAVIGATEUR (flux, aperçu, /corpus). La page d'un
 * texte, elle, est rendue par le serveur de test, qui lit la vraie API : le
 * lien « texte intégral » y mène pour de bon.
 */
async function simulerLeChat(page: Page): Promise<void> {
  await intercepterLApi(page, (methode, chemin) => {
    if (chemin === '/corpus') return { json: { detail: 'Not Found' }, statut: 404 };
    if (chemin === '/laws/2274/articles/35') return { json: APERCU_35 };
    if (chemin === '/rag/ask/stream') return { flux: [{ chunk: TEXTE, done: false }, FIN] };
    if (chemin === '/rag/conversations') return { json: [] };
    return undefined;
  });
}

test.describe('P3 : la feuille d’aperçu sur téléphone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('modale : le focus ne quitte pas la feuille, au clavier dans les deux sens', async ({ page }) => {
    await simulerLeChat(page);
    await page.goto('/chat');
    await saisirJusqualEffet(saisieDuChat(page), QUESTION, page.getByTestId('chat-citation'));
    await page.getByTestId('chat-citation').click();
    const feuille = page.getByTestId('chat-preview');
    await expect(feuille.getByTestId('chat-preview-text')).toBeVisible();
    await expect(feuille.getByTestId('chat-preview-close')).toBeFocused();

    const dansLaFeuille = () =>
      page.evaluate(() => Boolean(document.querySelector('[data-testid="chat-preview"]')?.contains(document.activeElement)));
    for (const touche of ['Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab']) {
      await page.keyboard.press(touche);
      expect(await dansLaFeuille(), `focus sorti de la feuille après ${touche}`).toBe(true);
    }
  });

  test('« Lire dans le texte intégral » ouvre le texte sur l’article cité', async ({ page, request }) => {
    const loi = await request.get(`${API}/api/v1/laws/2274`, { failOnStatusCode: false }).catch(() => null);
    exiger(loi?.ok(), 'Code du travail (2274) illisible : API injoignable ou base réingérée');
    await simulerLeChat(page);
    await page.goto('/chat');
    await saisirJusqualEffet(saisieDuChat(page), QUESTION, page.getByTestId('chat-citation'));
    await page.getByTestId('chat-citation').click();
    const lien = page.getByTestId('chat-preview-full');
    await expect(lien).toHaveAttribute('href', '/laws/2274?article=35');

    // Un NOUVEL onglet (ApercuDeCitation.svelte) : revenu sur /chat, la page
    // ne réafficherait pas la conversation. Elle reste donc là, aperçu ouvert.
    const [onglet] = await Promise.all([page.waitForEvent('popup'), lien.click()]);
    await expect(onglet).toHaveURL(/\/laws\/2274\?article=35(#.*)?$/);
    await expect(onglet.locator('article.article h2')).toContainText('Article 35', { timeout: 15_000 });
    await expect(page).toHaveURL(/\/chat$/);
    await expect(page.getByRole('log')).toContainText('indemnité de licenciement');
    await onglet.close();
  });
});

test.describe('P3 : « Textes consultés, non cités »', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('replié sous la réponse, il s’ouvre et nomme le texte lu', async ({ page }) => {
    await simulerLeChat(page);
    await page.goto('/chat');
    await saisirJusqualEffet(saisieDuChat(page), QUESTION, page.getByTestId('chat-citation'));
    const bascule = page.getByTestId('chat-consultes-toggle');
    const consultes = page.getByTestId('chat-texte-consulte');
    await expect(bascule).toHaveAttribute('aria-expanded', 'false');
    // Replié : la liste est dans la page, masquée (`hidden`).
    await expect(consultes.first()).toBeHidden();
    // Un seul clic, et non `cliquerJusqualEffet` : la page est hydratée (la
    // réponse est arrivée), et un second clic replierait la liste.
    await bascule.click();
    await expect(bascule).toHaveAttribute('aria-expanded', 'true');
    await expect(consultes).toHaveCount(1);
    await expect(consultes.first()).toBeVisible();
    await expect(consultes.first()).toContainText('Code civil');
    // Le cité reste à part, avec son article.
    await expect(page.getByTestId('chat-article-cite')).toHaveCount(1);
    await expect(page.getByTestId('chat-article-cite').first()).toContainText('35');
  });
});
