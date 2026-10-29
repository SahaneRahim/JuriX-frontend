import { describe, expect, it } from 'vitest';
import type { LigneDeTexte } from '$lib/types';
import {
  adresseDuLot,
  etatARestaurer,
  ligneAffichee,
  LOT_MAX,
  lotDepuis,
  type EtatDeLaListe,
  type LigneAffichee,
} from './lots';

/**
 * Les lots de 20 des listes de textes (P11) : le numéro lu dans `?page=`,
 * l'adresse de chaque lot, et la ligne qui part vers le navigateur.
 */

describe('lotDepuis', () => {
  it('lit un entier en forme canonique, à partir de 1', () => {
    expect(lotDepuis('2')).toBe(2);
    expect(lotDepuis('64')).toBe(64);
  });

  it('tout le reste vaut le premier lot : une seule adresse par lot (ISR)', () => {
    for (const brut of [null, undefined, '', '0', '-1', '02', '1e21', '2.5', 'abc', ' 2']) {
      expect(lotDepuis(brut)).toBe(1);
    }
  });

  it('borné au plafond de la nouvelle API, qui garde `skip` dans un entier 32 bits', () => {
    expect(lotDepuis('99999999')).toBe(LOT_MAX);
    expect((LOT_MAX - 1) * 20).toBeLessThanOrEqual(2_147_483_647);
  });
});

describe('adresseDuLot', () => {
  it('le premier lot sans `page`, les suivants avec', () => {
    expect(adresseDuLot('/laws', {}, 1)).toBe('/laws');
    expect(adresseDuLot('/laws', {}, 2)).toBe('/laws?page=2');
    expect(adresseDuLot('/laws', { lang: 'fr', category: '13' }, 3)).toBe('/laws?lang=fr&category=13&page=3');
    expect(adresseDuLot('/categories/13', { lang: 'en' }, 1)).toBe('/categories/13?lang=en');
  });
});

describe('ligneAffichee', () => {
  const ancienne: LigneDeTexte = {
    id: 285,
    title: "Décret N°2018/763 du 10 décembre 2018 portant révocation d'un Magistrat.",
    type: 'décret',
    language: 'fr',
    category_id: 13,
    category_name: 'Fonction Publique',
    publication_date: '2018-12-10',
    article_count: 4,
  };

  it('ne garde que ce que la ligne affiche', () => {
    expect(ligneAffichee(ancienne)).toEqual({
      id: 285,
      title: ancienne.title,
      type: 'décret',
      publication_date: '2018-12-10',
      article_count: 4,
    });
  });

  it('recopie les repères de la nouvelle API, nuls compris, et eux seuls', () => {
    const nouvelle: LigneDeTexte = { ...ancienne, objet: "Révocation d'un Magistrat", numero: '2018/763', date_signature: '2018-12-10', annee: 2018, date_publication_jo: null, statut: null };
    const ligne = ligneAffichee(nouvelle);
    expect(ligne).toMatchObject({ objet: "Révocation d'un Magistrat", numero: '2018/763', annee: 2018 });
    // Une clé nulle est une information (« pas de date sûre ») : elle reste.
    expect('date_publication_jo' in ligne).toBe(true);
    expect('statut' in ligne).toBe(true);
    // L'ancienne API n'en a aucune : rien n'est inventé.
    expect('date_signature' in ligneAffichee(ancienne)).toBe(false);
  });
});

describe('etatARestaurer', () => {
  const ligne = (id: number): LigneAffichee => ({
    id,
    title: `Décret ${id}`,
    type: 'décret',
    publication_date: null,
    article_count: 1,
  });
  /** Trois lots de /laws, quittés à la ligne 50 : ce que garde le `snapshot`. */
  const GARDE: EtatDeLaListe = {
    cle: '/laws',
    premierePage: 1,
    dernierePage: 3,
    lignes: Array.from({ length: 60 }, (_, i) => ligne(i + 1)),
    x: 0,
    y: 2400,
  };

  it('reprend la liste quittée, telle qu’elle revient du sessionStorage', () => {
    expect(etatARestaurer(JSON.parse(JSON.stringify(GARDE)), '/laws', 3)).toEqual(GARDE);
  });

  it('une autre liste, ou un autre lot de la même : rien', () => {
    expect(etatARestaurer(GARDE, '/laws?lang=fr', 3)).toBeNull();
    expect(etatARestaurer(GARDE, '/laws', 2)).toBeNull();
  });

  it('un seul lot : rien à reprendre, la page rouverte le montre déjà', () => {
    expect(etatARestaurer({ ...GARDE, premierePage: 3 }, '/laws', 3)).toBeNull();
  });

  it('une forme inattendue (version précédente du site) : rien, plutôt qu’une page cassée', () => {
    for (const etat of [
      null,
      'liste',
      { ...GARDE, lignes: 'x' },
      { ...GARDE, lignes: [] },
      { ...GARDE, lignes: [{ id: '1', title: 'x' }] },
      { ...GARDE, premierePage: 0 },
      { ...GARDE, y: -1 },
      { ...GARDE, x: Number.NaN },
    ]) {
      expect(etatARestaurer(etat, '/laws', 3)).toBeNull();
    }
  });

  it('une ligne en double est retirée : deux clés égales font tomber un {#each}', () => {
    const repris = etatARestaurer({ ...GARDE, lignes: [ligne(1), ligne(2), ligne(1)] }, '/laws', 3);
    expect(repris?.lignes.map((l) => l.id)).toEqual([1, 2]);
  });
});
