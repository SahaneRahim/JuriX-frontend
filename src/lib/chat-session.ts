/**
 * Persistance de l'identifiant de conversation du chat.
 *
 * POURQUOI CE MODULE EXISTE. `sessionId` vivait dans une simple variable du
 * composant `(main)/chat/+page.svelte` : un rechargement de page perdait le
 * fil, alors que la conversation restait en base — inatteignable, puisque
 * l'identifiant qui y menait venait de disparaître.
 *
 * Module feuille, sans aucun import : `auth.ts` et `api.ts` ont déjà une
 * dépendance circulaire assumée entre eux, il ne faut pas l'alourdir.
 */

const CLE = 'jurix-chat-session';

/** L'identifiant en cours, ou `null`. */
export function lireSessionChat(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const valeur = localStorage.getItem(CLE);
    // Une chaîne vide n'est pas un identifiant : la traiter comme absente
    // évite d'envoyer `session_id: ""` au serveur, qui créerait une
    // conversation neuve à chaque message.
    return valeur && valeur.trim() ? valeur : null;
  } catch {
    // Stockage indisponible (navigation privée stricte, cookies bloqués). Le
    // chat doit continuer de fonctionner, simplement sans mémoire.
    return null;
  }
}

export function ecrireSessionChat(sessionId: string | null): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (sessionId && sessionId.trim()) localStorage.setItem(CLE, sessionId);
    else localStorage.removeItem(CLE);
  } catch {
    /* voir lireSessionChat */
  }
}

export function effacerSessionChat(): void {
  ecrireSessionChat(null);
}
