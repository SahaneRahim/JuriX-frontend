<script lang="ts">
  /**
   * L'accueil (refonte A, direction « un champ, des preuves », E3c). Le titre
   * et son surtitre sont dans le layout (main) ; la page porte, dans l'ordre :
   * - le champ unique (profil, question ou recherche, mode, envoi), un vrai
   *   formulaire GET vers /search qui marche sans JavaScript (P8) ;
   * - les trois questions fréquentes du profil, qui partent vers l'assistant ;
   * - « Parcourir le droit » : les domaines et « Tous les textes » ;
   * - « Ce que JuriX vous montre » : trois démonstrations, finies au serveur.
   * Les composants sont dans $lib/components/accueil/.
   */
  import { onMount } from "svelte";
  import { invalidateAll } from "$app/navigation";
  import { page } from "$app/stores";
  import MetaSeo from "$lib/components/MetaSeo.svelte";
  import ChampUnique from "$lib/components/accueil/ChampUnique.svelte";
  import PreuvesJuriX from "$lib/components/accueil/PreuvesJuriX.svelte";
  import QuestionsFrequentes from "$lib/components/accueil/QuestionsFrequentes.svelte";
  import TuilesDeDomaines from "$lib/components/accueil/TuilesDeDomaines.svelte";
  import { remplir } from "$lib/components/listes/reperes";
  import { urlCanonique } from "$lib/seo";
  import { tr, language } from "$lib/stores/language";
  import { personaStore } from "$lib/stores/persona";
  import { nombreDeTextesDuCorpus, ordonnerLesDomaines } from "$lib/categories";
  import type { Category } from "$lib/types";

  /** Rempli par `+page.server.ts`. */
  export let data;

  // Les catégories viennent de la BASE, plus d'une liste écrite en dur : celle
  // d'avant mélangeait domaines juridiques et types de texte (« Lois »,
  // « Décrets »), et un décret fiscal n'avait aucune case correcte.
  //
  // Réactif et non simplement affecté : SvelteKit réutilise ce composant d'une
  // navigation à l'autre, et une affectation unique laisserait les catégories du
  // rendu précédent à l'écran après un `invalidateAll()`.
  //
  // Ordre PROVISOIRE de la proposition Q2 (travail, pénal, famille, foncier,
  // affaires, civil, impôts, Constitution, puis les autres), en attendant des
  // statistiques de consultation : `ordonnerLesDomaines` ($lib/categories).
  $: domaines = ordonnerLesDomaines((data.categories || []) as Category[]);
  $: categoriesError = data.erreur ? $tr(data.erreur) : "";
  $: langue = $language.current;

  /**
   * Chiffres du corpus (`GET /corpus`) que le `load` passe à la page : le
   * nombre de textes de « Tous les textes » et de la description de la page.
   * Lus sans les exiger, dans `$page.data` comme le fait le hero du layout :
   * l'ancienne API n'a pas la route, et le `load` peut ne pas encore les
   * demander. Sans eux, les phrases s'écrivent sans chiffre.
   */
  $: totalDesTextes = nombreDeTextesDuCorpus($page.data?.corpus);
  $: nombreAffiche = totalDesTextes === null ? "" : new Intl.NumberFormat(langue).format(totalDesTextes);
  $: ligneTousLesTextes =
    totalDesTextes === null
      ? $tr("accueil.domaines.tousSansChiffre")
      : remplir($tr("accueil.domaines.tous"), { n: nombreAffiche });

  /**
   * La description de la page pour les moteurs de recherche : le titre, puis
   * la phrase qui dit ce que fait le site (l'ancien sous-titre, Q1 A), avec
   * le nombre de textes s'il est connu. Une phrase complète, que le surtitre
   * de l'écran (« 2 275 textes officiels · chaque réponse cite ses
   * articles ») ne serait pas.
   */
  $: description =
    totalDesTextes === null
      ? $tr("accueil.sousTitreSansChiffre")
      : remplir($tr("accueil.sousTitre"), { n: nombreAffiche });

  /** « 14 domaines, du travail à l'environnement. » : le nombre vient de la base. */
  $: sousTitreDesDomaines = remplir($tr("accueil.domaines.sousTitre"), { n: domaines.length });

  /**
   * Le profil des questions fréquentes, lu après le montage seulement (comme
   * le champ unique, SelecteurDeProfil.svelte) : le serveur, qui ne voit pas
   * la mémoire du navigateur, rend celles du profil général.
   */
  let monte = false;
  onMount(() => {
    monte = true;
  });
  $: profilDesQuestions = monte ? $personaStore.persona : null;
</script>

<MetaSeo titre={$tr("title.home")} description={`${$tr("accueil.titre")} ${description}`} canonique={urlCanonique($page.url)} />

<!--
  Pas de transition propre à la page : ses blocs ont leurs entrées (tuiles,
  questions), et le titre comme le champ n'attendent rien (A2 § 2.4).
  Sans marge basse propre : celle du layout (32 px, puis 48) est la même que
  sur les autres pages.
-->
<div class="flex w-full max-w-6xl flex-col items-center">
  <ChampUnique />
  <QuestionsFrequentes persona={profilDesQuestions} />

  <!--
    Parcourir le droit (refonte A) : tuiles au bureau, pastilles qui défilent
    au téléphone (TuilesDeDomaines.svelte). Au téléphone, le titre n'est
    qu'une petite étiquette grise au-dessus de la rangée (maquette mobile) ;
    à partir de sm, un titre en Literata et sa phrase.

    `id="domaines"` : cible du lien « Parcourir par domaine » de l'état vide
    de la recherche (/#domaines, P7) ; sans elle, le lien posait le lecteur
    en haut de l'accueil, au-dessus du titre. L'en-tête de l'accueil ne colle
    pas : `scroll-mt-4` ne laisse qu'un peu d'air au-dessus du titre. Au
    téléphone, la barre d'onglets du bas lui laisse sa place
    (`scroll-padding-bottom`, BarreDOnglets.svelte).
  -->
  <section id="domaines" aria-labelledby="domaines-titre" class="mt-[26px] w-full scroll-mt-4 text-left sm:mt-24">
    <h2
      id="domaines-titre"
      class="mb-2 text-xs/[18px] font-normal text-zinc-500 dark:text-zinc-400 sm:font-titre sm:text-3xl/[1.2] sm:font-semibold sm:text-zinc-950 dark:sm:text-white"
    >
      {$tr("accueil.domaines.titre")}
    </h2>
    {#if domaines.length > 0}
      <p class="mb-7 hidden text-base text-zinc-600 dark:text-zinc-400 sm:block">{sousTitreDesDomaines}</p>
    {/if}

    <!--
      L'erreur garde sa reprise. `invalidateAll()` rejoue le `load` : c'est le
      pendant exact de l'ancien appel manuel, sans dupliquer la requête dans
      le composant. (Le `load` d'aujourd'hui répond 503 plutôt que d'envoyer
      une erreur : ce bloc ne sert que si cela change.)
    -->
    {#if categoriesError}
      <div role="alert" class="mb-6 flex flex-col items-center gap-3">
        <p class="text-sm text-red-600 dark:text-red-400">{categoriesError}</p>
        <button
          type="button"
          on:click={() => invalidateAll()}
          data-testid="home-retry"
          class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-800 transition-colors hover:border-zinc-950 hover:text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-200 dark:hover:text-white"
        >
          {$tr("common.retry")}
        </button>
      </div>
    {/if}

    <TuilesDeDomaines {domaines} {langue} {ligneTousLesTextes} />
  </section>

  <PreuvesJuriX />
</div>
