/**
 * Un passage par citation (refonte A, décision C10 de docs/refonte/PASSATION.md) :
 * la logique, sans écran. Le panneau des articles cités (PanneauDesPreuves,
 * CarteArticleCite) s'en sert pour souligner, dans la carte d'un article, le
 * passage qui soutient LA phrase de la citation touchée, et non plus un
 * passage fusionné de toutes les phrases qui citent l'article.
 *
 * AVANT, UN PASSAGE PAR ARTICLE. L'ancien aperçu fusionnait les phrases de
 * toutes les citations d'un article : deux phrases qui citent l'article 37
 * pour deux raisons (l'indemnité, puis la faute lourde) n'en donnaient qu'un,
 * qui ne soutenait ni l'une ni l'autre tout à fait. Ici, chaque citation a le sien,
 * calculé côté navigateur, sans rien demander à l'API (cartes/assistant-preuves.md
 * § 4.4) ; une carte en garde plusieurs, un seul actif à la fois.
 *
 * POURQUOI SANS TOUCHER `passageLePlusProche`. Sa prudence est testée une à
 * une (citations.test.ts) : `null` plutôt qu'un passage douteux, car un
 * soulignement mal placé ferait dire à l'article ce que la réponse avance. Ce
 * module l'appelle une fois par citation, avec la seule phrase de celle-ci,
 * et n'ajoute aucune règle de choix. Une citation sans passage (phrase trop
 * courte, trop peu de mots repris) reste sans passage : sa carte s'ouvrira
 * sans soulignement et sans légende (C10).
 *
 * POURQUOI LES PARAGRAPHES DE `paragraphesDeLArticle`. Le découpage de
 * l'article (lignes, alinéas que la base a collés sur une même ligne) est
 * celui de l'aperçu, testé avec lui : il est relu ici, puis chaque paragraphe
 * est recoupé aux bornes des passages, au lieu d'en écrire une seconde copie.
 *
 * Fonctions pures, sans store ni traduction : passages.test.ts.
 */

import type { CitationPositionnee, SourceCitee, StatutProuve } from '$lib/types';
import { paragraphesDeLArticle, passageLePlusProche, phraseAutour, type Passage } from './citations';

/** Une citation d'un article, réduite à ce qu'il faut pour trouver son passage. */
export interface CitationDeLArticle {
  /** L'indice de la citation dans la réponse (`TexteMarque.citations`, `citationActive`). */
  indexCitation: number;
  /** La phrase de la réponse qui la porte, SANS la citation (`phraseAutour`). */
  phrase: string;
}

/** Ce qui désigne un article cité : son texte, son numéro, le morceau lu. */
export type ArticleCite = Pick<SourceCitee, 'law_id' | 'article_id' | 'article_number'>;

/**
 * La citation désigne-t-elle cet article ? La règle de la page du chat
 * (`ouvrirLArticleCite`) : même texte, et même morceau lu, ou à défaut même
 * numéro d'article. Une citation d'un texte entier (sans numéro) ne désigne
 * aucun article.
 */
function designe(citation: CitationPositionnee, article: ArticleCite): boolean {
  if (citation.law_id !== article.law_id) return false;
  if (article.article_id != null && citation.article_id === article.article_id) return true;
  return article.article_number != null && citation.article === article.article_number;
}

/**
 * Les citations de la réponse qui désignent l'article, chacune avec sa
 * phrase, dans l'ordre de `citations` (celui des indices de marque).
 * `texte` : le texte BRUT de la réponse, celui sur lequel portent les bornes.
 */
export function citationsDeLArticle(
  texte: string,
  citations: readonly CitationPositionnee[],
  article: ArticleCite,
): CitationDeLArticle[] {
  const trouvees: CitationDeLArticle[] = [];
  citations.forEach((citation, indexCitation) => {
    if (designe(citation, article)) {
      trouvees.push({ indexCitation, phrase: phraseAutour(texte, citation.debut, citation.fin) });
    }
  });
  return trouvees;
}

/**
 * L'article cité (son rang dans `articles_cites`) qu'une citation désigne, ou
 * -1 : une citation d'un texte entier, ou d'un article absent de la liste. La
 * carte que la puce ouvrira.
 */
export function articleDeLaCitation(citation: CitationPositionnee, articles: readonly ArticleCite[]): number {
  return articles.findIndex((article) => designe(citation, article));
}

/** Une carte du panneau : un article (ou un texte) cité, et les citations qui le désignent. */
export interface CarteDeLaReponse {
  lawId: number;
  /** Numéro de l'article ; `null` : un texte cité sans article (pas d'aperçu à lire). */
  numero: string | null;
  /** Le morceau lu par le modèle : choisit l'article parmi les homonymes. */
  articleId: number | null;
  titre: string;
  reference: string;
  statut: StatutProuve | null;
  citations: CitationDeLArticle[];
}

/**
 * Les cartes d'une réponse : `articles_cites`, dans leur ordre, puis une carte
 * pour toute citation restée sans article de la liste.
 *
 * POURQUOI CE COMPLÉMENT. Une citation d'un texte entier (« Voir aussi la loi
 * n° 92/007 ») ne désigne aucun article (`designe`), mais sa puce ouvrait son
 * aperçu : sans carte, elle ne mènerait plus nulle part. La carte en question
 * se forme avec les champs de la citation, sans rien inventer. Une entrée
 * sans numéro de `articles_cites` reçoit les citations sans article du même
 * texte.
 */
export function cartesDeLaReponse(
  texte: string,
  citations: readonly CitationPositionnee[],
  articles: readonly SourceCitee[],
): CarteDeLaReponse[] {
  const cartes: CarteDeLaReponse[] = articles.map((article) => ({
    lawId: article.law_id,
    numero: article.article_number,
    articleId: article.article_id,
    titre: article.law_title,
    reference: article.law_reference,
    statut: article.statut ?? null,
    citations: citationsDeLArticle(texte, citations, article),
  }));
  const rangees = new Set(cartes.flatMap((carte) => carte.citations.map((c) => c.indexCitation)));
  citations.forEach((citation, indexCitation) => {
    if (rangees.has(indexCitation)) return;
    const entree = { indexCitation, phrase: phraseAutour(texte, citation.debut, citation.fin) };
    const memeCarte = cartes.find((c) => c.lawId === citation.law_id && c.numero === citation.article);
    if (memeCarte) {
      memeCarte.citations.push(entree);
      return;
    }
    cartes.push({
      lawId: citation.law_id,
      numero: citation.article,
      articleId: citation.article_id,
      titre: citation.titre,
      reference: citation.reference,
      statut: citation.statut ?? null,
      citations: [entree],
    });
  });
  return cartes;
}

/** Le rang de la carte qui porte cette citation, ou -1. */
export function carteDeLaCitation(cartes: readonly CarteDeLaReponse[], indexCitation: number): number {
  return cartes.findIndex((carte) => carte.citations.some((c) => c.indexCitation === indexCitation));
}

/**
 * Un passage par citation (C10) : `passageLePlusProche` appelé pour chacune,
 * avec sa seule phrase. La clé est l'indice de la citation ; `null` : pas de
 * passage sûr pour elle.
 */
export function passagesDeLArticle(
  contenu: string,
  citations: readonly CitationDeLArticle[],
): Map<number, Passage | null> {
  const passages = new Map<number, Passage | null>();
  for (const { indexCitation, phrase } of citations) {
    passages.set(indexCitation, passageLePlusProche(contenu, [phrase]));
  }
  return passages;
}

/** Un morceau d'un paragraphe de l'article : du texte, et les passages qui le couvrent. */
export interface MorceauDuParagraphe {
  texte: string;
  /** Les citations dont le passage couvre ce morceau, dans l'ordre croissant ; vide hors de tout passage. */
  passages: number[];
  /** Le morceau est dans le passage de la citation active : c'est lui qu'on souligne. */
  actif: boolean;
}

/**
 * Les paragraphes de l'article (ceux de `paragraphesDeLArticle`), chacun coupé
 * en morceaux aux bornes de tous les passages connus.
 *
 * PLUSIEURS PASSAGES, UN SEUL SOULIGNÉ. Les passages des autres citations de
 * l'article restent dans le texte, comme du texte ordinaire (`actif` faux) :
 * toucher une autre puce du même article déplace le soulignement sans changer
 * le texte affiché (A1 § 4 : « l'autre passage du même article reste visible
 * mais non souligné »).
 *
 * CHEVAUCHEMENTS. Deux citations voisines peuvent avoir des passages qui se
 * recouvrent. Les balises ne pouvant pas se croiser, le texte est coupé à
 * CHAQUE borne, et chaque morceau dit quels passages le couvrent : le passage
 * actif est la suite de ses morceaux, qu'un autre passage en couvre une part
 * ou non.
 *
 * `actif` : l'indice de la citation dont le passage est souligné, ou `null`.
 * Les morceaux voisins de même couverture sont fusionnés : un paragraphe sans
 * passage reste un seul morceau.
 */
export function paragraphesAvecPassages(
  contenu: string,
  passages: ReadonlyMap<number, Passage | null>,
  actif: number | null,
): MorceauDuParagraphe[][] {
  const connus = [...passages]
    .filter((entree): entree is [number, Passage] => entree[1] !== null && entree[1].fin > entree[1].debut)
    .sort(([a], [b]) => a - b);

  const resultat: MorceauDuParagraphe[][] = [];
  // Les paragraphes sont des tranches des lignes de `contenu`, dans l'ordre,
  // sans blanc au bord : la suivante se trouve à partir de la fin de la
  // précédente, et jamais plus tôt (elle commence par un caractère visible).
  let curseur = 0;
  for (const { avant } of paragraphesDeLArticle(contenu, null)) {
    const debut = contenu.indexOf(avant, curseur);
    if (debut === -1) {
      // Impossible tant que `paragraphesDeLArticle` découpe `contenu` : le
      // paragraphe est rendu tel quel plutôt que perdu.
      resultat.push([{ texte: avant, passages: [], actif: false }]);
      continue;
    }
    const fin = debut + avant.length;
    curseur = fin;

    const bornes = new Set([debut, fin]);
    for (const [, p] of connus) {
      if (p.debut > debut && p.debut < fin) bornes.add(p.debut);
      if (p.fin > debut && p.fin < fin) bornes.add(p.fin);
    }
    const coupes = [...bornes].sort((a, b) => a - b);

    const morceaux: MorceauDuParagraphe[] = [];
    for (let i = 0; i < coupes.length - 1; i += 1) {
      const a = coupes[i];
      const b = coupes[i + 1];
      const couverts = connus.filter(([, p]) => p.debut <= a && p.fin >= b).map(([index]) => index);
      const estActif = actif !== null && couverts.includes(actif);
      const precedent = morceaux[morceaux.length - 1];
      if (precedent && precedent.actif === estActif && memesIndices(precedent.passages, couverts)) {
        precedent.texte += contenu.slice(a, b);
      } else {
        morceaux.push({ texte: contenu.slice(a, b), passages: couverts, actif: estActif });
      }
    }
    resultat.push(morceaux);
  }
  return resultat;
}

function memesIndices(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}
