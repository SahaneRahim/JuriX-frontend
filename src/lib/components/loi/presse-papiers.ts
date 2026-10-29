/**
 * Copier et partager depuis la page d'un texte (P2), sans `alert()` : le
 * résultat est annoncé par la page (région `role="status"`), et le focus reste
 * sur le bouton.
 */

/**
 * Copie un texte. `navigator.clipboard` d'abord ; sinon (contexte non
 * sécurisé, WebView Android ancienne, permission refusée) une zone de texte
 * temporaire et `execCommand('copy')`, encore compris partout. Le focus est
 * rendu à l'élément qui l'avait : la zone le prend le temps de la sélection.
 *
 * @returns vrai si le texte est dans le presse-papiers.
 */
export async function copierDansLePressePapiers(texte: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texte);
      return true;
    }
  } catch {
    // Refus ou contexte non sécurisé : on tente le repli.
  }
  if (typeof document === 'undefined') return false;
  const actif = document.activeElement as HTMLElement | null;
  const zone = document.createElement('textarea');
  zone.value = texte;
  zone.setAttribute('readonly', '');
  zone.setAttribute('aria-hidden', 'true');
  // Hors de l'écran, mais rendue : une zone masquée ne se sélectionne pas.
  zone.style.position = 'fixed';
  zone.style.top = '-1000px';
  zone.style.opacity = '0';
  document.body.appendChild(zone);
  try {
    zone.select();
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    zone.remove();
    actif?.focus?.({ preventScroll: true });
  }
}

/** Ce que reçoit `navigator.share`. */
export interface Partage {
  title: string;
  text: string;
  url: string;
}

/** Le partage natif est-il possible pour ces données ? (Android, iOS, Windows, macOS ; pas Firefox de bureau.) */
export function partageNatifPossible(donnees: Partage): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
  try {
    return typeof navigator.canShare !== 'function' || navigator.canShare(donnees);
  } catch {
    return false;
  }
}

/**
 * Ouvre la feuille de partage du système. `annule` quand le lecteur la ferme
 * sans choisir (AbortError), `echec` sinon (refus, contexte non sécurisé).
 * À appeler pendant le geste du lecteur (clic) : le navigateur l'exige.
 */
export async function partagerNativement(donnees: Partage): Promise<'partage' | 'annule' | 'echec'> {
  try {
    await navigator.share(donnees);
    return 'partage';
  } catch (erreur) {
    // Par le nom : une DOMException n'hérite pas d'Error dans tous les moteurs.
    return (erreur as { name?: unknown } | null)?.name === 'AbortError' ? 'annule' : 'echec';
  }
}
