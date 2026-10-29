/**
 * Rendu d'une réponse du chat.
 *
 * CE QUE CE FICHIER PROTÈGE. La réponse arrive balisée en markdown — le prompt
 * système du backend le demande — et la page l'interpolait telle quelle. Le
 * lecteur voyait donc `**Réponse directe**`, astérisques comprises. Le rendu
 * passe désormais par `blocsDeReponse` ($lib/texte), en nœuds Svelte, donc
 * échappés : le dépôt s'interdit `{@html}`.
 *
 * Le second invariant est celui du routage d'intention : une réponse
 * conversationnelle arrive avec `sources: []`, et le bloc « Sources » ne doit
 * alors pas s'afficher du tout — c'est ce qui fait disparaître l'article du
 * Code Minier affiché sous « comment vas-tu ? ».
 *
 * Les appels du chat sont interceptés : aucun quota dépensé. Une exception :
 * la fiche qu'ouvre une source est rendue par le SERVEUR, que `page.route` ne
 * voit pas ; ce test-là ouvre une loi réelle de l'API locale, et il est sauté
 * sans elle (échoué avec E2E_EXIGER_BACKEND=1).
 */

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { decouperLeTexte } from '../../../src/lib/components/loi/decoupage';
import { API, exiger, lireListe } from '../doublures';

/**
 * Le chat lit la réponse EN FLUX (`/rag/ask/stream`, événements SSE) : le
 * texte arrive en plusieurs morceaux, le dernier événement porte les sources.
 */
async function repondre(page: Page, corps: Record<string, unknown>) {
  const { answer, sources, intent } = corps as { answer: string; sources: unknown[]; intent: string };
  const moitie = Math.floor(answer.length / 2);
  const evenements = [
    { chunk: answer.slice(0, moitie), done: false },
    { chunk: answer.slice(moitie), done: false },
    { chunk: '', done: true, sources, intent, confidence: 1, session_id: 'sid-rendu' },
  ];
  await page.route('**/api/v1/rag/ask/stream', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: evenements.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(''),
    }),
  );
}

async function poser(page: Page, question: string) {
  await page.goto('/chat');
  const champ = page.getByRole('textbox').first();
  await champ.fill(question);
  await champ.press('Enter');
}

/** Un article tel que la fiche le découpe : son numéro et ses lignes de texte. */
interface ArticleLu {
  numero: string;
  lignes: string[];
}

/**
 * Les articles d'un texte, découpés PAR LA FICHE ELLE-MÊME : `decouperLeTexte`
 * (src/lib/components/loi/decoupage.ts) est le découpage de la page. Une copie
 * de ses règles vivait ici (« Article N » ouvre un article, LIVRE, TITRE ou
 * CHAPITRE le ferme) ; P10 les a élargies (« Art. N. », sections, chapitres
 * collés à leur numéro), et la copie aurait choisi des paragraphes que la page
 * range sous un intitulé de division.
 */
function articlesDe(contenu: string): ArticleLu[] {
  return decouperLeTexte(contenu).articles.map(({ numero, lignes }) => ({ numero, lignes }));
}

interface LoiAOuvrir {
  id: number;
  /** Le second article : celui que demande la source. */
  cible: { numero: string; extrait: string };
  /** Un paragraphe du premier article, qui ne doit PAS s'afficher. */
  premier: string;
  /** Un paragraphe du troisième, qu'affiche « Suivant ». */
  suivant: string;
}

/**
 * Une loi réelle dont les trois premiers articles se distinguent à coup sûr :
 * le second a un numéro unique (`?article=` ouvre sa première occurrence),
 * et chacun a un paragraphe d'au moins 20 caractères qui n'apparaît pas dans
 * l'article voisin. Lue dans l'API : un jeu figé pourrit à la réingestion du
 * corpus. Beaucoup de textes courts (décrets d'un ou deux articles, lignes
 * de signature) ne conviennent pas : 3 sur les 60 premiers, 17 sur 200,
 * parcourus en 1,5 s au plus (mesuré le 2026-10-28). `null` sans API ou sans
 * loi qui convienne.
 */
async function loiAOuvrir(request: APIRequestContext): Promise<LoiAOuvrir | null> {
  const lois = await lireListe<{ id: number; article_count?: number | null }>(request, '/laws/?limit=200');
  const candidates = lois
    .filter((loi) => (loi.article_count ?? 0) >= 3)
    .sort((a, b) => (a.article_count ?? 0) - (b.article_count ?? 0));
  for (const { id } of candidates) {
    const reponse = await request.get(`${API}/api/v1/laws/${id}`, { failOnStatusCode: false }).catch(() => null);
    if (!reponse?.ok()) continue;
    const loi = (await reponse.json().catch(() => null)) as { content?: string | null } | null;
    const articles = articlesDe(loi?.content ?? '');
    if (articles.length < 3) continue;
    const [premier, cible, suivant] = articles;
    // Le premier paragraphe d'au moins 20 caractères (une ligne de date ou
    // de signature ne distingue rien), coupé à 80 : assez pour reconnaître
    // l'article, et un message d'échec qui reste lisible.
    const extrait = (a: ArticleLu) =>
      (a.lignes.find((l) => l.replace(/\s+/g, ' ').trim().length >= 20) ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80)
        .trim();
    const texte = (a: ArticleLu) => a.lignes.join(' ').replace(/\s+/g, ' ');
    if (articles.filter((a) => a.numero === cible.numero).length !== 1) continue;
    if ([premier, cible, suivant].some((a) => extrait(a).length < 20)) continue;
    if (texte(cible).includes(extrait(premier)) || texte(suivant).includes(extrait(cible))) continue;
    if (texte(cible).includes(extrait(suivant))) continue;
    return {
      id,
      cible: { numero: cible.numero, extrait: extrait(cible) },
      premier: extrait(premier),
      suivant: extrait(suivant),
    };
  }
  return null;
}

test.describe('Rendu des réponses du chat', () => {
  test('le markdown est rendu, pas affiché', async ({ page }) => {
    await repondre(page, {
      answer:
        '**Ce qui change**\n\nLa réponse suit la question.\n\n- premier point\n- second point',
      sources: [],
      intent: 'juridique',
    });

    await poser(page, 'quelles sont les conditions du permis ?');

    const journal = page.getByRole('log');
    await expect(journal.getByText('Ce qui change')).toBeVisible();
    // L'invariant qui compte : plus une seule astérisque à l'écran.
    await expect(journal).not.toContainText('**');
    await expect(journal.getByText('premier point')).toBeVisible();
  });

  test('les listes numérotées gardent leur numéro', async ({ page }) => {
    // Profils avocat et étudiant : l'ordre des étapes compte.
    await repondre(page, {
      answer: '1. premier point\n2. second point',
      sources: [],
      intent: 'juridique',
    });

    await poser(page, 'quelles sont les étapes ?');

    const journal = page.getByRole('log');
    await expect(journal.getByText('second point')).toBeVisible();
    await expect(journal).toContainText('2.');
  });

  test('une réponse conversationnelle n’affiche aucune source', async ({ page }) => {
    await repondre(page, {
      answer:
        'Je vais bien, merci — je suis un programme. Je suis là pour vos questions sur le droit camerounais.',
      sources: [],
      intent: 'smalltalk',
    });

    await poser(page, 'comment vas-tu ?');

    await expect(page.getByRole('log')).toContainText('Je vais bien');
    // `sources: []` masque le bloc entier : ni titre, ni liste vide.
    await expect(page.getByRole('log').getByText('Sources', { exact: true })).toHaveCount(0);
  });

  test('une réponse juridique affiche ses sources', async ({ page }) => {
    await repondre(page, {
      answer: 'Selon l’article 33 du Code Minier, le permis est accordé pour trois ans.',
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
      intent: 'juridique',
    });

    await poser(page, 'quelle est la durée du permis de recherche ?');

    const journal = page.getByRole('log');
    await expect(journal.getByText('Sources', { exact: true })).toBeVisible();
    await expect(journal.locator('a[href*="/laws/42"]')).toBeVisible();
  });

  test('une source dit quel article de quel texte, et ouvre CET article', async ({ page, request }) => {
    // La fiche se charge sur le SERVEUR depuis b45d165 (laws/[id]/+page.server.ts,
    // puis son __data.json en navigation) : la loi 42 simulée par `page.route`
    // n'était jamais lue, et la vraie loi 42 de la base s'ouvrait, sur son
    // article 1. Le test n'attrapait donc plus rien. Le texte ouvert est
    // maintenant une loi RÉELLE, et la source vise son DEUXIÈME article : le
    // premier ne doit pas s'afficher.
    const loi = await loiAOuvrir(request);
    exiger(loi, 'aucune loi de la base locale à trois articles distincts (API éteinte ?)');

    // La réponse du chat reste simulée : le nom affiché vient de l'intitulé
    // de la source, pas de la loi ouverte.
    await repondre(page, {
      answer: `Selon l’article ${loi.cible.numero} du Code Minier, le permis est accordé pour trois ans.`,
      sources: [{
        law_id: loi.id, law_reference: 'PRC-9001',
        law_title: 'Loi N°2023/014 du 19 décembre 2023 portant Code Minier',
        article_number: loi.cible.numero, article_id: 900,
        excerpt: 'Le permis de recherche est accordé pour trois ans.', relevance_score: 0.91,
      }],
      intent: 'juridique',
    });

    await poser(page, 'quelle est la durée du permis de recherche ?');

    // Le nom du texte, jamais sa cote interne.
    const source = page.getByTestId('chat-source');
    await expect(source).toContainText(`Article ${loi.cible.numero} — Code Minier`);
    await expect(source).not.toContainText('PRC-9001');

    await source.click();

    await expect(page).toHaveURL(new RegExp(`/laws/${loi.id}\\?article=${loi.cible.numero}$`));
    const article = page.locator('article.article');
    await expect(article).toContainText(loi.cible.extrait);
    await expect(article).not.toContainText(loi.premier);

    // « Suivant » avance : le lien ne ramène pas le lecteur à l'article demandé.
    await page.locator('.article-navigation button').last().click();
    await expect(article).toContainText(loi.suivant);
  });

  test('une panne en cours de flux s’affiche en erreur, sans fausse réponse', async ({ page }) => {
    await page.route('**/api/v1/rag/ask/stream', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: `data: ${JSON.stringify({ chunk: '', done: true, error: 'quota', error_code: 'quota' })}\n\n`,
      }),
    );

    await poser(page, 'quelle est la durée du permis de recherche ?');

    await expect(page.getByTestId('chat-error')).toBeVisible();
    await expect(page.getByTestId('chat-error')).toContainText('quota');
  });
});
