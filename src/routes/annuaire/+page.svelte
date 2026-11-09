<script lang="ts">
  /**
   * Contacts utiles : les institutions vers lesquelles le chat renvoie
   * (inspection du travail, CNPS, Barreau, CONAC…), avec la source et la date
   * de chaque fiche. Demandé le 08/11/2026 : un utilisateur ne savait pas
   * comment joindre l'inspection du travail que le chat lui conseillait.
   */
  import { page } from "$app/stores";
  import MetaSeo from "$lib/components/MetaSeo.svelte";
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import SiteHeader from "$lib/components/SiteHeader.svelte";
  import ContactsDeLaReponse from "$lib/components/chat/ContactsDeLaReponse.svelte";
  import { language, tr } from "$lib/stores/language";
  import { urlCanonique } from "$lib/seo";
  import type { PageData } from "./$types";

  export let data: PageData;

  $: en = $language.current === "en";
  $: groupes = Object.entries(data.themes)
    .map(([code, nom]) => ({ code, nom, fiches: data.fiches.filter((f) => f.theme === code) }))
    .filter((g) => g.fiches.length);
</script>

<MetaSeo
  titre={$tr("nav.annuaire")}
  description={en
    ? "Contacts of Cameroonian institutions: labour inspectorate, CNPS, Bar, CONAC, human rights commission, emergencies."
    : "Contacts des institutions camerounaises : inspection du travail, CNPS, Barreau, CONAC, droits de l'homme, urgences."}
  canonique={urlCanonique($page.url)}
/>

<SiteHeader />

<main id="contenu" class="px-zone-sure">
  <div class="min-h-app bg-background-light px-4 pb-8 pt-8 dark:bg-background-dark sm:px-6 sm:pb-12 sm:pt-16 lg:px-8">
    <div class="mx-auto max-w-3xl">
      <h1 class="font-titre font-semibold text-3xl text-zinc-950 dark:text-white sm:text-4xl">{$tr("nav.annuaire")}</h1>
      <p class="mt-3 text-base text-zinc-700 dark:text-zinc-300">
        {en
          ? "Each entry shows its source and date: a number may have changed since. Check before you travel."
          : "Chaque fiche indique sa source et sa date : un numéro peut avoir changé depuis. Vérifiez avant de vous déplacer."}
      </p>

      {#each groupes as groupe (groupe.code)}
        <section class="mt-8" data-testid="annuaire-theme">
          <h2 class="mb-3 text-lg font-semibold text-zinc-950 dark:text-white">{groupe.nom}</h2>
          <ContactsDeLaReponse contacts={groupe.fiches} annuaire />
        </section>
      {/each}
    </div>
  </div>
</main>

<SiteFooter />
