<script lang="ts">
  /**
   * Comparer deux régimes : deux recherches distinctes dans le corpus, puis
   * une grille sourcée article par article, dont chaque cellule se vérifie
   * (le texte de l'article cité se déplie sous elle).
   *
   * REFONTE A, NIVEAU A (docs/refonte/PASSATION.md, étape E7, décision R2).
   * La structure ne change pas : formulaire, tableau rangé en cartes sous lg,
   * rôles ARIA, `data-testid` et `id` sont ceux d'avant. La page reprend le
   * style et le mouvement de Comparer.dc.html :
   * - pendant l'attente, la balance pèse (BalanceAnimee, `attente`) à la
   *   place des trois points qui rebondissaient ; la région `compare-loading`
   *   (`role="status"`) et son libellé disent toujours l'attente ;
   * - à l'arrivée, les lignes de la grille viennent l'une après l'autre ; à
   *   partir de lg, la cellule du premier sujet vient de la gauche, celle du
   *   second de la droite (`mv-comparer`, src/lib/mouvement.css) ;
   * - « Voir le texte » déroule l'article cité en place, et son chevron
   *   tourne ;
   * - la grille est une carte à filets, ses en-têtes sur le fond `fill`, et
   *   le texte cité est en Literata Texte (`font-texte`).
   *
   * NIVEAU B (R2, validé à 768 et 1 024 px). Le formulaire est le gréement de
   * la maquette : montant, pivot, fléau, deux cartes suspendues qui portent
   * les champs, bouton sur la base. Voir la feuille de style en bas de page.
   * En mouvement réduit, rien ne bouge : la balance reste droite, la grille
   * est là d'un coup, le texte se déplie sans glisser.
   */
  import { onMount } from "svelte";
  import { quintOut } from "svelte/easing";
  import { slide } from "svelte/transition";
  import { API_URL } from "$lib/api";
  import BalanceAnimee from "$lib/components/BalanceAnimee.svelte";
  import MetaSeo from "$lib/components/MetaSeo.svelte";
  import SiteHeader from "$lib/components/SiteHeader.svelte";
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import ChatFab from "$lib/components/ChatFab.svelte";
  import Icone from "$lib/components/Icone.svelte";
  import { nomCourtDuTexte, typographieDesNumeros } from "$lib/sources";
  import { tr } from "$lib/stores/language";
  import { language } from "$lib/stores/language";
  import { duree } from "$lib/mouvement";
  import type { ComparisonCell, ComparisonResponse, ComparisonRow, SourceRef } from "$lib/types";

  // POURQUOI TOUT S'EFFACE SUR ÉCRAN COURT : voir la feuille de style.
  const CARTE =
    "block rounded-2xl border border-zinc-200 bg-white p-4 shadow-feuille dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-feuille-sombre court:rounded-none court:border-0 court:bg-transparent court:p-0 court:shadow-none court:dark:bg-transparent court:dark:shadow-none";

  let sujetA = "";
  let sujetB = "";
  let resultat: ComparisonResponse | null = null;
  /**
   * Le gréement a fini d'arriver : ses classes d'entrée sont retirées dès la
   * première comparaison. POURQUOI. Un élément en `backwards` repart de zéro
   * si son animation est rejouée : quand la grille allonge la page, un
   * changement de taille de la fenêtre de rendu rejouait l'entrée, et le fléau,
   * le pivot et les chaînes restaient à zéro pendant leur délai (trou blanc
   * dans les captures en pleine page). Sans classe, il n'y a plus rien à
   * rejouer : l'état final est le style statique (A2 § 2.1).
   */
  let greementPose = false;
  let enCours = false;
  // Envoi inactif jusqu'au montage : voir login/+page.svelte. Un Entrée avant
  // l'hydratation rechargeait la page en GET et vidait les deux champs.
  let monte = false;
  onMount(() => (monte = true));
  let erreur = "";

  /**
   * Cellules dont le texte source est déplié, par clé « ligne:colonne ».
   *
   * Un Set réaffecté et non muté : Svelte n'observe que les affectations.
   */
  let depliees = new Set<string>();

  $: currentLanguage = $language.current;

  /**
   * Deux-points de la langue de l'interface : précédé d'une espace insécable
   * en français, collé au mot en anglais. Avec une espace ordinaire, le « : »
   * pouvait commencer une ligne (« : 2 + 1 · Recherche 140 ms… » à 390 px),
   * et l'anglais héritait de l'espace française.
   */
  $: deuxPoints = currentLanguage === "fr" ? "\u00a0:" : ":";

  /**
   * Les deux colonnes d'une ligne, typees.
   *
   * Un tableau litteral `[["a", ligne.a], ["b", ligne.b]]` dans le `{#each}`
   * donne a Svelte un type `string | ComparisonCell` et casse la verification.
   */
  function colonnes(ligne: ComparisonRow): { cote: "a" | "b"; cellule: ComparisonCell }[] {
    return [
      { cote: "a", cellule: ligne.a },
      { cote: "b", cellule: ligne.b },
    ];
  }

  /**
   * Le nom du texte cité (« Code Minier », « Décret n° 2019/143 »), comme les
   * sources du chat ($lib/sources) : la puce et l'extrait affichaient sa cote
   * interne (« PRC-4722 · art. 34 »), qui ne dit pas de quel texte il s'agit,
   * et que P2 et P11 retirent de tout écran. « n° » suivi d'une espace
   * insécable, la graphie des listes. Sans intitulé en base, « Texte sans
   * intitulé » : la cote n'est jamais un repli.
   */
  function nomDeLaSource(source: SourceRef, t: (cle: string) => string): string {
    return typographieDesNumeros(nomCourtDuTexte(source.law_title, source.reference)) || t("chat.citation.sansIntitule");
  }

  /**
   * Délai d'arrivée de la ligne `i` de la grille (0 pour la première), en
   * millisecondes : la variable `--d` de `mv-comparer`.
   *
   * POURQUOI 150 MS PUIS 160 PAR RANG, PLAFONNÉ AU SIXIÈME. Ce sont les délais
   * de la maquette (`--r * 160ms + 150ms`) : la grille arrive juste après
   * l'attente, une ligne après l'autre, de haut en bas. Au-delà du sixième
   * rang, le délai ne croît plus : aucune ligne ne part après 950 ms, et aucun
   * délai d'entrée ne dépasse une seconde (décision D9), même pour une grille
   * de douze critères ; les dernières, hors du premier écran, arrivent
   * ensemble.
   */
  function delaiDeLaLigne(i: number): number {
    return 150 + Math.min(i, 5) * 160;
  }

  /**
   * Ce qui suit la grille (différences, angles morts, note de l'IA) arrive
   * 300 ms après le départ de sa dernière ligne, et jamais après une seconde
   * (D9 : la note de la maquette attendait 1,2 s). « Une seule chose animée
   * à la fois » (A2 § 1) : la grille, puis ce qu'on en tire.
   */
  $: delaiDeLaSuite = resultat ? Math.min(delaiDeLaLigne(Math.max(resultat.rows.length - 1, 0)) + 300, 1000) : 0;

  function basculer(cle: string) {
    const copie = new Set(depliees);
    if (copie.has(cle)) copie.delete(cle);
    else copie.add(cle);
    depliees = copie;
  }

  async function comparer() {
    // Memes bornes que ComparisonRequest cote backend (2 a 200 caracteres) :
    // sans ce controle, un sujet d'une lettre partait au serveur et revenait en
    // 422, affiche comme une « erreur serveur » qui n'en est pas une.
    if (sujetA.trim().length < 2 || sujetB.trim().length < 2) {
      erreur = $tr("compare.errorEmpty");
      return;
    }

    enCours = true;
    erreur = "";
    resultat = null;
    greementPose = true;
    depliees = new Set();

    try {
      const reponse = await fetch(`${API_URL}/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject_a: sujetA.trim(),
          subject_b: sujetB.trim(),
          language: currentLanguage,
        }),
      });

      if (reponse.ok) {
        resultat = await reponse.json();
      } else if (reponse.status === 404) {
        erreur = $tr("compare.errorNotFound");
      } else if (reponse.status === 429) {
        erreur = $tr("chat.errorQuota");
      } else if (reponse.status === 503) {
        erreur = $tr("chat.errorOverloaded");
      } else {
        erreur = $tr("chat.errorServer");
      }
    } catch {
      erreur = $tr("chat.errorNetwork");
    } finally {
      enCours = false;
    }
  }
</script>

<MetaSeo
  titre={$tr("compare.title")}
  description={$tr("compare.subtitle")}
  indexable={false}
/>

<!-- min-h-app (app.css) : 100dvh avec repli 100vh. `min-h-screen min-h-dvh`
     ne marche pas : Tailwind sort les deux classes par ordre alphabétique, et
     la valeur en vh, écrite après, l'emporte toujours. -->
<div class="min-h-app bg-background-light dark:bg-background-dark flex flex-col">
  <SiteHeader />

  <!-- Colonne commune aux pages de la section (Documents, catégorie,
       Recherche, Comparer) : marges de l'en-tête (16, 24 puis 48 px, le titre
       s'aligne sur le logo), puis 1 152 px de contenu au plus, centrés. La
       page restait à 16 px du bord jusqu'à lg, 8 px à gauche du logo.
       Titre de page du guide (§ 4.2), comme « Documents » : il était en
       24 puis 30 px, sans `tracking-tight`. `data-hors-du-bouton` (le
       formulaire, le résultat) : le bouton flottant de l'assistant se retire
       quand ils passent dessous (ChatFab, `eviter`). -->
  <!-- Écran court (`court:`, téléphone en paysage) : titre en 24 px (36 en
       740×360 sans variante) et marges resserrées, comme la page d'une
       catégorie ; avec le formulaire sur une ligne (plus bas), le bouton
       « Comparer » tombait à 369-412 px, sous le bas d'un écran de 360. -->
  <main id="contenu" class="flex-1 w-full max-w-[78rem] mx-auto px-4 sm:px-6 lg:px-12 py-6 sm:py-10 court:pt-3">
    <h1 class="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-950 dark:text-white mb-2 court:mb-1 court:text-2xl">
      {$tr("compare.title")}
    </h1>
    <p class="text-zinc-600 dark:text-zinc-300 mb-6 sm:mb-8 court:mb-3">{$tr("compare.subtitle")}</p>

    <!--
      Champs et bouton de 44 px, alignés par le bas (items-end). Le bouton
      descendait de 2 à 3 px sous les champs : un <input> en ligne laisse sous
      lui, dans son <label>, la place des jambages de la ligne de texte, et le
      bouton s'alignait sur le bas du label. En `block`, le champ EST le bas
      du label. Champs en text-base sous sm seulement (pas de zoom d'iOS),
      text-sm ensuite, et bouton principal du guide (§ 4.4, text-sm) : en
      16 px, les champs faisaient 46 px et le bouton 44.
      En gréement dès 640 px (voir la feuille de style), sauf sur écran court :
      dès 480 px, tout y tient sur une ligne. Un téléphone en paysage gardait
      les trois rangées du portrait, et le bouton passait sous le bas de
      l'écran. Les champs y gardent 190 px au moins (en
      568×320) ; plus étroit, c'est un écran en portrait, où l'empilement a
      la hauteur qu'il lui faut. Sous sm, sur cette ligne, le bouton prend
      les 46 px des champs en 16 px : à 44, il en dépassait de 2 px en haut.
    -->
    <form
      data-hors-du-bouton
      class="greement grid gap-4 items-end mb-8 sm:mb-10 court:mb-6 court:min-[480px]:grid-cols-[1fr_1fr_auto]"
      on:submit|preventDefault={comparer}
      data-testid="compare-form"
      novalidate
    >
      <!-- Décor seul : tout le sens est dans les champs et le bouton. Il n'est
           affiché que sur le gréement (voir la feuille de style). -->
      <div class="greement__decor" aria-hidden="true" data-testid="compare-greement">
        <span class="greement__montant bg-zinc-950 dark:bg-white" class:mv-greement-montant={!greementPose}></span>
        <span class="greement__fleau bg-zinc-950 dark:bg-white" class:mv-greement-fleau={!greementPose}></span>
        <span class="greement__pivot bg-zinc-950 ring-4 ring-zinc-50 dark:bg-white dark:ring-zinc-950" class:mv-greement-pivot={!greementPose}></span>
        <span class="greement__chaine greement__chaine--a bg-zinc-500 dark:bg-zinc-400" class:mv-greement-chaine={!greementPose}></span>
        <span class="greement__chaine greement__chaine--b bg-zinc-500 dark:bg-zinc-400" class:mv-greement-chaine={!greementPose}></span>
      </div>
      <label class={CARTE}>
        <span class="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1">
          {$tr("compare.subjectA")}
        </span>
        <input
          bind:value={sujetA}
          data-testid="compare-a"
          required
          minlength="2"
          maxlength="200"
          placeholder={$tr("compare.placeholderA")}
          class="block min-h-11 w-full px-4 py-2.5 rounded-xl border border-zinc-500 bg-white text-base sm:text-sm text-zinc-950 transition-colors focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 dark:border-zinc-500 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-200 dark:focus:ring-zinc-200"
        />
      </label>
      <label class={CARTE}>
        <span class="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1">
          {$tr("compare.subjectB")}
        </span>
        <input
          bind:value={sujetB}
          data-testid="compare-b"
          required
          minlength="2"
          maxlength="200"
          placeholder={$tr("compare.placeholderB")}
          class="block min-h-11 w-full px-4 py-2.5 rounded-xl border border-zinc-500 bg-white text-base sm:text-sm text-zinc-950 transition-colors focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 dark:border-zinc-500 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-200 dark:focus:ring-zinc-200"
        />
      </label>
      <button
        type="submit"
        disabled={enCours || !monte}
        data-testid="compare-submit"
        class="greement__bouton inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold bg-zinc-950 text-white shadow-sm transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:shadow-none dark:hover:bg-zinc-200 court:max-sm:min-h-[2.875rem]"
      >
        {enCours ? $tr("compare.loading") : $tr("compare.submit")}
      </button>
    </form>

    {#if enCours}
      <div
        role="status"
        aria-live="polite"
        data-testid="compare-loading"
        class="flex items-center gap-3 text-zinc-600 dark:text-zinc-300"
      >
        <!-- La balance pèse tant que la comparaison est en cours (A2 § 3.1 :
             elle dit une attente RÉELLE, et s'arrête avec elle), à la place
             des trois points qui rebondissaient. Décorative (`aria-hidden`,
             sans `role`) : c'est le libellé de cette région `role="status"`
             qui annonce l'attente. En mouvement réduit, elle reste droite ;
             le libellé suffit alors. Une seule balance : le bouton dit
             « Comparaison en cours… » sans en porter une seconde, qui
             peserait en même temps (« une seule chose animée à la fois »). -->
        <BalanceAnimee etat="attente" class="text-xl text-zinc-950 dark:text-white" />
        {$tr("compare.loading")}
      </div>
    {:else if erreur}
      <div
        role="alert"
        data-testid="compare-error"
        class="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
      >
        <Icone nom="circle-alert" class="mt-0.5 text-base" />
        <div class="min-w-0">
          <p>{erreur}</p>
          <!-- 44 px de haut, sauf à partir de lg sous un pointeur fin : une
               tablette est un écran tactile. -->
          <button
            on:click={comparer}
            data-testid="compare-retry"
            class="mt-2 inline-flex min-h-11 items-center underline font-medium hover:no-underline lg:[@media(pointer:fine)]:min-h-0"
          >
            {$tr("common.retry")}
          </button>
        </div>
      </div>
    {:else if resultat}
      <div data-testid="compare-result" data-hors-du-bouton>
        <!--
          Les citations orphelines passent AVANT la grille, en avertissement :
          un numéro que le modèle a inventé doit se voir immédiatement, pas
          après avoir lu sept lignes de tableau. Le triangle et le titre en
          gras le signalent ; pas de rouge, réservé aux erreurs et aux actions
          destructrices, alors que la comparaison, elle, a abouti.
          Fond blanc en clair, le fond des cartes et des panneaux : en zinc-50
          (l'encadré du guide, prévu dans une carte), il avait le fond même
          de la page et n'en était qu'un contour, quand le sombre en fait un
          panneau plein (zinc-900 sur zinc-950). L'avertissement pesait moins
          en clair qu'en sombre.
        -->
        {#if resultat.unmatched_citations.length}
          <div
            role="alert"
            data-testid="compare-unmatched"
            class="mb-6 flex gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
          >
            <Icone nom="triangle-alert" class="mt-0.5 text-base text-zinc-950 dark:text-white" />
            <div class="min-w-0">
              <p class="font-semibold coupe-mots text-zinc-950 dark:text-white">
                {$tr("compare.unmatched")}{deuxPoints} {resultat.unmatched_citations.join(", ")}
              </p>
              <p class="text-sm mt-1">{$tr("compare.unmatchedHelp")}</p>
            </div>
          </div>
        {/if}

        <!--
          Sous lg, le MÊME tableau se range en cartes empilées, en CSS
          seulement : une carte par critère, les deux sujets l'un sous l'autre.
          Trois colonnes dans 328 px donnaient des cellules d'environ 100 px et
          un défilement horizontal qui cachait le sujet B. Un second balisage,
          masqué selon la largeur, aurait doublé les data-testid
          (compare-toggle-0-a…, que le mode strict de Playwright veut uniques)
          et les id src-{i}-{cote} visés par aria-controls.

          lg et non plus md : à 768 px, en tableau, l'extrait déplié élargissait
          la colonne du premier sujet à environ 440 px ; il restait 160 px au
          critère (six lignes) et 135 au second sujet (en-tête sur trois lignes,
          réponse sur cinq, puces cassées en deux). En cartes, chaque sujet a
          toute la largeur, sur les tablettes comme sur les téléphones en
          paysage de 800 à 950 px.

          À partir de lg, `table-fixed` : le critère garde sa colonne (w-48),
          et les deux sujets se partagent le reste à parts ÉGALES. En
          disposition automatique, l'extrait déplié tirait sa colonne à 750 px
          (à 1 440 px) et réduisait l'autre à 150-180 px.

          Les rôles ARIA explicites gardent la sémantique de tableau : des
          navigateurs (Safari notamment) la retirent dès qu'un élément de
          tableau change de `display`. Comme l'en-tête de colonnes est masqué
          sous lg, chaque cellule y affiche le nom de son sujet, avec un filet
          à gauche : plein pour A (noir, blanc en sombre), gris pour B. C'est
          le nom écrit qui porte le sens, le filet n'est qu'un repère.

          coupe-mots (overflow-wrap: anywhere) dans les cartes, break-words
          dans le tableau : les colonnes ont beau être fixées, une coupure
          « n'importe où » n'y sert à rien, un mot trop long pour sa colonne se
          coupe de toute façon.

          REFONTE A (E7, Comparer.dc.html). À partir de lg, le tableau est une
          carte à filets : un cadre arrondi, des filets d'un pixel entre les
          lignes et entre les colonnes, l'en-tête sur le fond `fill`
          (zinc-100), le critère en demi-gras d'encre. Le cadre coupe ce qui
          dépasse (`overflow-hidden`) : ses coins arrondis, et les cellules
          qui arrivent de côté (48 px, `mv-comparer`). Il remplace un
          `overflow-x-auto` : une barre de défilement aurait clignoté pendant
          l'arrivée, et le tableau, `table-fixed` à pleine largeur, ne
          déborde jamais de lui-même ; il n'y avait rien à faire défiler.
          Sous lg, les cartes empilées ne changent pas.
        -->
        <div
          class="lg:overflow-hidden lg:rounded-2xl lg:border lg:border-zinc-200 lg:bg-white lg:dark:border-zinc-800 lg:dark:bg-zinc-900"
        >
          <!-- L'exception vaut pour tout le tableau : rôles redondants voulus. -->
          <!-- svelte-ignore a11y_no_redundant_roles -->
          <table role="table" class="block w-full border-collapse text-sm lg:table lg:table-fixed">
            <caption class="sr-only">
              {$tr("compare.title")}{deuxPoints} {resultat.subject_a} / {resultat.subject_b}
            </caption>
            <!-- En-tête sur le fond `fill`, en demi-gras d'encre, « Critère »
                 compris : en zinc-500 sur zinc-100, il ne tiendrait plus
                 4,5:1 (A3 § 1, `--tx3`). -->
            <thead class="hidden lg:table-header-group">
              <tr class="border-b border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800">
                <th scope="col" class="w-48 px-4 py-3 text-left font-semibold text-zinc-950 dark:text-white">
                  {$tr("compare.criterion")}
                </th>
                <th
                  scope="col"
                  class="border-l border-zinc-200 px-4 py-3 text-left font-semibold break-words text-zinc-950 dark:border-zinc-800 dark:text-white"
                >
                  {resultat.subject_a}
                </th>
                <th
                  scope="col"
                  class="border-l border-zinc-200 px-4 py-3 text-left font-semibold break-words text-zinc-950 dark:border-zinc-800 dark:text-white"
                >
                  {resultat.subject_b}
                </th>
              </tr>
            </thead>
            <tbody role="rowgroup" class="block space-y-4 lg:table-row-group lg:space-y-0">
              {#each resultat.rows as ligne, i}
                <!-- `--d` : le délai d'arrivée de la ligne, posé sur elle et
                     hérité par ses trois cellules, qui portent l'animation
                     (`mv-comparer`) : elles arrivent ensemble, chacune de son
                     côté à partir de lg. -->
                <tr
                  role="row"
                  style="--d: {delaiDeLaLigne(i)}ms"
                  class="block rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 align-top lg:table-row lg:rounded-none lg:border-0 lg:border-b lg:last:border-b-0 lg:bg-transparent lg:dark:bg-transparent lg:p-0"
                >
                  <th
                    scope="row"
                    role="rowheader"
                    class="mv-comparer block text-left text-base font-semibold coupe-mots lg:break-words text-zinc-950 dark:text-white lg:table-cell lg:p-4 lg:text-sm"
                  >
                    {ligne.criterion}
                  </th>
                  {#each colonnes(ligne) as { cote, cellule }}
                    {@const ouvert = depliees.has(`${i}:${cote}`)}
                    <!-- Sous lg, le filet de 4 px à gauche (plein pour A,
                         gris pour B) ; à partir de lg, le filet d'un pixel
                         entre deux colonnes. -->
                    <td
                      role="cell"
                      class="mv-comparer mt-3 block border-l-4 pl-3 coupe-mots lg:break-words text-zinc-700 dark:text-zinc-300 lg:mt-0 lg:table-cell lg:border-l lg:border-zinc-200 lg:p-4 lg:dark:border-zinc-800 {cote === 'a'
                        ? 'mv-comparer--a border-zinc-950 dark:border-white'
                        : 'mv-comparer--b border-zinc-400 dark:border-zinc-600'}"
                    >
                      <!-- Lu aussi par les lecteurs d'écran : sous lg, c'est le
                           seul lien entre la cellule et son sujet. -->
                      <p
                        class="mb-1 text-xs font-semibold lg:hidden {cote === 'a'
                          ? 'text-zinc-950 dark:text-white'
                          : 'text-zinc-500 dark:text-zinc-400'}"
                      >
                        {cote === "a" ? resultat.subject_a : resultat.subject_b}
                      </p>
                      <!-- L'absence est écrite en gris, mais lisible : zinc-500
                           (zinc-400 en sombre) est le plus pâle qui tienne 4,5:1,
                           sur la carte blanche comme sur le fond de page. Sans
                           italique, comme la maquette : c'est la phrase qui dit
                           l'absence, et aucune bascule ne la suit. -->
                      <p class={cellule.sources.length ? undefined : "text-zinc-500 dark:text-zinc-400"}>
                        {cellule.value}
                      </p>
                      {#if cellule.sources.length}
                        <!-- Puces et bascule de 44 px : ce sont les seuls
                             moyens de vérifier une citation, et elles
                             faisaient 20 px de haut. Réduites à 28 px (la
                             maquette) à partir de lg sous un pointeur fin
                             seulement : une tablette est un écran tactile.
                             Même puce que les articles trouvés de /search
                             (SearchResultCard) et que la maquette : pastille
                             bordée, l'encre au survol.
                             Une puce tient sur UNE ligne : coupée en deux
                             dans sa pastille (« … MINFI/MINCOMMERCE · » puis
                             « art. 4 », ou « … 40-2 » puis « (nouveau) »),
                             elle se lisait mal. Quand la place manque, c'est
                             le NOM du texte qui s'abrège (…), et jamais
                             « · art. N », le numéro qu'on vient vérifier. Nom
                             entier : dans l'extrait déplié, et pour les
                             lecteurs d'écran (le texte reste dans la page) ;
                             l'intitulé officiel, dans l'infobulle.
                             Le nom et non la cote interne (`nomDeLaSource`) :
                             la puce passe donc en Inter, comme celle de
                             /search, sans la chasse fixe des cotes (Q5 A ne
                             la garde que pour les touches) ni les chiffres
                             tabulaires, qui élargissaient le trait d'union
                             (« 40 - 2 »). -->
                        <div
                          class="mt-2 flex flex-wrap gap-2 items-center"
                          aria-label={$tr("compare.sources")}
                        >
                          {#each cellule.sources as source}
                            <a
                              href="/laws/{source.law_id}?article={encodeURIComponent(source.number)}"
                              title={source.law_title}
                              class="inline-flex min-h-11 min-w-0 max-w-full items-center whitespace-nowrap rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-950 hover:text-zinc-950 lg:px-2.5 lg:py-0.5 lg:[@media(pointer:fine)]:min-h-7 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-white dark:hover:text-white"
                            >
                              <span class="min-w-0 truncate">{nomDeLaSource(source, $tr)}</span><span class="shrink-0">&nbsp;· art.&nbsp;{source.number}</span>
                            </a>
                          {/each}
                          <!-- « Voir le texte » : sans soulignement, avec un
                               chevron qui tourne d'un demi-tour quand le texte
                               est déplié (`mv-ouvert` et `mv-chevron`,
                               src/lib/mouvement.css : l'état tourné est
                               statique, seule la rotation est sous
                               « no-preference »). Nom accessible inchangé : le
                               libellé visible y est en tête. -->
                          <button
                            on:click={() => basculer(`${i}:${cote}`)}
                            data-testid="compare-toggle-{i}-{cote}"
                            aria-expanded={ouvert}
                            aria-controls="src-{i}-{cote}"
                            aria-label="{ouvert
                              ? $tr('compare.hideText')
                              : $tr('compare.showText')} — {ligne.criterion}, {cote === 'a'
                              ? resultat.subject_a
                              : resultat.subject_b}"
                            class="inline-flex min-h-11 items-center gap-1 whitespace-nowrap px-1 text-sm font-semibold text-zinc-600 transition-colors hover:text-zinc-950 lg:px-0 lg:text-xs lg:[@media(pointer:fine)]:min-h-7 dark:text-zinc-400 dark:hover:text-white {ouvert
                              ? 'mv-ouvert'
                              : ''}"
                          >
                            {ouvert ? $tr("compare.hideText") : $tr("compare.showText")}
                            <Icone nom="chevron-down" class="mv-chevron text-base lg:text-sm" />
                          </button>
                        </div>
                        {#if ouvert}
                          <!--
                            Le texte intégral de l'article cité, sous la cellule.
                            C'est ce qui rend visible une citation surnuméraire :
                            un article réel qui ne dit pas ce que la cellule
                            affirme. Aucun autre mécanisme ne l'attrape.
                            65ch au plus (la largeur de max-w-prose, écrite
                            en valeur : l'inventaire du noir et blanc prend
                            tout « prose » pour un bloc de texte rendu) : dans
                            une carte large (de 768 à 1 024 px), la ligne
                            dépassait 100 caractères ; dans le tableau, la
                            colonne la borne déjà.

                            Il se DÉROULE en place (A2 § 3.8) : `slide` de
                            Svelte, 500 ms, sur la courbe commune (`quintOut`
                            est la fonction dont cubic-bezier(.22,1,.36,1),
                            COURBE de $lib/mouvement, est le tracé usuel : une
                            transition Svelte prend une fonction, pas une
                            courbe CSS). POURQUOI `slide` ET {#if}, et non la
                            grille 0fr → 1fr de la maquette : replié, le texte
                            n'est pas dans la page (aucun lien à tabuler, rien
                            de lu par un lecteur d'écran), et `slide` l'anime
                            à l'entrée comme à la sortie ; `duree` le rend
                            immédiat en mouvement réduit. Transition locale :
                            elle ne joue qu'à la bascule, pas quand une
                            nouvelle comparaison remplace la grille.

                            Le texte officiel, cité mot pour mot, en Literata
                            Texte (`font-texte`, 15 px : la maquette), sur le
                            fond `fill` (zinc-100), sans bordure, à toute
                            largeur. Sa ligne de référence reste en Inter, en
                            zinc-600 : zinc-500 ne tiendrait pas 4,5:1 sur
                            zinc-100 (A3 § 1).
                          -->
                          <div
                            id="src-{i}-{cote}"
                            data-testid="compare-source-{i}-{cote}"
                            transition:slide={{ duration: duree(500), easing: quintOut }}
                            class="mt-2 max-w-[65ch] space-y-3 rounded-xl bg-zinc-100 p-3 dark:bg-zinc-800"
                          >
                            {#each cellule.sources as source}
                              <div>
                                <p class="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                                  {nomDeLaSource(source, $tr)} — Art. {source.number}
                                  {#if source.page_number}· p. {source.page_number}{/if}
                                </p>
                                <!-- 15 px à toute taille : le texte de
                                     l'article est ce qu'on vient lire. En
                                     md:text-xs, il passait à 12 px, et la
                                     hauteur de ligne de text-xs (16 px), écrite
                                     après leading-relaxed dans la feuille de
                                     styles, serrait les lignes. -->
                                <p
                                  class="mt-1 whitespace-pre-line font-texte text-[15px] leading-relaxed text-zinc-950 dark:text-zinc-100"
                                >
                                  {source.content}
                                </p>
                              </div>
                            {/each}
                          </div>
                        {/if}
                      {/if}
                    </td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- Les différences, les angles morts et la note de l'IA arrivent
             après la grille, en fondu (`delaiDeLaSuite`). -->
        {#if resultat.key_differences.length}
          <section class="mt-8 mv-fondre" style="--d: {delaiDeLaSuite}ms; --mv-duree: 600ms">
            <h2 class="font-bold text-zinc-950 dark:text-white mb-2">
              {$tr("compare.differences")}
            </h2>
            <ul class="list-disc pl-5 space-y-1 text-zinc-700 dark:text-zinc-300">
              {#each resultat.key_differences as d}<li>{d}</li>{/each}
            </ul>
          </section>
        {/if}

        {#if resultat.blind_spots.length}
          <section
            class="mt-6 mv-fondre"
            style="--d: {delaiDeLaSuite}ms; --mv-duree: 600ms"
            data-testid="compare-blindspots"
          >
            <h2 class="font-bold text-zinc-950 dark:text-white mb-2">
              {$tr("compare.blindSpots")}
            </h2>
            <ul class="list-disc pl-5 space-y-1 text-zinc-600 dark:text-zinc-400">
              {#each resultat.blind_spots as b}<li>{b}</li>{/each}
            </ul>
          </section>
        {/if}

        <!-- Les durées de la recherche et de la génération ne disent rien au
             lecteur : elles passent dans l'infobulle, pour qui veut les voir.
             « 2 + 1 » insécable : coupé, le « + » restait seul en fin de
             ligne. La note de la maquette : l'icône d'information devant,
             13 px, en zinc-500 (4,6:1 sur le fond de page), sans italique. -->
        <p
          class="mt-8 flex items-start gap-2 text-[13px] leading-[18px] text-zinc-500 dark:text-zinc-400 mv-fondre"
          style="--d: {delaiDeLaSuite}ms; --mv-duree: 600ms"
        >
          <Icone nom="circle-alert" class="mt-px text-[15px]" />
          <span>
            {$tr("compare.disclaimer")}
            <span
              title={$tr("compare.timing")
                .replace("{r}", String(resultat.retrieval_time_ms))
                .replace("{g}", String(resultat.generation_time_ms))}
              >({$tr("compare.articlesRead")}{deuxPoints} {resultat.articles_a.length}&nbsp;+&nbsp;{resultat.articles_b.length})</span
            >
          </span>
        </p>
      </div>
    {/if}
  </main>

  <!-- Le bouton de l'assistant, comme sur la recherche et l'accueil ; le pied
       de page lui réserve sa place en fin de défilement. -->
  <ChatFab eviter="[data-hors-du-bouton]" />
  <SiteFooter reserverBouton />
</div>

<style>
  /*
   * Le gréement de /compare (Comparer.dc.html, niveau B de R2).
   *
   * POURQUOI UNE GRILLE ET NON LES CARTES ABSOLUES DE LA MAQUETTE. Ses cartes
   * de 340 px (300 sous 1 024) centrées sur un fléau à 15 % de chaque bord ne
   * tiennent qu'à 1 440 px : à 1 024, elles sortent de 31 px de chaque côté ;
   * à 768, de 42. Ici, les cartes et le bouton restent dans le flux, dans une
   * grille de deux colonnes d'au plus 340 px : elles ne peuvent pas déborder,
   * et un libellé qui passe à la ligne agrandit le gréement au lieu de
   * chevaucher le bouton. Seul le décor est absolu ; le fléau va du milieu
   * d'une carte au milieu de l'autre, soit la moitié de la colonne de chaque
   * côté : min(170 px, 25 % moins le quart de l'écart de 1 rem).
   *
   * POURQUOI 640 PX ET 501 PX DE HAUT. Sous 640 px, deux cartes ne tiennent
   * plus : elles s'empilent et le décor disparaît, ses animations avec lui.
   * Un téléphone en paysage (écran `court:`) garde sa ligne compacte : 312 px
   * de gréement mettraient le bouton sous le bas de l'écran.
   *
   * POURQUOI LE FLÉAU NE PÈSE PAS PENDANT L'ATTENTE. BalanceAnimee pèse déjà
   * dans `compare-loading` : un second geste irait contre « une seule chose
   * animée à la fois » (A2 § 1), et les cartes bougeraient sous le pointeur
   * alors que les champs restent modifiables.
   */
  .greement__decor {
    display: none;
  }

  @media (min-width: 640px) and (min-height: 501px) {
    .greement {
      --greement-bras: min(10.625rem, calc(25% - 0.25rem));
      position: relative;
      grid-template-columns: repeat(2, minmax(0, 21.25rem));
      justify-content: space-between;
      gap: 4rem 1rem;
      padding-top: 6.5rem;
    }

    .greement__decor {
      display: block;
      position: absolute;
      inset: 0;
      pointer-events: none;
    }

    .greement__montant,
    .greement__fleau,
    .greement__pivot,
    .greement__chaine {
      position: absolute;
      display: block;
    }

    .greement__montant {
      left: 50%;
      top: 3rem;
      bottom: 2.5rem;
      width: 2px;
      margin-left: -1px;
    }

    .greement__fleau {
      left: var(--greement-bras);
      right: var(--greement-bras);
      top: calc(3rem - 2px);
      height: 4px;
      border-radius: 4px;
    }

    .greement__pivot {
      left: 50%;
      top: 3rem;
      width: 1rem;
      height: 1rem;
      margin: -0.5rem 0 0 -0.5rem;
      border-radius: 50%;
    }

    .greement__chaine {
      top: 3rem;
      width: 2px;
      height: 3.5rem;
    }

    .greement__chaine--a {
      left: var(--greement-bras);
      margin-left: -1px;
    }

    .greement__chaine--b {
      right: var(--greement-bras);
      margin-right: -1px;
    }

    /* Au-dessus du montant, qui s'arrête derrière lui : la base du gréement. */
    .greement__bouton {
      position: relative;
      grid-column: 1 / -1;
      justify-self: center;
      min-width: 11rem;
      min-height: 3rem;
    }
  }
</style>
