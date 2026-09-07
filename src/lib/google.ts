/**
 * Chargement du client Google Identity Services, sans paquet npm.
 *
 * POURQUOI PAS FIREBASE. Le SDK Firebase pèse ~200 Ko et impose de tenir DEUX
 * fichiers d'utilisateurs synchronisés — celui de Firebase et la table `users`
 * du backend. Ici, une balise `<script>` suffit : Google rend un jeton
 * d'identité, le backend le vérifie, et la session qui suit est la nôtre.
 *
 * POURQUOI PAS `<svelte:head>`. Le script s'y retrouverait dans le HTML rendu
 * par le serveur, donc chargé sur des pages qui n'en ont aucun usage. Il est
 * injecté à la demande, au montage du composant.
 *
 * LA PANNE D'UN TIERS NE DOIT RIEN CASSER : sans identifiant client, ou si le
 * script ne charge pas, `chargerGis()` rend `false`, le bouton n'est pas rendu,
 * et le formulaire mot de passe reste pleinement fonctionnel.
 */

const ID_BALISE = 'gsi-client';
const SOURCE = 'https://accounts.google.com/gsi/client';

export const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

/** Promesse mise en cache : deux pages portent le bouton, un seul chargement. */
let chargement: Promise<boolean> | null = null;

export function googleDisponible(): boolean {
  return Boolean(GOOGLE_CLIENT_ID);
}

export function chargerGis(): Promise<boolean> {
  if (chargement) return chargement;

  chargement = new Promise<boolean>((resolve) => {
    if (typeof document === 'undefined' || !GOOGLE_CLIENT_ID) {
      resolve(false);
      return;
    }

    // Déjà présent (autre page, ou rechargement partiel) : ne pas réinjecter.
    if (document.getElementById(ID_BALISE)) {
      resolve(true);
      return;
    }

    const balise = document.createElement('script');
    balise.id = ID_BALISE;
    balise.src = SOURCE;
    balise.async = true;
    balise.defer = true;
    balise.onload = () => resolve(true);
    balise.onerror = () => {
      // Réseau coupé, script bloqué par une extension, domaine filtré. On
      // remet la promesse à zéro pour qu'un prochain montage puisse réessayer.
      chargement = null;
      resolve(false);
    };
    document.head.appendChild(balise);
  });

  return chargement;
}

/** Réservé aux tests : remet l'état de chargement à zéro. */
export function _reinitialiserGis(): void {
  chargement = null;
  if (typeof document !== 'undefined') {
    document.getElementById(ID_BALISE)?.remove();
  }
}
