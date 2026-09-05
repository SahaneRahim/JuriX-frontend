import { describe, expect, it } from 'vitest';
import { nombreDePages, pagesVisibles, trancheDePage } from './pagination';

describe('nombreDePages', () => {
  it('ne descend jamais sous 1', () => {
    // Le defaut d'origine : /admin/documents calculait 0 sur une liste vide,
    // ce qui rendait `disabled={page === totalPages}` faux et activait
    // « Suivant » sur une liste sans page suivante.
    expect(nombreDePages(0, 15)).toBe(1);
    expect(nombreDePages(-5, 15)).toBe(1);
  });

  it('arrondit au-dessus', () => {
    expect(nombreDePages(31, 15)).toBe(3);
    expect(nombreDePages(30, 15)).toBe(2);
  });

  it('resiste a une taille absurde plutot que de diviser par zero', () => {
    expect(nombreDePages(100, 0)).toBe(1);
  });
});

describe('pagesVisibles', () => {
  it('centre la fenetre sur la page courante', () => {
    expect(pagesVisibles(10, 20)).toEqual([8, 9, 10, 11, 12]);
  });

  it('colle au debut sans sortir de la plage', () => {
    expect(pagesVisibles(1, 20)).toEqual([1, 2, 3, 4, 5]);
    expect(pagesVisibles(2, 20)).toEqual([1, 2, 3, 4, 5]);
  });

  it('colle a la fin sans sortir de la plage', () => {
    expect(pagesVisibles(20, 20)).toEqual([16, 17, 18, 19, 20]);
  });

  it('n’invente pas de pages quand il y en a moins que la fenetre', () => {
    expect(pagesVisibles(2, 3)).toEqual([1, 2, 3]);
    expect(pagesVisibles(1, 1)).toEqual([1]);
  });
});

describe('trancheDePage', () => {
  const items = Array.from({ length: 33 }, (_, i) => i + 1);

  it('rend la bonne tranche', () => {
    expect(trancheDePage(items, 1, 15)).toHaveLength(15);
    expect(trancheDePage(items, 1, 15)[0]).toBe(1);
    expect(trancheDePage(items, 3, 15)).toEqual([31, 32, 33]);
  });

  it('rend un tableau vide au-dela de la derniere page', () => {
    expect(trancheDePage(items, 99, 15)).toEqual([]);
  });
});
