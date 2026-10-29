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
   */
  import { createEventDispatcher } from "svelte";
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
