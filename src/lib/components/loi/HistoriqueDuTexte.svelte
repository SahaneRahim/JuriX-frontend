<script lang="ts">
  /**
   * L'onglet « Historique (N) » (P1, étape 2) : TOUTE la chaîne des textes
   * qui ont touché celui-ci, du plus ancien au plus récent, y compris les
   * changements dépassés depuis et ceux que le document affiché intègre
   * déjà, puis les textes que celui-ci a touchés. La date du relevé et sa
   * limite sont dites en tête : ce que le relevé ne contient pas, JuriX ne le
   * sait pas.
   *
   * Une frise : un filet vertical et un point par texte, en zinc. Chaque
   * changement dit sa nature par un mot (« Réécriture complète »), ce qu'il
   * vise, la phrase du relevé (en français, `lang="fr"`), et s'il a été
   * dépassé ou intégré. Jamais de rouge.
   *
   * Pas de « Signaler » ici : l'encadré de statut, juste au-dessus des
   * onglets, porte déjà le sien, vers la même adresse. Deux liens identiques
   * à quelques lignes d'écart (vérification r1 du 29/10/2026).
   */
  import Icone from "$lib/components/Icone.svelte";
  import { language, tr } from "$lib/stores/language";
  import type { StatutJuridique } from "$lib/types";
  import NomDuTexteLie from "./NomDuTexteLie.svelte";
  import { articlesEcrits, articlesSourceLisibles, cibleDuChangement, dateDuReleve, historiqueDuTexte } from "./statut";

  export let statut: StatutJuridique;

  $: langue = $language.current;
  $: deuxPoints = langue === "fr" ? "\u00a0:" : ":";
  $: chaine = historiqueDuTexte(statut);
  $: parties = [
    { id: "historique-recus", titre: $tr("loi.historique.recus"), groupes: chaine.recus, sens: "modifie_par" },
    { id: "historique-portes", titre: $tr("loi.historique.portes"), groupes: chaine.portes, sens: "modifie" },
  ].filter((partie) => partie.groupes.length > 0);
</script>

<div class="space-y-8" data-testid="law-history">
  <p class="text-sm text-zinc-600 dark:text-zinc-400">
    {$tr("loi.historique.intro").replace("{date}", dateDuReleve(statut.releve_le, langue))}
  </p>

  {#each parties as partie (partie.id)}
    <section aria-labelledby={partie.id}>
      <h2 id={partie.id} class="mb-4 text-base font-semibold text-zinc-950 dark:text-white sm:text-lg">
        {partie.titre}
      </h2>
      <!-- Frise : filet zinc-200, point plein par texte. Décoratifs, le sens
           est dans les mots. -->
      <ol class="ml-1 space-y-6 border-l border-zinc-200 dark:border-zinc-700">
        {#each partie.groupes as groupe, rang (`${groupe.texte.reference ?? groupe.texte.titre}-${rang}`)}
          <li class="relative pl-5">
            <span
              class="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-zinc-950 ring-4 ring-white dark:bg-white dark:ring-zinc-900"
              aria-hidden="true"
            ></span>
            <h3 class="text-sm font-semibold text-zinc-950 dark:text-white sm:text-base">
              <NomDuTexteLie texte={groupe.texte} avecDeterminant={false} />
            </h3>
            <ul class="mt-2 space-y-3 text-sm text-zinc-700 dark:text-zinc-300">
              {#each groupe.changements as c (c.id)}
                <!-- Les articles de CE texte qui portent le changement, sans
                     les morceaux internes (« SECTION_2 », « 67.3 »). -->
                {@const sources = partie.sens === "modifie" ? articlesSourceLisibles(c.articles_source) : []}
                <li>
                  <p>
                    <span class="font-semibold text-zinc-950 dark:text-white"
                      >{$tr(`loi.changement.${c.nature_modification}`)}</span
                    >{deuxPoints}
                    {cibleDuChangement(c, langue, $tr)}{#if c.section}, {$tr("loi.historique.dans")}
                      <span>{c.section}</span>{/if}{#if sources.length}{` (${$tr("loi.historique.articles_source").replace(
                        "{articles}",
                        () => articlesEcrits(sources, langue),
                      )})`}{/if}
                  </p>
                  {#if c.portee}
                    <!-- La phrase du relevé, en français dans les deux langues. -->
                    <p class="mt-0.5 text-zinc-600 dark:text-zinc-400" lang="fr">{c.portee}</p>
                  {/if}
                  {#if c.depasse}
                    <p class="mt-1 flex items-start gap-1.5 text-zinc-600 dark:text-zinc-400">
                      <Icone nom="rotate-ccw-clock" class="mt-0.5 shrink-0 text-sm" />
                      <span>
                        {#if c.depasse_par}
                          {$tr("loi.historique.depasse_par_debut")}
                          <NomDuTexteLie texte={c.depasse_par} />.
                        {:else}
                          {$tr("loi.historique.depasse")}
                        {/if}
                      </span>
                    </p>
                  {/if}
                  {#if c.integre_au_texte}
                    <p class="mt-1 flex items-start gap-1.5 text-zinc-600 dark:text-zinc-400">
                      <Icone nom="layers" class="mt-0.5 shrink-0 text-sm" />
                      <span>{$tr("loi.historique.integre")}</span>
                    </p>
                  {/if}
                </li>
              {/each}
            </ul>
          </li>
        {/each}
      </ol>
    </section>
  {/each}
</div>
