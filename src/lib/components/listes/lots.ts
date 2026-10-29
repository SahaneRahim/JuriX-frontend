/**
 * Les lots des listes de textes (P11 A) : le numéro lu dans `?page=` et la
 * ligne réduite qui part vers le navigateur. Partagé par /laws et la page
 * d'un domaine.
 */

import type { LigneDeTexte } from '$lib/types';

/**
 * Plafond du numéro de lot, celui de la nouvelle API (`page` de 1 à
 * 10 000 000, contrat §5.1). Avec 20 lignes par lot, l'ancienne API reçoit
 * au plus `skip` = 199 999 960, un entier 32 bits qu'elle accepte : une
 * adresse fabriquée (`?page=1e21`) n'est jamais servie comme une panne.
 */
export const LOT_MAX = 10_000_000;

/**
 * Le numéro de lot d'une adresse, à partir de 1. Forme canonique d'un entier
 * seulement (« 2 », ni « 02 », ni « 2e0 », ni « 1e21 ») : chaque lot a une
 * seule adresse, donc une seule version en cache (ISR) ; tout le reste vaut 1.
 */
export function lotDepuis(brut: string | null | undefined): number {
  if (!brut || !/^[1-9]\d{0,7}$/.test(brut)) return 1;
  return Math.min(Number(brut), LOT_MAX);
}

/**
 * L'adresse d'un lot : le chemin de la liste, ses filtres (sans valeur par
 * défaut, dans l'ordre donné) et `page` à partir du deuxième lot. Le premier
 * lot n'écrit pas `page=1` : une seule adresse, donc une seule version en
 * cache (ISR), celle que la canonique désigne.
 */
export function adresseDuLot(chemin: string, filtres: Readonly<Record<string, string>>, lot: number): string {
  const parametres = new URLSearchParams(filtres);
  if (lot > 1) parametres.set('page', String(lot));
  const requete = parametres.toString();
  return requete ? `${chemin}?${requete}` : chemin;
}

/** Les repères de l'API, recopiés SEULEMENT s'ils sont là : leur absence signale l'ancienne API. */
const CLES_DES_REPERES = ['objet', 'numero', 'date_signature', 'annee', 'date_publication_jo', 'statut'] as const;

/**
 * Une liste allongée par « Afficher 20 de plus », telle qu'on la quitte : ce
 * que garde le `snapshot` de sa page (/laws, page d'un domaine).
 *
 * POURQUOI. Les lots ajoutés ne vivaient que dans le composant. Ouvrir un texte
 * le détruit (/laws/[id] est une autre route) ; au retour arrière, la liste
 * recréée ne montrait que le lot de l'adresse (`?page=3` : les lignes 41 à 60,
 * sous « 20 textes précédents »), et SvelteKit rendait la position de
 * défilement de la ligne 50 dans une page de 60 lignes à une page de 20 :
 * le navigateur s'arrêtait en bas, sur le pied de page. SvelteKit garde cet
 * état dans l'historique, et en sessionStorage pour un rechargement.
 */
export interface EtatDeLaListe {
  /** L'identité de la liste (son premier lot, `adresseDuLot(chemin, filtres, 1)`). */
  cle: string;
  premierePage: number;
  /** Le dernier lot affiché : celui de l'adresse quittée. */
  dernierePage: number;
  lignes: LigneAffichee[];
  /** Le défilement de la fenêtre au départ : la liste rendue, on y revient. */
  x: number;
  y: number;
}

function estEntierPositif(valeur: unknown): valeur is number {
  return Number.isInteger(valeur) && (valeur as number) >= 1;
}

function estPosition(valeur: unknown): valeur is number {
  return typeof valeur === 'number' && Number.isFinite(valeur) && valeur >= 0;
}

/**
 * L'état gardé, s'il est celui de LA liste rouverte, au même lot ; sinon
 * `null`. Il revient du sessionStorage, où une version précédente du site a
 * pu l'écrire autrement : chaque champ est vérifié, et une ligne en double
 * retirée (deux clés égales dans un `{#each}` font tomber la page).
 *
 * @param cle l'identité de la liste affichée
 * @param page le lot de son adresse
 */
export function etatARestaurer(etat: unknown, cle: string, page: number): EtatDeLaListe | null {
  if (typeof etat !== 'object' || etat === null) return null;
  const e = etat as Record<string, unknown>;
  if (e.cle !== cle || e.dernierePage !== page) return null;
  if (!estEntierPositif(e.premierePage) || !estEntierPositif(e.dernierePage)) return null;
  // Un seul lot : la page rouverte le montre déjà tel quel.
  if (e.premierePage >= e.dernierePage) return null;
  if (!estPosition(e.x) || !estPosition(e.y) || !Array.isArray(e.lignes)) return null;

  const vues = new Set<number>();
  const lignes: LigneAffichee[] = [];
  for (const brute of e.lignes as unknown[]) {
    if (typeof brute !== 'object' || brute === null) return null;
    const ligne = brute as LigneAffichee;
    if (!Number.isInteger(ligne.id) || typeof ligne.title !== 'string') return null;
    if (vues.has(ligne.id)) continue;
    vues.add(ligne.id);
    lignes.push(ligne);
  }
  if (!lignes.length) return null;
  return { cle, premierePage: e.premierePage, dernierePage: e.dernierePage, lignes, x: e.x, y: e.y };
}

/** Ce qu'une ligne de liste affiche, et rien d'autre. */
export type LigneAffichee = Pick<LigneDeTexte, 'id' | 'title' | 'type' | 'publication_date' | 'article_count'> &
  Pick<LigneDeTexte, (typeof CLES_DES_REPERES)[number]>;

/**
 * Une ligne réduite à ce que la liste affiche : ni langue, ni domaine (déjà
 * dans le titre de la page, ou hors des repères d'une liste), ni cote. Le lot
 * part dans le HTML et dans chaque `__data.json` mis en cache (ISR).
 */
export function ligneAffichee(ligne: LigneDeTexte): LigneAffichee {
  const reduite: LigneAffichee = {
    id: ligne.id,
    title: ligne.title,
    type: ligne.type,
    publication_date: ligne.publication_date,
    article_count: ligne.article_count,
  };
  const reperes = reduite as unknown as Record<string, unknown>;
  for (const cle of CLES_DES_REPERES) {
    if (cle in ligne) reperes[cle] = ligne[cle];
  }
  return reduite;
}
