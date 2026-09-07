<script lang="ts">
  /**
   * Bouton « Se connecter avec Google ».
   *
   * Syntaxe Svelte 4 (`export let`, `$:`) — c'est celle de tout le projet, et
   * Svelte 5 la supporte en mode legacy. Une seule rune ferait basculer le
   * fichier entier.
   *
   * NE REND RIEN si `VITE_GOOGLE_CLIENT_ID` est vide ou si le script Google ne
   * charge pas : la panne d'un tiers ne doit pas casser la page, et le
   * formulaire mot de passe reste la voie complète.
   *
   * Le bouton lui-même est rendu par Google DANS UNE IFRAME : on ne peut ni y
   * poser un `data-testid`, ni le styler, ni l'atteindre depuis Playwright. Le
   * `data-testid` est donc sur le conteneur.
   */
  import { createEventDispatcher, onMount } from "svelte";
  import { GOOGLE_CLIENT_ID, chargerGis } from "$lib/google";
  import { tr } from "$lib/stores/language";

  /** Largeur demandée à Google, en pixels. */
  export let largeur = 320;

  const dispatch = createEventDispatcher<{ credential: string }>();

  let conteneur: HTMLDivElement;
  let disponible = false;

  onMount(async () => {
    if (!(await chargerGis())) return;

    // `google` est posé sur window par le script chargé ci-dessus ; il n'a pas
    // de typage npm puisqu'on n'installe rien.
    const google = (window as unknown as { google?: any }).google;
    if (!google?.accounts?.id || !conteneur) return;

    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (reponse: { credential?: string }) => {
        if (reponse?.credential) dispatch("credential", reponse.credential);
      },
      // Pas de One Tap (`prompt()`) : il surgit au chargement de la page, il
      // est intrusif, et il est pratiquement intestable.
      auto_select: false,
      ux_mode: "popup",
    });

    google.accounts.id.renderButton(conteneur, {
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      logo_alignment: "center",
      width: largeur,
    });

    disponible = true;
  });
</script>

{#if GOOGLE_CLIENT_ID}
  <div class="flex flex-col items-center gap-3" class:hidden={!disponible}>
    <div class="flex w-full items-center gap-3" aria-hidden="true">
      <span class="h-px flex-1 bg-slate-200 dark:bg-slate-700"></span>
      <span class="text-xs text-slate-500">{$tr("auth.orGoogle")}</span>
      <span class="h-px flex-1 bg-slate-200 dark:bg-slate-700"></span>
    </div>
    <div
      bind:this={conteneur}
      data-testid="google-button-container"
      aria-label={$tr("auth.googleButton")}
    ></div>
  </div>
{/if}
