/**
 * Le profil (persona) de l'utilisateur : la question posée à l'entrée du site,
 * sa mémoire, et ce qui en découle pour le chat.
 *
 * Module feuille : il n'importe que `svelte/store` et `$lib/chat-session`, si
 * bien que `auth.ts` peut l'importer sans cycle.
 *
 * TROIS MÉMOIRES, TROIS PORTÉES.
 * - `jurix-persona` (localStorage) : le profil choisi, gardé d'une visite à
 *   l'autre.
 * - `jurix-persona-refus` (COOKIE DE SESSION, sans Max-Age) : « Ne pas
 *   répondre » vaut pour la visite. Un cookie, et non sessionStorage : ce
 *   dernier est propre à chaque onglet, et la question revenait dans chaque
 *   nouvel onglet ouvert depuis la recherche. Le cookie reste sur le domaine
 *   du front : l'API est appelée sans `credentials`.
 * - `jurix-persona-a-envoyer` (localStorage) : un changement que le compte n'a
 *   pas encore reçu (voir `$lib/persona-compte`).
 *
 * ACTIONS ET CHANGEMENTS PASSIFS. Seules les actions de l'utilisateur
 * (`choisir`, `refuser`) incrémentent `choix` et effacent une conversation
 * d'un autre profil : une conversation garde un seul profil, et la changer
 * démarre une conversation neuve. Un changement passif — la synchronisation
 * avec le compte, un autre onglet — ne change que le profil global : il ne
 * doit pas effacer une conversation rouverte depuis le panneau.
 */

import { get, writable } from 'svelte/store';
import { effacerSessionChat, lirePersonaSessionChat, lireSessionChat } from '$lib/chat-session';

/** Les profils proposés, dans l'ordre d'affichage. Accent en échappement : NFC garanti. */
export const PERSONAS = ['citoyen', 'étudiant', 'avocat', 'entrepreneur'] as const;
export type Persona = (typeof PERSONAS)[number];

/** Le profil d'une conversation sans profil choisi, tel que le serveur l'enregistre. */
export const PROFIL_GENERAL = 'general';

/** Identifiant sans accent, pour les data-testid et les clés i18n. */
export const PERSONA_SLUG: Record<Persona, string> = {
  citoyen: 'citoyen',
  'étudiant': 'etudiant',
  avocat: 'avocat',
  entrepreneur: 'entrepreneur',
};

/** Icônes Material Icons ; `general` pour le profil général. */
export const PERSONA_ICONE: Record<Persona | 'general', string> = {
  citoyen: 'person',
  'étudiant': 'school',
  avocat: 'gavel',
  entrepreneur: 'business_center',
  general: 'public',
};

/** Un persona connu, en NFC ; `null` pour tout le reste (`general` compris). */
export function normaliserPersona(valeur: unknown): Persona | null {
  if (typeof valeur !== 'string') return null;
  const nfc = valeur.normalize('NFC');
  return (PERSONAS as readonly string[]).includes(nfc) ? (nfc as Persona) : null;
}

/**
 * Le champ `persona` d'une requête de chat : omis en profil général, jamais
 * `null` (le serveur traite l'absence comme « general »).
 */
export function champPersona(persona: Persona | null): { persona?: Persona } {
  return persona ? { persona } : {};
}

/** Le persona d'une conversation mémorisée : clé absente = session d'avant les profils, en citoyen. */
export function personaDeLaSessionMemorisee(): Persona | null {
  const brut = lirePersonaSessionChat();
  return brut === null ? 'citoyen' : normaliserPersona(brut);
}

/**
 * Pages où la question n'est jamais posée : administration, connexion,
 * inscription, et pages ouvertes depuis un lien de courriel.
 */
export const ROUTES_SANS_QUESTION = [
  '/admin',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
] as const;

/** `routeId` est celui de SvelteKit (`/reset-password/[token]`, `/(main)/chat`…). */
export function estRouteSansQuestion(routeId: string | null): boolean {
  if (routeId === null) return true;
  return ROUTES_SANS_QUESTION.some((r) => routeId === r || routeId.startsWith(`${r}/`));
}

/**
 * Robots d'indexation et d'aperçu. Le site est rendu côté navigateur : un robot
 * qui exécute le JavaScript, sans profil mémorisé, verrait la boîte de
 * dialogue sur chaque page profonde — un interstitiel intrusif pour les
 * moteurs. Le contenu reste le même pour tous : ce n'est pas du cloaking.
 * Jamais `navigator.webdriver` : Playwright l'active.
 */
const MOTIF_ROBOT =
  /googlebot|google-inspectiontool|googleother|bingbot|duckduckbot|yandex(bot)?|baiduspider|applebot|chrome-lighthouse|facebookexternalhit|twitterbot|linkedinbot|slackbot|discordbot|whatsapp|telegrambot/i;

export function estUnRobot(userAgent: string | undefined | null): boolean {
  return Boolean(userAgent && MOTIF_ROBOT.test(userAgent));
}

export interface EtatPersona {
  persona: Persona | null;
  refuseCetteSession: boolean;
  /** Nombre d'actions de l'utilisateur, en mémoire seulement. */
  choix: number;
}

/** La question est-elle à poser, ici et maintenant ? */
export function questionAPoser(
  etat: EtatPersona,
  routeId: string | null,
  enErreur: boolean,
  userAgent: string | undefined | null,
): boolean {
  return (
    etat.persona === null &&
    !etat.refuseCetteSession &&
    !enErreur &&
    !estRouteSansQuestion(routeId) &&
    !estUnRobot(userAgent)
  );
}

// ---------------------------------------------------------------- stockage

const CLE_PERSONA = 'jurix-persona';
const CLE_A_ENVOYER = 'jurix-persona-a-envoyer';
const COOKIE_REFUS = 'jurix-persona-refus';

// `window` d'abord : Node 25 expose un localStorage global, propre au processus
// et partage par tous les visiteurs du serveur. Seul le navigateur stocke.
export function lirePersona(): Persona | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
  try {
    return normaliserPersona(localStorage.getItem(CLE_PERSONA));
  } catch {
    return null;
  }
}

/**
 * La mémoire a-t-elle gardé la dernière écriture ? Stockage plein ou bloqué,
 * cookies refusés : `relire` effaçait alors, au retour sur l'onglet, le choix
 * que la page tenait en mémoire, et la question se rouvrait.
 */
let personaRelisible = true;
let refusRelisible = true;

function ecrirePersona(persona: Persona | null): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    if (persona) localStorage.setItem(CLE_PERSONA, persona);
    else localStorage.removeItem(CLE_PERSONA);
    personaRelisible = lirePersona() === persona;
  } catch {
    /* stockage indisponible : le profil vaut pour la page */
    personaRelisible = false;
  }
}

export function lireRefusSession(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    return document.cookie.split(';').some((c) => c.trim() === `${COOKIE_REFUS}=1`);
  } catch {
    return false;
  }
}

function ecrireRefusSession(refus: boolean): void {
  if (typeof document === 'undefined') return;
  try {
    const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
    // Sans Max-Age ni Expires : un cookie de session, oublié à la fermeture du navigateur.
    document.cookie = refus
      ? `${COOKIE_REFUS}=1; Path=/; SameSite=Lax${secure}`
      : `${COOKIE_REFUS}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
    // Un cookie refusé ne lève rien : seule la relecture le révèle.
    refusRelisible = lireRefusSession() === refus;
  } catch {
    /* cookies bloqués : le refus vaut pour la page */
    refusRelisible = false;
  }
}

export function lireAEnvoyer(): boolean {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(CLE_A_ENVOYER) === '1';
  } catch {
    return false;
  }
}

export function ecrireAEnvoyer(enAttente: boolean): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    if (enAttente) localStorage.setItem(CLE_A_ENVOYER, '1');
    else localStorage.removeItem(CLE_A_ENVOYER);
  } catch {
    /* voir ecrirePersona */
  }
}

// ---------------------------------------------------------------- store

/** Une action de l'utilisateur efface la conversation mémorisée d'un autre profil. */
function oublierUneConversationDAutreProfil(nouveau: Persona | null): void {
  if (lireSessionChat() && personaDeLaSessionMemorisee() !== nouveau) effacerSessionChat();
}

function creerPersonaStore() {
  const etatInitial = (): EtatPersona => ({
    persona: lirePersona(),
    refuseCetteSession: lireRefusSession(),
    choix: 0,
  });
  const store = writable<EtatPersona>(etatInitial());
  const { subscribe, update, set } = store;

  return {
    subscribe,

    /** Action de l'utilisateur : ce profil, maintenant et aux visites suivantes. */
    choisir(persona: Persona): void {
      ecrirePersona(persona);
      ecrireRefusSession(false);
      oublierUneConversationDAutreProfil(persona);
      update((e) => ({ persona, refuseCetteSession: false, choix: e.choix + 1 }));
    },

    /** Action de l'utilisateur : profil général pour cette visite (« Ne pas répondre »). */
    refuser(): void {
      ecrirePersona(null);
      ecrireRefusSession(true);
      oublierUneConversationDAutreProfil(null);
      update((e) => ({ persona: null, refuseCetteSession: true, choix: e.choix + 1 }));
    },

    /** Changement passif : la valeur du compte, `null` compris. N'efface aucune conversation. */
    appliquerDepuisCompte(persona: Persona | null): void {
      if (get(store).persona === persona) return;
      ecrirePersona(persona);
      update((e) => ({ ...e, persona }));
    },

    /** Changement passif : relit la mémoire (autre onglet, retour sur la page). */
    relire(): void {
      update((e) => {
        // Une mémoire qui n'a pas gardé la dernière écriture ne fait pas foi.
        const persona = personaRelisible ? lirePersona() : e.persona;
        const refuseCetteSession = refusRelisible ? lireRefusSession() : e.refuseCetteSession;
        return e.persona === persona && e.refuseCetteSession === refuseCetteSession
          ? e
          : { ...e, persona, refuseCetteSession };
      });
    },

    /**
     * Déconnexion : le profil du navigateur est effacé (appareil partagé, une
     * profession est une donnée personnelle). Le refus de session est posé,
     * pour que la question ne s'ouvre pas à l'instant même.
     */
    oublier(): void {
      ecrirePersona(null);
      ecrireAEnvoyer(false);
      ecrireRefusSession(true);
      update((e) => ({ ...e, persona: null, refuseCetteSession: true }));
    },

    /** Réservé aux tests : relit la mémoire et remet `choix` à zéro. */
    _reinitialiser(): void {
      personaRelisible = true;
      refusRelisible = true;
      set(etatInitial());
    },
  };
}

export const personaStore = creerPersonaStore();

/** Ouverture de la boîte de dialogue en mode « changement » (en-tête, chat). */
export const choixPersonaOuvert = writable(false);

/**
 * Le profil que la boîte marque « Actuel ». Depuis le chat, c'est celui de la
 * conversation affichée, qui peut différer du profil choisi (conversation
 * rouverte) : la boîte marquait l'autre, et le choisir « pour ne rien changer »
 * remplaçait la conversation. `undefined` : le profil choisi.
 */
export const profilDuChoix = writable<Persona | null | undefined>(undefined);

export function ouvrirChoixPersona(affiche?: Persona | null): void {
  profilDuChoix.set(affiche);
  choixPersonaOuvert.set(true);
}

export function fermerChoixPersona(): void {
  choixPersonaOuvert.set(false);
  profilDuChoix.set(undefined);
}

export function oublierPersona(): void {
  personaStore.oublier();
}

// Un autre onglet a changé le profil, ou la page revient au premier plan :
// changement passif, la conversation affichée n'est pas touchée.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === CLE_PERSONA || e.key === null) personaStore.relire();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') personaStore.relire();
  });
}
