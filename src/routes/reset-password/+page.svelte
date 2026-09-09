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
  import MetaSeo from "$lib/components/MetaSeo.svelte";
  import SiteHeader from "$lib/components/SiteHeader.svelte";
  import { tr } from "$lib/stores/language";
  import "../../app.css";
</script>

<MetaSeo titre={$tr("lien.usedTitle")} indexable={false} />

<SiteHeader />

<main id="contenu">
  <div
    class="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-slate-50 px-4 py-10 font-sans dark:bg-slate-900"
  >
    <div
      class="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800"
    >
      <h1
        class="mb-4 flex items-center justify-center gap-2 text-xl font-bold text-slate-900 dark:text-white"
      >
        <span class="text-3xl" aria-hidden="true">&#9878;</span>
        {$tr("lien.usedTitle")}
      </h1>
      <p class="text-sm text-slate-600 dark:text-slate-300">
        {$tr("lien.usedDetail")}
      </p>

      <a
        href="/forgot-password"
        data-testid="lien-ask-new"
        class="mt-6 inline-block w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
      >
        {$tr("reset.askNewLink")}
      </a>
      <p class="mt-4 text-xs">
        <a
          href="/login"
          data-testid="lien-to-login"
          class="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >{$tr("forgot.backToLogin")}</a
        >
      </p>
    </div>
  </div>
</main>
