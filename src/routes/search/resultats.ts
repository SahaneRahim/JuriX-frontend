/**
 * La réponse de `POST /search/`, réduite à ce que la liste dense affiche (P7).
 *
 * POURQUOI RÉDUIRE AU SERVEUR. La page est rendue par le serveur
 * (+page.server.ts) et ses données partent aussi en `__data.json` à chaque
 * filtre ou page. Un résultat brut porte son texte (`content`), l'extrait
 * surligné et jusqu'à trois extraits d'articles de 500 caractères chacun :
 * environ 35 Ko pour 20 résultats, dont la liste n'affiche que deux lignes
 * d'extrait et le NUMÉRO des articles. Ne partent que les repères, deux
 * lignes d'extrait au plus, et les numéros.
 */

import { cleDuDomaine, ORDRE_DES_DOMAINES } from '$lib/components/listes/domaines';
import type { ResultatAffiche, SegmentDExtrait } from '$lib/components/listes/reperes';
import { highlightSegments } from '$lib/highlight';
import type { FacetteCategorie, FacetteValeur, SearchResult } from '$lib/types';
import { natureDuType, type NatureDuFiltre, type ParametresDeRecherche } from './parametres';

export type { ResultatAffiche, SegmentDExtrait };

/** Ce que le `load` de /search donne à la page (+page.server.ts). */
export interface DonneesDeRecherche {
  parametres: ParametresDeRecherche;
  /** `debut` : aucune requête ; `erreur` : l'API n'a pas répondu ; `resultats` : sinon, même sans résultat. */
  etat: 'debut' | 'resultats' | 'erreur';
  /** Clé du message d'erreur, vide hors erreur. */
  erreur: '' | 'search.errorSearch' | 'search.errorServer';
  resultats: ResultatAffiche[];
  /** Nombre de résultats, filtres compris. */
  total: number;
  /**
   * Le serveur a appliqué tri, filtres et effectifs (nouvelle API). Faux sur
   * l'ancienne : ni onglets à effectifs, ni colonne de filtres, ni tri, que
   * rien ne prouverait (contrat §8).
   */
  affinee: boolean;
  /** Textes trouvés AVANT les filtres (nouvelle API) : « Voir les N textes, sans filtre ». */
  candidats: number | null;
  natures: EffectifsParNature | null;
  domaines: DomaineDuPanneau[];
  /**
   * Noms des domaines cochés et du périmètre, quand il a fallu les lire :
   * rappel des filtres de l'ancienne API, ou d'un périmètre où rien n'est
   * trouvé (pas de colonne pour le montrer).
   */
  nomsDesDomaines: Record<number, string>;
  /** Le périmètre du corpus (GET /corpus), pour l'état « aucun texte » ; nul sur l'ancienne API. */
  corpus: { textes: number; sources: { fr: string; en: string } } | null;
}

/**
 * Longueur de l'extrait envoyé : deux lignes de 14 px tiennent environ 2 × 110
 * caractères sur un bureau de 1 440 px ; 320 laissent une marge sans envoyer
 * les 500 à 570 caractères des extraits de l'API.
 */
export const LONGUEUR_EXTRAIT = 320;

/** Les repères de l'API, recopiés SEULEMENT s'ils sont là : leur absence signale l'ancienne API. */
const CLES_DES_REPERES = ['objet', 'numero', 'date_signature', 'annee', 'date_publication_jo', 'statut'] as const;

/*
 * Nettoyage de l'extrait : le texte des lois vient de l'OCR, en markdown
 * (tuyaux de tableau « | 6624 | Indemnités », filets « --- », « ** »). Mêmes
 * expressions que $lib/seo.descriptionDepuis, appliquées morceau par morceau
 * pour garder les mots en gras.
 */
const TUYAUX = /\|/g;
const FILETS = /[:-]{2,}/g;
const MARQUES = /[#*_`]/g;
const PONCTUATION_FINALE = /[\s,;:.!?«"'-]+$/;

function nettoyer(texte: string): string {
  return texte.replace(TUYAUX, ' ').replace(FILETS, ' ').replace(MARQUES, '').replace(/\s+/g, ' ');
}

/**
 * Un extrait surligné (`<mark>` de ts_headline) en morceaux propres, coupé à
 * `max` caractères sur une fin de mot, « … » à la coupe. Les balises ne sont
 * jamais rendues en HTML : `highlightSegments` les reconnaît, tout le reste
 * reste du texte (src/lib/highlight.ts).
 */
export function extraitPropre(brut: string | null | undefined, max = LONGUEUR_EXTRAIT): SegmentDExtrait[] {
  const sortie: SegmentDExtrait[] = [];
  let longueur = 0;
  for (const segment of highlightSegments(brut)) {
    let texte = nettoyer(segment.text);
    const precedent = sortie[sortie.length - 1];
    // Un seul blanc à la jointure de deux morceaux, aucun en tête.
    if (!precedent) texte = texte.trimStart();
    else if (precedent.texte.endsWith(' ') && texte.startsWith(' ')) texte = texte.slice(1);
    if (!texte) continue;

    const reste = max - longueur;
    if (texte.length > reste) {
      const fenetre = texte.slice(0, reste + 1);
      const espace = fenetre.lastIndexOf(' ');
      const coupe = (espace > 0 ? fenetre.slice(0, espace) : texte.slice(0, reste)).replace(PONCTUATION_FINALE, '');
      if (coupe) ajouter(sortie, coupe, segment.marked);
      ajouter(sortie, '…', false);
      return sortie;
    }
    ajouter(sortie, texte, segment.marked);
    longueur += texte.length;
  }
  const dernier = sortie[sortie.length - 1];
  if (dernier) dernier.texte = dernier.texte.trimEnd();
  return sortie.filter((s) => s.texte);
}

/** Ajoute un morceau, fondu dans le précédent s'il a la même graisse. */
function ajouter(sortie: SegmentDExtrait[], texte: string, gras: boolean) {
  const precedent = sortie[sortie.length - 1];
  if (precedent && precedent.gras === gras) precedent.texte += texte;
  else sortie.push({ texte, gras });
}

/**
 * Le texte de l'extrait : le passage surligné du texte, sinon celui du
 * premier article trouvé, sinon le début du morceau trouvé (`content`, 300
 * caractères). Le parcours affiné de la nouvelle API donne lui-même un extrait
 * autour des mots cherchés aux textes trouvés par le sens (contrat §6.2).
 */
function texteDeLExtrait(r: SearchResult): string {
  const surligne = r.highlights?.content;
  if (typeof surligne === 'string' && surligne.trim()) return surligne;
  const article = (r.matched_articles ?? []).find((a) => typeof a.content_snippet === 'string' && a.content_snippet.trim());
  if (article) return article.content_snippet;
  return typeof r.content === 'string' ? r.content : '';
}

/** Un résultat réduit à ce que la ligne affiche. */
export function resultatAffiche(r: SearchResult): ResultatAffiche {
  const numeros = (r.matched_articles ?? [])
    .map((a) => String(a.number ?? '').trim())
    .filter((numero) => numero !== '');
  const ligne: ResultatAffiche = {
    id: r.law_id,
    title: r.title ?? '',
    type: r.type ?? 'autre',
    publication_date: r.publication_date ?? null,
    category_id: r.category_id ?? null,
    category_name: r.category_name ?? null,
    extrait: extraitPropre(texteDeLExtrait(r)),
    // Trois puces au plus, comme la maquette : l'API en rend trois au plus,
    // la borne protège la ligne d'une autre version.
    articles: [...new Set(numeros)].slice(0, 3),
  };
  const reperes = ligne as unknown as Record<string, unknown>;
  for (const cle of CLES_DES_REPERES) {
    if (cle in r) reperes[cle] = (r as unknown as Record<string, unknown>)[cle];
  }
  return ligne;
}

/** Effectif de chaque onglet ; « tous » est la somme des natures (contrat §6.2). */
export type EffectifsParNature = Record<NatureDuFiltre | 'tous', number>;

/**
 * Les effectifs des onglets, depuis `facets.types`. Disjonctifs : chacun
 * compte les résultats qui passent les AUTRES filtres (domaines, période),
 * quelle que soit la nature choisie.
 */
export function effectifsParNature(types: FacetteValeur[] | null | undefined): EffectifsParNature {
  const n: EffectifsParNature = { tous: 0, decret: 0, loi: 0, arrete: 0, 'acte-uniforme': 0, autres: 0 };
  for (const t of types ?? []) {
    if (!Number.isInteger(t?.count) || t.count <= 0) continue;
    n[natureDuType(t.value)] += t.count;
    n.tous += t.count;
  }
  return n;
}

/** Une case de la colonne « Domaine ». */
export interface DomaineDuPanneau {
  /** `category_id` ; nul pour un domaine sans résultat dont l'identifiant n'est pas connu (case inactive). */
  id: number | null;
  /** Nom de l'API, en français ; la page l'affiche en nom court ($lib/components/listes/domaines). */
  nom: string;
  /** Effectif disjonctif : les résultats des autres filtres, dans ce domaine. */
  n: number;
  coche: boolean;
}

/**
 * Les cases des 14 domaines, dans l'ordre fixe de l'accueil
 * (`ORDRE_DES_DOMAINES`), avec leur effectif (`facets.categories`, « une
 * valeur absente vaut 0 », contrat §6.2).
 *
 * Les domaines sont reconnus PAR LEUR NOM, liste fermée (migration 007) :
 * pas d'appel à `GET /categories` à chaque recherche pour des cases à zéro,
 * inactives de toute façon. Seul un domaine coché que les effectifs ne
 * nomment pas demande son nom à `nomsConnus` (lu à l'API dans ce cas).
 */
export function domainesDuPanneau(
  facettes: FacetteCategorie[] | null | undefined,
  coches: readonly number[],
  nomsConnus: ReadonlyMap<number, string> = new Map(),
): DomaineDuPanneau[] {
  const parNom = new Map<string, { id: number; nom: string; n: number }>();
  for (const f of facettes ?? []) {
    if (!Number.isInteger(f?.id) || !f.name || !Number.isInteger(f.count)) continue;
    parNom.set(cleDuDomaine(f.name), { id: f.id as number, nom: f.name, n: Math.max(0, f.count) });
  }
  const idParNom = new Map<string, number>();
  for (const [id, nom] of nomsConnus) idParNom.set(cleDuDomaine(nom), id);

  const cases: DomaineDuPanneau[] = [];
  const places = new Set<number>();
  const poser = (id: number | null, nom: string, n: number) => {
    if (id !== null) places.add(id);
    cases.push({ id, nom, n, coche: id !== null && coches.includes(id) });
  };

  for (const cle of ORDRE_DES_DOMAINES) {
    const facette = parNom.get(cle);
    if (facette) {
      poser(facette.id, facette.nom, facette.n);
      parNom.delete(cle);
    } else {
      poser(idParNom.get(cle) ?? null, cle, 0);
    }
  }
  // Un domaine que la liste fermée ne connaît pas (ajouté en base) : à la fin.
  for (const facette of parNom.values()) poser(facette.id, facette.nom, facette.n);
  // Un domaine coché sans place : il doit rester visible, et décochable.
  for (const id of coches) {
    if (!places.has(id)) poser(id, nomsConnus.get(id) ?? '', 0);
  }
  return cases;
}

/** Les identifiants que nomment les effectifs. */
export function idsDesFacettes(facettes: FacetteCategorie[] | null | undefined): Set<number> {
  return new Set((facettes ?? []).map((f) => f?.id).filter((id): id is number => Number.isInteger(id)));
}
