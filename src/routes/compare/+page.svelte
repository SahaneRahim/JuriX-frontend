<script lang="ts">
  import { onMount } from "svelte";
  import { API_URL } from "$lib/api";
  import MetaSeo from "$lib/components/MetaSeo.svelte";
  import SiteHeader from "$lib/components/SiteHeader.svelte";
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import ChatFab from "$lib/components/ChatFab.svelte";
  import Icone from "$lib/components/Icone.svelte";
  import { tr } from "$lib/stores/language";
  import { language } from "$lib/stores/language";
  import type { ComparisonCell, ComparisonResponse, ComparisonRow } from "$lib/types";

  let sujetA = "";
  let sujetB = "";
  let resultat: ComparisonResponse | null = null;
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
      Sur une ligne dès 768 px, et sur écran court dès 480 px : un téléphone
      en paysage gardait les trois rangées du portrait, et le bouton passait
      sous le bas de l'écran. Les champs y gardent 190 px au moins (en
      568×320) ; plus étroit, c'est un écran en portrait, où l'empilement a
      la hauteur qu'il lui faut. Sous sm, sur cette ligne, le bouton prend
      les 46 px des champs en 16 px : à 44, il en dépassait de 2 px en haut.
    -->
    <form
      data-hors-du-bouton
      class="grid gap-4 md:grid-cols-[1fr_1fr_auto] items-end mb-8 sm:mb-10 court:mb-6 court:min-[480px]:grid-cols-[1fr_1fr_auto]"
      on:submit|preventDefault={comparer}
      data-testid="compare-form"
      novalidate
    >
      <label class="block">
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
          class="block min-h-11 w-full px-4 py-2.5 rounded-xl border border-zinc-200 bg-white text-base sm:text-sm text-zinc-950 placeholder-zinc-400 transition-colors focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 dark:border-zinc-500 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-200 dark:focus:ring-zinc-200"
        />
      </label>
      <label class="block">
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
          class="block min-h-11 w-full px-4 py-2.5 rounded-xl border border-zinc-200 bg-white text-base sm:text-sm text-zinc-950 placeholder-zinc-400 transition-colors focus:outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 dark:border-zinc-500 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-200 dark:focus:ring-zinc-200"
        />
      </label>
      <button
        type="submit"
        disabled={enCours || !monte}
        data-testid="compare-submit"
        class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold bg-zinc-950 text-white shadow-sm transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:shadow-none dark:hover:bg-zinc-200 court:max-sm:min-h-[2.875rem]"
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
        <!-- motion-safe : un rebond est un déplacement, coupé quand le système
             demande de réduire les animations ; le libellé suffit alors. -->
        <span class="flex items-center gap-1" aria-hidden="true">
          <span class="w-2 h-2 bg-zinc-900 dark:bg-zinc-100 rounded-full motion-safe:animate-bounce" style="animation-delay: 0ms"></span>
          <span class="w-2 h-2 bg-zinc-900 dark:bg-zinc-100 rounded-full motion-safe:animate-bounce" style="animation-delay: 150ms"></span>
          <span class="w-2 h-2 bg-zinc-900 dark:bg-zinc-100 rounded-full motion-safe:animate-bounce" style="animation-delay: 300ms"></span>
        </span>
        {$tr("compare.loading")}
      </div>
    {:else if erreur}
      <div
        role="alert"
        data-testid="compare-error"
        class="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
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
            class="mb-6 flex gap-3 rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
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
        -->
        <div class="lg:overflow-x-auto">
          <!-- L'exception vaut pour tout le tableau : rôles redondants voulus. -->
          <!-- svelte-ignore a11y_no_redundant_roles -->
          <table role="table" class="block w-full border-collapse text-sm lg:table lg:table-fixed">
            <caption class="sr-only">
              {$tr("compare.title")}{deuxPoints} {resultat.subject_a} / {resultat.subject_b}
            </caption>
            <thead class="hidden lg:table-header-group">
              <tr class="border-b-2 border-zinc-300 dark:border-zinc-700">
                <th scope="col" class="w-48 text-left p-3 font-semibold text-zinc-500 dark:text-zinc-400">
                  {$tr("compare.criterion")}
                </th>
                <th scope="col" class="text-left p-3 font-semibold break-words text-zinc-950 dark:text-white">
                  {resultat.subject_a}
                </th>
                <th scope="col" class="text-left p-3 font-semibold break-words text-zinc-950 dark:text-white">
                  {resultat.subject_b}
                </th>
              </tr>
            </thead>
            <tbody role="rowgroup" class="block space-y-4 lg:table-row-group lg:space-y-0">
              {#each resultat.rows as ligne, i}
                <tr
                  role="row"
                  class="block rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 align-top lg:table-row lg:rounded-none lg:border-0 lg:border-b lg:bg-transparent lg:dark:bg-transparent lg:p-0"
                >
                  <th
                    scope="row"
                    role="rowheader"
                    class="block text-left text-base font-semibold coupe-mots lg:break-words text-zinc-950 dark:text-white lg:table-cell lg:p-3 lg:text-sm lg:font-medium lg:text-zinc-500 lg:dark:text-zinc-400"
                  >
                    {ligne.criterion}
                  </th>
                  {#each colonnes(ligne) as { cote, cellule }}
                    <td
                      role="cell"
                      class="mt-3 block border-l-4 pl-3 coupe-mots lg:break-words text-zinc-800 dark:text-zinc-200 lg:mt-0 lg:table-cell lg:border-l-0 lg:p-3 {cote === 'a'
                        ? 'border-zinc-950 dark:border-white'
                        : 'border-zinc-400 dark:border-zinc-600'}"
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
                           sur la carte blanche comme sur le fond de page. -->
                      <p class:italic={!cellule.sources.length}
                         class:text-zinc-500={!cellule.sources.length}
                         class:dark:text-zinc-400={!cellule.sources.length}>
                        {cellule.value}
                      </p>
                      {#if cellule.sources.length}
                        <!-- Puces et bascule de 44 px : ce sont les seuls
                             moyens de vérifier une citation, et elles
                             faisaient 20 px de haut. Réduites à partir de lg
                             sous un pointeur fin seulement : une tablette est
                             un écran tactile. Même puce que les articles
                             trouvés de /search (SearchResultCard) : badge
                             zinc, inversé au survol.
                             Une puce tient sur UNE ligne : coupée en deux
                             dans sa pastille (« N°00000127/MINFI/MINCOMMERCE ·
                             » puis « art. 4 », ou « … 40-2 » puis
                             « (nouveau) »), elle se lisait mal. En 12 px, une
                             cote de 28 caractères comme celle-ci tient entière
                             à 390 px ; plus étroit, c'est la COTE qui s'abrège
                             (…), et jamais « · art. N », le numéro qu'on vient
                             vérifier. Cote entière : dans l'extrait déplié,
                             et pour les lecteurs d'écran (le texte reste
                             dans la page). -->
                        <div
                          class="mt-2 flex flex-wrap gap-2 items-center"
                          aria-label={$tr("compare.sources")}
                        >
                          {#each cellule.sources as source}
                            <a
                              href="/laws/{source.law_id}?article={encodeURIComponent(source.number)}"
                              title={source.law_title}
                              class="inline-flex min-h-11 min-w-0 max-w-full items-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-mono font-medium tabular-nums lg:px-2 lg:py-0.5 lg:[@media(pointer:fine)]:min-h-0 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-950 hover:bg-zinc-950 hover:text-white dark:hover:border-white dark:hover:bg-white dark:hover:text-zinc-950 transition-colors"
                            >
                              <span class="min-w-0 truncate">{source.reference}</span><span class="shrink-0">&nbsp;· art.&nbsp;{source.number}</span>
                            </a>
                          {/each}
                          <button
                            on:click={() => basculer(`${i}:${cote}`)}
                            data-testid="compare-toggle-{i}-{cote}"
                            aria-expanded={depliees.has(`${i}:${cote}`)}
                            aria-controls="src-{i}-{cote}"
                            aria-label="{depliees.has(`${i}:${cote}`)
                              ? $tr('compare.hideText')
                              : $tr('compare.showText')} — {ligne.criterion}, {cote === 'a'
                              ? resultat.subject_a
                              : resultat.subject_b}"
                            class="inline-flex min-h-11 items-center whitespace-nowrap px-1 text-sm lg:px-0 lg:text-xs lg:[@media(pointer:fine)]:min-h-0 text-zinc-950 dark:text-white underline decoration-zinc-300 dark:decoration-zinc-600 underline-offset-4 hover:decoration-zinc-950 dark:hover:decoration-white"
                          >
                            {depliees.has(`${i}:${cote}`)
                              ? $tr("compare.hideText")
                              : $tr("compare.showText")}
                          </button>
                        </div>
                        {#if depliees.has(`${i}:${cote}`)}
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
                            Bloc dans une carte (guide, § 4.1) sous lg ; à
                            partir de lg, les lignes du tableau sont posées
                            sur le fond de la page (zinc-50), et l'extrait y
                            prend le blanc des panneaux, comme l'encadré des
                            citations orphelines : en zinc-50, il n'en était
                            qu'un contour.
                          -->
                          <div
                            id="src-{i}-{cote}"
                            data-testid="compare-source-{i}-{cote}"
                            class="mt-2 max-w-[65ch] space-y-3 p-3 rounded-xl bg-zinc-50 lg:bg-white dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/60"
                          >
                            {#each cellule.sources as source}
                              <div>
                                <p class="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                                  {source.reference} — Art. {source.number}
                                  {#if source.page_number}· p. {source.page_number}{/if}
                                </p>
                                <!-- text-sm à toute taille : le texte de
                                     l'article est ce qu'on vient lire. En
                                     md:text-xs, il passait à 12 px, et la
                                     hauteur de ligne de text-xs (16 px), écrite
                                     après leading-relaxed dans la feuille de
                                     styles, serrait les lignes. -->
                                <p class="text-sm leading-relaxed whitespace-pre-line text-zinc-700 dark:text-zinc-300">
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

        {#if resultat.key_differences.length}
          <section class="mt-8">
            <h2 class="font-bold text-zinc-950 dark:text-white mb-2">
              {$tr("compare.differences")}
            </h2>
            <ul class="list-disc pl-5 space-y-1 text-zinc-700 dark:text-zinc-300">
              {#each resultat.key_differences as d}<li>{d}</li>{/each}
            </ul>
          </section>
        {/if}

        {#if resultat.blind_spots.length}
          <section class="mt-6" data-testid="compare-blindspots">
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
             ligne. -->
        <p class="mt-8 text-xs italic text-zinc-500 dark:text-zinc-400">
          {$tr("compare.disclaimer")}
          <span
            class="not-italic"
            title={$tr("compare.timing")
              .replace("{r}", String(resultat.retrieval_time_ms))
              .replace("{g}", String(resultat.generation_time_ms))}
            >({$tr("compare.articlesRead")}{deuxPoints} {resultat.articles_a.length}&nbsp;+&nbsp;{resultat.articles_b.length})</span
          >
        </p>
      </div>
    {/if}
  </main>

  <!-- Le bouton de l'assistant, comme sur la recherche et l'accueil ; le pied
       de page lui réserve sa place en fin de défilement. -->
  <ChatFab eviter="[data-hors-du-bouton]" />
  <SiteFooter reserverBouton />
</div>
