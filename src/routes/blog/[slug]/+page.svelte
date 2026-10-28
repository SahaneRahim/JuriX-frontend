<script lang="ts">
  import { page } from "$app/stores";
  import Icone from "$lib/components/Icone.svelte";
  import MetaSeo from "$lib/components/MetaSeo.svelte";
  import { urlCanonique } from "$lib/seo";
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import SiteHeader from "$lib/components/SiteHeader.svelte";
  import { nomRubrique, type BlogPost } from "$lib/data/blog";
  import { formatDate } from "$lib/format";
  import { language, tr } from "$lib/stores/language";

  export let data: { post: BlogPost };
  $: post = data.post;

  // Rubrique dans la langue de l'interface : l'API la donne en français
  // (« Immobilier & Logement »), et l'interface anglaise l'affichait telle
  // quelle dans le fil d'Ariane et le badge.
  $: rubrique = nomRubrique(post.category, $language.current);

  // Le chapô n'est affiché que s'il apporte un texte à lui. L'API n'a pas de
  // champ « excerpt » : le chargeur le remplit avec le résumé de l'analyse,
  // que la section 2 affiche à moins d'un écran plus bas (le même paragraphe,
  // mot pour mot, deux fois), ou à défaut avec le début du contexte, qui ouvre
  // la section 1. Les articles écrits à la main (BLOG_POSTS) ont un chapô
  // propre, qui reste. `excerpt` sert toujours de description (MetaSeo).
  $: chapo = chapoPropre(post);

  function chapoPropre(article: BlogPost): string {
    const extrait = (article.excerpt ?? "").trim();
    const debut = extrait.replace(/(\.\.\.|…)$/, "").trim();
    if (!debut) return "";
    if (extrait === (article.botAnalysis?.summary ?? "").trim()) return "";
    if ((article.context ?? "").trim().startsWith(debut)) return "";
    return extrait;
  }

  // La date suit la langue de l'interface, par la mise en forme commune du
  // site ($lib/format) : `formattedDate`, préparée par +page.ts, est écrite en
  // français (« fr-FR » en dur) et le restait dans l'interface anglaise.
  $: datePubliee = post.date ? formatDate(post.date, $language.current) : $tr("blog.recently");

  // Typographie française, posée à l'affichage. L'article vient de l'API, et
  // les chaînes de l'interface, avec des espaces ordinaires devant « ? ! : ; »,
  // autour des guillemets et dans les nombres : le navigateur coupait la ligne
  // entre un mot et sa ponctuation (« …ou le courant / ? » dans le titre à
  // 740 px, « une « / voie de fait » » dans les règles). L'espace fine
  // insécable (U+202F) les soude. Seules les espaces déjà présentes changent :
  // une phrase anglaise (« situation? ») reste telle quelle. Les métadonnées
  // (MetaSeo) et le message de partage gardent le texte d'origine. Même
  // fonction dans blog/+page.svelte : sa place serait $lib/format.ts.
  function insecables(texte: string | null | undefined): string {
    return (texte ?? "")
      .replace(/[ \u00A0]+(?=[?!:;»])/g, "\u202F")
      .replace(/«[ \u00A0]+/g, "«\u202F")
      .replace(/(\d)[ \u00A0](?=\d{3}(?!\d))/g, "$1\u202F")
      // Inversion du sujet (« a-t-il », « peut-on ») : trait d'union
      // insécable (U+2011). Le navigateur coupait la ligne après « a- », et
      // « t-il » ouvrait la ligne suivante (titre de l'article à 1 440 px,
      // dans sa colonne de 768 px).
      .replace(/-t-(il|elle|on|ils|elles)(?![\p{L}])/gu, "\u2011t\u2011$1")
      .replace(/(\p{L})-(il|elle|on|ils|elles|je|tu|nous|vous)(?![\p{L}])/gu, "$1\u2011$2");
  }

  let lienCopie = false;
  let minuterieCopie: ReturnType<typeof setTimeout>;

  function copierLien() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      lienCopie = true;
      clearTimeout(minuterieCopie);
      minuterieCopie = setTimeout(() => {
        lienCopie = false;
      }, 3000);
    }
  }

  $: urlActuelle = typeof window !== "undefined" ? window.location.href : `https://jurix.cm/blog/${post.slug}`;
  $: messagePartage = encodeURIComponent(`${post.title}\n\n${$tr("blog.shareMessage")}\n${urlActuelle}`);
  $: urlWhatsApp = `https://api.whatsapp.com/send?text=${messagePartage}`;
  $: urlTwitter = `https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(urlActuelle)}`;
  $: urlLinkedIn = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(urlActuelle)}`;
  $: urlChatAvecQuestion = `/chat?q=${encodeURIComponent(post.suggestedChatQuestion)}`;
</script>

<MetaSeo
  titre={`${post.title} — ${$tr("blog.metaSuffix")}`}
  description={post.excerpt}
  canonique={urlCanonique($page.url)}
/>

<SiteHeader />

<main id="contenu" class="px-zone-sure">
  <div class="min-h-app bg-background-light dark:bg-background-dark py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-3xl mx-auto space-y-10 sm:space-y-12">
      <!-- Fil d'Ariane. Les barres obliques sont muettes : lues à voix haute,
           elles s'intercalaient entre chaque lien. Liens de 44 × 44 px au
           moins, à toutes les largeurs (16 px de haut, et 25 de large pour
           « Blog », auparavant ; 20 px sur tablette, qui se touche aussi au
           doigt) : la marge intérieure élargit la zone d'appui, la marge
           négative garde le texte à sa place. À partir de sm, une marge
           négative verticale rend au fil la hauteur de son texte : la zone
           d'appui déborde dans l'espace libre au-dessus et au-dessous. -->
      <nav aria-label={$tr("blog.breadcrumb")} class="flex items-center gap-2 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
        <a href="/" class="-mx-2.5 inline-flex min-h-11 items-center px-2.5 hover:text-zinc-950 dark:hover:text-white transition-colors sm:-my-3">{$tr("nav.home")}</a>
        <span aria-hidden="true">/</span>
        <a href="/blog" class="-mx-2.5 inline-flex min-h-11 items-center px-2.5 hover:text-zinc-950 dark:hover:text-white transition-colors sm:-my-3">{$tr("nav.blog")}</a>
        <span aria-hidden="true">/</span>
        <span class="text-zinc-800 dark:text-zinc-200 truncate font-medium">{rubrique}</span>
      </nav>

      <!-- En-tête de l'article. La rubrique est le badge du guide (§ 4.8),
           en Inter et dans sa casse, comme sur les cartes du blog : elle était
           ici en capitales espacées, en police mono.

           Mesure de lecture : chapeau, paragraphes, listes et citations
           s'arrêtent à 34em, soit 63 à 73 caractères par ligne en Inter
           (mesuré sur l'article, de 14 à 20 px). Dans les 896 px de
           l'ancienne colonne (max-w-4xl), ils en comptaient 90 à 105.
           `max-w-prose` (65ch) n'y suffit pas : le « 0 » qui définit `ch`
           fait 0,62em en Inter, et 65ch laissaient encore 80 à 90
           caractères. La colonne est passée à 768 px (max-w-3xl) : dans
           896 px, les encarts et les cartes, pleine largeur, gardaient un
           tiers droit vide à côté de leur texte de 34em, comme une colonne
           fantôme (290 px sur 832 en 1 440). -->
      <header class="space-y-5">
        <div class="flex flex-wrap items-center gap-3">
          <span
            class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
          >
            {rubrique}
          </span>
          <span class="text-xs text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">
            {datePubliee} • {post.readingTime} {$tr("blog.reading")}
          </span>
        </div>

        <!-- Sans `text-balance` : en équilibrant, le navigateur coupait
             « a-t-il » à son trait d'union (« a- / t-il » à 390 et 640 px).
             L'espace insécable suffit à garder le « ? » avec son mot.
             Titre de page du guide (§ 4.2), comme /about et /blog : en
             48 px extra-gras, l'échelle changeait d'une page à l'autre.
             Interligne posé AVEC la taille (`text-4xl/tight`) : `sm:text-5xl`
             apportait son interligne de 1, écrit dans la requête sm donc après
             `leading-tight`, qui ne valait plus qu'au téléphone ; il ne
             restait qu'un pixel entre le jambage du « g » et les accents de
             la ligne suivante. -->
        <h1 class="text-3xl/tight sm:text-4xl/tight font-bold tracking-tight text-zinc-950 dark:text-white">
          {insecables(post.title)}
        </h1>

        <!-- Chapô, seulement s'il dit autre chose que l'article (`chapo`). -->
        {#if chapo}
          <p class="max-w-[34em] text-lg sm:text-xl text-zinc-600 dark:text-zinc-400 leading-relaxed font-normal">
            {insecables(chapo)}
          </p>
        {/if}

        <!-- Barre de partage rapide -->
        <div class="pt-2 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
          <div class="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 font-mono">
            <Icone nom="bot" class="text-base text-zinc-950 dark:text-white" />
            <span>{$tr("blog.writtenWith")} <strong>{$tr("blog.aiName")}</strong></span>
          </div>

          <!-- Logos de WhatsApp, LinkedIn et X dessinés ici : Lucide ne fournit
               aucun logo de marque. Monochromes (currentColor, sans la couleur
               des marques) et muets : le nom du réseau est dans le texte du
               lien, et dans son `title` sous sm, où ce texte est masqué.
               Cibles de 44 px, d'où le retour à la ligne : à 320 px, les
               quatre ne tiennent plus sur une seule.
               WhatsApp : le logo entier (bulle et combiné, dessin de Simple
               Icons, domaine public), qui occupe toute la boîte de 24 comme
               ses voisins. L'ancien tracé n'en gardait que l'intérieur, de 6 à
               18 : un point de 8 px à côté des 16 px de LinkedIn et de X, seul
               signe du premier bouton au téléphone, où les libellés sont
               masqués. -->
          <div class="flex flex-wrap items-center gap-2">
            <a
              href={urlWhatsApp}
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-800 transition-colors hover:border-zinc-950 hover:text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-200 dark:hover:text-white"
              title={$tr("blog.shareWhatsApp")}
            >
              <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
              <span class="hidden sm:inline">WhatsApp</span>
            </a>
            <a
              href={urlLinkedIn}
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-800 transition-colors hover:border-zinc-950 hover:text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-200 dark:hover:text-white"
              title={$tr("blog.shareLinkedIn")}
            >
              <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
              <span class="hidden sm:inline">LinkedIn</span>
            </a>
            <a
              href={urlTwitter}
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-800 transition-colors hover:border-zinc-950 hover:text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-200 dark:hover:text-white"
              title={$tr("blog.shareX")}
            >
              <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              <span class="hidden sm:inline">X</span>
            </a>
            <button
              on:click={copierLien}
              class="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-800 transition-colors hover:border-zinc-950 hover:text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-200 dark:hover:text-white"
              title={$tr("blog.copyLink")}
            >
              <Icone nom={lienCopie ? "check" : "link"} class="text-base" />
              <span>{lienCopie ? $tr("blog.copied") : $tr("blog.copyLink")}</span>
            </button>
          </div>
        </div>
      </header>

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
           guide, § 4.1) : la barre gauche pleine de 4 px, noire, aux angles
           gauches carrés, n'existait nulle part ailleurs ; c'était l'ancienne
           barre bleue recolorée.
           Icône des titres alignée sur la PREMIÈRE ligne (`items-start`) :
           centrée (`items-center`), elle tombait entre les deux lignes d'un
           titre replié au téléphone (« …en 2 minutes (le / contexte) »).
           `-mt-px` : l'icône de 18 px sur une ligne de 16 px garde le même
           milieu que le texte. -->
      <section class="bg-zinc-100/70 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700/60 rounded-2xl p-6 sm:p-8 space-y-3">
        <div class="flex items-start gap-2 text-xs font-mono font-semibold uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
          <Icone nom="newspaper" class="-mt-px text-lg" />
          <span>{$tr("blog.contextTitle")}</span>
        </div>
        <p class="max-w-[34em] text-base sm:text-lg text-zinc-800 dark:text-zinc-200 leading-relaxed font-normal">
          {insecables(post.context)}
        </p>
      </section>

      <!-- BLOC 2 : Ce que dit la loi — L'Analyse du Bot -->
      <section class="space-y-8">
        <div class="space-y-3">
          <div class="flex items-start gap-2 text-xs font-mono font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            <Icone nom="gavel" class="-mt-px text-lg" />
            <span>{$tr("blog.lawTitle")}</span>
          </div>
          <!-- Titre de section du guide (§ 4.2) : gras, et non extra-gras. -->
          <h2 class="text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-white tracking-tight">
            {$tr("blog.explanationTitle")}
          </h2>
          <p class="max-w-[34em] text-base sm:text-lg text-zinc-600 dark:text-zinc-300 leading-relaxed font-normal">
            {insecables(post.botAnalysis.summary)}
          </p>
        </div>

        <!-- Points clés à retenir. Les trois titres de ce bloc (règles, textes
             de loi, ce que cela change) portent une icône de 20 px (text-xl) :
             elles faisaient 18, 24 et 24 px pour des titres de 18 à 20 px.
             La puce « • » est dans la boîte de ligne du texte, sans marge :
             le `mt-0.5` la descendait de 2 px sous le milieu de la hauteur
             d'x (mesuré en Inter, à 14 et 16 px).
             Icônes des titres sur la première ligne (`items-start`, voir le
             bloc 1) : 20 px, descendues de 2 px sur une ligne de 24 (16 px)
             et de 4 sur une ligne de 28 (18 et 20 px), elles restent au
             milieu de la première ligne quand le titre se replie. -->
        <div class="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-4 shadow-sm dark:shadow-none">
          <h3 class="text-base sm:text-lg font-bold text-zinc-950 dark:text-white flex items-start gap-2">
            <Icone nom="check" class="mt-0.5 sm:mt-1 text-xl text-zinc-950 dark:text-zinc-100" />
            <span>{$tr("blog.keyPoints")}</span>
          </h3>
          <ul class="max-w-[34em] space-y-3">
            {#each post.botAnalysis.keyPoints as point}
              <li class="flex items-start gap-3 text-zinc-700 dark:text-zinc-300 text-sm sm:text-base leading-relaxed">
                <span class="text-zinc-950 dark:text-zinc-100 font-bold" aria-hidden="true">•</span>
                <span>{insecables(point)}</span>
              </li>
            {/each}
          </ul>
        </div>

        <!-- Textes et articles de lois cités -->
        {#if post.botAnalysis.citations.length > 0}
          <div class="space-y-4">
            <h3 class="text-lg sm:text-xl font-bold text-zinc-950 dark:text-white flex items-start gap-2">
              <Icone nom="file-text" class="mt-1 text-xl text-zinc-950 dark:text-zinc-100" />
              <span>{$tr("blog.citationsTitle")}</span>
            </h3>

            <div class="grid grid-cols-1 gap-4">
              {#each post.botAnalysis.citations as citation}
                <div
                  class="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 space-y-3 relative hover:border-zinc-950 dark:hover:border-zinc-400 transition-colors shadow-sm dark:shadow-none"
                >
                  <!-- Badge du guide (§ 4.8), le gabarit des rubriques : Inter
                       dans sa casse, la chasse fixe pour le seul numéro. Il
                       était entier en capitales mono semi-grasses et espacées,
                       plus haut d'un cran (`py-1`). -->
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <span class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                      {#if citation.articleNumber}
                        {$tr("blog.article")} <span class="font-mono tabular-nums">{citation.articleNumber}</span>
                      {:else}
                        {$tr("blog.legalExcerpt")}
                      {/if}
                    </span>
                    <!-- coupe-mots : une cote (« N°2018/9387/CAB/PM ») n'a pas
                         d'espace où passer à la ligne sur un écran étroit. -->
                    <span class="coupe-mots min-w-0 text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                      {citation.reference}
                    </span>
                  </div>

                  <h4 class="font-bold text-zinc-950 dark:text-white text-base">
                    {insecables(citation.title)}
                  </h4>

                  <!-- Mesure de lecture de l'article (34em, soit 476 px à
                       14 px) : sur toute la largeur de la carte, la citation
                       comptait 115 à 130 caractères par ligne, en italique
                       serré, la plus longue mesure de la page. -->
                  <blockquote class="max-w-[34em] italic text-sm text-zinc-600 dark:text-zinc-400 pl-4 border-l-2 border-zinc-300 dark:border-zinc-700 leading-relaxed font-normal">
                    {insecables(`« ${citation.excerpt} »`)}
                  </blockquote>

                  <!-- 44 px de haut à toutes les largeurs (16 px sur tablette
                       avec `sm:min-h-0`) ; à partir de sm, la marge négative
                       rend à la ligne sa hauteur d'avant, et la zone d'appui
                       déborde dans l'espace libre autour du lien. -->
                  <div class="pt-2">
                    <a
                      href="/laws/{citation.lawId}"
                      class="inline-flex min-h-11 items-center gap-1.5 text-xs font-bold text-zinc-950 dark:text-zinc-100 hover:underline sm:-my-3.5"
                    >
                      <span>{$tr("blog.readLaw")}</span>
                      <Icone nom="arrow-right" class="text-sm" />
                    </a>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Ce que cela change pour vous. Encart teinté : en sombre, zinc-800
             à 70 % et la bordure des blocs internes (guide § 4.1), pour qu'il
             se distingue des cartes zinc-900 qui l'entourent (voir le bloc 1). -->
        <div class="bg-zinc-100/70 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700/60 rounded-2xl p-6 sm:p-8 space-y-2">
          <h3 class="text-base sm:text-lg font-bold text-zinc-950 dark:text-zinc-100 flex items-start gap-2">
            <Icone nom="sparkles" class="mt-0.5 sm:mt-1 text-xl text-zinc-950 dark:text-zinc-100" />
            <span>{$tr("blog.impactTitle")}</span>
          </h3>
          <p class="max-w-[34em] text-sm sm:text-base text-zinc-700 dark:text-zinc-300 leading-relaxed font-normal">
            {insecables(post.botAnalysis.citizenImpact)}
          </p>
        </div>
      </section>

      <!-- BLOC 3 : Action Virale & Assistant IA. Bandeau toujours sombre : ses
           boutons ont les couleurs du mode sombre dans les deux thèmes, et un
           contour clavier blanc, car celui du site (zinc-950) s'y perdait.
           Rayon des cartes (rounded-2xl, guide § 4.1), comme ses voisines.
           La pastille est le badge du blog (Inter, casse d'origine), en
           inline-flex avec mb-3 : simple span en ligne, elle n'était qu'à
           8 px du titre ; avec le space-y-2, l'écart passe à 20 px, le rythme
           du reste de la page. -->
      <section
        class="bg-zinc-950 dark:bg-zinc-900 rounded-2xl p-6 sm:p-10 text-white space-y-6 border border-zinc-800"
      >
        <div class="space-y-2">
          <span class="mb-3 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-white/10 text-zinc-300 border border-white/20">
            {$tr("blog.assistanceBadge")}
          </span>
          <h3 class="text-2xl sm:text-3xl font-bold leading-tight tracking-tight text-balance">
            {insecables($tr("blog.similarTitle"))}
          </h3>
          <p class="text-zinc-400 text-sm sm:text-base leading-relaxed max-w-[34em] font-normal">
            {insecables($tr("blog.similarText"))}
          </p>
        </div>

        <!-- Les deux boutons au gabarit du guide (§ 4.4 : `px-5 py-2.5`,
             semi-gras, 44 px), aux couleurs du mode sombre : le principal
             blanc, le secondaire bordé. Ils n'étaient pas assortis (sans
             bordure et en gras d'un côté, bordé et semi-gras de l'autre,
             icônes de 20 et 16 px) : côte à côte, le second dépassait d'un
             pixel en haut et en bas. -->
        <div class="pt-2 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
          <a
            href={urlChatAvecQuestion}
            class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white bg-white px-5 py-2.5 text-center text-sm font-semibold text-zinc-950 transition-colors hover:border-zinc-200 hover:bg-zinc-200 focus-visible:outline-white"
          >
            <Icone nom="bot" class="text-base" />
            <span>{$tr("blog.askAssistant")}</span>
          </a>

          <a
            href="/blog"
            class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-2.5 text-center text-sm font-semibold text-zinc-200 transition-colors hover:border-zinc-200 hover:text-white focus-visible:outline-white"
          >
            <Icone nom="arrow-left" class="text-base" />
            <span>{$tr("blog.allPosts")}</span>
          </a>
        </div>
      </section>
    </div>
  </div>
</main>

<SiteFooter />
