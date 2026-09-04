<script lang="ts">
  import { API_URL } from '$lib/api';
  import { onMount, tick } from "svelte";
  import { language, tr } from "$lib/stores/language";

// Chat message types
  interface ChatMessage {
    id: number;
    type: "assistant" | "user";
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
  let messagesContainer: HTMLDivElement;

  // Reactive translation shorthand
  $: t = $tr;

  // Chat messages state – initialized reactively so welcome message updates with language
  let chatMessages: ChatMessage[] = [];
  let initialized = false;

  function initMessages() {
    chatMessages = [
      {
        id: 1,
        type: "assistant",
        content: t("chat.welcome"),
        suggestions:
          $language.current === "fr"
            ? ["Licenciement abusif", "Création d'entreprise", "Code pénal"]
            : ["Wrongful dismissal", "Business creation", "Criminal code"],
        timestamp: getCurrentTime(),
      },
    ];
    initialized = true;
  }

  // Re-init welcome message when language changes
  $: if ($language.current && !initialized) {
    initMessages();
  }

  function getCurrentTime(): string {
    return new Date().toLocaleTimeString(
      $language.current === "fr" ? "fr-FR" : "en-US",
      {
        hour: "2-digit",
        minute: "2-digit",
      },
    );
  }

  async function scrollToBottom() {
    await tick();
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  async function handleSendChatMessage() {
    if (!chatInput.trim()) return;

    const userMessage: ChatMessage = {
      id: chatMessages.length + 1,
      type: "user",
      content: chatInput,
      timestamp: getCurrentTime(),
    };

    chatMessages = [...chatMessages, userMessage];
    const query = chatInput;
    chatInput = "";
    isTyping = true;

    await scrollToBottom();

    try {
      const response = await fetch(`${API_URL}/rag/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          question: query,
          persona: "citoyen", // Default persona for general chat
          language: $language.current
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const aiMessage: ChatMessage = {
          id: chatMessages.length + 1,
          type: "assistant",
          content:
            data.answer ||
            ($language.current === "fr"
              ? "Je n'ai pas pu traiter votre demande."
              : "I couldn't process your request."),
          sources: data.sources || [],
          timestamp: getCurrentTime(),
        };
        chatMessages = [...chatMessages, aiMessage];
      } else {
        chatMessages = [
          ...chatMessages,
          {
            id: chatMessages.length + 1,
            type: "assistant",
            content:
              $language.current === "fr"
                ? "Je traite votre question. Veuillez patienter..."
                : "Processing your question. Please wait...",
            timestamp: getCurrentTime(),
          },
        ];
      }
    } catch (error) {
      chatMessages = [
        ...chatMessages,
        {
          id: chatMessages.length + 1,
          type: "assistant",
          content:
            $language.current === "fr"
              ? "Désolé, je ne peux pas me connecter au serveur. Veuillez réessayer."
              : "Sorry, I can't connect to the server. Please try again.",
          timestamp: getCurrentTime(),
        },
      ];
    } finally {
      isTyping = false;
      await scrollToBottom();
    }
  }

  function handleSuggestionClick(suggestion: string) {
    chatInput = suggestion;
  }

  function handleChatKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendChatMessage();
    }
  }

  onMount(() => {
    if (!initialized) initMessages();
    scrollToBottom();
  });
</script>

<svelte:head>
  <title>JuriX - {t("chat.header")}</title>
</svelte:head>

<div class="w-full max-w-3xl mb-12">
  <div
    class="bg-white dark:bg-slate-800/50 rounded-2xl shadow-xl dark:shadow-none border border-gray-100 dark:border-slate-700/50 overflow-hidden"
  >
    <!-- Version Badge -->
    <div
      class="flex items-center gap-2 px-6 py-4 bg-gray-50 dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700"
    >
      <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
      <span
        class="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tracking-wider uppercase"
      >
        {$language.current === "fr"
          ? "IA Juridique Camerounaise V2.0"
          : "Cameroonian Legal AI V2.0"}
      </span>
    </div>

    <!-- Messages Area -->
    <div
      bind:this={messagesContainer}
      class="p-6 space-y-6 min-h-[400px] max-h-[500px] overflow-y-auto"
    >
      {#each chatMessages as message (message.id)}
        <div
          class="flex gap-4 {message.type === 'user' ? 'flex-row-reverse' : ''}"
        >
          <!-- Avatar -->
          <div class="flex-shrink-0">
            {#if message.type === "assistant"}
              <div
                class="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30"
              >
                <span class="material-icons text-white text-lg">smart_toy</span>
              </div>
            {:else}
              <div
                class="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/30"
              >
                <span class="material-icons text-white text-lg">person</span>
              </div>
            {/if}
          </div>

          <!-- Message Content -->
          <div class="flex-1 {message.type === 'user' ? 'text-right' : ''}">
            {#if message.type === "user"}
              <div
                class="inline-block bg-gray-100 dark:bg-slate-700 rounded-2xl rounded-tr-none px-5 py-3 max-w-md text-left"
              >
                <p class="text-slate-800 dark:text-white">{message.content}</p>
                <span class="text-xs text-slate-400 mt-2 block"
                  >{message.timestamp}</span
                >
              </div>
            {:else}
              <div class="space-y-3">
                <p
                  class="text-slate-700 dark:text-slate-200 leading-relaxed text-left"
                >
                  {message.content}
                </p>

                {#if message.sources && message.sources.length > 0}
                  <div
                    class="text-left border-t border-slate-100 dark:border-slate-700 pt-3"
                  >
                    <p class="text-xs font-medium text-slate-400 mb-2">
                      {$language.current === "fr" ? "Sources" : "Sources"}
                    </p>
                    <ul class="space-y-2">
                      {#each message.sources as source}
                        <li>
                          <!-- article_number en parametre : la page /laws/[id]
                               reconstruit sa liste d'articles depuis le texte,
                               elle ne connait pas les identifiants de ligne. -->
                          <a
                            href={source.article_number
                              ? `/laws/${source.law_id}?article=${encodeURIComponent(source.article_number)}`
                              : `/laws/${source.law_id}`}
                            class="block rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 hover:border-primary hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                          >
                            <span class="text-sm font-medium text-slate-800 dark:text-white">
                              {source.law_reference}
                              {#if source.article_number}
                                — article {source.article_number}
                              {/if}
                            </span>
                            <span class="block text-xs text-slate-500 line-clamp-2">
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
                    {#each message.details as detail}
                      <li class="text-slate-600 dark:text-slate-300">
                        • <strong class="text-slate-800 dark:text-white"
                          >{detail.title}</strong
                        >, {detail.description}
                      </li>
                    {/each}
                  </ul>
                {/if}

                {#if message.suggestions}
                  <div class="flex flex-wrap items-center gap-2 mt-4">
                    <span class="text-sm text-slate-500"
                      >{$language.current === "fr"
                        ? "Suggestions:"
                        : "Suggestions:"}</span
                    >
                    {#each message.suggestions as suggestion}
                      <button
                        on:click={() => handleSuggestionClick(suggestion)}
                        class="px-4 py-1.5 text-sm font-medium rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 hover:bg-blue-500 hover:text-white hover:border-blue-500 transition-all"
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
            <span class="material-icons text-white text-lg">smart_toy</span>
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
          on:keydown={handleChatKeydown}
          placeholder={t("chat.placeholder")}
          class="flex-1 bg-transparent border-none focus:ring-0 text-slate-800 dark:text-white placeholder-slate-400 py-2"
        />
        <button
          class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
          title={$language.current === "fr"
            ? "Joindre un fichier"
            : "Attach a file"}
        >
          <span class="material-icons">attach_file</span>
        </button>
        <button
          on:click={handleSendChatMessage}
          disabled={!chatInput.trim()}
          class="w-10 h-10 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-slate-600 text-white flex items-center justify-center transition-all hover:scale-105 disabled:hover:scale-100"
        >
          <span class="material-icons">send</span>
        </button>
      </div>
    </div>
  </div>
</div>
