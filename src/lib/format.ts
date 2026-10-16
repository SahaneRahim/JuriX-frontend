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
 * Analyse une date de l'API.
 *
 * L'API rend ses horodatages SANS fuseau (« 2026-10-15T00:30:00 »), alors
 * qu'ils sont en UTC, et `new Date` lit une telle chaine en heure LOCALE. Au
 * Cameroun (UTC+1), entre 0 h et 1 h, le navigateur ecrivait la veille et le
 * serveur (UTC) le jour meme : le texte changeait a l'hydratation. Une date
 * seule (« 2016-07-12 ») est deja lue en UTC ; une chaine qui porte son fuseau
 * reste telle quelle.
 */
function lireDate(valeur: string): Date {
  return new Date(/T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(valeur) ? `${valeur}Z` : valeur);
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
  const d = lireDate(valeur);
  if (Number.isNaN(d.getTime())) return DATE_ABSENTE;
  // timeZone UTC : une date seule (« 2016-07-12 ») se lit minuit UTC. Formatee
  // dans le fuseau local, elle donnait la veille a l'ouest d'UTC, et le
  // serveur (UTC) et le navigateur n'ecrivaient pas le meme jour.
  return d.toLocaleDateString(locale(lang), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Date courte : « 4 mai 2026 » en forme abrégée, pour les tableaux denses. */
export function formatDateCourte(
  valeur: string | null | undefined,
  lang: Language,
): string {
  if (!valeur) return DATE_ABSENTE;
  const d = lireDate(valeur);
  if (Number.isNaN(d.getTime())) return DATE_ABSENTE;
  return d.toLocaleDateString(locale(lang), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Date et heure, pour le suivi d'un traitement en cours. */
export function formatDateHeure(
  valeur: string | null | undefined,
  lang: Language,
): string {
  if (!valeur) return DATE_ABSENTE;
  const d = lireDate(valeur);
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
