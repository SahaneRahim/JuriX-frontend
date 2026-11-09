<script lang="ts">
  /**
   * Les coordonnées des institutions vers lesquelles la réponse renvoie
   * (« saisissez l'inspecteur du travail ») : un ami de l'auteur ne savait pas
   * comment joindre l'inspection (08/11/2026).
   *
   * Les fiches viennent de l'annuaire de l'API, jamais du modèle, et chacune
   * dit sa source et sa date : un numéro peut avoir changé depuis.
   *
   * LES DÉLÉGATIONS RÉGIONALES. La réponse ne sait pas où vit l'utilisateur :
   * une seule délégation est montrée, celle de la région choisie (mémorisée
   * dans ce navigateur), et la liste permet d'en changer.
   */
  import { onMount } from "svelte";
  import { language } from "$lib/stores/language";
  import type { ContactInstitution } from "$lib/types";

  export let contacts: ContactInstitution[] = [];
  /** Sur la page /annuaire : ni titre « Qui contacter », ni lien vers elle-même. */
  export let annuaire = false;

  const CLE_REGION = "jurix-region";
  let region = "";

  onMount(() => {
    try {
      region = localStorage.getItem(CLE_REGION) ?? "";
    } catch {
      region = "";
    }
  });

  function choisir(event: Event) {
    region = (event.currentTarget as HTMLSelectElement).value;
    try {
      localStorage.setItem(CLE_REGION, region);
    } catch {
      /* navigation privée : le choix vaut pour la page */
    }
  }

  $: en = $language.current === "en";
  $: regionales = contacts.filter((c) => c.region);
  $: nationales = contacts.filter((c) => !c.region);
  $: regions = regionales.map((c) => ({ code: c.region as string, nom: c.ville ?? c.region ?? "" }));
  $: choisie = regionales.find((c) => c.region === region) ?? null;
  $: affichees = [...nationales, ...(choisie ? [choisie] : [])];

  function telephone(numero: string): string {
    const chiffres = numero.replace(/\D/g, "");
    return chiffres.length <= 4 ? chiffres : `+237${chiffres}`;
  }
</script>

{#if contacts.length}
  <section
    data-testid="chat-contacts"
    class="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/60"
    aria-label={en ? "Who to contact" : "Qui contacter"}
  >
    {#if !annuaire}
      <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
        {en ? "Who to contact" : "Qui contacter"}
      </p>
    {/if}

    {#if regionales.length}
      <label class="mb-2 flex flex-wrap items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <span>{en ? "Your region:" : "Votre région :"}</span>
        <select
          data-testid="chat-contacts-region"
          value={region}
          on:change={choisir}
          class="min-h-11 min-w-0 rounded-lg border border-zinc-300 bg-white px-2 text-base text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white sm:min-h-9 sm:text-sm"
        >
          <option value="">{en ? "Choose…" : "Choisir…"}</option>
          {#each regions as r (r.code)}
            <option value={r.code}>{r.nom}</option>
          {/each}
        </select>
      </label>
    {/if}

    <ul class="space-y-2">
      {#each affichees as c (c.id)}
        <li data-testid="chat-contact" class="rounded-lg bg-white p-3 text-sm dark:bg-zinc-950">
          <p class="coupe-mots font-semibold text-zinc-950 dark:text-white">{c.nom}</p>
          {#if c.ville || c.adresse}
            <p class="coupe-mots text-zinc-600 dark:text-zinc-400">{c.adresse ?? c.ville}</p>
          {/if}
          <p class="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {#each c.telephones as numero (numero)}
              <a
                href="tel:{telephone(numero)}"
                class="inline-flex min-h-11 items-center font-medium text-zinc-950 underline underline-offset-4 dark:text-white sm:min-h-0"
                >{numero}</a
              >
            {/each}
            {#if c.email}
              <a
                href="mailto:{c.email}"
                class="coupe-mots inline-flex min-h-11 items-center text-zinc-950 underline underline-offset-4 dark:text-white sm:min-h-0"
                >{c.email}</a
              >
            {/if}
            {#if c.site}
              <a
                href={c.site}
                target="_blank"
                rel="noopener noreferrer"
                class="coupe-mots inline-flex min-h-11 items-center text-zinc-950 underline underline-offset-4 dark:text-white sm:min-h-0"
                >{c.site.replace(/^https?:\/\//, "")}</a
              >
            {/if}
          </p>
          {#if c.note}
            <p class="mt-1 text-zinc-600 dark:text-zinc-400">{c.note}</p>
          {/if}
          <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {en ? "Source:" : "Source :"}
            <a href={c.source.url} target="_blank" rel="noopener noreferrer" class="underline underline-offset-2"
              >{c.source.titre}</a
            >
            ({c.source.date}). {en ? "Numbers may have changed." : "Les numéros peuvent avoir changé."}
          </p>
        </li>
      {/each}
    </ul>
    {#if regionales.length && !choisie}
      <p class="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
        {en
          ? "Choose your region to see your regional labour delegation."
          : "Choisissez votre région pour voir votre délégation régionale du travail."}
      </p>
    {/if}
    {#if !annuaire}<p class="mt-2 text-xs">
      <a href="/annuaire" class="font-medium text-zinc-950 underline underline-offset-4 dark:text-white"
        >{en ? "All institutions" : "Toutes les institutions"}</a
      >
    </p>{/if}
  </section>
{/if}
