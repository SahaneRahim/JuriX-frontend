/// <reference types="vite/client" />

/**
 * Centralized API routing configuration.
 */

/**
 * PIÈGE : les `load` UNIVERSELS sont soumis à la liste CORS du backend, en
 * développement comme en production.
 *
 * Pendant le rendu serveur, SvelteKit émule les règles CORS du navigateur pour
 * le `fetch` d'un `load` universel dès que l'URL n'est pas de la même origine
 * que la page. En développement, `JuriX-backend-main/app/main.py` n'autorise
 * que `localhost:5173`, `localhost:4173` et `127.0.0.1:5173` : lancé sur un
 * AUTRE port, le serveur rend des pages silencieusement dégradées (« backend
 * indisponible ») alors que le backend répond à un `curl`.
 *
 * En production, l'API est sur le MÊME domaine que les pages : ORIGIN (serveur
 * Node) et VITE_API_URL doivent valoir exactement https://<domaine>, sinon
 * les `load` universels échouent : l'accueil et les fiches tombent en 503. Les
 * adresses vivent dans $lib/config, sans effet de bord.
 */
export { API_BASE_URL, API_URL, WS_BASE_URL, WS_URL } from '$lib/config';
import { API_URL, WS_URL } from '$lib/config';

import { browser } from '$app/environment';
import { get } from 'svelte/store';
import { goto } from '$app/navigation';
import { authStore } from '$lib/stores/auth';

/**
 * En-têtes d'authentification pour les appels protégés.
 *
 * Aucun appel du front n'envoyait d'en-tête Authorization : le store auth
 * existait mais n'était lu par personne. Depuis que les endpoints
 * d'administration exigent un jeton, ils répondraient tous 401.
 */
export function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = get(authStore).token;
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

/**
 * URL WebSocket portant le jeton d'accès.
 *
 * Le navigateur ne permet pas de poser un en-tête `Authorization` sur un
 * WebSocket : le jeton passe donc en paramètre de requête. Cette fonction
 * existe pour que la clé de stockage ne soit pas recopiée dans les pages —
 * elle a déjà divergé une fois.
 */
export function wsUrlAuthentifiee(chemin: string): string {
  const token = get(authStore).token;
  const base = `${WS_URL}${chemin}`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

/**
 * fetch authentifié vers l'API.
 *
 * Centralise la gestion du 401 : un jeton expiré déconnecte et renvoie vers la
 * page de connexion, plutôt que de laisser chaque appelant afficher une erreur
 * incompréhensible.
 *
 * @param path chemin relatif à API_URL, commençant par « / »
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: authHeaders((init.headers as Record<string, string>) ?? {}),
  });

  if (response.status === 401 && browser) {
    authStore.logout();
    await goto('/login', { replaceState: true });
  }
  return response;
}
