import { error } from '@sveltejs/kit';
import { getPostBySlug, type BlogPost } from '$lib/data/blog';
import { API_URL } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch }) => {
  // 1. Essayer depuis l'API backend
  try {
    const res = await fetch(`${API_URL}/blog/${params.slug}`);
    if (res.ok) {
      const data = await res.json();
      const post: BlogPost = {
        slug: data.slug,
        title: data.title,
        // L'API n'a pas de champ « excerpt » : le résumé de l'analyse, à
        // défaut le début du contexte. La page n'affiche pas ce chapô quand il
        // répète l'un ou l'autre (`chapo`, +page.svelte) ; il reste la
        // description de la page. Sans contexte, il valait « undefined... ».
        excerpt: data.botAnalysis?.summary || (data.context ? `${data.context.slice(0, 160)}...` : ''),
        date: data.publishedAt,
        formattedDate: data.publishedAt ? new Date(data.publishedAt).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        }) : 'Récemment',
        readingTime: data.readingTime || '4 min',
        // Repli traduit dans l'interface anglaise, comme toute rubrique de
        // l'API (`nomRubrique` de $lib/data/blog, clé `blog.rubrique.affaires`).
        category: data.category || 'Affaires',
        // Clé de traduction (`blog.badge.*`), comme dans blog/+page.ts.
        badge: 'blog.badge.ai',
        author: {
          name: 'Rédaction Juridique & IA',
          role: 'Veille réglementaire'
        },
        context: data.context,
        botAnalysis: {
          summary: data.botAnalysis?.summary || '',
          keyPoints: data.botAnalysis?.keyPoints || [],
          citations: (data.botAnalysis?.citations || []).map((c: any) => ({
            lawId: c.law_id || c.lawId,
            articleNumber: c.article_number || c.articleNumber,
            reference: c.reference,
            title: c.title,
            excerpt: c.excerpt
          })),
          citizenImpact: data.botAnalysis?.citizenImpact || ''
        },
        suggestedChatQuestion: data.suggestedQuestion || '',
        tags: data.tags || []
      };
      return { post };
    }
  } catch (e) {
    console.warn('API blog detail fetch failed, falling back to static posts', e);
  }

  // 2. Repli vers les articles statiques
  const post = getPostBySlug(params.slug);
  if (!post) {
    error(404, 'Article introuvable');
  }
  return { post };
};
