import { describe, expect, it } from 'vitest';
import { normaliserNumeroArticle } from './article';

describe('normaliserNumeroArticle', () => {
  it.each([
    ['Article 1er', '1'],
    ['1ère', '1'],
    ['ART. 12 bis', '12 BIS'],
    ['Section 3', '3'],
    ['  45.  ', '45'],
    ['7 :', '7'],
    [12, '12'],
  ])('%j donne %j', (valeur, attendu) => {
    expect(normaliserNumeroArticle(valeur)).toBe(attendu);
  });

  it('rend une chaîne vide pour une valeur absente', () => {
    expect(normaliserNumeroArticle(null)).toBe('');
    expect(normaliserNumeroArticle(undefined)).toBe('');
  });

  it("reste instantanée sur une adresse piégée (?article= de 16 Ko)", () => {
    // Sans la borne, la dernière expression parcourt la suite de séparateurs
    // depuis chacune de ses positions : environ 10^8 pas pour 16 Ko, sur le
    // fil unique du serveur Node.
    const piege = `${'-'.repeat(16_000)}x`;
    const debut = performance.now();
    normaliserNumeroArticle(piege);
    expect(performance.now() - debut).toBeLessThan(50);
  });
});
