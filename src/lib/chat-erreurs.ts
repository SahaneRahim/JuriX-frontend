/**
 * La clé du message affiché pour une réponse HTTP en erreur du chat.
 *
 * 422 : le serveur a refusé la requête. Si le profil en est la cause (valeur
 * inconnue, par exemple une forme NFD d'« étudiant »), le dire ; sinon un
 * message de requête invalide. Avant, tout 422 s'affichait en « erreur
 * serveur », ce qui accusait le serveur d'un refus légitime.
 */
export function cleDErreurHttp(statut: number, corps: unknown): string {
  if (statut === 503) return 'chat.errorOverloaded';
  if (statut === 429) return 'chat.errorQuota';
  if (statut === 404) return 'chat.errorConversationGone';
  if (statut === 422) {
    const details = (corps as { detail?: unknown } | null)?.detail;
    const surLeProfil =
      Array.isArray(details) &&
      details.some((d) => Array.isArray(d?.loc) && d.loc.includes('persona'));
    return surLeProfil ? 'chat.errorPersona' : 'chat.errorInvalid';
  }
  return 'chat.errorServer';
}
