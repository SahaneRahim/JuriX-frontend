import { API_URL } from '$lib/api';
import { BLOG_POSTS, type BlogPost } from '$lib/data/blog';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
  try {
    const res = await fetch(`${API_URL}/blog`);
    if (res.ok) {
      const dbPosts = await res.json();
      if (Array.isArray(dbPosts) && dbPosts.length > 0) {
        const mappedPosts: BlogPost[] = dbPosts.map((p: any) => ({
          slug: p.slug,
          title: p.title,
          // L'API n'a pas de champ « excerpt » : le résumé de l'analyse, à
          // défaut le début du contexte (« undefined... » sans contexte).
          excerpt: p.botAnalysis?.summary || (p.context ? `${p.context.slice(0, 160)}...` : ''),
          date: p.publishedAt,
          formattedDate: p.publishedAt ? new Date(p.publishedAt).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          }) : 'Récemment',
          readingTime: p.readingTime || '4 min',
          // Repli traduit dans l'interface anglaise, comme toute rubrique de
          // l'API (`nomRubrique` de $lib/data/blog, clé `blog.rubrique.affaires`).
          category: p.category || 'Affaires',
          author: {
            name: 'Rédaction Juridique & IA',
            role: 'Veille réglementaire'
          },
          context: p.context,
          botAnalysis: {
            summary: p.botAnalysis?.summary || '',
            keyPoints: p.botAnalysis?.keyPoints || [],
            citations: (p.botAnalysis?.citations || []).map((c: any) => ({
              lawId: c.law_id || c.lawId,
              articleNumber: c.article_number || c.articleNumber,
              reference: c.reference,
              title: c.title,
              excerpt: c.excerpt
            })),
            citizenImpact: p.botAnalysis?.citizenImpact || ''
          },
          suggestedChatQuestion: p.suggestedQuestion || '',
          tags: p.tags || [],
          // Écrit par le modèle (`POST /blog/generate`) : étiquette « Généré par
          // IA » et titre en Inter (Q5). Aucun relecteur : l'API n'en connaît pas.
          genereParIA: true
        }));

        return { posts: mappedPosts };
      }
    }
  } catch (e) {
    console.warn('API blog fetch failed in +page.ts, falling back to static posts', e);
  }

  return { posts: BLOG_POSTS };
};
