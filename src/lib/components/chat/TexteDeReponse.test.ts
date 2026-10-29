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
    expect(container.querySelector('p')?.textContent).toBe('Selon l’article\u00A037 du Code du travail, l’indemnité est due.');
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
