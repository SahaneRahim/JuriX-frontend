<script lang="ts">
  import { createEventDispatcher, afterUpdate } from "svelte";
  import { tr } from "$lib/stores/language";

  export let messages: Array<{
    role: "user" | "assistant";
    content: string;
    sources?: Array<{
      law_id: number;
      law_reference: string;
      law_title: string;
      article_number?: string;
      excerpt: string;
    }>;
  }> = [];
  export let loading: boolean = false;

  let input: string = "";
  let chatContainer: HTMLDivElement;

  const dispatch = createEventDispatcher();

  const suggestions = [
    "Licenciement abusif",
    "Création d'entreprise",
    "Droit de la famille",
  ];

  function parseMarkdown(text: string): string {
    if (!text) return "";
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    html = html.replace(
      /\*\*(.+?)\*\*/g,
      '<strong class="font-bold">$1</strong>',
    );
    html = html.replace(/__(.+?)__/g, '<strong class="font-bold">$1</strong>');
    html = html.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, "<em>$1</em>");
    html = html.replace(/(?<!_)_([^_]+?)_(?!_)/g, "<em>$1</em>");
    html = html.replace(/\n/g, "<br>");
    return html;
  }

  function handleSubmit(msg: string = input) {
    if (msg.trim() && !loading) {
      dispatch("send", { message: msg });
      input = "";
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }

  function scrollToBottom() {
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }

  afterUpdate(() => {
    scrollToBottom();
  });

  function getCurrentTime() {
    return new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
</script>

<div
  class="flex h-[75vh] sm:h-[650px] flex-col overflow-hidden rounded-3xl bg-[#F8F9FB] border border-slate-200 shadow-xl"
>
  <!-- Version Tag Header (Inside Scroll) -->
  <div class="flex-1 overflow-y-auto p-4 sm:p-6" bind:this={chatContainer}>
    <div class="mb-8 flex justify-center">
      <span
        class="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[10px] font-bold tracking-widest text-slate-400 uppercase shadow-sm border border-slate-100"
      >
        <span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
        {$tr("hero.badge")}
      </span>
    </div>

    <!-- Empty State / Welcome -->
    {#if messages.length === 0}
      <div class="flex flex-col gap-4">
        <!-- Bot Welcome Message -->
        <div class="flex gap-4">
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="2"
              stroke="currentColor"
              class="h-6 w-6"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
          </div>
          <div class="max-w-[85%]">
            <div
              class="rounded-2xl rounded-tl-sm bg-white p-5 shadow-sm border border-slate-100 text-slate-800 text-base leading-relaxed"
            >
              Bonjour ! Je suis votre assistant juridique IA JuriX. Posez-moi
              une question sur le droit camerounais, le code pénal, ou le droit
              du travail.
            </div>
          </div>
        </div>

        <!-- Suggestions -->
        <div class="ml-14 flex flex-wrap items-center gap-2">
          <span class="text-xs font-semibold text-slate-400 mr-1"
            >Suggestions:</span
          >
          {#each suggestions as suggestion}
            <button
              on:click={() => handleSubmit(suggestion)}
              class="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-100 transition-colors"
            >
              {suggestion}
            </button>
          {/each}
        </div>
      </div>
    {:else}
      <div class="flex flex-col gap-6">
        <!-- Re-show welcome message as first item if needed, assuming messages list starts with history or is empty initially. 
             If messages are passed, render them. If empty, the block above handles it. -->

        {#each messages as message}
          <div
            class="flex w-full gap-4 {message.role === 'user'
              ? 'justify-end'
              : ''}"
          >
            {#if message.role === "assistant"}
              <!-- Bot Avatar -->
              <div
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm mt-auto mb-1"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="2"
                  stroke="currentColor"
                  class="h-5 w-5"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25z"
                  />
                </svg>
              </div>
            {/if}

            <div
              class="{message.role === 'user'
                ? 'max-w-[85%]'
                : 'max-w-[90%]'} flex flex-col {message.role === 'user'
                ? 'items-end'
                : 'items-start'}"
            >
              <div
                class="
                 relative px-6 py-4 shadow-sm text-[15px] leading-7
                 {message.role === 'user'
                  ? 'bg-blue-50 text-slate-800 rounded-3xl rounded-tr-sm border border-blue-100'
                  : 'bg-white text-slate-800 rounded-3xl rounded-tl-sm border border-slate-100'}
               "
              >
                {#if message.role === "assistant"}
                  <div
                    class="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-2 prose-li:my-0 text-slate-700"
                  >
                    {@html parseMarkdown(message.content)}
                  </div>
                {:else}
                  <p class="whitespace-pre-wrap">{message.content}</p>
                {/if}

                {#if message.sources && message.sources.length > 0}
                  <div class="mt-4 pt-3 border-t border-slate-100">
                    <p
                      class="mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        class="h-3 w-3"
                      >
                        <path
                          fill-rule="evenodd"
                          d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z"
                          clip-rule="evenodd"
                        />
                      </svg>
                      Sources vérifiées
                    </p>
                    <ul class="space-y-2">
                      {#each message.sources as source}
                        <li
                          class="flex items-start gap-2 bg-slate-50 p-2 rounded-lg"
                        >
                          <div class="flex flex-col">
                            <a
                              href="/laws/{source.law_id}{source.article_number
                                ? '#article-' + source.article_number
                                : ''}"
                              class="text-blue-600 hover:text-blue-800 hover:underline text-xs font-semibold"
                            >
                              {source.article_number
                                ? `Art. ${source.article_number} — `
                                : ""}{source.law_title || "Loi Camerounaise"}
                            </a>
                            {#if source.excerpt}
                              <span
                                class="text-slate-500 text-[11px] mt-0.5 italic line-clamp-1"
                                >"{source.excerpt}"</span
                              >
                            {/if}
                          </div>
                        </li>
                      {/each}
                    </ul>
                  </div>
                {/if}
              </div>

              <!-- Timestamp -->
              <span class="mt-1 text-[10px] text-slate-400 font-medium px-2">
                {getCurrentTime()}
              </span>
            </div>

            {#if message.role === "user"}
              <!-- User Avatar -->
              <div
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 shadow-sm mt-auto mb-1"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="2"
                  stroke="currentColor"
                  class="h-5 w-5"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                  />
                </svg>
              </div>
            {/if}
          </div>
        {/each}

        {#if loading}
          <div class="flex gap-4">
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm mt-auto mb-1"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
                class="h-5 w-5"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25z"
                />
              </svg>
            </div>
            <div
              class="rounded-3xl rounded-tl-sm bg-white p-4 shadow-sm border border-slate-100"
            >
              <div class="flex gap-1.5">
                <div
                  class="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]"
                ></div>
                <div
                  class="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]"
                ></div>
                <div
                  class="h-2 w-2 animate-bounce rounded-full bg-slate-400"
                ></div>
              </div>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Input Area -->
  <div class="p-4 bg-white/50 backdrop-blur-sm">
    <div
      class="relative flex items-center gap-2 rounded-[2rem] bg-white border border-slate-200 p-2 shadow-lg shadow-slate-200/50 transition-all focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-100"
    >
      <!-- Attachment Icon (Decorative) -->
      <button
        class="ml-2 p-2 text-slate-400 hover:text-slate-600 transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="h-6 w-6"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"
          />
        </svg>
      </button>

      <textarea
        bind:value={input}
        on:keydown={handleKeydown}
        disabled={loading}
        placeholder="Posez votre question juridique..."
        class="max-h-32 min-h-[48px] w-full resize-none bg-transparent px-2 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none disabled:opacity-50"
        rows="1"
      ></textarea>

      <button
        on:click={() => handleSubmit()}
        disabled={loading || !input.trim()}
        class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition-all hover:bg-blue-700 hover:scale-105 active:scale-95 disabled:bg-slate-200 disabled:shadow-none shadow-md shadow-blue-500/30"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          class="h-5 w-5 translate-x-0.5 -translate-y-0.5"
        >
          <path
            d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z"
          />
        </svg>
      </button>
    </div>
    <p
      class="mt-3 text-center text-[10px] text-slate-400 font-medium tracking-wide"
    >
      {$tr("chat.disclaimer") ||
        "L'IA peut faire des erreurs. Vérifiez toujours les informations importantes auprès d'un professionnel du droit."}
    </p>
  </div>
</div>
