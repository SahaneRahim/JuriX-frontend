<script lang="ts">
  import { onMount } from "svelte";
  import { piegerFocus } from "$lib/actions/pieger-focus";
  import { apiFetch } from "$lib/api";
  import Icone from "$lib/components/Icone.svelte";
  import StatusBadge from "$lib/components/StatusBadge.svelte";
  import { nomRubrique } from "$lib/data/blog";
  import { formatDateCourte } from "$lib/format";
  import { language, tr } from "$lib/stores/language";

  // Une seule recette pour les champs et leurs libellés, celle de tout le site
  // (noir et blanc, mode sombre compris) et des fenêtres de l'administration :
  // recopiée champ par champ, elle finissait par diverger. Une seule taille
  // aussi, celle des pages de compte et des quatre fenêtres : 44 px de haut
  // au moins, `px-3 py-2`, libellé 4 px au-dessus. Le générateur avait des
  // champs de 46 px en `px-4 py-3` et ses libellés à 6 px ; la fenêtre
  // d'édition, 38 px : côte à côte, les formulaires ne se ressemblaient pas.
  // 16 px de texte sauf à partir de sm sous un pointeur fin (règle de
  // login/+page.svelte) : iOS zoome au focus d'un champ de moins de 16 px,
  // téléphone en paysage compris.
  const CHAMP =
    "min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-950 placeholder-zinc-400 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 dark:border-zinc-500 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-200 dark:focus:ring-zinc-200 sm:[@media(pointer:fine)]:text-sm";
  const LIBELLE = "mb-1 block text-sm font-medium text-zinc-800 dark:text-zinc-200";
  // Mention « (optionnel) » après un libellé : grise et sans gras, comme dans
  // la fenêtre d'ajout de documents (UploadModal).
  const FACULTATIF = "font-normal text-zinc-500 dark:text-zinc-400";

  /**
   * Actions d'un article. Au téléphone, sous le texte, sur toute la largeur :
   * la recette « secondaire » du guide (§ 4.4), celle des boutons des cartes
   * de Documents et de Comptes. Les boutons d'ici avaient le texte zinc-600
   * des boutons discrets, sans fond, dans un cadre : à côté des autres
   * listes, ils semblaient désactivés. À partir de sm, à droite du texte
   * comme dans une ligne de tableau : les boutons discrets des tableaux de
   * Documents et de Comptes, sans cadre.
   */
  const ACTION =
    "inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-colors sm:flex-none sm:border-0";
  const ACTION_NEUTRE =
    "border-zinc-300 bg-white text-zinc-800 hover:border-zinc-950 hover:text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-200 dark:hover:text-white sm:bg-transparent sm:text-zinc-600 sm:hover:bg-zinc-100 sm:dark:bg-transparent sm:dark:text-zinc-400 sm:dark:hover:bg-zinc-800";
  const ACTION_SUPPRIMER =
    "border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300";

  /** Message d'une réponse en échec, traduit : il s'affiche dans l'alerte de la page. */
  function erreurHttp(statut: number): string {
    return $tr("admin.blog.httpError").replace("{status}", String(statut));
  }

  interface BlogPost {
    id: number;
    slug: string;
    title: string;
    category: string;
    publishedAt: string;
    readingTime: string;
    context: string;
    botAnalysis: {
      summary: string;
      keyPoints: string[];
      citations: any[];
      citizenImpact: string;
    };
    suggestedQuestion: string;
    tags: string[];
    isPublished: boolean;
  }

  let posts: BlogPost[] = [];
  let loading = true;
  let error = "";

  // Génération IA
  let showGenerator = false;
  let topic = "";
  let additionalContext = "";
  let generating = false;
  let generatedPost: any = null;

  // Édition
  let editingPost: BlogPost | null = null;
  let editTitle = "";
  let editCategory = "";
  let editContext = "";
  let editSummary = "";
  let editKeyPoints = "";
  let editCitizenImpact = "";
  let editSuggestedQuestion = "";
  let editTags = "";
  let editIsPublished = true;
  let saving = false;

  async function loadPosts() {
    loading = true;
    try {
      const res = await apiFetch("/blog/admin/all");
      if (!res.ok) throw new Error(erreurHttp(res.status));
      posts = await res.json();
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function generatePost() {
    if (!topic.trim()) return;
    generating = true;
    generatedPost = null;
    error = "";
    try {
      const res = await apiFetch("/blog/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          additional_context: additionalContext.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || erreurHttp(res.status));
      }
      generatedPost = await res.json();
    } catch (e: any) {
      error = e.message;
    } finally {
      generating = false;
    }
  }

  async function publishGenerated() {
    if (!generatedPost) return;
    saving = true;
    error = "";
    try {
      const body = {
        title: generatedPost.title,
        slug: generatedPost.slug,
        category: generatedPost.category,
        reading_time: generatedPost.reading_time || "4 min",
        context: generatedPost.context,
        bot_analysis: {
          summary: generatedPost.summary,
          keyPoints: generatedPost.key_points || generatedPost.keyPoints || [],
          citations: generatedPost.citations || [],
          citizenImpact: generatedPost.citizen_impact || generatedPost.citizenImpact || "",
        },
        suggested_question: generatedPost.suggested_question || generatedPost.suggestedQuestion || "",
        tags: generatedPost.tags || [],
        is_published: true,
      };
      const res = await apiFetch("/blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || erreurHttp(res.status));
      }
      generatedPost = null;
      showGenerator = false;
      topic = "";
      additionalContext = "";
      await loadPosts();
    } catch (e: any) {
      error = e.message;
    } finally {
      saving = false;
    }
  }

  function startEdit(post: BlogPost) {
    editingPost = post;
    editTitle = post.title;
    editCategory = post.category;
    editContext = post.context;
    editSummary = post.botAnalysis?.summary || "";
    editKeyPoints = (post.botAnalysis?.keyPoints || []).join("\n");
    editCitizenImpact = post.botAnalysis?.citizenImpact || "";
    editSuggestedQuestion = post.suggestedQuestion || "";
    editTags = (post.tags || []).join(", ");
    editIsPublished = post.isPublished;
  }

  function cancelEdit() {
    editingPost = null;
  }

  // Fenêtre d'édition construite comme celles de l'administration
  // (UserFormModal) : le voile ferme au clic sur lui seul, et non par un
  // stopPropagation sur la boîte ; Échap ferme aussi. Le voile n'avait ni
  // rôle ni clavier (avertissements a11y de svelte-check), et la boîte n'était
  // pas annoncée comme une fenêtre.
  function fermerSurLeVoile(event: MouseEvent) {
    if (event.target === event.currentTarget) cancelEdit();
  }

  function fermerSurEchap(event: KeyboardEvent) {
    if (editingPost && event.key === "Escape") cancelEdit();
  }

  // Ouverte, la fenêtre fige la page derrière elle, comme les trois autres
  // fenêtres de l'administration : sur téléphone, où elle devient un panneau
  // collé en bas, un glisser sur son en-tête ou sur le voile ferait défiler la
  // liste des articles dessous.
  function bloquerDefilement(_noeud: HTMLElement) {
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return {
      destroy() {
        document.body.style.overflow = avant;
      },
    };
  }

  async function saveEdit() {
    if (!editingPost) return;
    saving = true;
    error = "";
    try {
      const body: any = {
        title: editTitle,
        category: editCategory,
        context: editContext,
        bot_analysis: {
          summary: editSummary,
          keyPoints: editKeyPoints.split("\n").map((s: string) => s.trim()).filter(Boolean),
          citizenImpact: editCitizenImpact,
        },
        suggested_question: editSuggestedQuestion,
        tags: editTags.split(",").map((s: string) => s.trim()).filter(Boolean),
        is_published: editIsPublished,
      };
      const res = await apiFetch(`/blog/${editingPost.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(erreurHttp(res.status));
      editingPost = null;
      await loadPosts();
    } catch (e: any) {
      error = e.message;
    } finally {
      saving = false;
    }
  }

  async function deletePost(post: BlogPost) {
    if (!confirm($tr("admin.blog.confirmDelete").replace("{title}", post.title))) return;
    try {
      const res = await apiFetch(`/blog/${post.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(erreurHttp(res.status));
      await loadPosts();
    } catch (e: any) {
      error = e.message;
    }
  }

  onMount(loadPosts);
</script>

<svelte:window on:keydown={fermerSurEchap} />

<!-- Pas de <svelte:head> ici : admin/+layout.svelte calcule le titre de
     l'onglet pour toutes les pages de l'administration (TITRES_ADMIN). Un
     second <title>, posé par la page, n'y changeait rien : le navigateur
     retient le premier, celui du layout. -->

<div class="space-y-6">
  <!-- En-tête. Empilé sur téléphone, bouton sur toute la largeur comme ceux
       de Documents et d'Utilisateurs : en `items-start`, il gardait sa
       largeur naturelle, calé à gauche. Bouton à la base du guide (§ 4.4),
       sans zoom au survol, comme les boutons d'en-tête des autres pages.
       Titre de page du guide (§ 4.2 : 30 puis 36 px) et description en
       16 px, comme le tableau de bord et les comptes : 24 puis 30 px, et
       14 px, auparavant. En ligne à partir de md, comme le tableau de bord
       et les comptes (sm auparavant : à 740 px, deux pages sœurs prenaient
       deux dispositions). `sm:pb-2` : sous l'en-tête, 32 px à partir de sm
       (les 24 du `space-y-6` et ces 8), l'écart des autres pages.
       Générateur ouvert, le bouton devient secondaire, avec la croix : une
       fermeture gardait l'étincelle et le noir de l'action principale.
       Sur toute la largeur au téléphone seulement : de sm à md, sous le
       titre, il garde sa largeur (`sm:self-start`), comme les boutons des
       documents ; étiré, il faisait une barre noire de 692 px à 740 px de
       large. `md:self-auto` : en ligne, il reprend le centrage vertical de
       l'en-tête. Sous-titre en `text-pretty`, comme ceux des autres pages :
       pas de mot seul en dernière ligne. -->
  <div class="flex flex-col gap-4 sm:pb-2 md:flex-row md:items-center md:justify-between">
    <div class="min-w-0">
      <h1 class="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-950 dark:text-white">{$tr("admin.blog")}</h1>
      <p class="mt-1 text-pretty text-zinc-500 dark:text-zinc-400">{$tr("admin.blog.subtitle")}</p>
    </div>
    <button
      on:click={() => { showGenerator = !showGenerator; generatedPost = null; error = ""; }}
      class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors sm:self-start md:shrink-0 md:self-auto {showGenerator
        ? 'border border-zinc-300 bg-white text-zinc-800 hover:border-zinc-950 hover:text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-200 dark:hover:text-white'
        : 'bg-zinc-950 text-white shadow-sm hover:bg-black dark:bg-white dark:text-zinc-950 dark:shadow-none dark:hover:bg-zinc-200'}"
    >
      <Icone nom={showGenerator ? "x" : "sparkles"} class="text-lg" />
      {showGenerator ? $tr("admin.blog.closeGenerator") : $tr("admin.blog.generate")}
    </button>
  </div>

  {#if error}
    <div
      role="alert"
      class="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
    >
      <Icone nom="circle-alert" class="mt-0.5 text-base" />
      <p class="coupe-mots min-w-0">{error}</p>
    </div>
  {/if}

  <!-- Panneau Générateur IA -->
  {#if showGenerator}
    <!-- Marges de la carte des articles, dessous (16 puis 24 px) : en
         `p-6 sm:p-8`, le texte du générateur commençait 12 px à droite de
         celui de la liste. -->
    <div class="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6 space-y-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div class="flex items-center gap-3">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200/70 bg-zinc-100 text-zinc-800 dark:border-zinc-700/60 dark:bg-zinc-800 dark:text-zinc-200"
        >
          <Icone nom="bot" class="text-2xl" />
        </div>
        <div>
          <h2 class="text-lg font-bold text-zinc-950 dark:text-white">{$tr("admin.blog.generatorTitle")}</h2>
          <p class="text-xs text-zinc-500 dark:text-zinc-400">{$tr("admin.blog.generatorHint")}</p>
        </div>
      </div>

      <div class="space-y-4">
        <div>
          <label for="topic" class={LIBELLE}>{$tr("admin.blog.topicLabel")}</label>
          <input
            id="topic"
            type="text"
            bind:value={topic}
            placeholder={$tr("admin.blog.topicPlaceholder")}
            class={CHAMP}
          />
        </div>
        <div>
          <label for="ctx" class={LIBELLE}
            >{$tr("admin.blog.extraContextLabel")} <span class={FACULTATIF}>{$tr("admin.optional")}</span></label
          >
          <textarea
            id="ctx"
            bind:value={additionalContext}
            placeholder={$tr("admin.blog.extraContextPlaceholder")}
            rows="3"
            class="{CHAMP} resize-y"
          ></textarea>
        </div>
        <button
          on:click={generatePost}
          disabled={generating || !topic.trim()}
          class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-zinc-950 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          {#if generating}
            <Icone nom="loader-circle" class="h-5 w-5 motion-safe:animate-spin" />
            {$tr("admin.blog.generating")}
          {:else}
            <Icone nom="sparkles" class="text-lg" />
            {$tr("admin.blog.generateFull")}
          {/if}
        </button>
      </div>

      <!-- Prévisualisation de l'article généré -->
      {#if generatedPost}
        <div class="mt-6 border-t border-zinc-200 dark:border-zinc-800 pt-6 space-y-5">
          <h3 class="text-lg font-bold text-zinc-950 dark:text-white flex items-center gap-2">
            <Icone nom="circle-check" class="text-2xl" />
            {$tr("admin.blog.previewTitle")}
          </h3>
          
          <!-- Les blocs reprennent ceux de l'article publié (blog/[slug]) : le
               contexte marqué d'un trait à gauche, l'impact encadré. Ils se
               distinguaient par la couleur (ambre, bleu) ; en noir et blanc,
               ce sont leur titre et leur forme qui les séparent. -->
          <div class="rounded-xl border border-zinc-200 bg-zinc-50 p-5 space-y-4 dark:border-zinc-700/60 dark:bg-zinc-800/50">
            <div class="space-y-1">
              <span class="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{generatedPost.category}</span>
              <h4 class="text-xl font-bold text-zinc-950 dark:text-white">{generatedPost.title}</h4>
              <!-- coupe-mots : un slug n'a aucune espace où passer à la ligne. -->
              <p class="coupe-mots text-xs text-zinc-500 dark:text-zinc-400">{$tr("admin.blog.slug")} {generatedPost.slug} • {generatedPost.reading_time || "4 min"}</p>
            </div>
            <div class="rounded-r-lg border-l-4 border-zinc-950 bg-white p-4 dark:border-zinc-200 dark:bg-zinc-900">
              <p class="text-sm font-semibold text-zinc-950 dark:text-white mb-1">{$tr("admin.blog.contextHeading")}</p>
              <p class="text-sm text-zinc-700 dark:text-zinc-300">{generatedPost.context}</p>
            </div>
            <div class="space-y-2">
              <p class="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{$tr("admin.blog.summaryHeading")}</p>
              <p class="text-sm text-zinc-600 dark:text-zinc-300">{generatedPost.summary}</p>
            </div>
            <div class="space-y-2">
              <p class="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{$tr("admin.blog.keyPointsHeading")}</p>
              <ul class="space-y-1">
                {#each (generatedPost.key_points || generatedPost.keyPoints || []) as pt, i (i)}
                  <li class="text-sm text-zinc-600 dark:text-zinc-300 flex items-start gap-2">
                    <span class="text-zinc-950 dark:text-zinc-100 mt-0.5" aria-hidden="true">•</span>
                    <span>{pt}</span>
                  </li>
                {/each}
              </ul>
            </div>
            {#if (generatedPost.citations || []).length > 0}
              <div class="space-y-2">
                <p class="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{$tr("admin.blog.citationsHeading").replace("{n}", String(generatedPost.citations.length))}</p>
                {#each generatedPost.citations as cit, i (i)}
                  <!-- coupe-mots : une cote (« N°2018/9387/CAB/PM ») n'a pas
                       d'espace où passer à la ligne sur un écran étroit. -->
                  <div class="coupe-mots text-xs bg-white dark:bg-zinc-900 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700">
                    <span class="font-bold">{cit.reference}</span> — Art. {cit.article_number || cit.articleNumber}
                    <p class="mt-1 italic text-zinc-500 dark:text-zinc-400">« {cit.excerpt?.slice(0, 150)}... »</p>
                  </div>
                {/each}
              </div>
            {/if}
            <div class="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
              <p class="text-sm font-semibold text-zinc-950 dark:text-white mb-1">{$tr("admin.blog.impactHeading")}</p>
              <p class="text-sm text-zinc-700 dark:text-zinc-300">{generatedPost.citizen_impact || generatedPost.citizenImpact}</p>
            </div>
            <div class="flex flex-wrap items-center gap-2 pt-2">
              {#each (generatedPost.tags || []) as tag, i (i)}
                <span class="px-2 py-0.5 text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-full border border-zinc-200 dark:border-zinc-700">#{tag}</span>
              {/each}
            </div>
          </div>

          <div class="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              on:click={publishGenerated}
              disabled={saving}
              class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-zinc-950 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              {#if saving}
                <Icone nom="loader-circle" class="h-5 w-5 motion-safe:animate-spin" />
                {$tr("common.saving")}
              {:else}
                <Icone nom="send-horizontal" class="text-lg" />
                {$tr("admin.blog.publishNow")}
              {/if}
            </button>
            <button
              on:click={() => { generatedPost = null; }}
              class="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-800 transition-colors hover:border-zinc-950 hover:text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-200 dark:hover:text-white"
            >
              {$tr("common.cancel")}
            </button>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Liste des articles -->
  <div class="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
    <!-- Titre de carte du guide (§ 4.2 : 16 puis 18 px), comme les cartes du
         tableau de bord ; il restait à 16 px à toutes les tailles. Marges de
         16 puis 24 px, celles des lignes dessous et des listes de Documents
         et de Comptes (20 px au téléphone auparavant). -->
    <div class="px-4 sm:px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
      <h2 class="text-base sm:text-lg font-bold text-zinc-950 dark:text-white">{$tr("admin.blog.listTitle").replace("{n}", String(posts.length))}</h2>
    </div>

    {#if loading}
      <div class="py-16 text-center text-zinc-500 dark:text-zinc-400">
        <Icone nom="loader-circle" class="mx-auto mb-3 block h-8 w-8 text-zinc-950 motion-safe:animate-spin dark:text-white" />
        {$tr("common.loading")}
      </div>
    {:else if posts.length === 0}
      <div class="py-16 text-center text-zinc-500 dark:text-zinc-400">
        <Icone nom="newspaper" class="mb-2 text-4xl" />
        <p>{$tr("admin.blog.empty")}</p>
      </div>
    {:else}
      <div class="divide-y divide-zinc-200 dark:divide-zinc-800">
        {#each posts as post (post.id)}
          <!-- Sous sm, les actions passent sous le contenu, en rangée de
               boutons comme dans les cartes de Documents et d'Utilisateurs :
               à côté, leurs 148 px ne laissaient qu'environ 150 px au texte
               sur un téléphone de 390 px. Les titres s'y coupaient après deux
               mots, et le brouillon empilait catégorie, statut et date sur
               trois lignes : on ne reconnaissait plus les articles. -->
          <div class="px-4 sm:px-6 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div class="min-w-0 flex-1 space-y-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{nomRubrique(post.category, $language.current)}</span>
                  <!-- Le badge de statut du reste de l'administration, sur
                       chaque article, publié ou brouillon, comme sur chaque
                       ligne des documents : seul le brouillon en portait un,
                       et un article publié se reconnaissait à l'absence du
                       badge. -->
                  <StatusBadge status={post.isPublished ? "published" : "draft"} size="sm" />
                  <!-- Date courte, comme partout dans l'administration
                       ($lib/format) : la chaîne ISO brute de l'API
                       (« 2026-10-26 ») ne suivait pas la langue. Méta du
                       guide (§ 4.2), comme la date du tableau de bord. -->
                  <span class="font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">{formatDateCourte(post.publishedAt, $language.current)}</span>
                </div>
                <!-- Deux lignes au lieu d'une seule tronquée : le titre est ce
                     qui distingue un article d'un autre. En 16 px et en
                     `font-medium`, comme les titres des cartes de Documents,
                     de Comptes et de l'import en lot : en 14 px, il était le
                     plus petit des listes de l'administration. -->
                <h3 class="coupe-mots line-clamp-2 text-base font-medium text-zinc-950 dark:text-white" title={post.title}>{post.title}</h3>
                <p class="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">{post.context}</p>
              </div>
              <!-- Les actions des autres listes de l'administration
                   (Documents, Comptes), avec leur libellé, 44 px de haut :
                   recette des constantes ACTION_* (script). Ce n'étaient que
                   des icônes ici (lien externe, crayon, corbeille), et trois
                   boutons encadrés sans libellé au téléphone. « Voir » garde
                   son nom complet (« Voir sur le site ») en aria-label et en
                   infobulle : seul « Voir » tient dans un tiers de rangée à
                   320 px. Sa flèche passe APRÈS le libellé, petite : elle dit
                   que le lien ouvre un nouvel onglet (target="_blank"), comme
                   le veut l'usage ; devant, seule icône des trois boutons,
                   elle déséquilibrait la rangée. -->
              <div class="flex items-center gap-2 sm:shrink-0 sm:gap-1">
                <a
                  href="/blog/{post.slug}"
                  target="_blank"
                  class="{ACTION} {ACTION_NEUTRE}"
                  title={$tr("admin.blog.view")}
                  aria-label={$tr("admin.blog.view")}
                >
                  {$tr("admin.blog.viewShort")}
                  <Icone nom="external-link" class="text-sm" />
                </a>
                <button
                  on:click={() => startEdit(post)}
                  class="{ACTION} {ACTION_NEUTRE}"
                >
                  {$tr("admin.blog.edit")}
                </button>
                <button
                  on:click={() => deletePost(post)}
                  class="{ACTION} {ACTION_SUPPRIMER}"
                >
                  {$tr("admin.delete")}
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Fenêtre d'édition, hors du conteneur `space-y-6` de la page : enfant de
     celui-ci, le voile fixe en recevait la marge du haut (1,5 rem). Il
     commençait alors 24 px sous le haut de l'écran : une bande restait nette,
     ses clics atteignaient la barre latérale ou la barre du haut, et la boîte
     descendait de 12 px. -->
{#if editingPost}
  <!--
    Panneau collé en bas sur téléphone, boîte centrée à partir de sm, comme
    les autres fenêtres de l'administration (EditModal, UserFormModal). Seul
    le corps défile, en-tête et pied restent visibles : toute la boîte
    défilait, si bien qu'à 1 440 × 900 elle s'arrêtait sur « Question
    suggérée », sans « Enregistrer » ni la case « publié » à l'écran. La
    hauteur maximale se rapporte au voile, fixe en inset-0, qui suit l'écran
    réellement visible : `90vh` compte la barre d'adresse des navigateurs
    mobiles comme repliée, et le pied serait passé dessous.
  -->
  <div
    class="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 backdrop-blur-sm sm:items-center sm:p-4"
    role="presentation"
    on:click={fermerSurLeVoile}
    use:bloquerDefilement
  >
    <div
      class="flex max-h-[calc(100%-1rem)] w-full max-w-3xl flex-col rounded-t-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none sm:max-h-[90%] sm:rounded-2xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titre-edition-article"
      use:piegerFocus
    >
      <!-- En-tête séparé du corps par un trait, titre de 24 px à partir de
           sm : ceux de « Modifier le document » (EditModal). -->
      <div
        class="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800 sm:px-6 sm:py-4"
      >
        <h2 id="titre-edition-article" class="min-w-0 text-xl font-bold tracking-tight text-zinc-950 dark:text-white sm:text-2xl">{$tr("admin.blog.editTitle")}</h2>
        <!-- 44 px et un nom traduit : la croix seule faisait une cible de
             40 px, que le lecteur d'écran annonçait par le mot de sa
             ligature, « close », en anglais. -->
        <button
          on:click={cancelEdit}
          aria-label={$tr("common.close")}
          class="-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
        >
          <Icone nom="x" class="h-6 w-6" />
        </button>
      </div>

      <!-- Corps : overscroll-contain, pour qu'arrivé au bout le défilement ne
           passe pas à la page derrière. -->
      <div class="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-6">
        <div>
          <label for="ed-title" class={LIBELLE}>{$tr("admin.doc.title")}</label>
          <input id="ed-title" type="text" bind:value={editTitle} class={CHAMP} />
        </div>
        <!-- Une colonne sur téléphone, comme dans EditModal : à deux, chaque
             champ n'y gardait qu'environ 136 px à 320 px de large. -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label for="ed-cat" class={LIBELLE}>{$tr("admin.doc.category")}</label>
            <input id="ed-cat" type="text" bind:value={editCategory} class={CHAMP} />
          </div>
          <div>
            <label for="ed-tags" class={LIBELLE}>{$tr("admin.blog.tagsField")}</label>
            <input id="ed-tags" type="text" bind:value={editTags} class={CHAMP} />
          </div>
        </div>
        <div>
          <label for="ed-ctx" class={LIBELLE}>{$tr("admin.blog.contextField")}</label>
          <textarea id="ed-ctx" bind:value={editContext} rows="3" class="{CHAMP} resize-y"></textarea>
        </div>
        <div>
          <label for="ed-sum" class={LIBELLE}>{$tr("admin.blog.summaryField")}</label>
          <textarea id="ed-sum" bind:value={editSummary} rows="3" class="{CHAMP} resize-y"></textarea>
        </div>
        <div>
          <label for="ed-kp" class={LIBELLE}>{$tr("admin.blog.keyPointsField")}</label>
          <textarea id="ed-kp" bind:value={editKeyPoints} rows="4" class="{CHAMP} resize-y"></textarea>
        </div>
        <div>
          <label for="ed-ci" class={LIBELLE}>{$tr("admin.blog.impactField")}</label>
          <textarea id="ed-ci" bind:value={editCitizenImpact} rows="2" class="{CHAMP} resize-y"></textarea>
        </div>
        <div>
          <label for="ed-sq" class={LIBELLE}>{$tr("admin.blog.suggestedQuestionField")}</label>
          <input id="ed-sq" type="text" bind:value={editSuggestedQuestion} class={CHAMP} />
        </div>
      </div>

      <!-- Pied toujours visible, au-dessus de la barre d'accueil de l'iPhone
           (zone sûre). La case « publié » y rejoint les boutons : elle décide
           de ce qu'enregistre le bouton voisin, et restait comme lui hors de
           vue, en bas du corps. Toute l'étiquette est la cible, 44 px de
           haut. Sur téléphone, la case a sa ligne, puis viennent deux
           boutons de 44 px à parts égales : à côté d'eux, « Article publié »
           ne tiendrait pas dans les 288 px d'un écran de 320 px. -->
      <div class="shrink-0 border-t border-zinc-200 pb-zone-sure dark:border-zinc-800">
        <div
          class="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-6 sm:py-4"
        >
          <label
            class="flex min-h-11 items-center gap-3 self-start text-sm font-medium text-zinc-800 dark:text-zinc-200 sm:self-auto"
          >
            <!-- Sans couleur de bordure : celle de la base (zinc-500) garde la
                 case vide visible, ce que le gris très clair d'avant (1,5:1
                 sur blanc) ne faisait presque plus. -->
            <input id="ed-pub" type="checkbox" bind:checked={editIsPublished} class="w-4 h-4 rounded text-zinc-900 focus:ring-zinc-950 dark:text-white dark:focus:ring-white" />
            {$tr("admin.blog.publishedField")}
          </label>
          <div class="flex gap-3">
            <button
              on:click={cancelEdit}
              class="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white sm:flex-none"
              >{$tr("common.cancel")}</button
            >
            <button
              on:click={saveEdit}
              disabled={saving}
              class="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 sm:flex-none"
            >
              {#if saving}
                <Icone nom="loader-circle" class="h-4 w-4 motion-safe:animate-spin" />
              {/if}
              {$tr("common.save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}
