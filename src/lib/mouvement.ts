/**
 * Le mouvement de JuriX, côté JavaScript : la courbe, les repères de durée,
 * et la durée d'une transition Svelte en mouvement réduit.
 *
 * Les @keyframes et les classes `mv-*` sont dans src/lib/mouvement.css ; ce
 * module ne sert qu'aux transitions Svelte (`fly`, `slide`, `fade`…) et aux
 * minuteries, que le CSS ne garde pas.
 *
 * POURQUOI UN SEUL `duree`. La même ligne était écrite trois fois, dans le
 * layout (main), la page du chat et l'aperçu des citations, et l'expression
 * en ligne deux fois de plus (l'en-tête, le chat) : un seul mécanisme
 * « mouvement réduit », lu par tout le site, et pas de `mouvementReduit()`
 * concurrent.
 */
import { prefersReducedMotion } from 'svelte/motion';

/**
 * La courbe commune des arrivées et des changements d'état : départ vif,
 * arrivée posée (A2 § 1, décision X2). Même valeur que `--mv-courbe`
 * (mouvement.css) et que le jeton Tailwind `ease-jx`.
 */
export const COURBE = 'cubic-bezier(.22,1,.36,1)';

/**
 * Les trois repères de durée, en millisecondes (A2 § 1) : un toucher, un
 * changement d'état, l'arrivée d'une page ou d'un bloc. Les durées exactes de
 * chaque geste restent celles de A2 §§ 3 et 4.
 */
export const DUREES = {
  toucher: 150,
  changement: 300,
  arrivee: 800,
} as const;

/**
 * Durée d'une transition, nulle quand le système demande moins de mouvement.
 *
 * Lue au moment où la transition démarre (`in:fly={{ duration: duree(350) }}`
 * évalue l'expression à chaque entrée) : un réglage changé en cours de visite
 * est suivi sans recharger la page. Au rendu serveur, `prefersReducedMotion`
 * vaut faux, et aucune transition ne joue de toute façon.
 */
export function duree(ms: number): number {
  return prefersReducedMotion.current ? 0 : ms;
}
