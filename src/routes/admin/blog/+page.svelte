<script lang="ts">
  /**
   * L'administration du blog : générer un BROUILLON, le relire, le corriger,
   * puis le publier ; modifier, retirer ou supprimer un article.
   *
   * LE PARCOURS (contrat du 29/10). La génération enregistre l'article en
   * brouillon (`POST /blog/generate`, 201) et la page ouvre aussitôt la
   * fenêtre de relecture sur lui, avec ses sources et ses avertissements.
   * Rien n'est public tant que l'administrateur n'a pas publié depuis cette
   * fenêtre. Auparavant, l'article généré n'existait que dans le navigateur
   * et « Publier maintenant » le mettait en ligne d'un clic, sans relecture
   * possible des citations (revue du 29/10 : 3 citations fausses sur 3).
   *
   * L'API SANS BLOG. En production (29/10), les routes /api/v1/blog
   * n'existent pas : la page le dit, au lieu d'afficher « Erreur HTTP 404 »
   * à côté d'un « Articles (0) » qui invitait à générer, voué à l'échec.
   *
   * LE FOCUS. La liste n'est plus démontée à chaque rechargement : un
   * article enregistré, publié ou supprimé est mis à jour sur place, depuis
   * la réponse de l'API, et la fenêtre rend le focus au bouton qui l'a
   * ouverte. Il tombait sur <body> après chaque action (mesuré).
   */
  import { onMount, tick } from "svelte";
  import { apiFetch } from "$lib/api";
  import Icone from "$lib/components/Icone.svelte";
  import { nomRubrique, sansRenvoisAuxExtraits } from "$lib/data/blog";
  import { formatDateCourte } from "$lib/format";
  import { language, tr } from "$lib/stores/language";
  import BadgeDePublication from "./BadgeDePublication.svelte";
  import { erreurDeReponse, erreurDExecution, messageDErreur } from "./erreurs";
  import FenetreDeRelecture from "./FenetreDeRelecture.svelte";
  import Generateur from "./Generateur.svelte";
  import {
    articlesAdminDepuis,
    avertissementsDeGenerationValables,
    estAncien,
    pointsAVerifier,
    visibleDuPublic,
    type ArticleAdmin,
    type ResultatDeGeneration,
    type SourceDeGeneration,
  } from "./relecture";

  /**
   * Actions d'un article. Au téléphone, sous le texte, sur toute la largeur :
   * la recette « secondaire » du guide (§ 4.4), celle des boutons des cartes
   * de Documents et de Comptes. À partir de sm, à droite du texte comme dans
   * une ligne de tableau : les boutons discrets des tableaux, sans cadre.
   */
  const ACTION =
    "inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-colors sm:flex-none sm:border-0";
  const ACTION_NEUTRE =
    "border-zinc-300 bg-white text-zinc-800 hover:border-zinc-950 hover:text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-200 dark:hover:text-white sm:bg-transparent sm:text-zinc-600 sm:hover:bg-zinc-100 sm:dark:bg-transparent sm:dark:text-zinc-400 sm:dark:hover:bg-zinc-800";
  const ACTION_SUPPRIMER =
    "border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300";

  /**
   * L'état de la LISTE, distinct des erreurs d'action : un chargement en
   * échec n'affiche jamais l'état vide (« Aucun article… ») ni un compte de
   * zéro, qui auraient laissé croire le blog vide.
   */
  let etat: "chargement" | "pret" | "erreur" | "non_active" = "chargement";
  let erreurListe = "";
  let rafraichissement = false;
  let articles: ArticleAdmin[] = [];

  /** Erreur d'une action de la liste (suppression, actualisation). */
  let erreurAction = "";
  /** Ce qui vient de se passer (« « … » est publié. »), annoncé et affiché. */
  let avis = "";

  let generateurOuvert = false;
  let generationEnCours = false;

  /** La fenêtre de relecture ouverte, et sur quelle vue. */
  let relecture: { article: ArticleAdmin; vue: "relecture" | "apercu" | "edition" } | null = null;
  /**
   * Les sources rendues par chaque génération de cette visite. L'API les
   * garde désormais avec l'article et les rend à chaque lecture (avenant du
   * tour 4, `article.sources`), que la fenêtre prend d'abord : celles-ci ne
   * sont qu'un repli, pour une réponse qui ne les porterait pas.
   */
  let sourcesParArticle = new Map<number, SourceDeGeneration[]>();
  /**
   * Ce que seule la génération a relevé, par article, pour la visite : l'API
   * ne le garde pas, et le premier enregistrement l'effaçait de la fenêtre
   * avant la confirmation de publication (revue du 29/10).
   */
  let avertissementsParArticle = new Map<number, string[]>();

  /**
   * Le compte « N à vérifier » de la ligne : le même calcul que la fenêtre et
   * sa confirmation (`pointsAVerifier`). La liste comptait les seuls
   * avertissements du serveur, la fenêtre y ajoutait les siens : deux nombres
   * pour un même article (revue du 29/10).
   */
  function nombreDePoints(article: ArticleAdmin, t: (cle: string) => string, parArticle: Map<number, string[]>): number {
    return pointsAVerifier(
      article.avertissements,
      article.citations,
      t,
      avertissementsDeGenerationValables(parArticle.get(article.id) ?? [], article),
    ).length;
  }

  let titreDeLaListe: HTMLElement;

  async function charger(premiere = false) {
    if (premiere) etat = "chargement";
    else rafraichissement = true;
    try {
      const reponse = await apiFetch("/blog/admin/all");
      if (reponse.status === 404) {
        // Toute la route manque : le blog n'est pas déployé sur cette API.
        etat = "non_active";
        articles = [];
        return;
      }
      if (!reponse.ok) {
        echecDuChargement(messageDErreur(await erreurDeReponse(reponse), $tr));
        return;
      }
      const lus = articlesAdminDepuis(await reponse.json());
      if (!lus) {
        echecDuChargement($tr("admin.blog.err.unexpected"));
        return;
      }
      articles = lus;
      etat = "pret";
    } catch (e) {
      echecDuChargement(messageDErreur(erreurDExecution(e), $tr));
    } finally {
      rafraichissement = false;
    }
  }

  /** Premier chargement en échec : l'erreur à la place de la liste ; sinon la liste reste. */
  function echecDuChargement(message: string) {
    if (etat === "pret") {
      erreurAction = $tr("admin.blog.loadError").replace("{message}", () => message);
    } else {
      etat = "erreur";
      erreurListe = message;
    }
  }

  function actualiser() {
    if (rafraichissement || etat === "chargement") return;
    erreurAction = "";
    void charger(etat !== "pret");
  }

  /** Remplace (ou ajoute en tête) un article de la liste, sans la démonter. */
  function mettreAJour(article: ArticleAdmin) {
    const index = articles.findIndex((a) => a.id === article.id);
    articles = index === -1 ? [article, ...articles] : articles.map((a) => (a.id === article.id ? article : a));
  }

  /**
   * Le brouillon vient d'être enregistré par l'API, contrôle IA compris : il
   * entre en tête de la liste et la fenêtre s'ouvre sur lui, sur la
   * RELECTURE (chaque phrase et son verdict, les sources à côté, une case par
   * partie), avec ses sources et ses avertissements. Le focus passe d'abord
   * sur son bouton « Modifier » : la fenêtre le lui rendra à sa fermeture.
   */
  async function apresGeneration({ article, sources, avertissementsDeGeneration }: ResultatDeGeneration) {
    sourcesParArticle.set(article.id, sources);
    sourcesParArticle = sourcesParArticle;
    avertissementsParArticle.set(article.id, avertissementsDeGeneration);
    avertissementsParArticle = avertissementsParArticle;
    mettreAJour(article);
    etat = "pret";
    // Le panneau se ferme (et sa région vivante avec lui) : la page garde la
    // trace du brouillon enregistré, lue et visible après la relecture.
    generateurOuvert = false;
    avis = $tr("admin.blog.announceDone").replace("{title}", () => article.title);
    await tick();
    document.getElementById(`modifier-${article.id}`)?.focus();
    relecture = { article, vue: "relecture" };
  }

  function ouvrir(article: ArticleAdmin, vue: "relecture" | "apercu" | "edition") {
    avis = "";
    relecture = { article, vue };
  }

  function fermerLaRelecture() {
    relecture = null;
  }

  /**
   * Après chaque enregistrement de la fenêtre : la ligne est mise à jour sur
   * place. La fenêtre garde son propre état (formulaire, vue) : `relecture`
   * n'est pas réassignée, ce qui lui repasserait ses propriétés.
   */
  function surMiseAJour(article: ArticleAdmin, evenement: "enregistre" | "publie" | "retire") {
    mettreAJour(article);
    if (evenement === "publie") {
      // Relecture finie : la fenêtre se ferme, la page dit ce qui est en ligne.
      relecture = null;
      avis = $tr("admin.blog.publishedNotice").replace("{title}", () => article.title);
    } else if (evenement === "retire") {
      avis = $tr("admin.blog.unpublishedNotice").replace("{title}", () => article.title);
    }
  }

  async function supprimer(article: ArticleAdmin) {
    if (!confirm($tr("admin.blog.confirmDelete").replace("{title}", () => article.title))) return;
    erreurAction = "";
    avis = "";
    try {
      const reponse = await apiFetch(`/blog/${article.id}`, { method: "DELETE" });
      // 404 : déjà supprimé ailleurs, le résultat est le même.
      if (!reponse.ok && reponse.status !== 404) {
        erreurAction = messageDErreur(await erreurDeReponse(reponse), $tr);
        return;
      }
    } catch (e) {
      erreurAction = messageDErreur(erreurDExecution(e), $tr);
      return;
    }
    const index = articles.findIndex((a) => a.id === article.id);
    articles = articles.filter((a) => a.id !== article.id);
    sourcesParArticle.delete(article.id);
    avertissementsParArticle.delete(article.id);
    avis = $tr("admin.blog.deletedNotice").replace("{title}", () => article.title);
    // Le focus, perdu avec la ligne supprimée, passe à la ligne suivante (ou
    // précédente), sinon au titre de la liste.
    await tick();
    const voisin = articles[index] ?? articles[index - 1];
    (voisin ? document.getElementById(`modifier-${voisin.id}`) : titreDeLaListe)?.focus();
  }

  onMount(() => charger(true));
</script>

<!-- Pas de <svelte:head> ici : admin/+layout.svelte calcule le titre de
     l'onglet pour toutes les pages de l'administration (TITRES_ADMIN). -->

<div class="space-y-6">
  <!-- En-tête. Empilé sur téléphone, bouton sur toute la largeur comme ceux
       de Documents et d'Utilisateurs ; en ligne à partir de md. Générateur
       ouvert, le bouton devient secondaire, avec la croix. Masqué pendant
       une génération (le panneau a son bouton « Arrêter ») et quand l'API
       n'a pas de blog : générer y était voué à l'échec. -->
  <div class="flex flex-col gap-4 sm:pb-2 md:flex-row md:items-center md:justify-between">
    <div class="min-w-0">
      <h1 class="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-950 dark:text-white">{$tr("admin.blog")}</h1>
      <p class="mt-1 text-pretty text-zinc-500 dark:text-zinc-400">{$tr("admin.blog.subtitle")}</p>
    </div>
    {#if etat !== "non_active" && !generationEnCours}
      <button
        type="button"
        on:click={() => {
          generateurOuvert = !generateurOuvert;
        }}
        aria-expanded={generateurOuvert}
        class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors sm:self-start md:shrink-0 md:self-auto {generateurOuvert
          ? 'border border-zinc-300 bg-white text-zinc-800 hover:border-zinc-950 hover:text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-200 dark:hover:text-white'
          : 'bg-zinc-950 text-white shadow-sm hover:bg-black dark:bg-white dark:text-zinc-950 dark:shadow-none dark:hover:bg-zinc-200'}"
      >
        <Icone nom={generateurOuvert ? "x" : "sparkles"} class="text-lg" />
        {generateurOuvert ? $tr("admin.blog.closeGenerator") : $tr("admin.blog.generate")}
      </button>
    {/if}
  </div>

  {#if etat === "non_active"}
    <div
      class="flex gap-3 rounded-2xl border border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 sm:p-6"
      data-testid="blog-non-active"
    >
      <Icone nom="cloud-off" class="mt-0.5 shrink-0 text-lg" />
      <p class="text-pretty">{$tr("admin.blog.notActive")}</p>
    </div>
  {/if}

  <!-- Ce qui vient de se passer : présent dès l'ouverture (région vivante). -->
  <div role="status" class={avis ? "" : "sr-only"}>
    {#if avis}
      <div
        class="flex gap-3 rounded-xl border border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        data-testid="blog-avis"
      >
        <Icone nom="circle-check" class="mt-0.5 shrink-0 text-base" />
        <p class="coupe-mots min-w-0">{avis}</p>
      </div>
    {/if}
  </div>

  {#if erreurAction}
    <div
      role="alert"
      class="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
    >
      <Icone nom="circle-alert" class="mt-0.5 shrink-0 text-base" />
      <p class="coupe-mots min-w-0">{erreurAction}</p>
    </div>
  {/if}

  <!-- Le générateur reste monté pendant une génération (le bouton qui le
       ferme est masqué) : la requête et son résultat lui appartiennent. -->
  {#if generateurOuvert && etat !== "non_active"}
    <Generateur bind:enCours={generationEnCours} onGenere={apresGeneration} onFinSansResultat={() => charger(false)} />
  {/if}

  <!-- Liste des articles -->
  {#if etat !== "non_active"}
    <div class="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <!-- Titre de carte du guide (§ 4.2 : 16 puis 18 px). Il reçoit le focus
           quand la dernière ligne disparaît. Le compte n'est donné que pour
           une liste chargée. -->
      <div class="flex min-h-[4.25rem] items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800 sm:px-6">
        <h2
          bind:this={titreDeLaListe}
          tabindex="-1"
          class="text-base font-bold text-zinc-950 focus:outline-none dark:text-white sm:text-lg"
        >
          {etat === "pret" ? $tr("admin.blog.listTitle").replace("{n}", String(articles.length)) : $tr("admin.blog.listTitleBare")}
        </h2>
        <button
          type="button"
          on:click={actualiser}
          aria-disabled={rafraichissement || etat === "chargement" ? "true" : undefined}
          class="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
        >
          <Icone nom="rotate-ccw-clock" class="text-base {rafraichissement ? 'motion-safe:animate-spin' : ''}" />
          {rafraichissement ? $tr("admin.blog.refreshing") : $tr("admin.blog.refresh")}
        </button>
      </div>

      {#if etat === "chargement"}
        <div class="py-16 text-center text-zinc-500 dark:text-zinc-400">
          <Icone nom="loader-circle" class="mx-auto mb-3 block h-8 w-8 text-zinc-950 motion-safe:animate-spin dark:text-white" />
          {$tr("common.loading")}
        </div>
      {:else if etat === "erreur"}
        <div class="space-y-4 px-4 py-10 text-center sm:px-6" role="alert" data-testid="blog-liste-erreur">
          <p class="coupe-mots text-sm text-red-700 dark:text-red-300">
            {$tr("admin.blog.loadError").replace("{message}", () => erreurListe)}
          </p>
          <button
            type="button"
            on:click={() => charger(true)}
            class="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-5 py-2 text-sm font-semibold text-zinc-800 transition-colors hover:border-zinc-950 hover:text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-200 dark:hover:text-white"
          >
            {$tr("common.retry")}
          </button>
        </div>
      {:else if articles.length === 0}
        <div class="py-16 text-center text-zinc-500 dark:text-zinc-400">
          <Icone nom="newspaper" class="mb-2 text-4xl" />
          <p>{$tr("admin.blog.empty")}</p>
        </div>
      {:else}
        <ul class="divide-y divide-zinc-200 dark:divide-zinc-800">
          {#each articles as article (article.id)}
            {@const aVerifier = nombreDePoints(article, $tr, avertissementsParArticle)}
            {@const ancien = estAncien(article)}
            {@const lisible = visibleDuPublic(article)}
            <!-- Sous sm, les actions passent sous le contenu, en rangée de
                 boutons comme dans les cartes de Documents et d'Utilisateurs. -->
            <li class="px-4 sm:px-6 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors">
              <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div class="min-w-0 flex-1 space-y-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span
                      class="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      >{nomRubrique(article.category, $language.current)}</span
                    >
                    <!-- « Publié » seulement pour un article que le public lit :
                         publié avant la vérification, il est « À reprendre »
                         (décision du propriétaire du 30/10). -->
                    <BadgeDePublication {article} />
                    <span class="font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400"
                      >{formatDateCourte(article.publishedAt, $language.current)}</span
                    >
                    <!-- Où en est un article qui n'est pas en ligne : « Prêt à
                         publier », « Relecture incomplète », « Contrôle IA à
                         relancer »… (état calculé par le serveur). Un article
                         « À reprendre » le dit déjà par son badge. -->
                    {#if !lisible && article.etatPublication && !ancien}
                      <span
                        class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium {article.etatPublication === 'publiable'
                          ? 'border-zinc-950 text-zinc-950 dark:border-white dark:text-white'
                          : 'border-dashed border-zinc-400 text-zinc-700 dark:border-zinc-500 dark:text-zinc-300'}"
                        data-testid="blog-etat"
                      >
                        {$tr(`admin.blog.etat.${article.etatPublication}`)}
                      </span>
                    {/if}
                    <!-- Les points à vérifier, visibles dès la liste, comptés
                         comme dans la fenêtre (`nombreDePoints`). -->
                    {#if aVerifier > 0}
                      <span
                        class="inline-flex items-center gap-1 rounded-full border border-dashed border-zinc-400 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:border-zinc-500 dark:text-zinc-300"
                      >
                        <Icone nom="triangle-alert" class="text-sm" />
                        {$tr("admin.blog.warningsCount").replace("{n}", String(aVerifier))}
                      </span>
                    {/if}
                  </div>
                  <!-- Le titre nomme l'article pour les boutons de la ligne
                       (`aria-describedby`) : sur N articles, un lecteur d'écran
                       annonçait N fois « Modifier » sans dire lequel. Le nom
                       des boutons reste « Modifier », « Supprimer ». -->
                  <h3
                    id="titre-article-{article.id}"
                    class="coupe-mots line-clamp-2 text-base font-medium text-zinc-950 dark:text-white"
                    title={article.title}
                  >
                    {article.title}
                  </h3>
                  {#if article.isPublished && !lisible}
                    <p class="text-xs font-medium text-zinc-700 dark:text-zinc-300">{$tr("admin.blog.hiddenHelp")}</p>
                  {/if}
                  <p class="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">{sansRenvoisAuxExtraits(article.context)}</p>
                </div>
                <div class="flex items-center gap-2 sm:shrink-0 sm:gap-1">
                  <!-- « Voir » : la page publique pour un article que le public
                       lit ; pour un brouillon ou un article caché du public,
                       l'APERÇU de l'administration, jamais l'adresse publique
                       (qui répond 404). -->
                  {#if lisible}
                    <a
                      href="/blog/{encodeURIComponent(article.slug)}"
                      target="_blank"
                      rel="noopener"
                      class="{ACTION} {ACTION_NEUTRE}"
                      title={$tr("admin.blog.view")}
                      aria-label={$tr("admin.blog.view")}
                      aria-describedby="titre-article-{article.id}"
                    >
                      {$tr("admin.blog.viewShort")}
                      <Icone nom="external-link" class="text-sm" />
                    </a>
                  {:else}
                    <button
                      type="button"
                      on:click={() => ouvrir(article, "apercu")}
                      class="{ACTION} {ACTION_NEUTRE}"
                      title={article.isPublished ? $tr("admin.blog.previewHidden") : $tr("admin.blog.preview")}
                      aria-label={article.isPublished ? $tr("admin.blog.previewHidden") : $tr("admin.blog.preview")}
                      aria-describedby="titre-article-{article.id}"
                    >
                      {$tr("admin.blog.viewShort")}
                      <Icone nom="eye" class="text-sm" />
                    </button>
                  {/if}
                  <button
                    type="button"
                    id="modifier-{article.id}"
                    on:click={() => ouvrir(article, "edition")}
                    aria-describedby="titre-article-{article.id}"
                    class="{ACTION} {ACTION_NEUTRE}"
                  >
                    {$tr("admin.blog.edit")}
                  </button>
                  <button
                    type="button"
                    on:click={() => supprimer(article)}
                    aria-describedby="titre-article-{article.id}"
                    class="{ACTION} {ACTION_SUPPRIMER}"
                  >
                    {$tr("admin.delete")}
                  </button>
                </div>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</div>

<!-- Fenêtre de relecture, hors du conteneur `space-y-6` de la page : enfant
     de celui-ci, le voile fixe en recevait la marge du haut. Clé sur
     l'article : une autre ligne ouvre une fenêtre neuve, formulaire compris. -->
{#if relecture}
  {#key relecture.article.id}
    <FenetreDeRelecture
      article={relecture.article}
      vue={relecture.vue}
      sources={sourcesParArticle.get(relecture.article.id) ?? []}
      avertissementsDeGeneration={avertissementsParArticle.get(relecture.article.id) ?? []}
      onFermer={fermerLaRelecture}
      onMisAJour={surMiseAJour}
      onDisparu={() => charger(false)}
    />
  {/key}
{/if}
