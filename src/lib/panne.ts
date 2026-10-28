import { error } from '@sveltejs/kit';

/**
 * Pannes de l'API pendant le chargement d'une page.
 *
 * Au rendu serveur d'une page indexable, un 503, et non une page 200 portant
 * « Impossible de charger » : c'est le signal d'une indisponibilité passagère,
 * et un moteur garde alors la version déjà indexée. Dans le navigateur, chaque
 * page garde son message et son bouton de reprise.
 */

/** Résultat d'un appel à l'API : la valeur lue, ou la cause de l'échec. */
export type Lecture<T> = { ok: true; valeur: T } | { ok: false; cause: unknown };

/**
 * Lit la réponse JSON d'un appel à l'API sans jamais lever. Un rejet (réseau,
 * délai dépassé), un statut d'erreur ou un corps qui n'est pas du JSON (un
 * proxy qui répond à la place de l'API) donnent leur cause, pour le journal.
 */
export async function lireJson<T>(appel: PromiseSettledResult<Response>): Promise<Lecture<T>> {
  if (appel.status === 'rejected') return { ok: false, cause: appel.reason };
  if (!appel.value.ok) return { ok: false, cause: appel.value };
  try {
    return { ok: true, valeur: (await appel.value.json()) as T };
  } catch (e) {
    return { ok: false, cause: e };
  }
}

/**
 * Vrai si ce 404 est celui de NOTRE API (FastAPI) pour une ressource absente :
 * du JSON qui porte son `detail` (« Law with ID 12 not found »).
 *
 * Un autre 404 ne prouve pas l'absence, il signale une panne. Or un 404 se
 * garde en cache (ISR) : traduit en page « introuvable », il remplacerait la
 * fiche, pour tous les visiteurs et pour les moteurs, pendant toute
 * l'expiration. Trois cas sont donc des pannes :
 * - le 404 de Railway lui-même (« Application not found »), dès que le
 *   domaine du service n'est plus exposé, comme le 21/10 : il porte
 *   `x-railway-fallback`, quel que soit son corps ;
 * - un corps qui n'est pas le JSON de FastAPI (proxy, page HTML, corps vide) ;
 * - « Not Found », le 404 générique de Starlette : c'est la ROUTE qui
 *   manque (préfixe changé, autre application sur le domaine), ce qui ne dit
 *   rien du document.
 *
 * Lit le corps d'un 404, et seulement d'un 404.
 */
export async function absenceConfirmee(reponse: Response): Promise<boolean> {
  if (reponse.status !== 404 || reponse.headers.has('x-railway-fallback')) return false;
  if (!reponse.headers.get('content-type')?.includes('application/json')) return false;
  try {
    const detail = ((await reponse.json()) as { detail?: unknown } | null)?.detail;
    return typeof detail === 'string' && detail !== 'Not Found';
  } catch {
    return false;
  }
}

/**
 * Lève le 503 du rendu serveur, après en avoir écrit la cause.
 *
 * Le journal n'est pas une option : un 503 est une HttpError, que SvelteKit ne
 * transmet jamais à handleError. Sans cette ligne, une mauvaise configuration
 * (ORIGIN, API_INTERNE) qui met tout le site en 503 ne laisserait aucune trace
 * dans `docker compose logs front`.
 *
 * @param chemin la page, sans sa requête (elle vient de l'extérieur)
 */
export function leverIndisponible(chemin: string, cause: unknown): never {
  console.error(`[503] ${chemin} : API indisponible (${decrirePanne(cause)})`);
  throw error(503, 'Service momentanément indisponible');
}

/** La cause d'un échec d'appel à l'API, en une ligne. */
export function decrirePanne(cause: unknown): string {
  if (cause instanceof Response) return `HTTP ${cause.status}`;
  if (cause instanceof Error) {
    // Node rend « fetch failed » et range la vraie raison dans `cause` : un
    // code (ECONNREFUSED, ENOTFOUND), sinon un message (« bad port »).
    const sous = cause.cause as { code?: unknown; message?: unknown } | undefined;
    const detail =
      typeof sous?.code === 'string' ? sous.code : typeof sous?.message === 'string' ? sous.message : '';
    return `${cause.name}: ${cause.message}${detail ? ` (${detail})` : ''}`;
  }
  return String(cause);
}
