<script lang="ts">
  import { fade } from "svelte/transition";
  import { ADRESSE_DE_CONTACT } from "$lib/contact";
  import { tr } from "$lib/stores/language";
  import { page } from "$app/stores";
  import Icone from "$lib/components/Icone.svelte";
  import MetaSeo from "$lib/components/MetaSeo.svelte";
  import { urlCanonique } from "$lib/seo";
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import SiteHeader from "$lib/components/SiteHeader.svelte";
</script>

<MetaSeo
  titre={$tr("nav.about")}
  description={$tr("about.subtitle")}
  canonique={urlCanonique($page.url)}
/>

<SiteHeader />

<!-- `px-zone-sure` : marges de l'encoche d'un iPhone en paysage
     (`viewport-fit=cover`) ; 0 partout ailleurs. -->
<main id="contenu" class="px-zone-sure">
<!-- `min-h-app` (app.css : 100dvh, repli 100vh) : 100vh compte la barre du navigateur
     mobile comme repliée. Mode sombre : la page restait blanche quand tout le
     reste du site passait au sombre.
     Marge basse de toutes les pages (32 px, puis 48 à partir de sm, comme le
     blog et l'accueil) : `sm:py-16` et le `pb-8` du contact laissaient 97 px
     de vide avant le pied de page, 48 sur le blog.
     Écran court (`court:`, téléphone en paysage) : 24 px entre l'en-tête et
     le titre, au lieu de 96 (`sm:pt-16` puis `sm:pt-8`), et 32 px entre les
     blocs. Le premier écran de 740 × 360 ne montrait que le titre et le
     sous-titre ; l'accueil, la connexion et la page d'erreur se resserrent
     déjà ainsi. -->
<div
  class="min-h-app bg-background-light dark:bg-background-dark pt-8 pb-8 sm:pt-16 sm:pb-12 court:pt-4 px-4 sm:px-6 lg:px-8 relative"
  in:fade
>

  <div class="max-w-4xl mx-auto space-y-12 sm:space-y-16 court:space-y-8 pt-4 sm:pt-8 court:pt-2">
    <!-- Hero Section. Titre de page au gabarit du guide (§ 4.2), 36 px au
         plus : à 60 px, c'était le plus gros titre du site après celui de
         l'accueil, et l'échelle changeait d'une page à l'autre. « JuriX » sans
         soulignement : c'était exactement celui des liens (§ 4.3), celui de
         l'adresse de la carte Contact, sur un mot qu'on ne peut pas suivre.
         Sous-titre équilibré (`text-balance`) : à 390 px, « Cameroun. »
         restait seul sur sa dernière ligne. -->
    <div class="text-center space-y-4">
      <h1
        class="text-3xl sm:text-4xl font-titre font-semibold text-balance text-zinc-950 dark:text-white"
      >
        {$tr("about.title")} JuriX
      </h1>
      <p class="max-w-2xl mx-auto text-base sm:text-lg text-zinc-500 dark:text-zinc-400 font-normal leading-relaxed text-balance">
        {$tr("about.subtitle")}
      </p>
    </div>

    <!-- Mission Card. 24 px de marge intérieure sur téléphone, et non 32 : à
         32 px, il ne restait que 224 px de texte sur un écran de 320 px. -->
    <div
      class="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm dark:shadow-none overflow-hidden border border-zinc-200 dark:border-zinc-800 p-6 sm:p-10 lg:p-12"
    >
      <div class="space-y-8">
        <h2 class="text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-white tracking-tight">
          {$tr("about.mission.title")}
        </h2>

        <!-- `prose-zinc` : sans lui, la typographie prend l'échelle `gray` par
             défaut du plugin, un gris bleuté, liens et titres compris.
             Mesure de lecture de l'article du blog (34em, soit 612 px en
             18 px) : sur toute la carte, les lignes comptaient 85 à 90
             caractères. Autrefois, bornés à 65 caractères avec les tuiles,
             paragraphes ET tuiles s'arrêtaient avant le bord droit, et la
             carte paraissait décentrée ; les tuiles, sorties du bloc `prose`,
             gardent maintenant toute la largeur et tiennent ce bord. -->
        <div
          class="prose prose-zinc prose-base sm:prose-lg dark:prose-invert max-w-[34em] text-zinc-700 dark:text-zinc-300 space-y-6 leading-relaxed"
        >
          <p>
            {$tr("about.mission.p1")}
          </p>

          <p>
            {$tr("about.mission.p2")}
          </p>
        </div>

        <!--
          Les tuiles hors du bloc `prose` : dedans, le titre de chaque tuile
          prenait la taille et la marge haute d'un h3 d'article (24 px, 1,6 em
          au-dessus) et tombait 20 px sous l'icône. Titres et textes au gabarit
          des cartes du guide (§ 4.2). Deux colonnes à partir de lg seulement :
          de 640 à 1 023 px, deux colonnes de 280 px tassaient le texte à côté
          de l'icône. Tuile d'icône grise, comme celle du contact et des cartes
          de l'accueil (guide § 7) : elle était inversée ici seulement.
        -->
        <div class="grid gap-4 sm:gap-6 lg:grid-cols-2">
          <div class="flex items-start space-x-4 p-5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/60 rounded-xl">
            <div class="flex-shrink-0 w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/70 dark:border-zinc-700/60 flex items-center justify-center text-zinc-800 dark:text-zinc-200">
              <Icone nom="layers" class="text-xl" />
            </div>
            <div class="min-w-0">
              <h3 class="text-base sm:text-lg font-bold leading-snug text-zinc-950 dark:text-white mb-1">
                {$tr("about.centralization.title")}
              </h3>
              <p class="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {$tr("about.centralization.desc")}
              </p>
            </div>
          </div>

          <!-- L'assistant (le robot) et non un éclair : la tuile ne promet
               plus une « assistance juridique instantanée », mais des réponses
               qui citent leurs articles. -->
          <div class="flex items-start space-x-4 p-5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/60 rounded-xl">
            <div class="flex-shrink-0 w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/70 dark:border-zinc-700/60 flex items-center justify-center text-zinc-800 dark:text-zinc-200">
              <Icone nom="bot" class="text-xl" />
            </div>
            <div class="min-w-0">
              <h3 class="text-base sm:text-lg font-bold leading-snug text-zinc-950 dark:text-white mb-1">
                {$tr("about.ai.title")}
              </h3>
              <p class="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {$tr("about.ai.desc")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Creator Signature. En Inter, comme tout le site : `font-serif` ne
         renvoyait à aucune police déclarée, le navigateur prenait Times ou
         Liberation Serif, et ces capitales italiques avaient l'air d'une
         police qui n'avait pas chargé. Le surtitre aussi, dans sa casse
         (Q5 A : deux voix au plus, Literata pour le titre de la page et Inter
         pour le reste) : il était en capitales à chasse fixe espacées.
         Marge haute égale à l'écart qui le sépare du filet suivant (48 puis
         64 px, `space-y` de la page) : avec 32 px, le bloc paraissait collé
         au filet du haut. -->
    <div class="text-center pt-12 sm:pt-16 border-t border-zinc-200 dark:border-zinc-800">
      <p class="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">
        {$tr("about.creator")}
      </p>
      <h3 class="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">
        KANA SAHANE ABDELAZIZ RAHIM
      </h3>
    </div>

    <!-- Contact Section -->
    <!-- Un seul contact public, l'adresse électronique : la carte est centrée
         et bornée en largeur. Lien de 44 px de haut, et l'adresse peut se
         couper plutôt que d'élargir la carte. -->
    <!-- Titre de section au gabarit du guide (§ 4.2), comme « Notre
         Mission » : il était d'un cran plus petit, 24 px contre 30. -->
    <div class="border-t border-zinc-200 dark:border-zinc-800 pt-8">
      <h2 class="text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-white text-center mb-6 tracking-tight">
        {$tr("about.contact.title")}
      </h2>
      <div class="mx-auto max-w-sm text-center">
        <div class="p-6 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm dark:shadow-none border border-zinc-200 dark:border-zinc-800">
          <div class="w-10 h-10 mx-auto mb-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/70 dark:border-zinc-700/60 flex items-center justify-center text-zinc-800 dark:text-zinc-200">
            <Icone nom="mail" class="text-xl" />
          </div>
          <div class="font-semibold text-sm text-zinc-950 dark:text-white mb-1">
            {$tr("about.contact.email")}
          </div>
          <!-- La même adresse que « Signaler » sur la page d'un texte
               ($lib/contact). En Inter : la chasse fixe ajoutait une
               troisième voix à la page (Q5 A). -->
          <a
            href="mailto:{ADRESSE_DE_CONTACT}"
            class="inline-flex min-h-11 max-w-full items-center break-all text-sm text-zinc-950 dark:text-white underline decoration-zinc-300 dark:decoration-zinc-600 underline-offset-4 hover:decoration-zinc-950 dark:hover:decoration-white"
            >{ADRESSE_DE_CONTACT}</a
          >
        </div>
      </div>
    </div>
  </div>
</div>

</main>

<SiteFooter />
