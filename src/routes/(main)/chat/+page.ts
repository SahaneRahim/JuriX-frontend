// La mise en page du chat depend du jeton et du profil (localStorage) : rendue
// au serveur, elle arriverait en version invitee puis basculerait a
// l'hydratation. Page en noindex, sans valeur pour le referencement : rendue
// dans le navigateur ; le noindex vient de src/hooks.server.ts.
export const ssr = false;
