// L'administration depend du jeton, garde dans localStorage : le serveur ne le
// voit pas. Rendue dans le navigateur, comme avant le rendu serveur ; la
// directive noindex vient de src/hooks.server.ts, la page servie n'etant
// qu'une coquille.
export const ssr = false;
