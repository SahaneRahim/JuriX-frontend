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
   *
   * LE TITRE D'ABORD (avenant du tour 4). Il se relit et se coche comme les
   * autres parties, avec ses verdicts : au tour 3, la vue ne le montrait pas,
   * et celui de l'essai réel présupposait ce que l'article 133 de l'AUDCG
   * contredit.
   *
   * UNE CASE NE SE COCHE QU'AVEC LES VERDICTS. Sans contrôle à jour, les
   * cases sont bloquées et le disent : cochées avant le contrôle, puis
   * enregistrées (« Enregistrer et relancer »), elles restaient valables
   * après lui, et ses « À vérifier » pouvaient n'être jamais lus avant
   * « Publier » (revue du tour 3). Le parcours est donc : contrôle, puis
   * relecture. L'API du tour 4 le tient aussi : une case atteste les
   * verdicts de sa partie, et ne compte plus si un nouveau contrôle les
   * change.
   *
   * UNE PARTIE VIDE N'A RIEN À RELIRE (API du tour 4) : elle compte comme
   * relue, sans case, avec « Partie vide : rien à relire ».
   *
   * À RELIRE DE NOUVEAU (avenant du tour 5) : une partie dont la case est
   * tombée parce qu'un autre contrôle est arrivé le dit, à côté de son titre.
   *
   * LA RAISON D'UN VERDICT se lit en deux temps (`raisonLue`) : ce que dit le
   * modèle, puis les passages que le serveur a retrouvés dans les extraits,
   * en citation, chacun avec le numéro de son extrait (qui l'ouvre dans le
   * panneau). L'API les collait à la fin de la raison, « — Extrait 5 :
   * « … » », dans la même ligne que les mots du modèle.
   *
   * UNE RÈGLE « À VÉRIFIER » SE CONFIRME PHRASE PAR PHRASE (décision du
   * propriétaire du 04/11, avenant du tour 7). Une phrase qui énonce une
   * règle de droit (nature « regle ») et que le contrôle juge « non soutenue »
   * ou « hors des sources » porte un badge plein, « Règle à vérifier » ou
   * « Règle hors des sources », sa raison lisible d'emblée, et sa case « J'ai
   * vérifié cette phrase dans le texte » (44 px). POURQUOI : à l'essai réel
   * du 04/11, les dix phrases du bail qui disaient l'expulsion possible sans
   * juge avaient le même badge gris, en pointillé, que les fausses alertes ;
   * rien ne les distinguait d'une remarque sans conséquence. Une phrase qui
   * ne prête rien au droit (un fait, un conseil) garde son « À vérifier » en
   * pointillé, sans case.
   */
  import Icone from "$lib/components/Icone.svelte";
  import { citationBruteVerifiee, explicationDeCitation, sansRenvoisAuxExtraits, texteAffiche } from "$lib/data/blog";
  import type { NomIcone } from "$lib/icones";
  import { tr } from "$lib/stores/language";
  import {
    PARTIES_DE_RELECTURE,
    aConfirmer,
    groupesDePhrases,
    raisonLue,
    type PartieDeRelecture,
    type PhraseControlee,
  } from "./controle";
  import {
    nomDeCitation,
    partieRelue,
    partieVide,
    type ArticleAdmin,
    type Formulaire,
    type SourceDeGeneration,
  } from "./relecture";

  export let article: ArticleAdmin;
  export let form: Formulaire;
  /** Les parties dont la saisie change le texte enregistré (`partiesModifiees`). */
  export let modifiees: PartieDeRelecture[] = [];
  /** Le contrôle porte sur le texte enregistré (`controleAJour`). */
  export let aJour = false;
  /** Les numéros des extraits que le panneau des sources peut montrer. */
  export let sourcesConnues: number[] = [];
  /**
   * Les sources affichées : un passage cité dans une raison n'est montré comme
   * le texte d'un extrait que s'il s'y trouve (`raisonLue`).
   */
  export let sources: SourceDeGeneration[] = [];
  /** Les parties à relire de nouveau : un autre contrôle a fait tomber leur case. */
  export let aRelire: PartieDeRelecture[] = [];
  /** Pendant un envoi : les cases ne bougent pas. */
  export let desactive = false;
  export let onCocher: (partie: PartieDeRelecture, valeur: boolean) => void;
  /** « J'ai vérifié cette phrase dans le texte » : une phrase de règle confirmée, ou plus (avenant du tour 7). */
  export let onConfirmer: (id: string, valeur: boolean) => void = () => {};
  export let onMontrerSource: (n: number) => void = () => {};

  /** Les raisons ouvertes, par identifiant de phrase. */
  let raisonsOuvertes: string[] = [];

  /** Le texte de chaque extrait, par numéro. */
  $: textesDesSources = new Map(sources.map((s) => [s.n, s.extrait]));

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
   * Une règle à confirmer : badge plein et carte au trait épais, jamais le
   * pointillé d'une simple remarque (le rouge reste aux phrases contredites).
   */
  const BADGE_REGLE = "border-zinc-950 bg-zinc-950 font-semibold text-white dark:border-white dark:bg-white dark:text-zinc-950";
  const CARTE_REGLE = "border-2 border-zinc-950 dark:border-white";

  /**
   * Libellé, extraits, icône et couleurs d'un verdict. Noir et blanc, sauf
   * « contredite » : le rouge est réservé aux erreurs, et c'en est une.
   */
  function vueDuVerdict(phrase: PhraseControlee, t: (cle: string) => string): VueDuVerdict {
    const n = phrase.extraits;
    const parNombre = (cle: string) => t(n.length === 0 ? cle : n.length === 1 ? `${cle}Un` : `${cle}Plusieurs`);
    if (aConfirmer(phrase)) {
      const horsSources = phrase.verdict === "hors_sources";
      return {
        libelle: t(horsSources ? "admin.blog.verdict.regle_hors_sources" : "admin.blog.verdict.regle_non_soutenue"),
        numeros: [],
        icone: horsSources ? "link-2-off" : "triangle-alert",
        badge: BADGE_REGLE,
        carte: CARTE_REGLE,
      };
    }
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
    if (partie === "titre") return f.titre;
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
  {#if !aJour}
    <!-- Sans contrôle à jour, aucune case ne se coche : la relecture se fait
         avec les verdicts. Chaque case bloquée renvoie à cette phrase. -->
    <p
      id="relecture-attend-le-controle"
      class="flex items-start gap-2 rounded-xl border border-dashed border-zinc-400 px-3 py-2 text-xs font-medium text-zinc-800 dark:border-zinc-500 dark:text-zinc-200"
      data-testid="blog-relecture-attend"
    >
      <Icone nom="circle-dashed" class="mt-px shrink-0 text-sm" />
      {$tr("admin.blog.reviewNeedsCheck")}
    </p>
  {/if}
  {#each PARTIES_DE_RELECTURE as partie (partie)}
    {@const modifiee = modifiees.includes(partie)}
    {@const avecVerdicts = aJour && !modifiee}
    {@const groupes = avecVerdicts ? groupesDePhrases(article.controleIa, partie, elementsDe(partie)) : []}
    {@const caseBloquee = modifiee || !aJour || desactive}
    {@const rienARelire = !modifiee && partieVide(form, partie)}
    <section class="space-y-3" aria-labelledby="partie-{partie}" data-testid="blog-partie-{partie}">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 id="partie-{partie}" class="text-base font-bold text-zinc-950 dark:text-white">
          {$tr(`admin.blog.part.${partie}`)}
        </h3>
        {#if modifiee}
          <span class="inline-flex items-center gap-1 rounded-full border border-dashed border-zinc-400 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:border-zinc-500 dark:text-zinc-300">
            <Icone nom="pen-line" class="text-sm" />{$tr("admin.blog.check.modified")}
          </span>
        {:else}
          <!-- Les deux peuvent valoir ensemble : un contrôle effacé avec les
               sources laisse la partie à relire, et non contrôlée. -->
          <span class="flex flex-wrap items-center gap-2">
            {#if aRelire.includes(partie)}
              <span
                id="a-relire-{partie}"
                class="inline-flex items-center gap-1 rounded-full border-2 border-zinc-950 px-2 py-0.5 text-xs font-semibold text-zinc-950 dark:border-white dark:text-white"
                data-testid="blog-a-relire-{partie}"
              >
                <Icone nom="eye" class="text-sm" />{$tr("admin.blog.reread.badge")}
              </span>
            {/if}
            {#if !rienARelire && (!avecVerdicts || groupes.length === 0)}
              <span class="inline-flex items-center gap-1 rounded-full border border-dashed border-zinc-400 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:border-zinc-500 dark:text-zinc-300">
                <Icone nom="circle-dashed" class="text-sm" />{$tr("admin.blog.check.notChecked")}
              </span>
            {/if}
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
                {@const regle = aConfirmer(phrase)}
                <!-- La raison d'une règle à confirmer se lit d'emblée : on la
                     confirme en connaissance de cause. -->
                {@const ouverte = regle || raisonsOuvertes.includes(phrase.id)}
                <li
                  class="rounded-xl border p-3 {vue.carte}"
                  data-testid="blog-phrase"
                  data-verdict={phrase.verdict}
                  data-nature={phrase.nature}
                  data-a-confirmer={regle ? "true" : undefined}
                >
                  <p class="text-sm leading-relaxed text-zinc-900 dark:text-zinc-100 {partie === 'titre' ? 'font-semibold' : ''}">
                    {propre(phrase.texte)}
                  </p>
                  <div class="mt-1 flex flex-wrap items-center gap-x-2">
                    <span
                      id="verdict-{phrase.id}"
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
                    {#if phrase.raison && !regle}
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
                    {@const raison = raisonLue(phrase.raison, textesDesSources)}
                    <div
                      id="raison-{phrase.id}"
                      class="mt-1 space-y-1.5 leading-relaxed {regle
                        ? 'text-sm text-zinc-800 dark:text-zinc-200'
                        : 'text-xs text-zinc-700 dark:text-zinc-300'}"
                      hidden={!ouverte}
                      data-testid="blog-raison"
                    >
                      {#if regle}<p class="text-xs font-semibold text-zinc-950 dark:text-white">{$tr("admin.blog.verdict.reason")}</p>{/if}
                      {#if raison.texte}<p class="coupe-mots">{raison.texte}</p>{/if}
                      <!-- Les passages retrouvés dans les extraits : le texte de
                           l'extrait, en citation, et son numéro. -->
                      {#each raison.passages as passage, i (i)}
                        <figure class="space-y-0.5" data-testid="blog-passage-cite">
                          <blockquote class="coupe-mots border-l-2 border-zinc-300 pl-2 text-zinc-800 dark:border-zinc-600 dark:text-zinc-200">
                            « {passage.texte} »
                          </blockquote>
                          <figcaption class="pl-2 text-zinc-600 dark:text-zinc-400">
                            —&nbsp;{#if sourcesConnues.includes(passage.n)}<button
                                type="button"
                                class="min-h-6 rounded px-0.5 font-semibold underline underline-offset-2 hover:no-underline"
                                aria-label={$tr("admin.blog.verdict.showSource").replace("{n}", String(passage.n))}
                                on:click={() => onMontrerSource(passage.n)}
                                >{$tr("admin.blog.verdict.extract").replace("{n}", String(passage.n))}</button
                              >{:else}{$tr("admin.blog.verdict.extract").replace("{n}", String(passage.n))}{/if}
                          </figcaption>
                        </figure>
                      {/each}
                    </div>
                  {/if}
                  {#if regle}
                    <!-- Confirmer une règle, une à une, au doigt (44 px) : la
                         raison, l'aide et le verdict sont lus avec la case. -->
                    <p id="aide-confirmation-{phrase.id}" class="mt-2 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                      {$tr("admin.blog.confirmPhraseHelp")}
                    </p>
                    <label
                      class="mt-2 flex min-h-11 items-center gap-3 rounded-xl border-2 border-zinc-950 px-3 py-2 text-sm font-semibold text-zinc-950 dark:border-white dark:text-white {desactive
                        ? 'opacity-60'
                        : 'cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800'}"
                    >
                      <input
                        type="checkbox"
                        class="h-5 w-5 shrink-0 accent-zinc-950 dark:accent-white"
                        checked={form.confirmees.includes(phrase.id)}
                        disabled={desactive}
                        aria-describedby="verdict-{phrase.id}{phrase.raison ? ` raison-${phrase.id}` : ''} aide-confirmation-{phrase.id}"
                        data-testid="blog-confirmer-{phrase.id}"
                        on:change={(e) => onConfirmer(phrase.id, e.currentTarget.checked)}
                      />
                      <span>{$tr("admin.blog.confirmPhrase")}</span>
                    </label>
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
          <!-- Le titre se lit comme un titre : c'est ainsi que le public le verra. -->
          <p
            class="whitespace-pre-line leading-relaxed text-zinc-800 dark:text-zinc-200 {partie === 'titre'
              ? 'text-base font-semibold text-zinc-950 dark:text-white'
              : 'text-sm'}"
          >
            {propre(texte)}
          </p>
        {:else}
          <p class="text-sm text-zinc-500 dark:text-zinc-400">{$tr("admin.blog.part.empty")}</p>
        {/if}
      {/if}

      <!-- La relecture humaine, obligatoire pour publier. Une case par partie,
           au doigt (44 px) ; bloquée pendant un envoi, pour une partie
           modifiée (sa relecture portait sur l'ancien texte), et tant que le
           contrôle n'est pas à jour (la relecture se fait avec ses verdicts).
           Une partie vide n'en a pas : rien à y relire, elle compte comme
           relue (`partieRelue`). -->
      {#if rienARelire}
        <p
          class="flex min-h-11 items-center gap-3 rounded-xl border border-dashed border-zinc-300 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-600 dark:text-zinc-300"
          data-testid="blog-rien-a-relire-{partie}"
        >
          <Icone nom="circle-check" class="shrink-0 text-base" />
          {$tr("admin.blog.reviewNothing")}
        </p>
      {:else}
        <label
          class="flex min-h-11 items-center gap-3 rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-900 dark:border-zinc-600 dark:text-zinc-100 {caseBloquee
            ? 'opacity-60'
            : 'cursor-pointer hover:border-zinc-950 dark:hover:border-zinc-300'}"
        >
          <input
            type="checkbox"
            class="h-5 w-5 shrink-0 accent-zinc-950 dark:accent-white"
            checked={partieRelue(form, partie, modifiees)}
            disabled={caseBloquee}
            aria-describedby={modifiee
              ? `partie-${partie} relecture-${partie}-aide`
              : !aJour
                ? `partie-${partie} relecture-attend-le-controle`
                : aRelire.includes(partie)
                  ? `partie-${partie} a-relire-${partie}`
                  : `partie-${partie}`}
            data-testid="blog-case-{partie}"
            on:change={(e) => onCocher(partie, e.currentTarget.checked)}
          />
          <span>{$tr("admin.blog.reviewed")}</span>
        </label>
      {/if}
      {#if modifiee}
        <p id="relecture-{partie}-aide" class="text-xs text-zinc-600 dark:text-zinc-400">{$tr("admin.blog.reviewedModified")}</p>
      {/if}
    </section>
  {/each}
</div>
