/**
 * Le chat de la refonte UX : P3 (citations vérifiables), P4 (accueil,
 * avertissement, attente lisible, « Arrêter »), P5 (« Qui êtes-vous ? » posé
 * dans le fil, plus jamais à l'arrivée).
 *
 * CE QUE CE FICHIER PROTÈGE.
 * - Une citation se lit dans la phrase même : un toucher ouvre l'article
 *   entier dans une feuille (téléphone) ou un panneau (bureau), que « Fermer »,
 *   Échap et le retour système referment, sans jamais empiler deux aperçus.
 * - Une citation que le serveur n'a pas retrouvée est signalée en toutes
 *   lettres, pas seulement par un soulignement.
 * - L'accueil dit le périmètre réel du corpus (GET /corpus) et rien de plus
 *   quand l'API ne le donne pas ; l'avertissement reste sous le champ.
 * - « Arrêter » coupe la requête ; l'attente est dite en texte.
 * - La boîte « Qui êtes-vous ? » ne s'ouvre plus d'elle-même ; le chat pose la
 *   question à la première question, dans le fil.
 * - Sur l'ancienne API (sans ces champs), le chat se comporte comme avant.
 *
 * Tout est simulé : aucun appel au modèle, aucun backend requis.
 */

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { boutonDEnvoi, intercepterLApi, saisieDuChat, type Simulee } from '../doublures';
import { cliquerJusqualEffet, saisirJusqualEffet } from '../hydratation';

const QUESTION = 'Quelles indemnités en cas de licenciement ?';
const TEXTE =
  "Selon l'article 35 de la loi n° 92/007, l'indemnité de licenciement est due après deux ans de service. L'article 312 du Code pénal réprime les abus.";
const CITE = 'article 35 de la loi n° 92/007';
const INTROUVABLE = 'article 312 du Code pénal';

const RIEN = { etat: null, liens: [], lignes: [] };

/** Le dernier événement de la nouvelle API (contrat-api.md §7.1 c), sur TEXTE. */
const FIN_NOUVELLE_API = {
  chunk: '',
  done: true,
  session_id: 'sid-ux',
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
      excerpt: '(1) Le travailleur…',
      relevance_score: 0.9,
      date_du_texte: '1992-08-14',
      statut: RIEN,
    },
  ],
  textes_consultes_non_cites: [
    {
      law_id: 2285,
      law_reference: 'CODE-CIVIL',
      law_title: 'Code civil applicable au Cameroun',
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

interface Options {
  /** `GET /corpus` répond (nouvelle API) ; sinon 404 (ancienne). */
  corpus?: boolean;
  /** Le flux du chat ; par défaut la réponse de la nouvelle API. */
  flux?: Record<string, unknown>[];
  /** L'aperçu répond ; sinon 404. */
  apercu?: boolean;
}

/** Les corps des questions envoyées. */
async function simuler(page: Page, options: Options = {}): Promise<Record<string, unknown>[]> {
  const questions: Record<string, unknown>[] = [];
  const flux = options.flux ?? [{ chunk: TEXTE, done: false }, FIN_NOUVELLE_API];
  await intercepterLApi(page, (methode, chemin): Simulee | undefined => {
    if (chemin === '/corpus') return options.corpus ? { json: CORPUS } : { json: { detail: 'Not Found' }, statut: 404 };
    if (chemin === '/laws/2274/articles/35') {
      return options.apercu === false ? { json: { detail: 'Not Found' }, statut: 404 } : { json: APERCU_35 };
    }
    if (chemin === '/rag/ask/stream') return { flux };
    return undefined;
  });
  page.on('request', (requete) => {
    if (requete.url().includes('/rag/ask/stream')) questions.push(requete.postDataJSON());
  });
  return questions;
}

async function poser(page: Page, effet = page.getByTestId('chat-citation')) {
  await page.goto('/chat');
  await saisirJusqualEffet(saisieDuChat(page), QUESTION, effet);
}

test.describe('P4 : l’accueil et l’avertissement', () => {
  test('nouvelle API : trois messages, la bienvenue d’abord, trois questions', async ({ page }) => {
    await simuler(page, { corpus: true });
    await page.goto('/chat');

    const fil = page.getByRole('log');
    // La bienvenue remplace la phrase du périmètre (« Je réponds à partir de
    // 2 275 textes… »), à la demande du propriétaire (29/10).
    await expect(fil).toContainText('Bonjour, je suis JuriX, votre assistant juridique. Je suis là pour vous aider. Quelle est votre question ?');
    await expect(fil).not.toContainText('Je réponds à partir');
    await expect(fil).toContainText('Chaque réponse cite ses articles : touchez-les pour lire le texte officiel.');
    await expect(fil).toContainText('N’écrivez ni nom ni numéro de téléphone.');
    await expect(page.getByTestId('chat-suggestion')).toHaveCount(3);
    await expect(page.getByTestId('chat-disclaimer')).toHaveText(
      'Information juridique générale, pas un avis sur votre cas. Vérifiez l’article cité avant d’agir.',
    );
  });

  test('ancienne API (GET /corpus en 404) : la même bienvenue, aucun chiffre ni date inventés', async ({ page }) => {
    await simuler(page, { corpus: false });
    await page.goto('/chat');

    const fil = page.getByRole('log');
    await expect(fil).toContainText('Bonjour, je suis JuriX, votre assistant juridique. Je suis là pour vous aider. Quelle est votre question ?');
    await expect(fil).toContainText('Chaque réponse indique ses sources');
    await expect(fil).not.toContainText('2 275');
    await expect(fil).not.toContainText('à jour au');
  });

  test('l’avertissement reste à l’écran sur un téléphone en paysage', async ({ page }) => {
    await page.setViewportSize({ width: 740, height: 360 });
    await simuler(page);
    await page.goto('/chat');

    await expect(page.getByTestId('chat-disclaimer')).toBeInViewport();
    await expect(saisieDuChat(page)).toBeInViewport();
  });
});

test.describe('P4 : l’attente lisible et « Arrêter »', () => {
  test('pendant la réponse : ligne d’état, fil occupé, « Arrêter » coupe la requête', async ({ page }) => {
    await simuler(page);
    // La réponse n'arrive jamais : seul l'arrêt du lecteur termine l'attente.
    await page.route('**/api/v1/rag/ask/stream', () => new Promise(() => {}));
    await page.goto('/chat');

    await saisirJusqualEffet(saisieDuChat(page), QUESTION, page.getByTestId('chat-progress'));
    await expect(page.getByTestId('chat-progress')).toContainText('Préparation de la réponse…');
    await expect(page.getByRole('log')).toHaveAttribute('aria-busy', 'true');
    const arreter = page.getByRole('button', { name: 'Arrêter la réponse' });
    await expect(arreter).toBeEnabled();

    await arreter.click();

    await expect(page.getByTestId('chat-stopped')).toContainText('Réponse arrêtée avant la fin.');
    await expect(page.getByTestId('chat-error')).toHaveCount(0);
    await expect(page.getByRole('log')).not.toHaveAttribute('aria-busy', 'true');
    await expect(boutonDEnvoi(page)).toBeVisible();
  });
});

test.describe('P3 : les citations, sur téléphone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('dans la phrase, signalées si introuvables, puis la feuille d’aperçu', async ({ page }) => {
    await simuler(page);
    await poser(page);

    const citation = page.getByTestId('chat-citation');
    // Le lien commence au mot élidé qui précède le passage cité (« l’ »), pour
    // que l'icône § ne se glisse pas entre « l’ » et « article »
    // (citations.ts, `rattacherLesElisions`, corrections du chat du 29/10).
    await expect(citation).toHaveText(`l'${CITE}`);
    await expect(citation).toHaveAttribute('href', '/laws/2274?article=35');
    // L'introuvable aussi : ses tirets couvrent « L' » (revue du chat du 29/10,
    // maquette chat-p3a), au lieu de le laisser devant eux.
    await expect(page.getByTestId('chat-citation-introuvable')).toHaveText(`L'${INTROUVABLE}`);
    await expect(page.locator('[data-citation-introuvable]')).toContainText(
      'Citation non retrouvée dans les textes consultés : vérifiez-la avant de vous y fier.',
    );
    await expect(page.getByTestId('chat-article-cite')).toHaveCount(1);
    await expect(page.getByTestId('chat-consultes-toggle')).toHaveAttribute('aria-expanded', 'false');

    await citation.click();

    const feuille = page.getByRole('dialog', { name: 'Art. 35 — Code du travail' });
    await expect(feuille).toHaveAttribute('aria-modal', 'true');
    await expect(feuille.getByTestId('chat-preview-text')).toContainText('a droit à une indemnité de licenciement');
    await expect(feuille.locator('strong')).toContainText('durée de service continue');
    await expect(feuille.getByTestId('chat-preview-status')).toContainText('Version d’origine, non consolidée.');
    await expect(feuille.getByTestId('chat-preview-status')).not.toContainText('vigueur');
    await expect(feuille.getByTestId('chat-preview-close')).toBeFocused();
    await expect(feuille.getByTestId('chat-preview-full')).toHaveAttribute('href', '/laws/2274?article=35');

    // « Fermer » : la feuille part, l'adresse ne change pas, le focus revient.
    await feuille.getByTestId('chat-preview-close').click();
    await expect(page.getByTestId('chat-preview')).toHaveCount(0);
    await expect(page).toHaveURL(/\/chat$/);
    await expect(citation).toBeFocused();
  });

  test('le retour système et Échap referment la feuille sans quitter le chat', async ({ page }) => {
    await simuler(page);
    await poser(page);

    await page.getByTestId('chat-citation').click();
    await expect(page.getByTestId('chat-preview')).toBeVisible();
    await page.goBack();
    await expect(page.getByTestId('chat-preview')).toHaveCount(0);
    await expect(page).toHaveURL(/\/chat$/);
    await expect(page.getByRole('log')).toContainText('indemnité de licenciement');

    await page.getByTestId('chat-article-cite').click();
    await expect(page.getByTestId('chat-preview')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('chat-preview')).toHaveCount(0);
  });

  test('rechargée feuille ouverte, la page ferme l’aperçu suivant au premier « Fermer »', async ({ page }) => {
    // Le rechargement garde l'entrée d'historique de la feuille et son état
    // (`apercuCitation`), que SvelteKit rend au retour sur elle. La clé de
    // l'aperçu repartait de « 1 » à chaque montage : celle de l'aperçu
    // suivant était la même, et « Fermer », revenu sur cette entrée, croyait
    // la feuille encore ouverte. Il fallait deux appuis.
    await simuler(page);
    await poser(page);
    await page.getByTestId('chat-citation').click();
    await expect(page.getByTestId('chat-preview')).toBeVisible();

    await page.reload();
    await saisirJusqualEffet(saisieDuChat(page), QUESTION, page.getByTestId('chat-citation'));
    await page.getByTestId('chat-citation').click();
    const feuille = page.getByTestId('chat-preview');
    await expect(feuille).toBeVisible();

    await feuille.getByTestId('chat-preview-close').click();

    await expect(page.getByTestId('chat-preview')).toHaveCount(0);
    await expect(page).toHaveURL(/\/chat$/);
  });

  test('aperçu introuvable (ancienne API ou 404) : dit, et le texte intégral reste', async ({ page }) => {
    await simuler(page, { apercu: false });
    await poser(page);

    await page.getByTestId('chat-citation').click();

    await expect(page.getByTestId('chat-preview-unavailable')).toBeVisible();
    await expect(page.getByTestId('chat-preview-full')).toHaveAttribute('href', '/laws/2274?article=35');
  });

  test('aucun débordement de côté à 320 px, feuille ouverte comprise', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await simuler(page);
    await poser(page);
    await page.getByTestId('chat-citation').click();
    await expect(page.getByTestId('chat-preview-text')).toBeVisible();

    const largeur = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(largeur).toBeLessThanOrEqual(320);
  });

  for (const theme of ['light', 'dark']) {
    test(`feuille ouverte, thème ${theme} : aucune violation axe sérieuse`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem('jurix-theme', t), theme);
      await simuler(page);
      await poser(page);
      await page.getByTestId('chat-citation').click();
      await expect(page.getByTestId('chat-preview-text')).toBeVisible();

      const resultats = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      const graves = resultats.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(graves, graves.map((v) => `${v.id} — ${v.nodes.length} noeud(s)`).join('\n')).toEqual([]);
    });
  }
});

test.describe('P3 : le panneau d’aperçu, sur ordinateur', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('un panneau à droite, non modal ; une autre citation le remplace sans empiler', async ({ page }) => {
    await simuler(page);
    await poser(page);

    await page.getByTestId('chat-citation').click();
    const panneau = page.getByTestId('chat-preview');
    await expect(panneau).toHaveAttribute('data-mode', 'panneau');
    await expect(panneau).not.toHaveAttribute('aria-modal', 'true');
    // La conversation reste utilisable à côté.
    await page.getByTestId('chat-article-cite').click();
    await expect(page.getByTestId('chat-preview')).toHaveCount(1);

    // Un seul retour suffit à le fermer : le second aperçu a remplacé le premier.
    await page.goBack();
    await expect(page.getByTestId('chat-preview')).toHaveCount(0);
    await expect(page).toHaveURL(/\/chat$/);
  });
});

test.describe('ancienne API : rien ne change', () => {
  test('sans les nouvelles listes, la réponse et ses « Sources » comme avant', async ({ page }) => {
    await simuler(page, {
      flux: [
        { chunk: 'Selon l’article 33 du Code Minier, le permis dure trois ans.', done: false },
        {
          chunk: '',
          done: true,
          session_id: 'sid-ancienne',
          sources: [
            {
              law_id: 42,
              law_reference: 'LOI-2023-014',
              law_title: 'Code Minier',
              article_number: '33',
              article_id: 900,
              excerpt: 'Le permis de recherche est accordé pour trois ans.',
              relevance_score: 0.91,
            },
          ],
        },
      ],
    });
    await page.goto('/chat');
    await saisirJusqualEffet(saisieDuChat(page), QUESTION, page.getByRole('log').getByText('Code Minier').first());

    await expect(page.getByRole('log').getByText('Sources', { exact: true })).toBeVisible();
    await expect(page.locator('a[href*="/laws/42"]')).toBeVisible();
    await expect(page.getByTestId('chat-citation')).toHaveCount(0);
  });
});

test.describe('P5 : « Qui êtes-vous ? » dans le fil, jamais à l’arrivée', () => {
  // Navigateur vide : aucun profil choisi.
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const chemin of ['/', '/about', '/chat']) {
    test(`aucune boîte à l’arrivée sur ${chemin}`, async ({ page }) => {
      await simuler(page);
      await page.goto(chemin);
      await page.waitForLoadState('networkidle');

      await expect(page.getByTestId('persona-dialog')).toHaveCount(0);
    });
  }

  test('la première question attend le profil, puis part avec lui', async ({ page }) => {
    const questions = await simuler(page);
    await page.goto('/chat');

    await saisirJusqualEffet(saisieDuChat(page), QUESTION, page.getByTestId('chat-profile-question'));
    expect(questions).toHaveLength(0);
    await expect(page.getByTestId('persona-dialog')).toHaveCount(0);

    await page.getByTestId('chat-profile-avocat').click();

    await expect(page.getByTestId('chat-citation')).toBeVisible();
    expect(questions).toHaveLength(1);
    expect(questions[0].persona).toBe('avocat');
    await expect(page.getByTestId('chat-profile-chosen')).toContainText('Avocat ou juriste');
    expect(await page.evaluate(() => localStorage.getItem('jurix-persona'))).toBe('avocat');
  });

  test('« Continuer sans profil » : la question part sans profil', async ({ page }) => {
    const questions = await simuler(page);
    await page.goto('/chat');

    await saisirJusqualEffet(saisieDuChat(page), QUESTION, page.getByTestId('chat-profile-skip'));
    await page.getByTestId('chat-profile-skip').click();

    await expect(page.getByTestId('chat-citation')).toBeVisible();
    expect('persona' in questions[0]).toBe(false);
  });

  test('« Changer de profil » prévient qu’une conversation en cours sera remplacée', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('jurix-persona', 'citoyen'));
    await simuler(page);
    await poser(page);

    await cliquerJusqualEffet(page.getByTestId('chat-persona-change'), page.getByTestId('persona-dialog'));

    await expect(page.getByTestId('persona-new-conversation')).toContainText(
      'Choisir un autre profil ouvre une nouvelle conversation.',
    );
  });
});
