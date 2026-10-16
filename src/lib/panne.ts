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
