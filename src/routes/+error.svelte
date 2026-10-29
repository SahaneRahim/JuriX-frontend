<script lang="ts">
  /**
   * Page d'erreur du site.
   *
   * Il n'en existait aucune : une URL inconnue affichait la page d'erreur brute
   * de SvelteKit. Comme `src/routes/+layout.svelte` ne rend qu'un `<slot />`,
   * cette page par défaut n'avait ni en-tête, ni pied de page, ni le moindre
   * lien — un cul-de-sac de plus, précisément ce qu'on cherche à supprimer.
   *
   * Elle sert de filet : toute cible qui échapperait encore au contrôle atterrit
   * ici avec un moyen de repartir, au lieu d'une impasse.
   */
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import Icone from "$lib/components/Icone.svelte";
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import SiteHeader from "$lib/components/SiteHeader.svelte";
  import { NAV_LINKS } from "$lib/nav";
  import { titreDePage } from "$lib/seo";
  import { tr } from "$lib/stores/language";

  // Boutons du guide (§ 4.4). La page n'offrait que six boutons secondaires
  // identiques, la navigation de l'en-tête et du pied de page une troisième
  // fois : aucune action ne se détachait.
  const BOUTON =
    "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors sm:w-auto";
  const PRINCIPAL = `${BOUTON} bg-zinc-950 text-white hover:bg-black dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200`;
  const SECONDAIRE = `${BOUTON} border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:border-zinc-950 hover:text-zinc-950 dark:hover:border-zinc-200 dark:hover:text-white`;

  // Les autres destinations, en liens discrets : l'accueil a son bouton.
  const AUTRES_DESTINATIONS = NAV_LINKS.filter((lien) => lien.href !== "/");

  // Texte indicatif de la recherche : la phrase complète à partir de sm, une
  // phrase courte en dessous, comme la barre de l'accueil. Sous sm, le champ
  // ne laisse que 238 px de texte à 390 px de large (168 à 320) : « Rechercher
  // une loi, un mot-clé... » (246 px) s'arrêtait sur « un mot-… ». Le rendu
  // serveur pose la phrase courte, qui tient partout ; la longue la remplace
  // après l'hydratation sur un écran assez large.
  const REQUETE_CHAMP_LARGE = "(min-width: 640px)";
  let champLarge = false;

  onMount(() => {
    const requete = window.matchMedia(REQUETE_CHAMP_LARGE);
    const suivre = () => (champLarge = requete.matches);
    suivre();
    requete.addEventListener("change", suivre);
    return () => requete.removeEventListener("change", suivre);
  });

  // 503 : l'API ne répond pas pendant le rendu serveur d'une fiche ou d'une
  // liste (leurs `load`). Le message passé à error() est en français ; la page
  // affiche le sien, traduit, avec un moyen de réessayer.
  $: indisponible = $page.status === 503;
  $: introuvable = $page.status === 404;
  $: titre =
    $page.status === 404
      ? $tr("error.notFoundTitle")
      : indisponible
        ? $tr("error.unavailableTitle")
        : $tr("error.genericTitle");
  $: corps =
    $page.status === 404
      ? $tr("error.notFoundBody")
      : indisponible
        ? $tr("error.unavailableBody")
        : ($page.error?.message ?? $tr("error.genericBody"));
</script>

<svelte:head>
  <title>{titreDePage(titre)}</title>
</svelte:head>

<!-- `min-h-app` (app.css : 100dvh, repli 100vh) : 100vh compte la barre du navigateur
     mobile comme repliée, et la page défilait d'autant sans raison. -->
<div class="min-h-app flex flex-col bg-background-light dark:bg-background-dark">
  <SiteHeader />

  <!-- Écran court (`court:`, téléphone en paysage) : code de 36 px et non 72,
       marges resserrées. Le « 404 », le titre, le texte et `py-12` poussaient
       « Retour à l'accueil » à 361 px sur un écran de 360 : le premier écran
       n'offrait aucune issue. La variante `court:` l'emporte sur sm. -->
  <main
    id="contenu"
    class="flex-grow flex flex-col items-center justify-center pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))] py-12 sm:py-20 court:py-4 text-center"
    data-testid="error-page"
  >
    <!-- Le code en Inter, chiffres alignés (Q5 A : deux voix au plus, la
         chasse fixe réservée aux codes courts écrits petit, comme « Ctrl K »).
         En Geist Mono extra-grasse, il faisait une troisième police sur un
         écran presque vide, au-dessus du titre en Literata et du texte en
         Inter. -->
    <p class="text-6xl sm:text-7xl court:text-4xl font-extrabold tracking-tight tabular-nums text-zinc-950 dark:text-white mb-4 court:mb-2">{$page.status}</p>

    <h1 class="text-2xl font-titre font-semibold text-zinc-950 dark:text-white mb-3 court:mb-1 coupe-mots">
      {titre}
    </h1>

    <!-- `coupe-mots` : un message d'erreur peut porter une adresse ou un
         identifiant sans espace, qui élargissait la page sur téléphone. -->
    <p
      class="text-zinc-600 dark:text-zinc-400 max-w-md mb-8 sm:mb-10 court:mb-4 coupe-mots text-sm sm:text-base leading-relaxed"
    >
      {corps}
    </p>

    <!-- L'action principale : retour à l'accueil, ou « Réessayer » quand
         l'API est indisponible (l'accueil passe alors en secondaire). Pleine
         largeur sur téléphone. -->
    <div class="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row sm:justify-center">
      {#if indisponible}
        <!-- Un lien et non un bouton : il marche avant le JavaScript, et
             data-sveltekit-reload redemande la page au serveur au lieu de
             rejouer le `load` dans le navigateur. -->
        <a
          href={$page.url.pathname + $page.url.search}
          data-sveltekit-reload
          data-testid="error-retry"
          class={PRINCIPAL}
          >{$tr("error.retry")}</a
        >
      {/if}
      <!-- `error-home` : l'action principale de la page pour les tests
           d'écran court (tests/e2e/pages-du-site.ts), présente à toutes les
           largeurs, contrairement aux liens de navigation plus bas. -->
      <a href="/" class={indisponible ? SECONDAIRE : PRINCIPAL} data-testid="error-home">
        <Icone nom="house" class="text-base" />
        {$tr("categories.backHome")}
      </a>
    </div>

    <!--
      Page introuvable : une recherche, pour retrouver le texte qu'un lien
      périmé promettait. Formulaire GET ordinaire vers /search : il marche
      avant le JavaScript, et le routeur de SvelteKit le reprend ensuite.
      Cadre à la recette des champs du guide (§ 4.5) ; pas pour une autre
      erreur, où l'API, dont dépend la recherche, est souvent en cause.
      Validation à l'allure de la barre de l'accueil, pour la même action :
      bouton plein « Rechercher », réduit à sa flèche sous sm ; texte saisi en
      16 px. La flèche discrète et le texte de 14 px d'ici ne ressemblaient
      pas à la barre que le visiteur venait de quitter.
    -->
    {#if introuvable}
      <form action="/search" method="get" role="search" class="mt-6 court:mt-4 w-full max-w-md">
        <div
          class="flex items-center gap-1 rounded-xl border border-zinc-200 bg-white p-1 pl-3 focus-within:border-zinc-950 focus-within:ring-1 focus-within:ring-zinc-950 dark:border-zinc-500 dark:bg-zinc-950 dark:focus-within:border-zinc-200 dark:focus-within:ring-zinc-200 transition-colors"
        >
          <Icone nom="search" class="shrink-0 text-lg text-zinc-400 dark:text-zinc-500" />
          <input
            type="search"
            name="q"
            enterkeyhint="search"
            autocomplete="off"
            aria-label={$tr("a11y.searchField")}
            placeholder={$tr(champLarge ? "search.placeholder" : "categories.searchPlaceholderShort")}
            class="min-h-11 min-w-0 flex-1 border-none bg-transparent px-2 text-base text-ellipsis text-zinc-950 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-0"
          />
          <button
            type="submit"
            aria-label={$tr("search.button")}
            class="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg bg-zinc-950 px-3 text-sm font-semibold text-white transition-colors hover:bg-black dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 sm:px-4"
          >
            <Icone nom="arrow-right" class="text-xl sm:hidden" />
            <span class="hidden sm:inline">{$tr("search.button")}</span>
          </button>
        </div>
      </form>
    {/if}

    <!-- Les autres destinations de la navigation, en liens discrets (même
         liste : une seule à maintenir). `text-balance` : sur téléphone, les
         lignes s'équilibrent au lieu de laisser un lien seul en dessous.
         Le pied de page ne les répète pas ici (`navigation={false}`).
         `lg:hidden` : à partir de lg, l'en-tête affiche ces mêmes liens juste
         au-dessus, et la liste paraissait deux fois. En dessous, il les range
         dans son menu : ici, ils restent à portée sans l'ouvrir. -->
    <nav class="mt-6 max-w-md text-balance sm:mt-8 court:mt-2 lg:hidden">
      {#each AUTRES_DESTINATIONS as lien (lien.href)}
        <a
          href={lien.href}
          class="inline-flex min-h-11 items-center px-3 text-sm font-medium text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white transition-colors"
          >{$tr(lien.key)}</a
        >
      {/each}
    </nav>
  </main>

  <SiteFooter navigation={false} />
</div>
