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

/**
 * Le profil de la conversation en cours, à côté de son identifiant : une
 * conversation garde un seul profil (le serveur en ouvre une nouvelle si on
 * lui en envoie un autre). Toujours écrit, `general` compris : une clé ABSENTE
 * désigne une session créée avant les profils, donc en citoyen — la valeur
 * que le front envoyait en dur.
 */
const CLE_PERSONA = 'jurix-chat-persona';

// `window` d'abord : Node 25 expose un localStorage global, propre au processus
// et partage par tous les visiteurs du serveur. Seul le navigateur stocke.

/** L'identifiant en cours, ou `null`. */
export function lireSessionChat(): string | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
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

/**
 * Mémorise la conversation en cours. `persona` absent : le profil mémorisé ne
 * change pas ; `null` : profil général.
 */
export function ecrireSessionChat(sessionId: string | null, persona?: string | null): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    if (sessionId && sessionId.trim()) {
      localStorage.setItem(CLE, sessionId);
      if (persona !== undefined) localStorage.setItem(CLE_PERSONA, persona ?? 'general');
    } else {
      localStorage.removeItem(CLE);
      localStorage.removeItem(CLE_PERSONA);
    }
  } catch {
    /* voir lireSessionChat */
  }
}

/**
 * Le profil mémorisé de la conversation en cours, brut (c'est l'appelant qui
 * le normalise), ou `null` quand la clé est absente.
 */
export function lirePersonaSessionChat(): string | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(CLE_PERSONA);
  } catch {
    return null;
  }
}

export function effacerSessionChat(): void {
  ecrireSessionChat(null);
}
