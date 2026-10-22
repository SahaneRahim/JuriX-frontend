<script lang="ts">
  import { fade } from "svelte/transition";
  import { tr } from "$lib/stores/language";
  import { page } from "$app/stores";
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
     reste du site passait au sombre. -->
<div
  class="min-h-app bg-slate-50 dark:bg-background-dark py-8 sm:py-12 px-4 sm:px-6 lg:px-8 relative"
  in:fade
>

  <div class="max-w-4xl mx-auto space-y-10 sm:space-y-12 pt-4 sm:pt-8">
    <!-- Hero Section -->
    <div class="text-center space-y-4">
      <h1
        class="text-4xl font-extrabold text-slate-900 dark:text-white sm:text-5xl sm:tracking-tight lg:text-6xl"
      >
        {$tr("about.title")} <span class="text-blue-600 dark:text-blue-400">JuriX</span>
      </h1>
      <p class="max-w-2xl mx-auto text-lg sm:text-xl text-slate-500 dark:text-slate-400">
        {$tr("about.subtitle")}
      </p>
    </div>

    <!-- Mission Card. 20 px de marge intérieure sur téléphone : à 32 px, il
         ne restait que 224 px de texte sur un écran de 320 px. -->
    <div
      class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl dark:shadow-none overflow-hidden border border-slate-100 dark:border-slate-700 p-5 sm:p-8 lg:p-12"
    >
      <div class="space-y-6">
        <h2 class="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
          {$tr("about.mission.title")}
        </h2>

        <div
          class="prose prose-base sm:prose-lg dark:prose-invert text-slate-600 dark:text-slate-300 space-y-6"
        >
          <p>
            {$tr("about.mission.p1")}
          </p>

          <p>
            {$tr("about.mission.p2")}
          </p>

          <div class="grid sm:grid-cols-2 gap-4 sm:gap-6 mt-8">
            <div class="flex items-start space-x-4 p-4 bg-blue-50 dark:bg-blue-500/10 rounded-lg">
              <div class="flex-shrink-0">
                <svg
                  class="h-6 w-6 text-blue-600 dark:text-blue-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              </div>
              <div class="min-w-0">
                <h3 class="font-semibold text-gray-900 dark:text-white">
                  {$tr("about.centralization.title")}
                </h3>
                <p class="text-sm text-gray-600 dark:text-slate-300">
                  {$tr("about.centralization.desc")}
                </p>
              </div>
            </div>

            <div class="flex items-start space-x-4 p-4 bg-purple-50 dark:bg-purple-500/10 rounded-lg">
              <div class="flex-shrink-0">
                <svg
                  class="h-6 w-6 text-purple-600 dark:text-purple-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <div class="min-w-0">
                <h3 class="font-semibold text-gray-900 dark:text-white">
                  {$tr("about.ai.title")}
                </h3>
                <p class="text-sm text-gray-600 dark:text-slate-300">{$tr("about.ai.desc")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Creator Signature -->
    <div class="text-center pt-8 border-t border-slate-200 dark:border-slate-700">
      <p
        class="text-sm text-slate-500 dark:text-slate-400 uppercase tracking-widest font-semibold mb-2"
      >
        {$tr("about.creator")}
      </p>
      <h3 class="text-xl sm:text-2xl font-serif text-slate-800 dark:text-slate-100 italic">
        KANA SAHANE ABDELAZIZ RAHIM
      </h3>
    </div>

    <!-- Contact Section -->
    <!-- Un seul contact public, l'adresse électronique : la carte est centrée
         et bornée en largeur. Lien de 44 px de haut, et l'adresse peut se
         couper plutôt que d'élargir la carte. -->
    <div class="border-t border-slate-200 dark:border-slate-700 pt-8 pb-8">
      <h2 class="text-2xl font-bold text-slate-900 dark:text-white text-center mb-6 sm:mb-8">
        {$tr("about.contact.title")}
      </h2>
      <div class="mx-auto max-w-sm text-center">
        <div class="p-4 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700">
          <div class="text-2xl mb-2">📧</div>
          <div class="font-medium text-slate-900 dark:text-white">
            {$tr("about.contact.email")}
          </div>
          <a
            href="mailto:rahimsahane@gmail.com"
            class="inline-flex min-h-11 max-w-full items-center break-all text-blue-600 dark:text-blue-400 hover:underline"
            >rahimsahane@gmail.com</a
          >
        </div>
      </div>
    </div>
  </div>
</div>

</main>

<SiteFooter />
