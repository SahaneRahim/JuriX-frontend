/// <reference types="vite/client" />

/**
 * Adresses de l'API, sans aucun effet de bord : ce module est importe par les
 * `load` et par src/hooks.server.ts, qui tournent aussi sur le serveur Node.
 * src/lib/api.ts, lui, charge les stores du navigateur (authentification,
 * profil) : un `load` qui l'importait les instanciait sur le serveur, ou ils
 * deviennent des singletons partages par toutes les requetes.
 *
 * VITE_API_URL est figee au build, et identique au serveur et au navigateur :
 * les reponses des `load` sont incrustees dans la page sous leur URL, que
 * l'hydratation retrouve. En production, c'est le domaine du site (meme
 * origine que les pages) ; le serveur Node la detourne vers l'API interne
 * (src/hooks.server.ts).
 *
 * Barres finales retirees : « https://jurix.cm/ » donnait
 * « https://jurix.cm//api/v1 », un chemin que ni l'API ni la reecriture de
 * src/hooks.server.ts ne reconnaissent.
 */
const PRODUCTION_API = 'https://jurix-backend-production-3c0d.up.railway.app';

function resoudreApiUrl(): string {
  const envUrl = (typeof process !== 'undefined' && process.env?.VITE_API_URL) || import.meta.env.VITE_API_URL;
  if (envUrl && envUrl !== 'http://localhost:8000') {
    return envUrl;
  }
  if (import.meta.env.DEV) {
    return envUrl || 'http://localhost:8000';
  }
  return PRODUCTION_API;
}

export const API_BASE_URL = normaliserUrl(resoudreApiUrl(), PRODUCTION_API);
export const WS_BASE_URL = (
  (typeof process !== 'undefined' && process.env?.VITE_WS_URL) ||
  import.meta.env.VITE_WS_URL ||
  API_BASE_URL.replace(/^http/, 'ws')
).replace(/\/+$/, '');

export const API_URL = `${API_BASE_URL}/api/v1`;
export const WS_URL = `${WS_BASE_URL}/api/v1`;

/**
 * Delai accorde a l'API pour repondre a un `load`, au serveur comme dans le
 * navigateur. Au-dela, la page sert son erreur (503 au rendu serveur) au lieu
 * d'attendre une API figee : sans borne, une navigation restait suspendue
 * aussi longtemps que l'API, et le rendu serveur jusqu'a 5 min.
 */
export const DELAI_API_MS = 8000;
