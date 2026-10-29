<script lang="ts">
  /**
   * L'encadré de statut en tête d'un texte (P1, étapes 1 et 2), à la place
   * de la pastille « EN VIGUEUR » écrite en dur, que rien ne prouvait.
   *
   * Recette des maquettes loi-p1a et constitution-p1a : un aplat zinc-100,
   * SANS bordure, pour qu'un statut ne se confonde pas avec les boutons à
   * contour juste dessous. Le sens passe par une icône ET un mot, jamais par
   * la couleur, et jamais par le rouge : un texte abrogé n'est pas une erreur
   * de l'interface. Texte zinc-700 sur zinc-100 (9,5:1), zinc-300 sur
   * zinc-800 en sombre (10:1).
   *
   * Le contenu suit `etatDuBloc` (statut.ts), donc le relevé et rien d'autre :
   * sans statut, « Version d'origine, non consolidée » sans date de relevé.
   */
  import Icone from "$lib/components/Icone.svelte";
  import { language, tr } from "$lib/stores/language";
  import type { StatutJuridique } from "$lib/types";
  import NomDuTexteLie from "./NomDuTexteLie.svelte";
  import { dateDuReleve, detailDesChangements, etatDuBloc } from "./statut";
  import { LIEN_DANS_LE_TEXTE } from "./typographie";

  export let statut: StatutJuridique | null;
  /** `mailto:` prérempli vers l'adresse de contact (reference.ts, `lienDeSignalement`). */
  export let lienSignaler: string;

  $: langue = $language.current;
  $: etat = etatDuBloc(statut);
  // Espace insécable avant le deux-points, en français seulement.
  $: deuxPoints = langue === "fr" ? "\u00a0:" : ":";
  $: releve = "releveLe" in etat ? dateDuReleve(etat.releveLe, langue) : "";
  // Svelte retire les espaces au bord d'un bloc `{#if}` : les séparateurs et
  // les espaces qui ouvrent un bloc passent par des expressions.
  const VIRGULE = ", ";
</script>

{#if etat.genre === "inconnu" || etat.genre === "origine"}
  <!-- Étape 1 : « Version d'origine, non consolidée. Aucune modification
       relevée par JuriX au 14 oct. 2026. Signaler ». Sans statut (ancienne
       API), la première phrase seule : la date ne se devine pas. -->
  <div
    class="mb-4 sm:mb-6 flex items-start gap-2.5 rounded-xl bg-zinc-100 px-3.5 py-2.5 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
    data-testid="law-status"
    data-etat={etat.genre}
  >
    <Icone nom="circle-dashed" class="mt-0.5 shrink-0 text-base text-zinc-600 dark:text-zinc-400" />
    <p>
      <span class="font-semibold text-zinc-950 dark:text-white">{$tr("loi.statut.origine")}</span>
      {#if etat.genre === "origine"}
        {$tr("loi.statut.aucune_modification").replace("{date}", releve)}
      {/if}
      <a href={lienSignaler} class={LIEN_DANS_LE_TEXTE}>{$tr("loi.statut.signaler")}</a>
    </p>
  </div>
{:else if etat.genre === "modifie"}
  <!-- Étape 2 : les textes modificatifs connus, un par ligne, avec les
       articles qu'ils touchent (« art. 14, 15, 51 ; art. 67 complété »). Ni
       les changements dépassés ni ceux déjà intégrés : ils sont dans
       l'onglet « Historique ». -->
  <div
    class="mb-4 sm:mb-6 rounded-xl bg-zinc-100 px-4 py-3 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
    data-testid="law-status"
    data-etat="modifie"
  >
    <p class="flex items-start gap-2.5">
      <span class="mt-0.5 shrink-0 text-base text-zinc-950 dark:text-white"><Icone nom="rotate-ccw-clock" /></span>
      <span>
        <span class="font-semibold text-zinc-950 dark:text-white">{$tr("loi.statut.modifie")}</span>
        {etat.integres.length ? $tr("loi.statut.affiche_en_partie") : $tr("loi.statut.affiche_origine")}
        {$tr("loi.statut.textes_modificatifs").replace("{date}", releve)}
      </span>
    </p>
    <ul class="mt-1 list-disc space-y-0.5 pl-7 marker:text-zinc-400 dark:marker:text-zinc-500">
      {#each etat.groupes as groupe (groupe.texte.reference ?? groupe.texte.titre)}
        <li>
          {$tr("loi.mot.par")} <NomDuTexteLie texte={groupe.texte} />
          ({detailDesChangements(groupe.changements, langue, $tr)})
        </li>
      {/each}
    </ul>
    {#if etat.integres.length}
      <p class="mt-1.5 pl-7">
        {$tr("loi.statut.deja_integres")}{deuxPoints}
        {#each etat.integres as texte, i (texte.reference ?? texte.titre)}{#if i}{VIRGULE}{/if}<NomDuTexteLie {texte} />{/each}.
      </p>
    {/if}
    <p class="mt-1.5 pl-7">
      <a href={lienSignaler} class={LIEN_DANS_LE_TEXTE}>{$tr("loi.statut.signaler")}</a>
    </p>
  </div>
{:else if etat.genre === "consolide"}
  <!-- Le document en base intègre déjà ces modifications (deux textes du
       relevé) : surtout pas « version d'origine, non consolidée ». -->
  <div
    class="mb-4 sm:mb-6 flex items-start gap-2.5 rounded-xl bg-zinc-100 px-3.5 py-2.5 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
    data-testid="law-status"
    data-etat="consolide"
  >
    <Icone nom="layers" class="mt-0.5 shrink-0 text-base text-zinc-950 dark:text-white" />
    <p>
      <span class="font-semibold text-zinc-950 dark:text-white">{$tr("loi.statut.consolidee")}</span>
      {$tr("loi.statut.integre_les")}{deuxPoints}
      {#each etat.integres as texte, i (texte.reference ?? texte.titre)}{#if i}{VIRGULE}{/if}<NomDuTexteLie {texte} />{/each}.
      {$tr("loi.statut.aucune_autre").replace("{date}", releve)}
      <a href={lienSignaler} class={LIEN_DANS_LE_TEXTE}>{$tr("loi.statut.signaler")}</a>
    </p>
  </div>
{:else}
  <!-- Le texte ENTIER est abrogé ou remplacé : le texte qui l'abroge, et
       la version d'origine dite comme telle, sans « en vigueur » ni rouge. -->
  <div
    class="mb-4 sm:mb-6 flex items-start gap-2.5 rounded-xl bg-zinc-100 px-3.5 py-2.5 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
    data-testid="law-status"
    data-etat={etat.genre}
  >
    <Icone nom="archive" class="mt-0.5 shrink-0 text-base text-zinc-950 dark:text-white" />
    <p>
      <span class="font-semibold text-zinc-950 dark:text-white">{$tr(`loi.statut.${etat.genre}`)}</span
      >{#if etat.par}{` ${$tr("loi.mot.par")} `}<NomDuTexteLie texte={etat.par} />{/if}.
      {$tr("loi.statut.abroge_suite").replace("{date}", releve)}
      <a href={lienSignaler} class={LIEN_DANS_LE_TEXTE}>{$tr("loi.statut.signaler")}</a>
    </p>
  </div>
{/if}
