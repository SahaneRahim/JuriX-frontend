<script lang="ts">
  /**
   * Le sommaire d'un texte (P10, variante A) : chaque division avec sa plage
   * d'articles (« Chapitre III · art. 7 à 11 ») et son intitulé, chaque
   * article avec ses premiers mots, l'article lu marqué par une barre de
   * 3 px (et `aria-current="location"`, pas seulement la couleur), et les
   * articles touchés par un autre texte suivis de « · modifié » (P1).
   *
   * Des LIENS vers les ancres `#art-N` : ouverts dans un nouvel onglet ou
   * copiés, ils mènent à l'article. La page intercepte le clic simple
   * (événement `choisir`) pour changer d'article sans recharger.
   *
   * Le filtre ignore casse et accents, et montre l'occurrence en gras à la
   * place des premiers mots quand elle est plus loin dans l'article.
   *
   * DEUX VARIANTES (refonte A, décision L4).
   * - `feuille` : tout ce qui précède, le sommaire COMPLET (toutes les
   *   divisions, filtre, premiers mots), dans la feuille « Tout le sommaire ».
   * - `colonne` : la seule division de l'article lu, comme la maquette
   *   RefonteLecture : à partir de `lg`, une colonne de 200 px, le surtitre de
   *   la division puis une ligne de 40 px par article (« Art. 37 » ; 44 au
   *   doigt), et un repère de 2 px qui GLISSE vers l'article lu ; sous `lg`, la
   *   même liste devient une rangée de puces de 44 px qui défile à
   *   l'horizontale.
   *
   * POURQUOI LA COLONNE ET LES PUCES NE SONT QU'UNE VARIANTE. La maquette en
   * fait deux présentations, selon la largeur. Les choisir en JavaScript
   * (`matchMedia`) rendrait les puces au serveur, puis la colonne au réveil
   * de la page sur un ordinateur : un saut au chargement (PASSATION § 8,
   * piège 7). Les mêmes liens prennent donc l'une ou l'autre forme par les
   * classes `lg:` : un seul lien par article dans le DOM, pour les lecteurs
   * d'écran comme pour les tests (« un seul #sommaire », E5). La colonne ne
   * rend que la division lue : un Code de 2 041 articles n'envoie pas ses
   * 2 041 liens dans une colonne qui n'en montre que quelques-uns.
   *
   * Le repère n'a pas le ressort de la maquette : courbe commune (décision X2).
   */
  import { createEventDispatcher, tick } from "svelte";
  import { language, tr } from "$lib/stores/language";
  import {
    enTetePrincipal,
    enTetesDuSommaire,
    filtrerLArticle,
    libelleDeDivision,
    plageDArticles,
    premiersMots,
    type ArticleDuTexte,
    type DivisionDuTexte,
    type Occurrence,
    type TexteDecoupe,
  } from "./decoupage";
  import { ancreDeLArticle } from "./reference";
  import type { MarqueDuSommaire } from "./statut";

  export let decoupe: TexteDecoupe;
  /** Rang de l'article lu (barre de 3 px). */
  export let rangCourant: number;
  export let marques: Map<number, MarqueDuSommaire>;
  /** Filtre saisi au-dessus de la liste. */
  export let filtre = "";
  export let langueDuTexte: "fr" | "en" = "fr";
  /** `feuille` : le sommaire complet ; `colonne` : la division lue (colonne dès `lg`, puces en dessous). */
  export let variante: "colonne" | "feuille" = "feuille";

  const dispatch = createEventDispatcher<{ choisir: { rang: number; evenement: MouseEvent } }>();

  $: langue = $language.current;

  interface Entree {
    article: ArticleDuTexte;
    occurrence: Occurrence | null;
  }

  /** Les divisions et leurs articles retenus par le filtre ; sans filtre, tout. */
  $: lignes = filtrer(decoupe, filtre);
  function filtrer(texte: TexteDecoupe, saisie: string): { division: DivisionDuTexte; entrees: Entree[] }[] {
    const cherche = saisie.trim();
    return texte.divisions
      .map((division) => ({
        division,
        entrees: division.articles.flatMap((article): Entree[] => {
          if (!cherche) return [{ article, occurrence: null }];
          const resultat = filtrerLArticle(article, cherche);
          if (resultat === false) return [];
          return [{ article, occurrence: resultat === true ? null : resultat }];
        }),
      }))
      .filter((ligne) => ligne.entrees.length > 0);
  }

  /**
   * La division de l'article lu, pour la colonne ; celle du premier article
   * quand aucun n'est lu (texte entier, avant le premier article : -1).
   */
  $: divisionLue = decoupe.divisions[decoupe.articles[Math.max(0, rangCourant)]?.division ?? 0] as
    | DivisionDuTexte
    | undefined;
  /** Rang de l'article lu DANS sa division : la place du repère, une ligne par rang. */
  $: indexDansLaDivision = divisionLue ? divisionLue.articles.findIndex((article) => article.rang === rangCourant) : -1;

  /**
   * Sous `lg`, la rangée de puces ramène la puce de l'article lu au milieu,
   * à l'horizontale seulement (`scrollLeft`) : un `scrollIntoView` ferait
   * aussi défiler la page. Rien quand la liste ne défile pas (colonne).
   */
  let rangeeDePuces: HTMLElement | undefined;
  $: centrerLaPuce(indexDansLaDivision, rangeeDePuces);
  function centrerLaPuce(_index: number, rangee: HTMLElement | undefined) {
    if (!rangee) return;
    void tick().then(() => {
      if (rangee.scrollWidth <= rangee.clientWidth) return;
      const puce = rangee.querySelector<HTMLElement>('[aria-current="location"]');
      if (!puce) return;
      rangee.scrollLeft = puce.offsetLeft - (rangee.clientWidth - puce.offsetWidth) / 2;
    });
  }

  /** « Titre II · Chapitre 1 · art. 5 à 10 » ; « Début du texte » avant le premier en-tête. */
  function surtitre(division: DivisionDuTexte): string {
    const noms = enTetesDuSommaire(division).map((entete) => libelleDeDivision(entete, $tr));
    const plage = plageDArticles(division);
    let etendue: string;
    if (plage && plage.de === plage.a) etendue = $tr("loi.sommaire.un").replace("{n}", plage.de);
    else if (plage) etendue = $tr("loi.sommaire.plage").replace("{de}", plage.de).replace("{a}", plage.a);
    else etendue = $tr("loi.sommaire.nombre").replace("{n}", String(division.articles.length));
    if (noms.length === 0) noms.push($tr("loi.sommaire.debut"));
    return [...noms, etendue].join(" · ");
  }
</script>

{#if variante === "feuille"}
{#each lignes as { division, entrees } (division.rang)}
  {@const intitule = enTetePrincipal(division)?.intitule ?? ""}
  <div>
    <!-- Collé en haut de la liste qui défile : on sait toujours dans quelle
         division on se trouve. Un texte sans division n'a pas d'en-tête. -->
    {#if decoupe.structure}
      <div class="sticky top-0 z-[1] bg-white pb-2 pt-1 dark:bg-zinc-900">
        <p class="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{surtitre(division)}</p>
        {#if intitule}
          <p
            class="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug text-zinc-950 coupe-mots dark:text-white"
            title={intitule}
            lang={langueDuTexte}
          >
            {intitule}
          </p>
        {/if}
      </div>
    {/if}
    <ul class="flex flex-col gap-0.5">
      {#each entrees as { article, occurrence } (article.rang)}
        {@const actif = article.rang === rangCourant}
        {@const marque = marques.get(article.rang)}
        <li>
          <!-- Barre de 3 px à gauche pour l'article lu, au lieu d'une
               pastille noire : elle se voit sans la couleur, et le texte
               garde son contraste. 44 px de haut au doigt (deux lignes). -->
          <a
            href="#{ancreDeLArticle(article)}"
            class="block rounded-r-lg border-l-[3px] py-1.5 pl-3 pr-2 text-[0.9375rem] transition-colors lg:text-sm {actif
              ? 'border-zinc-950 font-semibold text-zinc-950 dark:border-white dark:text-white'
              : 'border-transparent text-zinc-600 hover:border-zinc-300 hover:text-zinc-950 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-white'}"
            aria-current={actif ? "location" : undefined}
            on:click={(evenement) => dispatch("choisir", { rang: article.rang, evenement })}
          >
            <span class="block"
              >{$tr("loi.sommaire.art")}&nbsp;{article.numero}{#if langue === "fr" && article.numero === "1"}<sup
                  >er</sup
                >{/if}{#if marque}<span class="ml-1.5 text-xs font-normal text-zinc-500 dark:text-zinc-400"
                  >· {$tr(`loi.sommaire.${marque}`)}</span
                >{/if}</span
            >
            {#if occurrence}
              <!-- L'occurrence du filtre, mot pour mot, en gras. -->
              <span class="block truncate text-xs font-normal text-zinc-500 dark:text-zinc-400" lang={langueDuTexte}
                ><span>{occurrence.avant}</span><strong class="font-semibold text-zinc-950 dark:text-white"
                  >{occurrence.trouve}</strong
                ><span>{occurrence.apres}</span></span
              >
            {:else}
              <span
                class="block truncate text-xs font-normal {actif
                  ? 'text-zinc-600 dark:text-zinc-300'
                  : 'text-zinc-500 dark:text-zinc-400'}"
                lang={langueDuTexte}>{premiersMots(article)}</span
              >
            {/if}
          </a>
        </li>
      {/each}
    </ul>
  </div>
{/each}

{#if lignes.length === 0}
  <p class="text-sm italic text-zinc-500 dark:text-zinc-400">{$tr("loi.sommaire.aucun")}</p>
{/if}
{:else if divisionLue}
  {@const intituleLu = enTetePrincipal(divisionLue)?.intitule ?? ""}
  <!-- La division lue : son surtitre (« Chapitre I · art. 1 à 4 ») et son
       intitulé, dans la colonne seulement ; les puces n'ont pas de titre
       (maquette, sous 1 024 px). -->
  {#if decoupe.structure}
    <div class="mb-2 hidden lg:block">
      <p class="text-[13px] font-semibold leading-[18px] text-zinc-950 dark:text-white">{surtitre(divisionLue)}</p>
      {#if intituleLu}
        <p
          class="mt-0.5 line-clamp-3 text-[13px] leading-[18px] text-zinc-600 coupe-mots dark:text-zinc-400"
          title={intituleLu}
          lang={langueDuTexte}
        >
          {intituleLu}
        </p>
      {/if}
    </div>
  {/if}
  <div class="colonne relative lg:ml-1 lg:border-l lg:border-zinc-200 lg:dark:border-zinc-800">
    {#if indexDansLaDivision >= 0}
      <!-- Le repère de 2 px qui glisse vers l'article lu (colonne seulement :
           des lignes de hauteur fixe, sans retour à la ligne). -->
      <span
        class="repere absolute -left-px top-0 hidden w-0.5 bg-zinc-950 dark:bg-white lg:block"
        style="--rang: {indexDansLaDivision}"
        aria-hidden="true"
      ></span>
    {/if}
    <!-- Puces sous `lg` : la rangée défile à l'horizontale, dans ses propres
         limites (la page ne déborde jamais), avec 4 px de marge pour que le
         contour de focus d'une puce ne soit pas rogné. -->
    <ul
      bind:this={rangeeDePuces}
      aria-label={$tr("loi.sommaire.puces")}
      class="puces -m-1 flex gap-2 overflow-x-auto p-1 lg:m-0 lg:block lg:overflow-visible lg:p-0"
    >
      {#each divisionLue.articles as article (article.rang)}
        {@const actif = article.rang === rangCourant}
        {@const marque = marques.get(article.rang)}
        {@const libelle = `${$tr("loi.sommaire.art")}\u00a0${article.numero}${langue === "fr" && article.numero === "1" ? "er" : ""}${marque ? ` · ${$tr(`loi.sommaire.${marque}`)}` : ""}`}
        <li class="shrink-0">
          <a
            href="#{ancreDeLArticle(article)}"
            title={libelle}
            class="flex h-11 min-w-[4.5rem] items-center justify-center whitespace-nowrap rounded-xl border px-4 text-sm transition-colors lg:block lg:h-[var(--ligne)] lg:w-full lg:min-w-0 lg:truncate lg:rounded-none lg:rounded-r-lg lg:border-0 lg:leading-[var(--ligne)] {actif
              ? 'border-zinc-950 bg-zinc-950 font-semibold text-white dark:border-white dark:bg-white dark:text-zinc-950 lg:bg-zinc-100 lg:text-zinc-950 lg:dark:bg-zinc-800 lg:dark:text-white'
              : 'border-zinc-300 text-zinc-600 hover:border-zinc-950 hover:text-zinc-950 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-200 dark:hover:text-white lg:hover:bg-zinc-50 lg:dark:hover:bg-zinc-800/50'}"
            aria-current={actif ? "location" : undefined}
            on:click={(evenement) => dispatch("choisir", { rang: article.rang, evenement })}
          >
            {$tr("loi.sommaire.art")}&nbsp;{article.numero}{#if langue === "fr" && article.numero === "1"}<sup
                >er</sup
              >{/if}{#if marque}<span class="text-xs font-normal opacity-80">{` · ${$tr(`loi.sommaire.${marque}`)}`}</span>{/if}
          </a>
        </li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  /*
   * Les puces défilent sans barre de défilement (maquette) : la dernière
   * puce coupée au bord dit qu'il y en a d'autres. Sous `lg` seulement : la
   * colonne ne défile pas d'elle-même.
   */
  @media not all and (min-width: 1024px) {
    .puces {
      scrollbar-width: none;
    }

    .puces::-webkit-scrollbar {
      display: none;
    }
  }

  /*
   * POURQUOI UNE VARIABLE. La hauteur d'une ligne de la colonne : 40 px
   * (maquette), 44 au doigt (tablette en paysage). Le repère la lit aussi : il tombe toujours sur la
   * ligne de l'article lu.
   */
  .colonne {
    --ligne: 40px;
  }

  @media (pointer: coarse) {
    .colonne {
      --ligne: 44px;
    }
  }

  .repere {
    height: var(--ligne);
    transform: translateY(calc(var(--rang) * var(--ligne)));
  }

  /* Le repère glisse vers l'article lu ; rien en mouvement réduit. */
  @media (prefers-reduced-motion: no-preference) {
    .repere {
      transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
    }
  }
</style>
