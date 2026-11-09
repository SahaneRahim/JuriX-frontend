import type { Config } from '@sveltejs/adapter-vercel';
import { API_URL, DELAI_API_MS } from '$lib/config';
import { leverIndisponible } from '$lib/panne';
import type { ContactInstitution } from '$lib/types';
import type { PageServerLoad } from './$types';

/**
 * L'annuaire ne change qu'au déploiement de l'API : une heure en cache (ISR),
 * comme la fiche d'un texte.
 */
export const config: Config = {
  isr: { expiration: 3600 },
};

export const load: PageServerLoad = async ({ fetch }) => {
  let reponse: Response;
  try {
    reponse = await fetch(`${API_URL}/annuaire`, { signal: AbortSignal.timeout(DELAI_API_MS) });
  } catch (e) {
    return leverIndisponible('/annuaire', e);
  }
  if (!reponse.ok) return leverIndisponible('/annuaire', reponse);
  const donnees = (await reponse.json()) as {
    themes: Record<string, string>;
    regions: Record<string, string>;
    fiches: ContactInstitution[];
  };
  return donnees;
};
