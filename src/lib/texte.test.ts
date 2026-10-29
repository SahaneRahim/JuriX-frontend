import { describe, expect, it } from 'vitest';
import { FERME_GRAS, OUVRE_GRAS, blocsDeReponse, insecablesDuTexte } from './texte';

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

  it('garde les espaces insecables en recollant les lignes', () => {
    // « 2 275 » (U+202F) et « n° 92/007 » (U+00A0) ne doivent pas se couper.
    const blocs = blocsDeReponse('Selon 2\u202F275 textes,\net la loi n°\u00A092/007.');

    expect(blocs).toEqual([{ type: 'paragraphe', texte: 'Selon 2\u202F275 textes, et la loi n°\u00A092/007.' }]);
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

  it('garde le numero des listes numerotees', () => {
    // Les profils avocat et etudiant demandent des listes numerotees : le
    // numero etait reconnu puis jete, et l'ordre des etapes se perdait.
    const blocs = blocsDeReponse('1. Premier\n2) Second\n- Puce');

    expect(blocs).toEqual([
      { type: 'puce', texte: 'Premier', numero: 1 },
      { type: 'puce', texte: 'Second', numero: 2 },
      { type: 'puce', texte: 'Puce' },
    ]);
    expect('numero' in blocs[2]).toBe(false);
  });

  it('assemble une reponse du profil avocat', () => {
    const blocs = blocsDeReponse(
      "**Conditions**\n1. Une infraction prevue par l'article 318 du Code Penal\n2. Un prejudice",
    );

    expect(blocs.map((b) => [b.type, b.numero])).toEqual([
      ['titre', undefined],
      ['puce', 1],
      ['puce', 2],
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

describe('blocsDeReponse : soulignes', () => {
  // Les soulignes ne marquent l'emphase qu'en bord de mot, comme en
  // CommonMark. Reconnus partout, ils etaient retires des URL, des noms de
  // fichier et des identifiants, dans le chat comme dans l'explication
  // d'article.

  it('retire toujours l emphase en bord de mot', () => {
    for (const [entree, attendu] of [
      ['Un *mot*, un **mot**, un _mot_ et un __mot__.', 'Un mot, un mot, un mot et un mot.'],
      ['(_voir plus bas_)', '(voir plus bas)'],
      ["l'_acte_ et l’_acte_", "l'acte et l’acte"],
      ['« _texte_ »', '« texte »'],
      ['_Note_ : texte', 'Note : texte'],
    ]) {
      expect(blocsDeReponse(entree)[0].texte).toBe(attendu);
    }
  });

  it('retire un gras italique fait de trois soulignes', () => {
    // La serie de soulignes est prise entiere : `___` ne laisse plus un
    // `_texte_` derriere lui.
    expect(blocsDeReponse('Un ___gras et italique___ ici.')[0].texte).toBe(
      'Un gras et italique ici.',
    );
  });

  it('garde les soulignes d une URL', () => {
    // Le cas observe : l'adresse du texte consolide perdait tous ses
    // soulignes, retires deux par deux.
    const consolide =
      'https://www.prc.cm/files/7d/decret_2018_9387_cab_pm_modalites_application_version_consolidee.pdf';
    expect(blocsDeReponse(`Texte consolidé : ${consolide}`)[0].texte).toBe(
      `Texte consolidé : ${consolide}`,
    );

    // Un souligne suivi d'une parenthese pouvait fermer une emphase ouverte
    // plus tot dans l'adresse.
    const wiki = 'https://fr.wikipedia.org/wiki/Code_p%C3%A9nal_(Cameroun)';
    expect(blocsDeReponse(wiki)[0].texte).toBe(wiki);
  });

  it('garde les soulignes des identifiants en snake_case', () => {
    const phrase = 'Le champ article_id, la constante MAX_VALUE et snake_case_identifier.';

    expect(blocsDeReponse(phrase)[0].texte).toBe(phrase);
  });

  it('garde les soulignes des noms de fichier', () => {
    // Le cas observe : deux soulignes de mots differents s'appariaient, et
    // « article_id » comme « loi_2016 » perdaient le leur.
    const phrase = 'Le champ article_id et le fichier loi_2016_007.pdf.';
    const liste = 'Fichiers : loi_2016_007.pdf, decret_2018_9387.pdf et arrete_12_x.pdf.';

    expect(blocsDeReponse(phrase)[0].texte).toBe(phrase);
    expect(blocsDeReponse(liste)[0].texte).toBe(liste);
  });

  it('retire l emphase autour d un identifiant sans toucher a ses soulignes', () => {
    const blocs = blocsDeReponse(
      "Selon l'**article 35**, le champ _article_id_ du fichier loi_2016_007.pdf est _obligatoire_.",
    );

    expect(blocs[0].texte).toBe(
      "Selon l'article 35, le champ article_id du fichier loi_2016_007.pdf est obligatoire.",
    );
    expect(blocsDeReponse('Le fichier **loi_2016_007.pdf** fait foi.')[0].texte).toBe(
      'Le fichier loi_2016_007.pdf fait foi.',
    );
  });

  it('garde les soulignes des titres, des puces et des cellules', () => {
    expect(blocsDeReponse('## Fichier loi_2016_007.pdf')[0]).toEqual({
      type: 'titre',
      texte: 'Fichier loi_2016_007.pdf',
    });
    expect(blocsDeReponse('- decret_2018_9387.pdf')[0]).toEqual({
      type: 'puce',
      texte: 'decret_2018_9387.pdf',
    });
    expect(blocsDeReponse('| Fichier |\n|---|\n| loi_2016_007.pdf |')[0].lignes).toEqual([
      ['loi_2016_007.pdf'],
    ]);
  });

  it('garde les blancs a remplir d un modele', () => {
    // Suivi d'une virgule, un blanc passait pour une emphase faite de
    // soulignes, et le modele de lettre en perdait une partie.
    const modele = 'Je soussigné(e) ____________, demeurant à ____________.';

    expect(blocsDeReponse(modele)[0].texte).toBe(modele);
  });

  it('traite un accent decompose comme une lettre', () => {
    // Un texte extrait de PDF peut arriver en NFD : l'accent y est un
    // caractere a part, qui ne doit pas passer pour un bord de mot.
    const nom = 'Fichier : arrêté_2018_.pdf';

    expect(blocsDeReponse(nom)[0].texte).toBe(nom);
  });
});

describe('blocsDeReponse : tableaux', () => {
  it('reconnait un tableau markdown, en-tete compris', () => {
    const blocs = blocsDeReponse(
      [
        'Voici les délais :',
        '| Démarche | Délai |',
        '|---|:---:|',
        '| **Permis** de recherche | 3 ans |',
        '| Renouvellement | 2 fois |',
      ].join('\n'),
    );

    expect(blocs.map((b) => b.type)).toEqual(['paragraphe', 'tableau']);
    expect(blocs[1].entetes).toEqual(['Démarche', 'Délai']);
    // L'emphase est retirée des cellules comme du reste du texte.
    expect(blocs[1].lignes).toEqual([
      ['Permis de recherche', '3 ans'],
      ['Renouvellement', '2 fois'],
    ]);
  });

  it('ne montre jamais une ligne de delimitation', () => {
    // Recollee en paragraphe, `|---|---|` etait un mot insecable qui faisait
    // deborder la conversation sur un telephone.
    for (const delimiteur of ['|---|---|', '| :--- | ---: |', '--- | ---', '|-|']) {
      const blocs = blocsDeReponse(`Avant.\n\n${delimiteur}\n\nApres.`);
      expect(blocs.map((b) => b.texte)).toEqual(['Avant.', 'Apres.']);
    }
  });

  it('accepte un en-tete et des lignes sans barre au bord', () => {
    const blocs = blocsDeReponse('Texte | Article\n--- | ---\nCode pénal | 318');

    expect(blocs).toHaveLength(1);
    expect(blocs[0].type).toBe('tableau');
    expect(blocs[0].entetes).toEqual(['Texte', 'Article']);
    expect(blocs[0].lignes).toEqual([['Code pénal', '318']]);
  });

  it('aligne chaque ligne sur le nombre de colonnes de l en-tete', () => {
    const blocs = blocsDeReponse('| A | B | C |\n|---|---|---|\n| 1 |\n| 1 | 2 | 3 | 4 |');

    expect(blocs[0].lignes).toEqual([
      ['1', '', ''],
      ['1', '2', '3'],
    ]);
  });

  it('garde un tableau sans en-tete', () => {
    const blocs = blocsDeReponse('| Durée | 3 ans |\n| Renouvellement |');

    expect(blocs[0].entetes).toEqual([]);
    expect(blocs[0].lignes).toEqual([
      ['Durée', '3 ans'],
      ['Renouvellement', ''],
    ]);
  });

  it('referme le tableau sur une ligne sans barre', () => {
    // Le modele oublie souvent la ligne vide entre son tableau et la suite.
    const blocs = blocsDeReponse('| A | B |\n|---|---|\n| 1 | 2 |\nEn résumé, deux points.\n- Une puce');

    expect(blocs.map((b) => b.type)).toEqual(['tableau', 'paragraphe', 'puce']);
    expect(blocs[1].texte).toBe('En résumé, deux points.');
  });

  it('lit les sauts de ligne <br> et les barres echappees des cellules', () => {
    const blocs = blocsDeReponse('| Cas | Détail |\n|---|---|\n| A \\| B | ligne 1<br>ligne 2<br/>ligne 3 |');

    expect(blocs[0].lignes).toEqual([['A | B', 'ligne 1\nligne 2\nligne 3']]);
  });

  it('donne un texte suivi aux affichages qui ignorent les tableaux', () => {
    // L'explication d'article de /laws/[id] rend tout type inconnu en
    // paragraphe : elle doit y trouver une phrase lisible, pas des cellules.
    const blocs = blocsDeReponse('| Démarche | Délai |\n|---|---|\n| Permis | 3 ans |\n| Recours | 2 mois<br>au plus |');

    expect(blocs[0].texte).toBe('Démarche — Délai ; Permis — 3 ans ; Recours — 2 mois au plus');
  });

  it('suit un tableau qui arrive morceau par morceau', () => {
    // Pendant le flux, la ligne d'en-tete arrive seule, puis le delimiteur,
    // parfois coupe : jamais de paragraphe de `|` entre les deux.
    expect(blocsDeReponse('| Démarche | Dé')[0]).toMatchObject({
      type: 'tableau',
      lignes: [['Démarche', 'Dé']],
    });
    expect(blocsDeReponse('| Démarche | Délai |\n|--')[0]).toMatchObject({
      type: 'tableau',
      entetes: ['Démarche', 'Délai'],
      lignes: [],
    });
    expect(blocsDeReponse('Avant.\n|')).toEqual([{ type: 'paragraphe', texte: 'Avant.' }]);
  });

  it('rend des cellules de TEXTE, jamais du HTML', () => {
    const hostile = '<img src=x onerror=alert(1)>';
    const blocs = blocsDeReponse(`| Champ |\n|---|\n| ${hostile} |`);

    expect(blocs[0].lignes).toEqual([[hostile]]);
    expect(typeof blocs[0].lignes?.[0][0]).toBe('string');
  });
});

describe('blocsDeReponse : blocs de code', () => {
  it('garde le code tel quel, sans l interpreter', () => {
    const blocs = blocsDeReponse(
      ['Modèle :', '```', '**Objet** : demande', '- pas une puce', '  retrait gardé', '```', 'Fin.'].join('\n'),
    );

    expect(blocs).toEqual([
      { type: 'paragraphe', texte: 'Modèle :' },
      { type: 'code', texte: '**Objet** : demande\n- pas une puce\n  retrait gardé' },
      { type: 'paragraphe', texte: 'Fin.' },
    ]);
  });

  it('ignore l etiquette de langage et accepte les tildes', () => {
    expect(blocsDeReponse('```python\nprint(1)\n```')).toEqual([{ type: 'code', texte: 'print(1)' }]);
    expect(blocsDeReponse('~~~\na | b\n~~~')).toEqual([{ type: 'code', texte: 'a | b' }]);
  });

  it('ne se ferme que sur une cloture du meme type, au moins aussi longue', () => {
    const blocs = blocsDeReponse('````\n```\ndedans\n~~~\n````\nDehors.');

    expect(blocs).toEqual([
      { type: 'code', texte: '```\ndedans\n~~~' },
      { type: 'paragraphe', texte: 'Dehors.' },
    ]);
  });

  it('court jusqu a la fin quand la cloture n est pas encore arrivee', () => {
    // Pendant le flux, le bloc s'affiche deja en code, pas en paragraphe.
    expect(blocsDeReponse('Exemple :\n```\nligne 1\nligne 2')).toEqual([
      { type: 'paragraphe', texte: 'Exemple :' },
      { type: 'code', texte: 'ligne 1\nligne 2' },
    ]);
  });

  it('retire le retrait de la cloture ouvrante, et lui seul', () => {
    const blocs = blocsDeReponse('1. Étape\n   ```\n   alinéa\n     suite\n   ```');

    expect(blocs[1]).toEqual({ type: 'code', texte: 'alinéa\n  suite' });
  });

  it('laisse tomber un bloc vide', () => {
    expect(blocsDeReponse('```\n\n```')).toEqual([]);
  });

  it('ne prend pas du code en ligne pour une ouverture', () => {
    expect(blocsDeReponse('```mot```')[0].type).toBe('paragraphe');
  });
});

describe('blocsDeReponse : le gras dans la ligne (mode `gras`, chat)', () => {
  const G = (texte: string) => `${OUVRE_GRAS}${texte}${FERME_GRAS}`;

  it('garde le gras en marques ; l’italique est retiré comme avant', () => {
    // La forme de l'exemple réel du contrat (§7.3) : le libellé DANS la phrase.
    expect(blocsDeReponse('**Réponse directe** : selon l’article 35, *en principe*.', { gras: true })).toEqual([
      { type: 'paragraphe', texte: `${G('Réponse directe')} : selon l’article 35, en principe.` },
    ]);
    expect(blocsDeReponse('- un __point__ et ***gras italique***', { gras: true })).toEqual([
      { type: 'puce', texte: `un ${G('point')} et ${G('gras italique')}` },
    ]);
    expect(blocsDeReponse('| Délai | **3 mois** |', { gras: true })[0].lignes).toEqual([['Délai', G('3 mois')]]);
  });

  it('une ligne en gras tout entière reste un titre, sans marque', () => {
    expect(blocsDeReponse('**Réponse directe**', { gras: true })).toEqual([{ type: 'titre', texte: 'Réponse directe' }]);
  });

  it('sans le mode, rien ne change : l’explication d’article reçoit du texte sans marque', () => {
    expect(blocsDeReponse('**Réponse directe** : oui.')).toEqual([{ type: 'paragraphe', texte: 'Réponse directe : oui.' }]);
  });

  it('une ligne qui commence et finit par un gras sans en être un seul n’est pas un titre', () => {
    // Pris pour un titre, « **A** : **B** » laissait « A* : *B ».
    expect(blocsDeReponse('**Réponse directe** : oui, **sous conditions**')).toEqual([
      { type: 'paragraphe', texte: 'Réponse directe : oui, sous conditions' },
    ]);
    expect(blocsDeReponse('**Réponse directe** : oui, **sous conditions**', { gras: true })).toEqual([
      { type: 'paragraphe', texte: `${G('Réponse directe')} : oui, ${G('sous conditions')}` },
    ]);
  });
});

describe('insecablesDuTexte', () => {
  it('lie « n° » et « art. » au numéro qui suit, sans rien changer d’autre', () => {
    expect(insecablesDuTexte('la loi n° 92/007 et l’art. 35, N° 2016/007')).toBe(
      'la loi n°\u00A092/007 et l’art.\u00A035, N°\u00A02016/007',
    );
    // Même longueur : les marques des citations restent à leur place.
    const texte = 'selon la loi n° 92/007';
    expect(insecablesDuTexte(texte)).toHaveLength(texte.length);
    // Ni « Part. », ni un « n° » collé, ni la fin d'une phrase.
    expect(insecablesDuTexte('Part. 3, n°92 et le n° ')).toBe('Part. 3, n°92 et le n° ');
  });

  it('lie « article » à son numéro, la forme qu’impose le prompt (« l’article X du Code Y »)', () => {
    // « et l’article » finissait une ligne à 390 px, « 312 du Code pénal » ouvrait la suivante.
    expect(insecablesDuTexte('et l’article 312 du Code pénal')).toBe('et l’article\u00A0312 du Code pénal');
    expect(insecablesDuTexte("L'article 1er et les articles 35 et 36")).toBe("L'article\u00A01er et les articles\u00A035 et 36");
    expect(insecablesDuTexte('Article premier, article première')).toBe('Article\u00A0premier, article\u00A0première');
    // Dans une cellule de tableau, après une cote (capture chat 768 px).
    expect(insecablesDuTexte('Décret N°2018/9387/CAB/PM, article 3')).toBe('Décret N°2018/9387/CAB/PM, article\u00A03');
    const texte = 'selon l’article 35 de la loi n° 92/007';
    expect(insecablesDuTexte(texte)).toHaveLength(texte.length);
  });

  it('« article » suivi d’un mot, dans un autre mot ou en fin de ligne reste sécable', () => {
    for (const texte of ['l’article cité', 'l’article premièrement visé', 'une particle 5', 'l’article\n35']) {
      expect(insecablesDuTexte(texte)).toBe(texte);
    }
  });

  it('une citation marquée garde ses marques autour du numéro lié', () => {
    // Ouverture, indice, puis le passage cité : la marque n'empêche pas le lien.
    expect(insecablesDuTexte('l’\uE001\uE100article 312 du Code pénal\uE002')).toBe(
      'l’\uE001\uE100article\u00A0312 du Code pénal\uE002',
    );
  });
});

describe('texte.ts', () => {
  it('n utilise aucune assertion arriere', () => {
    // Safari ne les lit que depuis la 16.4 : plus ancien, il refusait
    // l'expression au chargement du module, et le chat comme l'explication
    // d'article cessaient de s'afficher sur les iPhone restes en iOS 15.
    const sources = import.meta.glob('./texte.ts', { query: '?raw', import: 'default', eager: true });
    const source = Object.values(sources)[0] as string;

    expect(source).toBeTruthy();
    expect(source).not.toMatch(/\(\?<[=!]/);
  });
});
