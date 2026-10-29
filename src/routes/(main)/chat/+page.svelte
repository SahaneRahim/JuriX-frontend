<script lang="ts">
  import { apiFetch } from "$lib/api";
  import {
    ecrireSessionChat,
    effacerSessionChat,
    lireSessionChat,
  } from "$lib/chat-session";
  import { piegerFocus } from "$lib/actions/pieger-focus";
  import { NAV_LINKS } from "$lib/nav";
  import {
    changerPersona,
    lectureDuCompteEnCours,
    refuserPourCetteSession,
  } from "$lib/persona-compte";
  import { authStore } from "$lib/stores/auth";
  import { annonceDansLaPalette, commandPaletteOpen } from "$lib/stores/commandPalette";
  import {
    PERSONA_ICONE,
    PERSONA_SLUG,
    annonceDuChat,
    champPersona,
    choixPersonaOuvert,
    conversationDuChatEnCours,
    normaliserPersona,
    ouvrirChoixPersona,
    personaDeLaSessionMemorisee,
    personaStore,
    questionDuProfilAPoser,
    type Persona,
  } from "$lib/stores/persona";
  import { themeStore } from "$lib/stores/theme";
  import { suggestionsDeLAccueil } from "$lib/suggestions";
  import { libelleDeSource, nomCourtDuTexte } from "$lib/sources";
  import { cleDErreurHttp } from "$lib/chat-erreurs";
  import type {
    ChiffresDuCorpus,
    CitationsDeLaReponse,
    ConversationSummary,
    ProgressionDuChat,
    SourceCitee,
    TexteConsulte,
  } from "$lib/types";
  import { afterNavigate, pushState, replaceState } from "$app/navigation";
  import { page } from "$app/stores";
  import { get } from "svelte/store";
  import { onMount, tick } from "svelte";
  import { prefersReducedMotion } from "svelte/motion";
  import { fade } from "svelte/transition";
  import { formatHeure } from "$lib/format";
  import { blocsDeReponse, type Bloc } from "$lib/texte";
  import { lireEvenements, type EvenementDeFlux } from "$lib/flux";
  // `traductions` et non `tr` : la page rend des <tr> (tableaux des réponses),
  // et un identifiant du même nom fait signaler chaque balise par Svelte.
  import { language, switchLanguage, tr as traductions } from "$lib/stores/language";
  import MetaSeo from "$lib/components/MetaSeo.svelte";
  import Icone from "$lib/components/Icone.svelte";
  import ApercuDeCitation from "$lib/components/chat/ApercuDeCitation.svelte";
  import EtatDeLaReponse from "$lib/components/chat/EtatDeLaReponse.svelte";
  import QuestionDuProfil from "$lib/components/chat/QuestionDuProfil.svelte";
  import SourcesDeLaReponse from "$lib/components/chat/SourcesDeLaReponse.svelte";
  import TexteDeReponse from "$lib/components/chat/TexteDeReponse.svelte";
  import {
    chargerLesChiffresDuCorpus,
    chiffresDejaLus,
    type CibleDApercu,
  } from "$lib/components/chat/apercus";
  import { accueilDejaVu, retenirLAccueilVu } from "$lib/components/chat/accueil";
  import { marquerLesCitations, phraseAutour, type TexteMarque } from "$lib/components/chat/citations";
  import {
    annonceDeFin,
    libelleDeLaCitation,
    libelleDeLEtape,
    phraseDuPerimetre,
  } from "$lib/components/chat/libelles";

  /** Une source de l'ancienne liste « Sources » (`sources` du dernier événement). */
  interface SourceAncienne {
    law_id: number;
    law_reference: string;
    law_title: string;
    article_number?: string | null;
    article_id?: number | null;
    excerpt: string;
    relevance_score: number;
  }

  // Chat message types
  interface ChatMessage {
    id: number;
    /**
     * `error` est distinct d'`assistant` a dessein.
     *
     * Une panne reseau produisait un message de type "assistant", donc une
     * bulle de reponse d'IA indiscernable d'une vraie. Pire, un 5xx affichait
     * « Je traite votre question. Veuillez patienter... » — une erreur serveur
     * presentee comme un succes en cours, sur une page qui n'attendait plus
     * rien.
     *
     * `profil` : la question « Qui êtes-vous ? » posée dans le fil (P5).
     * `arret` : une réponse arrêtée avant son premier mot (P4).
     */
    type: "assistant" | "user" | "error" | "profil" | "arret";
    content: string;
    suggestions?: string[];
    // Les citations renvoyees par le RAG. Elles etaient purement et simplement
    // jetees : la reponse s'affichait sans aucune source, alors que l'API en
    // fournit avec le numero d'article et son identifiant de ligne.
    sources?: SourceAncienne[];
    /**
     * Les quatre listes de la nouvelle API (P3) : citations positionnées,
     * citations introuvables, articles cités, textes consultés. ABSENTES de
     * l'ancienne API et d'une conversation rouverte (les positions ne sont
     * pas gardées en base) : la réponse s'affiche alors comme avant, avec
     * `sources`.
     */
    citations?: CitationsDeLaReponse;
    /** Réponse arrêtée par le lecteur avant sa fin : le texte reçu reste, signalé. */
    arretee?: boolean;
    /** La question à reposer après un arrêt. */
    question?: string;
    /** Question du profil : `undefined` tant qu'elle attend, puis le profil choisi (`null` : sans profil). */
    profil?: Persona | null;
    /** Accueil : les messages qui suivent le premier n'ont pas d'avatar (un seul interlocuteur parle). */
    sansAvatar?: boolean;
    timestamp: string;
  }

  // State
  let chatInput = "";
  let isTyping = false;
  /** Une question est partie et sa réponse n'est pas finie. */
  let envoiEnCours = false;
  let messagesContainer: HTMLDivElement;
  /** Le champ de saisie, pour l'ajuster à son texte (voir `ajusterHauteur`). */
  let champ: HTMLTextAreaElement;
  /** Le bouton d'envoi, qui devient « Arrêter » pendant une réponse. */
  let boutonEnvoi: HTMLButtonElement;

  // Reactive translation shorthand
  $: t = $traductions;

  /** Les messages de la conversation, sans l'accueil (dérivé plus bas). */
  let chatMessages: ChatMessage[] = [];

  /**
   * Identifiants des messages. Ils valaient `chatMessages.length + 1`, alors
   * que les messages d'une conversation rouverte gardent l'identifiant du
   * serveur : deux messages pouvaient partager une clé de `{#each}`.
   */
  let dernierId = 0;
  const nouvelId = () => ++dernierId;

  // `formatHeure` vit dans $lib/format avec les autres formats de date ; la
  // page en portait une copie locale avec sa propre table de locales.
  function getCurrentTime(): string {
    return formatHeure(new Date(), $language.current);
  }

  /** Contrainte serveur : RAGRequest.question impose min_length=5. */
  const QUESTION_MIN_LENGTH = 5;

  /** Identifiant de conversation rendu par le serveur, renvoyé au message suivant. */
  let sessionId: string | null = null;

  /**
   * Le profil de la conversation en cours : fixé au premier message, puis
   * gardé. Une conversation garde un seul profil ; changer de profil en
   * démarre une neuve. `null` : profil général.
   */
  let personaConversation: Persona | null = null;

  /** Conversation rouverte depuis le panneau : pas de message d'accueil au-dessus. */
  let conversationRestauree = false;

  /**
   * Génération de la conversation affichée, et le flux en cours. Une nouvelle
   * conversation pendant qu'une réponse arrive incrémente la génération et
   * annule le flux : sans cela, la fin de l'ancienne réponse s'écrivait dans
   * la nouvelle conversation, ou y affichait une fausse erreur réseau.
   */
  let generation = 0;
  let controleur: AbortController | null = null;

  /**
   * Chiffres du corpus (`GET /corpus`) pour le premier message de l'accueil.
   * Déjà lus si l'on revient sur /chat pendant la visite ; au serveur et à la
   * première visite, `null` jusqu'à leur arrivée : un texte générique, sans
   * nombre ni date, en attendant (ou pour de bon, sur l'ancienne API).
   */
  let chiffres: ChiffresDuCorpus | null = chiffresDejaLus();

  /**
   * L'accueil entier, en trois messages, à la première visite seulement (P4,
   * variante A : repère en localStorage, voir $lib/components/chat/accueil) ;
   * ensuite, le périmètre et les trois questions. Lu au montage : le serveur,
   * qui ne voit pas le stockage, rend l'accueil entier (page en cache, la même
   * pour tous), et chez un habitué il se réduit à l'hydratation. Fixé pour
   * toute la vue : la première question écrit le repère, mais ne retire aucun
   * message au-dessus d'elle.
   */
  let accueilEntier = true;

  // L'ORDRE DES `$:` COMPTE : en mode legacy, ils s'exécutent dans l'ordre du
  // source (voir explication-article.spec.ts). Chacun après ce qu'il lit.
  $: conversationEnCours = sessionId !== null || chatMessages.some((m) => m.type === "user");
  $: personaAffiche = conversationEnCours ? personaConversation : $personaStore.persona;
  // La boîte « Changer de profil » prévient qu'un autre profil ouvre une
  // nouvelle conversation, quand il y en a une à perdre (P4). Pas pour une
  // première question qui attend son profil (P5) : le profil choisi la fait
  // partir dans le même fil, rien n'est perdu, et l'avertissement détournait
  // du choix qu'on attendait. Dans le navigateur seulement : au serveur, ce
  // store de module serait partagé par tous les visiteurs.
  $: if (typeof window !== "undefined") {
    conversationDuChatEnCours.set(conversationEnCours && questionEnAttente === null);
  }
  /**
   * L'accueil en trois messages (P4, maquette chat-accueil-p4a) : le
   * périmètre (textes, date, ni jurisprudence ni dossier), la vérification par
   * les articles cités, les données personnelles ; puis trois questions
   * validées. DÉRIVÉ du profil, de la langue et des chiffres du corpus.
   *
   * Le deuxième message promet des articles qu'on touche pour lire le texte :
   * vrai sur la nouvelle API seulement, dont `GET /corpus` est le témoin. Sur
   * l'ancienne, il parle des sources, qui sont des liens.
   *
   * Hors de la première visite (`accueilEntier` faux), le seul premier
   * message, qui porte alors les trois questions.
   */
  $: questionsDeLAccueil = [...suggestionsDeLAccueil(personaAffiche, $language.current)];
  $: bienvenue = (
    accueilEntier
      ? [
          {
            id: 0,
            type: "assistant",
            content: phraseDuPerimetre(chiffres, $language.current, t),
            timestamp: "",
          },
          {
            id: -1,
            type: "assistant",
            content: chiffres ? t("chat.welcome.verify") : t("chat.welcome.verifyGeneric"),
            sansAvatar: true,
            timestamp: "",
          },
          {
            id: -2,
            type: "assistant",
            content: t("chat.welcome.privacy"),
            sansAvatar: true,
            suggestions: questionsDeLAccueil,
            timestamp: "",
          },
        ]
      : [
          {
            id: 0,
            type: "assistant",
            content: phraseDuPerimetre(chiffres, $language.current, t),
            suggestions: questionsDeLAccueil,
            timestamp: "",
          },
        ]
  ) as ChatMessage[];
  $: messagesAffiches = conversationRestauree ? chatMessages : [...bienvenue, ...chatMessages];
  // Le profil général a son nom court, comme les autres (« Citoyen ») : la
  // barre affichait « Profil : Profil général », le mot deux fois, à chaque
  // nouveau visiteur depuis que le profil se demande dans le fil (P5).
  $: nomDuProfil = personaAffiche
    ? t(`persona.${PERSONA_SLUG[personaAffiche]}.nom`)
    : t("persona.general.nom");

  /** Dernière question envoyée, pour que « Réessayer » ait quelque chose à renvoyer. */
  let lastQuestion = "";

  /**
   * Durée d'une transition, nulle quand le système demande moins de
   * mouvement ; même règle que le layout (main)/+layout.svelte.
   */
  const duree = (ms: number) => (prefersReducedMotion.current ? 0 : ms);

  /**
   * Blocs d'un message, avec ses citations marquées (P3), calculés une fois
   * par message. En mode legacy, chaque mise à jour de la liste redessine
   * tous les messages : sans mémoire, chaque morceau de réponse relisait le
   * markdown de toute la conversation. Les messages ne sont jamais modifiés
   * en place (toujours recopiés), donc l'objet suffit comme clé.
   *
   * Les marques sont posées dans le texte BRUT, avant le markdown : les bornes
   * des citations portent sur lui (voir $lib/components/chat/citations.ts).
   * Le gras dans la phrase (« **Réponse directe** : selon … ») est gardé en
   * marques à son tour (`gras`), et rendu par LigneCitee.
   */
  interface Rendu {
    blocs: Bloc[];
    marque: TexteMarque | null;
  }
  const rendus = new WeakMap<ChatMessage, Rendu>();
  function renduDe(message: ChatMessage): Rendu {
    let rendu = rendus.get(message);
    if (!rendu) {
      const marque = message.citations ? marquerLesCitations(message.content, message.citations) : null;
      rendu = { marque, blocs: blocsDeReponse(marque ? marque.texte : message.content, { gras: true }) };
      rendus.set(message, rendu);
    }
    return rendu;
  }

  /** Les listes « Articles cités » et « Textes consultés » sont à montrer (nouvelle API). */
  function aDesListes(message: ChatMessage): boolean {
    return Boolean(
      message.citations?.articles_cites?.length || message.citations?.textes_consultes_non_cites?.length,
    );
  }

  /**
   * Sources dépliées, par message. Sous sm, la liste est repliée par défaut :
   * trois à cinq cartes de source après chaque réponse repoussaient la
   * question suivante d'un écran entier sur un téléphone.
   */
  let sourcesDepliees: Record<number, boolean> = {};
  function basculerSources(id: number) {
    sourcesDepliees = { ...sourcesDepliees, [id]: !sourcesDepliees[id] };
  }

  // ---------------------------------------------------------------------------
  // Annonces pour les lecteurs d'écran (P4)
  //
  // Le fil n'est plus une région vivante : annoncer chaque morceau d'une
  // réponse en flux la découpait en fragments répétés. Pendant la réponse, il
  // porte aria-busy ; une seule région, hors du fil, dit les étapes, puis
  // « Réponse terminée, 3 articles cités. ».
  // ---------------------------------------------------------------------------

  let annonce = "";
  /** La région d'annonce de la feuille d'aperçu modale (voir `annoncer`). */
  let annonceDeLaFeuille = "";
  /** Celle du tiroir des conversations, sous lg (voir `annoncer`). */
  let annonceDuTiroir = "";

  /**
   * SOUS UNE BOÎTE MODALE, DANS LA BOÎTE. Hors d'une boîte aria-modal,
   * TalkBack et VoiceOver ne lisent plus rien, région de la page comprise, et
   * ce que la boîte rend inerte sort de l'arbre d'accessibilité : la fin
   * d'une réponse arrivée pendant ce temps n'était jamais dite. La région de
   * la boîte du dessus parle alors : la palette (Ctrl K), qui s'ouvre
   * par-dessus le tiroir ou la feuille, et « Changer de profil », qui
   * rendent toute la page inerte (src/routes/+layout.svelte) ; puis la
   * feuille d'aperçu, qui rend le tiroir et la conversation inertes ; puis le
   * tiroir, qui rend la conversation inerte. Une seule région parle, jamais
   * deux fois la même phrase.
   */
  type RegionDAnnonce = "page" | "palette" | "profils" | "feuille" | "tiroir";
  function regionDAnnonce(): RegionDAnnonce {
    if ($commandPaletteOpen) return "palette";
    if ($choixPersonaOuvert) return "profils";
    if (apercuModal) return "feuille";
    if (tiroirOuvert) return "tiroir";
    return "page";
  }

  function ecrireLAnnonce(region: RegionDAnnonce, texte: string) {
    if (region === "palette") annonceDansLaPalette.set(texte);
    else if (region === "profils") annonceDuChat.set(texte);
    else if (region === "feuille") annonceDeLaFeuille = texte;
    else if (region === "tiroir") annonceDuTiroir = texte;
    else annonce = texte;
  }

  function annoncer(texte: string) {
    const region = regionDAnnonce();
    // Vidée puis remplie : la même phrase deux fois de suite est annoncée
    // deux fois.
    ecrireLAnnonce(region, "");
    void tick().then(() => ecrireLAnnonce(region, texte));
  }

  /**
   * Une erreur dans le fil, annoncée par son role="alert". Sous une boîte
   * modale, l'alerte se taisait comme le reste (voir `annoncer`) : la région
   * de la boîte la dit alors ; pas sans boîte, où elle serait dite deux fois.
   */
  function ajouterUneErreur(contenu: string) {
    chatMessages = [
      ...chatMessages,
      { id: nouvelId(), type: "error", content: contenu, timestamp: getCurrentTime() },
    ];
    if (regionDAnnonce() !== "page") annoncer(contenu);
  }

  // ---------------------------------------------------------------------------
  // Étapes de la réponse (P4)
  // ---------------------------------------------------------------------------

  /** Les étapes reçues du flux pour la question en cours, une par `etape`. */
  let progressions: ProgressionDuChat[] = [];

  function noterProgression(progression: ProgressionDuChat) {
    if (!progression || typeof progression.etape !== "string") return;
    progressions = [...progressions.filter((p) => p.etape !== progression.etape), progression];
    annoncer(libelleDeLEtape(progression, t));
    void tick().then(suivre);
  }

  $: etapesAffichees = progressions.length
    ? progressions.map((p, i) => ({ libelle: libelleDeLEtape(p, t), faite: i < progressions.length - 1 }))
    : [{ libelle: t("chat.progress.waiting"), faite: false }];

  // ---------------------------------------------------------------------------
  // Panneau des conversations
  //
  // Rendu uniquement pour un compte connecté : une conversation anonyme
  // n'appartient à personne, donc aucune liste ne peut la contenir.
  //
  // Sous lg, c'est un TIROIR qui glisse de la gauche, par-dessus la
  // conversation : empilé au-dessus d'elle, il repoussait la saisie sous la
  // ligne de flottaison, et déplié, il pouvait la pousser d'un écran entier. À
  // partir de lg, c'est une colonne de la page, toujours visible.
  // ---------------------------------------------------------------------------

  let conversations: ConversationSummary[] = [];
  let conversationsEnCours = false;
  let conversationsErreur = "";
  let panneauOuvert = false;
  let panneau: HTMLElement;

  /**
   * Écran d'au moins 1 024 px (`lg`), où les conversations sont une colonne et
   * non un tiroir. Lu dès l'initialisation dans le navigateur, donc juste à
   * l'hydratation. Faux au serveur, sans conséquence : il rend la version
   * invitée, sans panneau des conversations (voir +page.ts).
   */
  const REQUETE_ECRAN_LARGE = "(min-width: 1024px)";
  let ecranLarge =
    typeof window !== "undefined" && window.matchMedia(REQUETE_ECRAN_LARGE).matches;
  /**
   * Écran d'au moins 1 280 px (`xl`). L'aperçu d'une citation y tient en
   * panneau à côté de la colonne des conversations : à 1 024 px, conversations
   * (288 px), conversation et panneau (360 px) ne laissaient que 260 px à la
   * réponse. Entre les deux, pour un compte, l'aperçu reste une feuille.
   */
  const REQUETE_ECRAN_TRES_LARGE = "(min-width: 1280px)";
  let ecranTresLarge =
    typeof window !== "undefined" && window.matchMedia(REQUETE_ECRAN_TRES_LARGE).matches;

  $: tiroirOuvert = panneauOuvert && !ecranLarge;
  // Le tiroir suivant part d'une région vide, comme la feuille d'aperçu
  // (`terminerApercu`) : une phrase déjà dite, présente à l'ouverture,
  // pourrait l'être une seconde fois.
  $: if (!tiroirOuvert) annonceDuTiroir = "";

  /**
   * Tiroir ou feuille d'aperçu ouverts : la page derrière ne défile plus,
   * comme sous la boîte des profils (src/routes/+layout.svelte). Le document
   * du chat ne défile pas, mais le rebond d'iOS et l'enchaînement du
   * défilement de la liste vers lui, si.
   */
  let debordementAvant: string | null = null;
  function bloquerLeDefilement(bloquer: boolean) {
    if (typeof document === "undefined") return;
    if (bloquer && debordementAvant === null) {
      debordementAvant = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    } else if (!bloquer && debordementAvant !== null) {
      document.body.style.overflow = debordementAvant;
      debordementAvant = null;
    }
  }

  /**
   * `piegerFocus`, mais seulement tant que le panneau est un tiroir ouvert : à
   * partir de lg, le même <aside> est une colonne de la page, que la
   * tabulation doit pouvoir quitter. Posé après la mise à jour du DOM : tant
   * que le tiroir porte encore `invisible`, focus() n'aurait aucun effet. À la
   * fermeture, `piegerFocus` rend le focus au bouton qui a ouvert le tiroir.
   *
   * Ce bouton est dans la conversation, inerte sous le tiroir, et Svelte ne
   * lève cette inertie qu'APRÈS avoir mis à jour cette action : le focus
   * rendu par `piegerFocus` est alors refusé, et retombait sur <body>. Il est
   * rendu une passe plus tard s'il s'est perdu (sur <body>, ou resté dans le
   * tiroir refermé), au bouton noté à l'ouverture, avant que la
   * conversation ne devienne inerte.
   */
  function piegeSiTiroir(noeud: HTMLElement, actif: boolean) {
    let piege: ReturnType<typeof piegerFocus> | null = null;
    let voulu = false;
    let ouvreur: HTMLElement | null = null;
    const appliquer = (oui: boolean) => {
      voulu = oui;
      if (!oui) {
        piege?.destroy();
        piege = null;
        const cible = ouvreur;
        ouvreur = null;
        void tick().then(() => {
          const focalise = document.activeElement;
          const perdu = !focalise || focalise === document.body || noeud.contains(focalise);
          if (perdu && cible?.isConnected) cible.focus();
        });
        return;
      }
      const focalise = document.activeElement;
      ouvreur = focalise instanceof HTMLElement && focalise !== document.body ? focalise : null;
      void tick().then(() => {
        if (voulu && !piege) {
          piege = piegerFocus(noeud, {
            initial: '[data-testid="conversation-item"][aria-current="true"]',
          });
        }
      });
    };
    appliquer(actif);
    return { update: appliquer, destroy: () => appliquer(false) };
  }

  /**
   * Menu de navigation du site, sous lg : l'en-tête du site n'est rendu qu'à
   * partir de lg sur cette page, la barre compacte le remplace.
   */
  let menuOuvert = false;
  let boutonMenu: HTMLButtonElement;

  // Comme le menu de l'en-tête : une navigation referme ce qui était ouvert.
  afterNavigate(() => {
    menuOuvert = false;
    panneauOuvert = false;
  });

  // ---------------------------------------------------------------------------
  // Aperçu d'une citation (P3)
  //
  // Une feuille modale en bas d'écran, ou un panneau à droite à partir de lg
  // (xl pour un compte, voir REQUETE_ECRAN_TRES_LARGE). Jamais deux aperçus :
  // une autre citation remplace le contenu.
  //
  // RETOUR SYSTÈME. L'ouverture ajoute une entrée d'historique sans changer
  // d'adresse (routage « shallow » de SvelteKit) : le retour d'Android, ou du
  // navigateur, referme l'aperçu au lieu de quitter le chat. « Fermer » et
  // Échap reviennent en arrière pour consommer cette entrée. Une autre citation
  // remplace l'entrée au lieu d'en empiler une.
  // ---------------------------------------------------------------------------

  let cibleApercu: CibleDApercu | null = null;
  /** Ce qui l'a ouvert, pour le mettre en évidence dans le fil. */
  let sourceApercu: { idMessage: number; genre: "citation" | "article"; index: number } | null = null;
  /** L'élément qui reprendra le focus à la fermeture. */
  let declencheurApercu: HTMLElement | null = null;
  /** L'entrée d'historique a été ajoutée, puis vue dans l'état de la page. */
  let apercuDansLHistorique = false;
  let apercuVuDansLHistorique = false;
  let numeroDApercu = 0;
  /**
   * Préfixe des clés d'aperçu, propre à cette vue du chat. Le compteur seul
   * repartait de « 1 » à chaque montage, alors que l'historique garde l'état
   * des entrées d'une vue précédente : chat quitté aperçu ouvert puis
   * retrouvé par le retour, ou rechargé (F5). Revenu sur une telle entrée,
   * « Fermer » y lisait la clé de l'aperçu neuf et le croyait encore là : il
   * fallait deux appuis, ou deux retours.
   */
  const vueDesApercus = Math.random().toString(36).slice(2, 10);

  $: apercuEnPanneau = ecranLarge && (!$authStore.isAuthenticated || ecranTresLarge);
  $: apercuModal = cibleApercu !== null && !apercuEnPanneau;
  $: avecPanneau = cibleApercu !== null && apercuEnPanneau;
  $: bloquerLeDefilement(tiroirOuvert || apercuModal);

  function ouvrirApercu(
    cible: Omit<CibleDApercu, "cle">,
    source: { idMessage: number; genre: "citation" | "article"; index: number },
    declencheur: HTMLElement | null,
  ) {
    const remplace = cibleApercu !== null;
    numeroDApercu += 1;
    const cle = `${vueDesApercus}-${numeroDApercu}`;
    cibleApercu = { ...cible, cle };
    sourceApercu = source;
    declencheurApercu = declencheur ?? declencheurApercu;
    apercuVuDansLHistorique = false;
    // Une variable et non un littéral : `App.PageState` n'est pas déclaré
    // dans ce dépôt, et un littéral y serait refusé pour ses champs en trop.
    const etat = { apercuCitation: cle };
    try {
      if (remplace && apercuDansLHistorique) {
        replaceState("", etat);
      } else {
        pushState("", etat);
        apercuDansLHistorique = true;
      }
    } catch {
      // Routeur indisponible : l'aperçu s'ouvre quand même, sans retour système.
      apercuDansLHistorique = false;
    }
  }

  function fermerApercu() {
    if (!cibleApercu) return;
    // Consommer l'entrée d'historique : `suivreLHistorique` referme ensuite.
    if (apercuDansLHistorique && apercuVuDansLHistorique) {
      history.back();
      return;
    }
    terminerApercu();
  }

  function terminerApercu() {
    const declencheur = declencheurApercu;
    cibleApercu = null;
    sourceApercu = null;
    declencheurApercu = null;
    apercuDansLHistorique = false;
    apercuVuDansLHistorique = false;
    // La feuille suivante part d'une région vide : une phrase déjà dite,
    // présente à l'ouverture, pourrait l'être une seconde fois.
    annonceDeLaFeuille = "";
    // Le focus revient à la citation qui a ouvert l'aperçu, s'il était dans
    // l'aperçu (retombé au <body> avec lui) ; pas s'il est déjà ailleurs.
    void tick().then(() => {
      const actif = document.activeElement;
      if (declencheur?.isConnected && (!actif || actif === document.body)) declencheur.focus();
    });
  }

  /** Retour système (ou `history.back()` de `fermerApercu`) : l'entrée de l'aperçu a disparu. */
  function suivreLHistorique(cle: string | undefined) {
    if (!cibleApercu || !apercuDansLHistorique) return;
    if (cle === cibleApercu.cle) apercuVuDansLHistorique = true;
    else if (apercuVuDansLHistorique) terminerApercu();
  }
  $: suivreLHistorique(($page.state as { apercuCitation?: string } | undefined)?.apercuCitation);

  /** Une citation dans la phrase : son aperçu, avec la phrase qui la porte. */
  function ouvrirLaCitation(message: ChatMessage, index: number, declencheur: HTMLElement) {
    const citation = renduDe(message).marque?.citations[index];
    if (!citation) return;
    ouvrirApercu(
      {
        lawId: citation.law_id,
        numero: citation.article,
        articleId: citation.article_id,
        libelle: libelleDeLaCitation(citation.article, citation.titre, citation.reference, t),
        titre: citation.titre,
        statut: citation.statut ?? null,
        phrases: [phraseAutour(message.content, citation.debut, citation.fin)],
      },
      { idMessage: message.id, genre: "citation", index },
      declencheur,
    );
  }

  /** Un article de la liste « Articles cités » : les phrases de la réponse qui le citent. */
  function ouvrirLArticleCite(message: ChatMessage, index: number, declencheur: HTMLElement) {
    const article = message.citations?.articles_cites?.[index];
    if (!article) return;
    const citantes = (renduDe(message).marque?.citations ?? []).filter(
      (c) =>
        c.law_id === article.law_id &&
        ((article.article_id != null && c.article_id === article.article_id) ||
          (article.article_number != null && c.article === article.article_number)),
    );
    ouvrirApercu(
      {
        lawId: article.law_id,
        numero: article.article_number,
        articleId: article.article_id,
        libelle: libelleDeLaCitation(article.article_number, article.law_title, article.law_reference, t),
        titre: article.law_title,
        statut: article.statut ?? null,
        phrases: citantes.map((c) => phraseAutour(message.content, c.debut, c.fin)),
      },
      { idMessage: message.id, genre: "article", index },
      declencheur,
    );
  }

  // Échap ferme l'aperçu, sinon le menu, sinon le tiroir. La boîte des
  // profils, ouverte par-dessus, intercepte Échap avant nous (écoute en
  // capture) : un seul Échap ne ferme jamais deux choses.
  function surTouche(event: KeyboardEvent) {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    if (cibleApercu) {
      event.preventDefault();
      fermerApercu();
    } else if (menuOuvert) {
      menuOuvert = false;
      boutonMenu?.focus();
    } else if (panneauOuvert) {
      panneauOuvert = false;
    }
  }

  async function chargerConversations() {
    if (!$authStore.isAuthenticated) {
      conversations = [];
      return;
    }
    // « Chargement… » remplace la liste le temps de la requête : la ligne ou
    // « Réessayer » qui avait le focus disparaissait, et il retombait sur
    // <body>, hors du tiroir et de son piège. Noté avant, il revient ensuite
    // à la même conversation, sinon à la première, sinon à « Réessayer » ou
    // à « Nouvelle conversation », comme après une suppression.
    const liste = panneau?.querySelector("#liste-conversations");
    const actif = document.activeElement;
    const focusDansLaListe = Boolean(actif && liste?.contains(actif));
    const rang = focusDansLaListe
      ? Array.from(liste?.querySelectorAll("li") ?? []).findIndex((li) => li.contains(actif))
      : -1;
    const sessionDuFocus = rang >= 0 ? conversations[rang]?.session_id : undefined;
    conversationsEnCours = true;
    conversationsErreur = "";
    try {
      const reponse = await apiFetch("/rag/conversations");
      if (reponse.ok) conversations = await reponse.json();
      else conversationsErreur = t("chat.conversationsError");
    } catch {
      conversationsErreur = t("chat.conversationsError");
    } finally {
      conversationsEnCours = false;
    }
    if (!focusDansLaListe) return;
    await tick();
    // Un focus posé ailleurs entre-temps (Tab) garde sa place.
    const focalise = document.activeElement;
    if (!panneau || (focalise && focalise !== document.body)) return;
    const lignes = panneau.querySelectorAll<HTMLElement>('[data-testid="conversation-item"]');
    const meme = conversations.findIndex((c) => c.session_id === sessionDuFocus);
    (
      lignes[Math.max(meme, 0)] ??
      panneau.querySelector<HTMLElement>('[data-testid="conversations-retry"]') ??
      panneau.querySelector<HTMLElement>('[data-testid="chat-new"]')
    )?.focus();
  }

  async function ouvrirConversation(conversation: ConversationSummary) {
    const reponse = await apiFetch(`/rag/conversations/${conversation.session_id}`);
    if (!reponse.ok) {
      // Supprimée ailleurs, ou plus accessible. Retirer la ligne plutôt que de
      // laisser cliquer sur un fantôme.
      conversations = conversations.filter(
        (c) => c.session_id !== conversation.session_id,
      );
      conversationsErreur = t("chat.conversationsError");
      return;
    }
    const detail = await reponse.json();
    abandonnerLaReponseEnCours();
    fermerApercu();
    sessionId = detail.session_id;
    // Rouverte, la conversation continue avec SON profil (`general` donne
    // le profil général), quel que soit le profil global.
    personaConversation = normaliserPersona(detail.persona);
    conversationRestauree = true;
    ecrireSessionChat(sessionId, personaConversation);
    // Sans positions de citation (non gardées en base, contrat §9) : la
    // réponse rouverte s'affiche avec ses sources, comme sur l'ancienne API.
    chatMessages = (detail.messages ?? []).map(
      (m: { role: string; content: string; sources?: unknown[] }) => ({
        id: nouvelId(),
        type: m.role === "user" ? "user" : "assistant",
        content: m.content,
        sources: (m.sources ?? []) as ChatMessage["sources"],
        timestamp: "",
      }),
    );
    idQuestion = null;
    panneauOuvert = false;
    await scrollToBottom();
  }

  async function supprimerConversation(conversation: ConversationSummary) {
    const position = conversations.indexOf(conversation);
    const reponse = await apiFetch(`/rag/conversations/${conversation.session_id}`, {
      method: "DELETE",
    });
    // 404 compris : si elle n'existe plus, le but est atteint.
    if (!reponse.ok && reponse.status !== 404) {
      conversationsErreur = t("chat.conversationsError");
      return;
    }
    conversations = conversations.filter(
      (c) => c.session_id !== conversation.session_id,
    );
    // Le tiroir reste ouvert : on est en train de faire le tri dans la liste.
    if (sessionId === conversation.session_id) nouvelleConversation(false);

    // Le bouton pressé vient de disparaître avec sa ligne : sans relais, le
    // focus retombait sur <body>, hors du tiroir et de son piège à focus.
    await tick();
    if (panneau && document.activeElement === document.body) {
      const lignes = panneau.querySelectorAll<HTMLElement>('[data-testid="conversation-item"]');
      const suivante = lignes[Math.min(position, lignes.length - 1)];
      (suivante ?? panneau.querySelector<HTMLElement>('[data-testid="chat-new"]'))?.focus();
    }
  }

  /** Annule la réponse qui arrive peut-être encore, et l'oublie. */
  function abandonnerLaReponseEnCours() {
    generation += 1;
    controleur?.abort();
    controleur = null;
    isTyping = false;
    envoiEnCours = false;
    arretDemande = false;
    progressions = [];
    ecartDeLAttente = 0;
    // La question qui attendait son profil part avec la conversation.
    questionEnAttente = null;
    // Les morceaux reçus et pas encore affichés appartiennent à la réponse
    // abandonnée : ils ne doivent pas atterrir dans la conversation suivante.
    enAttente = "";
    idEnAttente = null;
    if (image) cancelAnimationFrame(image);
    image = 0;
  }

  function nouvelleConversation(fermerLePanneau = true) {
    abandonnerLaReponseEnCours();
    fermerApercu();
    // « Réessayer » ne doit pas reposer, sous le nouveau profil, la question
    // de la conversation quittée.
    lastQuestion = "";
    sessionId = null;
    personaConversation = null;
    conversationRestauree = false;
    chatMessages = [];
    idQuestion = null;
    effacerSessionChat();
    if (fermerLePanneau) panneauOuvert = false;
    // L'accueil se lit depuis son début, pas depuis la position où l'ancienne
    // conversation avait laissé la vue.
    void tick().then(() => {
      if (messagesContainer) messagesContainer.scrollTop = 0;
      mesurerColle();
    });
  }

  // ---------------------------------------------------------------------------
  // Défilement de la conversation
  // ---------------------------------------------------------------------------

  /**
   * Le lecteur est-il en bas de la conversation, à moins de 80 px ?
   *
   * Chaque morceau de réponse ramenait la vue tout en bas, sans condition : sur
   * téléphone, impossible de remonter lire le début d'une longue réponse
   * pendant qu'elle arrivait, la vue sautait sans cesse. La conversation ne
   * suit plus que le lecteur resté en bas ; les autres ont un bouton pour y
   * revenir.
   */
  let colle = true;
  const SEUIL_COLLE = 80;
  /** Espace laissé au-dessus de la question quand elle atteint le haut de la vue. */
  const MARGE_QUESTION = 12;
  /** La dernière question posée : sa réponse la fait monter jusqu'en haut, pas plus loin. */
  let idQuestion: number | null = null;
  /**
   * De combien l'attente a fait descendre la vue sous la butée de la question
   * (en px). La bulle d'état se lit en entière, jusqu'à la marge du bas du
   * fil ; la réponse qui la remplace part de là, sans remonter ni suivre.
   */
  let ecartDeLAttente = 0;
  /**
   * Où `suivre` a arrêté la vue, à la butée de la question, la réponse
   * continuant sous le bord (`scrollTop`, en px) ; `null` dès que la vue en
   * bouge. Le fil n'est plus en bas, mais ce n'est pas le lecteur qui l'a
   * quitté : la bande attend (voir `bandeDuDernierMessage`).
   */
  let arretALaQuestion: number | null = null;

  function mesurerColle() {
    const el = messagesContainer;
    if (el) colle = el.scrollHeight - el.scrollTop - el.clientHeight < SEUIL_COLLE;
  }

  /**
   * Le fil a défilé. Ailleurs qu'à l'arrêt sur la question, c'est le lecteur
   * qui l'a déplacé (doigt, molette, clavier, lien atteint à la tabulation).
   * L'événement que provoque `suivre` en posant la vue, lui, la trouve à
   * l'arrêt : il ne compte pas. À un pixel près, la position lue pouvant être
   * arrondie.
   */
  function surDefilement() {
    const el = messagesContainer;
    if (el && arretALaQuestion !== null && Math.abs(el.scrollTop - arretALaQuestion) > 1) {
      arretALaQuestion = null;
    }
    mesurerColle();
  }

  /**
   * Le fil n'est pas en bas d'une conversation. Jamais sur l'accueil, où il
   * n'y a pas de dernier message à rejoindre (sur un écran court, le bouton
   * s'y affichait dès l'arrivée).
   */
  $: horsDuBas = !colle && chatMessages.length > 0;
  /**
   * Le lecteur a quitté le bas d'une conversation : la bande « Aller au
   * dernier message » s'ouvre au-dessus de la saisie.
   *
   * PAS À L'ARRÊT SUR LA QUESTION. La vue s'y arrête d'elle-même quand la
   * réponse commence, et la bande s'ouvrait alors que le lecteur n'avait pas
   * bougé : à 740 × 360, ses 52 px couvraient la réponse, dont il ne restait
   * qu'une ligne sous la bulle de la question (revue du chat, 29/10). Elle
   * s'ouvre dès que le lecteur fait défiler le fil, vers le haut ou vers le
   * bas, tant que la fin reste cachée.
   */
  $: bandeDuDernierMessage = horsDuBas && arretALaQuestion === null;

  /** Tout en bas, sans condition : après un geste de l'utilisateur. */
  async function scrollToBottom() {
    await tick();
    if (!messagesContainer) return;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    colle = true;
    arretALaQuestion = null;
  }

  /**
   * Suit la conversation qui s'allonge, si le lecteur est en bas.
   *
   * Pendant une réponse, la vue descend jusqu'à ce que la question atteigne le
   * haut, puis s'arrête : la réponse se lit de haut en bas au lieu de défiler
   * sous les yeux. Un lecteur déjà descendu sous la question est suivi
   * jusqu'au bout.
   *
   * L'ATTENTE, ELLE, SE LIT EN ENTIER : tant que la bulle d'état est là, la
   * vue va tout en bas. Arrêtée à la question, elle laissait en paysage
   * (740 × 360) la bulle rognée contre le filet de la saisie, sans ses 8 px de
   * marge (capture chat-attente r1). La réponse qui remplace la bulle part de
   * l'endroit où l'attente a laissé la vue (`ecartDeLAttente`) : ni saut vers
   * le haut, ni suivi jusqu'au bout pour autant.
   *
   * La vue retenue au-dessus du bas est notée (`arretALaQuestion`), telle que
   * le navigateur l'a prise : la bande « Aller au dernier message » ne s'ouvre
   * pas pour un arrêt que le lecteur n'a pas demandé.
   */
  function suivre() {
    const el = messagesContainer;
    if (!el) return;
    if (colle) {
      const bas = el.scrollHeight - el.clientHeight;
      let cible = bas;
      const question =
        idQuestion === null
          ? null
          : el.querySelector<HTMLElement>(`[data-message-id="${idQuestion}"]`);
      if (question) {
        const haut =
          el.scrollTop +
          question.getBoundingClientRect().top -
          el.getBoundingClientRect().top -
          MARGE_QUESTION;
        if (isTyping) {
          ecartDeLAttente = Math.max(0, bas - haut);
        } else {
          // La butée ne descend jamais sous l'endroit où la vue se trouve :
          // une réponse plus courte que la bulle d'état l'a fait remonter.
          ecartDeLAttente = Math.min(ecartDeLAttente, Math.max(0, el.scrollTop - haut));
          const butee = haut + ecartDeLAttente;
          if (el.scrollTop <= butee + 1) cible = Math.min(cible, butee);
        }
      }
      if (Math.abs(cible - el.scrollTop) > 1) el.scrollTop = cible;
      arretALaQuestion = cible < bas - 1 ? el.scrollTop : null;
    }
    mesurerColle();
  }

  function allerAuDernier(event: MouseEvent) {
    const el = messagesContainer;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: prefersReducedMotion.current ? "auto" : "smooth",
    });
    // Au clavier (`detail` nul), le bouton va disparaître avec le focus :
    // celui-ci passe au champ, d'où l'on écrit la suite. Au doigt, on n'ouvre
    // pas le clavier virtuel pour autant.
    if (event.detail === 0) champ?.focus();
  }

  /**
   * Morceaux de réponse reçus et pas encore affichés. Le flux en livre souvent
   * plusieurs par image : chacun recopiait toute la conversation et relançait
   * la mise en page, de quoi saccader sur un téléphone d'entrée de gamme. Ils
   * sont regroupés, et affichés une fois par image.
   */
  let enAttente = "";
  let idEnAttente: number | null = null;
  let image = 0;

  function afficherEnAttente() {
    if (image) cancelAnimationFrame(image);
    image = 0;
    if (!enAttente || idEnAttente === null) return;
    const ajout = enAttente;
    const id = idEnAttente;
    enAttente = "";
    chatMessages = chatMessages.map((m) => (m.id === id ? { ...m, content: m.content + ajout } : m));
    void tick().then(suivre);
  }

  function planifierAffichage() {
    if (image) return;
    image = requestAnimationFrame(() => {
      image = 0;
      afficherEnAttente();
    });
  }

  // ---------------------------------------------------------------------------
  // Le profil, demandé dans le fil (P5)
  // ---------------------------------------------------------------------------

  /**
   * La première question d'une conversation, quand aucun profil n'est choisi
   * ni refusé pour la visite : elle attend la réponse à « Qui êtes-vous ? »,
   * posée juste dessous (connecté, après la lecture du compte, voir
   * `demanderLeProfil`). Une seule question à la fois : l'envoi reste fermé
   * pendant ce temps, comme pendant une réponse.
   */
  let questionEnAttente: string | null = null;

  /**
   * Le lecteur a répondu, dans le fil ou par la boîte « Changer de profil ».
   * `enregistrer` : le choix vient du fil et reste à garder (navigateur, et
   * compte s'il est connecté) ; depuis la boîte, c'est déjà fait.
   */
  function resoudreLeProfil(persona: Persona | null, enregistrer: boolean) {
    if (questionEnAttente === null) return;
    const question = questionEnAttente;
    questionEnAttente = null;
    // AVANT le changement de profil : l'abonnement au profil (onMount) y
    // reconnaît la conversation en cours et ne la remplace pas.
    personaConversation = persona;
    chatMessages = chatMessages.map((m) =>
      m.type === "profil" && m.profil === undefined ? { ...m, profil: persona } : m,
    );
    if (enregistrer) {
      if (persona) void changerPersona(persona);
      else refuserPourCetteSession();
    }
    void envoyerLaQuestion(question, true);
  }

  // ---------------------------------------------------------------------------
  // Envoi, flux et arrêt
  // ---------------------------------------------------------------------------

  /** Le lecteur a demandé l'arrêt : l'interruption du flux qui suit n'est pas une panne. */
  let arretDemande = false;
  /** La bulle de la réponse en cours, pour la marquer arrêtée. */
  let idReponseCourante: number | null = null;
  /** La session avant la question : une session neuve fait recharger la liste des conversations. */
  let sessionAvantLaQuestion: string | null = null;

  /**
   * « Arrêter » (P4) : coupe la requête. La nouvelle API arrête alors le
   * modèle et garde le texte déjà produit, suivi d'une mention d'arrêt ;
   * l'ancienne continue de son côté, mais la lecture s'arrête ici.
   */
  function arreterLaReponse() {
    if (!envoiEnCours || !controleur) return;
    arretDemande = true;
    controleur.abort();
  }

  function noterLArret(question: string) {
    afficherEnAttente();
    idEnAttente = null;
    const id = idReponseCourante;
    if (id !== null) {
      chatMessages = chatMessages.map((m) => (m.id === id ? { ...m, arretee: true, question } : m));
    } else {
      chatMessages = [
        ...chatMessages,
        { id: nouvelId(), type: "arret", content: "", question, timestamp: getCurrentTime() },
      ];
    }
    annoncer(t("chat.announce.stopped"));
    // Une réponse arrêtée n'a pas de dernier événement : la session est venue
    // avec la première étape, et la conversation existe peut-être déjà.
    if (sessionId !== sessionAvantLaQuestion) chargerConversations();
  }

  /**
   * Envoie une question au RAG.
   *
   * `question` est explicite parce que le bouton « Réessayer » n'avait aucune
   * chance de fonctionner : il rappelait cette fonction, qui commençait par
   * `if (!chatInput.trim()) return;` — or la saisie venait d'être vidée à
   * l'envoi. Le bouton ne faisait rien, jamais.
   */
  async function handleSendChatMessage(question?: string) {
    const query = (question ?? chatInput).trim();
    // Une seule question à la fois, jusqu'à la FIN de la réponse. `isTyping`
    // retombe au premier morceau : une suggestion cliquée pendant le flux
    // partait sans session_id, ouvrait une seconde conversation sur le
    // serveur et coupait le fil en deux. Même règle pendant que la question
    // attend son profil.
    if (!query || envoiEnCours || questionEnAttente !== null) return;

    // Le schéma serveur impose `min_length=5` sur `question`. Sans ce contrôle,
    // une question de quatre lettres rendait un 422 que l'écran affichait en
    // « erreur serveur » — un message qui accuse le serveur d'un refus légitime.
    if (query.length < QUESTION_MIN_LENGTH) {
      ajouterUneErreur(t("chat.errorTooShort"));
      await scrollToBottom();
      return;
    }

    // Une première question posée : aux visites suivantes, l'accueil se
    // réduira au périmètre (P4). Celui de cette vue ne bouge pas.
    retenirLAccueilVu();

    // P5 : le profil change la réponse. Sans profil choisi ni refusé, la
    // première question d'une conversation attend la réponse à « Qui
    // êtes-vous ? », posée dans le fil ; la question part dès le choix.
    const neuve = sessionId === null && !chatMessages.some((m) => m.type === "user");
    if (neuve && questionDuProfilAPoser(get(personaStore))) {
      await demanderLeProfil(query);
      return;
    }

    await envoyerLaQuestion(query, false);
  }

  /**
   * La première question attend son profil (P5) : elle s'affiche, et « Qui
   * êtes-vous ? » se pose dessous.
   *
   * PAS AVANT LA LECTURE DU COMPTE. Connecté, le profil du compte arrive au
   * démarrage (`GET /auth/me`, 4 s au plus) : posée avant, la question
   * demandait un profil que le compte avait déjà, le choix fait dans le fil
   * le remplaçait sur le compte, et « Continuer sans profil » effaçait celui
   * qui venait d'arriver. L'attente s'affiche comme celle d'une réponse. Un
   * profil venu du compte fait partir la question (abonnement au profil,
   * onMount) ; sinon elle se pose, ou non, selon l'état d'après la lecture.
   */
  async function demanderLeProfil(query: string) {
    const userMessage: ChatMessage = {
      id: nouvelId(),
      type: "user",
      content: query,
      timestamp: getCurrentTime(),
    };
    lastQuestion = query;
    questionEnAttente = query;
    chatMessages = [...chatMessages, userMessage];
    idQuestion = userMessage.id;
    chatInput = "";

    const lecture = lectureDuCompteEnCours();
    if (lecture) {
      const gen = generation;
      isTyping = true;
      await scrollToBottom();
      await lecture;
      // Abandonnée (nouvelle conversation, page quittée), ou déjà partie avec
      // un profil arrivé pendant l'attente.
      if (gen !== generation || questionEnAttente === null) return;
      // La question du profil remplace la bulle d'état : ce que l'attente a
      // noté pour la réponse (`suivre`) ne vaut pas pour elle.
      isTyping = false;
      ecartDeLAttente = 0;
      const etat = get(personaStore);
      if (!questionDuProfilAPoser(etat)) {
        resoudreLeProfil(etat.persona, false);
        return;
      }
    }

    chatMessages = [...chatMessages, { id: nouvelId(), type: "profil", content: "", timestamp: "" }];
    annoncer(t("chat.profile.announce"));
    await scrollToBottom();
  }

  /**
   * La question part. `dejaAffichee` : elle est déjà dans le fil (elle
   * attendait son profil).
   */
  async function envoyerLaQuestion(query: string, dejaAffichee: boolean) {
    lastQuestion = query;
    // Le profil de la conversation est fixé à son premier message.
    const neuve = sessionId === null && !chatMessages.some((m) => m.type === "user");
    if (neuve) personaConversation = get(personaStore).persona;
    const gen = generation;
    controleur = new AbortController();
    envoiEnCours = true;
    arretDemande = false;
    idReponseCourante = null;
    progressions = [];
    sessionAvantLaQuestion = sessionId;

    if (!dejaAffichee) {
      const userMessage: ChatMessage = {
        id: nouvelId(),
        type: "user",
        content: query,
        timestamp: getCurrentTime(),
      };
      chatMessages = [...chatMessages, userMessage];
      idQuestion = userMessage.id;
      chatInput = "";
    }
    isTyping = true;
    ecartDeLAttente = 0;

    // Sa propre question est toujours montrée, même à qui lisait plus haut.
    // Puis `suivre` note où l'attente laisse la vue : la réponse partira de là.
    await scrollToBottom();
    suivre();

    try {
      // `apiFetch` et non `fetch` : le jeton part enfin avec la question — ce
      // qui rattache la conversation au compte — et le 401 est traité au même
      // endroit que partout ailleurs dans l'application.
      // En FLUX : les premiers mots s'affichent pendant que le modèle écrit
      // la suite. `/rag/ask` ne rendait rien avant la fin, soit une dizaine
      // de secondes d'écran figé, parfois plus de trente.
      const response = await apiFetch("/rag/ask/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controleur.signal,
        body: JSON.stringify({
          question: query,
          // Le profil de la conversation, omis en profil général. Il valait
          // « citoyen » en dur : le chat ne répondait qu'aux citoyens.
          ...champPersona(personaConversation),
          language: $language.current,
          // `session_id` etait renvoye par le serveur et jete par le client :
          // chaque message ouvrait donc une conversation NEUVE, et l'historique
          // cote serveur ne pouvait jamais servir. Le renvoyer donne enfin une
          // mémoire à la conversation, et rend GET/DELETE
          // /rag/conversations/{id} atteignables.
          ...(sessionId ? { session_id: sessionId } : {}),
        }),
      });

      if (gen !== generation) return;
      if (response.ok) {
        await lireLaReponse(response, gen);
      } else {
        if (response.status === 404) {
          // Conversation supprimée, ou devenue celle d'un autre compte après
          // un changement de session. Repartir sur une neuve, sinon
          // « Réessayer » reposerait la question au même identifiant mort.
          sessionId = null;
          effacerSessionChat();
          chargerConversations();
        }
        // 503 = le fournisseur est saturé, pas une panne. Le dire, sinon
        // l'utilisateur renonce là où un second essai aboutirait.
        const corps = response.status === 422 ? await response.json().catch(() => null) : null;
        // Le corps se lit en différé : la conversation a pu changer entre-temps.
        if (gen !== generation) return;
        ajouterUneErreur(t(cleDErreurHttp(response.status, corps)));
      }
    } catch {
      // Annulé par une nouvelle conversation : rien à dire dans celle-ci.
      if (gen !== generation) return;
      // Arrêté par le lecteur : ce n'est pas une panne, le texte reçu reste.
      if (arretDemande) {
        noterLArret(query);
        return;
      }
      ajouterUneErreur(t("chat.errorNetwork"));
    } finally {
      if (gen === generation) {
        // « Arrêter » redevient « Envoyer », désactivé tant que le champ est
        // vide : le focus, laissé dessus, retombait au début de la page. Lu
        // AVANT la mise à jour qui le désactive. Il passe au champ, d'où l'on
        // écrit la suite, à la fin de toute réponse et non plus après
        // « Arrêter » seulement. Seul le clavier le donne au bouton (son
        // `mousedown` est sans effet par défaut) : le clavier d'un téléphone
        // ne s'ouvre pas pour autant.
        const focusSurLeBouton = document.activeElement === boutonEnvoi;
        isTyping = false;
        envoiEnCours = false;
        controleur = null;
        arretDemande = false;
        idReponseCourante = null;
        progressions = [];
        await tick();
        suivre();
        if (focusSurLeBouton && focusEncoreSur(boutonEnvoi)) champ?.focus();
      }
    }
  }

  /** Message d'erreur affiché pour un `error_code` du flux. */
  function messageDErreur(code?: string): string {
    return code === "quota"
      ? t("chat.errorQuota")
      : code === "overloaded"
        ? t("chat.errorOverloaded")
        : t("chat.errorServer");
  }

  /**
   * Les quatre listes de la nouvelle API, tirées du dernier événement, ou
   * `undefined` sur l'ancienne (aucune d'elles) : la réponse s'affiche alors
   * comme avant, avec `sources`. Une entrée sans identifiant de texte est
   * écartée plutôt que de faire échouer l'affichage.
   */
  function listesDuFlux(evenement: EvenementDeFlux): CitationsDeLaReponse | undefined {
    const { citations, citations_introuvables, articles_cites, textes_consultes_non_cites } = evenement;
    if (![citations, citations_introuvables, articles_cites, textes_consultes_non_cites].some(Array.isArray)) {
      return undefined;
    }
    const avecTexte = <T extends { law_id?: unknown }>(liste: T[] | undefined): T[] =>
      (Array.isArray(liste) ? liste : []).filter(
        (x) => typeof x === "object" && x !== null && typeof x.law_id === "number",
      );
    return {
      citations: avecTexte(citations),
      citations_introuvables: Array.isArray(citations_introuvables) ? citations_introuvables : [],
      articles_cites: avecTexte<SourceCitee>(articles_cites),
      textes_consultes_non_cites: avecTexte<TexteConsulte>(textes_consultes_non_cites),
    };
  }

  /**
   * Session et profil de la conversation, tels que le serveur les donne. La
   * nouvelle API les envoie dès la première étape : une réponse arrêtée n'a
   * jamais de dernier événement, et la conversation existe déjà.
   */
  function adopterLaSession(evenement: EvenementDeFlux) {
    // Le profil effectif, tel que le serveur l'a enregistré (`general` donne
    // le profil général).
    if (evenement.persona !== undefined) personaConversation = normaliserPersona(evenement.persona);
    if (evenement.session_id) {
      sessionId = evenement.session_id;
      ecrireSessionChat(sessionId, personaConversation);
    }
  }

  /**
   * Affiche la réponse au fil de l'eau.
   *
   * Avant le premier mot, les étapes du serveur (nouvelle API) remplissent la
   * ligne d'état. La bulle de l'assistant n'apparaît qu'au premier morceau de
   * texte. Le dernier événement porte les sources, les citations (nouvelle
   * API) et l'identifiant de conversation. Une panne pendant le flux arrive
   * comme un événement (le statut HTTP est déjà parti en 200) ; le texte déjà
   * reçu reste affiché, l'erreur s'ajoute dessous.
   */
  async function lireLaReponse(response: Response, gen: number) {
    let idReponse: number | null = null;
    let termine = false;

    const ajouterAuMessage = (champs: Partial<ChatMessage>) => {
      chatMessages = chatMessages.map((m) => (m.id === idReponse ? { ...m, ...champs } : m));
    };

    for await (const evenement of lireEvenements(response)) {
      if (gen !== generation) return;
      if (evenement.error) {
        // Le texte déjà reçu s'affiche en entier avant l'erreur.
        afficherEnAttente();
        ajouterUneErreur(messageDErreur(evenement.error_code));
        termine = true;
        break;
      }

      if (!evenement.done) {
        if (evenement.progression) noterProgression(evenement.progression);
        if (evenement.session_id || evenement.persona !== undefined) adopterLaSession(evenement);
      }

      if (evenement.chunk) {
        if (idReponse === null) {
          idReponse = nouvelId();
          idReponseCourante = idReponse;
          idEnAttente = idReponse;
          isTyping = false;
          chatMessages = [
            ...chatMessages,
            {
              id: idReponse,
              type: "assistant",
              content: evenement.chunk,
              sources: [],
              timestamp: getCurrentTime(),
            },
          ];
          void tick().then(suivre);
        } else {
          enAttente += evenement.chunk;
          planifierAffichage();
        }
      }

      if (evenement.done) {
        afficherEnAttente();
        termine = true;
        if (idReponse === null) {
          // Fin sans aucun texte : une réponse vide reste signalée
          idReponse = nouvelId();
          chatMessages = [
            ...chatMessages,
            {
              id: idReponse,
              type: "assistant",
              content: t("chat.emptyAnswer"),
              timestamp: getCurrentTime(),
            },
          ];
        }
        const listes = listesDuFlux(evenement);
        ajouterAuMessage({
          sources: (evenement.sources ?? []) as ChatMessage["sources"],
          ...(listes ? { citations: listes } : {}),
        });
        adopterLaSession(evenement);
        // Le titre est écrit par le serveur à la première interaction : la
        // liste n'a de nouveau à montrer qu'à ce moment-là.
        if (sessionId !== sessionAvantLaQuestion) chargerConversations();
        annoncer(annonceDeFin(listes, t));
        break;
      }
    }

    if (gen !== generation) return;
    afficherEnAttente();
    idEnAttente = null;

    // Flux interrompu avant sa fin (réseau, serveur arrêté)
    if (!termine) ajouterUneErreur(t("chat.errorNetwork"));
  }

  /**
   * Le focus est-il encore sur `element`, ou retombé au <body> ? Un bouton
   * désactivé ou retiré garde le focus ou le perd selon le navigateur : dans
   * les deux cas, rien d'autre ne l'a pris.
   */
  function focusEncoreSur(element: Element | null | undefined): boolean {
    const actif = document.activeElement;
    return actif === element || !actif || actif === document.body;
  }

  /**
   * Un envoi par un bouton que l'envoi désactive : suggestion (un clic
   * l'ENVOIE, un seul geste, surtout sur téléphone), « Reposer la question »,
   * ou le bouton d'envoi quand la question attend son profil (P5). Activé au
   * clavier, ce bouton gardait le focus, puis le navigateur le renvoyait au
   * début de la page : la tabulation suivante repartait du haut. Il passe là
   * où l'on continue, au premier profil si la question l'attend, au champ
   * sinon. Au doigt ou à la souris (`detail` non nul), rien ne bouge : donné
   * au champ, il ouvrirait le clavier d'un téléphone (voir `allerAuDernier`).
   */
  async function envoyerDepuis(event: MouseEvent, question?: string) {
    const bouton = event.currentTarget;
    const auClavier =
      event.detail === 0 && bouton instanceof HTMLButtonElement && document.activeElement === bouton;
    void handleSendChatMessage(question);
    if (!auClavier) return;
    await tick();
    if ((bouton.isConnected && !bouton.disabled) || !focusEncoreSur(bouton)) return;
    const premierProfil = messagesContainer?.querySelector<HTMLElement>(
      '[data-testid="chat-profile-question"] [role="group"] button',
    );
    (questionEnAttente !== null && premierProfil ? premierProfil : champ)?.focus();
  }

  function handleChatKeydown(event: KeyboardEvent) {
    // Entrée pendant une composition (clavier prédictif, saisie phonétique)
    // valide le mot en cours, pas la question : l'envoyer la faisait partir à
    // moitié écrite. Safari signale ce cas par le code 229, pas par
    // `isComposing`.
    if (event.isComposing || event.keyCode === 229) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendChatMessage();
    }
  }

  /**
   * Le champ grandit avec la question jusqu'à 160 px (`max-h-40`), puis
   * défile. `field-sizing: content` suffit sur Chrome et Edge récents ;
   * ailleurs, la hauteur est recalculée à chaque changement du texte, saisi ou
   * vidé à l'envoi.
   *
   * PAR UN ALIAS LOCAL (`el`), JAMAIS `champ.style.… = …`. En mode legacy,
   * Svelte compte l'écriture d'une propriété de `champ` comme une mutation
   * de `champ` : le `$:` ci-dessous, qui lit `champ`, repartait, replanifiait
   * l'ajustement, qui « mutait » de nouveau `champ`… sans fin, de micro-tâche
   * en micro-tâche. La page du chat se figeait dès son montage là où
   * `field-sizing` manque (Firefox, Safari, et jsdom, où un test l'a révélé le
   * 28/10/2026) ; les tests de bout en bout, sous Chromium seul, ne
   * pouvaient pas le voir.
   */
  const HAUTEUR_MAX_CHAMP = 160;
  const tailleNative =
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("field-sizing", "content");

  function ajusterHauteur(texte: string) {
    if (tailleNative) return;
    void tick().then(() => {
      const el = champ;
      if (!el) return;
      el.style.height = "auto";
      if (texte) el.style.height = `${Math.min(el.scrollHeight, HAUTEUR_MAX_CHAMP)}px`;
    });
  }
  $: if (champ) ajusterHauteur(chatInput);

  /**
   * Le bouton d'envoi, et « Arrêter » pendant une réponse (P4, maquette
   * chat-attente-p4a) : un seul bouton qui change, et non deux qui
   * s'échangent, pour que le focus clavier reste dessus. « Arrêter » n'est
   * jamais désactivé ; sous sm, l'icône seule, nommée par son aria-label.
   */
  const CLASSE_ENVOI =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-950 hover:bg-black text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 transition-all hover:scale-105 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600 disabled:hover:scale-100 motion-reduce:transform-none shadow-sm dark:shadow-none";
  const CLASSE_ARRET =
    "flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-zinc-950 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-black dark:bg-white dark:text-zinc-950 dark:shadow-none dark:hover:bg-zinc-200 sm:px-3.5";

  onMount(() => {
    // Reprise du fil laissé au chargement précédent : sans cette ligne, un
    // simple F5 perdait la conversation, qui restait pourtant en base.
    sessionId = lireSessionChat();
    // Une session sans profil mémorisé date d'avant les profils : citoyen.
    if (sessionId) personaConversation = personaDeLaSessionMemorisee();
    chargerConversations();

    // Habitué : une question déjà posée dans ce navigateur, ou une
    // conversation gardée d'une visite d'avant le repère. L'accueil se réduit
    // au périmètre et aux trois questions (P4).
    accueilEntier = !accueilDejaVu() && sessionId === null;

    // Les chiffres de l'accueil, lus dans le navigateur seulement : la page
    // est mise en cache par Vercel sans appeler l'API (voir +page.ts).
    if (!chiffres) {
      void chargerLesChiffresDuCorpus().then((lus) => {
        if (lus) chiffres = lus;
      });
    }

    // Un NOUVEAU choix de l'utilisateur (en-tête, boîte de dialogue) démarre
    // une conversation neuve si le profil change. Un changement passif
    // (compte, autre onglet) ne compte pas : il ne touche pas `choix`, et ne
    // doit pas effacer une conversation rouverte. Une question qui attend son
    // profil (P5) le reçoit, et part.
    let dernierChoix = get(personaStore).choix;
    const desabonner = personaStore.subscribe((etat) => {
      if (etat.choix === dernierChoix) {
        // Passif, un PROFIL répond aussi à la question qui l'attend : celui du
        // compte, lu au démarrage, ou choisi dans un autre onglet. Rien à
        // écrire, il en vient ; la question restait posée, et le choix fait
        // ensuite dans le fil remplaçait celui du compte. Un refus venu
        // d'ailleurs, non : la question est posée ici, le lecteur y répond.
        if (questionEnAttente !== null && etat.persona !== null) resoudreLeProfil(etat.persona, false);
        return;
      }
      dernierChoix = etat.choix;
      if (questionEnAttente !== null) {
        resoudreLeProfil(etat.persona, false);
        return;
      }
      if (conversationEnCours && etat.persona !== personaConversation) nouvelleConversation();
    });

    // Entrée profonde depuis /laws/[id] : « Poser une question à l'Assistant
    // IA » arrive ici avec le sujet déjà rédigé. La question est PRÉ-REMPLIE et
    // non envoyée : l'utilisateur la complète avant de la poser, sinon on
    // dépenserait un appel au modèle pour une phrase qu'il n'a pas écrite.
    const q = $page.url.searchParams.get("q");
    if (q) chatInput = q;

    // Pas de défilement d'office au chargement : seul l'accueil est affiché,
    // et le pousser en bas en cachait le début sur un écran court. La vue
    // reste en revanche collée en bas quand la conversation rétrécit : clavier
    // qui s'ouvre (Android), champ qui grandit, rotation.
    mesurerColle();
    const observateur =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => suivre());
    if (messagesContainer) observateur?.observe(messagesContainer);

    // La forme de l'aperçu (feuille ou panneau) et celle des conversations
    // (tiroir ou colonne) suivent la largeur en direct.
    const ecran = window.matchMedia(REQUETE_ECRAN_LARGE);
    const ecranXl = window.matchMedia(REQUETE_ECRAN_TRES_LARGE);
    const surChangementDEcran = () => {
      ecranLarge = ecran.matches;
      ecranTresLarge = ecranXl.matches;
      // Devenu colonne, le panneau n'est plus un tiroir à refermer.
      if (ecranLarge) panneauOuvert = false;
    };
    ecran.addEventListener?.("change", surChangementDEcran);
    ecranXl.addEventListener?.("change", surChangementDEcran);

    return () => {
      desabonner();
      // Ce qui attend encore (lecture du compte, flux) n'écrit ni n'envoie
      // plus rien pour une page quittée.
      generation += 1;
      controleur?.abort();
      observateur?.disconnect();
      ecran.removeEventListener?.("change", surChangementDEcran);
      ecranXl.removeEventListener?.("change", surChangementDEcran);
      if (image) cancelAnimationFrame(image);
      bloquerLeDefilement(false);
      conversationDuChatEnCours.set(false);
    };
  });
</script>

<!-- Hors index : une session de conversation n'a pas de contenu stable, et la
     page ne rend rien avant que l'utilisateur ait ecrit.
     UN SEUL NOM (P4) : « Assistant JuriX », celui de la barre, aussi dans
     l'onglet du navigateur, le titre masqué et le nom du fil. Ces trois-là
     disaient encore « Assistant Juridique IA » (« AI Legal Assistant » en
     anglais) : deux noms pour un même assistant. -->
<MetaSeo titre={t("chat.barTitle")} indexable={false} />

<svelte:window on:keydown={surTouche} />

<!--
  Toute la page tient dans la hauteur que lui laisse le layout (`h-app` sur
  /chat) : seule la conversation défile, la saisie reste en bas, au-dessus du
  clavier. Sur téléphone, ni marge ni bordure : la conversation prend tout
  l'écran. Au-delà, une carte centrée ; à partir de lg pour un compte, la
  colonne des conversations à sa gauche ; aperçu d'une citation ouvert, son
  panneau à droite (maquette chat-p3a-apercu), la page s'élargissant pour lui.

  `sm:court:` et non `court:` seul, ici comme plus bas : la variante `court:`
  sort AVANT les variantes de largeur dans la feuille de style, et un `sm:`
  sur la même propriété l'emporterait sur un téléphone en paysage (plus de
  640 px de large).

  Écran court : 8 px au-dessus et au-dessous de la carte, le pas des marges
  courtes du site (`court:!pt-2` du layout) et de la liste (`court:py-2`). À
  4 px, contre 16 px sur les côtés, la carte touchait presque le haut et le
  bas de l'écran.
-->
<div
  class="flex min-h-0 w-full flex-1 flex-col sm:mx-auto sm:max-w-3xl sm:pt-3 sm:pb-4 sm:court:py-2 lg:pt-0 lg:pb-6 {$authStore.isAuthenticated
    ? `lg:max-w-6xl lg:flex-row lg:gap-6 ${avecPanneau ? 'xl:max-w-7xl' : ''}`
    : avecPanneau
      ? 'lg:max-w-6xl lg:flex-row lg:gap-6'
      : ''}"
>
  <!-- Le h1 du layout est masque sur cette route (le hero marketing n'a rien a
       faire au-dessus d'une conversation). La page se retrouvait sans aucun
       titre : celui-ci est visuellement masque mais annonce par les lecteurs
       d'ecran. Le titre visible de la barre compacte n'est pas un titre de
       document : le spec d'accessibilite exige exactement un h1. -->
  <h1 class="sr-only">{t("chat.barTitle")}</h1>

  {#if $authStore.isAuthenticated}
    {#if tiroirOuvert}
      <!-- Fond du tiroir : un appui à côté le referme. -->
      <div
        role="presentation"
        class="fixed inset-0 z-[54] bg-zinc-950/40 backdrop-blur-sm lg:hidden"
        on:click={() => (panneauOuvert = false)}
        transition:fade={{ duration: duree(150) }}
      ></div>
    {/if}
    <!--
      Panneau des conversations. Un <h2>, et non un second <h1> : le spec
      d'accessibilite exige exactement un h1 par page.

      Rendu pour un compte seulement : une conversation anonyme n'appartient a
      personne, donc aucune liste ne peut la contenir.

      Fermé sous lg, il est `invisible` et non seulement poussé hors de
      l'écran : sinon la tabulation entrait dans ses boutons cachés. z-[55] :
      au-dessus de l'en-tête (z-50), sous la boîte des profils (z-[60]).

      En tiroir, un trait à droite : en sombre, sans ombre, seul le voile du
      fond le séparait de la conversation, d'un gris presque identique. En
      colonne, la même carte que la conversation (bordure, ombre légère, rien
      en sombre), pour que les deux se lisent comme une paire.

      Inerte sous la feuille d'aperçu modale, comme la conversation. En
      tiroir, il porte la région d'annonce du chat (voir `annoncer`).
    -->
    <aside
      bind:this={panneau}
      id="panneau-conversations"
      data-testid="conversations-panel"
      aria-labelledby="titre-conversations"
      role={tiroirOuvert ? "dialog" : undefined}
      aria-modal={tiroirOuvert ? "true" : undefined}
      inert={apercuModal}
      use:piegeSiTiroir={tiroirOuvert}
      class="fixed inset-y-0 left-0 z-[55] flex h-app w-[85vw] max-w-xs flex-col border-r border-zinc-200 bg-white pt-zone-sure pb-zone-sure pl-[env(safe-area-inset-left)] shadow-xl transition-[transform,visibility] duration-200 ease-out motion-reduce:transition-none dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none {panneauOuvert
        ? 'visible translate-x-0'
        : 'invisible -translate-x-full'} lg:visible lg:static lg:z-auto lg:h-auto lg:w-72 lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:rounded-2xl lg:border lg:p-0 lg:shadow-sm lg:transition-none lg:dark:shadow-none"
    >
      <div class="flex items-center justify-between gap-2 px-4 pt-3 lg:pt-4">
        <h2 id="titre-conversations" class="text-sm font-bold text-zinc-950 dark:text-white">
          {t("chat.conversations")}
        </h2>
        <button
          type="button"
          aria-label={t("common.close")}
          on:click={() => (panneauOuvert = false)}
          class="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-xl text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white lg:hidden"
        >
          <Icone nom="x" class="text-2xl" />
        </button>
      </div>

      <div class="px-4 pt-3">
        <button
          on:click={() => nouvelleConversation()}
          data-testid="chat-new"
          class="min-h-11 w-full rounded-xl bg-zinc-950 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-black dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 lg:min-h-0"
        >
          {t("chat.newConversation")}
        </button>
      </div>

      <!-- La liste défile seule : à partir de lg aussi, un long historique
           allongeait la page entière. -->
      <div
        id="liste-conversations"
        class="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4"
      >
        {#if conversationsEnCours}
          <p
            role="status"
            aria-live="polite"
            class="mt-2 text-xs text-zinc-500 dark:text-zinc-400"
          >
            {t("common.loading")}
          </p>
        {:else if conversationsErreur}
          <!-- L'alerte d'erreur du site, en format serré pour la colonne :
               l'icône dit « erreur » sans compter sur le seul rouge. -->
          <div
            role="alert"
            data-testid="conversations-error"
            class="mt-2 flex gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            <Icone nom="circle-alert" class="mt-px text-sm" />
            <div class="min-w-0">
              <p>{conversationsErreur}</p>
              <button
                on:click={chargerConversations}
                data-testid="conversations-retry"
                class="-mx-2 inline-flex min-h-11 items-center px-2 font-medium underline hover:no-underline lg:mx-0 lg:mt-1 lg:min-h-0 lg:px-0"
              >
                {t("common.retry")}
              </button>
            </div>
          </div>
        {:else if conversations.length === 0}
          <p class="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            {t("chat.conversationsEmpty")}
          </p>
        {:else}
          <ul class="space-y-1">
            {#each conversations as conversation (conversation.session_id)}
              <li class="flex items-center gap-1">
                <button
                  on:click={() => ouvrirConversation(conversation)}
                  data-testid="conversation-item"
                  aria-current={conversation.session_id === sessionId ? "true" : undefined}
                  class="min-h-11 min-w-0 flex-1 truncate rounded-lg px-2.5 py-2.5 text-left text-sm transition-colors lg:min-h-0 lg:py-1.5 lg:text-xs {conversation.session_id ===
                  sessionId
                    ? 'bg-zinc-950 font-medium text-white dark:bg-white dark:text-zinc-950'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white'}"
                >
                  {conversation.title || t("chat.untitledConversation")}
                </button>
                <!-- 44 px sous lg : collé au titre et effaçant sans
                     confirmation, il se touchait par erreur du pouce.
                     zinc-500 au repos et non plus clair : l'icône est seule à
                     dire ce que fait le bouton, il lui faut 3:1 sur le blanc.
                     Le rouge n'arrive qu'au survol : c'est une suppression. -->
                <button
                  on:click={() => supprimerConversation(conversation)}
                  data-testid="conversation-delete"
                  aria-label="{t('chat.deleteConversation')} : {conversation.title ||
                    t('chat.untitledConversation')}"
                  class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-red-950/40 dark:hover:text-red-400 lg:h-auto lg:w-auto lg:px-1.5 lg:py-1"
                >
                  <Icone nom="trash" class="text-lg lg:text-sm" />
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      <!-- La région d'annonce du chat tant que le tiroir est ouvert : boîte
           aria-modal, rien d'autre n'est lu (voir `annoncer`). Rendue avec
           lui, présente avant sa première phrase. Hors du flux (sr-only). -->
      {#if tiroirOuvert}
        <p class="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="chat-drawer-announce">
          {annonceDuTiroir}
        </p>
      {/if}
    </aside>
  {/if}

  <!-- Bordure et ombre du mode sombre sous la variante de largeur, empilée
       devant celle du thème : les variantes de thème sortent avant celles de
       largeur, un `sm:border-zinc-200` seul l'emporterait aussi en mode
       sombre. (Ce commentaire n'écrit pas l'empilement en toutes lettres :
       Tailwind lit aussi les commentaires, et en tirait des règles mortes.)
       Inerte sous la feuille d'aperçu modale et sous le tiroir : ce sont des
       boîtes de dialogue, rien derrière ne doit recevoir le focus ni la
       lecture. Sous le tiroir, l'alerte d'une erreur restait lue par Firefox
       avec NVDA, qui ne retire pas la page sous aria-modal, en plus de la
       région du tiroir (voir `ajouterUneErreur`). -->
  <div
    inert={apercuModal || tiroirOuvert}
    class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white dark:bg-zinc-900 sm:rounded-2xl sm:border sm:border-zinc-200 sm:shadow-sm sm:dark:border-zinc-800 sm:dark:shadow-none"
  >
    <!--
      Barre du haut. Sous lg, elle remplace l'en-tête du site (non rendu sur
      cette page) : retour, titre et profil, conversations, menu. À partir de
      lg, c'est la barre d'état de la carte. Une seule barre à toutes les
      largeurs : un même bouton de profil y change d'aspect, plutôt que deux
      copies dont l'une serait cachée (un data-testid ne doit désigner qu'un
      élément).
    -->
    <div
      class="shrink-0 border-b border-zinc-200 bg-zinc-50/70 pt-zone-sure dark:border-zinc-800 dark:bg-zinc-900/60 lg:pt-0"
    >
      <div
        class="flex min-h-14 items-center gap-1 px-1 py-1 sm:gap-2 sm:px-2 lg:min-h-0 lg:px-6 lg:py-4 court:min-h-0 court:py-0"
      >
        <a
          href="/"
          aria-label={t("chat.backHome")}
          class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white lg:hidden"
        >
          <Icone nom="arrow-left" class="text-2xl" />
        </a>

        <!-- Le titre de la barre, le même à toutes les largeurs : ici à partir
             de lg ; sous lg, première ligne du bouton de profil, plus bas. Un
             seul nom, « Assistant JuriX », sans point qui pulse (P4) : la
             pastille animée disait « en ligne » à la manière d'une personne,
             et rien ne la justifiait. En Inter et en casse de phrase (Q5 :
             deux voix au plus), et non plus en chasse fixe et capitales. -->
        <span class="hidden text-sm font-medium text-zinc-500 dark:text-zinc-400 lg:inline">
          {t("chat.barTitle")}
        </span>

        <!-- Le profil auquel le chat répond : celui de la conversation en cours,
             sinon le profil choisi. Sous lg, le bouton porte le titre de la
             barre et le profil sur deux lignes (le tout en 44 px de haut) ; à
             partir de lg, il redevient le lien « Changer ».
             « Profil : » vient d'une seule clé, deux-points compris : écrit
             « {libellé} : » dans le code, l'anglais recevait l'espace
             française (« Profile : General »). -->
        <div
          class="flex min-w-0 flex-1 items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300 lg:ml-auto lg:flex-none"
          data-testid="chat-persona"
          data-persona={personaAffiche ?? "general"}
        >
          <Icone
            nom={PERSONA_ICONE[personaAffiche ?? "general"]}
            class="hidden text-base text-zinc-950 dark:text-white lg:inline-block"
          />
          <span class="hidden lg:inline">{t("chat.profileLabel")} <strong>{nomDuProfil}</strong></span>
          <!-- À partir de lg, « Changer » prend l'allure des liens du site :
               souligné discret, qui fonce au survol. -->
          <button
            type="button"
            data-testid="chat-persona-change"
            aria-haspopup="dialog"
            on:click={() => ouvrirChoixPersona(personaAffiche)}
            class="flex min-h-11 min-w-0 flex-1 flex-col items-start justify-center rounded-xl px-2 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 lg:min-h-0 lg:flex-none lg:rounded-md lg:py-0.5 lg:font-semibold lg:text-zinc-950 lg:underline lg:decoration-zinc-300 lg:underline-offset-4 lg:hover:bg-transparent lg:hover:decoration-zinc-950 lg:dark:text-white lg:dark:decoration-zinc-600 lg:dark:hover:bg-transparent lg:dark:hover:decoration-white"
          >
            <!-- Le titre de la barre, en demi-gras et en Inter. Les deux lignes
                 en zinc-600 et non zinc-500 : au survol, le bouton passe sur
                 zinc-100, où zinc-500 n'atteint plus 4,5:1 (guide § 3, règle
                 1). Le nom du profil en gras, comme à partir de lg. -->
            <span
              class="block max-w-full truncate text-xs font-semibold leading-4 text-zinc-600 dark:text-zinc-400 lg:hidden"
              >{t("chat.barTitle")}</span
            >
            <span
              class="flex max-w-full items-center gap-1 leading-4 text-zinc-600 dark:text-zinc-400 lg:hidden"
            >
              <Icone
                nom={PERSONA_ICONE[personaAffiche ?? "general"]}
                class="shrink-0 text-sm text-zinc-950 dark:text-white"
              />
              <span class="min-w-0 truncate">{t("chat.profileLabel")} <strong>{nomDuProfil}</strong></span>
              <Icone nom="chevron-down" class="shrink-0 text-sm" />
              <span class="sr-only">— {t("persona.change")}</span>
            </span>
            <span class="hidden lg:inline">{t("persona.change")}</span>
          </button>
        </div>

        {#if $authStore.isAuthenticated}
          <button
            type="button"
            data-testid="conversations-toggle"
            aria-expanded={panneauOuvert}
            aria-controls="panneau-conversations"
            aria-label={t("chat.conversations")}
            on:click={() => {
              menuOuvert = false;
              panneauOuvert = !panneauOuvert;
            }}
            class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white lg:hidden"
          >
            <Icone nom="messages-square" class="text-2xl" />
          </button>
        {/if}

        <button
          type="button"
          bind:this={boutonMenu}
          data-testid="chat-menu-toggle"
          aria-expanded={menuOuvert}
          aria-controls="chat-menu"
          aria-label={t("a11y.menu")}
          on:click={() => (menuOuvert = !menuOuvert)}
          class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white lg:hidden"
        >
          <Icone nom={menuOuvert ? "x" : "menu"} class="text-2xl" />
        </button>
      </div>

      <!-- Dans le flux, comme le menu mobile de l'en-tête : la conversation
           rétrécit le temps qu'il est ouvert, rien ne la recouvre. Le choix
           FR / EN reste ici (P5) : la boîte des profils, qui le portait aussi,
           ne s'ouvre plus d'elle-même. -->
      {#if menuOuvert}
        <nav
          id="chat-menu"
          data-testid="chat-menu"
          aria-label={t("a11y.menu")}
          class="border-t border-zinc-200 px-2 py-2 dark:border-zinc-800 lg:hidden"
        >
          <ul class="grid grid-cols-2 gap-1">
            {#each NAV_LINKS as lien (lien.href)}
              <li>
                <a
                  href={lien.href}
                  class="flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
                  >{t(lien.key)}</a
                >
              </li>
            {/each}
          </ul>
          <div class="mt-2 flex items-center gap-1 border-t border-zinc-200 pt-2 dark:border-zinc-800">
            <button
              type="button"
              aria-label="{t('a11y.switchTo')} français"
              aria-pressed={$language.current === "fr"}
              on:click={() => switchLanguage("fr")}
              class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-xs font-bold transition-colors {$language.current ===
              'fr'
                ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white'}">FR</button
            >
            <button
              type="button"
              aria-label="{t('a11y.switchTo')} English"
              aria-pressed={$language.current === "en"}
              on:click={() => switchLanguage("en")}
              class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-xs font-bold transition-colors {$language.current ===
              'en'
                ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white'}">EN</button
            >
            <button
              type="button"
              aria-label={t("a11y.toggleTheme")}
              on:click={themeStore.toggle}
              class="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-xl text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
            >
              <!-- Les deux icônes, alternées par la classe `dark`, comme dans
                   l'en-tête. -->
              <Icone nom="moon" class="text-2xl dark:hidden" />
              <Icone nom="sun" class="hidden text-2xl dark:inline-block" />
            </button>
          </div>
        </nav>
      {/if}
    </div>

    <!--
      Le fil de la conversation : `role="log"`, nommé, sans région vivante
      (`aria-live="off"`, P4). Annoncer chaque morceau d'une réponse en flux la
      découpait en fragments répétés : pendant la réponse, le fil porte
      `aria-busy`, et UNE région d'annonce, après la carte (dans la boîte
      modale ouverte par-dessus, s'il y en a une, voir `annoncer`), dit les
      étapes puis « Réponse terminée, 3 articles cités. ». Les erreurs gardent
      leur `role="alert"`, annoncé à part, et redit par la boîte modale, sous
      laquelle il se tait (voir `ajouterUneErreur`).

      Il prend toute la hauteur restante et défile seul. Il mesurait 400 à
      500 px quelle que soit la taille de l'écran : plus haut que l'écran d'un
      téléphone en paysage, et la saisie tombait sous la ligne de flottaison.
      `overscroll-contain` : arrivé en haut, le geste ne recharge pas la page.

      Marges latérales : 16 px sur téléphone, la gouttière du reste du site,
      puis 24 px à partir de sm ; la saisie, en dessous, prend les mêmes. La
      liste (12 px) et la saisie (8 px) ne s'alignaient pas : le cadre de
      saisie débordait des bulles de chaque côté.

      Hors du bas d'une conversation, là où la bande « Aller au dernier
      message » (52 px, plus bas) est ouverte ou peut s'ouvrir : une marge de
      défilement de 56 px, pour qu'une citation atteinte au clavier vienne se
      placer au-dessus d'elle, et non dessous (WCAG 2.4.11). Posée dès l'arrêt
      sur la question, encore sans bande : la citation atteinte fait défiler
      le fil, et la bande s'ouvre alors sous elle.
    -->
    <div class="relative flex min-h-0 flex-1 flex-col">
      <div
        bind:this={messagesContainer}
        role="log"
        aria-live="off"
        aria-busy={envoiEnCours ? "true" : undefined}
        aria-label={t("chat.barTitle")}
        on:scroll={surDefilement}
        class="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:space-y-6 sm:p-6 court:py-2 sm:court:py-2 {horsDuBas
          ? 'scroll-pb-14'
          : ''}"
      >
        {#each messagesAffiches as message (message.id)}
          {#if message.type === "profil"}
            <div data-message-id={message.id}>
              <QuestionDuProfil
                choix={message.profil}
                idMessage={message.id}
                surChoix={(persona) => resoudreLeProfil(persona, true)}
              />
            </div>
          {:else}
            <div
              data-message-id={message.id}
              class="flex gap-2 sm:gap-4 {message.type === 'user' ? 'flex-row-reverse' : ''}"
            >
              <!-- Avatar. Sous sm, ceux de l'utilisateur ET de l'assistant
                   disparaissent : la bulle noire à droite et la bulle bordée à
                   gauche suffisent à dire qui parle, et ces 40 px (32 + 8
                   d'écart) manquaient au texte. Celui d'une erreur reste : son
                   icône est le seul pictogramme qui la signale (guide § 4.10),
                   et le message est court. L'utilisateur est inversé, comme sa
                   bulle ; l'assistant est clair, comme la sienne. Le rouge
                   reste à l'erreur seule, en red-600 : sur red-500, le blanc ne
                   fait que 3,8:1. Les messages de l'accueil qui suivent le
                   premier gardent la place de l'avatar, sans avatar (maquette
                   chat-accueil-p4a) : un seul interlocuteur parle. -->
              <div class="shrink-0 {message.type === 'error' ? '' : 'hidden sm:block'}">
                {#if message.type === "error"}
                  <div
                    class="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white sm:h-10 sm:w-10"
                  >
                    <Icone nom="cloud-off" class="text-base sm:text-lg" />
                  </div>
                {:else if message.type === "user"}
                  <div
                    class="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 sm:h-10 sm:w-10"
                  >
                    <Icone nom="user-round" class="text-base sm:text-lg" />
                  </div>
                {:else if message.sansAvatar}
                  <div class="h-8 w-8 sm:h-10 sm:w-10"></div>
                {:else}
                  <div
                    class="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 sm:h-10 sm:w-10"
                  >
                    <Icone nom="bot" class="text-base sm:text-lg" />
                  </div>
                {/if}
              </div>

              <!-- Message Content. `min-w-0` : sans lui, la colonne ne pouvait
                   pas descendre sous la largeur de son plus long mot ou de son
                   plus long titre de source, et la conversation défilait de
                   côté. -->
              <div class="min-w-0 flex-1 {message.type === 'user' ? 'text-right' : ''}">
                {#if message.type === "error"}
                  <div
                    role="alert"
                    data-testid="chat-error"
                    class="coupe-mots inline-block max-w-[85%] rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-left dark:border-red-900/60 dark:bg-red-950/40 sm:max-w-md sm:px-5 sm:py-3"
                  >
                    <p class="text-red-700 dark:text-red-300">{message.content}</p>
                    <button
                      on:click={() => handleSendChatMessage(lastQuestion)}
                      data-testid="chat-retry"
                      class="-mx-2 inline-flex min-h-11 items-center px-2 text-sm font-semibold text-red-700 underline dark:text-red-300 sm:mx-0 sm:mt-2 sm:min-h-0 sm:px-0"
                      >{t("common.retry")}</button
                    >
                  </div>
                {:else if message.type === "user"}
                  <!-- `whitespace-pre-wrap` : la saisie accepte les retours à la
                       ligne (Maj+Entrée), qui sont gardés.
                       Bulle inversée dans les deux thèmes, comme tout élément
                       « à soi » du site : blanche en sombre. L'heure suit :
                       zinc-400 sur zinc-950 (7,8:1), zinc-600 sur blanc (7,7:1),
                       en Inter à chiffres tabulaires (Q5 : la chasse fixe ne
                       garde que les codes courts). -->
                  <div
                    class="coupe-mots inline-block max-w-[85%] rounded-2xl rounded-tr-sm bg-zinc-950 px-4 py-2.5 text-left text-white shadow-sm dark:bg-white dark:text-zinc-950 dark:shadow-none sm:max-w-md sm:px-5 sm:py-3"
                  >
                    <p class="whitespace-pre-wrap">{message.content}</p>
                    {#if message.timestamp}
                      <span class="mt-1 block text-xs tabular-nums text-zinc-400 dark:text-zinc-600 sm:mt-2"
                        >{message.timestamp}</span
                      >
                    {/if}
                  </div>
                {:else if message.type === "arret"}
                  <!-- Arrêtée avant le premier mot : rien n'a été écrit, rien
                       n'est gardé. Une ligne neutre, pas une erreur. -->
                  <p
                    class="flex flex-wrap items-center gap-x-3 text-sm text-zinc-600 dark:text-zinc-400"
                    data-testid="chat-stopped"
                  >
                    <span>{t("chat.stopped")}</span>
                    <button
                      type="button"
                      data-testid="chat-ask-again"
                      disabled={envoiEnCours || questionEnAttente !== null}
                      on:click={(event) => envoyerDepuis(event, message.question)}
                      class="-mx-2 inline-flex min-h-11 items-center px-2 font-medium text-zinc-950 underline decoration-zinc-300 underline-offset-4 transition-colors hover:decoration-zinc-950 disabled:cursor-not-allowed disabled:opacity-50 dark:text-white dark:decoration-zinc-600 dark:hover:decoration-white"
                      >{t("chat.askAgain")}</button
                    >
                  </p>
                {:else}
                  {@const rendu = renduDe(message)}
                  <!--
                    Bulle de l'assistant (guide § 4.15), pendant de la bulle
                    noire de l'utilisateur : blanche et bordée, le coin du haut
                    resserré côté avatar comme le sien. Les sources y entrent,
                    sous un trait : elles font partie de la réponse. Les
                    suggestions restent dehors : ce sont des questions à poser,
                    pas du texte de l'assistant. Pleine largeur et non ajustée
                    au texte : pendant le flux, elle aurait changé de largeur à
                    chaque morceau.

                    Le texte et ses citations : TexteDeReponse (P3). Les
                    réponses restent en Inter : la serif est réservée au texte
                    officiel (Q5).
                  -->
                  <div
                    class="space-y-3 rounded-2xl rounded-tl-sm border border-zinc-200 bg-white px-4 py-2.5 text-left text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 sm:px-5 sm:py-3"
                  >
                    <TexteDeReponse
                      blocs={rendu.blocs}
                      marque={rendu.marque !== null}
                      citations={rendu.marque?.citations ?? []}
                      citationActive={sourceApercu?.idMessage === message.id && sourceApercu.genre === "citation"
                        ? sourceApercu.index
                        : null}
                      surCitation={(index, declencheur) => ouvrirLaCitation(message, index, declencheur)}
                    />

                    {#if aDesListes(message)}
                      <SourcesDeLaReponse
                        idMessage={message.id}
                        articles={message.citations?.articles_cites ?? []}
                        consultes={message.citations?.textes_consultes_non_cites ?? []}
                        releveLe={chiffres?.liens_releves_le ?? null}
                        articleActif={sourceApercu?.idMessage === message.id && sourceApercu.genre === "article"
                          ? sourceApercu.index
                          : null}
                        surArticle={(index, declencheur) => ouvrirLArticleCite(message, index, declencheur)}
                      />
                    {:else if message.sources && message.sources.length > 0}
                      <!-- Ancienne API, ou conversation rouverte : la liste
                           « Sources » d'avant, telle quelle. -->
                      <div
                        class="border-t border-zinc-200 pt-3 text-left dark:border-zinc-800"
                      >
                        <!-- À partir de sm, le titre « Sources », seul dans son
                             élément (les tests le cherchent au mot près). Sous
                             sm, à sa place, le bouton qui déplie la liste et dit
                             combien elle compte de sources. -->
                        <p class="mb-2 hidden text-xs font-medium text-zinc-500 dark:text-zinc-400 sm:block">
                          {t("chat.sources")}
                        </p>
                        <button
                          type="button"
                          data-testid="chat-sources-toggle"
                          aria-expanded={Boolean(sourcesDepliees[message.id])}
                          aria-controls="sources-{message.id}"
                          on:click={() => basculerSources(message.id)}
                          class="-ml-2 -mt-3 inline-flex min-h-11 items-center gap-1 px-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100 sm:hidden"
                        >
                          <Icone
                            nom={sourcesDepliees[message.id] ? "chevron-up" : "chevron-down"}
                            class="text-base"
                          />
                          {sourcesDepliees[message.id] ? t("chat.hideSources") : t("chat.showSources")}
                          ({message.sources.length})
                        </button>
                        <ul
                          id="sources-{message.id}"
                          class="space-y-2 {sourcesDepliees[message.id] ? '' : 'hidden'} sm:block"
                        >
                          {#each message.sources as source, i (i)}
                            <li>
                              <!-- article_number en parametre : la page /laws/[id]
                                   reconstruit sa liste d'articles depuis le texte,
                                   elle ne connait pas les identifiants de ligne. -->
                              <!-- Le nom du texte et non sa cote interne : « PRC-4722 »
                                   ne disait pas qu'il s'agissait du Code pénal.
                                   L'intitulé complet suit, pour lever toute ambiguïté. -->
                              <a
                                href={source.article_number
                                  ? `/laws/${source.law_id}?article=${encodeURIComponent(source.article_number)}`
                                  : `/laws/${source.law_id}`}
                                data-testid="chat-source"
                                class="block min-w-0 rounded-xl border border-zinc-200 px-3 py-2 transition-colors hover:border-zinc-950 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-400 dark:hover:bg-zinc-800/60"
                              >
                                <!-- Sans intitulé en base, « Texte sans intitulé » :
                                     $lib/sources ne rend plus la cote (P2, P11). -->
                                <span class="coupe-mots block text-sm font-medium text-zinc-950 dark:text-white line-clamp-2">
                                  {libelleDeSource(source, t("chat.citation.sansIntitule"))}
                                </span>
                                {#if source.law_title && source.law_title !== nomCourtDuTexte(source.law_title, source.law_reference)}
                                  <span class="block truncate text-xs text-zinc-500 dark:text-zinc-400" title={source.law_title}>
                                    {source.law_title}
                                  </span>
                                {/if}
                                <span class="coupe-mots mt-1 block text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                                  {source.excerpt}
                                </span>
                              </a>
                            </li>
                          {/each}
                        </ul>
                      </div>
                    {/if}
                  </div>

                  {#if message.arretee}
                    <!-- Arrêtée en cours de route (P4) : le texte reçu reste,
                         dit incomplet, et la question se repose d'un geste. -->
                    <p
                      class="mt-2 flex flex-wrap items-center gap-x-3 text-sm text-zinc-600 dark:text-zinc-400"
                      data-testid="chat-stopped"
                    >
                      <span>{t("chat.stopped")}</span>
                      <button
                        type="button"
                        data-testid="chat-ask-again"
                        disabled={envoiEnCours || questionEnAttente !== null}
                        on:click={(event) => envoyerDepuis(event, message.question)}
                        class="-mx-2 inline-flex min-h-11 items-center px-2 font-medium text-zinc-950 underline decoration-zinc-300 underline-offset-4 transition-colors hover:decoration-zinc-950 disabled:cursor-not-allowed disabled:opacity-50 dark:text-white dark:decoration-zinc-600 dark:hover:decoration-white"
                        >{t("chat.askAgain")}</button
                      >
                    </p>
                  {/if}

                  {#if message.suggestions}
                    <!-- Trois questions validées sous l'accueil (P4), sans
                         intitulé (maquette) ; le groupe est nommé pour les
                         lecteurs d'écran. Empilées sur toute la largeur sous
                         sm : en pastilles rondes, une suggestion de 80
                         caractères tenait sur quatre lignes serrées contre les
                         bords arrondis. `active:` répète le survol : sur un
                         écran tactile, le survol n'existe pas
                         (hoverOnlyWhenSupported), et un fond inversé sans son
                         texte inversé laissait du zinc-800 sur du noir pendant
                         l'appui. -->
                    <div
                      role="group"
                      aria-label={t("chat.suggestionsGroup")}
                      class="mt-4 flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center"
                      data-testid="chat-suggestions"
                    >
                      {#each message.suggestions as suggestion (suggestion)}
                        <button
                          on:click={(event) => envoyerDepuis(event, suggestion)}
                          data-testid="chat-suggestion"
                          disabled={envoiEnCours || questionEnAttente !== null}
                          class="min-h-11 w-full rounded-xl border border-zinc-200 bg-zinc-100 px-3.5 py-2 text-left text-xs sm:text-sm font-medium leading-snug text-zinc-800 transition-colors hover:border-zinc-950 hover:bg-zinc-950 hover:text-white active:border-zinc-950 active:bg-zinc-950 active:text-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700/60 dark:bg-zinc-800/80 dark:text-zinc-200 dark:hover:border-white dark:hover:bg-white dark:hover:text-zinc-950 dark:active:border-white dark:active:bg-white dark:active:text-zinc-950 sm:min-h-0 sm:w-auto sm:rounded-full sm:px-4 sm:py-1.5 sm:text-center"
                        >
                          {suggestion}
                        </button>
                      {/each}
                    </div>
                  {/if}
                {/if}
              </div>
            </div>
          {/if}
        {/each}

        {#if isTyping}
          <!-- L'attente en texte (P4) : la recherche, les textes trouvés, la
               rédaction. Remplacée par la réponse à son premier mot. -->
          <EtatDeLaReponse etapes={etapesAffichees} />
        {/if}
      </div>

      <!--
        Le lecteur a quitté le bas : un appui le ramène au dernier message.
        Pas quand la vue s'est arrêtée seule sur la question (voir
        `bandeDuDernierMessage`).

        DANS UNE BANDE AU-DESSUS DE LA SAISIE, jamais posé sur le texte (reste
        r3 n° 39, signalé de nouveau au r2). Flottant sur le fil, le bouton
        cachait toujours des mots, qu'on le mette au centre ou à droite :
        « Décret N°2018/9387/CAB/PM » dans le tableau à 1 440 px, « prévoir »
        à 390 px, deux lignes de citations à 740 × 360, où le fil ne fait que
        200 px. La bande couvre le bas du fil sur toute sa largeur, opaque :
        le texte s'arrête net à son filet, comme au bord de la vue, et aucun
        mot n'est plus coupé par un bouton. Elle prend le fond et le filet de
        la zone de saisie, qui perd le sien pendant ce temps : on voit la zone
        de saisie s'agrandir vers le haut, un bouton en tête, aligné à droite
        sur le bouton d'envoi, à sa place dans les messageries que l'on
        connaît.

        Posée par-dessus le fil, et non dans le flux : le fil garde sa
        hauteur, sa position de défilement et ce qu'en mesure `suivre`, et
        rien ne saute quand la bande paraît ou s'en va.

        Le bouton secondaire du guide (§ 4.4), avec son libellé : posé sur la
        bande, il n'a plus à se détacher d'une bulle blanche, et « Aller au
        dernier message » dit ce qu'une flèche seule laissait deviner. Son
        nom accessible est ce libellé.
      -->
      {#if bandeDuDernierMessage}
        <div
          class="absolute inset-x-0 bottom-0 z-10 border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
          data-testid="chat-scroll-band"
          transition:fade={{ duration: duree(150) }}
        >
          <div class="flex justify-end bg-zinc-50/70 px-4 py-1 dark:bg-zinc-900/60 sm:px-6">
            <button
              type="button"
              data-testid="chat-scroll-latest"
              on:click={allerAuDernier}
              class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition-colors hover:border-zinc-950 hover:text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-200 dark:hover:text-white"
            >
              <Icone nom="arrow-down" class="text-base" />{t("chat.scrollToLatest")}
            </button>
          </div>
        </div>
      {/if}
    </div>

    <!-- Input Area. `pb-zone-sure` : au-dessus de la barre d'accueil de
         l'iPhone, et non dessous. Marges latérales de la liste au-dessus
         (16 px, puis 24 px à partir de sm) : le cadre de saisie s'aligne sur
         les avatars et les bulles.
         Écran court : 12 px entre le filet du fil et le cadre, 6 px entre le
         cadre et l'avertissement, 10 px sous lui jusqu'au bord de la carte.
         À 8 px, le cadre noir du champ actif (bordure et anneau) laissait 7 px
         de blanc sous le filet, et la zone paraissait encore tassée à
         740 × 360 contre 24 px sur les côtés (reste r3 n° 40, revu le
         29/10). Ces 8 px de plus sont pris au fil, pas plus : `court:` vaut
         aussi pour un téléphone dont le clavier est ouvert, où chaque ligne
         de la conversation compte.
         Filet transparent sous la bande « Aller au dernier message » : elle
         porte alors le filet de la zone, dont elle prolonge le fond. -->
    <div
      class="shrink-0 border-t bg-zinc-50/70 pb-zone-sure dark:bg-zinc-900/60 {bandeDuDernierMessage
        ? 'border-transparent'
        : 'border-zinc-200 dark:border-zinc-800'}"
    >
      <div
        class="px-4 pt-2 sm:px-6 sm:pt-4 {$authStore.isAuthenticated
          ? 'pb-2 sm:pb-4'
          : 'sm:pb-3'} court:pb-2.5 court:pt-3 sm:court:pb-2.5 sm:court:pt-3"
      >
        <!-- Cadre du champ, à la recette des champs (guide § 4.5) : en sombre,
             fond zinc-950 et bordure zinc-500. En zinc-900 bordé de zinc-700,
             il ressemblait aux suggestions de question posées au-dessus. -->
        <div
          class="flex items-end gap-2 rounded-xl border border-zinc-300 bg-white py-1 pl-3 pr-1 transition-colors focus-within:border-zinc-950 focus-within:ring-1 focus-within:ring-zinc-950 dark:border-zinc-500 dark:bg-zinc-950 dark:focus-within:border-zinc-200 dark:focus-within:ring-zinc-200 sm:gap-3 sm:pl-4"
        >
          <!--
            Une zone de texte et non un champ d'une ligne : une question
            juridique est longue, et à 360 px on n'en voyait qu'une vingtaine
            de caractères. Elle grandit avec le texte (voir ajusterHauteur).
            Entrée envoie, Maj+Entrée va à la ligne ; `enterkeyhint` affiche
            « Envoyer » sur la touche du clavier virtuel. 16 px : en dessous,
            iOS zoome sur le champ à chaque focus.
          -->
          <textarea
            bind:this={champ}
            bind:value={chatInput}
            rows="1"
            enterkeyhint="send"
            aria-label={t("a11y.chatInput")}
            on:keydown={handleChatKeydown}
            placeholder={t("chat.placeholder")}
            class="block max-h-40 w-full min-w-0 flex-1 resize-none overflow-y-auto border-none bg-transparent px-0 py-2.5 text-base leading-6 text-zinc-950 placeholder-zinc-400 [field-sizing:content] focus:ring-0 dark:text-zinc-100 dark:placeholder-zinc-500"
          ></textarea>
          <!-- Le trombone est retiré : aucun endpoint n'accepte de pièce jointe
               conversationnelle (/upload et /batch-upload sont réservés à l'admin
               authentifié), et le bouton n'avait de toute façon aucun on:click. -->
          <!-- `mousedown` sans effet par défaut : le focus reste dans le
               champ, et le clavier du téléphone ne se referme pas à chaque
               envoi ni à l'arrêt. -->
          <button
            type="button"
            bind:this={boutonEnvoi}
            on:click={(event) => (envoiEnCours ? arreterLaReponse() : envoyerDepuis(event))}
            on:mousedown={(event) => event.preventDefault()}
            disabled={envoiEnCours ? false : !chatInput.trim() || questionEnAttente !== null}
            aria-label={envoiEnCours ? t("chat.stopAria") : t("chat.send")}
            data-testid={envoiEnCours ? "chat-stop" : "chat-send"}
            class={envoiEnCours ? CLASSE_ARRET : CLASSE_ENVOI}
          >
            {#if envoiEnCours}
              <Icone nom="square" class="text-sm" /><span class="hidden sm:inline">{t("chat.stop")}</span>
            {:else}
              <Icone nom="send-horizontal" class="text-xl" />
            {/if}
          </button>
        </div>

        <!-- Avertissement permanent sous le champ (P4) : là où l'on écrit, et
             non dans une fenêtre d'accueil qu'on ferme sans lire. zinc-500 sur
             le fond de la zone (4,7:1), zinc-400 en sombre. Il reste visible
             sur écran court, clavier ouvert compris : c'est la ligne qu'on ne
             retire pas. -->
        <p
          class="mt-2 text-center text-xs leading-snug text-zinc-500 dark:text-zinc-400 court:mt-1.5"
          data-testid="chat-disclaimer"
        >
          {t("chat.disclaimer")}
        </p>

        {#if !$authStore.isAuthenticated}
          <!-- L'invitation n'apparait qu'aux visiteurs anonymes : le chat reste
               pleinement utilisable sans compte, le compte n'ajoute que la memoire.
               Masquée sur écran court (paysage, clavier ouvert sur Android) :
               chaque ligne y manque à la conversation. -->
          <p class="text-center text-xs text-zinc-500 dark:text-zinc-400 court:hidden">
            <a
              href="/signup"
              data-testid="chat-signup-link"
              class="inline-flex min-h-11 items-center font-medium text-zinc-950 underline decoration-zinc-300 underline-offset-4 transition-colors hover:decoration-zinc-950 dark:text-white dark:decoration-zinc-600 dark:hover:decoration-white sm:min-h-0"
              >{t("chat.signInToKeep")}</a
            >
          </p>
        {/if}
      </div>
    </div>
  </div>

  <!-- La région d'annonce du chat (P4) : étapes, fin de réponse, arrêt,
       question du profil. Hors du fil, qui porte aria-busy, et hors de la
       carte, que la feuille d'aperçu modale et le tiroir rendent inerte. Sous
       une boîte modale (palette, profils, feuille, tiroir), les annonces
       passent par la sienne (voir `annoncer`). Hors du flux (sr-only) : elle
       ne pèse pas sur la mise en page. -->
  <p class="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="chat-announce">
    {annonce}
  </p>

  {#if cibleApercu}
    <ApercuDeCitation
      cible={cibleApercu}
      modale={!apercuEnPanneau}
      releveLe={chiffres?.liens_releves_le ?? null}
      annonce={annonceDeLaFeuille}
      surFermer={fermerApercu}
    />
  {/if}
</div>
