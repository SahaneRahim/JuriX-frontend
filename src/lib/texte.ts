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
 * Le contrat est volontairement étroit : trois formes, rien d'autre. Pas de
 * tableaux, pas de liens, pas de code. Élargir la grammaire rouvrirait la
 * question de l'échappement.
 */

export type TypeDeBloc = 'titre' | 'puce' | 'paragraphe';

export interface Bloc {
  type: TypeDeBloc;
  /** Texte déjà débarrassé de ses marqueurs. Rendu en nœud de texte. */
  texte: string;
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

/** Emphase résiduelle à l'intérieur d'une ligne. */
const EMPHASE = /(\*\*|__|\*|_)(?=\S)(.+?)(?<=\S)\1/g;

/**
 * Retire l'emphase markdown d'une ligne, sans toucher au reste.
 *
 * Les astérisques isolés — « article 3 * » dans un tableau mal extrait —
 * survivent : seules les paires encadrant du texte sont reconnues.
 */
function sansEmphase(ligne: string): string {
  return ligne.replace(EMPHASE, '$2').trim();
}

/**
 * Transforme une réponse en blocs.
 *
 * Une ligne vide sépare deux blocs ; à l'intérieur d'un bloc, les retours à la
 * ligne simples sont recollés — le modèle coupe ses phrases à la largeur qui
 * lui plaît, et les respecter produirait des paragraphes hachés.
 */
export function blocsDeReponse(texte: string): Bloc[] {
  if (!texte || !texte.trim()) return [];

  const blocs: Bloc[] = [];
  let paragraphe: string[] = [];

  const viderParagraphe = () => {
    if (paragraphe.length === 0) return;
    const assemble = sansEmphase(paragraphe.join(' ').replace(/\s+/g, ' '));
    if (assemble) blocs.push({ type: 'paragraphe', texte: assemble });
    paragraphe = [];
  };

  for (const ligneBrute of texte.split('\n')) {
    const ligne = ligneBrute.trim();

    if (!ligne) {
      viderParagraphe();
      continue;
    }

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
      if (t) blocs.push({ type: 'puce', texte: t });
      continue;
    }

    paragraphe.push(ligne);
  }

  viderParagraphe();
  return blocs;
}
