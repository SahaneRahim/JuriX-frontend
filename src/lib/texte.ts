/**
 * Découpe une réponse du modèle en blocs affichables.
 *
 * POURQUOI. Le prompt système « citoyen » du backend
 * (`app/services/prompts.py`) demande explicitement du markdown : « utilise
 * **titres en gras** », des listes à puces, une structure `**Réponse
 * directe**`. La réponse arrive donc balisée, et il faut bien en faire quelque
 * chose.
 *
 * Trois issues, deux mauvaises :
 *
 * 1. La rendre avec `{@html}` après conversion markdown. Exclu : le dépôt n'a
 *    aucun désinfectant, le jeton d'authentification est en clair dans
 *    `localStorage` (`src/lib/stores/auth.ts`), et ce texte vient d'un modèle
 *    nourri au contenu de documents ingérés. C'est exactement le risque que
 *    `$lib/highlight.ts` a supprimé côté recherche.
 * 2. L'afficher telle quelle. Le lecteur voit alors `**Réponse directe**` en
 *    clair, ce qui est du bruit.
 * 3. La reconnaître ici et la rendre en NŒUDS Svelte — donc échappée par
 *    construction. C'est ce que fait ce module.
 *
 * Le contrat est volontairement étroit : cinq formes, rien d'autre — titre,
 * puce, paragraphe, tableau, bloc de code. Chacune ne porte que du TEXTE : une
 * cellule de tableau est une chaîne, un bloc de code aussi, et l'affichage les
 * pose en nœuds de texte comme le reste. Pas de liens, pas de HTML en ligne :
 * élargir la grammaire à une forme qui porterait du balisage rouvrirait la
 * question de l'échappement.
 *
 * Tableaux et code sont venus après coup, pour le téléphone : un tableau
 * markdown recollé en paragraphe donnait une suite de `|` et de `|---|---|`
 * insécables qui faisait déborder la conversation sur le côté, et un bloc de
 * code affichait ses ``` en clair.
 */

export type TypeDeBloc = 'titre' | 'puce' | 'paragraphe' | 'tableau' | 'code';

export interface Bloc {
  type: TypeDeBloc;
  /**
   * Texte déjà débarrassé de ses marqueurs. Rendu en nœud de texte.
   *
   * Pour un tableau, c'est une version en texte suivi (cellules séparées par
   * « — », lignes par « ; »), et pour un bloc de code, le code lui-même. Les
   * affichages qui ne connaissent pas ces deux formes — l'explication d'article
   * de `/laws/[id]` rend tout type inconnu en paragraphe — montrent donc
   * quelque chose de lisible plutôt que rien.
   */
  texte: string;
  /**
   * Numéro d'une puce de liste numérotée (« 1. », « 2) »), tel qu'écrit.
   *
   * Les profils avocat et étudiant du backend demandent des listes numérotées
   * (`app/services/prompts.py`) : la puce reconnaissait le numéro puis le
   * jetait, et le chat posait « • » à la place — l'ordre des étapes se
   * perdait. Le bloc reste de type `puce`, ce qui laisse intacts les
   * affichages qui ne connaissent pas ce champ (explication d'article).
   */
  numero?: number;
  /**
   * Tableau : intitulés des colonnes, vide quand le tableau n'a pas de ligne
   * d'en-tête. Des chaînes sans emphase, rendues en nœuds de texte.
   */
  entetes?: string[];
  /**
   * Tableau : les lignes, chacune avec exactement autant de cellules que le
   * tableau a de colonnes (les cellules manquantes valent `''`). Un retour à la
   * ligne dans une cellule vient d'un `<br>` écrit par le modèle.
   */
  lignes?: string[][];
}

/** Une ligne entièrement entre `**` ou `__` : un titre de section. */
const TITRE_MARQUE = /^(\*\*|__)(.+?)\1$/;

/** Un titre ATX, `## Comme ceci`, que le modèle produit parfois malgré tout. */
const TITRE_DIESE = /^#{1,6}\s+(.+)$/;

/** Une puce, quel que soit le marqueur choisi par le modèle. */
const PUCE = /^\s*([-*•+]|\d+[.)])\s+(.+)$/;

/**
 * Ligne de séparation : `***`, `---`, `___`, ou un astérisque esseulé.
 *
 * Le modèle en pose entre ses sections. Rendue telle quelle, elle produit un
 * paragraphe ne contenant qu'un caractère de ponctuation — du bruit vu par le
 * lecteur, observé sur une vraie réponse.
 */
const SEPARATEUR = /^[*\-_\s]+$/;

/**
 * Emphase résiduelle à l'intérieur d'une ligne.
 *
 * Sans assertion arrière (« lookbehind ») : Safari ne les lit que depuis la 16.4.
 * Plus ancien, il refusait l'expression au chargement du module, et le chat
 * comme l'explication d'article ne s'affichaient plus du tout sur les iPhone
 * restés en iOS 15. `(.*?\S)` impose la même chose — un dernier caractère
 * qui n'est pas une espace — sans regarder en arrière.
 *
 * Les astérisques comptent partout, même collés à un mot. Les soulignés, eux,
 * ne comptent qu'en bord de mot, comme en CommonMark. Reconnus partout, ils
 * étaient retirés des URL, des noms de fichier et des identifiants :
 * `decret_2018_9387_cab_pm.pdf` devenait `decret20189387cabpm.pdf`, et dans
 * « le champ article_id et le fichier loi_2016_007.pdf », deux soulignés de
 * mots différents s'appariaient. Une série de soulignés n'ouvre donc l'emphase
 * que si rien ne la précède qui tienne au mot — lettre, chiffre, souligné, ou
 * accent décomposé (`\p{M}`, texte de PDF en NFD) — et ne la ferme que si rien
 * de tel ne la suit. Le caractère d'avant ne pouvant pas être regardé en
 * arrière, il est CAPTURÉ (3e groupe), et `sansEmphase` le remet à sa place.
 *
 * Chaque série est prise entière, d'un à trois soulignés (`___texte___` est
 * du gras italique), et le texte qu'elle encadre commence et finit par autre
 * chose qu'une espace ou un souligné. Sans cela, un blanc à remplir — « Je
 * soussigné(e) ____________, » dans un modèle de lettre — passait pour une
 * emphase faite de soulignés, et en perdait une partie.
 */
const EMPHASE =
  /(\*\*|\*)(?=\S)(.*?\S)\1|(^|[^\p{L}\p{N}\p{M}_])(_{1,3})(?=[^\s_])(.*?[^\s_])\4(?![\p{L}\p{N}\p{M}_])/gu;

/**
 * Ligne de délimitation d'un tableau : `|---|:---:|`, `--- | ---`.
 *
 * Elle exige une barre verticale : sans elle, `---` reste une ligne de
 * séparation (voir SEPARATEUR). Ces lignes ne sont jamais montrées : elles ne
 * disent rien au lecteur et, insécables, elles faisaient déborder l'écran.
 */
const DELIMITEUR_DE_TABLEAU = /^(?=.*\|)(?=.*-)[\s|:-]+$/;

/** Ligne de tableau : elle commence par une barre verticale. */
const LIGNE_DE_TABLEAU = /^\|/;

/**
 * Saut de ligne écrit en HTML dans une cellule. Le markdown n'a pas d'autre
 * moyen de couper une cellule, et les modèles l'emploient volontiers : affiché
 * tel quel, `<br>` serait du bruit, du même ordre que les astérisques.
 */
const SAUT_DANS_UNE_CELLULE = /<br\s*\/?>/gi;

/**
 * Ouverture ou fermeture d'un bloc de code : trois accents graves ou trois
 * tildes au moins. Le retrait est toléré quel qu'il soit : le modèle indente
 * volontiers ses blocs sous une puce.
 */
const CLOTURE_DE_CODE = /^(\s*)(`{3,}|~{3,})(.*)$/;

/**
 * Retire l'emphase markdown d'une ligne, sans toucher au reste.
 *
 * Les astérisques isolés — « article 3 * » dans un tableau mal extrait —
 * survivent : seules les paires encadrant du texte sont reconnues. Les
 * soulignés pris dans un mot (`loi_2016_007.pdf`, `article_id`) aussi.
 */
function sansEmphase(ligne: string): string {
  return ligne
    .replace(EMPHASE, (_marque, etoiles, entreEtoiles, avant, _soulignes, entreSoulignes) =>
      // Côté soulignés, `avant` est le caractère capturé devant la série
      // ouvrante : il ne fait pas partie de l'emphase, il reste.
      etoiles ? entreEtoiles : avant + entreSoulignes,
    )
    .trim();
}

/**
 * Les cellules d'une ligne de tableau, sans emphase.
 *
 * Les barres des deux bords sont facultatives en markdown ; `\|` est une barre
 * écrite dans le texte de la cellule, pas un séparateur.
 */
function cellulesDe(ligne: string): string[] {
  let corps = ligne.trim();
  if (corps.startsWith('|')) corps = corps.slice(1);
  if (corps.endsWith('|') && !corps.endsWith('\\|')) corps = corps.slice(0, -1);

  const cellules: string[] = [];
  let courante = '';
  for (let i = 0; i < corps.length; i += 1) {
    if (corps[i] === '\\' && corps[i + 1] === '|') {
      courante += '|';
      i += 1;
    } else if (corps[i] === '|') {
      cellules.push(courante);
      courante = '';
    } else {
      courante += corps[i];
    }
  }
  cellules.push(courante);

  return cellules.map((cellule) =>
    cellule
      .split(SAUT_DANS_UNE_CELLULE)
      .map(sansEmphase)
      .join('\n')
      .trim(),
  );
}

/** Retire au plus `retrait` espaces en tête : celles de la clôture ouvrante. */
function sansRetrait(ligne: string, retrait: number): string {
  let debut = 0;
  while (debut < retrait && ligne[debut] === ' ') debut += 1;
  return ligne.slice(debut);
}

/**
 * Transforme une réponse en blocs.
 *
 * Une ligne vide sépare deux blocs ; à l'intérieur d'un bloc, les retours à la
 * ligne simples sont recollés — le modèle coupe ses phrases à la largeur qui
 * lui plaît, et les respecter produirait des paragraphes hachés.
 *
 * Seul un bloc de code garde ses lignes et ses espaces tels quels : c'est sa
 * raison d'être. Il court jusqu'à sa clôture, ou jusqu'à la fin du texte —
 * pendant le flux, la clôture n'est souvent pas encore arrivée.
 */
export function blocsDeReponse(texte: string): Bloc[] {
  if (!texte || !texte.trim()) return [];

  const blocs: Bloc[] = [];
  let paragraphe: string[] = [];
  let tableau: { entetes: string[]; lignes: string[][]; delimite: boolean } | null = null;
  let code: { marque: string; retrait: number; lignes: string[] } | null = null;

  const viderParagraphe = () => {
    if (paragraphe.length === 0) return;
    const assemble = sansEmphase(paragraphe.join(' ').replace(/\s+/g, ' '));
    if (assemble) blocs.push({ type: 'paragraphe', texte: assemble });
    paragraphe = [];
  };

  const viderTableau = () => {
    if (!tableau) return;
    const { entetes, lignes } = tableau;
    tableau = null;
    // Comme en markdown : l'en-tête fixe le nombre de colonnes, une ligne trop
    // courte est complétée, une ligne trop longue est coupée. Sans en-tête,
    // la ligne la plus longue décide.
    const colonnes = entetes.length || Math.max(0, ...lignes.map((l) => l.length));
    const egaliser = (cellules: string[]) =>
      Array.from({ length: colonnes }, (_, i) => cellules[i] ?? '');
    const rangees = lignes.map(egaliser);
    const enTexte = [entetes, ...rangees]
      .map((cellules) => cellules.filter(Boolean).join(' — '))
      .filter(Boolean)
      .join(' ; ');
    if (!enTexte) return;
    blocs.push({
      type: 'tableau',
      texte: enTexte.replace(/\s*\n\s*/g, ' '),
      entetes: entetes.length ? egaliser(entetes) : [],
      lignes: rangees,
    });
  };

  const viderCode = () => {
    if (!code) return;
    // Les lignes vides du début et les blancs de la fin n'apportent rien ; le
    // retrait de la première ligne, lui, fait partie du code.
    const contenu = code.lignes
      .join('\n')
      .replace(/^(?:[ \t]*\n)+/, '')
      .replace(/\s+$/, '');
    code = null;
    if (contenu) blocs.push({ type: 'code', texte: contenu });
  };

  for (const ligneBrute of texte.split(/\r?\n/)) {
    const cloture = ligneBrute.match(CLOTURE_DE_CODE);

    if (code) {
      // Rien n'est interprété dans un bloc de code, sauf sa clôture : même
      // caractère, au moins aussi longue que l'ouverture, et rien derrière.
      const ferme =
        cloture &&
        cloture[2][0] === code.marque[0] &&
        cloture[2].length >= code.marque.length &&
        !cloture[3].trim();
      if (ferme) viderCode();
      else code.lignes.push(sansRetrait(ligneBrute, code.retrait));
      continue;
    }

    // ```js ouvre un bloc ; ```mot``` sur une seule ligne n'en ouvre pas
    // (du code en ligne, que la grammaire ne traite pas).
    if (cloture && !(cloture[2][0] === '`' && cloture[3].includes('`'))) {
      viderParagraphe();
      viderTableau();
      code = { marque: cloture[2], retrait: cloture[1].length, lignes: [] };
      continue;
    }

    const ligne = ligneBrute.trim();

    if (!ligne) {
      viderParagraphe();
      viderTableau();
      continue;
    }

    if (DELIMITEUR_DE_TABLEAU.test(ligne)) {
      // L'en-tête d'un tableau est la ligne qui PRÉCÈDE son délimiteur. Elle a
      // pu arriver comme une ligne de tableau, ou, sans barre en tête, comme
      // une ligne de paragraphe qui contient une barre.
      if (tableau && !tableau.delimite && !tableau.entetes.length && tableau.lignes.length === 1) {
        tableau.entetes = tableau.lignes[0];
        tableau.lignes = [];
        tableau.delimite = true;
      } else if (!tableau && paragraphe.length && paragraphe[paragraphe.length - 1].includes('|')) {
        const entete = paragraphe.pop() as string;
        viderParagraphe();
        tableau = { entetes: cellulesDe(entete), lignes: [], delimite: true };
      }
      // Ailleurs, un délimiteur isolé est simplement ignoré.
      continue;
    }

    // Une fois le tableau ouvert, ses lignes peuvent omettre la barre de tête.
    if (LIGNE_DE_TABLEAU.test(ligne) || (tableau && ligne.includes('|'))) {
      viderParagraphe();
      const cellules = cellulesDe(ligne);
      // « | » ou « | | » seuls : rien à montrer. Pendant le flux, c'est le
      // début d'une ligne dont la suite n'est pas encore arrivée.
      if (cellules.every((cellule) => !cellule)) continue;
      if (!tableau) tableau = { entetes: [], lignes: [], delimite: false };
      tableau.lignes.push(cellules);
      continue;
    }

    // Une ligne sans barre referme le tableau : le modèle oublie souvent la
    // ligne vide entre son tableau et la phrase qui suit.
    viderTableau();

    if (SEPARATEUR.test(ligne)) {
      viderParagraphe();
      continue;
    }

    const titreDiese = ligne.match(TITRE_DIESE);
    if (titreDiese) {
      viderParagraphe();
      const t = sansEmphase(titreDiese[1]);
      if (t) blocs.push({ type: 'titre', texte: t });
      continue;
    }

    const titreMarque = ligne.match(TITRE_MARQUE);
    if (titreMarque) {
      viderParagraphe();
      const t = sansEmphase(titreMarque[2]);
      if (t) blocs.push({ type: 'titre', texte: t });
      continue;
    }

    const puce = ligne.match(PUCE);
    if (puce) {
      viderParagraphe();
      const t = sansEmphase(puce[2]);
      const chiffres = /^\d+/.exec(puce[1]);
      if (t) {
        blocs.push(
          chiffres
            ? { type: 'puce', texte: t, numero: Number(chiffres[0]) }
            : { type: 'puce', texte: t },
        );
      }
      continue;
    }

    paragraphe.push(ligne);
  }

  viderCode();
  viderTableau();
  viderParagraphe();
  return blocs;
}
