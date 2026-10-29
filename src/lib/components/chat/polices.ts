/**
 * Les polices de l'aperçu d'une citation (P3, Q5 A) : Literata texte, en 400
 * pour l'article et en 600 pour le passage cité en gras (servie par
 * literata-titre.woff2, src/app.css).
 *
 * POURQUOI LES DEMANDER D'AVANCE. Elles sont en `font-display: optional` : une
 * police qui n'est pas prête quand son texte s'affiche est écartée pour toute
 * la visite, et le repli ajusté (Noto Serif, Georgia) reste. Sur /chat, rien ne
 * les demandait avant l'ouverture de l'aperçu (le titre de la page y est
 * masqué, et en Inter) : la 600 arrivait trop tard, et le passage en gras
 * s'affichait en Noto Serif Bold au milieu d'un romain Literata (audit du
 * 29/10/2026, captures chat-apercu 768x1024). Demandées dès qu'une réponse
 * porte des citations, au repos du navigateur, elles sont prêtes quand le
 * lecteur en touche une : aucun texte ne les attendait pendant leur
 * chargement, elles servent donc dès le premier affichage de l'aperçu (dans
 * Chromium, une police `optional` qui n'a fait attendre aucun texte reste
 * utilisable une fois chargée). Rien n'est chargé pour qui n'a aucune
 * citation à ouvrir, ni ailleurs que dans le chat : pas de préchargement
 * global (Q5 A).
 */

const POLICES = ['400 1em "Literata Texte"', '600 1em "Literata Texte"'] as const;

let demandees = false;

/** Demande les deux graisses de Literata texte, une fois par visite, au repos. */
export function preparerLesPolicesDeLApercu(): void {
  if (demandees || typeof document === 'undefined' || typeof document.fonts?.load !== 'function') return;
  demandees = true;
  const charger = () => {
    for (const police of POLICES) {
      // Un échec (réseau coupé) laisse le repli ajusté, comme sans préparation.
      document.fonts.load(police).catch(() => {});
    }
  };
  // Au repos : rien ne doit disputer le réseau à la réponse qui s'affiche.
  // Safari n'a pas requestIdleCallback.
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(charger, { timeout: 2000 });
  else setTimeout(charger, 200);
}

/** Réservé aux tests : oublie que les polices ont été demandées. */
export function _oublierLesPolicesDemandees(): void {
  demandees = false;
}
