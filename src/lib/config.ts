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

/** Supprime la barre oblique finale d'une URL. */
function normaliserUrl(url: string, _fallback: string): string {
  return url.replace(/\/+$/, '');
}

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
 * Delai accorde a l'API pour repondre a un `load`. Au-dela, la page sert son
 * 503 au lieu d'attendre une API figee : sans borne, le rendu serveur restait
 * suspendu jusqu'a 5 min.
 *
 * 8 s, et non plus 25 s. Les 25 s absorbaient un demarrage a froid de Railway
 * a CHAQUE affichage. Les pages publiques sont maintenant mises en cache par
 * Vercel (ISR, `config.isr` de leurs +page.server.ts) et leurs `load` ne
 * tournent plus que sur le serveur : l'API n'est appelee qu'a la premiere
 * generation d'une adresse et aux regenerations, faites en arriere-plan
 * pendant que l'ancienne version reste servie. Un delai long n'y gagne rien :
 * - a la premiere generation, un visiteur attend le delai ENTIER avant son
 *   503 (et son lien « Reessayer ») ;
 * - a une regeneration, Vercel garde la version en cache et reessaie 30 s
 *   apres un echec, quel que soit le delai.
 * L'API ne dort pas (essai Railway : /health stable a 0,4 s) et l'appel le
 * plus lent des pages, la liste des lois d'une categorie, prend environ 2 s :
 * 8 s laissent une marge de 4. Rester sous 10 s, la duree maximale d'une
 * fonction Vercel Hobby sans Fluid compute, garde aussi NOTRE 503 : au-dela,
 * Vercel coupe la fonction et sert sa propre erreur (504), sans lien de
 * reprise.
 */
export const DELAI_API_MS = 8_000;
