/// <reference types="vite/client" />

/**
 * Centralized API routing configuration.
 */

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
export const WS_BASE_URL = import.meta.env.VITE_WS_URL || API_BASE_URL.replace(/^http/, 'ws');

export const API_URL = `${API_BASE_URL}/api/v1`;
export const WS_URL = `${WS_BASE_URL}/api/v1`;

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
