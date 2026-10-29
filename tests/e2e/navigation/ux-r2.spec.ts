/**
 * Vérification r2 de la refonte UX (29/10) : ce que les autres specs ux-* ne
 * jugeaient pas encore dans un vrai navigateur, d'après le choix du
 * propriétaire (data/ux-recherche/propositions/propositions.json du dépôt
 * backend).
 *
 * POURQUOI CE FICHIER EXISTE.
 *  - Aucune clé de traduction affichée telle quelle. Les composants de la
 *    refonte appellent des clés que l'intégration ajoute ensuite à
 *    src/lib/stores/language.ts ; une clé oubliée s'affiche brute (`t()` rend
 *    la clé) : « loi.copie.lien » sur le troisième bouton d'un article,
 *    « chat.profileLabel » dans la barre du chat, « accueil.sousTitreCourt »
 *    sous le titre de l'accueil en paysage. Le contrôle unitaire
 *    (language.test.ts) ne compare que les dictionnaires des tests d'écran,
 *    et une clé absente d'eux passait. Ici, l'écran lui-même est lu, en
 *    français et en anglais, aux tailles où chaque libellé court ou long
 *    s'affiche.
 *  - P7 : l'état vide n'était que photographié. Il doit garder ses effectifs
 *    dans les onglets et proposer trois sorties (toutes natures, l'assistant,
 *    les domaines), sans JavaScript aussi.
 *  - P3 : la recette d'une citation (soulignement zinc-400, § de 14 px, pas
 *    de numéro [1], tirets pour l'introuvable) n'était lue nulle part.
 *  - P10 : la plage d'articles des divisions du sommaire, les premiers mots de
 *    chaque article et la barre de 3 px de l'article lu.
 *  - P11 : ni extrait ni icône répétée sur une ligne de liste.
 *  - P1 : l'onglet actif « Historique (N) » marqué par une barre, pas
 *    seulement par la couleur.
 *
 * DONNÉES. Les pages rendues par le serveur lisent la vraie API (sautées
 * quand elle est éteinte, échouées avec E2E_EXIGER_BACKEND=1) ; /search
 * reçoit ses résultats de la doublure côté serveur (`enregistrerLaRecherche`),
 * sans appel au modèle d'embeddings ; le chat et l'aperçu d'un article sont
 * simulés, sans appel au modèle.
 *
 * Lancer : npx playwright test tests/e2e/navigation/ux-r2.spec.ts --project=chromium
 */

import fs from 'node:fs';

import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

import type { SearchResponse } from '../../../src/lib/types';
import {
  AGENT_MOBILE,
  API,
  REPONSE_RECHERCHE,
  enregistrerLaRecherche,
  exiger,
  intercepterLApi,
  ouvrirAuServeur,
  saisieDuChat,
  simulerLaRecherche,
} from '../doublures';
import { cliquerJusqualEffet, saisirJusqualEffet } from '../hydratation';
import { loiAvecArticles } from '../pages-du-site';

const TELEPHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: AGENT_MOBILE };
const PAYSAGE = { viewport: { width: 740, height: 360 }, isMobile: true, hasTouch: true, userAgent: AGENT_MOBILE };
const BUREAU = { viewport: { width: 1440, height: 900 } };

/** La Constitution : un texte modifié, avec préambule (voir ux-complements.spec.ts). */
const TEXTE_MODIFIE = Number(process.env.E2E_TEXTE_MODIFIE ?? 2143);

// ---------------------------------------------------------------------------
// Les clés de traduction affichées telles quelles
// ---------------------------------------------------------------------------

/**
 * Le premier mot des clés de language.ts (« accueil », « chat », « loi »…).
 * Lu dans le fichier source, comme le fait monochrome.spec.ts : le module
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
 * Les clés lues à l'écran : chaque mot des nœuds de texte rendus (les
 * éléments masqués, `display: none`, ne comptent pas ; le texte réservé aux
 * lecteurs d'écran, si) et des noms accessibles posés en attribut, qui a la
 * forme d'une clé (« loi.copie.lien_court »). Le texte officiel est mis à
 * part (`[lang]` posé sur le texte d'une loi, d'un article ou d'un extrait) :
 * l'OCR y colle parfois deux mots autour d'un point (« la loi.Le »).
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

const QUESTION = 'Quelles indemnités en cas de licenciement ?';
const TEXTE =
  "Selon l'article 35 de la loi n° 92/007, l'indemnité de licenciement est due après deux ans de service. L'article 312 du Code pénal réprime les abus.";
const CITE = 'article 35 de la loi n° 92/007';
const INTROUVABLE = 'article 312 du Code pénal';
const RIEN = { etat: null, liens: [], lignes: [] };

/** Le dernier événement de la nouvelle API (contrat §7.1 c), sur TEXTE. */
const FIN_NOUVELLE_API = {
  chunk: '',
  done: true,
  session_id: 'sid-ux-r2',
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
  citations_introuvables: [
    {
      debut: TEXTE.indexOf(INTROUVABLE),
      fin: TEXTE.indexOf(INTROUVABLE) + INTROUVABLE.length,
      texte_cite: INTROUVABLE,
      raison: 'texte_non_consulte',
    },
  ],
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
  textes_consultes_non_cites: [],
};

/**
 * Un aperçu qui déclenche deux mentions de la feuille : un passage
 * « englobant » recadré sur l'en-tête de l'article, et une ligne de bruit
 * d'OCR (lettres isolées). Forme de `GET /laws/{id}/articles/{numero}`
 * (contrat §4). La coupe avant l'article suivant n'est dite que pour un
 * passage qui n'est pas englobant (ApercuDeCitation.svelte) : voir
 * APERCU_COUPE.
 */
const APERCU_ENGLOBANT = {
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
  contenu: [
    'Article 34.- Le contrat de travail peut être suspendu dans les cas prévus par la loi.',
    "Article 35.- (1) En cas de rupture du contrat, le travailleur ayant accompli dans l'entreprise une durée de service continue au moins égale à deux ans a droit à une indemnité de licenciement.",
    '(2) Sont no s s s s s du tras les sommes dues au travailleur.',
    "Article 36.- (1) Le travailleur licencié a droit à un certificat de travail délivré par l'employeur.",
  ].join('\n'),
  tronque: false,
  englobant: true,
  homonymes: [],
  statut: { releve_le: '2026-10-14', etat_du_texte: 'aucune_modification_connue', version_en_base: null, changements: [] },
};

/**
 * L'aperçu de l'article 36, enregistré avec l'article 37 dans le même
 * passage (découpage de la base), sans être englobant : la feuille s'arrête
 * avant l'article 37 et le dit (`chat.preview.cutBefore`).
 */
const APERCU_COUPE = {
  ...APERCU_ENGLOBANT,
  numero: '36',
  article_ids: [97422],
  englobant: false,
  contenu: [
    "Article 36.- (1) Le travailleur licencié a droit à un certificat de travail délivré par l'employeur.",
    'Article 37.- (1) Le certificat indique la date d’entrée et celle de sortie du travailleur.',
  ].join('\n'),
};

/** Une réponse qui cite deux articles : l'aperçu englobant (35), puis l'aperçu coupé (36). */
const TEXTE_DEUX = "Selon l'article 35 de la loi n° 92/007, l'indemnité est due. L'article 36 de la loi n° 92/007 prévoit le certificat.";
function citationDeLaLoi(texte: string, passage: string, article: string, articleId: number) {
  const debut = texte.indexOf(passage);
  return {
    debut,
    fin: debut + passage.length,
    texte_cite: passage,
    law_id: 2274,
    article,
    article_id: articleId,
    reference: 'LOI-1992-007',
    titre: 'Loi N°92/007 du 14 août 1992 portant Code du travail',
    date_du_texte: '1992-08-14',
    statut: RIEN,
  };
}
const FIN_DEUX = {
  ...FIN_NOUVELLE_API,
  citations: [
    citationDeLaLoi(TEXTE_DEUX, CITE, '35', 97421),
    citationDeLaLoi(TEXTE_DEUX, 'article 36 de la loi n° 92/007', '36', 97422),
  ],
  citations_introuvables: [],
};

/** Le chat de la nouvelle API, simulé : /corpus, le flux et les aperçus. */
async function simulerLeChatR2(
  page: Page,
  flux: Record<string, unknown>[] = [{ chunk: TEXTE, done: false }, FIN_NOUVELLE_API],
): Promise<void> {
  await intercepterLApi(page, (methode, chemin) => {
    if (chemin === '/corpus') return { json: { detail: 'Not Found' }, statut: 404 };
    if (chemin === '/laws/2274/articles/35') return { json: APERCU_ENGLOBANT };
    if (chemin === '/laws/2274/articles/36') return { json: APERCU_COUPE };
    if (chemin === '/rag/ask/stream') return { flux };
    if (chemin === '/rag/conversations') return { json: [] };
    return undefined;
  });
}

test.describe('Aucune clé de traduction à l’écran', () => {
  for (const langue of ['fr', 'en'] as const) {
    test.describe(`interface ${langue}`, () => {
      test.describe('téléphone en paysage', () => {
        test.use(PAYSAGE);

        test('accueil : le sous-titre court de l’écran court', async ({ page }) => {
          await poserLaLangue(page, langue);
          await ouvrirAuServeur(page, '/');
          await attendreLaLangue(page, langue);
          expect(await clesAffichees(page)).toEqual([]);
        });
      });

      test.describe('téléphone', () => {
        test.use(TELEPHONE);

        test('page d’un texte : les libellés courts des trois actions', async ({ page, request }) => {
          const id = await loiAvecArticles(request);
          exiger(id, 'aucune loi avec des articles : API injoignable ou corpus vide');
          await poserLaLangue(page, langue);
          await ouvrirAuServeur(page, `/laws/${id}`);
          await attendreLaLangue(page, langue);
          await expect(page.getByTestId('law-copy-link')).toBeVisible();
          expect(await clesAffichees(page)).toEqual([]);
        });

        test('chat : la barre du profil, sans profil choisi', async ({ browser }) => {
          // Navigateur vide : le profil « Général » s'affiche dans la barre.
          const contexte = await browser.newContext({ ...TELEPHONE, storageState: { cookies: [], origins: [] } });
          const page = await contexte.newPage();
          await simulerLeChatR2(page);
          await poserLaLangue(page, langue);
          await page.goto('/chat');
          await attendreLaLangue(page, langue);
          await expect(page.getByTestId('chat-persona')).toHaveAttribute('data-persona', 'general');
          expect(await clesAffichees(page)).toEqual([]);
          await contexte.close();
        });
      });

      test.describe('bureau', () => {
        test.use(BUREAU);

        test('page d’un texte : les actions de l’article, puis le texte entier et son ouverture', async ({ page }) => {
          await poserLaLangue(page, langue);
          await ouvrirAuServeur(page, `/laws/${TEXTE_MODIFIE}`);
          await attendreLaLangue(page, langue);
          await expect(page.getByTestId('law-copy-link')).toBeVisible();
          const articleParArticle = await clesAffichees(page);

          // Jugés ensemble : un échec nomme les clés des deux modes.
          await cliquerJusqualEffet(page.getByTestId('law-mode-texte'), page.getByTestId('law-full-text'));
          expect({ articleParArticle, texteEntier: await clesAffichees(page) }).toEqual({
            articleParArticle: [],
            texteEntier: [],
          });
        });

        test('recherche : l’état vide de l’onglet « Autres »', async ({ page }) => {
          await enregistrerLaRecherche(page.request, [VIDE_PAR_NATURE.query], VIDE_PAR_NATURE);
          await poserLaLangue(page, langue);
          await ouvrirAuServeur(page, `/search?q=${encodeURIComponent(VIDE_PAR_NATURE.query)}&nature=autres`);
          await attendreLaLangue(page, langue);
          await expect(page.getByTestId('search-status')).toBeVisible();
          expect(await clesAffichees(page)).toEqual([]);
        });

        test('chat : la barre du profil, une réponse citée et ses aperçus', async ({ page }) => {
          await simulerLeChatR2(page, [{ chunk: TEXTE_DEUX, done: false }, FIN_DEUX]);
          await poserLaLangue(page, langue);
          await page.goto('/chat');
          await attendreLaLangue(page, langue);
          // Le champ porte le nom de la langue de l'interface (`a11y.chatInput`).
          const champ = langue === 'fr' ? saisieDuChat(page) : page.getByRole('textbox', { name: 'Your question' });
          const citations = page.getByTestId('chat-citation');
          await saisirJusqualEffet(champ, QUESTION, citations.first());

          // Article 35 : passage englobant recadré, et mal lu par l'OCR.
          await citations.first().click();
          await expect(page.getByTestId('chat-preview-englobant')).toBeVisible();
          await expect(page.getByTestId('chat-preview-ocr')).toBeVisible();
          const article35 = await clesAffichees(page);

          // Article 36 : le panneau (non modal) passe à lui, coupé avant
          // l'article 37. Les deux relevés sont jugés ensemble : un échec les
          // nomme tous.
          await citations.nth(1).click();
          await expect(page.getByTestId('chat-preview-cut')).toBeVisible();
          expect({ article35, article36: await clesAffichees(page) }).toEqual({ article35: [], article36: [] });
        });
      });
    });
  }
});

// ---------------------------------------------------------------------------
// P7 : l'état vide, ses effectifs et ses trois sorties
// ---------------------------------------------------------------------------

/**
 * Aucun arrêté, mais 23 textes d'autres natures (contrat §6.2 : effectifs
 * disjonctifs, calculés sans le filtre de nature).
 */
const VIDE_PAR_NATURE: SearchResponse = {
  ...REPONSE_RECHERCHE,
  query: 'indemnite introuvable',
  results: [],
  total: 0,
  candidates: 23,
  facets: {
    types: [
      { value: 'décret', count: 12 },
      { value: 'loi', count: 7 },
      { value: 'acte uniforme', count: 4 },
    ],
    categories: [{ id: 8, name: 'Droit des Affaires, Banque et OHADA', count: 15 }],
    years: [{ value: 2020, count: 5 }],
  },
};

test.describe('P7 : l’état vide d’un onglet, sans JavaScript', () => {
  test.use({ ...BUREAU, javaScriptEnabled: false });

  test('les effectifs restent dans les onglets ; toutes natures, l’assistant, les domaines', async ({ page }) => {
    const q = VIDE_PAR_NATURE.query;
    await enregistrerLaRecherche(page.request, [q], VIDE_PAR_NATURE);
    await ouvrirAuServeur(page, `/search?q=${encodeURIComponent(q)}&nature=arrete`);

    await expect(page.getByRole('heading', { name: /^Aucun arrêté ne contient/ })).toBeVisible();
    await expect(page.locator('#contenu')).toContainText('12 décrets');
    const onglets = page.getByRole('group', { name: 'Nature du texte' });
    await expect(onglets.getByRole('link', { name: /^Décrets\s*12$/ })).toBeVisible();
    await expect(onglets.getByRole('link', { name: /^Lois\s*7$/ })).toBeVisible();
    await expect(onglets.locator('[aria-current="true"]')).toContainText('Arrêtés');

    const toutes = page.getByRole('link', { name: /^Voir les 23 textes, toutes natures$/ });
    await expect(toutes).toHaveAttribute('href', `/search?q=${q.replace(/ /g, '+')}`);
    await expect(page.getByRole('link', { name: 'Poser la question à l’assistant' })).toHaveAttribute(
      'href',
      `/chat?q=${encodeURIComponent(q)}`,
    );
    await expect(page.getByRole('link', { name: 'Parcourir par domaine' })).toHaveAttribute('href', '/#domaines');

    // Sans JavaScript, « toutes natures » rouvre la recherche sans le filtre.
    await toutes.click();
    await expect(page).toHaveURL(new RegExp(`/search\\?q=${q.replace(/ /g, '\\+')}$`));
  });
});

// ---------------------------------------------------------------------------
// P3 : la recette d'une citation
// ---------------------------------------------------------------------------

test.describe('P3 : une citation se lit dans la phrase', () => {
  // Une seule taille : aucun style de citation ne dépend de la largeur
  // (LigneCitee.svelte n'a aucune variante sm:, md: ni lg:).
  test.describe(`${TELEPHONE.viewport.width} px`, () => {
    test.use(TELEPHONE);

    test('soulignée en zinc-400, § de 14 px, sans numéro ; l’introuvable en tirets', async ({ page }) => {
      await simulerLeChatR2(page);
      await page.goto('/chat');
      await saisirJusqualEffet(saisieDuChat(page), QUESTION, page.getByTestId('chat-citation'));

      const citation = page.getByTestId('chat-citation');
      const style = await citation.evaluate((a) => {
        const s = getComputedStyle(a);
        const icone = a.querySelector('svg')?.getBoundingClientRect();
        return {
          ligne: s.textDecorationLine,
          couleur: s.textDecorationColor,
          icone: icone ? { largeur: Math.round(icone.width), hauteur: Math.round(icone.height) } : null,
        };
      });
      expect(style.ligne).toContain('underline');
      expect(style.couleur).toBe('rgb(161, 161, 170)'); // zinc-400
      expect(style.icone).toEqual({ largeur: 14, hauteur: 14 });
      // Pas de numéro [1] : la citation est la phrase même.
      await expect(page.getByRole('log')).not.toContainText(/\[\d+\]/);

      const introuvable = page.getByTestId('chat-citation-introuvable');
      await expect(introuvable).toHaveCSS('text-decoration-style', 'dashed');
      // Jamais de rouge : l'introuvable n'est pas une erreur du site.
      expect(await introuvable.evaluate((s) => getComputedStyle(s).textDecorationColor)).toBe('rgb(113, 113, 122)');
    });
  });
});

// ---------------------------------------------------------------------------
// P10 : le sommaire ; P1 : l'onglet actif ; P11 : les lignes de liste
// ---------------------------------------------------------------------------

/** Un texte découpé en divisions (chapitres, titres) : son sommaire a des plages d'articles. */
async function texteAvecDivisions(request: APIRequestContext): Promise<number | null> {
  const id = await loiAvecArticles(request);
  if (!id) return null;
  const reponse = await request.get(`${API}/api/v1/laws/${id}`, { failOnStatusCode: false }).catch(() => null);
  const loi = reponse?.ok() ? ((await reponse.json()) as { content?: string | null }) : null;
  return loi?.content && /^\s*(CHAPITRE|Chapitre|TITRE|Titre|SECTION|Section)\b/m.test(loi.content) ? id : null;
}

test.describe('P10 : le sommaire d’un texte', () => {
  test.use(BUREAU);

  test('plage d’articles par division, premiers mots par article, barre de 3 px sur l’article lu', async ({
    page,
    request,
  }) => {
    const id = await texteAvecDivisions(request);
    test.skip(!id, 'aucun texte découpé en divisions parmi les premiers');
    await ouvrirAuServeur(page, `/laws/${id}`);
    const sommaire = page.getByTestId('law-toc');

    // « Chapitre I · art. 1 à 4 » : la division et sa plage d'articles.
    await expect(sommaire.getByText(/·\s*art\.\s*\d+(er)?\s*(à\s*\d+)?$/).first()).toBeVisible();

    const liens = sommaire.getByRole('link');
    expect(await liens.count()).toBeGreaterThan(1);
    const entrees = await liens.evaluateAll((as) =>
      as.map((a) => {
        const [numero, debut] = [...a.querySelectorAll(':scope > span')].map((s) => s.textContent?.trim() ?? '');
        const s = getComputedStyle(a);
        return {
          numero,
          debut,
          actif: a.getAttribute('aria-current') === 'location',
          barre: s.borderLeftWidth,
          couleur: s.borderLeftColor,
        };
      }),
    );
    for (const entree of entrees) {
      expect(entree.numero, JSON.stringify(entree)).toMatch(/^Art\.\s/);
      expect(entree.debut.length, `premiers mots de ${entree.numero}`).toBeGreaterThan(0);
      expect(entree.barre).toBe('3px');
    }
    const actifs = entrees.filter((e) => e.actif);
    expect(actifs).toHaveLength(1);
    // La barre de l'article lu se voit (zinc-950), celle des autres non.
    expect(actifs[0].couleur).toBe('rgb(9, 9, 11)');
    for (const autre of entrees.filter((e) => !e.actif)) expect(autre.couleur).toBe('rgba(0, 0, 0, 0)');
  });

  test('P1 : l’onglet actif est marqué par une barre, pas seulement par la couleur', async ({ page, request }) => {
    const reponse = await request
      .get(`${API}/api/v1/laws/${TEXTE_MODIFIE}`, { failOnStatusCode: false })
      .catch(() => null);
    exiger(reponse?.ok(), `texte ${TEXTE_MODIFIE} illisible : API injoignable`);
    test.skip(!('statut_juridique' in (await reponse!.json())), 'ancienne API : pas d’onglet « Historique »');
    await ouvrirAuServeur(page, `/laws/${TEXTE_MODIFIE}`);

    // `toHaveCSS` attend la fin de la transition (`transition-colors`, 150 ms) :
    // lue juste après le clic, la barre est encore entre deux couleurs.
    const actif = async (onglet: Locator) => {
      await expect(onglet).toHaveCSS('border-bottom-width', '2px');
      await expect(onglet).toHaveCSS('border-bottom-color', 'rgb(9, 9, 11)'); // zinc-950
    };
    const inactif = (onglet: Locator) => expect(onglet).toHaveCSS('border-bottom-color', 'rgba(0, 0, 0, 0)');
    await actif(page.getByTestId('law-tab-texte'));
    await inactif(page.getByTestId('law-tab-historique'));

    await cliquerJusqualEffet(page.getByTestId('law-tab-historique'), page.getByTestId('law-history'));
    await actif(page.getByTestId('law-tab-historique'));
    await inactif(page.getByTestId('law-tab-texte'));
  });
});

test.describe('P11 : une ligne de liste', () => {
  test.use(TELEPHONE);

  test('/laws : repères puis objet, ni extrait ni icône', async ({ page }) => {
    await ouvrirAuServeur(page, '/laws');
    const lignes = page.locator('#contenu ul[role="list"] > li');
    await expect(lignes).toHaveCount(20);
    const structure = await lignes.evaluateAll((lis) =>
      lis.map((li) => {
        const a = li.querySelector(':scope > a');
        const enfants = a ? [...a.children] : [];
        return {
          balises: enfants.map((e) => e.tagName.toLowerCase()).join(' '),
          // Une icône n'est permise que dans la pastille de statut, après l'objet.
          iconesAvantLeStatut: enfants.slice(0, 2).reduce((n, e) => n + e.querySelectorAll('svg').length, 0),
        };
      }),
    );
    for (const ligne of structure) {
      expect(['p h2', 'p h2 p']).toContain(ligne.balises);
      expect(ligne.iconesAvantLeStatut).toBe(0);
    }
  });

  test('/search : une ligne par résultat, extrait de deux lignes, mots cherchés en gras', async ({ page }) => {
    await simulerLaRecherche(page);
    await page.goto(`/search?q=${REPONSE_RECHERCHE.query}`);
    const premiere = page.locator('#contenu ul[role="list"] > li').first();
    await expect(premiere.locator('h2 a')).toHaveAttribute('href', /^\/laws\/\d+$/);
    const extrait = premiere.locator('p.line-clamp-2');
    await expect(extrait).toHaveCSS('-webkit-line-clamp', '2');
    await expect(extrait.locator('strong').first()).toHaveText(REPONSE_RECHERCHE.query);
    await expect(premiere.locator('mark')).toHaveCount(0);
  });
});
