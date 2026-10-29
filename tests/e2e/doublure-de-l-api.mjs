/**
 * Doublure de l'API côté SERVEUR, pour les tests de bout en bout.
 *
 * POURQUOI ELLE EXISTE. Depuis P8, /search est rendue par le serveur du
 * front : son `load` interroge l'API depuis Node, et `page.route`, qui ne voit
 * que les requêtes du navigateur, ne peut plus simuler la recherche. Sans
 * doublure, chaque spec qui ouvre /search?q=… aurait lancé une vraie
 * recherche hybride, donc un appel au modèle d'embeddings, sur des données
 * qui changent à chaque réingestion : les mises en page éprouvées par les
 * specs (vingt résultats aux titres les plus longs, 137 au total, références
 * sans espace) n'auraient plus été reproductibles.
 *
 * CE QU'ELLE FAIT. Le serveur de test (:4173, playwright.config.ts) lui
 * envoie TOUS ses appels à l'API (API_INTERNE, voir src/hooks.server.ts) :
 *  - une recherche (POST /api/v1/search/) dont la question a été enregistrée
 *    par un test (`simulerLaRecherche` ou `enregistrerLaRecherche`,
 *    tests/e2e/doublures.ts) reçoit la réponse enregistrée, sans rien
 *    demander au backend ;
 *  - tout le reste part TEL QUEL vers la vraie API, comme avant la doublure :
 *    les pages rendues par le serveur lisent toujours la base locale, et une
 *    recherche non enregistrée (link-integrity, accessibilité) reste une
 *    vraie recherche.
 * Le navigateur, lui, appelle toujours la vraie API directement (VITE_API_URL),
 * et les specs l'interceptent par `page.route`, comme avant.
 *
 * Un fichier .mjs, sans TypeScript : Playwright le lance avec `node` avant le
 * serveur de test (webServer), hors de son propre chargeur.
 *
 * Usage : node tests/e2e/doublure-de-l-api.mjs <port> <adresse de la vraie API>
 */

import http from 'node:http';

// 4175 par défaut, jamais 4190 : un « bad port » de la norme Fetch, que le
// `fetch` de Node refuse (voir playwright.config.ts).
const PORT = Number(process.argv[2]) || 4175;
const API_REELLE = (process.argv[3] ?? 'http://127.0.0.1:8000').replace(/\/+$/, '');

/** Question normalisée -> corps JSON de la réponse enregistrée. */
const recherches = new Map();

/** La clé d'une question : casse et blancs ne comptent pas (« Bail  commercial » = « bail commercial »). */
const cleDe = (question) => String(question ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * En-têtes propres à un saut (RFC 9110, § 7.6.1), et ceux que `fetch` réécrit :
 * il décompresse le corps (d'où ni `content-encoding` ni `accept-encoding`) et
 * recalcule la longueur.
 */
const PROPRES_AU_SAUT = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
  'content-encoding',
  'accept-encoding',
]);

function lireLeCorps(requete) {
  return new Promise((resoudre, rejeter) => {
    const morceaux = [];
    requete.on('data', (morceau) => morceaux.push(morceau));
    requete.on('end', () => resoudre(Buffer.concat(morceaux)));
    requete.on('error', rejeter);
  });
}

function repondre(reponse, statut, corps) {
  const texte = typeof corps === 'string' ? corps : JSON.stringify(corps);
  reponse.writeHead(statut, {
    'content-type': 'application/json',
    'content-length': String(Buffer.byteLength(texte)),
  });
  reponse.end(texte);
}

/** Relaie la requête vers la vraie API, et sa réponse telle quelle. */
async function relayer(requete, reponse, corps) {
  const entetes = {};
  for (const [nom, valeur] of Object.entries(requete.headers)) {
    if (valeur !== undefined && !PROPRES_AU_SAUT.has(nom)) {
      entetes[nom] = Array.isArray(valeur) ? valeur.join(', ') : valeur;
    }
  }
  const sansCorps = requete.method === 'GET' || requete.method === 'HEAD';
  let amont;
  try {
    amont = await fetch(`${API_REELLE}${requete.url}`, {
      method: requete.method,
      headers: entetes,
      body: sansCorps || corps.length === 0 ? undefined : corps,
      redirect: 'manual',
    });
  } catch (cause) {
    // API éteinte : 502. Les `load` y voient une panne (503 de la page),
    // comme le refus de connexion qu'ils recevaient sans doublure.
    return repondre(reponse, 502, { detail: `API injoignable depuis la doublure : ${cause?.cause?.code ?? cause}` });
  }
  const sortants = {};
  amont.headers.forEach((valeur, nom) => {
    if (!PROPRES_AU_SAUT.has(nom)) sortants[nom] = valeur;
  });
  const contenu = Buffer.from(await amont.arrayBuffer());
  sortants['content-length'] = String(contenu.length);
  reponse.writeHead(amont.status, sortants);
  reponse.end(contenu);
}

const serveur = http.createServer(async (requete, reponse) => {
  try {
    const { pathname } = new URL(requete.url ?? '/', 'http://doublure');
    const corps = await lireLeCorps(requete);

    // Sonde de démarrage (playwright.config.ts attend cette adresse).
    if (pathname === '/__doublure/etat') return repondre(reponse, 200, { recherches: recherches.size });

    // Les tests enregistrent leurs recherches ici, avant d'ouvrir la page.
    if (pathname === '/__doublure/recherches') {
      if (requete.method === 'PUT') {
        const { requetes, reponse: enregistree } = JSON.parse(corps.toString('utf8'));
        if (!Array.isArray(requetes) || typeof enregistree !== 'object' || enregistree === null) {
          return repondre(reponse, 422, { detail: 'attendu : { requetes: string[], reponse: object }' });
        }
        const texte = JSON.stringify(enregistree);
        for (const question of requetes) recherches.set(cleDe(question), texte);
        reponse.writeHead(204);
        return reponse.end();
      }
      if (requete.method === 'DELETE') {
        recherches.clear();
        reponse.writeHead(204);
        return reponse.end();
      }
      return repondre(reponse, 405, { detail: 'PUT ou DELETE' });
    }

    // Une recherche enregistrée : la réponse du test, quels que soient le
    // tri, les filtres et la page demandés (`refine`, `sort`, `offset`).
    if (requete.method === 'POST' && /^\/api\/v1\/search\/?$/.test(pathname)) {
      let question = '';
      try {
        question = JSON.parse(corps.toString('utf8') || '{}').query;
      } catch {
        // Corps illisible : la vraie API répondra 422, comme sans doublure.
      }
      const enregistree = recherches.get(cleDe(question));
      if (enregistree) return repondre(reponse, 200, enregistree);
    }

    return await relayer(requete, reponse, corps);
  } catch (erreur) {
    return repondre(reponse, 500, { detail: `doublure de l’API : ${erreur}` });
  }
});

serveur.listen(PORT, '127.0.0.1', () => {
  console.log(`[doublure] API sur http://127.0.0.1:${PORT}, relais vers ${API_REELLE}`);
});
