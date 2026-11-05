import { describe, expect, it } from 'vitest';
import { lirePassages, segmenter, type Passage, type Segment } from './surlignage';

/**
 * Les passages surlignés de la page de lecture (refonte A, décision L2).
 * Ce qui compte : le texte de la loi n'est jamais réécrit (les segments
 * remis bout à bout rendent le paragraphe à l'identique), un passage absent
 * ne marque rien, et rien n'est jamais interprété comme du HTML.
 */

const ARTICLE_37 =
  '(1) En cas de rupture de contrat à durée indéterminée du fait de l’employeur, hormis le cas de faute lourde, le travailleur ayant accompli dans l’entreprise une durée de service continue au moins égale à deux (2) ans, a droit à une indemnité de licenciement distincte de celle du préavis.';

const cle = (texte: string): Passage => ({ texte, role: 'cle' });
const sous = (texte: string): Passage => ({ texte, role: 'sous' });

/** Les morceaux marqués, avec leur rôle. */
const marques = (segments: Segment[]) =>
  segments.filter((s) => s.passage).map((s) => [s.passage?.role, s.texte] as const);

/** Le paragraphe recomposé : il doit être celui d'origine, à l'octet près. */
const recompose = (segments: Segment[]) => segments.map((s) => s.texte).join('');

describe('segmenter', () => {
  it('sans passage : un seul segment, le paragraphe tel quel', () => {
    expect(segmenter(ARTICLE_37, [])).toEqual([{ texte: ARTICLE_37, passage: null }]);
    expect(segmenter('', [cle('rien')])).toEqual([]);
  });

  it('un passage : trois segments, le passage marqué au milieu', () => {
    const segments = segmenter(ARTICLE_37, [cle('hormis le cas de faute lourde')]);
    expect(marques(segments)).toEqual([['cle', 'hormis le cas de faute lourde']]);
    expect(segments).toHaveLength(3);
    expect(recompose(segments)).toBe(ARTICLE_37);
  });

  it('deux passages, dans l’ordre du texte quel que soit l’ordre donné', () => {
    const segments = segmenter(ARTICLE_37, [
      cle('a droit à une indemnité de licenciement'),
      sous('hormis le cas de faute lourde'),
    ]);
    expect(marques(segments)).toEqual([
      ['sous', 'hormis le cas de faute lourde'],
      ['cle', 'a droit à une indemnité de licenciement'],
    ]);
    expect(recompose(segments)).toBe(ARTICLE_37);
  });

  it('un passage absent ne marque rien', () => {
    const segments = segmenter(ARTICLE_37, [cle('ce passage n’existe pas dans l’article')]);
    expect(segments).toEqual([{ texte: ARTICLE_37, passage: null }]);
  });

  it('retrouve un passage à cheval sur une espace insécable, sans la réécrire', () => {
    const paragraphe = 'Le délai court à compter du 1er janvier ; il expire le 31 décembre.';
    const segments = segmenter(paragraphe, [cle('1er janvier')]);
    // L'espace insécable du texte reste dans le segment marqué.
    expect(marques(segments)).toEqual([['cle', '1er janvier']]);
    expect(recompose(segments)).toBe(paragraphe);
  });

  it('ignore la casse, les accents, l’apostrophe et les blancs en double', () => {
    const segments = segmenter(ARTICLE_37, [cle("  DU FAIT DE L'EMPLOYEUR,   HORMIS  ")]);
    expect(marques(segments)).toEqual([['cle', 'du fait de l’employeur, hormis']]);
    expect(recompose(segments)).toBe(ARTICLE_37);
  });

  it('un caractère spécial reste du texte : aucune balise n’est créée', () => {
    const paragraphe = 'Voir <script>alert(1)</script> et l’article $& 12.';
    const segments = segmenter(paragraphe, [cle('<script>alert(1)</script>'), sous('$& 12')]);
    expect(marques(segments)).toEqual([
      ['cle', '<script>alert(1)</script>'],
      ['sous', '$& 12'],
    ]);
    expect(recompose(segments)).toBe(paragraphe);
    // Des chaînes, jamais des nœuds : le rendu Svelte les échappe.
    for (const segment of segments) expect(typeof segment.texte).toBe('string');
  });

  it('passages qui se chevauchent : la clé l’emporte et contient le sous-passage', () => {
    const segments = segmenter(ARTICLE_37, [
      sous('faute lourde'),
      cle('hormis le cas de faute lourde, le travailleur'),
    ]);
    expect(marques(segments)).toEqual([['cle', 'hormis le cas de faute lourde, le travailleur']]);
    expect(recompose(segments)).toBe(ARTICLE_37);
  });

  it('un sous-passage qui dépasse de la clé n’en garde que le reste', () => {
    const segments = segmenter(ARTICLE_37, [cle('faute lourde'), sous('hormis le cas de faute lourde')]);
    expect(marques(segments)).toEqual([
      ['sous', 'hormis le cas de '],
      ['cle', 'faute lourde'],
    ]);
    expect(recompose(segments)).toBe(ARTICLE_37);
  });

  it('un passage répété n’est marqué qu’à sa première occurrence', () => {
    const paragraphe = 'Le Maire signe. Le Maire publie.';
    expect(marques(segmenter(paragraphe, [cle('Le Maire')]))).toEqual([['cle', 'Le Maire']]);
    expect(segmenter(paragraphe, [cle('Le Maire')])[0]).toEqual({ texte: 'Le Maire', passage: cle('Le Maire') });
  });
});

describe('lirePassages', () => {
  it('lit une liste `{ texte, role }`, et rien d’autre', () => {
    expect(lirePassages(undefined)).toEqual([]);
    expect(lirePassages('du texte')).toEqual([]);
    expect(
      lirePassages([{ texte: 'a droit', role: 'cle' }, { texte: 'hormis', role: 'sous' }, { texte: 'sans rôle' }]),
    ).toEqual([cle('a droit'), sous('hormis'), cle('sans rôle')]);
    expect(lirePassages([null, 3, { texte: '' }, { texte: 12 }, { role: 'cle' }])).toEqual([]);
  });
});
