import { describe, expect, it } from 'vitest';
import { identifiantDepuis } from './identifiant';

describe('identifiantDepuis', () => {
  it.each([
    ['1', 1],
    ['42', 42],
    ['2147483647', 2147483647],
  ])('accepte %s', (brut, attendu) => {
    expect(identifiantDepuis(brut)).toBe(attendu);
  });

  it.each(['0', '-1', '012', '1e3', '0x10', '1.5', ' 1', '1 ', '', 'abc', '2147483648', '99999999999'])(
    'refuse %j',
    (brut) => {
      expect(identifiantDepuis(brut)).toBeNull();
    },
  );
});
