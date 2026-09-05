import { error } from '@sveltejs/kit';
import { API_URL } from '$lib/api';
import type { Law } from '$lib/types';
import type { PageLoad } from './$types';

/**
 * Fiche d'un document — la page à valeur SEO du site.
 *
 * CE QUE CE `load` CHANGE VRAIMENT. La page chargeait dans un bloc réactif, donc
 * le HTML expédié par le serveur ne contenait ni le titre du document, ni sa
 * référence, ni une ligne de son contenu : une coquille vide, servie par une
 * fonction serverless dont on payait déjà le coût. Un moteur qui n'exécute pas
 * le JavaScript n'avait rien à indexer, et le lien partagé n'avait aucun aperçu.
 *
 * ET LE SOFT-404. Sans `load`, `/laws/999999` répondait 200 : l'adresse existait
 * pour un moteur, un client HTTP ou un moniteur, et seul le contenu affiché
 * disait le contraire. `link-integrity.spec.ts` le documentait explicitement et
 * devait se rabattre sur la présence d'un bloc d'erreur, faute de statut fiable.
 */
export const load: PageLoad = async ({ fetch, params }) => {
  // L'API type `law_id` en entier et pose une assertion dessus : `/laws/abc`
  // produirait une 500 côté serveur là où la bonne réponse est 404. Le contrôle
  // ici évite l'appel autant que la mauvaise réponse.
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw error(404, 'Document introuvable');
  }

  let reponse: Response;
  try {
    reponse = await fetch(`${API_URL}/laws/${id}`);
  } catch {
    // Backend injoignable : la page reste, avec son message et sa reprise. Lever
    // ici transformerait un serveur éteint en 500 sur toutes les fiches.
    return { law: null, erreur: 'laws.errorLoad' };
  }

  if (reponse.status === 404) {
    throw error(404, 'Document introuvable');
  }
  if (!reponse.ok) {
    return { law: null, erreur: 'laws.errorLoad' };
  }

  const law: Law = await reponse.json();
  return { law, erreur: '' };
};
