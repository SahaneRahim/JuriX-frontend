<script lang="ts">
  /**
   * Le générateur d'articles : un sujet, une rubrique et un contexte
   * facultatifs, puis l'attente d'un BROUILLON enregistré par l'API.
   *
   * L'ATTENTE DIT LA VÉRITÉ. Le libellé promettait « 15-30s » ; un appel au
   * modèle peut durer bien plus (relevé de la revue du 29/10 : jusqu'à 95 s
   * pour Mistral, plus une seconde tentative). Le panneau d'attente montre le
   * temps écoulé, annonce la durée mesurée (environ deux minutes, contrôle IA
   * par mistral-large-4 compris : 121,7 et 124,4 s à l'essai réel du 04/11),
   * et dit quand c'est plus long que d'habitude
   * (`ATTENTE_LONGUE_DE_GENERATION_S`). Le client abandonne à 200 s
   * (`DELAI_DE_GENERATION_MS`), au-delà du délai du serveur (190 s, code
   * `delai`) : sans borne, une API figée laissait la roue tourner
   * indéfiniment.
   *
   * ARRÊTER. Le bouton « Arrêter » coupe la requête (AbortController). Le
   * serveur, lui, peut aller au bout et enregistrer le brouillon : la page
   * relit alors la liste (`onFinSansResultat`), et l'administrateur est
   * prévenu que le brouillon peut apparaître un peu plus tard.
   *
   * LE FOCUS. Le bouton « Générer » était désactivé pendant l'attente : le
   * focus tombait sur <body> (mesuré). Il passe sur « Arrêter », puis revient
   * sur « Générer » après un échec ; après un succès, la fenêtre de relecture
   * s'ouvre et le prend.
   */
  import { onDestroy, tick } from "svelte";
  import { apiFetch } from "$lib/api";
  import Icone from "$lib/components/Icone.svelte";
  import { tr } from "$lib/stores/language";
  import {
    ATTENTE_LONGUE_DE_GENERATION_S,
    DELAI_DE_GENERATION_MS,
    FIN_PROBABLE_DE_LA_REDACTION_S,
    erreurDeReponse,
    erreurDExecution,
    messageDErreur,
  } from "./erreurs";
  import { resultatDeGeneration, type ResultatDeGeneration } from "./relecture";

  /** Vrai pendant une génération (lu par la page : elle masque alors le bouton d'en-tête). */
  export let enCours = false;
  /** Appelé avec le brouillon enregistré, ses sources et ses avertissements. */
  export let onGenere: (resultat: ResultatDeGeneration) => void | Promise<void>;
  /**
   * Appelé quand la génération s'arrête sans résultat lisible (arrêt, délai
   * du client, réponse inattendue) : le serveur a pu enregistrer le
   * brouillon quand même, la page relit sa liste.
   */
  export let onFinSansResultat: () => void = () => {};

  // Les classes des champs de l'administration (voir +page.svelte).
  const CHAMP =
    "min-h-11 w-full rounded-xl border border-zinc-500 bg-white px-3 py-2 text-base text-zinc-950 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 read-only:bg-zinc-50 read-only:text-zinc-500 dark:border-zinc-500 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-200 dark:focus:ring-zinc-200 dark:read-only:bg-zinc-900 dark:read-only:text-zinc-400 sm:[@media(pointer:fine)]:text-sm";
  const LIBELLE = "mb-1 block text-sm font-medium text-zinc-800 dark:text-zinc-200";
  const FACULTATIF = "font-normal text-zinc-500 dark:text-zinc-400";
  const AIDE = "mt-1 text-xs text-zinc-500 dark:text-zinc-400";

  /** Bornes du contrat : sujet de 3 à 300 caractères, rubrique ≤ 100, contexte ≤ 4 000. */
  const SUJET_MIN = 3;
  const SUJET_MAX = 300;

  let sujet = "";
  let rubrique = "";
  let contexte = "";

  let ecoule = 0;
  let erreur = "";
  let avis = "";
  /** Annonce aux lecteurs d'écran (début et fin) ; le compteur, lui, n'est pas annoncé. */
  let annonce = "";
  let sujetSignale = false;

  let controleur: AbortController | null = null;
  let raison: "admin" | "delai" | null = null;
  let minuterie: ReturnType<typeof setInterval> | undefined;
  let delai: ReturnType<typeof setTimeout> | undefined;
  let detruit = false;

  let champSujet: HTMLInputElement;
  let boutonGenerer: HTMLButtonElement | undefined;
  let boutonArreter: HTMLButtonElement | undefined;

  $: longueurSujet = sujet.trim().length;
  $: sujetValide = longueurSujet >= SUJET_MIN && longueurSujet <= SUJET_MAX;
  $: if (sujetValide) sujetSignale = false;
  $: chrono = `${Math.floor(ecoule / 60)}:${String(ecoule % 60).padStart(2, "0")}`;

  function arreterLesMinuteries() {
    clearInterval(minuterie);
    clearTimeout(delai);
    minuterie = undefined;
    delai = undefined;
  }

  async function generer() {
    if (enCours) return;
    erreur = "";
    avis = "";
    if (!sujetValide) {
      // Le bouton reste actif (aria-disabled) : un clic dit pourquoi rien ne part.
      sujetSignale = true;
      erreur = $tr("admin.blog.topicHint");
      champSujet?.focus();
      return;
    }

    const actuel = new AbortController();
    controleur = actuel;
    raison = null;
    enCours = true;
    ecoule = 0;
    annonce = $tr("admin.blog.announceStart");
    const debut = Date.now();
    minuterie = setInterval(() => {
      ecoule = Math.floor((Date.now() - debut) / 1000);
    }, 1000);
    delai = setTimeout(() => {
      raison = "delai";
      actuel.abort();
    }, DELAI_DE_GENERATION_MS);
    await tick();
    boutonArreter?.focus();

    let resultat: ResultatDeGeneration | null = null;
    try {
      const reponse = await apiFetch("/blog/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: sujet.trim(),
          ...(rubrique.trim() ? { category: rubrique.trim() } : {}),
          ...(contexte.trim() ? { additional_context: contexte.trim() } : {}),
        }),
        signal: actuel.signal,
      });
      if (!reponse.ok) {
        erreur = messageDErreur(await erreurDeReponse(reponse), $tr);
      } else {
        // Lecture du corps DANS le try : un arrêt pendant la lecture garde sa
        // cause (arrêt, délai), un corps illisible devient « inattendue ».
        resultat = resultatDeGeneration(await reponse.json());
        if (!resultat) {
          // Le serveur a répondu sans brouillon lisible : il a peut-être
          // enregistré quelque chose, la liste le dira.
          erreur = $tr("admin.blog.err.unexpected");
          onFinSansResultat();
        }
      }
    } catch (e) {
      const cause = erreurDExecution(e, raison);
      if (cause.code === "arrete") avis = messageDErreur(cause, $tr);
      else erreur = messageDErreur(cause, $tr);
      // Sans réponse lisible, rien ne dit que le serveur n'a pas enregistré
      // le brouillon : la liste est relue.
      onFinSansResultat();
    } finally {
      arreterLesMinuteries();
      controleur = null;
      enCours = false;
    }

    if (resultat) {
      annonce = $tr("admin.blog.announceDone").replace("{title}", () => resultat.article.title);
      sujet = "";
      rubrique = "";
      contexte = "";
      await onGenere(resultat);
      return;
    }
    annonce = "";
    // Après un échec, le focus revient sur « Générer », que l'attente avait
    // remplacé — sauf si l'administrateur l'a déjà posé ailleurs.
    await tick();
    if (!detruit && (document.activeElement === null || document.activeElement === document.body)) {
      boutonGenerer?.focus();
    }
  }

  function arreter() {
    if (!controleur) return;
    raison = "admin";
    controleur.abort();
  }

  onDestroy(() => {
    detruit = true;
    // Page quittée pendant l'attente : la requête est coupée (le serveur peut
    // tout de même enregistrer le brouillon, que la liste montrera).
    if (controleur) {
      raison = "admin";
      controleur.abort();
    }
    arreterLesMinuteries();
  });
</script>

<!-- Marges de la carte des articles, dessous (16 puis 24 px). -->
<div
  class="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6 space-y-6 dark:border-zinc-800 dark:bg-zinc-900"
  data-testid="blog-generateur"
>
  <div class="flex items-center gap-3">
    <div
      class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200/70 bg-zinc-100 text-zinc-800 dark:border-zinc-700/60 dark:bg-zinc-800 dark:text-zinc-200"
    >
      <Icone nom="bot" class="text-2xl" />
    </div>
    <div class="min-w-0">
      <h2 class="text-lg font-bold text-zinc-950 dark:text-white">{$tr("admin.blog.generatorTitle")}</h2>
      <p class="text-pretty text-xs text-zinc-500 dark:text-zinc-400">{$tr("admin.blog.generatorHint")}</p>
    </div>
  </div>

  <!-- Un formulaire : Entrée dans le sujet lance la génération. `novalidate` :
       les bornes sont dites par la page, en français, pas par le navigateur. -->
  <form class="space-y-4" novalidate on:submit|preventDefault={generer}>
    <div>
      <label for="topic" class={LIBELLE}>{$tr("admin.blog.topicLabel")}</label>
      <input
        id="topic"
        type="text"
        bind:this={champSujet}
        bind:value={sujet}
        maxlength={SUJET_MAX}
        readonly={enCours}
        aria-invalid={sujetSignale ? "true" : undefined}
        aria-describedby="topic-aide"
        placeholder={$tr("admin.blog.topicPlaceholder")}
        class={CHAMP}
      />
      <p id="topic-aide" class={AIDE}>
        {$tr("admin.blog.topicHint")}
        <span class="tabular-nums">({longueurSujet}/{SUJET_MAX})</span>
      </p>
    </div>
    <div>
      <label for="gen-rubrique" class={LIBELLE}
        >{$tr("admin.blog.categoryLabel")} <span class={FACULTATIF}>{$tr("admin.optional")}</span></label
      >
      <input
        id="gen-rubrique"
        type="text"
        bind:value={rubrique}
        maxlength={100}
        readonly={enCours}
        aria-describedby="gen-rubrique-aide"
        placeholder={$tr("admin.blog.categoryPlaceholder")}
        class={CHAMP}
      />
      <p id="gen-rubrique-aide" class={AIDE}>{$tr("admin.blog.categoryHint")}</p>
    </div>
    <div>
      <label for="ctx" class={LIBELLE}
        >{$tr("admin.blog.extraContextLabel")} <span class={FACULTATIF}>{$tr("admin.optional")}</span></label
      >
      <textarea
        id="ctx"
        bind:value={contexte}
        maxlength={4000}
        readonly={enCours}
        placeholder={$tr("admin.blog.extraContextPlaceholder")}
        rows="3"
        class="{CHAMP} resize-y"
      ></textarea>
    </div>

    {#if enCours}
      <!-- L'attente : temps écoulé (non annoncé, il changerait chaque
           seconde), durée habituelle, et le bouton d'arrêt. -->
      <div
        class="flex flex-col gap-3 rounded-xl border border-zinc-300 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/60 sm:flex-row sm:items-center sm:justify-between"
        data-testid="blog-generation-en-cours"
      >
        <div class="flex min-w-0 items-start gap-3">
          <Icone nom="loader-circle" class="mt-0.5 h-5 w-5 shrink-0 text-zinc-950 motion-safe:animate-spin dark:text-white" />
          <div class="min-w-0 space-y-1">
            <p class="text-sm font-semibold text-zinc-950 dark:text-white">
              {$tr(ecoule >= FIN_PROBABLE_DE_LA_REDACTION_S ? "admin.blog.generatingCheck" : "admin.blog.generating")}
              <span class="ml-1 font-normal tabular-nums text-zinc-600 dark:text-zinc-300" data-testid="blog-chrono">{chrono}</span>
            </p>
            <p class="text-pretty text-xs text-zinc-600 dark:text-zinc-300">{$tr("admin.blog.waitHint")}</p>
            {#if ecoule >= ATTENTE_LONGUE_DE_GENERATION_S}
              <p class="text-pretty text-xs font-medium text-zinc-800 dark:text-zinc-200">{$tr("admin.blog.waitLong")}</p>
            {/if}
          </div>
        </div>
        <button
          type="button"
          bind:this={boutonArreter}
          on:click={arreter}
          class="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 py-2 text-sm font-semibold text-zinc-800 transition-colors hover:border-zinc-950 hover:text-zinc-950 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-200 dark:hover:text-white"
        >
          <Icone nom="square" class="text-base" />
          {$tr("admin.blog.stop")}
        </button>
      </div>
    {:else}
      <!-- `aria-disabled` et non `disabled` : un bouton désactivé ne garde pas
           le focus et ne dit pas pourquoi il ne fait rien. -->
      <button
        type="submit"
        bind:this={boutonGenerer}
        aria-disabled={sujetValide ? undefined : "true"}
        class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-zinc-950 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-black aria-disabled:cursor-not-allowed aria-disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
      >
        <Icone nom="sparkles" class="text-lg" />
        {$tr("admin.blog.generateFull")}
      </button>
    {/if}

    {#if erreur}
      <div
        role="alert"
        data-testid="blog-generation-erreur"
        class="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
      >
        <Icone nom="circle-alert" class="mt-0.5 shrink-0 text-base" />
        <p class="coupe-mots min-w-0">{erreur}</p>
      </div>
    {/if}
    {#if avis}
      <div
        data-testid="blog-generation-avis"
        class="flex gap-3 rounded-xl border border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200"
      >
        <Icone nom="circle-alert" class="mt-0.5 shrink-0 text-base" />
        <p class="min-w-0">{avis}</p>
      </div>
    {/if}
  </form>

  <!-- Région vivante présente dès l'ouverture : une région insérée en même
       temps que son texte n'est pas toujours lue. -->
  <p class="sr-only" role="status" aria-live="polite">{annonce}{avis ? ` ${avis}` : ""}</p>
</div>
