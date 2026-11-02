<script lang="ts">
  /**
   * La vue « Relecture » de la fenêtre : chaque partie de l'article, phrase
   * par phrase avec le verdict du contrôle IA, et sa case « J'ai relu cette
   * partie contre les sources ».
   *
   * POURQUOI (contrat du 30/10). Des citations vérifiées ne rendent pas la
   * prose juste : l'essai réel a publié l'expulsion sans juge et la charge de
   * la preuve inversée, sans un avertissement. Chaque phrase dit donc ce que
   * le modèle en pense contre les extraits : « Soutenue par l'extrait 3 »,
   * « À vérifier », « Contredite par l'extrait 2 » (en rouge : c'est une
   * erreur), « Hors des sources » ; la raison s'ouvre à la demande, et le
   * numéro d'un extrait l'ouvre dans le panneau des sources.
   *
   * LE TEXTE MONTRÉ EST CELUI QUI SERA PUBLIÉ. Les verdicts ne s'affichent
   * que s'ils portent sur lui : contrôle à jour, partie non modifiée depuis
   * l'enregistrement. Sinon la partie montre son texte actuel, « Non
   * contrôlé » ou « Modifié, non enregistré » : jamais d'anciennes phrases à
   * relire à la place des nouvelles. La case d'une partie modifiée est
   * décochée et bloquée : sa relecture portait sur l'ancien texte.
   */
  import Icone from "$lib/components/Icone.svelte";
  import { citationBruteVerifiee, explicationDeCitation, sansRenvoisAuxExtraits, texteAffiche } from "$lib/data/blog";
  import type { NomIcone } from "$lib/icones";
  import { tr } from "$lib/stores/language";
  import { PARTIES_DE_RELECTURE, groupesDePhrases, type PartieDeRelecture, type PhraseControlee } from "./controle";
  import { nomDeCitation, partieRelue, type ArticleAdmin, type Formulaire } from "./relecture";

  export let article: ArticleAdmin;
  export let form: Formulaire;
  /** Les parties dont la saisie change le texte enregistré (`partiesModifiees`). */
  export let modifiees: PartieDeRelecture[] = [];
  /** Le contrôle porte sur le texte enregistré (`controleAJour`). */
  export let aJour = false;
  /** Les numéros des extraits que le panneau des sources peut montrer. */
  export let sourcesConnues: number[] = [];
  /** Pendant un envoi : les cases ne bougent pas. */
  export let desactive = false;
  export let onCocher: (partie: PartieDeRelecture, valeur: boolean) => void;
  export let onMontrerSource: (n: number) => void = () => {};

  /** Les raisons ouvertes, par identifiant de phrase. */
  let raisonsOuvertes: string[] = [];

  function basculerLaRaison(id: string) {
    raisonsOuvertes = raisonsOuvertes.includes(id) ? raisonsOuvertes.filter((r) => r !== id) : [...raisonsOuvertes, id];
  }

  // Le texte affiché d'une phrase ou d'une partie : sans Markdown, sans renvoi
  // « (extrait N) », comme sur la page publique.
  const propre = (texte: string) => texteAffiche(sansRenvoisAuxExtraits(texte));
  const lignes = (texte: string) =>
    texte
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

  interface VueDuVerdict {
    libelle: string;
    numeros: number[];
    icone: NomIcone;
    badge: string;
    carte: string;
  }

  const CARTE = "border-zinc-200 dark:border-zinc-700";
  const CARTE_A_VERIFIER = "border-dashed border-zinc-400 dark:border-zinc-500";

  /**
   * Libellé, extraits, icône et couleurs d'un verdict. Noir et blanc, sauf
   * « contredite » : le rouge est réservé aux erreurs, et c'en est une.
   */
  function vueDuVerdict(phrase: PhraseControlee, t: (cle: string) => string): VueDuVerdict {
    const n = phrase.extraits;
    const parNombre = (cle: string) => t(n.length === 0 ? cle : n.length === 1 ? `${cle}Un` : `${cle}Plusieurs`);
    switch (phrase.verdict) {
      case "soutenue":
        return {
          libelle: parNombre("admin.blog.verdict.soutenue"),
          numeros: n,
          icone: "check",
          badge: "border-zinc-300 bg-white text-zinc-700 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300",
          carte: CARTE,
        };
      case "contredite":
        return {
          libelle: parNombre("admin.blog.verdict.contredite"),
          numeros: n,
          icone: "circle-x",
          badge: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300",
          carte: "border-red-300 bg-red-50/60 dark:border-red-900/60 dark:bg-red-950/20",
        };
      case "hors_sources":
        return {
          libelle: t("admin.blog.verdict.hors_sources"),
          numeros: [],
          icone: "link-2-off",
          badge: "border-2 border-zinc-950 font-semibold text-zinc-950 dark:border-white dark:text-white",
          carte: CARTE_A_VERIFIER,
        };
      default:
        return {
          libelle: t("admin.blog.verdict.non_soutenue"),
          numeros: [],
          icone: "circle-question-mark",
          badge: "border-dashed border-zinc-500 font-semibold text-zinc-800 dark:border-zinc-400 dark:text-zinc-200",
          carte: CARTE_A_VERIFIER,
        };
    }
  }

  /** « 3 », « 3 et 5 », « 2, 3 et 5 » : le séparateur avant le i-ème numéro. */
  const separateur = (i: number, total: number, t: (cle: string) => string) =>
    i === 0 ? " " : i === total - 1 ? ` ${t("admin.blog.verdict.and")} ` : ", ";

  /** Les éléments d'une partie à plusieurs éléments, pour rattacher chaque phrase au sien. */
  function elementsDe(partie: PartieDeRelecture): string[] {
    if (partie === "points_cles") return article.keyPoints;
    if (partie === "explications") return article.citations.map((c) => explicationDeCitation(c));
    return [];
  }

  /** Le texte actuel d'une partie d'un seul texte, dans le formulaire. */
  function texteDe(partie: PartieDeRelecture, f: Formulaire): string {
    if (partie === "contexte") return f.contexte;
    if (partie === "resume") return f.resume;
    if (partie === "impact") return f.impact;
    if (partie === "question") return f.question;
    return "";
  }

  const BOUTON_POURQUOI =
    "inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-medium text-zinc-600 underline decoration-dotted underline-offset-4 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white";
</script>

<div class="space-y-6" data-testid="blog-relecture">
  {#each PARTIES_DE_RELECTURE as partie (partie)}
    {@const modifiee = modifiees.includes(partie)}
    {@const avecVerdicts = aJour && !modifiee}
    {@const groupes = avecVerdicts ? groupesDePhrases(article.controleIa, partie, elementsDe(partie)) : []}
    <section class="space-y-3" aria-labelledby="partie-{partie}" data-testid="blog-partie-{partie}">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 id="partie-{partie}" class="text-base font-bold text-zinc-950 dark:text-white">
          {$tr(`admin.blog.part.${partie}`)}
        </h3>
        {#if modifiee}
          <span class="inline-flex items-center gap-1 rounded-full border border-dashed border-zinc-400 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:border-zinc-500 dark:text-zinc-300">
            <Icone nom="pen-line" class="text-sm" />{$tr("admin.blog.check.modified")}
          </span>
        {:else if !avecVerdicts || groupes.length === 0}
          <span class="inline-flex items-center gap-1 rounded-full border border-dashed border-zinc-400 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:border-zinc-500 dark:text-zinc-300">
            <Icone nom="circle-dashed" class="text-sm" />{$tr("admin.blog.check.notChecked")}
          </span>
        {/if}
      </div>

      {#if groupes.length > 0}
        <!-- Les phrases contrôlées, groupées par point clé ou par citation. -->
        {#each groupes as groupe (groupe.rang ?? -1)}
          <div class="space-y-2">
            {#if partie === "points_cles" && groupe.rang !== null}
              <p class="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                {$tr("admin.blog.part.point").replace("{n}", String(groupe.rang + 1))}
              </p>
            {:else if partie === "explications" && groupe.rang !== null}
              {@const citation = article.citations[groupe.rang]}
              <!-- L'explication se relit contre l'extrait de SA citation. -->
              <p class="coupe-mots text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                {$tr("admin.blog.part.citation").replace("{n}", String(groupe.rang + 1))}{#if citation}&nbsp;· {nomDeCitation(citation, $tr)}{/if}
              </p>
              {#if citation && citationBruteVerifiee(citation) && typeof citation.excerpt === "string"}
                <blockquote class="whitespace-pre-line border-l-2 border-zinc-300 pl-3 text-xs leading-relaxed text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                  « {citation.excerpt} »
                </blockquote>
              {/if}
            {/if}
            <ul class="space-y-2">
              {#each groupe.phrases as phrase (phrase.id)}
                {@const vue = vueDuVerdict(phrase, $tr)}
                {@const ouverte = raisonsOuvertes.includes(phrase.id)}
                <li class="rounded-xl border p-3 {vue.carte}" data-testid="blog-phrase" data-verdict={phrase.verdict}>
                  <p class="text-sm leading-relaxed text-zinc-900 dark:text-zinc-100">{propre(phrase.texte)}</p>
                  <div class="mt-1 flex flex-wrap items-center gap-x-2">
                    <span
                      class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs {vue.badge}"
                      data-testid="blog-verdict"
                    >
                      <Icone nom={vue.icone} class="shrink-0 text-sm" />
                      <span
                        >{vue.libelle}{#each vue.numeros as n, i (n)}{separateur(i, vue.numeros.length, $tr)}{#if sourcesConnues.includes(n)}<button
                              type="button"
                              class="rounded px-0.5 font-semibold underline underline-offset-2 hover:no-underline"
                              aria-label={$tr("admin.blog.verdict.showSource").replace("{n}", String(n))}
                              on:click={() => onMontrerSource(n)}>{n}</button
                            >{:else}{n}{/if}{/each}</span
                      >
                    </span>
                    {#if phrase.raison}
                      <button
                        type="button"
                        class={BOUTON_POURQUOI}
                        aria-expanded={ouverte}
                        aria-controls="raison-{phrase.id}"
                        on:click={() => basculerLaRaison(phrase.id)}
                      >
                        {$tr("admin.blog.verdict.why")}
                      </button>
                    {/if}
                  </div>
                  {#if phrase.raison}
                    <p id="raison-{phrase.id}" class="mt-1 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300" hidden={!ouverte}>
                      {phrase.raison}
                    </p>
                  {/if}
                </li>
              {/each}
            </ul>
          </div>
        {/each}
      {:else if partie === "points_cles"}
        {@const points = lignes(form.pointsCles)}
        {#if points.length > 0}
          <ul class="list-disc space-y-1 pl-5 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
            {#each points as point, i (i)}<li>{propre(point)}</li>{/each}
          </ul>
        {:else}
          <p class="text-sm text-zinc-500 dark:text-zinc-400">{$tr("admin.blog.part.empty")}</p>
        {/if}
      {:else if partie === "explications"}
        {#if form.citations.length > 0}
          <ul class="space-y-2">
            {#each form.citations as citation, i (citation.cle)}
              <li class="space-y-1 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
                <p class="coupe-mots text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                  {$tr("admin.blog.part.citation").replace("{n}", String(i + 1))}&nbsp;· {nomDeCitation(citation.origine, $tr)}
                </p>
                <p class="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">{propre(citation.explication) || "—"}</p>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="text-sm text-zinc-500 dark:text-zinc-400">{$tr("admin.blog.part.empty")}</p>
        {/if}
      {:else}
        {@const texte = texteDe(partie, form).trim()}
        {#if texte}
          <p class="whitespace-pre-line text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">{propre(texte)}</p>
        {:else}
          <p class="text-sm text-zinc-500 dark:text-zinc-400">{$tr("admin.blog.part.empty")}</p>
        {/if}
      {/if}

      <!-- La relecture humaine, obligatoire pour publier. Une case par partie,
           au doigt (44 px) ; bloquée pendant un envoi et pour une partie
           modifiée, dont la relecture portait sur l'ancien texte. -->
      <label
        class="flex min-h-11 items-center gap-3 rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-900 dark:border-zinc-600 dark:text-zinc-100 {modifiee || desactive
          ? 'opacity-60'
          : 'cursor-pointer hover:border-zinc-950 dark:hover:border-zinc-300'}"
      >
        <input
          type="checkbox"
          class="h-5 w-5 shrink-0 accent-zinc-950 dark:accent-white"
          checked={partieRelue(form, partie, modifiees)}
          disabled={modifiee || desactive}
          aria-describedby={modifiee ? `partie-${partie} relecture-${partie}-aide` : `partie-${partie}`}
          data-testid="blog-case-{partie}"
          on:change={(e) => onCocher(partie, e.currentTarget.checked)}
        />
        <span>{$tr("admin.blog.reviewed")}</span>
      </label>
      {#if modifiee}
        <p id="relecture-{partie}-aide" class="text-xs text-zinc-600 dark:text-zinc-400">{$tr("admin.blog.reviewedModified")}</p>
      {/if}
    </section>
  {/each}
</div>
