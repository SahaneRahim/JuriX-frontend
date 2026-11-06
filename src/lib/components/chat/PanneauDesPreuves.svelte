<script lang="ts">
  /**
   * Le panneau « Articles cités » (refonte A, A1 § 4, décisions C2, C5, C6) :
   * les articles que cite la réponse, en cartes (CarteArticleCite), et les
   * textes consultés, repliés, à leur pied.
   *
   * DEUX FORMES, UN SEUL ÉLÉMENT, DÉCIDÉES PAR LE CSS. À partir de lg, une
   * colonne permanente de 520 px, NON modale : on continue de lire la réponse.
   * Sous lg, une feuille en bas d'écran, cachée tant qu'elle n'est pas ouverte
   * et, ouverte, MODALE : voile, focus enfermé, page derrière inerte (la page
   * pose `inert`).
   *
   * POURQUOI DES CLASSES `lg:` ET NON `{#if ecranLarge}`. La page est rendue au
   * serveur, sans largeur d'écran : le panneau doit y être, à sa place, sans
   * saut à l'hydratation (PASSATION § 8.7). `modale` ne sert qu'à ce que le CSS
   * ne sait pas faire : rôle, voile, piège de focus.
   *
   * Échap et le retour système ferment la feuille : c'est la page qui les gère
   * (une seule écoute d'Échap, un état d'historique).
   */
  import { tick } from "svelte";
  import { fade } from "svelte/transition";
  import { adresseDeLArticle } from "$lib/api-publique";
  import Icone from "$lib/components/Icone.svelte";
  import { duree } from "$lib/mouvement";
  import { language, tr } from "$lib/stores/language";
  import type { TexteConsulte } from "$lib/types";
  import CarteArticleCite from "./CarteArticleCite.svelte";
  import { designationDuTexteCite, mentionDuStatut } from "./libelles";
  import type { CarteDeLaReponse } from "./passages";

  /** Sous 1 024 px : la forme feuille. */
  export let modale: boolean;
  /** Feuille ouverte (sans effet à partir de lg). */
  export let ouvert = false;
  /** `vide` : rien encore ; `recherche` : squelettes ; `pret` : la liste ; `aucun` : réponse sans citation. */
  export let etat: "vide" | "recherche" | "pret" | "aucun" = "vide";
  export let cartes: CarteDeLaReponse[] = [];
  export let consultes: TexteConsulte[] = [];
  /** La réponse dont les cartes sont montrées : leurs clés changent avec elle. */
  export let idMessage: number | null = null;
  export let carteOuverte: number | null = null;
  export let citationActive: number | null = null;
  /** Les cartes viennent d'arriver, dans cette vue : elles entrent une à une. */
  export let nouvelles = false;
  /** Le nombre de textes trouvés (`textes_trouves`), pour les squelettes. */
  export let nombreDeTextes = 2;
  export let releveLe: string | null = null;
  /** L'élément du panneau, pour la page (hauteur de la feuille, focus). */
  export let boite: HTMLElement | undefined = undefined;
  export let surFermer: () => void = () => {};
  export let surBasculer: (index: number) => void = () => {};
  export let surAnnonce: (texte: string) => void = () => {};
  /**
   * Ce que le chat annonce pendant que la feuille est modale : hors d'une boîte
   * aria-modal, TalkBack et VoiceOver ne lisent plus rien, région d'annonce de
   * la page comprise. La page les dirige ici.
   */
  export let annonce = "";

  $: t = $tr;
  $: langue = $language.current;
  $: enBoite = modale && ouvert;

  const idTitre = `preuves-titre-${Math.random().toString(36).slice(2, 8)}`;
  /** Décalage des cartes qui entrent (maquette), borné à 1 s (D9). */
  const DECALAGE_DES_CARTES = 150;
  const DELAI_MAX = 900;
  /** C7 : la pastille des trois premières cartes seulement, sans ouvrir les autres. */
  const CARTES_PRECHARGEES = 3;

  let boutonFermer: HTMLButtonElement | undefined;

  /** Deux squelettes au moins, trois au plus : assez pour dire « ça arrive ». */
  $: squelettes = Math.min(3, Math.max(2, nombreDeTextes));

  // ------------------------------------------------------------ consultés

  /**
   * Repliés par défaut (C5) : ces textes n'appuient aucune phrase, ils disent
   * seulement ce qui a été lu.
   */
  let consultesDeplies = false;

  function ligneDuTexte(texte: TexteConsulte): string {
    const lus = (Array.isArray(texte.articles) ? texte.articles : []).filter(Boolean);
    return [
      designationDuTexteCite(texte.law_title, texte.law_reference).reperes,
      lus.length ? t("chat.consulted.read").replace("{articles}", lus.join(", ")) : "",
      mentionDuStatut(texte.statut, t, langue, releveLe),
    ]
      .filter(Boolean)
      .join(" · ");
  }

  // ------------------------------------------------------------ focus

  // La feuille s'ouvre : le focus va à « Fermer », en haut, dans l'en-tête qui
  // ne défile pas. Il n'en bouge pas s'il est déjà dedans (fenêtre rétrécie
  // pendant que le lecteur était dans le panneau).
  let enBoiteAvant = false;
  $: if (enBoite !== enBoiteAvant) {
    enBoiteAvant = enBoite;
    if (enBoite) {
      void tick().then(() => {
        if (!boite?.contains(document.activeElement)) boutonFermer?.focus();
      });
    }
  }

  const FOCALISABLES = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
  ].join(",");

  /**
   * Feuille modale : la tabulation tourne dans la feuille. Pas l'action
   * partagée `piegerFocus` : elle rend le focus à son départ quand on la
   * retire, ce qui le ferait sortir du panneau au simple passage de la
   * feuille au panneau (fenêtre élargie). Le focus est rendu par la page, à
   * la fermeture seulement.
   */
  function surTabulation(event: KeyboardEvent) {
    if (!enBoite || event.key !== "Tab" || !boite) return;
    const liste = Array.from(boite.querySelectorAll<HTMLElement>(FOCALISABLES)).filter(
      (el) => el.offsetParent !== null && !el.closest("[inert]"),
    );
    if (!liste.length) return;
    const premier = liste[0];
    const dernier = liste[liste.length - 1];
    const actif = document.activeElement as HTMLElement | null;
    if (!actif || !liste.includes(actif)) {
      event.preventDefault();
      (event.shiftKey ? dernier : premier).focus();
    } else if (event.shiftKey && actif === premier) {
      event.preventDefault();
      dernier.focus();
    } else if (!event.shiftKey && actif === dernier) {
      event.preventDefault();
      premier.focus();
    }
  }

  // ------------------------------------------------------------ glisser pour fermer

  /**
   * La poignée de la feuille se tire vers le bas pour la fermer (au-delà de
   * 80 px). Le bouton « Fermer » reste là pour qui ne glisse pas.
   */
  const SEUIL_DE_FERMETURE = 80;
  let decalage = 0;
  let depart: number | null = null;
  let pointeur: number | null = null;

  function debutDuGeste(event: PointerEvent) {
    if (!enBoite || event.button !== 0 || (event.target as Element).closest("button, a")) return;
    depart = event.clientY;
    pointeur = event.pointerId;
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }
  function suiteDuGeste(event: PointerEvent) {
    if (depart === null || event.pointerId !== pointeur) return;
    decalage = Math.max(0, event.clientY - depart);
  }
  function finDuGeste() {
    if (depart === null) return;
    const tire = decalage;
    depart = null;
    pointeur = null;
    decalage = 0;
    if (tire > SEUIL_DE_FERMETURE) surFermer();
  }

  /*
   * Feuille : collée au bas de l'écran, min(72 % de la hauteur VISIBLE, 560 px)
   * (A1 § 4), 92 % sur un écran court ; centrée et bornée à 672 px à partir de
   * sm. z-[56] : au-dessus du voile (55) et de l'en-tête (50), sous la boîte
   * des profils. Elle monte en 0,6 s (A2 § 4).
   *
   * POURQUOI `visibility` N'EST TRANSITIONNÉE QU'À LA FERMETURE. Fermée,
   * `invisible` la retire de la tabulation, mais seulement une fois descendue :
   * d'où la transition. À l'ouverture, elle doit être visible à l'instant
   * même, sans quoi le focus posé sur « Fermer » serait refusé.
   *
   * Colonne : `lg:` reprend tout, y compris la fermeture (`lg:visible`) : le
   * rendu serveur, sans JavaScript, a la colonne à sa place.
   */
  const CLASSES =
    "fixed inset-x-0 bottom-0 z-[56] mx-auto flex h-[min(72vh,560px)] w-full flex-col rounded-t-3xl border-t border-zinc-200 bg-white pb-zone-sure shadow-xl duration-[600ms] ease-jx motion-reduce:transition-none supports-[height:1dvh]:h-[min(72dvh,560px)] dark:border-zinc-800 dark:bg-zinc-900 sm:max-w-2xl sm:border-x court:h-[92vh] court:supports-[height:1dvh]:h-[92dvh] lg:visible lg:static lg:z-auto lg:mx-0 lg:h-auto lg:min-h-0 lg:w-[520px] lg:max-w-none lg:shrink-0 lg:translate-y-0 lg:rounded-none lg:border-x-0 lg:border-l lg:border-t-0 lg:bg-zinc-50 lg:pb-0 lg:shadow-none lg:transition-none lg:supports-[height:1dvh]:h-auto lg:dark:bg-zinc-950";
</script>

{#if enBoite}
  <!-- Voile : un appui à côté ferme la feuille, comme le tiroir des conversations. -->
  <div
    class="fixed inset-0 z-[55] bg-zinc-950/40"
    aria-hidden="true"
    on:click={surFermer}
    transition:fade={{ duration: duree(450) }}
  ></div>
{/if}

<aside
  bind:this={boite}
  id="cites"
  role={enBoite ? "dialog" : undefined}
  aria-modal={enBoite ? "true" : undefined}
  aria-labelledby={idTitre}
  data-testid="chat-preview"
  data-mode={modale ? "feuille" : "panneau"}
  data-etat={etat}
  on:keydown={surTabulation}
  class="{CLASSES} {ouvert
    ? 'visible translate-y-0 transition-transform'
    : 'invisible translate-y-full transition-[transform,visibility]'} {depart === null ? '' : '!transition-none'}"
  style={decalage ? `transform: translateY(${decalage}px)` : undefined}
>
  <!-- La poignée et l'en-tête se tirent vers le bas (feuille seulement) ;
       `touch-none` : le geste ne fait ni défiler ni recharger la page. Un
       geste du pointeur en plus, sans rôle : au clavier, « Fermer » et Échap
       font la même chose. Écran court : la poignée se pose dans la marge du
       haut au lieu de prendre sa ligne. -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="relative shrink-0 touch-none px-4 pt-2 lg:touch-auto lg:px-6 lg:pb-3 lg:pt-5"
    on:pointerdown={debutDuGeste}
    on:pointermove={suiteDuGeste}
    on:pointerup={finDuGeste}
    on:pointercancel={finDuGeste}
  >
    <div
      class="mx-auto mb-2 h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700 court:absolute court:inset-x-0 court:top-1 court:mb-0 lg:hidden"
      aria-hidden="true"
    ></div>
    <div class="flex min-h-11 items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-2">
        <h2 id={idTitre} class="text-base font-bold text-zinc-950 dark:text-white">{t("chat.preuves.titre")}</h2>
        {#if cartes.length}
          <!-- Le geste « compter » : la pastille naît avec les articles. -->
          <span
            data-testid="chat-preuves-nombre"
            class="mv-ressort inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-zinc-950 px-1.5 text-xs font-bold tabular-nums text-white dark:bg-white dark:text-zinc-950"
            >{cartes.length}</span
          >
        {/if}
      </div>
      <button
        type="button"
        bind:this={boutonFermer}
        data-testid="chat-preview-close"
        on:click={surFermer}
        class="-mr-1 inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-zinc-300 px-3 text-sm font-semibold text-zinc-800 transition-colors hover:border-zinc-950 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-white lg:hidden"
      >
        <Icone nom="x" class="text-lg" />{t("common.close")}
      </button>
    </div>
  </div>

  <div data-zone-preuves class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-2 lg:px-6">
    {#if etat === "recherche"}
      <!-- Pas de role="status" : la page annonce déjà les étapes. -->
      <div class="space-y-3" aria-hidden="true" data-testid="chat-preuves-squelettes">
        {#each Array(squelettes) as _, i (i)}
          <div class="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div class="mv-squelette h-3 w-1/2 rounded"></div>
            <div class="mv-squelette mt-3 h-4 w-3/4 rounded"></div>
          </div>
        {/each}
      </div>
      <p class="sr-only">{t("chat.preuves.chargement")}</p>
    {:else if etat === "vide"}
      <!-- La pile de cartes de la maquette, IMMOBILE : elle y respirait, mais
           A2 § 2 n'admet de boucle que pendant une attente réelle, et il n'y
           a ici rien à attendre. -->
      <div class="flex h-full flex-col items-center justify-center gap-5 px-6 py-8 text-center" data-testid="chat-preuves-vide">
        <div class="relative h-24 w-44" aria-hidden="true">
          <div
            class="absolute inset-x-6 top-0 h-16 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
          ></div>
          <div
            class="absolute inset-x-3 top-3 h-16 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
          ></div>
          <div
            class="absolute inset-x-0 top-6 h-16 rounded-xl border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900"
          ></div>
        </div>
        <p class="max-w-xs text-sm text-zinc-600 dark:text-zinc-400">{t("chat.preuves.vide")}</p>
      </div>
    {:else}
      {#if !cartes.length}
        <p class="py-6 text-center text-sm text-zinc-600 dark:text-zinc-400" data-testid="chat-preuves-aucun">
          {t("chat.preuves.aucun")}
        </p>
      {/if}
      <div class="space-y-3">
        {#each cartes as carte, i (`${idMessage}-${i}`)}
          <div
            class={nouvelles ? "mv-carte" : ""}
            style={nouvelles ? `--d: ${Math.min(i * DECALAGE_DES_CARTES, DELAI_MAX)}ms` : undefined}
          >
            <CarteArticleCite
              {carte}
              idCarte="carte-{idMessage}-{i}"
              ouverte={carteOuverte === i}
              citationActive={carteOuverte === i && carte.citations.some((c) => c.indexCitation === citationActive)
                ? citationActive
                : null}
              precharger={i < CARTES_PRECHARGEES}
              {releveLe}
              {surAnnonce}
              surBasculer={() => surBasculer(i)}
            />
          </div>
        {/each}
      </div>

      {#if consultes.length}
        <div class="mt-3">
          <button
            type="button"
            data-testid="chat-consultes-toggle"
            aria-expanded={consultesDeplies}
            aria-controls="textes-consultes"
            on:click={() => (consultesDeplies = !consultesDeplies)}
            class="-ml-2 inline-flex min-h-11 items-center gap-1 px-2 text-left text-xs font-medium text-zinc-600 dark:text-zinc-400"
          >
            <Icone nom={consultesDeplies ? "chevron-up" : "chevron-down"} class="shrink-0 text-base" />
            {t("chat.consulted.title").replace("{n}", String(consultes.length))}
          </button>
          <ul
            id="textes-consultes"
            class="mt-1 divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 {consultesDeplies
              ? ''
              : 'hidden'}"
          >
            {#each consultes as texte, i (i)}
              <li>
                <a
                  href={adresseDeLArticle(texte.law_id, texte.articles?.length === 1 ? texte.articles[0] : null)}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="chat-texte-consulte"
                  class="flex min-h-11 items-center gap-3 px-3 py-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                >
                  <span class="min-w-0 flex-1">
                    <!-- Sans intitulé en base, « Texte sans intitulé », jamais la
                         cote interne (P2, P11 ; $lib/sources). -->
                    <span class="coupe-mots block text-sm font-medium text-zinc-950 dark:text-white"
                      >{designationDuTexteCite(texte.law_title, texte.law_reference).nom ||
                        t("chat.citation.sansIntitule")}</span
                    >
                    {#if ligneDuTexte(texte)}
                      <span class="coupe-mots block text-xs text-zinc-500 dark:text-zinc-400">{ligneDuTexte(texte)}</span>
                    {/if}
                    <span class="sr-only">{t("chat.preview.newTab")}</span>
                  </span>
                  <Icone nom="external-link" class="shrink-0 text-base text-zinc-400 dark:text-zinc-500" />
                </a>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    {/if}
  </div>

  <p
    data-testid="chat-preview-footer"
    class="shrink-0 border-t border-zinc-200 px-4 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400 court:py-1 lg:px-6 lg:py-3"
  >
    {t("chat.preview.official")}
  </p>

  <!-- La région d'annonce du chat tant que la feuille est modale (voir
       `annonce`). Toujours rendue : présente dès l'ouverture, elle est connue
       des lecteurs d'écran avant sa première phrase. Hors du flux (sr-only). -->
  <p class="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="chat-preview-announce">
    {annonce}
  </p>
</aside>
