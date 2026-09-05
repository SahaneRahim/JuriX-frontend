/**
 * Action Svelte : enferme le focus clavier dans une boîte de dialogue.
 *
 * POURQUOI. Aucune des modales du projet ne gérait le focus — ni à l'ouverture,
 * ni pendant, ni à la fermeture (`grep .focus()|inert|trapFocus` ne renvoyait
 * rien). Trois conséquences, toutes vécues par un utilisateur au clavier :
 *
 *  - à l'ouverture, le focus restait sur le bouton déclencheur, derrière le
 *    voile : la tabulation parcourait la page masquée avant d'atteindre la
 *    modale ;
 *  - une fois dedans, la tabulation en ressortait par le bas et repartait dans
 *    la page, qui est pourtant inerte visuellement ;
 *  - à la fermeture, le focus était perdu — renvoyé au `<body>`, obligeant à
 *    tout re-tabuler depuis le début de la page.
 *
 * Usage : `<div role="dialog" use:piegerFocus>` sur le conteneur de la boîte.
 * L'action ne gère PAS la touche Échap : chaque modale a déjà la sienne, et
 * dupliquer l'écouteur ferait fermer deux fois.
 */

const SELECTEUR_FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusables(racine: HTMLElement): HTMLElement[] {
  return Array.from(racine.querySelectorAll<HTMLElement>(SELECTEUR_FOCUSABLE)).filter(
    // Un élément masqué n'a pas de boîte : le tabuler enverrait le focus dans le
    // vide. `offsetParent` est nul pour `display:none` et les ancêtres masqués.
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

export function piegerFocus(noeud: HTMLElement) {
  // Mémorisé AVANT de déplacer le focus, pour pouvoir le rendre à la fermeture.
  const precedent = document.activeElement as HTMLElement | null;

  const premier = focusables(noeud)[0];
  // Repli sur le conteneur lui-même : une modale sans aucun élément focusable
  // (un écran de progression, par exemple) doit tout de même recevoir le focus,
  // sinon les touches ne lui parviennent pas.
  if (premier) {
    premier.focus();
  } else {
    noeud.setAttribute('tabindex', '-1');
    noeud.focus();
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;

    const liste = focusables(noeud);
    if (liste.length === 0) {
      event.preventDefault();
      return;
    }

    const debut = liste[0];
    const fin = liste[liste.length - 1];
    const actif = document.activeElement;

    // Le cycle est explicite dans les deux sens : sans cela, Tab depuis le
    // dernier élément sortirait vers la page, et Maj+Tab depuis le premier
    // vers la barre d'adresse du navigateur.
    if (event.shiftKey && (actif === debut || !noeud.contains(actif))) {
      event.preventDefault();
      fin.focus();
    } else if (!event.shiftKey && actif === fin) {
      event.preventDefault();
      debut.focus();
    }
  }

  noeud.addEventListener('keydown', onKeydown);

  return {
    destroy() {
      noeud.removeEventListener('keydown', onKeydown);
      // Rendre le focus à ce qui a ouvert la modale : c'est ce qui permet de
      // reprendre la navigation là où on l'avait laissée.
      precedent?.focus?.();
    },
  };
}
