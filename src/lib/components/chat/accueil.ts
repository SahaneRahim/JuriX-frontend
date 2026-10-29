/**
 * L'accueil du chat en trois messages (P4, variante A) : à la PREMIÈRE visite
 * seulement, repère en localStorage, lu et écrit dans un try/catch.
 *
 * POURQUOI. Le périmètre, la vérification par les articles cités et les
 * données personnelles s'adressent à qui découvre l'assistant. Préfixés à
 * chaque visite, un habitué relisait les trois messages et les trois
 * questions à chaque retour (revue du 29/10/2026). Ensuite, l'accueil se
 * réduit à son premier message, le périmètre, dont la date change avec le
 * corpus, et aux trois questions ; l'avertissement sous le champ, lui, reste
 * toujours.
 *
 * LE REPÈRE S'ÉCRIT À LA PREMIÈRE QUESTION, pas à l'arrivée : qui est venu,
 * a lu et est reparti sans rien demander n'a pas encore fait connaissance avec
 * l'assistant, et retrouve l'accueil entier. Un rechargement juste après
 * l'arrivée non plus ne le lui retire pas.
 *
 * Sans stockage (navigation privée stricte, site bloqué), l'accueil reste
 * entier à chaque visite : rien ne casse, on en dit seulement un peu plus.
 */

const CLE = 'jurix-chat-accueil-vu';

// `window` d'abord, comme $lib/chat-session : Node 25 expose un localStorage
// global, propre au processus et partagé par tous les visiteurs du serveur.
// Seul le navigateur stocke.
const stockage = (): Storage | null =>
  typeof window === 'undefined' || typeof localStorage === 'undefined' ? null : localStorage;

/** Une question a déjà été posée dans ce navigateur : l'accueil se réduit au périmètre. */
export function accueilDejaVu(): boolean {
  try {
    return stockage()?.getItem(CLE) === '1';
  } catch {
    return false;
  }
}

/** Retient que l'accueil a servi : à la première question posée. */
export function retenirLAccueilVu(): void {
  try {
    stockage()?.setItem(CLE, '1');
  } catch {
    // Stockage refusé ou plein : l'accueil restera entier, sans plus.
  }
}

/** Réservé aux tests : oublie le repère. */
export function _oublierLAccueilVu(): void {
  try {
    stockage()?.removeItem(CLE);
  } catch {
    // Rien à oublier.
  }
}
