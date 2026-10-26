import { error } from '@sveltejs/kit';
import { getPostBySlug } from '$lib/data/blog';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
  const post = getPostBySlug(params.slug);
  if (!post) {
    error(404, 'Article introuvable');
  }
  return { post };
};
