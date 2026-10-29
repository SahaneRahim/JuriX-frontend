import { error } from '@sveltejs/kit';
import type { Config } from '@sveltejs/adapter-vercel';
import { statutJuridiqueDe } from '$lib/api-publique';
import { API_URL, DELAI_API_MS } from '$lib/config';
import { identifiantDepuis } from '$lib/identifiant';
import { absenceConfirmee, leverIndisponible } from '$lib/panne';
import type { Law, StatutJuridique } from '$lib/types';
import type { PageServerLoad } from './$types';

/**
 * Le statut juridique (P1) réduit à ce que la page lit.
 *
 * `par_morceau` part VIDE : la page découpe le texte elle-même et ne connaît
 * que des numéros d'articles, qu'elle relie au statut par `par_article`
 * (src/lib/components/loi/statut.ts dit pourquoi). Le garder obligerait à
 * envoyer aussi l'identifiant de chaque morceau (`articles[].id`, 2 134 pour
 * le Code civil), dans le HTML comme dans le `__data.json` mis en cache.
 * Tout le reste sert : les changements des deux sens, dépassés compris, font
 * l'onglet « Historique ».
 *
 * `null` quand la clé manque (ancienne API), vaut null (calcul en échec côté
 * serveur) ou n'a pas la forme attendue : la page n'affiche alors que
 * « Version d'origine, non consolidée », sans date.
 */
function statutAllege(law: Law): StatutJuridique | null {
  const statut = statutJuridiqueDe(law);
  return statut ? { ...statut, par_morceau: {} } : null;
}

/**
 * Fiche mise en cache par Vercel (ISR) pendant une heure : un texte de loi ne
 * change qu'à une réingestion, et sa fiche attendait jusqu'ici l'API à chaque
 * visite (2,2 à 2,5 s avant le premier octet, mesurés depuis le Cameroun).
 *
 * AUCUN paramètre dans la clé du cache, pas même `?article=` (posé par les
 * articles trouvés par la recherche et par les citations du chat). Le `load`
 * ne le lit pas : tous les articles d'un texte ont les mêmes données. Dans la
 * clé, chaque couple (texte, article) coûtait pourtant sa propre génération,
 * page et `__data.json` compris (adapter-vercel leur donne la même clé) : un
 * appel à /laws/{id} (1,3 Mo pour le code pénal) et une écriture ISR pour un
 * corps identique. Le chemin principal vers une fiche tombait donc presque
 * toujours sur une génération : 1,0 à 1,1 s après TLS, contre 0,2 s pour la
 * version en cache (mesuré le 28/10).
 *
 * Hors de la clé, Vercel ne transmet pas le paramètre à la fonction : la
 * version en cache est toujours la fiche ouverte sur son premier article, la
 * même pour toutes les variantes, jamais celle d'un autre article. C'est le
 * navigateur qui applique `?article=` et `#art-N` (+page.svelte, dans
 * `afterNavigate`, sur l'adresse réelle, puis y fait défiler) : aussitôt en
 * navigation dans le site, qui ne demande que le `__data.json` ; juste après
 * l'hydratation pour un lien ouvert dans un nouvel onglet ou partagé, dont le
 * HTML montre d'abord le premier article. Le premier rendu du navigateur est
 * donc celui du serveur, sans article remplacé pendant l'hydratation. La
 * page réécrit ensuite l'adresse à chaque article lu (P2, routage
 * superficiel), sans nouvelle requête. La canonique ne porte de toute façon
 * aucun paramètre ($lib/seo). Les autres paramètres (`utm_*`…) n'atteignent
 * pas non plus la fonction.
 */
export const config: Config = {
  isr: { expiration: 3600 },
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

  // 404 seulement si l'API elle-même dit le document absent : un 404 est mis
  // en cache une heure, et celui de Railway (domaine du service retiré, le
  // 21/10) aurait fait disparaître chaque fiche régénérée. Tout autre 404 est
  // une panne : 503, que Vercel ne garde pas (voir $lib/panne).
  if (await absenceConfirmee(reponse)) {
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
  // lu, pour la visionneuse) : sans l'identifiant, le titre, la section et la
  // nature, les 453 articles de /laws/2236 pèsent 48 Ko de moins (3,5 Ko
  // compressés), dans le HTML comme dans le `__data.json` mis en cache.
  //
  // Le statut juridique voyage à part, allégé (`statutAllege`), et quitte
  // `law` : la page ne le lit qu'à un endroit. Les dates nouvelles
  // (`date_signature`, `annee`, `date_publication_jo`, `ajoute_le`) restent
  // dans `law`, absentes sur l'ancienne API, ce que la page sait lire.
  //
  // PANNE DE L'API : 503 au rendu comme en navigation (plus de message dans
  // la page) : mise en cache, une fiche en erreur servie en 200 resterait une
  // heure, à la place du texte. Un 503 n'est jamais gardé, Vercel continue de
  // servir la version précédente. `erreur` reste dans les données pour la
  // page, toujours vide.
  const { statut_juridique: _statut, ...sansStatut } = law;
  return {
    law: { ...sansStatut, articles: law.articles?.map(({ number, page_number }) => ({ number, page_number })) },
    statut: statutAllege(law),
    erreur: '',
  };
};
