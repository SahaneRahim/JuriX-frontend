<script lang="ts">
  import { apiFetch } from '$lib/api';
  import Icone from "$lib/components/Icone.svelte";
  import StatsCard from "$lib/components/admin/StatsCard.svelte";
  import { onMount } from "svelte";
  // Date courte, celle de tous les écrans de l'administration (documents,
  // utilisateurs, blog, import en lot) : cinq formats différents coexistaient
  // pour la même information.
  import { formatDateCourte, formatHeure } from "$lib/format";
  import { language, t, tr, translations, type Language } from "$lib/stores/language";
  import { PERSONA_ICONE, PERSONA_SLUG } from "$lib/stores/persona";
  import { repartitionParProfil } from "$lib/repartition-profils";
  import type { AnalyticsOverview, AnalyticsSearch, AnalyticsUsage, Law } from '$lib/types';

let overview: AnalyticsOverview = { total_laws: 0, by_language: {}, recent_laws: 0 };
  let usage: AnalyticsUsage = {
    window_days: 7, conversations: 0, questions_asked: 0, answers_generated: 0,
    searches: 0, active_users: 0, median_answer_time_ms: 0,
  };
  let searchStats: AnalyticsSearch = {
    window_days: 7, total_searches: 0, median_response_time_ms: 0,
    p95_response_time_ms: 0, max_response_time_ms: 0, cache_hit_rate_percent: 0,
  };

  /**
   * Derniers documents ingeres, dans leur PROPRE variable.
   *
   * Ils venaient d'une quatrieme requete puis etaient greffes sur `overview`
   * sous le nom `latest_laws` — un champ que `/analytics/overview` ne renvoie
   * pas et n'a jamais renvoye. Melanger une reponse du serveur et une donnee
   * composee par le client dans le meme objet rendait impossible de dire, en
   * lisant la page, d'ou venait quoi.
   */
  let dernieresLois: Law[] = [];

  /** Le mode le plus utilisé : la barre de référence du graphique (pleine hauteur). */
  $: modeMax = Math.max(0, ...Object.values(searchStats.modes_usage ?? {}).map(Number));
  let loading = true;
  let erreur = "";
  /**
   * Heure du dernier chargement réussi.
   *
   * L'heure affichée était un `new Date()` écrit dans le balisage : Svelte ne
   * le recalculait qu'au changement de langue, jamais après « Actualiser ».
   * Elle disait l'heure d'arrivée sur la page, pas celle des chiffres.
   */
  let derniereMiseAJour: Date | null = null;

  /**
   * Chargement du tableau de bord.
   *
   * Deux defauts corriges ici :
   *
   * 1. `loading` etait declare et remis a false, mais JAMAIS lu dans le
   *    balisage, et le catch ne faisait qu'un console.error. Backend eteint, la
   *    page affichait « 0 documents, 0 recherches, 0 utilisateurs » comme des
   *    chiffres reels. Un operateur ne pouvait pas distinguer une base vide
   *    d'un serveur injoignable.
   * 2. Les quatre appels passaient par `fetch()` nu : aucun en-tete
   *    Authorization, et surtout aucune gestion du 401. Un jeton expire
   *    laissait donc l'ecran affiche et vide, sans que la garde du layout se
   *    declenche — elle depend de `authStore.logout()`, que seul `apiFetch`
   *    appelle.
   *
   * La quatrieme requete etait aussi en cascade derriere la premiere alors
   * qu'elle n'a besoin de rien : elle rejoint le lot parallele.
   */
  async function loadStats() {
    loading = true;
    erreur = "";
    try {
      const [overviewRes, usageRes, searchRes, lawsRes] = await Promise.all([
        apiFetch("/analytics/overview"),
        apiFetch("/analytics/usage"),
        apiFetch("/analytics/search"),
        apiFetch("/laws/?limit=4"),
      ]);

      if (!overviewRes.ok && !usageRes.ok && !searchRes.ok) {
        erreur = $tr("admin.statsError");
        return;
      }

      if (overviewRes.ok) overview = await overviewRes.json();
      usageDisponible = usageRes.ok;
      if (usageRes.ok) usage = await usageRes.json();
      if (searchRes.ok) searchStats = await searchRes.json();
      if (lawsRes.ok) dernieresLois = await lawsRes.json();
      derniereMiseAJour = new Date();
    } catch (e) {
      console.error("Error fetching admin stats:", e);
      erreur = $tr("admin.statsError");
    } finally {
      loading = false;
    }
  }

  onMount(loadStats);

  // Conversations par profil, sur la fenetre de `/analytics/usage`. La ligne
  // « Profil general » compte les refus de la question du profil, et ceux
  // qui ont choisi ce profil depuis l'en-tete.
  // Indisponible n'est pas zero : une panne de `/analytics/usage`, ou un
  // backend sans `personas_usage`, ne s'affiche pas « aucune conversation ».
  let usageDisponible = false;
  $: profilsMesures = usageDisponible && usage.personas_usage != null;
  $: lignesProfils = repartitionParProfil(usage.personas_usage);
  $: pourcentage = new Intl.NumberFormat($language.current, {
    style: "percent",
    maximumFractionDigits: 0,
  });

  // Nombres et durées à la façon de la langue de l'interface, comme les
  // pourcentages : « 1 284 » et « 310 ms » en français, « 1,284 » et
  // « 310 ms » en anglais. Le temps de réponse s'écrivait « 310ms », collé.
  $: nombre = new Intl.NumberFormat($language.current);
  $: millisecondes = new Intl.NumberFormat($language.current, {
    style: "unit",
    unit: "millisecond",
    unitDisplay: "short",
  });
  // Deux-points précédés d'une espace insécable en français, collés au mot
  // en anglais (même règle que src/routes/compare/+page.svelte).
  $: deuxPoints = $language.current === "fr" ? "\u00A0:" : ":";
  /**
   * La période mesurée, sous le titre d'un graphique ou d'un chiffre clé.
   * La traduction est passée en argument (`$tr`) : l'expression du balisage
   * qui l'appelle suit ainsi le changement de langue.
   */
  function fenetre(traduire: (cle: string) => string, jours: number | undefined): string {
    return traduire("admin.lastDays").replace("{n}", String(jours ?? 7));
  }

  /**
   * Libellé d'un mode de recherche (`text`, `semantic`, `hybrid` : les modes
   * de app/schemas/search.py).
   *
   * L'axe affichait la valeur brute de l'API, juste mise en capitale par CSS
   * (« Hybrid », « Semantic ») : de l'anglais sur la page française. Le
   * libellé vient de la clé `admin.searchMode.<mode>`. Un mode que le front
   * ne connaît pas, ou dont la clé manque, garde sa valeur brute au lieu
   * d'afficher le nom de la clé, comme un statut inconnu dans StatusBadge.
   */
  function libelleMode(mode: string, langue: Language): string {
    const cle = `admin.searchMode.${mode}`;
    return cle in translations[langue] ? t(cle, langue) : mode;
  }
</script>

<!-- Empilé sous md : sur une seule ligne, l'heure de mise à jour et
     « Actualiser » serraient le titre dans une colonne étroite (avec le h1
     du guide, en 36 px, « Tableau de Bord » passait sur deux lignes de 640 à
     700 px). -->
<div class="mb-6 flex flex-col gap-4 sm:mb-8 md:flex-row md:items-center md:justify-between">
  <div class="min-w-0">
    <h1 class="text-3xl font-bold tracking-tight text-zinc-950 dark:text-white sm:text-4xl">{$tr("admin.dashboard")}</h1>
    <!-- `text-pretty`, comme les sous-titres des autres pages de
         l'administration : le navigateur évite un mot seul en dernière ligne
         (« Ajoutez, modifiez ou supprimez des textes de / loi » à 390 px). -->
    <p class="mt-1 text-pretty text-zinc-500 dark:text-zinc-400">{$tr("admin.dashboardDesc")}</p>
  </div>
  <div class="flex flex-wrap items-center justify-between gap-3 md:shrink-0 md:justify-end">
    <!-- L'heure du dernier chargement, à la façon de la langue : « 06:24 »
         et non « 6:24:19 AM », que donnait toLocaleTimeString() sans locale.
         L'heure en chasse fixe (Méta du guide, § 4.2), comme toutes les dates
         de l'administration ; son libellé reste dans la police du texte,
         comme « Dernière connexion » dans les cartes des comptes. -->
    {#if derniereMiseAJour}
      <p class="text-xs font-medium text-zinc-500 dark:text-zinc-400 sm:text-sm">
        {$tr("admin.lastUpdate")}{deuxPoints}
        <time class="font-mono tabular-nums" datetime={derniereMiseAJour.toISOString()}
          >{formatHeure(derniereMiseAJour, $language.current)}</time
        >
      </p>
    {/if}
    <!-- 44 px à toute largeur : compacté à 38 px dès sm, il l'était aussi sur
         les tablettes, au doigt. -->
    <button
      class="ml-auto min-h-11 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition-colors hover:border-zinc-950 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-200 dark:hover:text-white"
      on:click={loadStats}
      disabled={loading}
      data-testid="admin-refresh"
    >
      {$tr("admin.refresh")}
    </button>
  </div>
</div>

{#if loading}
  <p class="py-20 text-center text-zinc-500 dark:text-zinc-400" data-testid="admin-loading">
    {$tr("common.loading")}
  </p>
{:else if erreur}
  <!-- Sans cette branche, un backend injoignable affichait « 0 documents,
       0 recherches, 0 utilisateurs » comme des faits mesures. Le rouge est
       celui des erreurs ; « Réessayer » n'est pas une action destructrice, il
       garde le bouton neutre, comme sur l'accueil. -->
  <div
    role="alert"
    data-testid="admin-error"
    class="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/60 dark:bg-red-950/40 sm:p-8"
  >
    <p class="mb-4 flex items-center justify-center gap-2 font-medium text-red-700 dark:text-red-300">
      <Icone nom="circle-alert" class="text-xl" />{erreur}
    </p>
    <button
      on:click={loadStats}
      data-testid="admin-retry"
      class="min-h-11 rounded-xl border border-zinc-300 bg-white px-5 py-2 font-semibold text-zinc-800 transition-colors hover:border-zinc-950 hover:text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-200 dark:hover:text-white"
      >{$tr("common.retry")}</button
    >
  </div>
{:else}
  <!-- Deux colonnes dès le téléphone : une par ligne, les quatre cartes
       faisaient environ 440 px de défilement à 390 px de large, pour quatre
       valeurs courtes. Quatre colonnes à partir de lg, comme la rangée du
       graphique et des derniers documents : la barre latérale restant un
       tiroir jusqu'à xl, le contenu garde au moins 960 px de 1 024 à 1 920 px
       (admin/+layout.svelte), des cartes de 222 px au plus étroit. Elles
       n'arrivaient qu'à xl : à 1 024 px, la page gardait la mise en page du
       portrait, cartes de 468 px (la valeur à 400 px de sa tuile) et 1 751 px
       de haut. Chaque carte est une sous-grille de trois rangées (StatsCard) :
       les valeurs d'une rangée restent alignées quand un titre passe à la
       ligne. Sous la rangée, l'écart de la grille (16 puis 24 px), comme
       entre les rangées suivantes : 32 px ici, 24 plus bas, auparavant.
       La rangée est un conteneur de requête (`[container-type:inline-size]`) :
       sur quatre colonnes, StatsCard n'affiche la tuile de son icône que si
       la rangée fait au moins 65 rem, c'est-à-dire si chaque carte garde au
       titre la place de tenir sur une ligne (voir StatsCard). -->
  <div class="mb-4 grid grid-cols-2 gap-4 [container-type:inline-size] sm:mb-6 sm:gap-6 lg:grid-cols-4">
    <StatsCard
      title={$tr("admin.totalDocs")}
      value={nombre.format(overview.total_laws ?? 0)}
      change={`+${nombre.format(overview.recent_laws ?? 0)}`}
      trend="up"
      icon="file-text"
    />
    <StatsCard
      title={$tr("admin.totalSearches")}
      value={nombre.format(searchStats.total_searches ?? 0)}
      detail={fenetre($tr, searchStats.window_days)}
      trend="neutral"
      icon="search"
    />
    <StatsCard
      title={$tr("admin.activeUsers")}
      value={nombre.format(usage.active_users ?? 0)}
      detail={fenetre($tr, usage.window_days)}
      trend="neutral"
      icon="users-round"
    />
    <StatsCard
      title={$tr("admin.responseTime")}
      value={millisecondes.format(searchStats.median_response_time_ms ?? 0)}
      detail={fenetre($tr, searchStats.window_days)}
      trend="neutral"
      icon="zap"
    />
  </div>

  <!-- Une seule colonne (graphique, puis derniers documents) sous lg. Le
       tiers de rangée attendait xl depuis l'époque où la barre latérale était
       une colonne dès lg : la liste n'y gardait qu'environ 120 px de texte, et
       les titres s'y réduisaient à deux ou trois mots (« Loi N°92/007 d… »).
       La barre restant un tiroir jusqu'à xl, le contenu fait au moins 960 px
       dès lg : la liste y garde 202 px de texte et deux lignes de titre, comme
       à 1 280 px. `grid-cols-1` explicite et `lg:col-span-2` : sans eux, la
       carte du graphique ouvrait deux colonnes implicites dimensionnées sur
       leur contenu, et les titres des derniers documents élargissaient la
       page au-delà de l'écran. -->
  <div class="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
    <!-- Search Activity Chart. En colonne (flex-col), le graphique prend à
         partir de lg toute la hauteur de la rangée : les titres des derniers
         documents, sur deux lignes, rendent la carte voisine plus haute, et
         le graphique laissait sinon une bande vide sous ses barres. -->
    <div
      class="flex min-w-0 flex-col rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none sm:p-6 lg:col-span-2"
    >
      <!-- Légende (« Les 7 derniers jours ») sous le titre au téléphone, sur
           sa ligne à partir de sm, dans les deux cartes : en `flex-wrap`,
           elle restait à côté d'un titre court et passait sous un long, et
           changeait de place d'une carte à sa voisine. -->
      <div class="mb-4 flex flex-col items-start gap-1 sm:mb-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <h3 class="text-base font-bold text-zinc-950 dark:text-white sm:text-lg">{$tr("admin.searchActivity")}</h3>
        <!-- La fenêtre d'observation est affichée plutôt que choisie : le
             backend accepte désormais `?days=`, mais un sélecteur suppose des
             données sur plusieurs semaines. Il sera utile quand il y en aura. -->
        <span class="text-sm text-zinc-500 dark:text-zinc-400">{fenetre($tr, searchStats.window_days)}</span>
      </div>

      <!-- Placeholder Chart. Écran court (`court:`, téléphone en paysage) :
           160 px. En `sm:h-64`, la carte faisait environ 360 px de haut pour
           trois barres, tout l'écran de 360 px sous la barre du haut. La
           variante l'emporte sur sm: et lg: quel que soit l'ordre des
           classes (tailwind.config.js) ; sur un écran large mais court, le
           graphique garde lg:flex-1 et s'étire à la hauteur de sa rangée. -->
      <div class="relative h-48 w-full sm:h-64 lg:h-auto lg:min-h-64 lg:flex-1 court:h-40 court:min-h-40">
        {#if searchStats.modes_usage}
          <!-- Colonnes en flex-1 et non à 30 % chacune : dès quatre modes, les
               barres dépassaient du graphique. Chaque barre vit dans une piste
               de hauteur définie, sans quoi son pourcentage de hauteur ne se
               résout pas. Le nombre de requêtes est écrit au-dessus de la
               barre : en info-bulle de survol, il n'apparaissait jamais au
               doigt.
               Posé SUR sa barre (en absolu, juste au-dessus d'elle) et non en
               tête de colonne : aligné en haut du graphique, « 80 » flottait
               à 200 px au-dessus d'une barre de 11 px. Le haut de la piste
               (pt-5) lui garde sa place au-dessus de la barre la plus haute.
               Barres pleines, zinc-950 ou blanc (guide § 4.17) : l'opacité de
               85 % les grisait, et elles ne ressemblaient plus aux barres des
               profils, dessous.
               Largeur bornée à 80 px et centrée dans la colonne : sur toute sa
               largeur (203 px en 1 440, 277 en 1 024), chaque barre était un
               aplat massif, noir en clair, blanc pur en sombre, l'objet le
               plus voyant du tableau de bord. Hauteur relative au mode le
               plus utilisé (`modeMax`), et non au total : la plus haute
               atteint le haut du graphique, au lieu de s'arrêter à 86 % sous
               une bande vide. Le nombre écrit au-dessus garde la valeur. -->
          <div class="flex h-full gap-3 px-2 sm:gap-6 sm:px-4">
            {#each Object.entries(searchStats.modes_usage) as [mode, count] (mode)}
              <div class="flex min-w-0 flex-1 flex-col items-center gap-1">
                <div class="flex min-h-0 w-full flex-1 items-end justify-center pt-5">
                  <div
                    class="relative w-full max-w-20 rounded-t-lg bg-zinc-950 dark:bg-white"
                    style="height: {Math.min(
                      100,
                      Math.max(modeMax ? (Number(count) / modeMax) * 100 : 0, 5),
                    )}%"
                  >
                    <span
                      class="absolute inset-x-0 bottom-full mb-1 whitespace-nowrap text-center text-xs font-semibold tabular-nums text-zinc-700 dark:text-zinc-300"
                      >{nombre.format(Number(count))}<span class="sr-only"> {$tr("admin.requests")}</span></span
                    >
                  </div>
                </div>
                <!-- first-letter et non capitalize : un libellé traduit en
                     deux mots (« Plein texte ») ne prend pas de capitale au
                     second ; une valeur brute garde sa capitale initiale. -->
                <span class="max-w-full truncate text-xs font-medium text-zinc-600 first-letter:uppercase dark:text-zinc-400"
                  >{libelleMode(mode, $language.current)}</span
                >
              </div>
            {/each}
          </div>
        {:else}
          <div
            class="flex h-full items-center justify-center text-zinc-500 dark:text-zinc-400 text-sm"
          >
            {$tr("admin.noActivityData")}
          </div>
        {/if}
      </div>
    </div>

    <!-- Recent Uploads -->
    <div class="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none sm:p-6">
      <h3 class="mb-4 text-base font-bold text-zinc-950 dark:text-white sm:text-lg">{$tr("admin.latestDocs")}</h3>
      <div class="space-y-4">
        {#if dernieresLois.length > 0}
          {#each dernieresLois as law (law.id)}
            <div class="flex items-start gap-3">
              <div
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200/70 bg-zinc-100 text-zinc-800 dark:border-zinc-700/60 dark:bg-zinc-800 dark:text-zinc-200"
              >
                <Icone nom="file-text" class="text-xl" />
              </div>
              <div class="min-w-0 flex-1">
                <!-- Deux lignes au plus, et non une seule tronquée : en tiers de
                     rangée (lg), une ligne ne montrait que le début de la cote.
                     Les cotes sans espace se coupent au lieu d'élargir la carte. -->
                <p class="coupe-mots line-clamp-2 text-sm font-medium text-zinc-950 dark:text-zinc-100" title={law.title}>
                  {law.title}
                </p>
                <p class="font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                  {formatDateCourte(law.created_at, $language.current)}
                </p>
              </div>
            </div>
          {/each}
        {:else}
          <div class="text-center py-6 text-zinc-500 dark:text-zinc-400 text-sm">
            {$tr("admin.noRecentDocs")}
          </div>
        {/if}
      </div>
      <!-- 44 px à toute largeur, comme les autres boutons : py-2 en faisait
           38 dès sm, tablettes comprises. Sur toute la largeur de la carte
           au téléphone (sous le pouce) et dans l'étroite colonne de lg ; à
           sa largeur entre les deux : sur une tablette en portrait ou un
           téléphone en paysage, étiré sur 640 à 670 px, il n'était plus
           qu'une longue barre vide. `w-fit` et non `inline-flex` : le lien
           reste un bloc, sans la ligne de texte qu'un élément en ligne
           ajouterait sous lui. -->
      <a
        href="/admin/documents"
        class="mt-6 flex min-h-11 w-full items-center justify-center rounded-xl border border-zinc-300 bg-white px-5 text-center text-sm font-semibold text-zinc-800 transition-colors hover:border-zinc-950 hover:text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-200 dark:hover:text-white sm:w-fit lg:w-full"
      >
        {$tr("admin.viewAll")}
      </a>
    </div>
  </div>

  <section
    class="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none sm:mt-6 sm:p-6"
    aria-labelledby="admin-profils-titre"
    data-testid="admin-profils"
  >
    <div class="mb-4 flex flex-col items-start gap-1 sm:mb-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <h3 id="admin-profils-titre" class="text-base font-bold text-zinc-950 dark:text-white sm:text-lg">
        {$tr("admin.personasTitle")}
      </h3>
      <span class="text-sm text-zinc-500 dark:text-zinc-400">{fenetre($tr, usage.window_days)}</span>
    </div>
    {#if !profilsMesures}
      <p class="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400" data-testid="admin-profils-indisponible">
        {$tr("admin.personasUnavailable")}
      </p>
    {:else if lignesProfils.length > 0}
      <!-- Deux colonnes à partir de lg : sur une seule, en 1 440, libellé et
           valeur (« 180 · 44 % ») se tenaient à 1 070 px l'un de l'autre,
           au-dessus de pistes de toute la largeur. -->
      <ul class="grid gap-4 lg:grid-cols-2 lg:gap-x-12">
        {#each lignesProfils as ligne (ligne.cle)}
          <li data-testid="admin-profil" data-profil={ligne.profil ?? ligne.cle}>
            <div class="mb-1 flex items-center justify-between gap-4 text-sm">
              <span class="coupe-mots flex min-w-0 items-center gap-2 font-medium text-zinc-700 dark:text-zinc-300">
                <!-- Un profil que le front ne connaît pas garde la ligne (l'écarter
                     fausserait le total) et prend le point d'interrogation. -->
                <Icone
                  nom={ligne.profil ? PERSONA_ICONE[ligne.profil] : "circle-question-mark"}
                  class="text-base text-zinc-500 dark:text-zinc-400"
                />
                {ligne.profil === "general"
                  ? $tr("persona.general")
                  : ligne.profil
                    ? $tr(`persona.${PERSONA_SLUG[ligne.profil]}.nom`)
                    : ligne.cle}
              </span>
              <span class="shrink-0 tabular-nums text-zinc-600 dark:text-zinc-400"
                >{nombre.format(ligne.conversations)} · {pourcentage.format(ligne.part)}</span
              >
            </div>
            <!-- Piste en zinc-200 : en zinc-100 sur la carte blanche (1,1:1),
                 elle ne se voyait presque pas, et la barre semblait flotter.
                 En sombre, zinc-700 (1,7:1 sur la carte zinc-900) et non
                 zinc-800 (1,2:1), qui laissait le même défaut ; c'est aussi la
                 piste des barres de progression de l'import en lot. -->
            <div class="h-2 rounded-full bg-zinc-200 dark:bg-zinc-700" aria-hidden="true">
              <div
                class="h-2 rounded-full bg-zinc-950 dark:bg-white"
                style="width: {Math.max(ligne.part * 100, 1)}%"
              ></div>
            </div>
          </li>
        {/each}
      </ul>
      <p class="mt-4 text-xs text-zinc-500 dark:text-zinc-400">{$tr("admin.personasNote")}</p>
    {:else}
      <p class="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">{$tr("admin.personasEmpty")}</p>
    {/if}
  </section>
{/if}
