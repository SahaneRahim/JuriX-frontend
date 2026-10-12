<script lang="ts">
  import { apiFetch } from "$lib/api";
  import {
    ecrireSessionChat,
    effacerSessionChat,
    lireSessionChat,
  } from "$lib/chat-session";
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
  import { suggestionsPour } from "$lib/suggestions";
  import { libelleDeSource, nomCourtDuTexte } from "$lib/sources";
  import { cleDErreurHttp } from "$lib/chat-erreurs";
  import type { ConversationSummary } from "$lib/types";
  import { page } from "$app/stores";
  import { get } from "svelte/store";
  import { onMount, tick } from "svelte";
  import { formatHeure } from "$lib/format";
  import { blocsDeReponse } from "$lib/texte";
  import { lireEvenements } from "$lib/flux";
  import { language, tr } from "$lib/stores/language";
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

  // Reactive translation shorthand
  $: t = $tr;

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

  // ---------------------------------------------------------------------------
  // Panneau des conversations
  //
  // Rendu uniquement pour un compte connecté : une conversation anonyme
  // n'appartient à personne, donc aucune liste ne peut la contenir.
  // ---------------------------------------------------------------------------

  let conversations: ConversationSummary[] = [];
  let conversationsEnCours = false;
  let conversationsErreur = "";
  let panneauOuvert = false;

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
    panneauOuvert = false;
    await scrollToBottom();
  }

  async function supprimerConversation(conversation: ConversationSummary) {
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
    if (sessionId === conversation.session_id) nouvelleConversation();
  }

  /** Annule la réponse qui arrive peut-être encore, et l'oublie. */
  function abandonnerLaReponseEnCours() {
    generation += 1;
    controleur?.abort();
    controleur = null;
    isTyping = false;
    envoiEnCours = false;
  }

  function nouvelleConversation() {
    abandonnerLaReponseEnCours();
    // « Réessayer » ne doit pas reposer, sous le nouveau profil, la question
    // de la conversation quittée.
    lastQuestion = "";
    sessionId = null;
    personaConversation = null;
    conversationRestauree = false;
    chatMessages = [];
    effacerSessionChat();
    panneauOuvert = false;
  }

  async function scrollToBottom() {
    await tick();
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
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
    chatInput = "";
    isTyping = true;

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
        await scrollToBottom();
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
        } else {
          const actuel = chatMessages.find((m) => m.id === idReponse);
          ajouterAuMessage({ content: (actuel?.content ?? "") + evenement.chunk });
        }
        await scrollToBottom();
      }

      if (evenement.done) {
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

    // Flux interrompu avant sa fin (réseau, serveur arrêté)
    if (!termine && gen === generation) {
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
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendChatMessage();
    }
  }

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

    scrollToBottom();
    return () => {
      desabonner();
      controleur?.abort();
    };
  });
</script>

<!-- Hors index : une session de conversation n'a pas de contenu stable, et la
     page ne rend rien avant que l'utilisateur ait ecrit. -->
<MetaSeo titre={t("chat.header")} indexable={false} />

<div
  class="w-full mb-12 {$authStore.isAuthenticated
    ? 'max-w-6xl md:flex md:items-start md:gap-6'
    : 'max-w-3xl'}"
>
  <!-- Le h1 du layout est masque sur cette route (le hero marketing n'a rien a
       faire au-dessus d'une conversation). La page se retrouvait sans aucun
       titre : celui-ci est visuellement masque mais annonce par les lecteurs
       d'ecran. -->
  <h1 class="sr-only">{t("chat.header")}</h1>

  {#if $authStore.isAuthenticated}
    <!--
      Panneau des conversations. Un <h2>, et non un second <h1> : le spec
      d'accessibilite exige exactement un h1 par page.

      Rendu pour un compte seulement : une conversation anonyme n'appartient a
      personne, donc aucune liste ne peut la contenir.
    -->
    <aside
      data-testid="conversations-panel"
      class="mb-6 md:mb-0 md:w-72 md:shrink-0 rounded-2xl border border-gray-100 dark:border-slate-700/50 bg-white dark:bg-slate-800/50 p-4"
    >
      <div class="flex items-center justify-between gap-2">
        <h2 class="text-sm font-bold text-slate-900 dark:text-white">
          {t("chat.conversations")}
        </h2>
        <!-- Sous md, le panneau se replie : deploye, il mangerait l'ecran
             avant meme qu'on voie la conversation. -->
        <button
          class="md:hidden text-xs underline text-slate-500 dark:text-slate-400"
          data-testid="conversations-toggle"
          aria-expanded={panneauOuvert}
          aria-controls="liste-conversations"
          on:click={() => (panneauOuvert = !panneauOuvert)}
        >
          {panneauOuvert ? t("common.close") : t("chat.conversations")}
        </button>
      </div>

      <button
        on:click={nouvelleConversation}
        data-testid="chat-new"
        class="mt-3 w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
      >
        {t("chat.newConversation")}
      </button>

      <div id="liste-conversations" class:hidden={!panneauOuvert} class="md:block">
        {#if conversationsEnCours}
          <p
            role="status"
            aria-live="polite"
            class="mt-4 text-xs text-slate-500 dark:text-slate-400"
          >
            {t("common.loading")}
          </p>
        {:else if conversationsErreur}
          <div
            role="alert"
            data-testid="conversations-error"
            class="mt-4 rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-700 dark:text-red-300"
          >
            <p>{conversationsErreur}</p>
            <button
              on:click={chargerConversations}
              data-testid="conversations-retry"
              class="mt-1 underline font-medium hover:no-underline"
            >
              {t("common.retry")}
            </button>
          </div>
        {:else if conversations.length === 0}
          <p class="mt-4 text-xs text-slate-500 dark:text-slate-400">
            {t("chat.conversationsEmpty")}
          </p>
        {:else}
          <ul class="mt-4 space-y-1">
            {#each conversations as conversation (conversation.session_id)}
              <li class="flex items-center gap-1">
                <button
                  on:click={() => ouvrirConversation(conversation)}
                  data-testid="conversation-item"
                  aria-current={conversation.session_id === sessionId ? "true" : undefined}
                  class="flex-1 truncate rounded-lg px-2 py-1.5 text-left text-xs transition-colors {conversation.session_id ===
                  sessionId
                    ? 'bg-blue-50 dark:bg-slate-700 font-semibold text-blue-700 dark:text-blue-300'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'}"
                >
                  {conversation.title || t("chat.untitledConversation")}
                </button>
                <button
                  on:click={() => supprimerConversation(conversation)}
                  data-testid="conversation-delete"
                  aria-label="{t('chat.deleteConversation')} : {conversation.title ||
                    t('chat.untitledConversation')}"
                  class="shrink-0 rounded px-1.5 py-1 text-slate-400 transition-colors hover:text-red-600"
                >
                  <span class="material-icons text-sm" aria-hidden="true">delete_outline</span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </aside>
  {/if}

  <div class="min-w-0 flex-1">
  <div
    class="bg-white dark:bg-slate-800/50 rounded-2xl shadow-xl dark:shadow-none border border-gray-100 dark:border-slate-700/50 overflow-hidden"
  >
    <!-- Version Badge -->
    <div
      class="flex flex-wrap items-center gap-2 px-6 py-4 bg-gray-50 dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700"
    >
      <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
      <span
        class="text-xs font-semibold text-emerald-700 dark:text-emerald-400 tracking-wider uppercase"
      >
        {$language.current === "fr"
          ? "IA Juridique Camerounaise V2.0"
          : "Cameroonian Legal AI V2.0"}
      </span>
      <!-- Le profil auquel le chat répond : celui de la conversation en cours,
           sinon le profil choisi. -->
      <div
        class="ml-auto flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"
        data-testid="chat-persona"
        data-persona={personaAffiche ?? "general"}
      >
        <span class="material-icons text-base text-blue-600 dark:text-blue-400" aria-hidden="true"
          >{PERSONA_ICONE[personaAffiche ?? "general"]}</span
        >
        <span>{t("persona.chatLabel")} : <strong>{nomDuProfil}</strong></span>
        <button
          type="button"
          data-testid="chat-persona-change"
          aria-haspopup="dialog"
          on:click={() => ouvrirChoixPersona(personaAffiche)}
          class="rounded-md px-2 py-0.5 font-semibold text-blue-700 underline hover:no-underline dark:text-blue-300"
          >{t("persona.change")}</button
        >
      </div>
    </div>

    <!-- Messages Area -->
    <!--
      role="log" + aria-live="polite" : les reponses de l'assistant et
      l'indicateur « en train d'ecrire » n'etaient jamais annonces. Un
      utilisateur de lecteur d'ecran envoyait sa question et n'entendait plus
      rien.

      L'annonce est sur le CONTENEUR, pas sur chaque message : la poser aux deux
      niveaux ferait lire chaque reponse deux fois.
    -->
    <div
      bind:this={messagesContainer}
      role="log"
      aria-live="polite"
      aria-label={t("chat.header")}
      class="p-6 space-y-6 min-h-[400px] max-h-[500px] overflow-y-auto"
    >
      {#each messagesAffiches as message (message.id)}
        <div
          class="flex gap-4 {message.type === 'user' ? 'flex-row-reverse' : ''}"
        >
          <!-- Avatar -->
          <div class="flex-shrink-0">
            {#if message.type === "error"}
              <div
                class="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/30"
              >
                <span class="material-icons text-white text-lg" aria-hidden="true">cloud_off</span>
              </div>
            {:else if message.type === "assistant"}
              <div
                class="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30"
              >
                <span class="material-icons text-white text-lg" aria-hidden="true">smart_toy</span>
              </div>
            {:else}
              <div
                class="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/30"
              >
                <span class="material-icons text-white text-lg" aria-hidden="true">person</span>
              </div>
            {/if}
          </div>

          <!-- Message Content -->
          <div class="flex-1 {message.type === 'user' ? 'text-right' : ''}">
            {#if message.type === "error"}
              <div
                role="alert"
                data-testid="chat-error"
                class="inline-block bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded-2xl px-5 py-3 max-w-md text-left"
              >
                <p class="text-red-700 dark:text-red-300">{message.content}</p>
                <button
                  on:click={() => handleSendChatMessage(lastQuestion)}
                  data-testid="chat-retry"
                  class="mt-2 text-sm font-semibold text-red-700 dark:text-red-300 underline"
                  >{t("common.retry")}</button
                >
              </div>
            {:else if message.type === "user"}
              <div
                class="inline-block bg-gray-100 dark:bg-slate-700 rounded-2xl rounded-tr-none px-5 py-3 max-w-md text-left"
              >
                <p class="text-slate-800 dark:text-white">{message.content}</p>
                <span class="text-xs text-slate-500 mt-2 block"
                  >{message.timestamp}</span
                >
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
                -->
                <div
                  class="space-y-3 text-slate-700 dark:text-slate-200 leading-relaxed text-left"
                >
                  {#each blocsDeReponse(message.content) as bloc, i (i)}
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
                    {:else}
                      <p>{bloc.texte}</p>
                    {/if}
                  {/each}
                </div>

                {#if message.sources && message.sources.length > 0}
                  <div
                    class="text-left border-t border-slate-100 dark:border-slate-700 pt-3"
                  >
                    <p class="text-xs font-medium text-slate-500 mb-2">
                      {$language.current === "fr" ? "Sources" : "Sources"}
                    </p>
                    <ul class="space-y-2">
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
                            class="block rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 hover:border-primary hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                          >
                            <span class="block text-sm font-medium text-slate-800 dark:text-white line-clamp-2">
                              {libelleDeSource(source)}
                            </span>
                            {#if source.law_title && source.law_title !== nomCourtDuTexte(source.law_title, source.law_reference)}
                              <span class="block truncate text-xs text-slate-500 dark:text-slate-400" title={source.law_title}>
                                {source.law_title}
                              </span>
                            {/if}
                            <span class="mt-1 block text-xs text-slate-500 line-clamp-2">
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
                  <div class="flex flex-wrap items-center gap-2 mt-4" data-testid="chat-suggestions">
                    <span class="text-sm text-slate-500">{t("chat.suggestionsLabel")}</span>
                    {#each message.suggestions as suggestion (suggestion)}
                      <button
                        on:click={() => handleSuggestionClick(suggestion)}
                        data-testid="chat-suggestion"
                        disabled={envoiEnCours}
                        class="disabled:opacity-50 disabled:cursor-not-allowed px-4 py-1.5 text-sm font-medium rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 hover:bg-blue-500 hover:text-white hover:border-blue-500 transition-all"
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
        <div class="flex gap-4">
          <div
            class="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center"
          >
            <span class="material-icons text-white text-lg" aria-hidden="true">smart_toy</span>
          </div>
          <div
            class="flex items-center gap-1 px-4 py-3 bg-gray-100 dark:bg-slate-700 rounded-2xl"
          >
            <span
              class="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
              style="animation-delay: 0ms"
            ></span>
            <span
              class="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
              style="animation-delay: 150ms"
            ></span>
            <span
              class="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
              style="animation-delay: 300ms"
            ></span>
          </div>
        </div>
      {/if}
    </div>

    <!-- Input Area -->
    <div
      class="p-4 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50"
    >
      <div
        class="flex items-center gap-3 bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2 focus-within:border-blue-500 dark:focus-within:border-blue-500 transition-colors"
      >
        <input
          type="text"
          bind:value={chatInput}
          aria-label={t("a11y.chatInput")}
          on:keydown={handleChatKeydown}
          placeholder={t("chat.placeholder")}
          class="flex-1 bg-transparent border-none focus:ring-0 text-slate-800 dark:text-white placeholder-slate-400 py-2"
        />
        <!-- Le trombone est retiré : aucun endpoint n'accepte de pièce jointe
             conversationnelle (/upload et /batch-upload sont réservés à l'admin
             authentifié), et le bouton n'avait de toute façon aucun on:click. -->
        <button
          on:click={() => handleSendChatMessage()}
          disabled={!chatInput.trim() || envoiEnCours}
          aria-label={t("chat.send")}
          class="w-10 h-10 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-slate-600 text-white flex items-center justify-center transition-all hover:scale-105 disabled:hover:scale-100"
        >
          <span class="material-icons" aria-hidden="true">send</span>
        </button>
      </div>
    </div>
  </div>

  {#if !$authStore.isAuthenticated}
    <!-- L'invitation n'apparait qu'aux visiteurs anonymes : le chat reste
         pleinement utilisable sans compte, le compte n'ajoute que la memoire. -->
    <p class="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
      <a href="/signup" data-testid="chat-signup-link" class="font-medium text-blue-600 hover:underline dark:text-blue-400"
        >{t("chat.signInToKeep")}</a
      >
    </p>
  {/if}
  </div>
</div>
