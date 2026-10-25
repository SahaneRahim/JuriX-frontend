import { error } from '@sveltejs/kit';
import type { Config } from '@sveltejs/adapter-vercel';
import { API_URL, DELAI_API_MS } from '$lib/config';
import { identifiantDepuis } from '$lib/identifiant';
import { leverIndisponible } from '$lib/panne';
import type { Law } from '$lib/types';
import type { PageServerLoad } from './$types';

/**
 * Fiche mise en cache par Vercel (ISR) pendant une heure : un texte de loi ne
 * change qu'à une réingestion, et sa fiche attendait jusqu'ici l'API à chaque
 * visite (2,2 à 2,5 s avant le premier octet, mesurés depuis le Cameroun).
 *
 * `article` dans la clé du cache, et lui seul : la page le lit
 * (`?article=`, posé par les citations du chat et les articles trouvés par la
 * recherche) et le rend dès le serveur, ouverte sur cet article et sur sa page
 * du PDF. Hors de la clé, toutes les variantes partageraient la version
 * générée la première, ouverte sur un autre article. Les autres paramètres
 * (`utm_*`…) n'atteignent pas la fonction.
 */
export const config: Config = {
  isr: { expiration: 3600, allowQuery: ['article'] },
};

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
 *
 * POURQUOI SERVEUR, ET NON UNIVERSEL. Universel, il tournait dans le navigateur
 * à chaque navigation vers une fiche : le téléphone appelait Railway lui-même
 * (2,3 à 2,6 s depuis le Cameroun). Côté serveur, la navigation lit le
 * `__data.json` de la fiche, mis en cache avec elle.
 */
export const load: PageServerLoad = async ({ fetch, params }) => {
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
    return leverIndisponible(`/laws/${id}`, e);
  }

  if (reponse.status === 404) {
    throw error(404, 'Document introuvable');
  }
  if (!reponse.ok) {
    return leverIndisponible(`/laws/${id}`, reponse);
  }

  // Dans le try : un 200 qui n'est pas du JSON (un proxy qui répond à la place
  // de l'API) est une panne de l'API, pas une erreur de la page.
  let law: Law;
  try {
    law = await reponse.json();
  } catch (e) {
    return leverIndisponible(`/laws/${id}`, e);
  }

  // Du sommaire, la page ne lit que le numéro et la page du PDF (l'article
  // demandé par `?article=`) : sans l'identifiant, le titre, la section et la
  // nature, les 453 articles de /laws/2236 pèsent 48 Ko de moins (3,5 Ko
  // compressés), dans le HTML comme dans le `__data.json` mis en cache.
  //
  // PANNE DE L'API : 503 au rendu comme en navigation (plus de message dans
  // la page) : mise en cache, une fiche en erreur servie en 200 resterait une
  // heure, à la place du texte. Un 503 n'est jamais gardé, Vercel continue de
  // servir la version précédente. `erreur` reste dans les données pour la
  // page, toujours vide.
  return {
    law: { ...law, articles: law.articles?.map(({ number, page_number }) => ({ number, page_number })) },
    erreur: '',
  };
};
