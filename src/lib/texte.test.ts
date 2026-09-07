import { describe, expect, it } from 'vitest';
import { blocsDeReponse } from './texte';

describe('blocsDeReponse', () => {
  it('rend une liste vide sur une entree absente', () => {
    for (const vide of [null, undefined, '', '   ', '\n\n\n']) {
      // @ts-expect-error on verifie justement les entrees non conformes
      expect(blocsDeReponse(vide)).toEqual([]);
    }
  });

  it('separe les paragraphes sur les lignes vides', () => {
    const blocs = blocsDeReponse('Premier paragraphe.\n\nSecond paragraphe.');

    expect(blocs).toEqual([
      { type: 'paragraphe', texte: 'Premier paragraphe.' },
      { type: 'paragraphe', texte: 'Second paragraphe.' }
    ]);
  });

  it('recolle les retours a la ligne simples', () => {
    // Le modele coupe ses phrases a la largeur qui lui plait. Respecter ces
    // coupures produirait des paragraphes haches, sans rapport avec le sens.
    const blocs = blocsDeReponse('Une phrase coupee\nen deux lignes.');

    expect(blocs).toEqual([{ type: 'paragraphe', texte: 'Une phrase coupee en deux lignes.' }]);
  });

  it('reconnait un titre entre doubles asterisques', () => {
    const blocs = blocsDeReponse('**Réponse directe**\n\nLe texte.');

    expect(blocs[0]).toEqual({ type: 'titre', texte: 'Réponse directe' });
    expect(blocs[1].type).toBe('paragraphe');
  });

  it('reconnait un titre souligne et un titre a dieses', () => {
    expect(blocsDeReponse('__En termes simples__')[0].type).toBe('titre');
    expect(blocsDeReponse('## Source légale')[0]).toEqual({
      type: 'titre',
      texte: 'Source légale'
    });
  });

  it('reconnait les puces, quel que soit le marqueur', () => {
    const blocs = blocsDeReponse('- Premier point\n* Deuxième point\n• Troisième\n1. Quatrième');

    expect(blocs.map((b) => b.type)).toEqual(['puce', 'puce', 'puce', 'puce']);
    expect(blocs.map((b) => b.texte)).toEqual([
      'Premier point',
      'Deuxième point',
      'Troisième',
      'Quatrième'
    ]);
  });

  it('retire l emphase a l interieur d une ligne', () => {
    const blocs = blocsDeReponse("Selon l'**article 35**, toute _transaction_ est soumise.");

    expect(blocs[0].texte).toBe("Selon l'article 35, toute transaction est soumise.");
  });

  it('laisse un asterisque isole tranquille', () => {
    // Les documents ingeres en contiennent : seules les PAIRES encadrant du
    // texte sont de l'emphase.
    expect(blocsDeReponse('Barème * applicable')[0].texte).toBe('Barème * applicable');
  });

  it('laisse tomber les lignes de separation', () => {
    // Observe sur une vraie reponse : le modele pose un `*` esseule entre deux
    // sections, qui devenait un paragraphe ne contenant qu'un caractere.
    const blocs = blocsDeReponse('Premier.\n\n*\n\nSecond.\n\n---\n\nTroisieme.');

    expect(blocs.map((b) => b.texte)).toEqual(['Premier.', 'Second.', 'Troisieme.']);
  });

  it('rend du TEXTE, jamais du HTML', () => {
    // L'assertion de surete. Ces blocs sont rendus en noeuds Svelte : si une
    // balise ressortait telle quelle ET etait injectee par `{@html}`, elle
    // s'executerait. Ici elle reste une chaine, et Svelte l'echappe.
    const hostile = '<script>alert(document.cookie)</script>';
    const blocs = blocsDeReponse(`Voici ${hostile} dans le texte.`);

    expect(blocs).toHaveLength(1);
    expect(typeof blocs[0].texte).toBe('string');
    expect(blocs[0].texte).toBe(`Voici ${hostile} dans le texte.`);
  });

  it('assemble une reponse complete du persona citoyen', () => {
    const reponse = [
      '**Réponse directe**',
      '',
      "Cet article soumet toute transaction sur les substances radioactives à l'autorisation",
      "préalable de l'État.",
      '',
      '**Ce que ça change pour vous**',
      '',
      '- Vous devez obtenir une autorisation avant toute vente.',
      "- L'absence d'autorisation rend l'acte illégal."
    ].join('\n');

    expect(blocsDeReponse(reponse).map((b) => b.type)).toEqual([
      'titre',
      'paragraphe',
      'titre',
      'puce',
      'puce'
    ]);
  });
});
