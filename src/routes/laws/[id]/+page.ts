import { error } from '@sveltejs/kit';
import { browser } from '$app/environment';
import { API_URL, DELAI_API_MS } from '$lib/config';
import { identifiantDepuis } from '$lib/identifiant';
import { leverIndisponible } from '$lib/panne';
import type { Law } from '$lib/types';
import type { PageLoad } from './$types';

/**
 * Fiche d'un document — la page à valeur SEO du site.
 *
 * POURQUOI UN `load`. La page chargeait dans un bloc réactif : le HTML ne
 * contenait ni le titre du document, ni sa référence, ni une ligne de son
 * contenu. Un moteur qui n'exécute pas le JavaScript n'avait rien à indexer, et
 * le lien partagé n'avait aucun aperçu. Rendue par le serveur, la fiche arrive
 * complète.
 *
 * ET LE SOFT-404. Sans `load`, `/laws/999999` répondait 200 : l'adresse existait
 * pour un moteur, un client HTTP ou un moniteur, et seul le contenu affiché
 * disait le contraire. `link-integrity.spec.ts` le documentait explicitement et
 * devait se rabattre sur la présence d'un bloc d'erreur, faute de statut fiable.
 */
export const load: PageLoad = async ({ fetch, params }) => {
  // Contrôle avant tout appel : `/laws/abc` n'a aucune raison de consommer une
  // requête, et l'API répondrait 500 à un identifiant hors de ses bornes.
  const id = identifiantDepuis(params.id);
  if (id === null) {
    throw error(404, 'Document introuvable');
  }

  let reponse: Response;
  try {
    reponse = await fetch(`${API_URL}/laws/${id}`, { signal: AbortSignal.timeout(DELAI_API_MS) });
  } catch (e) {
    return indisponible(id, e);
  }

  if (reponse.status === 404) {
    throw error(404, 'Document introuvable');
  }
  if (!reponse.ok) {
    return indisponible(id, reponse);
  }

  // Dans le try : un 200 qui n'est pas du JSON (un proxy qui répond à la place
  // de l'API) est une panne de l'API, pas une erreur de la page.
  try {
    const law: Law = await reponse.json();
    return { law, erreur: '' };
  } catch (e) {
    return indisponible(id, e);
  }
};

/**
 * API éteinte, en erreur ou hors délai. Au rendu serveur (premier affichage, et
 * tout ce que lit un robot), un 503 ($lib/panne). Dans le navigateur
 * (navigation d'une page à l'autre), la page garde son message et son bouton de
 * reprise.
 */
function indisponible(id: number, cause: unknown): { law: null; erreur: string } {
  if (!browser) leverIndisponible(`/laws/${id}`, cause);
  return { law: null, erreur: 'laws.errorLoad' };
}
