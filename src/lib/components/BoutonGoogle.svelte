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
  import { createEventDispatcher, onMount, tick } from "svelte";
  import { GOOGLE_CLIENT_ID, chargerGis } from "$lib/google";
  import { tr } from "$lib/stores/language";

  /**
   * Largeur MAXIMALE demandée à Google, en pixels.
   *
   * Le bouton prend la largeur de son conteneur, dans les bornes de l'option
   * `width` de Google (200 à 400 px). Il était fixé à 320 px : plus large que
   * les champs sur tout téléphone de moins de 418 px, il débordait de la carte
   * de 17 px de chaque côté à 320 px.
   */
  export let largeur = 400;

  const LARGEUR_MIN = 200;
  const LARGEUR_MAX = 400;

  const dispatch = createEventDispatcher<{ credential: string }>();

  let enveloppe: HTMLDivElement;
  let conteneur: HTMLDivElement;
  let disponible = false;
  let largeurRendue = 0;

  /**
   * Largeur offerte, lue sur le PARENT de l'enveloppe : l'enveloppe elle-même
   * est en `display: none` (classe `hidden`) tant que le bouton n'est pas
   * rendu, et mesurerait 0. Un parent sans largeur mesurable rend `largeur`.
   */
  function largeurCible(): number {
    const offerte = Math.floor(enveloppe?.parentElement?.clientWidth ?? 0) || largeur;
    return Math.max(LARGEUR_MIN, Math.min(LARGEUR_MAX, largeur, offerte));
  }

  // `google` est posé sur window par le script de $lib/google ; il n'a pas de
  // typage npm puisqu'on n'installe rien.
  async function rendre(google: any) {
    const cible = largeurCible();
    // Chaque rendu recharge l'iframe de Google : rien à faire si la largeur
    // n'a pas changé (l'observateur se déclenche aussi à sa mise en place).
    if (cible === largeurRendue) return;
    // Le {#key largeurRendue} du balisage recrée alors le conteneur : Google
    // dessine dans un élément neuf, sans qu'on vide l'ancien à la main ni
    // qu'on compte sur lui pour remplacer le bouton précédent.
    largeurRendue = cible;
    await tick();
    // Une largeur plus récente a pu être demandée entre-temps : c'est elle qui
    // dessinera, dans le conteneur qui lui revient.
    if (!conteneur || largeurRendue !== cible) return;
    google.accounts.id.renderButton(conteneur, {
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      logo_alignment: "center",
      width: cible,
    });
  }

  // `onMount` n'est plus `async` : une fonction asynchrone rend une promesse,
  // et Svelte n'appellerait jamais le nettoyage qu'elle renverrait.
  onMount(() => {
    let detruit = false;
    let observateur: ResizeObserver | undefined;
    let minuterie: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      // `detruit` : on a pu quitter la page pendant le chargement du script.
      if (!(await chargerGis()) || detruit) return;

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

      await rendre(google);
      if (detruit) return;
      disponible = true;

      // Rotation du téléphone, fenêtre redimensionnée : le bouton suit la
      // carte. Anti-rebond, pour ne pas recharger l'iframe à chaque pixel.
      const parent = enveloppe?.parentElement;
      if (parent && typeof ResizeObserver !== "undefined") {
        observateur = new ResizeObserver(() => {
          clearTimeout(minuterie);
          minuterie = setTimeout(() => rendre(google), 200);
        });
        observateur.observe(parent);
      }
    })();

    return () => {
      detruit = true;
      observateur?.disconnect();
      clearTimeout(minuterie);
    };
  });
</script>

{#if GOOGLE_CLIENT_ID}
  <div bind:this={enveloppe} class="flex w-full flex-col items-center gap-3" class:hidden={!disponible}>
    <!-- Le séparateur est au site, en zinc comme le reste ; le bouton, dessiné
         par Google dans son iframe, garde la charte de Google. -->
    <div class="flex w-full items-center gap-3" aria-hidden="true">
      <span class="h-px flex-1 bg-zinc-200 dark:bg-zinc-800"></span>
      <span class="text-xs text-zinc-500 dark:text-zinc-400">{$tr("auth.orGoogle")}</span>
      <span class="h-px flex-1 bg-zinc-200 dark:bg-zinc-800"></span>
    </div>
    {#key largeurRendue}
      <div
        bind:this={conteneur}
        data-testid="google-button-container"
        aria-label={$tr("auth.googleButton")}
        class="flex w-full justify-center"
      ></div>
    {/key}
  </div>
{/if}
