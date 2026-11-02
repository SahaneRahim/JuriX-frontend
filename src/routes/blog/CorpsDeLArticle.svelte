<script lang="ts">
  /**
   * Le corps d'un article du blog : le contexte, l'analyse (résumé, points
   * clés, textes cités) et ce que cela change pour le lecteur.
   *
   * POURQUOI UN COMPOSANT. La page publique (blog/[slug]) et l'aperçu de
   * l'administration (admin/blog) montrent le même article. L'aperçu d'avant
   * était écrit à part : il affichait la cote interne (« PRC-4722 »), « Art. ? »
   * et coupait chaque extrait à 150 caractères, si bien que l'administrateur
   * ne relisait pas ce que le public allait lire (revue du 29/10). Un seul
   * rendu : la relecture porte sur la page réelle.
   *
   * `apercu` (administration) ajoute ce qui sert à la relecture : chaque
   * citation vérifiée le dit, et ses liens s'ouvrent dans un nouvel onglet
   * (dans la fenêtre de relecture, un lien ordinaire quitterait la page et
   * perdrait les modifications en cours).
   *
   * CITATION NON VÉRIFIÉE (contrat du 30/10, revue croisée du 29/10). Les
   * articles publiés avant le contrat portent des extraits écrits par le
   * modèle, que cette page montrait entre guillemets, avec un lien vers
   * l'article : « trois mois à trois ans » pour l'article 299 du Code pénal,
   * qui dit « dix (10) jours à un (01) an ». Une telle citation s'affiche
   * désormais « Citation non vérifiée », avec son texte et son numéro EN
   * CLAIR, sans lien, sans extrait et sans explication, ici comme dans
   * l'aperçu de l'administration ; un encart en tête de l'article le dit au
   * lecteur. Rien ne la distingue plus par la seule police (l'extrait non
   * vérifié était en italique, à côté des vrais).
   */
  import Icone from "$lib/components/Icone.svelte";
  import {
    articleNomme,
    citationsNonVerifiees,
    lienDeCitation,
    referenceAffichable,
    texteAffiche,
    titreDeCitation,
    type BlogCitation,
    type BlogPost,
  } from "$lib/data/blog";
  import { tr } from "$lib/stores/language";

  export let post: BlogPost;
  /** Aperçu de l'administration : citations marquées, liens en nouvel onglet. */
  export let apercu = false;
  /**
   * Décalage des niveaux de titre. 0 sur la page publique (h2 à h4, sous le
   * h1 de l'article) ; 1 dans la fenêtre de l'administration, dont le titre
   * est un h2 (h3 à h5).
   */
  export let decalage = 0;
  /** Préfixe des identifiants (repères des citations), unique dans la page. */
  export let prefixe = "citation";

  const niveau = (n: number) => `h${Math.min(6, n + decalage)}`;

  // Champs lus défensivement : l'aperçu reçoit aussi un article en cours de
  // saisie, et une forme inattendue ne doit pas faire planter le rendu.
  $: analyse = post?.botAnalysis ?? { summary: "", keyPoints: [], citations: [], citizenImpact: "" };
  $: pointsCles = Array.isArray(analyse.keyPoints) ? analyse.keyPoints : [];
  $: citations = Array.isArray(analyse.citations) ? analyse.citations : [];
  $: nonVerifiees = citationsNonVerifiees(post);

  /**
   * Ce qu'une carte de citation affiche : son intitulé (sans cote), et ses
   * repères, « Article 299 · Code pénal (loi n° 2016/007) ». La cote interne
   * (« PRC-4722 ») n'apparaît nulle part (P2). Sans intitulé, la citation se
   * nomme par son article.
   *
   * Non vérifiée : ni intitulé (l'explication du modèle), ni lien ; ses
   * repères seuls, en clair, sous « Citation non vérifiée ».
   *
   * La suite d'un article se dit « Article 39 (suite) » (`articleNomme`) :
   * son extrait commence au milieu de l'article, par « […] ».
   */
  function vueDeCitation(citation: BlogCitation, t: (cle: string) => string) {
    const verifiee = citation?.verifie === true;
    const article = articleNomme(citation, t);
    const titre = verifiee ? titreDeCitation(citation) || article : t("blog.unverifiedCitation");
    // Espace insécable avant le point, comme les repères des listes (P11) :
    // à la coupure, le point finit la ligne au lieu d'ouvrir la suivante.
    const reperes = [titre === article ? "" : article, referenceAffichable(citation) ?? ""]
      .filter(Boolean)
      .join("\u00a0· ");
    return { verifiee, titre, reperes, adresse: lienDeCitation(citation) };
  }

  /**
   * Le lien d'une carte de citation (Q3 A, comme les cartes de /blog et la
   * liste des domaines de l'accueil) : posé sur l'intitulé, étendu à la carte
   * par son `::after`, contour de focus autour de la carte. Il vise l'ARTICLE
   * cité (`?article=N`, P2), non le début du texte.
   */
  const LIEN_ETENDU =
    "after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-zinc-950 dark:focus-visible:after:outline-white";
</script>

<!-- Un article dont une citation n'est pas vérifiée le dit AVANT d'être lu :
     la carte « Citation non vérifiée » n'arrive qu'en bas de l'analyse, après
     des règles que le lecteur aurait déjà prises pour celles du texte. Noir et
     blanc (le rouge est réservé aux erreurs) : bordure épaisse en tirets,
     comme les badges « non vérifié », et l'icône d'alerte. -->
{#if nonVerifiees > 0}
  <div
    role="note"
    data-testid="blog-avis-non-verifie"
    class="flex gap-3 rounded-2xl border-2 border-dashed border-zinc-400 bg-white p-4 text-sm text-zinc-800 dark:border-zinc-500 dark:bg-zinc-900 dark:text-zinc-200 sm:p-5"
  >
    <Icone nom="triangle-alert" class="mt-0.5 shrink-0 text-lg" />
    <p class="max-w-[34em] leading-relaxed">
      <strong class="font-semibold text-zinc-950 dark:text-white">{$tr("blog.unverifiedNoticeTitle")}</strong>
      {$tr("blog.unverifiedNotice")}
    </p>
  </div>
{/if}

<!-- BLOC 1 : L'Actualité en 2 minutes (Le contexte).
     Surtitre du guide (§ 4.2, comme « Corpus juridique officiel » à
     l'accueil), et non plus en gras noir : il annonçait le bloc plus
     fort que son texte. Sur cet encart gris, zinc-600 et non zinc-500
     (4,5:1 manqué de peu sur zinc-100, guide § 3).
     En sombre, l'encart prend zinc-800 à 70 % : posé sur la page et non
     dans une carte, le zinc-800/50 des blocs internes y rendrait
     exactement le zinc-900 des cartes, et la hiérarchie s'aplatissait
     comme avant. À 70 %, il répond au zinc-100/70 du thème clair.
     Bordure fine sur les quatre côtés et rayon des cartes, comme
     l'encart « Ce que cela change » plus bas (recette « bloc » du
     guide, § 4.1).
     Icône des titres alignée sur la PREMIÈRE ligne (`items-start`) :
     centrée (`items-center`), elle tombait entre les deux lignes d'un
     titre replié au téléphone.
     Surtitre en Inter, dans sa casse (Q5 A : deux voix au plus). 14 px
     sur une ligne de 20 : `mt-px` garde l'icône de 18 px au milieu de la
     première ligne.
     `whitespace-pre-line` sur les textes du modèle : ses listes (« 1. …
     2. … ») et ses paragraphes gardent leurs retours à la ligne, au lieu
     de s'écraser en un seul bloc (run réel du 29/10). -->
<section class="bg-zinc-100/70 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700/60 rounded-2xl p-6 sm:p-8 space-y-3">
  <div class="flex items-start gap-2 text-sm font-semibold text-zinc-600 dark:text-zinc-400">
    <Icone nom="newspaper" class="mt-px text-lg" />
    <span>{$tr("blog.contextTitle")}</span>
  </div>
  <p class="max-w-[34em] whitespace-pre-line text-base sm:text-lg text-zinc-800 dark:text-zinc-200 leading-relaxed font-normal">{texteAffiche(post.context)}</p>
</section>

<!-- BLOC 2 : Ce que dit la loi — L'Analyse du Bot -->
<section class="space-y-8">
  <div class="space-y-3">
    <!-- Même surtitre que le bloc 1, en Inter ; zinc-500 sur le fond
         de page (4,6:1). -->
    <div class="flex items-start gap-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
      <Icone nom="gavel" class="mt-px text-lg" />
      <span>{$tr("blog.lawTitle")}</span>
    </div>
    <!-- Titre de section du guide (§ 4.2) : gras, et non extra-gras. -->
    <svelte:element this={niveau(2)} class="text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-white tracking-tight">
      {$tr("blog.explanationTitle")}
    </svelte:element>
    <p class="max-w-[34em] whitespace-pre-line text-base sm:text-lg text-zinc-600 dark:text-zinc-300 leading-relaxed font-normal">{texteAffiche(analyse.summary)}</p>
  </div>

  <!-- Points clés à retenir. Les trois titres de ce bloc (règles, textes
       de loi, ce que cela change) portent une icône de 20 px (text-xl).
       La puce « • » est dans la boîte de ligne du texte, sans marge.
       Icônes des titres sur la première ligne (`items-start`, voir le
       bloc 1). -->
  {#if pointsCles.length > 0}
    <div class="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-4 shadow-sm dark:shadow-none">
      <svelte:element this={niveau(3)} class="text-base sm:text-lg font-bold text-zinc-950 dark:text-white flex items-start gap-2">
        <Icone nom="check" class="mt-0.5 sm:mt-1 text-xl text-zinc-950 dark:text-zinc-100" />
        <span>{$tr("blog.keyPoints")}</span>
      </svelte:element>
      <ul class="max-w-[34em] space-y-3">
        {#each pointsCles as point, i (i)}
          <li class="flex items-start gap-3 text-zinc-700 dark:text-zinc-300 text-sm sm:text-base leading-relaxed">
            <span class="text-zinc-950 dark:text-zinc-100 font-bold" aria-hidden="true">•</span>
            <span>{texteAffiche(point)}</span>
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  <!-- Textes et articles de lois cités -->
  {#if citations.length > 0}
    <div class="space-y-4">
      <svelte:element this={niveau(3)} class="text-lg sm:text-xl font-bold text-zinc-950 dark:text-white flex items-start gap-2">
        <Icone nom="file-text" class="mt-1 text-xl text-zinc-950 dark:text-zinc-100" />
        <span>{$tr("blog.citationsTitle")}</span>
      </svelte:element>

      <!-- Une liste de cartes (Q3 A) : l'intitulé de chaque citation
           VÉRIFIÉE est son lien, étendu à la carte (`LIEN_ETENDU`) ; une
           flèche décorative dit l'action. Repères en Inter, sans la cote
           interne (`vueDeCitation`, P2). L'extrait vérifié mot pour mot dans
           la base est dans la police du texte officiel (Q5).
           Une citation NON VÉRIFIÉE a sa propre carte, bordée de tirets :
           « Citation non vérifiée », puis son texte et son numéro en clair.
           Ni lien, ni extrait, ni explication (contrat du 30/10) : rien n'y
           ressemble plus à une citation vérifiée. -->
      <ul class="grid grid-cols-1 gap-4">
        {#each citations as citation, i (i)}
          {@const vue = vueDeCitation(citation, $tr)}
          {#if vue.verifiee}
            <li
              class="group relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 space-y-2 shadow-sm dark:shadow-none {vue.adresse
                ? 'transition-colors hover:border-zinc-950 dark:hover:border-zinc-400'
                : ''}"
            >
              <div class="flex items-start justify-between gap-3">
                <svelte:element this={niveau(4)} class="coupe-mots font-bold text-zinc-950 dark:text-white text-base">
                  {#if vue.adresse}
                    <a
                      href={vue.adresse}
                      target={apercu ? "_blank" : undefined}
                      rel={apercu ? "noopener" : undefined}
                      aria-describedby={vue.reperes ? `${prefixe}-${i}-reperes` : undefined}
                      class={LIEN_ETENDU}>{texteAffiche(vue.titre)}</a
                    >
                  {:else}
                    {texteAffiche(vue.titre)}
                  {/if}
                </svelte:element>
                {#if vue.adresse}
                  <Icone
                    nom={apercu ? "external-link" : "arrow-right"}
                    class="mt-0.5 shrink-0 text-lg text-zinc-500 dark:text-zinc-400 transition-colors group-hover:text-zinc-950 dark:group-hover:text-white"
                  />
                {/if}
              </div>

              <!-- `coupe-mots` : un nom de texte sans espace où passer à
                   la ligne sur un écran étroit. -->
              {#if vue.reperes}
                <p id="{prefixe}-{i}-reperes" class="coupe-mots text-xs text-zinc-500 dark:text-zinc-400">
                  {vue.reperes}
                </p>
              {/if}

              <!-- Relecture : la vérification dite en toutes lettres (et non
                   par la seule police). Inversé, la recette des badges de
                   statut (StatusBadge). -->
              {#if apercu}
                <p>
                  <span
                    data-testid="citation-verification"
                    class="inline-flex items-center gap-1 rounded-full border border-zinc-950 bg-zinc-950 px-2 py-0.5 text-xs font-medium text-white dark:border-white dark:bg-white dark:text-zinc-950"
                  >
                    <Icone nom="check" class="text-sm" />
                    {$tr("admin.blog.citationVerified")}
                  </span>
                </p>
              {/if}

              <!-- Mesure de lecture de l'article (34em). -->
              {#if citation.excerpt}
                <blockquote
                  class="max-w-[34em] pt-1 text-sm text-zinc-600 dark:text-zinc-400 pl-4 border-l-2 border-zinc-300 dark:border-zinc-700 leading-relaxed font-normal font-texte"
                >
                  {texteAffiche(`« ${citation.excerpt} »`)}
                </blockquote>
              {/if}
            </li>
          {:else}
            <!-- Fond de page et non blanc, sans ombre : la carte ne se donne
                 pas l'air des citations vérifiées, et rien n'y est cliquable. -->
            <li
              class="rounded-2xl border border-dashed border-zinc-400 p-5 sm:p-6 space-y-1 dark:border-zinc-600"
              data-testid="citation-non-verifiee"
            >
              <svelte:element this={niveau(4)} class="flex items-start gap-2 font-bold text-zinc-950 dark:text-white text-base">
                <Icone nom="triangle-alert" class="mt-0.5 shrink-0 text-lg" />
                <span>{vue.titre}</span>
              </svelte:element>
              {#if vue.reperes}
                <p class="coupe-mots text-xs text-zinc-600 dark:text-zinc-400">{vue.reperes}</p>
              {/if}
            </li>
          {/if}
        {/each}
      </ul>
    </div>
  {/if}

  <!-- Ce que cela change pour vous. Encart teinté : en sombre, zinc-800
       à 70 % et la bordure des blocs internes (guide § 4.1), pour qu'il
       se distingue des cartes zinc-900 qui l'entourent (voir le bloc 1). -->
  {#if analyse.citizenImpact}
    <div class="bg-zinc-100/70 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700/60 rounded-2xl p-6 sm:p-8 space-y-2">
      <svelte:element this={niveau(3)} class="text-base sm:text-lg font-bold text-zinc-950 dark:text-zinc-100 flex items-start gap-2">
        <Icone nom="sparkles" class="mt-0.5 sm:mt-1 text-xl text-zinc-950 dark:text-zinc-100" />
        <span>{$tr("blog.impactTitle")}</span>
      </svelte:element>
      <p class="max-w-[34em] whitespace-pre-line text-sm sm:text-base text-zinc-700 dark:text-zinc-300 leading-relaxed font-normal">{texteAffiche(analyse.citizenImpact)}</p>
    </div>
  {/if}
</section>
