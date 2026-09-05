/**
 * Formatage des dates, pour toute l'application.
 *
 * POURQUOI. Sept implémentations de `formatDate` coexistaient, avec quatre
 * politiques de locale incompatibles :
 *
 *   - quatre dérivaient la locale de la langue courante (correct) ;
 *   - deux codaient `"fr-FR"` en dur — `laws/+page.svelte` et
 *     `admin/users/+page.svelte` affichaient donc des dates françaises même
 *     en anglais ;
 *   - deux étaient appelées en ligne sans locale ni garde nulle
 *     (`admin/documents`, `admin/+page`) et rendaient « Invalid Date » sur une
 *     valeur absente.
 *
 * Les replis divergeaient aussi : chaîne vide, `"N/A"`, ou `"—"`. Un même
 * document affichait donc trois choses différentes selon l'écran.
 *
 * La locale n'est PAS lue depuis le store ici : ces fonctions restent pures et
 * testables, l'appelant passe la langue courante. C'est ce qui permet de les
 * couvrir sans monter de composant.
 */

import type { Language } from './stores/language';

/** Affiché quand la date est absente. Un seul repli, partout. */
export const DATE_ABSENTE = '—';

function locale(lang: Language): string {
  return lang === 'fr' ? 'fr-FR' : 'en-US';
}

/**
 * Date longue : « 4 mai 2026 ».
 *
 * Rend `DATE_ABSENTE` sur une valeur nulle, vide ou impossible à analyser —
 * jamais « Invalid Date », qui n'apprend rien à l'utilisateur et signale un
 * défaut de code là où il n'y a souvent qu'une donnée manquante.
 */
export function formatDate(valeur: string | null | undefined, lang: Language): string {
  if (!valeur) return DATE_ABSENTE;
  const d = new Date(valeur);
  if (Number.isNaN(d.getTime())) return DATE_ABSENTE;
  return d.toLocaleDateString(locale(lang), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Date courte : « 4 mai 2026 » en forme abrégée, pour les tableaux denses. */
export function formatDateCourte(
  valeur: string | null | undefined,
  lang: Language,
): string {
  if (!valeur) return DATE_ABSENTE;
  const d = new Date(valeur);
  if (Number.isNaN(d.getTime())) return DATE_ABSENTE;
  return d.toLocaleDateString(locale(lang), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Date et heure, pour le suivi d'un traitement en cours. */
export function formatDateHeure(
  valeur: string | null | undefined,
  lang: Language,
): string {
  if (!valeur) return DATE_ABSENTE;
  const d = new Date(valeur);
  if (Number.isNaN(d.getTime())) return DATE_ABSENTE;
  return d.toLocaleString(locale(lang));
}

/** Heure seule, pour l'horodatage des messages du chat. */
export function formatHeure(date: Date, lang: Language): string {
  return date.toLocaleTimeString(locale(lang), {
    hour: '2-digit',
    minute: '2-digit',
  });
}
