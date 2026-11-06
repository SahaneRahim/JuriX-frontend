import { describe, expect, it } from 'vitest';

import type { CitationPositionnee, SourceCitee } from '$lib/types';
import { paragraphesDeLArticle, passageLePlusProche } from './citations';
import {
  articleDeLaCitation,
  carteDeLaCitation,
  cartesDeLaReponse,
  citationsDeLArticle,
  paragraphesAvecPassages,
  passagesDeLArticle,
  type MorceauDuParagraphe,
} from './passages';

/**
 * Un passage par citation (décision C10) : la logique du panneau des articles
 * cités, sans écran. Les cas de cartes/assistant-preuves.md § 5, étape 3 :
 * deux citations du même article et leurs passages disjoints, des passages
 * qui se chevauchent, une phrase trop courte qui n'en donne aucun.
 */

/** L'article 37 des jeux de test : deux propositions que deux phrases distinctes reprennent. */
const ARTICLE_37 =
  "(1) En cas de rupture du contrat de travail à durée indéterminée du fait de l'employeur, hormis le cas de faute lourde du travailleur, le travailleur ayant accompli dans l'entreprise une durée de service continue au moins égale à deux ans a droit à une indemnité de licenciement distincte de celle du préavis.\n" +
  "(2) Le montant de cette indemnité est calculé en fonction de l'ancienneté du travailleur, selon un barème fixé par arrêté.";

/** La réponse : l'article 37 cité deux fois (l'indemnité, puis la faute lourde), l'article 35 une fois. */
const REPONSE =
  'Vous avez droit à une indemnité de licenciement distincte de celle du préavis (article 37 du Code du travail). ' +
  'Ce droit ne s’applique pas en cas de faute lourde du travailleur (article 37 du Code du travail). ' +
  'Le préavis court pendant la procédure (article 35 du Code du travail).';

function citation(occurrence: number, texteCite: string, article: string | null, articleId: number | null): CitationPositionnee {
  let debut = -1;
  for (let i = 0; i <= occurrence; i += 1) debut = REPONSE.indexOf(texteCite, debut + 1);
  return {
    debut,
    fin: debut + texteCite.length,
    texte_cite: texteCite,
    law_id: 2274,
    article,
    article_id: articleId,
    reference: 'LOI-1992-007',
    titre: 'Loi N°92/007 du 14 août 1992 portant Code du travail',
    date_du_texte: '1992-08-14',
    statut: { etat: null, liens: [], lignes: [] },
  };
}

const CITATIONS = [
  citation(0, 'article 37 du Code du travail', '37', 97437),
  citation(1, 'article 37 du Code du travail', '37', 97437),
  citation(0, 'article 35 du Code du travail', '35', 97435),
];
const ARTICLE_37_CITE = { law_id: 2274, article_id: 97437, article_number: '37' };
const ARTICLE_35_CITE = { law_id: 2274, article_id: 97435, article_number: '35' };

/** Le texte souligné d'un paragraphe découpé : ses morceaux actifs, bout à bout. */
const souligne = (paragraphes: MorceauDuParagraphe[][]) =>
  paragraphes
    .flat()
    .filter((m) => m.actif)
    .map((m) => m.texte)
    .join('|');

describe('citationsDeLArticle', () => {
  it('les citations qui désignent l’article, chacune avec SA phrase, sans la citation', () => {
    const trouvees = citationsDeLArticle(REPONSE, CITATIONS, ARTICLE_37_CITE);

    expect(trouvees.map((c) => c.indexCitation)).toEqual([0, 1]);
    expect(trouvees[0].phrase).toBe('Vous avez droit à une indemnité de licenciement distincte de celle du préavis ( )');
    expect(trouvees[1].phrase).toBe('Ce droit ne s’applique pas en cas de faute lourde du travailleur ( )');
    // Le nom du texte cité n'entre jamais dans la phrase : il ferait se
    // ressembler n'importe quel article du Code du travail.
    expect(trouvees.every((c) => !c.phrase.includes('Code du travail'))).toBe(true);
  });

  it('même texte et même morceau lu, ou à défaut même numéro ; jamais un autre texte', () => {
    // Morceau inconnu de la liste, numéro identique : désigné par le numéro.
    expect(citationsDeLArticle(REPONSE, CITATIONS, { ...ARTICLE_37_CITE, article_id: 1 }).map((c) => c.indexCitation)).toEqual([
      0, 1,
    ]);
    expect(citationsDeLArticle(REPONSE, CITATIONS, { ...ARTICLE_37_CITE, law_id: 2279 })).toEqual([]);
    expect(citationsDeLArticle(REPONSE, CITATIONS, ARTICLE_35_CITE).map((c) => c.indexCitation)).toEqual([2]);
  });
});

describe('articleDeLaCitation', () => {
  it('la carte qu’une puce ouvrira : l’article cité qu’elle désigne, ou -1', () => {
    const articles = [ARTICLE_35_CITE, ARTICLE_37_CITE];
    expect(articleDeLaCitation(CITATIONS[0], articles)).toBe(1);
    expect(articleDeLaCitation(CITATIONS[1], articles)).toBe(1);
    expect(articleDeLaCitation(CITATIONS[2], articles)).toBe(0);
    // Un texte cité sans numéro d'article : aucune carte d'article.
    expect(articleDeLaCitation({ ...CITATIONS[0], article: null, article_id: null }, articles)).toBe(-1);
  });
});

describe('passagesDeLArticle (C10 : un passage par citation)', () => {
  it('deux citations du même article : deux passages disjoints, chacun celui de SA phrase', () => {
    const passages = passagesDeLArticle(ARTICLE_37, citationsDeLArticle(REPONSE, CITATIONS, ARTICLE_37_CITE));

    expect([...passages.keys()]).toEqual([0, 1]);
    const indemnite = passages.get(0)!;
    const fauteLourde = passages.get(1)!;
    expect(ARTICLE_37.slice(indemnite.debut, indemnite.fin)).toBe(
      "le travailleur ayant accompli dans l'entreprise une durée de service continue au moins égale à deux ans a droit à une indemnité de licenciement distincte de celle du préavis",
    );
    expect(ARTICLE_37.slice(fauteLourde.debut, fauteLourde.fin)).toBe('hormis le cas de faute lourde du travailleur');
    expect(fauteLourde.fin <= indemnite.debut || indemnite.fin <= fauteLourde.debut).toBe(true);
  });

  it('appelle passageLePlusProche avec la seule phrase de chaque citation', () => {
    const citations = citationsDeLArticle(REPONSE, CITATIONS, ARTICLE_37_CITE);
    const passages = passagesDeLArticle(ARTICLE_37, citations);

    for (const { indexCitation, phrase } of citations) {
      expect(passages.get(indexCitation)).toEqual(passageLePlusProche(ARTICLE_37, [phrase]));
    }
    // Les deux phrases fusionnées, comme la liste « Articles cités » le fait
    // aujourd'hui, ne donnent qu'un passage : celui d'une seule des deux.
    const fusion = passageLePlusProche(ARTICLE_37, citations.map((c) => c.phrase));
    expect([passages.get(0), passages.get(1)].filter((p) => JSON.stringify(p) === JSON.stringify(fusion)).length).toBeLessThanOrEqual(1);
  });

  it('une phrase trop courte ne donne aucun passage (null), sans gêner les autres', () => {
    const passages = passagesDeLArticle(ARTICLE_37, [
      { indexCitation: 4, phrase: 'Voir l’article.' },
      { indexCitation: 7, phrase: 'Ce droit ne s’applique pas en cas de faute lourde du travailleur' },
    ]);

    expect(passages.get(4)).toBeNull();
    expect(passages.get(7)).not.toBeNull();
    expect(passagesDeLArticle(ARTICLE_37, [])).toEqual(new Map());
  });
});

describe('paragraphesAvecPassages', () => {
  it('le texte reste celui des paragraphes de l’aperçu, mot pour mot', () => {
    const passages = passagesDeLArticle(ARTICLE_37, citationsDeLArticle(REPONSE, CITATIONS, ARTICLE_37_CITE));

    for (const actif of [null, 0, 1]) {
      const decoupe = paragraphesAvecPassages(ARTICLE_37, passages, actif);
      expect(decoupe.map((morceaux) => morceaux.map((m) => m.texte).join(''))).toEqual(
        paragraphesDeLArticle(ARTICLE_37, null).map((p) => p.avant),
      );
    }
  });

  it('un seul passage souligné, celui de la citation active ; l’autre reste du texte', () => {
    const passages = passagesDeLArticle(ARTICLE_37, citationsDeLArticle(REPONSE, CITATIONS, ARTICLE_37_CITE));

    expect(souligne(paragraphesAvecPassages(ARTICLE_37, passages, 1))).toBe('hormis le cas de faute lourde du travailleur');
    expect(souligne(paragraphesAvecPassages(ARTICLE_37, passages, 0))).toMatch(/^le travailleur ayant .* du préavis$/);
    // Aucune citation active, ou une citation sans passage : rien de souligné.
    expect(souligne(paragraphesAvecPassages(ARTICLE_37, passages, null))).toBe('');
    expect(souligne(paragraphesAvecPassages(ARTICLE_37, new Map([[0, null]]), 0))).toBe('');
    // Le passage inactif reste un morceau à part : toucher l'autre puce
    // déplace le soulignement sans recomposer le texte.
    const premier = paragraphesAvecPassages(ARTICLE_37, passages, 1)[0];
    expect(premier.find((m) => m.passages.includes(0))?.actif).toBe(false);
    expect(premier.find((m) => m.passages.includes(1))?.actif).toBe(true);
  });

  it('deux passages qui se chevauchent : le texte coupé à chaque borne, le passage actif entier', () => {
    const contenu = 'alpha beta gamma delta epsilon';
    const passages = new Map([
      [0, { debut: 0, fin: 16 }], // « alpha beta gamma »
      [1, { debut: 6, fin: 22 }], // « beta gamma delta »
    ]);

    expect(paragraphesAvecPassages(contenu, passages, 1)).toEqual([
      [
        { texte: 'alpha ', passages: [0], actif: false },
        { texte: 'beta gamma', passages: [0, 1], actif: true },
        { texte: ' delta', passages: [1], actif: true },
        { texte: ' epsilon', passages: [], actif: false },
      ],
    ]);
    expect(souligne(paragraphesAvecPassages(contenu, passages, 0))).toBe('alpha |beta gamma');
  });

  it('un passage sur deux alinéas est souligné dans les deux ; un paragraphe sans passage reste d’un seul morceau', () => {
    const contenu = '(1) Première phrase de l’article.\n\n(2) Seconde phrase, puis la suite.\n(3) Troisième alinéa.';
    const debut = contenu.indexOf('phrase de');
    const fin = contenu.indexOf(', puis');
    const decoupe = paragraphesAvecPassages(contenu, new Map([[3, { debut, fin }]]), 3);

    expect(decoupe).toHaveLength(3);
    expect(decoupe[0].filter((m) => m.actif).map((m) => m.texte)).toEqual(['phrase de l’article.']);
    expect(decoupe[1].filter((m) => m.actif).map((m) => m.texte)).toEqual(['(2) Seconde phrase']);
    expect(decoupe[2]).toEqual([{ texte: '(3) Troisième alinéa.', passages: [], actif: false }]);
  });
});

describe('cartesDeLaReponse', () => {
  const citation = (debut: number, fin: number, article: string | null, law_id = 1): CitationPositionnee =>
    ({ debut, fin, texte_cite: '', law_id, article, article_id: null, reference: 'R', titre: `Texte ${law_id}`, date_du_texte: null, statut: { etat: null, liens: [], lignes: [] } }) as CitationPositionnee;
  const source = (article_number: string | null, law_id = 1) =>
    ({ law_id, law_reference: 'R', law_title: `Texte ${law_id}`, article_number, article_id: null, excerpt: '', relevance_score: 1, date_du_texte: null, statut: { etat: null, liens: [], lignes: [] } }) as SourceCitee;
  const TEXTE = 'Une phrase qui cite. Une autre phrase. Une troisième.';

  it('une carte par article cité, avec ses citations, dans l’ordre de la liste', () => {
    const cartes = cartesDeLaReponse(TEXTE, [citation(0, 3, '35'), citation(21, 24, '37'), citation(39, 42, '35')], [source('35'), source('37')]);

    expect(cartes.map((c) => c.numero)).toEqual(['35', '37']);
    expect(cartes[0].citations.map((c) => c.indexCitation)).toEqual([0, 2]);
    expect(carteDeLaCitation(cartes, 1)).toBe(1);
    expect(carteDeLaCitation(cartes, 9)).toBe(-1);
  });

  it('une citation d’un texte entier, ou absente de la liste, a tout de même sa carte', () => {
    const cartes = cartesDeLaReponse(TEXTE, [citation(0, 3, null, 2), citation(21, 24, null, 2)], [source('35')]);

    expect(cartes).toHaveLength(2);
    expect(cartes[1]).toMatchObject({ lawId: 2, numero: null, titre: 'Texte 2' });
    expect(cartes[1].citations.map((c) => c.indexCitation)).toEqual([0, 1]);
  });

  it('une entrée de la liste sans numéro reçoit les citations sans article du même texte', () => {
    const cartes = cartesDeLaReponse(TEXTE, [citation(0, 3, null)], [source(null)]);

    expect(cartes).toHaveLength(1);
    expect(cartes[0].citations).toHaveLength(1);
  });
});
