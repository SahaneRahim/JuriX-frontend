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
   *
   * REFONTE A (E6, étapes 2 et 4 de cartes/assistant-preuves.md § 5).
   * - Écrire (A2 § 3.5) : pendant que la réponse s'écrit (`enFlux`), chaque
   *   NOUVEAU bloc arrive du flou au net (`mv-ecrire`, 0,8 s), à sa naissance ;
   *   le texte déjà affiché ne bouge plus, la phrase en cours s'allonge telle
   *   quelle, et rien ne joue à la fin (`done`), ni pour une conversation
   *   rouverte, ni en mouvement réduit.
   * - Citer (décision C1) : à la fin de la réponse (`done`, les citations
   *   n'existent pas avant : C11), une puce après chaque renvoi (LigneCitee),
   *   étiquetée dans l'ordre de lecture (`pucesDeLaReponse`) et posée une à
   *   une quand les citations viennent d'arriver (`nouvelles`).
   */
  import Icone from "$lib/components/Icone.svelte";
  // `traductions` et non `tr` : le composant rend des <tr>, et un identifiant
  // du même nom fait signaler chaque balise par Svelte.
  import { tr as traductions } from "$lib/stores/language";
  import type { Bloc } from "$lib/texte";
  import type { CitationPositionnee } from "$lib/types";
  import { sansMarques, segmentsDuTexte } from "./citations";
  import { pucesDeLaReponse } from "./libelles";
  import LigneCitee from "./LigneCitee.svelte";
  import { preparerLesPolicesDeLApercu } from "./polices";

  export let blocs: Bloc[];
  /** Les blocs portent des marques de citation (nouvelle API). */
  export let marque = false;
  export let citations: CitationPositionnee[] = [];
  export let citationActive: number | null = null;
  export let surCitation: (index: number, declencheur: HTMLElement) => void = () => {};
  /**
   * La réponse s'écrit (flux en cours, avant `done`) : ses blocs nouveaux
   * arrivent du flou au net. La page le passe à la seule réponse en cours.
   */
  export let enFlux = false;
  /** Les citations viennent d'arriver (`done` de cette réponse, dans cette vue) : les puces se posent. */
  export let nouvelles = false;

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
   * Les citations retrouvées, dans l'ordre où la réponse les montre : bloc
   * après bloc, et dans un tableau ses intitulés, puis ses lignes. Un bloc de
   * code se lit tel quel, sans lien ni puce (`sansMarques`).
   */
  function citationsDansLOrdre(blocs: Bloc[]): number[] {
    const ordre: number[] = [];
    for (const bloc of blocs) {
      if (bloc.type === "code") continue;
      for (const texte of textesDuBloc(bloc)) {
        for (const segment of segmentsDuTexte(texte)) if (segment.genre === "citation") ordre.push(segment.index);
      }
    }
    return ordre;
  }

  /**
   * Le pas entre deux puces qui se posent, et le dernier délai permis, en ms.
   *
   * POURQUOI 350 MS, PUIS MOINS. Les puces se posent une à une (A1 § 4, A2
   * § 3.4 : « ≈ 350 ms entre deux puces »), mais aucun délai d'entrée ne
   * dépasse une seconde (décision D9) : une réponse qui cite huit articles
   * ferait attendre la dernière puce 2,5 s. Au-delà de quatre puces, le pas
   * se resserre pour que la dernière arrive à 1 s.
   */
  const PAS_ENTRE_DEUX_PUCES = 350;
  const DERNIER_DELAI = 1000;

  // Les puces, dans l'ordre de lecture, et le délai de chacune (A2 § 3.4).
  $: puces = new Map(
    marque
      ? [...pucesDeLaReponse(citationsDansLOrdre(blocs), citations, t)].map(([index, puce], _, toutes) => {
          const pas = toutes.length > 1 ? Math.min(PAS_ENTRE_DEUX_PUCES, DERNIER_DELAI / (toutes.length - 1)) : 0;
          return [index, { ...puce, delai: Math.round(puce.rang * pas) }] as const;
        })
      : [],
  );

  /**
   * Fait arriver un bloc du flou au net, une fois, s'il naît pendant que la
   * réponse s'écrit (`actif`).
   *
   * POURQUOI UNE ACTION, ET NON `class:mv-ecrire={enFlux}`. La classe
   * suivrait `enFlux` : à `done`, elle tomberait de tous les blocs, et le
   * dernier, né quelques images plus tôt, sauterait du flou au net au milieu
   * de son geste. L'action ne regarde `actif` qu'à la NAISSANCE du bloc (pas
   * de `update`) : un bloc déjà affiché ne rejoue jamais rien, un bloc né
   * après `done` (ou dans une conversation rouverte) n'en a pas, et la classe
   * part à la fin de SON geste. Les blocs sont gardés par leur rang (`(i)`) :
   * le texte qui s'allonge reste dans le même nœud, sans rejouer. Les classes
   * de ces blocs sont fixes : Svelte ne réécrit jamais leur `class`, et la
   * classe ajoutée ici y reste. En mouvement réduit, `mv-ecrire` n'a pas
   * d'animation (mouvement.css) : la classe reste, sans effet.
   */
  function ecrire(noeud: HTMLElement, actif: boolean) {
    if (!actif) return {};
    noeud.classList.add("mv-ecrire");
    // Le geste du bloc lui-même : celui d'une puce (`mv-citer`), plus bas,
    // remonte jusqu'ici et ne compte pas.
    const fin = (event: Event) => {
      if (event.target !== noeud) return;
      noeud.classList.remove("mv-ecrire");
      oublier();
    };
    const oublier = () => {
      noeud.removeEventListener("animationend", fin);
      noeud.removeEventListener("animationcancel", fin);
    };
    noeud.addEventListener("animationend", fin);
    noeud.addEventListener("animationcancel", fin);
    return { destroy: oublier };
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
      <h5 class="pt-1 font-bold text-zinc-950 dark:text-white" use:ecrire={enFlux}>
        <LigneCitee texte={bloc.texte} {marque} {citations} {citationActive} {surCitation} {puces} {nouvelles} liens={false} />
      </h5>
    {:else if bloc.type === "puce" && bloc.numero !== undefined}
      <!-- Le numéro est du texte réel, lu par les lecteurs d'écran, et non un
           `content:` CSS. -->
      <p class="relative pl-7" use:ecrire={enFlux}>
        <span class="absolute left-0 w-6 text-right font-semibold text-zinc-950 dark:text-zinc-100"
          >{bloc.numero}.</span
        > <LigneCitee texte={bloc.texte} {marque} {citations} {citationActive} {surCitation} {puces} {nouvelles} />{#if perdues}<span
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
        use:ecrire={enFlux}
      >
        <LigneCitee texte={bloc.texte} {marque} {citations} {citationActive} {surCitation} {puces} {nouvelles} />{#if perdues}<span
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
        use:ecrire={enFlux}
      >
        <table class="min-w-full border-collapse text-sm">
          {#if bloc.entetes && bloc.entetes.length > 0}
            <thead>
              <tr>
                {#each bloc.entetes as entete, c (c)}
                  <th
                    scope="col"
                    class="whitespace-pre-line border-b border-zinc-200 bg-zinc-100 px-2 py-1.5 text-left font-semibold text-zinc-950 dark:border-zinc-800 dark:bg-zinc-800 dark:text-white"
                    ><LigneCitee texte={entete} {marque} {citations} {citationActive} {surCitation} {puces} {nouvelles} liens={false} /></th
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
                    ><LigneCitee texte={cellule} {marque} {citations} {citationActive} {surCitation} {puces} {nouvelles} /></td
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
        use:ecrire={enFlux}
        class="overflow-x-auto whitespace-pre-wrap rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm leading-relaxed text-zinc-800 dark:border-zinc-700/60 dark:bg-zinc-800/50 dark:text-zinc-100"><code
          >{marque ? sansMarques(bloc.texte) : bloc.texte}</code
        ></pre>
    {:else}
      <p use:ecrire={enFlux}>
        <LigneCitee texte={bloc.texte} {marque} {citations} {citationActive} {surCitation} {puces} {nouvelles} />{#if perdues}<span
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
