import { dev } from '$app/environment';
import { injectAnalytics } from '@vercel/analytics/sveltekit';
import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';

injectSpeedInsights();
injectAnalytics({ mode: dev ? 'development' : 'production' });

// Rendu serveur par defaut : les pages publiques arrivent remplies. Les sous-
// arbres prives le coupent eux-memes (admin/+layout.ts, (main)/chat/+page.ts).
// Rien n'est prerendu : tout vient de l'API, au moment de la requete.
export const prerender = false;
