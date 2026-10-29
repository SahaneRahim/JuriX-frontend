/**
 * Les deux lectures de l'API dont le chat a besoin hors du flux : l'aperçu
 * d'un article cité (P3) et les chiffres du corpus pour l'accueil (P4). Elles
 * passent par $lib/api-publique, qui se replie sans erreur sur l'ancienne API
 * (`null`), et sont gardées en mémoire, dans le NAVIGATEUR seulement.
 *
 * POURQUOI UNE MÉMOIRE. Rouvrir l'aperçu d'un article déjà lu, ou revenir sur
 * /chat depuis une autre page, ne doit ni refaire attendre le lecteur ni
 * redemander l'API. Au serveur, une variable de module est partagée par tous
 * les visiteurs : rien n'y est jamais écrit (la page du chat est d'ailleurs
 * mise en cache sans appeler l'API, voir +page.ts).
 */

import { lireApercuDArticle, lireChiffresDuCorpus } from '$lib/api-publique';
import { DELAI_API_MS } from '$lib/config';
import type { ArticleApercu, ChiffresDuCorpus, StatutProuve } from '$lib/types';

const auNavigateur = (): boolean => typeof window !== 'undefined';

/**
 * Ce qu'ouvre l'aperçu (ApercuDeCitation) : un article cité, ou un texte cité
 * sans numéro d'article (« Voir aussi la loi n° 92/007 »). Tout ce qu'il faut
 * pour l'afficher AVANT la réponse de l'API, et sans elle sur l'ancienne.
 */
export interface CibleDApercu {
  /** Identifiant de cette ouverture : la clé de l'état d'historique (retour système). */
  cle: string;
  lawId: number;
  /** Numéro de l'article ; `null` pour un texte cité sans article (pas d'appel d'aperçu). */
  numero: string | null;
  /** Le morceau lu par le modèle : choisit l'article parmi les homonymes. */
  articleId: number | null;
  /** « Art. 37 — Code du travail », titre de la feuille. */
  libelle: string;
  /** Intitulé complet du texte. */
  titre: string;
  /** Statut prouvé de la citation : affiché tant que l'aperçu n'est pas là, ou à sa place. */
  statut: StatutProuve | null;
  /** Les phrases de la réponse qui le citent, sans la citation : de quoi trouver le passage à mettre en gras. */
  phrases: string[];
}

/* -------------------------------------------------------------------------- */
/* Aperçu d'un article cité                                                    */
/* -------------------------------------------------------------------------- */

/** Au-delà, les plus anciens sont oubliés : une conversation cite rarement plus de 30 articles. */
const APERCUS_GARDES = 40;
const apercus = new Map<string, ArticleApercu>();

function cleDeLApercu(lawId: number, numero: string, articleId: number | null | undefined): string {
  return `${lawId}|${numero.trim()}|${articleId ?? ''}`;
}

/**
 * L'aperçu d'un article, ou `null` (ancienne API, article introuvable, panne,
 * délai dépassé) : l'écran propose alors le texte intégral.
 *
 * `signal` annule la lecture (feuille fermée, autre citation ouverte). Il
 * remplacerait le délai de $lib/api-publique : le délai est donc reposé ici,
 * sur le même contrôleur, sans `AbortSignal.any` (absent d'une partie des
 * téléphones visés).
 */
export async function apercuDeLArticle(
  lawId: number,
  numero: string,
  articleId: number | null | undefined,
  signal?: AbortSignal,
): Promise<ArticleApercu | null> {
  const cle = cleDeLApercu(lawId, numero, articleId);
  const connu = apercus.get(cle);
  if (connu) return connu;

  const controleur = new AbortController();
  const minuterie = setTimeout(() => controleur.abort(), DELAI_API_MS);
  const relayer = () => controleur.abort();
  signal?.addEventListener('abort', relayer, { once: true });
  try {
    const apercu = await lireApercuDArticle(lawId, numero, articleId, { signal: controleur.signal });
    // Un échec n'est pas gardé : une panne passagère ne doit pas condamner
    // l'aperçu pour la visite.
    if (apercu && auNavigateur()) {
      apercus.set(cle, apercu);
      if (apercus.size > APERCUS_GARDES) apercus.delete(apercus.keys().next().value as string);
    }
    return apercu;
  } finally {
    clearTimeout(minuterie);
    signal?.removeEventListener('abort', relayer);
  }
}

/* -------------------------------------------------------------------------- */
/* Chiffres du corpus, pour l'accueil                                          */
/* -------------------------------------------------------------------------- */

let chiffres: ChiffresDuCorpus | null = null;
let lectureEnCours: Promise<ChiffresDuCorpus | null> | null = null;

/**
 * Les chiffres déjà lus pendant cette visite, ou `null`. Lus au montage du
 * chat : revenu sur /chat, l'accueil s'affiche aussitôt avec ses chiffres, sans
 * passer par le texte générique.
 */
export function chiffresDejaLus(): ChiffresDuCorpus | null {
  return chiffres;
}

/**
 * Les chiffres du corpus (`GET /corpus`), lus une fois par visite, ou `null`
 * (ancienne API : 404 ; panne). Jamais au serveur. Un échec n'est pas gardé :
 * la visite suivante du chat réessaie.
 */
export function chargerLesChiffresDuCorpus(): Promise<ChiffresDuCorpus | null> {
  if (!auNavigateur()) return Promise.resolve(null);
  if (chiffres) return Promise.resolve(chiffres);
  lectureEnCours ??= lireChiffresDuCorpus().then((lus) => {
    chiffres = lus;
    lectureEnCours = null;
    return lus;
  });
  return lectureEnCours;
}

/** Réservé aux tests : oublie tout ce qui a été lu. */
export function _oublierLesLectures(): void {
  apercus.clear();
  chiffres = null;
  lectureEnCours = null;
}
