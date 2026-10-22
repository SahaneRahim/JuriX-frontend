<script lang="ts">
  import { apiFetch } from "$lib/api";
  import {
    ecrireSessionChat,
    effacerSessionChat,
    lireSessionChat,
  } from "$lib/chat-session";
  import { piegerFocus } from "$lib/actions/pieger-focus";
  import { NAV_LINKS } from "$lib/nav";
  import { authStore } from "$lib/stores/auth";
  import {
    PERSONA_ICONE,
    PERSONA_SLUG,
    champPersona,
    normaliserPersona,
    ouvrirChoixPersona,
    personaDeLaSessionMemorisee,
    personaStore,
    type Persona,
  } from "$lib/stores/persona";
  import { themeStore } from "$lib/stores/theme";
  import { suggestionsPour } from "$lib/suggestions";
  import { libelleDeSource, nomCourtDuTexte } from "$lib/sources";
  import { cleDErreurHttp } from "$lib/chat-erreurs";
  import type { ConversationSummary } from "$lib/types";
  import { afterNavigate } from "$app/navigation";
  import { page } from "$app/stores";
  import { get } from "svelte/store";
  import { onMount, tick } from "svelte";
  import { prefersReducedMotion } from "svelte/motion";
  import { fade } from "svelte/transition";
  import { formatHeure } from "$lib/format";
  import { blocsDeReponse, type Bloc } from "$lib/texte";
  import { lireEvenements } from "$lib/flux";
  // `traductions` et non `tr` : la page rend des <tr> (tableaux des réponses),
  // et un identifiant du même nom fait signaler chaque balise par Svelte.
  import { language, switchLanguage, tr as traductions } from "$lib/stores/language";
  import MetaSeo from "$lib/components/MetaSeo.svelte";

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
     */
    type: "assistant" | "user" | "error";
    content: string;
    suggestions?: string[];
    details?: { title: string; description: string }[];
    // Les citations renvoyees par le RAG. Elles etaient purement et simplement
    // jetees : la reponse s'affichait sans aucune source, alors que l'API en
    // fournit avec le numero d'article et son identifiant de ligne.
    sources?: {
      law_id: number;
      law_reference: string;
      law_title: string;
      article_number?: string | null;
      article_id?: number | null;
      excerpt: string;
      relevance_score: number;
    }[];
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

  // L'ORDRE DES `$:` COMPTE : en mode legacy, ils s'exécutent dans l'ordre du
  // source (voir explication-article.spec.ts). Chacun après ce qu'il lit.
  $: conversationEnCours = sessionId !== null || chatMessages.some((m) => m.type === "user");
  $: personaAffiche = conversationEnCours ? personaConversation : $personaStore.persona;
  // L'accueil est DÉRIVÉ du profil et de la langue. Construit une seule fois,
  // il restait dans la première langue et ne suivait aucun profil.
  $: bienvenue = {
    id: 0,
    type: "assistant",
    content: t("chat.welcome"),
    suggestions: [...suggestionsPour(personaAffiche, $language.current)],
    timestamp: "",
  } as ChatMessage;
  $: messagesAffiches = conversationRestauree ? chatMessages : [bienvenue, ...chatMessages];
  $: nomDuProfil = personaAffiche
    ? t(`persona.${PERSONA_SLUG[personaAffiche]}.nom`)
    : t("persona.general");

  /** Dernière question envoyée, pour que « Réessayer » ait quelque chose à renvoyer. */
  let lastQuestion = "";

  /**
   * Durée d'une transition, nulle quand le système demande moins de
   * mouvement ; même règle que le layout (main)/+layout.svelte.
   */
  const duree = (ms: number) => (prefersReducedMotion.current ? 0 : ms);

  /**
   * Blocs d'un message, calculés une fois par message. En mode legacy, chaque
   * mise à jour de la liste redessine tous les messages : sans mémoire, chaque
   * morceau de réponse relisait le markdown de toute la conversation. Les
   * messages ne sont jamais modifiés en place (toujours recopiés), donc
   * l'objet suffit comme clé.
   */
  const blocsParMessage = new WeakMap<ChatMessage, Bloc[]>();
  function blocsDe(message: ChatMessage): Bloc[] {
    let blocs = blocsParMessage.get(message);
    if (!blocs) {
      blocs = blocsDeReponse(message.content);
      blocsParMessage.set(message, blocs);
    }
    return blocs;
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
   * non un tiroir. Lu dès l'initialisation : la page n'est rendue que dans le
   * navigateur (`ssr = false`), le premier affichage est donc déjà le bon.
   */
  const REQUETE_ECRAN_LARGE = "(min-width: 1024px)";
  let ecranLarge =
    typeof window !== "undefined" && window.matchMedia(REQUETE_ECRAN_LARGE).matches;

  $: tiroirOuvert = panneauOuvert && !ecranLarge;

  /**
   * Tiroir ouvert : la page derrière ne défile plus, comme sous la boîte des
   * profils (src/routes/+layout.svelte). Le document du chat ne défile pas,
   * mais le rebond d'iOS et l'enchaînement du défilement de la liste vers lui,
   * si.
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
  $: bloquerLeDefilement(tiroirOuvert);

  /**
   * `piegerFocus`, mais seulement tant que le panneau est un tiroir ouvert : à
   * partir de lg, le même <aside> est une colonne de la page, que la
   * tabulation doit pouvoir quitter. Posé après la mise à jour du DOM : tant
   * que le tiroir porte encore `invisible`, focus() n'aurait aucun effet. À la
   * fermeture, `piegerFocus` rend le focus au bouton qui a ouvert le tiroir.
   */
  function piegeSiTiroir(noeud: HTMLElement, actif: boolean) {
    let piege: ReturnType<typeof piegerFocus> | null = null;
    let voulu = false;
    const appliquer = (oui: boolean) => {
      voulu = oui;
      if (!oui) {
        piege?.destroy();
        piege = null;
        return;
      }
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

  // Échap referme le menu, sinon le tiroir. La boîte des profils, ouverte par
  // dessus, intercepte Échap avant nous (écoute en capture) : un seul Échap ne
  // ferme jamais deux choses.
  function surTouche(event: KeyboardEvent) {
    if (event.key !== "Escape") return;
    if (menuOuvert) {
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
    sessionId = detail.session_id;
    // Rouverte, la conversation continue avec SON profil (`general` donne
    // le profil général), quel que soit le profil global.
    personaConversation = normaliserPersona(detail.persona);
    conversationRestauree = true;
    ecrireSessionChat(sessionId, personaConversation);
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
    // Les morceaux reçus et pas encore affichés appartiennent à la réponse
    // abandonnée : ils ne doivent pas atterrir dans la conversation suivante.
    enAttente = "";
    idEnAttente = null;
    if (image) cancelAnimationFrame(image);
    image = 0;
  }

  function nouvelleConversation(fermerLePanneau = true) {
    abandonnerLaReponseEnCours();
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

  function mesurerColle() {
    const el = messagesContainer;
    if (el) colle = el.scrollHeight - el.scrollTop - el.clientHeight < SEUIL_COLLE;
  }

  /** Tout en bas, sans condition : après un geste de l'utilisateur. */
  async function scrollToBottom() {
    await tick();
    if (!messagesContainer) return;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    colle = true;
  }

  /**
   * Suit la conversation qui s'allonge, si le lecteur est en bas.
   *
   * Pendant une réponse, la vue descend jusqu'à ce que la question atteigne le
   * haut, puis s'arrête : la réponse se lit de haut en bas au lieu de défiler
   * sous les yeux. Un lecteur déjà descendu sous la question est suivi
   * jusqu'au bout.
   */
  function suivre() {
    const el = messagesContainer;
    if (!el) return;
    if (colle) {
      let cible = el.scrollHeight - el.clientHeight;
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
        if (el.scrollTop <= haut + 1) cible = Math.min(cible, haut);
      }
      if (Math.abs(cible - el.scrollTop) > 1) el.scrollTop = cible;
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
    // serveur et coupait le fil en deux.
    if (!query || envoiEnCours) return;

    // Le schéma serveur impose `min_length=5` sur `question`. Sans ce contrôle,
    // une question de quatre lettres rendait un 422 que l'écran affichait en
    // « erreur serveur » — un message qui accuse le serveur d'un refus légitime.
    if (query.length < QUESTION_MIN_LENGTH) {
      chatMessages = [
        ...chatMessages,
        {
          id: nouvelId(),
          type: "error",
          content: t("chat.errorTooShort"),
          timestamp: getCurrentTime(),
        },
      ];
      await scrollToBottom();
      return;
    }

    lastQuestion = query;
    // Le profil de la conversation est fixé à son premier message.
    if (!conversationEnCours) personaConversation = get(personaStore).persona;
    const gen = generation;
    controleur = new AbortController();
    envoiEnCours = true;

    const userMessage: ChatMessage = {
      id: nouvelId(),
      type: "user",
      content: query,
      timestamp: getCurrentTime(),
    };

    chatMessages = [...chatMessages, userMessage];
    idQuestion = userMessage.id;
    chatInput = "";
    isTyping = true;

    // Sa propre question est toujours montrée, même à qui lisait plus haut.
    await scrollToBottom();

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
        chatMessages = [
          ...chatMessages,
          {
            id: nouvelId(),
            type: "error",
            content: t(cleDErreurHttp(response.status, corps)),
            timestamp: getCurrentTime(),
          },
        ];
      }
    } catch (error) {
      // Annulé par une nouvelle conversation : rien à dire dans celle-ci.
      if (gen !== generation) return;
      chatMessages = [
        ...chatMessages,
        {
          id: nouvelId(),
          type: "error",
          content: t("chat.errorNetwork"),
          timestamp: getCurrentTime(),
        },
      ];
    } finally {
      if (gen === generation) {
        isTyping = false;
        envoiEnCours = false;
        controleur = null;
        await tick();
        suivre();
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
   * Affiche la réponse au fil de l'eau.
   *
   * La bulle de l'assistant n'apparaît qu'au premier morceau de texte :
   * jusque-là, l'indicateur de saisie reste à l'écran. Le dernier événement
   * porte les sources et l'identifiant de conversation. Une panne pendant le
   * flux arrive comme un événement (le statut HTTP est déjà parti en 200) ;
   * le texte déjà reçu reste affiché, l'erreur s'ajoute dessous.
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
        chatMessages = [
          ...chatMessages,
          {
            id: nouvelId(),
            type: "error",
            content: messageDErreur(evenement.error_code),
            timestamp: getCurrentTime(),
          },
        ];
        termine = true;
        break;
      }

      if (evenement.chunk) {
        if (idReponse === null) {
          idReponse = nouvelId();
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
              content:
                $language.current === "fr"
                  ? "Je n'ai pas pu traiter votre demande."
                  : "I couldn't process your request.",
              timestamp: getCurrentTime(),
            },
          ];
        }
        ajouterAuMessage({ sources: (evenement.sources ?? []) as ChatMessage["sources"] });
        // Le profil effectif, tel que le serveur l'a enregistré (`general`
        // donne le profil général).
        if (evenement.persona !== undefined) {
          personaConversation = normaliserPersona(evenement.persona);
        }
        if (evenement.session_id) {
          const conversationNeuve = evenement.session_id !== sessionId;
          sessionId = evenement.session_id;
          ecrireSessionChat(sessionId, personaConversation);
          // Le titre est écrit par le serveur à la première interaction : la
          // liste n'a de nouveau à montrer qu'à ce moment-là.
          if (conversationNeuve) chargerConversations();
        }
        break;
      }
    }

    if (gen !== generation) return;
    afficherEnAttente();
    idEnAttente = null;

    // Flux interrompu avant sa fin (réseau, serveur arrêté)
    if (!termine) {
      chatMessages = [
        ...chatMessages,
        {
          id: nouvelId(),
          type: "error",
          content: t("chat.errorNetwork"),
          timestamp: getCurrentTime(),
        },
      ];
    }
  }

  /** Un clic ENVOIE la suggestion : un seul geste, surtout sur téléphone. */
  function handleSuggestionClick(suggestion: string) {
    handleSendChatMessage(suggestion);
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
   */
  const HAUTEUR_MAX_CHAMP = 160;
  const tailleNative =
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("field-sizing", "content");

  function ajusterHauteur(texte: string) {
    if (tailleNative) return;
    void tick().then(() => {
      if (!champ) return;
      champ.style.height = "auto";
      if (texte) champ.style.height = `${Math.min(champ.scrollHeight, HAUTEUR_MAX_CHAMP)}px`;
    });
  }
  $: if (champ) ajusterHauteur(chatInput);

  onMount(() => {
    // Reprise du fil laissé au chargement précédent : sans cette ligne, un
    // simple F5 perdait la conversation, qui restait pourtant en base.
    sessionId = lireSessionChat();
    // Une session sans profil mémorisé date d'avant les profils : citoyen.
    if (sessionId) personaConversation = personaDeLaSessionMemorisee();
    chargerConversations();

    // Un NOUVEAU choix de l'utilisateur (en-tête, boîte de dialogue) démarre
    // une conversation neuve si le profil change. Un changement passif
    // (compte, autre onglet) ne compte pas : il ne touche pas `choix`, et ne
    // doit pas effacer une conversation rouverte.
    let dernierChoix = get(personaStore).choix;
    const desabonner = personaStore.subscribe((etat) => {
      if (etat.choix === dernierChoix) return;
      dernierChoix = etat.choix;
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

    const ecran = window.matchMedia(REQUETE_ECRAN_LARGE);
    const surChangementDEcran = () => {
      ecranLarge = ecran.matches;
      // Devenu colonne, le panneau n'est plus un tiroir à refermer.
      if (ecranLarge) panneauOuvert = false;
    };
    ecran.addEventListener?.("change", surChangementDEcran);

    return () => {
      desabonner();
      controleur?.abort();
      observateur?.disconnect();
      ecran.removeEventListener?.("change", surChangementDEcran);
      if (image) cancelAnimationFrame(image);
      bloquerLeDefilement(false);
    };
  });
</script>

<!-- Hors index : une session de conversation n'a pas de contenu stable, et la
     page ne rend rien avant que l'utilisateur ait ecrit. -->
<MetaSeo titre={t("chat.header")} indexable={false} />

<svelte:window on:keydown={surTouche} />

<!--
  Toute la page tient dans la hauteur que lui laisse le layout (`h-app` sur
  /chat) : seule la conversation défile, la saisie reste en bas, au-dessus du
  clavier. Sur téléphone, ni marge ni bordure : la conversation prend tout
  l'écran. Au-delà, une carte centrée ; à partir de lg pour un compte, la
  colonne des conversations à sa gauche.

  `sm:court:` et non `court:` seul, ici comme plus bas : la variante `court:`
  sort AVANT les variantes de largeur dans la feuille de style, et un `sm:`
  sur la même propriété l'emporterait sur un téléphone en paysage (plus de
  640 px de large).
-->
<div
  class="flex min-h-0 w-full flex-1 flex-col sm:mx-auto sm:max-w-3xl sm:pt-3 sm:pb-4 sm:court:py-1 lg:pt-0 lg:pb-6 {$authStore.isAuthenticated
    ? 'lg:max-w-6xl lg:flex-row lg:gap-6'
    : ''}"
>
  <!-- Le h1 du layout est masque sur cette route (le hero marketing n'a rien a
       faire au-dessus d'une conversation). La page se retrouvait sans aucun
       titre : celui-ci est visuellement masque mais annonce par les lecteurs
       d'ecran. Le titre visible de la barre compacte n'est pas un titre de
       document : le spec d'accessibilite exige exactement un h1. -->
  <h1 class="sr-only">{t("chat.header")}</h1>

  {#if $authStore.isAuthenticated}
    {#if tiroirOuvert}
      <!-- Fond du tiroir : un appui à côté le referme. -->
      <div
        role="presentation"
        class="fixed inset-0 z-[54] bg-slate-900/60 lg:hidden"
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
    -->
    <aside
      bind:this={panneau}
      id="panneau-conversations"
      data-testid="conversations-panel"
      aria-labelledby="titre-conversations"
      role={tiroirOuvert ? "dialog" : undefined}
      aria-modal={tiroirOuvert ? "true" : undefined}
      use:piegeSiTiroir={tiroirOuvert}
      class="fixed inset-y-0 left-0 z-[55] flex h-app w-[85vw] max-w-xs flex-col bg-white pt-zone-sure pb-zone-sure pl-[env(safe-area-inset-left)] shadow-xl transition-[transform,visibility] duration-200 ease-out motion-reduce:transition-none dark:bg-slate-900 {panneauOuvert
        ? 'visible translate-x-0'
        : 'invisible -translate-x-full'} lg:visible lg:static lg:z-auto lg:h-auto lg:w-72 lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:rounded-2xl lg:border lg:border-gray-100 lg:p-0 lg:shadow-none lg:transition-none lg:dark:border-slate-700/50 lg:dark:bg-slate-800/50"
    >
      <div class="flex items-center justify-between gap-2 px-4 pt-3 lg:pt-4">
        <h2 id="titre-conversations" class="text-sm font-bold text-slate-900 dark:text-white">
          {t("chat.conversations")}
        </h2>
        <button
          type="button"
          aria-label={t("common.close")}
          on:click={() => (panneauOuvert = false)}
          class="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-gray-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white lg:hidden"
        >
          <span class="material-icons" aria-hidden="true">close</span>
        </button>
      </div>

      <div class="px-4 pt-3">
        <button
          on:click={() => nouvelleConversation()}
          data-testid="chat-new"
          class="min-h-11 w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 lg:min-h-0"
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
            class="mt-2 text-xs text-slate-500 dark:text-slate-400"
          >
            {t("common.loading")}
          </p>
        {:else if conversationsErreur}
          <div
            role="alert"
            data-testid="conversations-error"
            class="mt-2 rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-700 dark:text-red-300"
          >
            <p>{conversationsErreur}</p>
            <button
              on:click={chargerConversations}
              data-testid="conversations-retry"
              class="-mx-2 inline-flex min-h-11 items-center px-2 font-medium underline hover:no-underline lg:mx-0 lg:mt-1 lg:min-h-0 lg:px-0"
            >
              {t("common.retry")}
            </button>
          </div>
        {:else if conversations.length === 0}
          <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
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
                  class="min-h-11 min-w-0 flex-1 truncate rounded-lg px-2 py-2.5 text-left text-sm transition-colors lg:min-h-0 lg:py-1.5 lg:text-xs {conversation.session_id ===
                  sessionId
                    ? 'bg-blue-50 dark:bg-slate-700 font-semibold text-blue-700 dark:text-blue-300'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'}"
                >
                  {conversation.title || t("chat.untitledConversation")}
                </button>
                <!-- 44 px sous lg : collé au titre et effaçant sans
                     confirmation, il se touchait par erreur du pouce. -->
                <button
                  on:click={() => supprimerConversation(conversation)}
                  data-testid="conversation-delete"
                  aria-label="{t('chat.deleteConversation')} : {conversation.title ||
                    t('chat.untitledConversation')}"
                  class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:text-red-600 lg:h-auto lg:w-auto lg:px-1.5 lg:py-1"
                >
                  <span class="material-icons text-lg lg:text-sm" aria-hidden="true">delete_outline</span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </aside>
  {/if}

  <!-- `sm:dark:` : les variantes `dark:` sortent avant celles de largeur, un
       `sm:border-gray-100` seul l'emporterait aussi en mode sombre. -->
  <div
    class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white dark:bg-slate-800/50 sm:rounded-2xl sm:border sm:border-gray-100 sm:shadow-xl sm:dark:border-slate-700/50 sm:dark:shadow-none"
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
      class="shrink-0 border-b border-gray-100 bg-gray-50 pt-zone-sure dark:border-slate-700 dark:bg-slate-800 lg:pt-0"
    >
      <div
        class="flex min-h-14 items-center gap-1 px-1 py-1 sm:gap-2 sm:px-2 lg:min-h-0 lg:px-6 lg:py-4 court:min-h-0 court:py-0"
      >
        <a
          href="/"
          aria-label={t("chat.backHome")}
          class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-700/60 lg:hidden"
        >
          <span class="material-icons" aria-hidden="true">arrow_back</span>
        </a>

        <span class="hidden h-2 w-2 shrink-0 rounded-full bg-emerald-500 motion-safe:animate-pulse lg:block"></span>
        <span
          class="hidden text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 lg:inline"
        >
          {$language.current === "fr"
            ? "IA Juridique Camerounaise V2.0"
            : "Cameroonian Legal AI V2.0"}
        </span>

        <!-- Le profil auquel le chat répond : celui de la conversation en cours,
             sinon le profil choisi. Sous lg, le bouton porte le titre de la
             barre et le profil sur deux lignes (le tout en 44 px de haut) ; à
             partir de lg, il redevient le lien « Changer ». -->
        <div
          class="flex min-w-0 flex-1 items-center gap-2 text-xs text-slate-600 dark:text-slate-300 lg:ml-auto lg:flex-none"
          data-testid="chat-persona"
          data-persona={personaAffiche ?? "general"}
        >
          <span
            class="material-icons hidden text-base text-blue-600 dark:text-blue-400 lg:inline-block"
            aria-hidden="true">{PERSONA_ICONE[personaAffiche ?? "general"]}</span
          >
          <span class="hidden lg:inline">{t("persona.chatLabel")} : <strong>{nomDuProfil}</strong></span>
          <button
            type="button"
            data-testid="chat-persona-change"
            aria-haspopup="dialog"
            on:click={() => ouvrirChoixPersona(personaAffiche)}
            class="flex min-h-11 min-w-0 flex-1 flex-col items-start justify-center rounded-lg px-2 text-left hover:bg-gray-100 dark:hover:bg-slate-700/60 lg:min-h-0 lg:flex-none lg:rounded-md lg:py-0.5 lg:font-semibold lg:text-blue-700 lg:underline lg:hover:bg-transparent lg:hover:no-underline lg:dark:text-blue-300 lg:dark:hover:bg-transparent"
          >
            <span
              class="block max-w-full truncate text-sm font-semibold leading-5 text-slate-900 dark:text-white lg:hidden"
              >{t("chat.barTitle")}</span
            >
            <span
              class="flex max-w-full items-center gap-1 leading-4 text-slate-500 dark:text-slate-400 lg:hidden"
            >
              <span
                class="material-icons shrink-0 text-sm text-blue-600 dark:text-blue-400"
                aria-hidden="true">{PERSONA_ICONE[personaAffiche ?? "general"]}</span
              >
              <span class="min-w-0 truncate">{t("persona.chatLabel")} : {nomDuProfil}</span>
              <span class="material-icons shrink-0 text-sm" aria-hidden="true">expand_more</span>
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
            class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-700/60 lg:hidden"
          >
            <span class="material-icons" aria-hidden="true">forum</span>
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
          class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-700/60 lg:hidden"
        >
          <span class="material-icons" aria-hidden="true">{menuOuvert ? "close" : "menu"}</span>
        </button>
      </div>

      <!-- Dans le flux, comme le menu mobile de l'en-tête : la conversation
           rétrécit le temps qu'il est ouvert, rien ne la recouvre. -->
      {#if menuOuvert}
        <nav
          id="chat-menu"
          data-testid="chat-menu"
          aria-label={t("a11y.menu")}
          class="border-t border-gray-100 px-2 py-2 dark:border-slate-700 lg:hidden"
        >
          <ul class="grid grid-cols-2 gap-1">
            {#each NAV_LINKS as lien (lien.href)}
              <li>
                <a
                  href={lien.href}
                  class="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-700/60"
                  >{t(lien.key)}</a
                >
              </li>
            {/each}
          </ul>
          <div class="mt-2 flex items-center gap-1 border-t border-gray-100 pt-2 dark:border-slate-700">
            <button
              type="button"
              aria-label="{t('a11y.switchTo')} français"
              aria-pressed={$language.current === "fr"}
              on:click={() => switchLanguage("fr")}
              class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-xs font-bold {$language.current ===
              'fr'
                ? 'bg-blue-50 text-blue-700 dark:bg-white/10 dark:text-blue-300'
                : 'text-slate-600 dark:text-slate-300'}">FR</button
            >
            <button
              type="button"
              aria-label="{t('a11y.switchTo')} English"
              aria-pressed={$language.current === "en"}
              on:click={() => switchLanguage("en")}
              class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-xs font-bold {$language.current ===
              'en'
                ? 'bg-blue-50 text-blue-700 dark:bg-white/10 dark:text-blue-300'
                : 'text-slate-600 dark:text-slate-300'}">EN</button
            >
            <button
              type="button"
              aria-label={t("a11y.toggleTheme")}
              on:click={themeStore.toggle}
              class="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-700/60"
            >
              <!-- Les deux icônes, alternées par la classe `dark`, comme dans
                   l'en-tête. -->
              <span class="material-icons dark:hidden" aria-hidden="true">dark_mode</span>
              <span class="material-icons hidden dark:inline-block" aria-hidden="true">light_mode</span>
            </button>
          </div>
        </nav>
      {/if}
    </div>

    <!-- Messages Area -->
    <!--
      role="log" + aria-live="polite" : les reponses de l'assistant et
      l'indicateur « en train d'ecrire » n'etaient jamais annonces. Un
      utilisateur de lecteur d'ecran envoyait sa question et n'entendait plus
      rien.

      L'annonce est sur le CONTENEUR, pas sur chaque message : la poser aux deux
      niveaux ferait lire chaque reponse deux fois.

      Il prend toute la hauteur restante et défile seul. Il mesurait 400 à
      500 px quelle que soit la taille de l'écran : plus haut que l'écran d'un
      téléphone en paysage, et la saisie tombait sous la ligne de flottaison.
      `overscroll-contain` : arrivé en haut, le geste ne recharge pas la page.
    -->
    <div class="relative flex min-h-0 flex-1 flex-col">
      <div
        bind:this={messagesContainer}
        role="log"
        aria-live="polite"
        aria-label={t("chat.header")}
        on:scroll={mesurerColle}
        class="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-3 py-4 sm:space-y-6 sm:p-6 court:py-2 sm:court:py-2"
      >
        {#each messagesAffiches as message (message.id)}
          <div
            data-message-id={message.id}
            class="flex gap-2 sm:gap-4 {message.type === 'user' ? 'flex-row-reverse' : ''}"
          >
            <!-- Avatar. Celui de l'utilisateur disparaît sous sm : la bulle
                 alignée à droite suffit à dire qui parle, et ces 40 px
                 manquaient au texte. -->
            <div class="shrink-0 {message.type === 'user' ? 'hidden sm:block' : ''}">
              {#if message.type === "error"}
                <div
                  class="flex h-8 w-8 items-center justify-center rounded-full bg-red-500 shadow-lg shadow-red-500/30 sm:h-10 sm:w-10"
                >
                  <span class="material-icons text-base text-white sm:text-lg" aria-hidden="true">cloud_off</span>
                </div>
              {:else if message.type === "assistant"}
                <div
                  class="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/30 sm:h-10 sm:w-10"
                >
                  <span class="material-icons text-base text-white sm:text-lg" aria-hidden="true">smart_toy</span>
                </div>
              {:else}
                <div
                  class="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 shadow-lg shadow-blue-500/30 sm:h-10 sm:w-10"
                >
                  <span class="material-icons text-base text-white sm:text-lg" aria-hidden="true">person</span>
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
                  class="coupe-mots inline-block max-w-[85%] rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-left dark:border-red-900/40 dark:bg-red-900/20 sm:max-w-md sm:px-5 sm:py-3"
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
                     ligne (Maj+Entrée), qui sont gardés. -->
                <div
                  class="coupe-mots inline-block max-w-[85%] rounded-2xl rounded-tr-none bg-gray-100 px-4 py-2.5 text-left dark:bg-slate-700 sm:max-w-md sm:px-5 sm:py-3"
                >
                  <p class="whitespace-pre-wrap text-slate-800 dark:text-white">{message.content}</p>
                  {#if message.timestamp}
                    <span class="mt-1 block text-xs text-slate-500 dark:text-slate-300 sm:mt-2"
                      >{message.timestamp}</span
                    >
                  {/if}
                </div>
              {:else}
                <div class="space-y-3">
                  <!--
                    Rendu en NOEUDS Svelte, donc echappe par construction. Le
                    prompt systeme du backend demande du markdown ; `{message.content}`
                    l'affichait tel quel, astérisques comprises — c'est ce que
                    montrait la capture « **Réponse directe** ». `blocsDeReponse`
                    le reconnait ici plutot que de passer par `{@html}`, que ce
                    depot s'interdit (voir la docstring de $lib/texte.ts). Meme
                    motif que src/routes/laws/[id]/+page.svelte.

                    `coupe-mots` : une cote (« N°2018/9387/CAB/PM ») ou une URL
                    ne pousse plus la conversation hors de l'écran.
                  -->
                  <div
                    class="coupe-mots space-y-3 text-left leading-relaxed text-slate-700 dark:text-slate-200"
                  >
                    {#each blocsDe(message) as bloc, i (i)}
                      {#if bloc.type === "titre"}
                        <h5 class="font-bold text-slate-900 dark:text-white pt-1">
                          {bloc.texte}
                        </h5>
                      {:else if bloc.type === "puce" && bloc.numero !== undefined}
                        <!-- Le numero est du texte reel, lu par les lecteurs
                             d'ecran, et non un `content:` CSS. -->
                        <p class="pl-7 relative">
                          <span
                            class="absolute left-0 w-6 text-right font-semibold text-blue-600 dark:text-blue-400"
                            >{bloc.numero}.</span
                          >
                          {bloc.texte}
                        </p>
                      {:else if bloc.type === "puce"}
                        <p
                          class="pl-5 relative before:content-['•'] before:absolute before:left-1 before:text-blue-600 dark:before:text-blue-400"
                        >
                          {bloc.texte}
                        </p>
                      {:else if bloc.type === "tableau"}
                        <!-- Un tableau large défile de côté DANS son cadre, au
                             lieu d'élargir la conversation. Ses mots ne se
                             coupent pas n'importe où (`overflow-wrap` normal) :
                             des colonnes réduites à une lettre seraient
                             illisibles. Cellules en nœuds de texte, comme le
                             reste. -->
                        <div class="overflow-x-auto overscroll-x-contain [overflow-wrap:normal]">
                          <table class="min-w-full border-collapse text-sm">
                            {#if bloc.entetes && bloc.entetes.length > 0}
                              <thead>
                                <tr>
                                  {#each bloc.entetes as entete, c (c)}
                                    <th
                                      scope="col"
                                      class="whitespace-pre-line border-b border-slate-200 px-2 py-1.5 text-left font-semibold text-slate-900 dark:border-slate-600 dark:text-white"
                                      >{entete}</th
                                    >
                                  {/each}
                                </tr>
                              </thead>
                            {/if}
                            <tbody>
                              {#each bloc.lignes ?? [] as rangee, r (r)}
                                <tr class="border-b border-slate-100 last:border-0 dark:border-slate-700">
                                  {#each rangee as cellule, c (c)}
                                    <td class="whitespace-pre-line px-2 py-1.5 align-top">{cellule}</td>
                                  {/each}
                                </tr>
                              {/each}
                            </tbody>
                          </table>
                        </div>
                      {:else if bloc.type === "code"}
                        <!-- Retours à la ligne gardés, lignes longues repliées :
                             un modèle de courrier dans un bloc de code ne doit
                             pas se lire en faisant défiler l'écran de côté. -->
                        <pre
                          class="overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-100 px-3 py-2 font-mono text-sm leading-relaxed text-slate-800 dark:bg-slate-900/60 dark:text-slate-100"><code>{bloc.texte}</code></pre>
                      {:else}
                        <p>{bloc.texte}</p>
                      {/if}
                    {/each}
                  </div>

                  {#if message.sources && message.sources.length > 0}
                    <div
                      class="text-left border-t border-slate-100 dark:border-slate-700 pt-3"
                    >
                      <!-- À partir de sm, le titre « Sources », seul dans son
                           élément (les tests le cherchent au mot près). Sous
                           sm, à sa place, le bouton qui déplie la liste et dit
                           combien elle compte de sources. -->
                      <p class="mb-2 hidden text-xs font-medium text-slate-500 dark:text-slate-400 sm:block">
                        {$language.current === "fr" ? "Sources" : "Sources"}
                      </p>
                      <button
                        type="button"
                        data-testid="chat-sources-toggle"
                        aria-expanded={Boolean(sourcesDepliees[message.id])}
                        aria-controls="sources-{message.id}"
                        on:click={() => basculerSources(message.id)}
                        class="-ml-2 -mt-3 inline-flex min-h-11 items-center gap-1 px-2 text-xs font-semibold text-blue-700 dark:text-blue-300 sm:hidden"
                      >
                        <span class="material-icons text-base" aria-hidden="true"
                          >{sourcesDepliees[message.id] ? "expand_less" : "expand_more"}</span
                        >
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
                              class="block min-w-0 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 hover:border-primary hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            >
                              <span class="coupe-mots block text-sm font-medium text-slate-800 dark:text-white line-clamp-2">
                                {libelleDeSource(source)}
                              </span>
                              {#if source.law_title && source.law_title !== nomCourtDuTexte(source.law_title, source.law_reference)}
                                <span class="block truncate text-xs text-slate-500 dark:text-slate-400" title={source.law_title}>
                                  {source.law_title}
                                </span>
                              {/if}
                              <span class="coupe-mots mt-1 block text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                                {source.excerpt}
                              </span>
                            </a>
                          </li>
                        {/each}
                      </ul>
                    </div>
                  {/if}

                  {#if message.details}
                    <ul class="space-y-2 ml-4 text-left">
                      {#each message.details as detail, i (i)}
                        <li class="text-slate-600 dark:text-slate-300">
                          • <strong class="text-slate-800 dark:text-white"
                            >{detail.title}</strong
                          >, {detail.description}
                        </li>
                      {/each}
                    </ul>
                  {/if}

                  {#if message.suggestions}
                    <!-- Empilées sur toute la largeur sous sm : en pastilles
                         rondes, une suggestion de 80 caractères tenait sur
                         quatre lignes serrées contre les bords arrondis. -->
                    <div
                      class="mt-4 flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center"
                      data-testid="chat-suggestions"
                    >
                      <span class="text-sm text-slate-500 dark:text-slate-400">{t("chat.suggestionsLabel")}</span>
                      {#each message.suggestions as suggestion (suggestion)}
                        <button
                          on:click={() => handleSuggestionClick(suggestion)}
                          data-testid="chat-suggestion"
                          disabled={envoiEnCours}
                          class="min-h-11 w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-left text-sm font-medium leading-snug text-blue-600 transition-colors hover:border-blue-500 hover:bg-blue-500 hover:text-white active:border-blue-500 active:bg-blue-500 active:text-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400 sm:min-h-0 sm:w-auto sm:rounded-full sm:px-4 sm:py-1.5 sm:text-center"
                        >
                          {suggestion}
                        </button>
                      {/each}
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          </div>
        {/each}

        {#if isTyping}
          <div class="flex gap-2 sm:gap-4">
            <div
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 sm:h-10 sm:w-10"
            >
              <span class="material-icons text-base text-white sm:text-lg" aria-hidden="true">smart_toy</span>
            </div>
            <div
              class="flex items-center gap-1 px-4 py-3 bg-gray-100 dark:bg-slate-700 rounded-2xl"
            >
              <span
                class="w-2 h-2 bg-slate-400 rounded-full motion-safe:animate-bounce"
                style="animation-delay: 0ms"
              ></span>
              <span
                class="w-2 h-2 bg-slate-400 rounded-full motion-safe:animate-bounce"
                style="animation-delay: 150ms"
              ></span>
              <span
                class="w-2 h-2 bg-slate-400 rounded-full motion-safe:animate-bounce"
                style="animation-delay: 300ms"
              ></span>
            </div>
          </div>
        {/if}
      </div>

      <!-- Le lecteur est remonté : un appui le ramène au dernier message. -->
      {#if !colle}
        <button
          type="button"
          data-testid="chat-scroll-latest"
          aria-label={t("chat.scrollToLatest")}
          on:click={allerAuDernier}
          transition:fade={{ duration: duree(150) }}
          class="absolute bottom-3 right-3 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-700 shadow-lg ring-1 ring-black/5 hover:bg-gray-50 dark:bg-slate-700 dark:text-white dark:ring-white/10 dark:hover:bg-slate-600"
        >
          <span class="material-icons" aria-hidden="true">arrow_downward</span>
        </button>
      {/if}
    </div>

    <!-- Input Area. `pb-zone-sure` : au-dessus de la barre d'accueil de
         l'iPhone, et non dessous. -->
    <div
      class="shrink-0 border-t border-gray-100 bg-gray-50 pb-zone-sure dark:border-slate-700 dark:bg-slate-800/50"
    >
      <div
        class="px-2 pt-2 sm:px-4 sm:pt-4 {$authStore.isAuthenticated
          ? 'pb-2 sm:pb-4'
          : 'sm:pb-3'} court:py-1.5 sm:court:py-1.5"
      >
        <div
          class="flex items-end gap-2 rounded-xl border-2 border-gray-200 bg-white py-1 pl-3 pr-1 transition-colors focus-within:border-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:focus-within:border-blue-500 sm:gap-3 sm:pl-4"
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
            class="block max-h-40 w-full min-w-0 flex-1 resize-none overflow-y-auto border-none bg-transparent px-0 py-2.5 text-base leading-6 text-slate-800 placeholder-slate-400 [field-sizing:content] focus:ring-0 dark:text-white"
          ></textarea>
          <!-- Le trombone est retiré : aucun endpoint n'accepte de pièce jointe
               conversationnelle (/upload et /batch-upload sont réservés à l'admin
               authentifié), et le bouton n'avait de toute façon aucun on:click. -->
          <!-- `mousedown` sans effet par défaut : le focus reste dans le
               champ, et le clavier du téléphone ne se referme pas à chaque
               envoi. -->
          <button
            on:click={() => handleSendChatMessage()}
            on:mousedown={(event) => event.preventDefault()}
            disabled={!chatInput.trim() || envoiEnCours}
            aria-label={t("chat.send")}
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-500 text-white transition-all hover:scale-105 hover:bg-blue-600 disabled:bg-gray-300 disabled:hover:scale-100 motion-reduce:transform-none dark:disabled:bg-slate-600"
          >
            <span class="material-icons" aria-hidden="true">send</span>
          </button>
        </div>

        {#if !$authStore.isAuthenticated}
          <!-- L'invitation n'apparait qu'aux visiteurs anonymes : le chat reste
               pleinement utilisable sans compte, le compte n'ajoute que la memoire.
               Masquée sur écran court (paysage, clavier ouvert sur Android) :
               chaque ligne y manque à la conversation. -->
          <p class="text-center text-xs text-slate-500 dark:text-slate-400 sm:mt-2 court:hidden">
            <a
              href="/signup"
              data-testid="chat-signup-link"
              class="inline-flex min-h-11 items-center font-medium text-blue-600 hover:underline dark:text-blue-400 sm:min-h-0"
              >{t("chat.signInToKeep")}</a
            >
          </p>
        {/if}
      </div>
    </div>
  </div>
</div>
