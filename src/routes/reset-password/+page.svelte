<script lang="ts">
  /**
   * Atterrissage de `/reset-password`, sans jeton.
   *
   * POURQUOI CETTE PAGE EXISTE. La page à jeton retire le jeton de la barre
   * d'adresse dès qu'elle l'a lu — il ne doit rester ni dans l'historique, ni
   * dans les signets, ni dans un partage d'écran. L'URL devient donc
   * `/reset-password`, et sans cette page un simple rechargement, ou un retour
   * arrière, tombait sur une 404. Utiliser un lien de courriel ne doit pas
   * pouvoir se terminer sur une page d'erreur.
   *
   * Elle est aussi la bonne réponse au cas réel : arriver ici sans jeton
   * signifie que le lien a déjà servi, ou qu'il a été tronqué par le client de
   * messagerie. Dans les deux cas, la seule issue utile est d'en redemander un.
   */
  import Icone from "$lib/components/Icone.svelte";
  import MetaSeo from "$lib/components/MetaSeo.svelte";
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import SiteHeader from "$lib/components/SiteHeader.svelte";
  import { tr } from "$lib/stores/language";
  import "../../app.css";
</script>

<MetaSeo titre={$tr("lien.usedTitle")} indexable={false} />

<!-- Même coquille que login/+page.svelte : colonne de la hauteur de l'écran
     visible, cibles de 44 px à toutes les tailles, règles d'écran court,
     pied du site. Mais la carte reste centrée sous sm : l'ancrage en haut
     des pages à formulaire ne sert qu'à l'ouverture du clavier, et cette
     page n'a aucun champ. Ancrée en haut, la carte courte laissait ≈ 220 px
     vides entre elle et le pied (390x844), l'écran semblait vide au milieu.

     Rythme des cartes sœurs (/forgot-password, /signup) : titre à 8 px du
     texte (16 auparavant), texte secondaire en zinc-500 (zinc-400 en sombre)
     comme leurs sous-titres, lien de pied à 12 px du bouton. Et une icône
     d'ÉTAT dans la tuile (guide § 4.10) : le lien rompu dit « lien
     périmé », là où la tuile de la balance répétait le logo de l'en-tête. -->
<div class="flex min-h-app flex-col">
<SiteHeader />

<main id="contenu" class="flex flex-1 flex-col">
  <!-- À partir de sm, la carte est ancrée à 12 % de la hauteur de l'écran
       (`sm:pt-[12vh]`), la même ancre que les autres pages de compte :
       centrée selon sa propre hauteur, la tuile et le titre sautaient d'une
       page sœur à l'autre. De lg à xl, autant sous elle (`lg:pb-[12vh]`) : le
       pied empilé sous un écran bas la faisait paraître posée sur lui ; 40 px
       ailleurs (voir login/+page.svelte). Le dernier lien garde sa cible de
       44 px (`py-3`), son paragraphe rend la marge qu'elle ajoutait sous lui
       (`-mb-3`) : la carte paraissait lestée vers le bas. -->
  <div
    class="flex flex-1 items-center justify-center bg-background-light px-4 py-6 font-sans dark:bg-background-dark sm:items-start sm:pb-10 sm:pt-[12vh] lg:pb-[12vh] xl:pb-10 court:items-start court:py-3"
  >
    <div
      class="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none sm:p-8 court:p-4"
    >
      <h1
        class="mb-2 flex items-center justify-center gap-2 text-xl font-titre font-semibold text-zinc-950 dark:text-white sm:text-2xl court:text-xl"
      >
        <span
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200/70 bg-zinc-100 text-zinc-800 dark:border-zinc-700/60 dark:bg-zinc-800 dark:text-zinc-200 court:hidden"
        >
          <Icone nom="link-2-off" class="text-lg" />
        </span>
        {$tr("lien.usedTitle")}
      </h1>
      <!-- Une phrase par ligne : la traduction les sépare d'un saut de ligne.
           En équilibrant le paragraphe d'un bloc, `text-balance` le coupait
           au même mauvais endroit à toutes les tailles (« S'il vous en / faut
           un nouveau »), et non après « une fois. ». Le saut de ligne rendu
           tel quel (`whitespace-pre-line`) ne suffisait pas non plus :
           Chromium n'équilibrait pas la phrase d'après, et en 390 × 844
           « un. » restait seul sous une ligne pleine. Chaque phrase est donc
           son propre bloc, équilibré à part ; le paragraphe reste un seul
           <p> pour les lecteurs d'écran. L'espace en tête des phrases
           suivantes ne se voit pas (un début de ligne l'efface), mais garde
           les phrases séparées dans le texte brut de la page (« fois. S'il »,
           et non « fois.S'il »). -->
      <p class="text-sm text-zinc-500 dark:text-zinc-400">
        {#each $tr("lien.usedDetail").split("\n") as phrase, rang (rang)}
          <span class="block text-balance">{rang > 0 ? ` ${phrase}` : phrase}</span>
        {/each}
      </p>

      <a
        href="/forgot-password"
        data-testid="lien-ask-new"
        class="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-black dark:bg-white dark:text-zinc-950 dark:shadow-none dark:hover:bg-zinc-200"
      >
        {$tr("reset.askNewLink")}
      </a>
      <p class="-mb-3 mt-3 text-sm">
        <a
          href="/login"
          data-testid="lien-to-login"
          class="inline-block py-3 font-semibold text-zinc-950 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-950 dark:text-white dark:decoration-zinc-600 dark:hover:decoration-white"
          >{$tr("forgot.backToLogin")}</a
        >
      </p>
    </div>
  </div>
</main>

<SiteFooter />
</div>
