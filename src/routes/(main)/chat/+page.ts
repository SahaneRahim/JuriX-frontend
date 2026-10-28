import type { Config } from '@sveltejs/adapter-vercel';

// Rendu serveur (b45d165) : le HTML arrive avec la page du chat au lieu d'une
// coquille vide, et l'en-tete Link precharge le code de la route, que la
// coquille ne faisait decouvrir qu'apres celui de l'application (fin de cette
// cascade a 6,9-12,1 s en 4G lente, le 22/10). Le prix : rendue sans le
// localStorage, la page arrive en version invitee, et les zones d'un compte
// (colonne des conversations) n'apparaissent qu'a l'hydratation. Le noindex
// vient de MetaSeo, et de src/hooks.server.ts pour l'en-tete.
export const ssr = true;

/**
 * Coquille mise en cache par Vercel (ISR), sans expiration : la meme pour
 * tous, puisque le serveur ne sait rien du visiteur (jeton, profil, langue et
 * theme vivent dans le localStorage), et elle n'appelle pas l'API. Elle ne
 * change donc qu'au deploiement suivant, qui vide le cache. Sans cela, chaque
 * visite passait par la fonction partagee des pages hors cache : 0,3 s apres
 * TLS, 1 a 1,7 s quand elle dormait (mesures en ligne du 28/10, /chat et
 * /about), au lieu de 0,2 s environ pour une page en cache.
 *
 * Aucun parametre dans la cle : `?q=` (question pre-remplie depuis une fiche)
 * n'atteint pas la fonction, et c'est tant mieux, la page ne le lit que dans
 * le navigateur (onMount).
 */
export const config: Config = {
  isr: { expiration: false },
};
