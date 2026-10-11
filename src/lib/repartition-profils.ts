/**
 * Conversations par profil, pour le tableau de bord d'administration.
 *
 * `GET /analytics/usage` renvoie `personas_usage` tel que la base le stocke :
 * une clé par valeur de `conversations.persona`. Un même profil a pu y être
 * écrit sous plusieurs graphies avant que le serveur ne normalise les profils
 * (« étudiant » en NFD, sans accent, en capitales) : elles sont regroupées
 * sous la forme canonique, avec la même tolérance que le serveur.
 *
 * `general` est le profil général : les visiteurs qui n'ont pas répondu à la
 * question du profil, et ceux qui l'ont choisi. Une valeur inconnue reste
 * affichée telle quelle : l'écarter fausserait le total.
 */

import { PERSONA_SLUG, PERSONAS, PROFIL_GENERAL, type Persona } from '$lib/stores/persona';

export type ProfilConnu = Persona | typeof PROFIL_GENERAL;

export interface LigneDeProfil {
  /** Identifiant stable de la ligne : le profil canonique, ou la valeur brute. */
  cle: string;
  /** Le profil, ou `null` pour une valeur que le front ne connaît pas. */
  profil: ProfilConnu | null;
  conversations: number;
  /** Part du total, entre 0 et 1. */
  part: number;
}

/** L'ordre d'affichage à effectif égal : celui de la question, puis le profil général. */
const ORDRE: readonly ProfilConnu[] = [...PERSONAS, PROFIL_GENERAL];

/** Sans accent ni casse : `PERSONA_SLUG` est déjà cette forme pour chaque profil. */
function profilDe(valeur: string): ProfilConnu | null {
  const forme = valeur.normalize('NFKD').replace(/\p{M}/gu, '').trim().toLowerCase();
  if (forme === PROFIL_GENERAL) return PROFIL_GENERAL;
  return PERSONAS.find((p) => PERSONA_SLUG[p] === forme) ?? null;
}

function rang(ligne: LigneDeProfil): number {
  return ligne.profil ? ORDRE.indexOf(ligne.profil) : ORDRE.length;
}

export function repartitionParProfil(usage: Record<string, number> | null | undefined): LigneDeProfil[] {
  const parCle = new Map<string, LigneDeProfil>();
  for (const [valeur, n] of Object.entries(usage ?? {})) {
    const conversations = Number(n);
    if (!Number.isFinite(conversations) || conversations <= 0) continue;
    const profil = profilDe(valeur);
    const cle = profil ?? valeur;
    const ligne = parCle.get(cle) ?? { cle, profil, conversations: 0, part: 0 };
    ligne.conversations += conversations;
    parCle.set(cle, ligne);
  }

  const lignes = [...parCle.values()];
  const total = lignes.reduce((somme, l) => somme + l.conversations, 0);
  for (const ligne of lignes) ligne.part = ligne.conversations / total;

  return lignes.sort(
    (a, b) => b.conversations - a.conversations || rang(a) - rang(b) || a.cle.localeCompare(b.cle),
  );
}
