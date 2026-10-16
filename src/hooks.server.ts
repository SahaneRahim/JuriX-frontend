import type { Handle, HandleFetch, HandleServerError } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { API_BASE_URL, DELAI_API_MS } from '$lib/config';
import inter from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url';
import icones from 'material-icons/iconfont/material-icons.woff2?url';

/**
 * Pages rendues dans le navigateur seulement (ssr = false) : le serveur n'en
 * sert qu'une coquille, sans le <meta name="robots"> que pose MetaSeo. La
 * directive noindex est donc ajoutee ici, dans l'en-tete ET dans le HTML,
 * pour les robots qui n'executent pas le JavaScript.
 */
const RENDUES_DANS_LE_NAVIGATEUR = ['/admin', '/chat'];

function rendueDansLeNavigateur(chemin: string): boolean {
  return RENDUES_DANS_LE_NAVIGATEUR.some((prefixe) => chemin === prefixe || chemin.startsWith(`${prefixe}/`));
}

/**
 * Polices prechargees : celles du premier affichage, le latin d'Inter et
 * Material Icons. Sans prechargement, le navigateur ne les decouvre qu'apres la
 * feuille de style. Mesure (Lighthouse mobile) : sans le prechargement de
 * Material Icons, dont les pictogrammes restent invisibles jusqu'a son arrivee
 * (font-display: block), le premier affichage reculait de pres d'une seconde.
 *
 * Les coquilles des pages rendues dans le navigateur ne recoivent rien de
 * SvelteKit (il ne collecte les polices que des pages rendues au serveur) : le
 * prechargement y est ajoute a la main. Sans lui, Inter (font-display:
 * optional) arrivait trop tard sur un premier /chat et manquait pour toute la
 * visite, la navigation gardant le meme document.
 */
const POLICES_A_PRECHARGER = /\/(inter-latin-wght-normal|material-icons)[^/]*\.woff2$/;
const PRECHARGEMENT_DES_COQUILLES = [inter, icones]
  .map((href) => `<link rel="preload" as="font" type="font/woff2" crossorigin href="${href}" />`)
  .join('');

export const handle: Handle = async ({ event, resolve }) => {
  const privee = rendueDansLeNavigateur(event.url.pathname);
  const reponse = await resolve(event, {
    preload: ({ type, path }) =>
      type === 'js' || type === 'css' || (type === 'font' && POLICES_A_PRECHARGER.test(path)),
    ...(privee
      ? {
          transformPageChunk: ({ html }: { html: string }) =>
            html.replace(
              '</head>',
              `<meta name="robots" content="noindex, follow" />${PRECHARGEMENT_DES_COQUILLES}</head>`
            )
        }
      : {})
  });
  if (privee) {
    reponse.headers.set('X-Robots-Tag', 'noindex, follow');
  }
  return reponse;
};

/**
 * Les `load` appellent l'API a son adresse publique (VITE_API_URL), la meme au
 * serveur et dans le navigateur : l'hydratation retrouve les reponses incrustees
 * dans la page sous cette adresse, sans second appel.
 *
 * Au serveur, cette adresse est celle du site lui-meme. Sans detour, SvelteKit
 * chercherait /api/v1 parmi ses propres routes, puis ressortirait par l'IP
 * publique de la VM pour revenir par Caddy et TLS. API_INTERNE (http://api:8000
 * sur le reseau compose) envoie la requete directement a l'API. Absent en
 * developpement et en test : rien ne change alors.
 *
 * La comparaison porte sur des URL analysees, pas sur des chaines : la Request
 * recue est deja normalisee (minuscules, port par defaut retire), alors que
 * VITE_API_URL est ecrite a la main. Une majuscule ou un « :443 » suffisait a
 * faire repartir le rendu par l'IP publique, sans aucun message.
 *
 * Les `load` portent leur propre delai ($lib/config, DELAI_API_MS) ; celui de
 * la Request reecrite est un filet pour tout autre appel : une API figee ne
 * doit jamais bloquer le rendu d'une page.
 */
const BASE_API = new URL(API_BASE_URL);
const CHEMIN_BASE_API = BASE_API.pathname.replace(/\/$/, '');

export const handleFetch: HandleFetch = async ({ request, fetch }) => {
  const interne = env.API_INTERNE;
  if (interne) {
    const url = new URL(request.url);
    if (url.origin === BASE_API.origin && url.pathname.startsWith(`${CHEMIN_BASE_API}/api/`)) {
      const cible = interne.replace(/\/$/, '') + url.pathname.slice(CHEMIN_BASE_API.length) + url.search;
      request = new Request(cible, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(DELAI_API_MS)]),
        // Indispensable des qu'un corps est transmis en flux (Node).
        ...(request.body ? { duplex: 'half' } : {})
      } as RequestInit);
    }
  }
  return fetch(request);
};

/**
 * Journal des erreurs inattendues du rendu.
 *
 * Celui de SvelteKit, par defaut, ecrit `[statut] METHODE chemin` : une erreur
 * sur /reset-password/<jeton> ou /verify-email/<jeton> mettrait le jeton dans
 * `docker compose logs front`. Le segment qui suit est donc masque. Les 404
 * (robots, liens morts) ne sont pas journalisees : elles noieraient le reste.
 * Le visiteur ne voit jamais la pile : SvelteKit ne lui montre que le message
 * generique (« Internal Error »).
 */
const CHEMIN_A_JETON = /^(\/(?:reset-password|verify-email)\/)[^/]+/;

export const handleError: HandleServerError = ({ error, event, status }) => {
  if (status === 404) return;
  const chemin = event.url.pathname.replace(CHEMIN_A_JETON, '$1***');
  console.error(`[${status}] ${event.request.method} ${chemin}`, error);
};
