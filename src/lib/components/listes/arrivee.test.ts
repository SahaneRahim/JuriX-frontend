import { describe, expect, it } from 'vitest';
import { DELAI_MAX_MS, delaiDeLaLigne, delaiDuSoulignement, delaiDuTampon } from './arrivee';

/**
 * Les délais de l'arrivée des lignes de résultats (refonte A, E4a) : décalage
 * de 80 ms plafonné au cinquième rang (décision R9), et jamais plus d'une
 * seconde (décision D9).
 */

describe('arrivée des lignes de résultats', () => {
  it('min(rang, 5) × 80 ms : la sixième ligne et les suivantes partent ensemble', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 19].map(delaiDeLaLigne)).toEqual([0, 80, 160, 240, 320, 400, 400, 400]);
  });

  it('un rang illisible compte comme le premier', () => {
    expect(delaiDeLaLigne(-3)).toBe(0);
    expect(delaiDeLaLigne(Number.NaN)).toBe(0);
    expect(delaiDeLaLigne(2.7)).toBe(160);
  });

  it('les mots se soulignent quand la ligne est arrivée, un mot après l’autre (0,6 s puis 0,8 s, comme la maquette)', () => {
    expect(delaiDuSoulignement(0, 0)).toBe(600);
    expect(delaiDuSoulignement(0, 1)).toBe(800);
    expect(delaiDuSoulignement(1, 0)).toBe(680);
  });

  it('aucun délai ne dépasse une seconde (D9)', () => {
    for (let rang = 0; rang < 25; rang++) {
      for (let mot = 0; mot < 10; mot++) expect(delaiDuSoulignement(rang, mot)).toBeLessThanOrEqual(DELAI_MAX_MS);
      expect(delaiDuTampon(rang)).toBeLessThanOrEqual(DELAI_MAX_MS);
      expect(delaiDeLaLigne(rang)).toBeLessThanOrEqual(DELAI_MAX_MS);
    }
    expect(delaiDuSoulignement(5, 3)).toBe(DELAI_MAX_MS);
  });

  it('le statut se pose quand sa ligne est presque arrivée', () => {
    expect(delaiDuTampon(0)).toBe(450);
    expect(delaiDuTampon(5)).toBe(850);
    expect(delaiDuTampon(0)).toBeGreaterThan(delaiDeLaLigne(0));
  });
});
