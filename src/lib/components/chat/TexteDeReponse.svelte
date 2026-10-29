<script lang="ts">
  /**
   * Le texte d'une réponse du chat, bloc par bloc ($lib/texte.blocsDeReponse) :
   * titres, puces, paragraphes, tableaux, code.
   *
   * Rendu en NŒUDS Svelte, donc échappé par construction. Le prompt système
   * du backend demande du markdown ; l'afficher tel quel montrait
   * « **Réponse directe** » astérisques comprises, et `{@html}` est exclu
   * (voir la docstring de $lib/texte.ts).
   *
   * Sorti de la page du chat avec la refonte des citations (P3) : chaque
   * ligne passe par `LigneCitee`, qui pose les liens des citations, et un bloc
   * qui contient une citation introuvable se termine par l'alerte « Citation
   * non retrouvée… » (maquette chat-p3a). `coupe-mots` : une cote
   * (« N°2018/9387/CAB/PM ») ou une URL ne pousse plus la conversation hors de
   * l'écran.
   */
  import Icone from "$lib/components/Icone.svelte";
  // `traductions` et non `tr` : le composant rend des <tr>, et un identifiant
  // du même nom fait signaler chaque balise par Svelte.
  import { tr as traductions } from "$lib/stores/language";
  import type { Bloc } from "$lib/texte";
  import type { CitationPositionnee } from "$lib/types";
  import { sansMarques, segmentsDuTexte } from "./citations";
  import LigneCitee from "./LigneCitee.svelte";
  import { preparerLesPolicesDeLApercu } from "./polices";

  export let blocs: Bloc[];
  /** Les blocs portent des marques de citation (nouvelle API). */
  export let marque = false;
  export let citations: CitationPositionnee[] = [];
  export let citationActive: number | null = null;
  export let surCitation: (index: number, declencheur: HTMLElement) => void = () => {};

  $: t = $traductions;

  // Une réponse qui cite des articles : l'aperçu, en Literata texte, peut
  // s'ouvrir. Ses deux graisses sont demandées au repos, avant qu'on y touche
  // (`font-display: optional`, voir ./polices).
  $: if (marque && citations.length > 0) preparerLesPolicesDeLApercu();

  /** Les textes d'un bloc : sa ligne, ou ses cellules pour un tableau. */
  function textesDuBloc(bloc: Bloc): string[] {
    return bloc.type === "tableau" ? [...(bloc.entetes ?? []), ...(bloc.lignes ?? []).flat()] : [bloc.texte];
  }

  /** Nombre de citations introuvables d'un bloc : une alerte les signale, au singulier ou au pluriel. */
  function introuvablesDuBloc(bloc: Bloc): number {
    if (!marque || bloc.type === "code") return 0;
    return textesDuBloc(bloc).reduce(
      (n, texte) => n + segmentsDuTexte(texte).filter((s) => s.genre === "introuvable").length,
      0,
    );
  }

  /**
   * Nom du cadre qui fait défiler un tableau de côté : ses intitulés de
   * colonnes, ou, sans ligne d'en-tête, sa première ligne, qui en tient lieu
   * quand le modèle oublie le délimiteur `|---|`. Tiré de la réponse, il est
   * dans sa langue sans clé de traduction, et chaque tableau se distingue des
   * autres dans la liste des repères d'un lecteur d'écran. Chaîne vide : rien
   * pour le nommer.
   */
  function nomDuTableau(bloc: Bloc): string {
    const ligne = bloc.entetes?.length ? bloc.entetes : (bloc.lignes?.[0] ?? []);
    return ligne
      .map((cellule) => sansMarques(cellule).replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join(", ");
  }
</script>

<!-- Les citations introuvables d'un bloc : signalées par une icône et une
     phrase, jamais par la couleur seule (P3). Dans le paragraphe même, comme
     la maquette, pour qu'un lecteur d'écran l'entende juste après la phrase. -->
<div class="coupe-mots space-y-3 leading-relaxed">
  {#each blocs as bloc, i (i)}
    {@const perdues = introuvablesDuBloc(bloc)}
    {#if bloc.type === "titre"}
      <h5 class="pt-1 font-bold text-zinc-950 dark:text-white">
        <LigneCitee texte={bloc.texte} {marque} {citations} {citationActive} {surCitation} liens={false} />
      </h5>
    {:else if bloc.type === "puce" && bloc.numero !== undefined}
      <!-- Le numéro est du texte réel, lu par les lecteurs d'écran, et non un
           `content:` CSS. -->
      <p class="relative pl-7">
        <span class="absolute left-0 w-6 text-right font-semibold text-zinc-950 dark:text-zinc-100"
          >{bloc.numero}.</span
        > <LigneCitee texte={bloc.texte} {marque} {citations} {citationActive} {surCitation} />{#if perdues}<span
            class="mt-2 flex items-start gap-2 rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            data-citation-introuvable
            ><Icone nom="triangle-alert" class="mt-0.5 shrink-0 text-base text-zinc-950 dark:text-white" /><span
              >{perdues > 1 ? t("chat.citation.unfoundMany") : t("chat.citation.unfound")}</span
            ></span
          >{/if}
      </p>
    {:else if bloc.type === "puce"}
      <!-- La puce seule en gras, comme le numéro d'une liste numérotée : la
           phrase garde le poids du texte. -->
      <p
        class="relative pl-5 before:absolute before:left-1 before:font-bold before:text-zinc-950 before:content-['•'] dark:before:text-zinc-100"
      >
        <LigneCitee texte={bloc.texte} {marque} {citations} {citationActive} {surCitation} />{#if perdues}<span
            class="mt-2 flex items-start gap-2 rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            data-citation-introuvable
            ><Icone nom="triangle-alert" class="mt-0.5 shrink-0 text-base text-zinc-950 dark:text-white" /><span
              >{perdues > 1 ? t("chat.citation.unfoundMany") : t("chat.citation.unfound")}</span
            ></span
          >{/if}
      </p>
    {:else if bloc.type === "tableau"}
      {@const nom = nomDuTableau(bloc)}
      <!-- Un tableau large défile de côté DANS son cadre, au lieu d'élargir la
           conversation. Ses mots ne se coupent pas n'importe où
           (`overflow-wrap` normal) : des colonnes réduites à une lettre
           seraient illisibles. Le cadre prend le focus (axe
           scrollable-region-focusable) : sans rien de focalisable dedans, ses
           colonnes cachées restaient hors d'atteinte du clavier. Région nommée
           par ses intitulés ; sans nom, ni rôle ni aria-label. -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class="overflow-x-auto overscroll-x-contain [overflow-wrap:normal]"
        tabindex="0"
        role={nom ? "region" : undefined}
        aria-label={nom || undefined}
      >
        <table class="min-w-full border-collapse text-sm">
          {#if bloc.entetes && bloc.entetes.length > 0}
            <thead>
              <tr>
                {#each bloc.entetes as entete, c (c)}
                  <th
                    scope="col"
                    class="whitespace-pre-line border-b border-zinc-200 bg-zinc-100 px-2 py-1.5 text-left font-semibold text-zinc-950 dark:border-zinc-800 dark:bg-zinc-800 dark:text-white"
                    ><LigneCitee texte={entete} {marque} {citations} {citationActive} {surCitation} liens={false} /></th
                  >
                {/each}
              </tr>
            </thead>
          {/if}
          <tbody>
            {#each bloc.lignes ?? [] as rangee, r (r)}
              <tr class="border-b border-zinc-200 last:border-0 dark:border-zinc-800">
                {#each rangee as cellule, c (c)}
                  <td class="whitespace-pre-line px-2 py-1.5 align-top"
                    ><LigneCitee texte={cellule} {marque} {citations} {citationActive} {surCitation} /></td
                  >
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      {#if perdues}
        <p
          class="flex items-start gap-2 rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          data-citation-introuvable
        >
          <Icone nom="triangle-alert" class="mt-0.5 shrink-0 text-base text-zinc-950 dark:text-white" /><span
            >{perdues > 1 ? t("chat.citation.unfoundMany") : t("chat.citation.unfound")}</span
          >
        </p>
      {/if}
    {:else if bloc.type === "code"}
      <!-- Retours à la ligne gardés, lignes longues repliées : un modèle de
           courrier dans un bloc de code ne se lit pas en faisant défiler
           l'écran de côté. Ni lien ni citation : il se lit tel quel. -->
      <pre
        class="overflow-x-auto whitespace-pre-wrap rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm leading-relaxed text-zinc-800 dark:border-zinc-700/60 dark:bg-zinc-800/50 dark:text-zinc-100"><code
          >{marque ? sansMarques(bloc.texte) : bloc.texte}</code
        ></pre>
    {:else}
      <p>
        <LigneCitee texte={bloc.texte} {marque} {citations} {citationActive} {surCitation} />{#if perdues}<span
            class="mt-2 flex items-start gap-2 rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            data-citation-introuvable
            ><Icone nom="triangle-alert" class="mt-0.5 shrink-0 text-base text-zinc-950 dark:text-white" /><span
              >{perdues > 1 ? t("chat.citation.unfoundMany") : t("chat.citation.unfound")}</span
            ></span
          >{/if}
      </p>
    {/if}
    {#if perdues && bloc.type === "titre"}
      <p
        class="flex items-start gap-2 rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
        data-citation-introuvable
      >
        <Icone nom="triangle-alert" class="mt-0.5 shrink-0 text-base text-zinc-950 dark:text-white" /><span
          >{perdues > 1 ? t("chat.citation.unfoundMany") : t("chat.citation.unfound")}</span
        >
      </p>
    {/if}
  {/each}
</div>
