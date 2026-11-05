import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';

vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('$lib/stores/language', async () => {
  const { readable, writable } = await import('svelte/store');
  const { traduireEnTest } = await import('./traductions-de-test');
  return { tr: readable(traduireEnTest), language: writable({ current: 'fr' }), switchLanguage: () => {} };
});

import { blocsDeReponse, sansPictogrammes } from '$lib/texte';
import type { CitationIntrouvable, CitationPositionnee } from '$lib/types';
import { marquerLesCitations } from './citations';
import TexteDeReponse from './TexteDeReponse.svelte';

/** La réponse réelle du contrat (§7.3) : trois citations retrouvées, deux introuvables. */
const REPONSE =
  "📌 **Réponse directe** : selon l'article 35 de la loi n° 92/007, l'indemnité est due. L'article 120 du décret n° 94/199 précise les conditions. L'article 9999 de la loi n° 92/007 fixerait le barème, et l'article 312 du Code pénal réprime les abus. Voir aussi la loi n° 92/007.";

function citation(debut: number, fin: number, texte_cite: string, article: string | null, law_id = 2274): CitationPositionnee {
  return {
    debut,
    fin,
    texte_cite,
    law_id,
    article,
    article_id: article ? 97421 : null,
    reference: 'LOI-1992-007',
    titre: 'Loi N°92/007 du 14 août 1992 portant Code du travail',
    date_du_texte: '1992-08-14',
    statut: { etat: null, liens: [], lignes: [] },
  };
}

const CITATIONS = [
  citation(33, 63, 'article 35 de la loi n° 92/007', '35'),
  citation(88, 119, 'article 120 du décret n° 94/199', '120', 2279),
  citation(262, 275, 'loi n° 92/007', null),
];
const INTROUVABLES: CitationIntrouvable[] = [
  { debut: 146, fin: 178, texte_cite: 'article 9999 de la loi n° 92/007', raison: 'article_non_consulte' },
  { debut: 204, fin: 229, texte_cite: 'article 312 du Code pénal', raison: 'texte_non_consulte' },
];

/** Le texte d'un bloc sans ses puces (ni l'espace qui sépare chacune de son renvoi). */
function texteSansPuces(element: Element): string {
  const copie = element.cloneNode(true) as Element;
  for (const puce of copie.querySelectorAll('[data-testid="chat-puce"]')) {
    const avant = puce.previousSibling;
    if (avant?.nodeType === Node.TEXT_NODE && avant.textContent === ' ') avant.remove();
    puce.remove();
  }
  return copie.textContent ?? '';
}

function rendre(props: Record<string, unknown> = {}) {
  const marque = marquerLesCitations(REPONSE, { citations: CITATIONS, citations_introuvables: INTROUVABLES })!;
  return render(TexteDeReponse, {
    props: { blocs: blocsDeReponse(marque.texte), marque: true, citations: marque.citations, ...props },
  });
}

describe('TexteDeReponse (P3)', () => {
  afterEach(() => cleanup());

  it('pose chaque citation dans la phrase : lien vers l’article, icône §, sans numéro', () => {
    const { getAllByTestId, container } = rendre();

    const liens = getAllByTestId('chat-citation');
    expect(liens).toHaveLength(3);
    expect(liens[0].getAttribute('href')).toBe('/laws/2274?article=35');
    expect(liens[0].getAttribute('aria-haspopup')).toBe('dialog');
    // Le lien commence au mot élidé : l'icône § le précède, au lieu de se
    // glisser entre « l' » et « article » (« selon l' § article 35 »).
    // « n° » et « article » liés à leur numéro par une espace insécable
    // ($lib/texte, `insecablesDuTexte`).
    expect(liens[0].textContent).toBe("l'article\u00A035 de la loi n°\u00A092/007");
    expect(liens[1].textContent).toBe("L'article\u00A0120 du décret n°\u00A094/199");
    const icone = liens[0].querySelector('svg[data-icone="section"]');
    expect(icone).not.toBeNull();
    // L'icône ouvre le groupe insécable qui porte « l'article 35 ».
    expect(icone?.parentElement?.firstElementChild).toBe(icone);
    expect(icone?.parentElement?.textContent).toBe("l'article\u00A035");
    const phrase = liens[0].closest('p')?.textContent ?? '';
    expect(phrase.slice(0, phrase.indexOf("l'article\u00A035")).endsWith('selon ')).toBe(true);
    // Un texte cité sans article mène au texte.
    expect(liens[2].getAttribute('href')).toBe('/laws/2274');
    expect(container.textContent).not.toMatch(/\[\d\]/);
    // Les marques ne s'affichent jamais.
    expect(container.textContent).not.toMatch(/[\uE000-\uF8FF]/);
  });

  it('aucun émoji dans la bulle : la punaise rouge de tête est retirée, la coche garde son sens', () => {
    const { container } = rendre();

    // Guide § 1 : ni émoji ni teinte autre que le rouge des erreurs.
    expect(container.textContent).not.toContain('📌');
    expect(container.querySelector('p')?.textContent?.startsWith('Réponse directe : selon')).toBe(true);

    const tableau = render(TexteDeReponse, {
      props: { blocs: blocsDeReponse('| Condition | Remplie |\n|---|---|\n| Deux ans de service | ✅ |\n| Faute lourde | ❌ |') },
    });
    const cellules = Array.from(tableau.container.querySelectorAll('td')).map((td) => td.textContent);
    expect(cellules).toEqual(['Deux ans de service', '✓', 'Faute lourde', '✗']);
  });

  it('souligne les citations introuvables en tirets, nommées, et ajoute l’alerte en toutes lettres', () => {
    const { getAllByTestId, container } = rendre();

    const perdues = getAllByTestId('chat-citation-introuvable');
    // Les tirets partent du mot élidé, comme le lien d'une citation
    // retrouvée : « l' » ne reste plus dehors (maquette chat-p3a).
    expect(perdues.map((p) => p.textContent)).toEqual([
      "L'article\u00A09999 de la loi n°\u00A092/007",
      "l'article\u00A0312 du Code pénal",
    ]);
    const phrase = perdues[1].closest('p')?.textContent ?? '';
    expect(phrase).toContain("barème, et l'article\u00A0312 du Code pénal (citation non retrouvée) réprime");
    expect(perdues[0].className).toContain('decoration-dashed');
    expect(perdues[0].nextElementSibling?.textContent).toContain('citation non retrouvée');
    // Deux dans le même paragraphe : une alerte, au pluriel, jamais en rouge.
    const alertes = container.querySelectorAll('[data-citation-introuvable]');
    expect(alertes).toHaveLength(1);
    expect(alertes[0].textContent).toContain('Citations non retrouvées dans les textes consultés');
    expect(alertes[0].className).not.toMatch(/red-/);
  });

  it('« **Réponse directe** » garde son gras dans la phrase, citations comprises (blocs en mode `gras`)', () => {
    const marque = marquerLesCitations(REPONSE, { citations: CITATIONS, citations_introuvables: INTROUVABLES })!;
    const { container, getAllByTestId } = render(TexteDeReponse, {
      props: { blocs: blocsDeReponse(marque.texte, { gras: true }), marque: true, citations: marque.citations },
    });

    // Contrat §7.3 : le libellé écrit DANS la phrase, et non seul sur sa ligne.
    const gras = container.querySelectorAll('p strong');
    expect(gras).toHaveLength(1);
    expect(gras[0].textContent).toBe('Réponse directe');
    expect(gras[0].className).toContain('font-semibold');
    expect(container.querySelector('p')?.textContent?.startsWith('Réponse directe : selon')).toBe(true);
    // Ni astérisque ni marque visible, et les citations restent des liens.
    expect(container.textContent).not.toMatch(/[*\uE000-\uF8FF]/);
    expect(getAllByTestId('chat-citation')).toHaveLength(3);
  });

  it('une citation dans un gras est un lien en demi-gras ; le texte d’avant garde sa graisse', () => {
    const texte = '**Selon l’article 37 du Code du travail**, l’indemnité est due.';
    const debut = texte.indexOf('article 37');
    const marque = marquerLesCitations(texte, {
      citations: [citation(debut, debut + 'article 37 du Code du travail'.length, 'article 37 du Code du travail', '37')],
    })!;
    const { container, getByTestId } = render(TexteDeReponse, {
      props: { blocs: blocsDeReponse(marque.texte, { gras: true }), marque: true, citations: marque.citations },
    });

    const lien = getByTestId('chat-citation');
    expect(lien.textContent).toBe('l’article\u00A037 du Code du travail');
    expect(lien.className).toContain('font-semibold');
    expect(container.querySelector('strong')?.textContent).toBe('Selon ');
    // La puce s'ajoute au renvoi (décision C1, refonte A) : la phrase, puce
    // mise à part, reste mot pour mot celle de la réponse ; la puce suit le
    // renvoi après une espace, la virgule suit la puce.
    const phrase = container.querySelector('p')!;
    expect(texteSansPuces(phrase)).toBe('Selon l’article\u00A037 du Code du travail, l’indemnité est due.');
    expect(phrase.textContent).toBe(
      'Selon l’article\u00A037 du Code du travail Art.\u00A037\u00A0· Code du travail, l’indemnité est due.',
    );
  });

  it('ancienne API : le gras et l’espace insécable aussi, sans lien de citation', () => {
    const { container, queryAllByTestId } = render(TexteDeReponse, {
      props: { blocs: blocsDeReponse('**Réponse directe** : la loi n° 92/007 et l’art. 35 s’appliquent.', { gras: true }) },
    });

    expect(queryAllByTestId('chat-citation')).toHaveLength(0);
    expect(container.querySelector('p strong')?.textContent).toBe('Réponse directe');
    expect(container.querySelector('p')?.textContent).toBe('Réponse directe : la loi n°\u00A092/007 et l’art.\u00A035 s’appliquent.');
  });

  it('un clic simple ouvre l’aperçu ; avec Ctrl, le lien garde son effet', async () => {
    const surCitation = vi.fn();
    const { getAllByTestId } = rendre({ surCitation });
    const lien = getAllByTestId('chat-citation')[1];

    await fireEvent.click(lien, { ctrlKey: true });
    expect(surCitation).not.toHaveBeenCalled();

    await fireEvent.click(lien);
    expect(surCitation).toHaveBeenCalledWith(1, lien);
  });

  it('met en évidence la citation dont l’aperçu est ouvert', () => {
    const { getAllByTestId } = rendre({ citationActive: 0 });

    expect(getAllByTestId('chat-citation')[0].className).toContain('bg-zinc-100');
    expect(getAllByTestId('chat-citation')[1].className).not.toContain('bg-zinc-100');
  });

  it('sans marques (ancienne API), le texte et ses adresses, comme avant', () => {
    const { queryAllByTestId, container } = render(TexteDeReponse, {
      props: { blocs: blocsDeReponse('**Titre**\n\nVoir https://prc.cm/fr/textes et l’article 35.\n\n1. premier\n2. second') },
    });

    expect(queryAllByTestId('chat-citation')).toHaveLength(0);
    const adresse = container.querySelector('a[href="https://prc.cm/fr/textes"]');
    expect(adresse?.getAttribute('target')).toBe('_blank');
    expect(container.querySelector('h5')?.textContent).toBe('Titre');
    // Le numéro d'une liste numérotée est du texte, suivi d'une espace.
    expect(container.textContent).toContain('2. second');
  });

  it('un tableau garde son cadre défilant nommé, citations comprises', () => {
    const texte = '| Texte | Article |\n|---|---|\n| Code du travail | article 37 |';
    const debut = texte.indexOf('article 37');
    const marque = marquerLesCitations(texte, { citations: [citation(debut, debut + 10, 'article 37', '37')] })!;
    const { getByRole, getAllByTestId } = render(TexteDeReponse, {
      props: { blocs: blocsDeReponse(marque.texte), marque: true, citations: marque.citations },
    });

    expect(getByRole('region').getAttribute('aria-label')).toBe('Texte, Article');
    expect(getAllByTestId('chat-citation')[0].closest('td')).not.toBeNull();
  });
});

/**
 * L'article 37 cité deux fois (l'indemnité, puis la faute lourde) et
 * l'article 35 une fois, comme la maquette RefonteAssistant.
 */
const DEUX_ARTICLES =
  'Vous avez droit à une indemnité (article 37 du Code du travail). ' +
  'Ce droit ne s’applique pas en cas de faute lourde (article 37 du Code du travail). ' +
  'Le préavis court pendant la procédure (article 35 du Code du travail).';

function citationsDe(texte: string, cites: string[]): CitationPositionnee[] {
  let curseur = 0;
  return cites.map((cite) => {
    const debut = texte.indexOf(cite, curseur);
    curseur = debut + cite.length;
    return citation(debut, curseur, cite, /article (\d+)/.exec(cite)?.[1] ?? null);
  });
}

function rendreDeuxArticles(props: Record<string, unknown> = {}) {
  const cites = ['article 37 du Code du travail', 'article 37 du Code du travail', 'article 35 du Code du travail'];
  const marque = marquerLesCitations(DEUX_ARTICLES, { citations: citationsDe(DEUX_ARTICLES, cites) })!;
  return render(TexteDeReponse, {
    props: { blocs: blocsDeReponse(marque.texte, { gras: true }), marque: true, citations: marque.citations, ...props },
  });
}

describe('TexteDeReponse : les puces de citation (refonte A, décision C1)', () => {
  afterEach(() => cleanup());

  it('une puce APRÈS chaque renvoi, qui garde le sien : même article, même ouverture', () => {
    const { getAllByTestId } = rendreDeuxArticles();

    const renvois = getAllByTestId('chat-citation');
    const puces = getAllByTestId('chat-puce');
    // Le renvoi reste seul à porter `chat-citation` : aucun de plus.
    expect(renvois).toHaveLength(3);
    expect(puces).toHaveLength(3);
    puces.forEach((puce, i) => {
      // Frère du renvoi, jamais dans lui, et séparé de lui par une espace.
      expect(puce.previousElementSibling).toBe(renvois[i]);
      expect(renvois[i].contains(puce)).toBe(false);
      expect(puce.previousSibling?.textContent).toBe(' ');
      expect(puce.tagName).toBe('A');
      expect(puce.getAttribute('href')).toBe(renvois[i].getAttribute('href'));
      expect(puce.getAttribute('aria-haspopup')).toBe('dialog');
    });
    expect(puces[2].getAttribute('href')).toBe('/laws/2274?article=35');
  });

  it('« Art. 37 · Code du travail » à la première puce d’un article, « Art. 37 » ensuite ; le nom accessible entier', () => {
    const { getAllByTestId } = rendreDeuxArticles();

    const puces = getAllByTestId('chat-puce');
    expect(puces.map((p) => p.textContent)).toEqual([
      'Art.\u00A037\u00A0· Code du travail',
      'Art.\u00A037',
      'Art.\u00A035\u00A0· Code du travail',
    ]);
    // Le nom commence par ce qui est écrit (WCAG 2.5.3), et dit le texte même
    // sous la puce courte.
    expect(puces.map((p) => p.getAttribute('aria-label'))).toEqual([
      'Art.\u00A037\u00A0· Code du travail\u202F: voir le passage',
      'Art.\u00A037\u00A0· Code du travail\u202F: voir le passage',
      'Art.\u00A035\u00A0· Code du travail\u202F: voir le passage',
    ]);
  });

  it('un clic sur la puce appelle le même surCitation que le renvoi, avec la puce ; avec Ctrl, c’est un lien', async () => {
    const surCitation = vi.fn();
    const { getAllByTestId } = rendreDeuxArticles({ surCitation });
    const puce = getAllByTestId('chat-puce')[1];

    await fireEvent.click(puce, { ctrlKey: true });
    expect(surCitation).not.toHaveBeenCalled();

    await fireEvent.click(puce);
    expect(surCitation).toHaveBeenCalledWith(1, puce);
    await fireEvent.click(getAllByTestId('chat-citation')[1]);
    expect(surCitation).toHaveBeenLastCalledWith(1, getAllByTestId('chat-citation')[1]);
  });

  it('active, la puce s’inverse ; son renvoi garde sa mise en évidence ; les autres restent claires', () => {
    const { getAllByTestId } = rendreDeuxArticles({ citationActive: 1 });

    const puces = getAllByTestId('chat-puce');
    expect(puces[1].className).toContain('bg-zinc-950');
    expect(puces[1].className).toContain('text-white');
    expect(puces[1].className).toContain('dark:bg-white');
    expect(getAllByTestId('chat-citation')[1].className).toContain('bg-zinc-100');
    for (const autre of [puces[0], puces[2]]) {
      expect(autre.className).toContain('bg-white');
      expect(autre.className).not.toContain('bg-zinc-950');
    }
  });

  it('les puces se posent une à une quand les citations viennent d’arriver, et sans geste ensuite', async () => {
    const { getAllByTestId, rerender } = rendreDeuxArticles({ nouvelles: true });

    const puces = getAllByTestId('chat-puce');
    expect(puces.every((p) => p.classList.contains('mv-citer'))).toBe(true);
    expect(puces.map((p) => p.style.getPropertyValue('--d'))).toEqual(['0ms', '350ms', '700ms']);

    // Une réponse plus ancienne : ses puces sont là, sans geste ni délai, et
    // ce sont les mêmes nœuds.
    await rerender({ nouvelles: false });
    expect(getAllByTestId('chat-puce')).toEqual(puces);
    expect(puces.some((p) => p.classList.contains('mv-citer'))).toBe(false);
    expect(puces.every((p) => p.style.getPropertyValue('--d') === '')).toBe(true);
  });

  it('huit puces : le pas se resserre, la dernière arrive à 1 s au plus (D9)', () => {
    const cites = Array.from({ length: 8 }, (_, i) => `article ${i + 1} du Code du travail`);
    const texte = cites.map((cite) => `Selon l’${cite}, une règle s’applique.`).join(' ');
    const marque = marquerLesCitations(texte, { citations: citationsDe(texte, cites) })!;
    const { getAllByTestId } = render(TexteDeReponse, {
      props: { blocs: blocsDeReponse(marque.texte), marque: true, citations: marque.citations, nouvelles: true },
    });

    const delais = getAllByTestId('chat-puce').map((p) => parseInt(p.style.getPropertyValue('--d'), 10));
    expect(delais).toHaveLength(8);
    expect(delais[0]).toBe(0);
    expect(delais[7]).toBe(1000);
    expect(delais.every((d, i) => i === 0 || d > delais[i - 1])).toBe(true);
  });

  it('ni puce sans citation retrouvée : ancienne API, citation introuvable, bloc de code', () => {
    const avecIntrouvables = rendre();
    // Trois retrouvées, deux introuvables : trois puces seulement.
    expect(avecIntrouvables.getAllByTestId('chat-puce')).toHaveLength(3);
    expect(avecIntrouvables.getAllByTestId('chat-citation-introuvable')[0].nextElementSibling?.getAttribute('data-testid')).not.toBe(
      'chat-puce',
    );
    cleanup();

    const ancienne = render(TexteDeReponse, {
      props: { blocs: blocsDeReponse('Selon l’article 35 de la loi n° 92/007, l’indemnité est due.', { gras: true }) },
    });
    expect(ancienne.queryAllByTestId('chat-puce')).toHaveLength(0);
    cleanup();

    const code = '```\nVoir l’article 37 du Code du travail\n```';
    const debut = code.indexOf('article 37');
    const marque = marquerLesCitations(code, {
      citations: [citation(debut, debut + 'article 37 du Code du travail'.length, 'article 37 du Code du travail', '37')],
    })!;
    const enCode = render(TexteDeReponse, {
      props: { blocs: blocsDeReponse(marque.texte), marque: true, citations: marque.citations },
    });
    expect(enCode.queryAllByTestId('chat-puce')).toHaveLength(0);
  });
});

describe('TexteDeReponse : l’écriture, bloc par bloc (refonte A, enFlux)', () => {
  afterEach(() => cleanup());

  const blocs = (texte: string) => blocsDeReponse(texte, { gras: true });

  it('chaque NOUVEAU bloc arrive du flou au net ; le texte déjà rendu reste le même nœud, sans rejouer', async () => {
    const { container, rerender } = render(TexteDeReponse, {
      props: { blocs: blocs('Premier paragraphe'), enFlux: true },
    });
    const premier = container.querySelector('p')!;
    expect(premier.classList.contains('mv-ecrire')).toBe(true);

    // Son geste fini, il le quitte ; la phrase qui s'allonge ne le reprend pas.
    premier.dispatchEvent(new Event('animationend'));
    expect(premier.classList.contains('mv-ecrire')).toBe(false);
    await rerender({ blocs: blocs('Premier paragraphe, qui s’allonge.') });
    expect(container.querySelector('p')).toBe(premier);
    expect(premier.classList.contains('mv-ecrire')).toBe(false);

    // Un second bloc : lui seul arrive.
    await rerender({ blocs: blocs('Premier paragraphe, qui s’allonge.\n\n## Un titre\n\nSecond paragraphe') });
    const [p1, p2] = container.querySelectorAll('p');
    expect(p1).toBe(premier);
    expect(p1.classList.contains('mv-ecrire')).toBe(false);
    expect(container.querySelector('h5')?.classList.contains('mv-ecrire')).toBe(true);
    expect(p2.classList.contains('mv-ecrire')).toBe(true);
  });

  it('le geste d’une puce, qui remonte au bloc, ne lui ôte pas le sien', async () => {
    const marque = marquerLesCitations(DEUX_ARTICLES, {
      citations: citationsDe(DEUX_ARTICLES, ['article 37 du Code du travail']),
    })!;
    const { container, getByTestId } = render(TexteDeReponse, {
      props: { blocs: blocs(marque.texte), marque: true, citations: marque.citations, enFlux: true, nouvelles: true },
    });

    getByTestId('chat-puce').dispatchEvent(new Event('animationend', { bubbles: true }));
    expect(container.querySelector('p')?.classList.contains('mv-ecrire')).toBe(true);
  });

  it('à la fin (done), les citations entrent dans les MÊMES blocs, et rien ne naît plus en mouvement', async () => {
    const { container, rerender, getAllByTestId } = render(TexteDeReponse, {
      props: { blocs: blocs(DEUX_ARTICLES), enFlux: true },
    });
    const paragraphe = container.querySelector('p')!;

    const marque = marquerLesCitations(DEUX_ARTICLES, {
      citations: citationsDe(DEUX_ARTICLES, ['article 37 du Code du travail', 'article 35 du Code du travail']),
    })!;
    await rerender({
      blocs: blocs(`${marque.texte}\n\nUn dernier mot.`),
      marque: true,
      citations: marque.citations,
      enFlux: false,
      nouvelles: true,
    });

    expect(container.querySelector('p')).toBe(paragraphe);
    expect(getAllByTestId('chat-puce')).toHaveLength(2);
    // Né après `done` : sans geste.
    expect(container.querySelectorAll('p')[1].classList.contains('mv-ecrire')).toBe(false);
  });

  it('hors flux (réponse finie, conversation rouverte), aucun bloc n’a de geste', () => {
    const { container } = render(TexteDeReponse, {
      props: { blocs: blocs('**Titre**\n\nUn paragraphe.\n\n- une puce\n\n1. un numéro\n\n| A | B |\n|---|---|\n| 1 | 2 |') },
    });

    expect(container.querySelectorAll('.mv-ecrire')).toHaveLength(0);
    expect(container.querySelectorAll('p, h5, [role="region"], div[tabindex]').length).toBeGreaterThan(3);
  });
});

describe('sansPictogrammes ($lib/texte), sur les formes que le modèle écrirait', () => {
  // Construits par leurs points de code : sélecteurs et liants sont invisibles dans le source.
  const point = (...codes: number[]) => String.fromCodePoint(...codes);
  const PUNAISE = point(0x1f4cc);
  const JUGE = point(0x1f468, 0x200d, 0x2696, 0xfe0f);
  const DRAPEAU = point(0x1f1e8, 0x1f1f2);
  const TOUCHE_UN = point(0x31, 0xfe0f, 0x20e3);
  const ATTENTION = point(0x26a0, 0xfe0f);
  const COCHE_LOURDE = point(0x2714, 0xfe0f);

  it('retire le pictogramme et le blanc qu’il laissait', () => {
    expect(sansPictogrammes(`${PUNAISE} **Réponse directe** : selon`)).toBe('**Réponse directe** : selon');
    expect(sansPictogrammes(`**${PUNAISE} Réponse directe**`)).toBe('**Réponse directe**');
    expect(sansPictogrammes(`Délai : ${PUNAISE} 3 jours`)).toBe('Délai : 3 jours');
    expect(sansPictogrammes(`(${PUNAISE} note)`)).toBe('(note)');
    expect(sansPictogrammes(`un texte ${PUNAISE}.`)).toBe('un texte.');
    expect(sansPictogrammes(`Oui ${point(0x1f389)} non`)).toBe('Oui non');
    expect(sansPictogrammes(`${JUGE} Le juge`)).toBe('Le juge');
    expect(sansPictogrammes(`${DRAPEAU} Cameroun`)).toBe('Cameroun');
    expect(sansPictogrammes(`${ATTENTION} Attention`)).toBe('Attention');
    expect(sansPictogrammes(`${TOUCHE_UN} Étape`)).toBe('1 Étape');
    expect(sansPictogrammes(`${COCHE_LOURDE} fait`)).toBe('✓ fait');
  });

  it('garde les symboles de texte, dessinés dans la couleur du texte', () => {
    for (const ligne of ['→ **Total** : 10 261 000', 'Budget de l’Autorité. ■', '★ à retenir', '© 2026', '☐ Oui ☐ Non', '❶ Première étape']) {
      expect(sansPictogrammes(ligne)).toBe(ligne);
    }
  });

  it('une ligne faite de pictogrammes seulement ne coupe pas le paragraphe', () => {
    expect(blocsDeReponse(`Première ligne\n${point(0x1f389)}\nseconde ligne`)).toEqual([
      { type: 'paragraphe', texte: 'Première ligne seconde ligne' },
    ]);
  });
});
