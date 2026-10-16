import type { RequestHandler } from './$types';

/**
 * robots.txt, rendu par le serveur : il n'existait pas, et le repli de
 * l'application rendait a sa place une page HTML, que les robots lisaient comme
 * un fichier invalide.
 *
 * Seule l'administration est fermee aux robots. Les pages en noindex (chat,
 * recherche, comptes) restent explorables : un robot doit pouvoir les lire pour
 * y trouver la directive noindex.
 */
export const GET: RequestHandler = () =>
  new Response('User-agent: *\nDisallow: /admin\n', {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600'
    }
  });
