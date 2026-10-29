<script lang="ts">
  /**
   * Palette de commande : Ctrl+K (Cmd+K sur Mac) ou la loupe de l'en-tête.
   * Vide, elle propose les grandes pages ; à la saisie, la recherche, une
   * question à l'assistant, puis les articles du blog et les textes qui
   * correspondent (lois, décrets, ordonnances… : leur nature est lue en tête
   * de leur intitulé).
   *
   * Ses libellés passent par `$tr` : écrits en dur en français, ils restaient
   * français dans l'interface anglaise. Les titres venus des données (lois de
   * l'API, articles du blog) s'affichent tels quels, sauf le « N° » des lois,
   * écrit comme dans les listes (`typographieDesNumeros`).
   *
   * Deux voix au plus (Q5 A) : Inter partout, la chasse fixe réservée aux
   * touches (« Échap », ↑ ↓ ↵). Le surtitre et les pastilles étaient en
   * capitales à chasse fixe, une troisième voix sous les titres en Literata.
   */
  import { tick } from "svelte";
  import { afterNavigate, beforeNavigate, goto } from "$app/navigation";
  import { fade, scale } from "svelte/transition";
  import { API_URL } from "$lib/api";
  import Icone from "$lib/components/Icone.svelte";
  import { typographieDesNumeros } from "$lib/sources";
  import type { NomIcone } from "$lib/icones";
  import {
    annonceDansLaPalette,
    commandPaletteOpen,
    closeCommandPalette,
  } from "$lib/stores/commandPalette";
  import { language, tr } from "$lib/stores/language";
  import { choixPersonaOuvert } from "$lib/stores/persona";
  import { BLOG_POSTS, nomRubrique } from "$lib/data/blog";
  import { typeDuTitre } from "$lib/type-de-texte";

  let query = "";
  let inputElement: HTMLInputElement;
  /** Toute la palette, fond compris : un focus resté dedans à la fermeture est un focus perdu. */
  let boite: HTMLDivElement;
  /** Les boutons des lignes, dans l'ordre de `displayedItems`. */
  let lignes: HTMLButtonElement[] = [];
  let selectedIndex = 0;
  let loading = false;
  let debounceTimer: ReturnType<typeof setTimeout>;

  /**
   * L'élément qui avait le focus à l'ouverture (la loupe de l'en-tête, le
   * champ où l'on a tapé Ctrl K…), à qui la fermeture le rend ; null s'il
   * était sur <body>.
   */
  let ouvreur: HTMLElement | null = null;
  let ouverte = false;

  interface SuggestionItem {
    id?: number;
    title: string;
    subtitle?: string;
    /** Nom Lucide : un nom absent de src/lib/icones.ts est une erreur de typage. */
    icon: NomIcone;
    badge?: string;
    action: () => void;
  }

  let suggestions: SuggestionItem[] = [];

  /** Le libellé traduit, son `{q}` remplacé par la saisie. */
  function avecSaisie(libelle: string, saisie: string): string {
    // Une fonction, et non la saisie elle-même : dans une chaîne de
    // remplacement, un `$&` ou un `$1` tapé par l'utilisateur serait
    // interprété par `replace`.
    return libelle.replace("{q}", () => saisie);
  }

  // Réactif : les raccourcis suivent la langue de l'interface.
  $: defaultActions = actionsParDefaut($tr);

  function actionsParDefaut(t: (cle: string) => string): SuggestionItem[] {
    return [
      {
        title: t("palette.askAi.title"),
        subtitle: t("palette.askAi.subtitle"),
        icon: "bot",
        badge: t("palette.badge.assistant"),
        action: () => allerA("/chat"),
      },
      {
        title: t("palette.blog.title"),
        subtitle: t("palette.blog.subtitle"),
        icon: "newspaper",
        badge: t("palette.badge.blog"),
        action: () => allerA("/blog"),
      },
      {
        title: t("palette.laws.title"),
        subtitle: t("palette.laws.subtitle"),
        icon: "file-text",
        badge: t("palette.badge.laws"),
        action: () => allerA("/laws"),
      },
      {
        title: t("palette.compare.title"),
        subtitle: t("palette.compare.subtitle"),
        icon: "scale",
        badge: t("palette.badge.tool"),
        action: () => allerA("/compare"),
      },
    ];
  }

  /**
   * Ferme la palette (Échap, clic sur le fond, Ctrl K) et rend le focus à
   * l'élément qui l'avait à l'ouverture. Sans cela, il tombait sur <body> :
   * la palette est le dernier élément du layout racine, et la tabulation
   * suivante repartait du bout du document au lieu de reprendre à la loupe
   * de l'en-tête, qui annonce pourtant une boîte de dialogue.
   */
  function close(rendreLeFocus = true) {
    const cible = rendreLeFocus ? ouvreur : null;
    const palette = boite;
    ouvreur = null;
    closeCommandPalette();
    query = "";
    revenirAuxRaccourcis();
    if (!cible) return;
    tick().then(() => {
      // Seulement un focus perdu : sur <body>, ou resté dans la palette, qui
      // reste dans le document le temps de son fondu. Un focus déjà posé
      // ailleurs, hors de la page inerte, garde sa place.
      const actif = document.activeElement;
      if (actif && actif !== document.body && !palette?.contains(actif)) return;
      if (cible.isConnected) cible.focus();
    });
  }

  /**
   * La liste revient aux raccourcis, le premier surligné, sans recherche en
   * attente : à la fermeture, à « Effacer », et quand la saisie se vide au
   * clavier (Ctrl A, Retour arrière). Dans ce dernier cas, la sélection
   * d'une liste de résultats plus longue (la sixième ligne) ne désignait
   * plus aucun raccourci, et Entrée dans le champ ne faisait rien.
   * La recherche qui attendait la fin de la frappe (200 ms) ne part plus :
   * elle relançait le sablier sous les raccourcis. Une requête déjà partie,
   * elle, est écartée à son arrivée (`chercherSuggestions`).
   */
  function revenirAuxRaccourcis() {
    clearTimeout(debounceTimer);
    suggestions = [];
    loading = false;
    selectedIndex = 0;
  }

  /** Le champ, « Effacer » ou une ligne ; non pour la page derrière la palette. */
  function dansLaPalette(cible: EventTarget | null): boolean {
    return cible instanceof Node && Boolean(boite?.contains(cible));
  }

  /**
   * La cible est dans la page que le layout racine rend inerte sous la
   * palette. Lu sur la propriété autant que sur l'attribut : Svelte pose
   * `inert` par la propriété, et un navigateur qui l'ignore la garde sans
   * écrire d'attribut, où `closest("[inert]")` ne la trouverait pas.
   */
  function dansLaPageInerte(cible: EventTarget | null): boolean {
    for (let n = cible instanceof Element ? cible : null; n; n = n.parentElement) {
      if ((n as HTMLElement).inert === true || n.hasAttribute("inert")) return true;
    }
    return false;
  }

  /**
   * Un navigateur qui ignore `inert` (Safari avant 15.5, Firefox avant 112,
   * Chrome avant 102) laisse le focus entrer dans la page cachée sous le
   * fond. Maj+Tab menait du champ au bouton d'envoi du chat, qu'Espace
   * activait, ou à sa saisie, dont le propre gestionnaire envoyait le
   * brouillon sur Entrée avant celui de la palette. Retenir des touches ne
   * suffisait donc pas : le focus revient au champ dès qu'il y entre, comme
   * l'aurait refusé `inert`.
   */
  function retenirLeFocus(e: FocusEvent) {
    if ($commandPaletteOpen && dansLaPageInerte(e.target)) inputElement?.focus();
  }

  /**
   * Les actions changent de page : la palette se ferme sans rendre le
   * focus, que SvelteKit pose lui-même en haut de la page d'arrivée. Rendu
   * à la loupe d'abord, il l'aurait fait annoncer, et entourer, le temps du
   * chargement.
   */
  function allerA(chemin: string) {
    close(false);
    goto(chemin);
  }

  // Une navigation qui démarre palette ouverte la ferme aussi : retour du
  // navigateur, redirection vers /login d'une session expirée. Vivant dans
  // le layout racine, la palette restait ouverte par-dessus la page
  // d'arrivée. Fermée sans rendre le focus, comme pour `allerA`.
  // Au départ, et non à l'arrivée (`afterNavigate`) : une navigation lancée
  // AVANT l'ouverture (une case de filtre cochée sur /search, un lien lent)
  // la refermait en arrivant, en pleine frappe. La saisie était perdue, et
  // le focus tombait sur <body>, que SvelteKit ne replace pas après un
  // `goto` en `keepFocus`.
  beforeNavigate(() => {
    if ($commandPaletteOpen) close(false);
  });

  // Une navigation partie AVANT l'ouverture (un lien lent) arrive donc
  // palette ouverte. Sans `keepFocus`, SvelteKit remet alors le focus sur
  // <body> (son `reset_focus`), juste avant ces rappels : la palette restait
  // ouverte, mais la suite de la frappe n'allait nulle part, et le clavier du
  // téléphone se fermait. Le champ reprend le focus.
  afterNavigate(() => {
    const actif = document.activeElement;
    if ($commandPaletteOpen && (!actif || actif === document.body)) inputElement?.focus();
  });

  async function chercherSuggestions(texte: string) {
    const q = texte.trim();
    if (!q) return;

    loading = true;
    const resultats: SuggestionItem[] = [];

    // 1. Action directe de recherche globale
    resultats.push({
      title: avecSaisie($tr("palette.searchAll.title"), q),
      subtitle: $tr("palette.searchAll.subtitle"),
      icon: "search",
      badge: $tr("palette.badge.search"),
      action: () => allerA(`/search?q=${encodeURIComponent(q)}`),
    });

    // 2. Action directe de question IA
    resultats.push({
      title: avecSaisie($tr("palette.askAiQuery.title"), q),
      subtitle: $tr("palette.askAiQuery.subtitle"),
      icon: "bot",
      badge: $tr("palette.badge.assistant"),
      action: () => allerA(`/chat?q=${encodeURIComponent(q)}`),
    });

    // 3. Articles du blog correspondants
    const blogMatches = BLOG_POSTS.filter(
      (b) =>
        b.title.toLowerCase().includes(q.toLowerCase()) ||
        b.category.toLowerCase().includes(q.toLowerCase()) ||
        b.tags.some((t) => t.toLowerCase().includes(q.toLowerCase()))
    );

    for (const b of blogMatches.slice(0, 2)) {
      resultats.push({
        title: b.title,
        // Rubrique traduite, comme sur /blog : la valeur est en français.
        // Point médian, le séparateur des repères des listes (P11) et de
        // l'accueil, et non la puce « • », que seuls la palette et le blog
        // employaient. L'espace insécable qui le précède le garde en fin de
        // ligne.
        subtitle: `${$tr("palette.blogPost")}\u00a0· ${nomRubrique(b.category, $language.current)}`,
        icon: "newspaper",
        badge: $tr("palette.badge.news"),
        action: () => allerA(`/blog/${b.slug}`),
      });
    }

    // 4. Suggestions de l'API backend
    try {
      const resp = await fetch(
        `${API_URL}/search/suggest?q=${encodeURIComponent(q)}&limit=4`
      );
      if (resp.ok) {
        const data = await resp.json();
        const apiSuggestions = data.suggestions || [];
        for (const item of apiSuggestions) {
          const titre = String(item.title ?? "");
          // La nature vient de la table commune ($lib/type-de-texte), lue en
          // tête de l'intitulé : GET /search/suggest ne sert pas le type, et
          // le badge fixe « Loi » étiquetait aussi décrets et ordonnances.
          const nature = typeDuTitre(titre);
          resultats.push({
            id: item.id,
            // « Loi n° 92/007 du… » et non « Loi N°92/007 du… », l'intitulé
            // brut de la base : les listes refaites (P11) et le chat écrivent
            // « n° » suivi d'une espace insécable, et le même texte changeait
            // de forme d'un écran à l'autre. Le numéro n'est pas touché.
            title: typographieDesNumeros(titre),
            // Pas de sous-titre : c'était la cote interne (« PRC-4722 »,
            // `reference`), que plus aucun écran n'affiche (P2), comme la
            // liste de la barre de recherche (SearchBar.svelte). L'intitulé
            // officiel porte déjà la nature, le numéro et la date.
            icon: nature.icone,
            badge: $tr(nature.cle),
            action: () => allerA(`/laws/${item.id}`),
          });
        }
      }
    } catch {
      // Ignorer les pannes réseau
    }

    // Réponse d'une saisie passée : le champ a changé pendant la requête
    // (frappe, effacement, fermeture). Affichée, elle remplaçait la liste du
    // champ, ou les raccourcis, par celle d'une autre saisie, et ramenait la
    // sélection en tête, loin de la ligne qui avait le focus. La recherche
    // de la saisie actuelle, si elle en a une, arrêtera le sablier.
    if (q !== query.trim()) return;

    // Une ligne a le focus (Tab) : la liste change sous elle, ses lignes
    // étant rangées par position, et Entrée y ouvrait le texte venu prendre
    // sa place, ni celui qu'on avait choisi ni la ligne surlignée. Le focus
    // revient au champ, où Entrée suit la surbrillance, remise en tête.
    const actif = document.activeElement;
    if (actif instanceof HTMLButtonElement && lignes.includes(actif)) inputElement?.focus();
    suggestions = resultats;
    loading = false;
    selectedIndex = 0;
  }

  function onInput(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    query = val;
    clearTimeout(debounceTimer);
    // Vide, la saisie rend aussitôt les raccourcis, comme « Effacer ».
    if (!val.trim()) {
      revenirAuxRaccourcis();
      return;
    }
    debounceTimer = setTimeout(() => {
      chercherSuggestions(val);
    }, 200);
  }

  $: displayedItems = query.trim() ? suggestions : defaultActions;

  function onKeydown(e: KeyboardEvent) {
    // Raccourci global Ctrl+K ou Cmd+K
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if ($commandPaletteOpen) {
        close();
      } else if (!$choixPersonaOuvert) {
        // Pas sous la boîte « Changer de profil », posée au-dessus de la
        // palette (z-[60] contre z-50) : son champ y prenait le focus, caché
        // sous le fond de la boîte.
        commandPaletteOpen.set(true);
      }
      return;
    }

    if (!$commandPaletteOpen) return;

    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const total = displayedItems.length;
      if (total === 0) return;
      // Depuis une ligne atteinte à la tabulation, on part d'elle. Hors du
      // champ, le focus suit la sélection : Entrée active le bouton qui a le
      // focus, qui doit donc être la ligne surlignée. Depuis « Effacer », il
      // y restait, et Entrée effaçait la saisie au lieu d'ouvrir la ligne
      // surlignée. Depuis le champ, le focus y reste et seule la sélection
      // bouge.
      const depuis = lignes.indexOf(e.target as HTMLButtonElement);
      const pas = e.key === "ArrowDown" ? 1 : -1;
      selectedIndex = ((depuis >= 0 ? depuis : selectedIndex) + pas + total) % total;
      if (e.target !== inputElement && dansLaPalette(e.target)) lignes[selectedIndex]?.focus();
    } else if (e.key === "Enter") {
      // Entrée n'ouvre la ligne surlignée que depuis le champ, ou quand rien
      // n'a le focus. Sur un autre bouton de la palette (une ligne atteinte à
      // la tabulation, « Effacer »), elle reste au bouton, qui s'active
      // lui-même : retenue ici, elle ouvrait la ligne surlignée à sa place,
      // /chat au lieu du blog, une recherche au lieu d'effacer.
      if (e.target === inputElement || e.target === document.body) {
        e.preventDefault();
        displayedItems[selectedIndex]?.action();
      } else if (dansLaPageInerte(e.target)) {
        // Un contrôle de la page, sous le fond : ni `inert` ni, à défaut,
        // `retenirLeFocus` ne le laissent atteindre. Si Entrée y parvenait
        // quand même, invisible, il ne s'active pas (Entrée envoyait le
        // brouillon du chat, ou quittait la page) : le focus revient au champ,
        // d'où Entrée ouvre la ligne surlignée. Hors de la page inerte (une
        // boîte posée au-dessus de la palette), Entrée garde son effet.
        e.preventDefault();
        inputElement?.focus();
      }
    }
  }

  // À l'ouverture, d'où qu'elle vienne (loupe de l'en-tête, Ctrl K) : noter
  // qui a le focus, pour le lui rendre à la fermeture (`close`), puis le
  // donner au champ. Passée par une fonction, la déclaration ne dépend que
  // du store : `ouvreur` et `inputElement` ne la relancent pas.
  $: suivreLOuverture($commandPaletteOpen);

  function suivreLOuverture(etat: boolean) {
    if (etat === ouverte || typeof document === "undefined") return;
    ouverte = etat;
    // La région d'annonce part vide, comme celle de « Changer de profil » :
    // une phrase déjà dite, présente à l'ouverture, pourrait l'être une
    // seconde fois. Vidée aussi à la fermeture : la page reprend la parole.
    annonceDansLaPalette.set("");
    if (!etat) return;
    const actif = document.activeElement;
    ouvreur = actif instanceof HTMLElement && actif !== document.body ? actif : null;
    tick().then(() => inputElement?.focus());
  }
</script>

<svelte:window on:keydown={onKeydown} />
<svelte:document on:focusin|capture={retenirLeFocus} />

{#if $commandPaletteOpen}
  <div
    bind:this={boite}
    class="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 sm:px-6"
    role="dialog"
    aria-modal="true"
    aria-label={$tr("palette.label")}
  >
    <!-- Arrière-plan flouté avec fermeture au clic -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="fixed inset-0 bg-zinc-950/40 backdrop-blur-sm transition-opacity"
      on:click={() => close()}
      transition:fade={{ duration: 150 }}
    ></div>

    <!-- Boîte de dialogue flottante -->
    <div
      class="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-xl dark:shadow-none border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[80vh] z-10"
      transition:scale={{ duration: 150, start: 0.95 }}
    >
      <!-- Barre de saisie -->
      <div class="flex items-center px-4 py-3.5 border-b border-zinc-200 dark:border-zinc-800 gap-3">
        {#if loading}
          <Icone nom="loader-circle" class="w-6 h-6 text-zinc-950 dark:text-white motion-safe:animate-spin" />
        {:else}
          <Icone nom="search" class="text-2xl text-zinc-400 dark:text-zinc-500" />
        {/if}
        <!-- Champ sans cadre (guide § 4.5) : toute la fenêtre tient lieu de
             champ, et le curseur, toujours là, montre où l'on écrit. Avec la
             base des champs (bordure zinc-500, noire au focus, anneau d'1 px,
             angles droits), un rectangle se dessinait en permanence dans la
             fenêtre arrondie, puisque le focus ne quitte jamais ce champ.
             `px-0` : le texte s'aligne sur l'écart qui suit la loupe. -->
        <input
          bind:this={inputElement}
          type="text"
          value={query}
          on:input={onInput}
          placeholder={$tr("palette.placeholder")}
          class="w-full border-none bg-transparent px-0 text-zinc-950 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 text-base focus:outline-none focus:ring-0"
        />
        {#if query}
          <!-- Effacée, la saisie rend les raccourcis, le premier surligné
               (`revenirAuxRaccourcis`). -->
          <button
            type="button"
            on:click={() => {
              query = "";
              revenirAuxRaccourcis();
              inputElement.focus();
            }}
            class="text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white px-1.5 py-0.5 rounded-lg transition-colors"
          >
            {$tr("palette.clear")}
          </button>
        {/if}
        <!-- Touches : texte en zinc-600, le zinc-500 n'atteignant que 4,4:1
             sur le fond zinc-100 de la touche. -->
        <!-- Ni sous sm ni au doigt : sur une tablette tactile, « Échap »
             nommait une touche absente (même règle que les touches du pied). -->
        <kbd
          class="hidden sm:inline-block [@media(pointer:coarse)]:hidden px-2 py-0.5 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md font-mono"
        >
          {$tr("palette.escKey")}
        </kbd>
      </div>

      <!-- Liste des résultats / actions -->
      <div class="overflow-y-auto p-2 divide-y divide-zinc-100 dark:divide-zinc-800/60 max-h-96">
        {#if displayedItems.length > 0}
          <div class="py-1">
            <!-- Surtitre en Inter, dans sa casse (Q5 A) : zinc-500 sur le
                 blanc de la fenêtre (4,8:1), zinc-400 sur zinc-900. -->
            <div class="px-3 py-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              {query.trim() ? $tr("palette.sectionResults") : $tr("palette.sectionShortcuts")}
            </div>
            {#each displayedItems as item, idx (idx)}
              <!-- Sous-titre en zinc-600 : sur la ligne choisie (zinc-100), le
                   zinc-500 tombait à 4,4:1. La ligne surlignée suit aussi le
                   focus (`on:focus`) : atteinte à la tabulation, la ligne
                   qu'Entrée active est celle qu'on voit choisie. -->
              <button
                type="button"
                bind:this={lignes[idx]}
                on:click={item.action}
                on:focus={() => (selectedIndex = idx)}
                on:mouseenter={() => (selectedIndex = idx)}
                class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-colors {selectedIndex === idx
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-950 dark:text-white'
                  : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'}"
              >
                <div class="flex items-center gap-3 min-w-0 pr-2">
                  <Icone
                    nom={item.icon}
                    class="text-xl {selectedIndex === idx
                      ? 'text-zinc-950 dark:text-white'
                      : 'text-zinc-400 dark:text-zinc-500'}"
                  />
                  <!-- Titre sur deux lignes au téléphone (`max-sm:line-clamp-2`),
                       une seule à partir de sm. Sur une ligne de 390 px, à côté
                       de la pastille, il se coupait après quelques mots
                       (« Loi N°92/007 du 14 août 1992 po… ») : l'objet du texte
                       ne se lisait jamais. -->
                  <div class="min-w-0">
                    <p class="text-sm font-semibold leading-tight max-sm:line-clamp-2 sm:truncate">
                      {item.title}
                    </p>
                    {#if item.subtitle}
                      <p class="text-xs text-zinc-600 dark:text-zinc-400 truncate mt-0.5">
                        {item.subtitle}
                      </p>
                    {/if}
                  </div>
                </div>

                <!-- Badge du guide (§ 4.8) : Inter, dans sa casse. À partir de
                     sm seulement : au téléphone, ses 40 à 90 px prenaient la
                     place du titre, pour redire la nature que le titre écrit
                     déjà en tête (« Loi », « Décret ») et que l'icône montre. -->
                {#if item.badge}
                  <span
                    class="hidden shrink-0 sm:inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium {selectedIndex === idx
                      ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'}"
                  >
                    {item.badge}
                  </span>
                {/if}
              </button>
            {/each}
          </div>
        {:else}
          <div class="p-8 text-center space-y-2">
            <Icone nom="search-x" class="text-4xl text-zinc-400 dark:text-zinc-500" />
            <p class="text-sm text-zinc-700 dark:text-zinc-300 font-medium">
              {avecSaisie($tr("palette.noResults"), query)}
            </p>
            <p class="text-xs text-zinc-500 dark:text-zinc-400">
              {$tr("palette.noResultsHint")}
            </p>
          </div>
        {/if}
      </div>

      <!-- Pied de la boîte de commande. Les touches (↑ ↓, ↵) seulement sous
           un pointeur fin (souris, pavé tactile) : sur un écran tactile, elles
           décrivaient un clavier absent, comme « Échap ». Le nom de la
           palette reste, calé à droite (`ml-auto`).
           Plus de pied du tout sous sm, comme « Échap » : sur un téléphone de
           390 px, il gardait les touches sur une rangée de plus, juste sous
           le dernier résultat, qu'elle rognait à moitié, pour un geste que le
           doigt ne fait pas ; et seul, le nom ne vaut pas cette rangée. -->
      <div
        class="px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-800 hidden sm:flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400"
      >
        <div class="flex items-center gap-3 [@media(pointer:coarse)]:hidden">
          <span class="inline-flex items-center gap-1">
            <kbd class="px-1 py-0.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded font-mono text-[10px] text-zinc-600 dark:text-zinc-400">↑</kbd>
            <kbd class="px-1 py-0.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded font-mono text-[10px] text-zinc-600 dark:text-zinc-400">↓</kbd>
            <span>{$tr("palette.navigate")}</span>
          </span>
          <span class="inline-flex items-center gap-1">
            <kbd class="px-1.5 py-0.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded font-mono text-[10px] text-zinc-600 dark:text-zinc-400">↵</kbd>
            <span>{$tr("palette.select")}</span>
          </span>
        </div>
        <span class="ml-auto text-[11px] font-medium">
          {$tr("palette.footer")}
        </span>
      </div>

      <!-- La région d'annonce du chat tant que la palette est ouverte (voir
           `annonceDansLaPalette`) : la page derrière est inerte, la sienne
           comprise. Présente dès l'ouverture, vide ailleurs que sur le chat.
           Hors du flux (sr-only). -->
      <p class="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="palette-announce">
        {$annonceDansLaPalette}
      </p>
    </div>
  </div>
{/if}
