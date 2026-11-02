import { error } from '@sveltejs/kit';
import { API_URL, DELAI_API_MS } from '$lib/config';
import { articleDepuisLApi, getPostBySlug, servableAuPublic, type BlogPost } from '$lib/data/blog';
import { leverIndisponible } from '$lib/panne';
import type { PageServerLoad } from './$types';

/** La longueur maximale d'un slug en base (blog_posts.slug, VARCHAR(255)). */
const LONGUEUR_MAX_SLUG = 255;

/**
 * Vrai si ce 404 vient de l'API elle-même (FastAPI) : du JSON avec un
 * `detail` texte. Deux cas, tous deux une ABSENCE de l'article :
 * - « Article 'x' introuvable » : la route existe, l'article non (ou c'est
 *   un brouillon : la route publique ne sert que les articles publiés) ;
 * - « Not Found » : l'API n'a pas de route /blog. C'est la production du
 *   29/10, où le blog n'est pas encore déployé : aucun article de l'API ne
 *   peut alors exister, et un 503 sur chaque adresse inconnue serait faux.
 * Un 404 de Railway (`x-railway-fallback`, domaine du service retiré, comme le
 * 21/10) ou un corps qui n'est pas ce JSON (proxy, page HTML) est une PANNE :
 * il ne dit rien de l'article ($lib/panne).
 */
async function absenceDansLApi(reponse: Response): Promise<boolean> {
  if (reponse.headers.has('x-railway-fallback')) return false;
  if (!reponse.headers.get('content-type')?.includes('application/json')) return false;
  try {
    const detail = ((await reponse.json()) as { detail?: unknown } | null)?.detail;
    return typeof detail === 'string';
  } catch {
    return false;
  }
}

/**
 * Un article du blog : celui de l'API s'il est publié, sinon celui de la
 * rédaction de même adresse, sinon 404 ; 503 si l'API est en panne et que
 * l'adresse n'est pas celle d'un article de la rédaction.
 *
 * POURQUOI 503 ET NON 404 EN PANNE. Le repli sur les articles statiques
 * servait pour TOUTE réponse en échec : pendant une panne, un article de
 * l'API répondait « Article introuvable » (404 en 23 ms, revue du 29/10).
 * Les liens partagés (WhatsApp) disaient l'article disparu, et un moteur qui
 * reçoit un 404 peut retirer la page de son index ; un 503 dit « revenez
 * plus tard », comme les autres pages publiques ($lib/panne).
 *
 * UN BROUILLON N'EST JAMAIS SERVI. L'API du contrat ne sert que les articles
 * publiés ; celle d'origine servait aussi les brouillons et les articles
 * retirés, par leur adresse (200, indexable). Par sûreté, un article que
 * l'API dirait non publié est traité comme absent ici aussi.
 *
 * NI UN ARTICLE QUI N'EST PAS « PUBLIABLE » (décision du propriétaire du
 * 30/10). Les trois articles publiés le 26/10, avant la vérification, gardaient
 * une prose fausse sous l'encart « Références non vérifiées » : « plafonnée
 * entre 1 et 12 mois de salaire », quand l'article 39 du Code du travail dit
 * l'inverse. La route publique du contrat ne les sert plus ; si une API le
 * faisait encore, cette page répond 404 comme pour un brouillon
 * (`servableAuPublic` : état « publiable » et citations toutes vérifiées).
 *
 * Serveur, avec un délai (DELAI_API_MS), sans ISR : voir ../+page.server.ts.
 * Le slug est encodé dans l'adresse de l'API : il vient de l'URL.
 */
export const load: PageServerLoad = async ({ fetch, params }): Promise<{ post: BlogPost }> => {
  const slug = params.slug;
  const deLaRedaction = getPostBySlug(slug);
  // Pas d'appel pour une adresse qu'aucun article ne peut porter.
  if (!slug || slug.length > LONGUEUR_MAX_SLUG) {
    if (deLaRedaction) return { post: deLaRedaction };
    error(404, 'Article introuvable');
  }
  // Pour le journal : l'adresse vient de l'extérieur, encodée et bornée.
  const chemin = `/blog/${encodeURIComponent(slug).slice(0, 120)}`;

  let reponse: Response;
  try {
    reponse = await fetch(`${API_URL}/blog/${encodeURIComponent(slug)}`, {
      signal: AbortSignal.timeout(DELAI_API_MS),
    });
  } catch (e) {
    // Les articles de la rédaction restent servis pendant une panne.
    if (deLaRedaction) return { post: deLaRedaction };
    return leverIndisponible(chemin, e);
  }

  if (reponse.ok) {
    let brut: unknown;
    try {
      brut = await reponse.json();
    } catch (e) {
      if (deLaRedaction) return { post: deLaRedaction };
      return leverIndisponible(chemin, e);
    }
    const post = articleDepuisLApi(brut);
    if (post && !servableAuPublic(post)) {
      if (deLaRedaction) return { post: deLaRedaction };
      error(404, 'Article introuvable');
    }
    if (post) return { post };
    // Un 200 qui n'est pas un article : l'API répond mal, ce n'est pas une absence.
    if (deLaRedaction) return { post: deLaRedaction };
    return leverIndisponible(chemin, new Error('article illisible'));
  }

  if (deLaRedaction) return { post: deLaRedaction };
  if (reponse.status === 404 && (await absenceDansLApi(reponse))) {
    error(404, 'Article introuvable');
  }
  return leverIndisponible(chemin, reponse);
};
