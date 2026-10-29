import { describe, expect, it } from 'vitest';
import { normaliserNumeroArticle, numeroAAfficher } from './article';

describe('numeroAAfficher', () => {
  it.each([
    ['36', '36'],
    ['9999', '9999'],
    ['1er', '1'],
    ['12 bis', '12 bis'],
    ['12BIS', '12 bis'],
    ['55.2', '55.2'],
    ['Article 7', '7'],
  ])('%j s’écrit %j', (valeur, attendu) => {
    expect(numeroAAfficher(valeur)).toBe(attendu);
  });

  it.each([
    // Un lien que n'importe qui peut écrire : jamais recopié dans la page.
    'abrogé, voir wa.me/2376XXXXXXXX',
    '$&',
    "$'",
    '36 $&',
    // Les pseudo-numéros de l'ingestion, que le chat peut citer.
    'DISPOSITIF',
    'SECTION_2',
    '',
  ])('%j ne s’écrit pas', (valeur) => {
    expect(numeroAAfficher(valeur)).toBeNull();
  });

  it('rend `null` pour une valeur absente', () => {
    expect(numeroAAfficher(null)).toBeNull();
    expect(numeroAAfficher(undefined)).toBeNull();
  });
});

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
