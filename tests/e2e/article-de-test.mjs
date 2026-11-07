/**
 * Un article publié, servi par la doublure de l'API (doublure-de-l-api.mjs).
 *
 * POURQUOI. Les articles statiques sont retirés et une base de test n'a aucun
 * article publiable : avec E2E_EXIGER_BACKEND=1, les treize tests de
 * /blog/[slug] échouaient, et sans lui ils se seraient sautés en silence. La
 * page se charge sur le serveur, que `page.route` ne voit pas : c'est donc la
 * doublure qui répond, avec la forme publique de `GET /blog/{slug}` (ni état
 * ni contrôle : avenant du tour 7), et une citation vérifiée, sans quoi
 * `servableAuPublic` répondrait 404.
 */
export const SLUG_DE_L_ARTICLE_DE_TEST = 'preavis-de-licenciement-article-de-test';

export const ARTICLE_DE_TEST = {
  id: 9001,
  slug: SLUG_DE_L_ARTICLE_DE_TEST,
  title: 'Licenciement : ce que le préavis garantit au salarié',
  category: 'Travail',
  published_at: '2026-11-02T08:00:00Z',
  is_published: true,
  reading_time: '4 min',
  context:
    'Le contrat de travail à durée indéterminée peut cesser à l’initiative de l’une des parties. Le Code du travail encadre cette rupture par un préavis écrit et motivé.',
  suggested_question: 'Quel préavis en cas de licenciement ?',
  tags: ['travail', 'licenciement'],
  bot_analysis: {
    summary: 'La rupture du contrat à durée indéterminée suppose un préavis notifié par écrit.',
    key_points: ['Le préavis est notifié par écrit.', 'Le motif de la rupture y est indiqué.'],
    citizen_impact: 'Un salarié peut demander que le motif de son licenciement soit écrit.',
    citations: [
      {
        law_id: 2274,
        article_number: '34',
        reference: 'Loi n° 92/007 du 14 août 1992 portant Code du travail',
        explication: 'Le contrat à durée indéterminée peut cesser par la volonté de l’une des parties.',
        excerpt: 'Le contrat de travail à durée indéterminée peut toujours cesser par la volonté de l’employeur ou du travailleur.',
        url: '/laws/2274?article=34',
        verifie: true,
      },
    ],
  },
};
