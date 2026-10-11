/**
 * Le profil et le compte : les actions de l'utilisateur, et la synchronisation
 * avec `GET`/`PATCH /auth/me` (backend, migration 015).
 *
 * RÈGLES (décisions de l'utilisateur, README backend « Le profil du compte ») :
 * - à la connexion, un profil enregistré sur le compte l'emporte ; un compte
 *   SANS profil n'hérite pas du choix fait dans le navigateur avant la
 *   connexion — la question sera reposée à la visite suivante ;
 * - au démarrage, connecté : un envoi en attente est renvoyé, sans faire
 *   attendre la page ; sinon le compte fait foi, `null` compris (un « Profil
 *   général » choisi sur un autre appareil n'est pas annulé par celui-ci). Une
 *   réponse devenue périmée pendant l'appel (choix, autre onglet,
 *   déconnexion) est ignorée ;
 * - un changement explicite s'écrit d'abord dans le navigateur, puis sur le
 *   compte ;
 * - « Ne pas répondre » vaut pour la visite : jamais envoyé au compte.
 *
 * `fetch` direct et non `apiFetch` : celui-ci déconnecte et renvoie vers
 * /login sur un 401. Une synchronisation en arrière-plan, depuis une page
 * publique, ne doit ni déconnecter ni rediriger qui que ce soit.
 */

import { get } from 'svelte/store';
import { API_URL, authHeaders } from '$lib/api';
import { authStore } from '$lib/stores/auth';
import {
  ecrireAEnvoyer,
  lireAEnvoyer,
  normaliserPersona,
  personaStore,
  type Persona,
} from '$lib/stores/persona';

/** Au-delà, le démarrage n'attend plus le compte : le profil local reste. */
const DELAI_MS = 4000;

let numeroEnvoi = 0;

/**
 * La valeur du compte dans une réponse : un profil, `null` (aucun profil), ou
 * `undefined` quand il n'y a rien à adopter — clé absente (backend antérieur à
 * la migration 015) ou valeur inconnue. `undefined` ne détruit jamais rien.
 */
export function lireValeurDuCompte(corps: unknown): Persona | null | undefined {
  if (!corps || typeof corps !== 'object' || !('persona' in corps)) return undefined;
  const brut = (corps as { persona: unknown }).persona;
  if (brut === null) return null;
  return normaliserPersona(brut) ?? undefined;
}

async function envoyer(persona: Persona | null): Promise<void> {
  ecrireAEnvoyer(true);
  const numero = ++numeroEnvoi;
  try {
    const reponse = await fetch(`${API_URL}/auth/me`, {
      method: 'PATCH',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ persona }),
    });
    // 422 ne passera jamais : inutile de le renvoyer. Le reste (401, 404 ou 405
    // d'un backend antérieur, 5xx) garde l'envoi en attente jusqu'au prochain
    // démarrage. Seul le DERNIER envoi lève le drapeau.
    if (numero === numeroEnvoi && (reponse.ok || reponse.status === 422)) ecrireAEnvoyer(false);
  } catch {
    /* réseau : l'envoi reste en attente */
  }
}

/** Un profil choisi, ou `null` pour le profil général (« pour cette visite ») ; le compte suit. */
export async function changerPersona(persona: Persona | null): Promise<void> {
  if (persona) personaStore.choisir(persona);
  else personaStore.refuser();
  if (get(authStore).isAuthenticated) await envoyer(persona);
}

/** « Ne pas répondre » à la question d'entrée : la visite seulement, jamais le compte. */
export function refuserPourCetteSession(): void {
  personaStore.refuser();
}

/** Au démarrage de l'application. Silencieux en cas d'échec. */
export async function synchroniserPersonaAuDemarrage(): Promise<void> {
  if (!get(authStore).isAuthenticated) return;
  if (lireAEnvoyer()) {
    // Sans attendre : la question du profil attend la fin de cette fonction,
    // et un backend lent la retenait sans borne. Le profil local fait foi.
    void envoyer(get(personaStore).persona);
    return;
  }
  const { choix: choixAvant, persona: personaAvant } = get(personaStore);
  const jetonAvant = get(authStore).token;
  const controleur = new AbortController();
  const minuterie = setTimeout(() => controleur.abort(), DELAI_MS);
  try {
    const reponse = await fetch(`${API_URL}/auth/me`, { headers: authHeaders(), signal: controleur.signal });
    if (!reponse.ok) return;
    const valeur = lireValeurDuCompte(await reponse.json());
    // Réponse périmée : un choix dans cet onglet, un profil changé par un
    // autre onglet, ou une déconnexion (le profil du compte reviendrait chez
    // la personne suivante) pendant l'appel.
    const { choix, persona } = get(personaStore);
    if (
      valeur === undefined ||
      choix !== choixAvant ||
      persona !== personaAvant ||
      get(authStore).token !== jetonAvant
    ) {
      return;
    }
    personaStore.appliquerDepuisCompte(valeur);
  } catch {
    /* hors ligne ou délai dépassé : le profil local reste */
  } finally {
    clearTimeout(minuterie);
  }
}

/** À la connexion (mot de passe, inscription, Google), avec la réponse du serveur. */
export function reconcilierPersonaALaConnexion(reponse: unknown): void {
  // Un envoi en attente appartient à la session précédente, peut-être à un
  // AUTRE compte : il ne part jamais sur celui-ci.
  ecrireAEnvoyer(false);
  const valeur = lireValeurDuCompte(reponse);
  // Compte sans profil : on ne lui donne pas le choix du navigateur (décision
  // de l'utilisateur) ; la question reviendra à la visite suivante.
  if (!valeur) return;
  personaStore.appliquerDepuisCompte(valeur);
}

/** Réservé aux tests. */
export function _reinitialiserEnvois(): void {
  numeroEnvoi = 0;
}
