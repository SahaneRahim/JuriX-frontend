<script lang="ts">
  /**
   * Une liste de textes par lots de 20 (P11 A) : /laws et la page d'un domaine.
   *
   * « AFFICHER 20 DE PLUS », AVEC ET SANS JAVASCRIPT. Le bouton est un lien
   * vers `?page=N+1` (contrat §5.3) : sans JavaScript, il ouvre le lot suivant
   * (rendu au serveur et mis en cache, ISR), précédé d'un lien vers le lot
   * d'avant. Avec JavaScript, SvelteKit suit le même lien sans recharger, et
   * cette liste AJOUTE le lot reçu à ceux déjà affichés : l'adresse dit le
   * dernier lot chargé, l'écran les montre tous. Un autre filtre repart du
   * seul lot reçu.
   *
   * LE RETOUR ARRIÈRE RETROUVE LA LISTE. Ouvrir un texte détruit la liste, et
   * l'adresse ne dit que le dernier lot : revenue par « Précédent », elle ne
   * montrait que lui, et la page, plus courte, s'arrêtait sur son pied. La
   * page garde donc la liste dans l'historique (son `snapshot`, qui appelle
   * `capturer` et `restaurer`) : les lots affichés et la position de
   * défilement reviennent tels quels, au retour arrière comme au
   * rechargement.
   *
   * Lots de 20 et non une page de 50 cartes : 13 795 px pour 50 fiches à
   * 360 px de large (étude mobile du 28/10/2026) ; « Load more » après 15 à
   * 30 éléments sur mobile (Baymard, cité par P11).
   *
   * CE QUE LA LISTE N'AFFIRME PAS. Le total (« 1 277 textes ») et l'ordre
   * (« Du plus récent au plus ancien ») ne s'écrivent que si l'API les donne :
   * l'ancienne API ne rend ni total ni ordre garanti ($lib/api-publique,
   * listerTextes).
   */
  import { tick } from "svelte";
  import { afterNavigate } from "$app/navigation";
  import { language, tr } from "$lib/stores/language";
  import type { TriDesTextes } from "$lib/types";
  import LigneDeTexte from "./LigneDeTexte.svelte";
  import { adresseDuLot, etatARestaurer, type EtatDeLaListe, type LigneAffichee as Ligne } from "./lots";
  import { cleSelonNombre, formatNombre, remplir } from "./reperes";

  /** Le lot reçu du `load`. */
  export let lignes: Ligne[];
  /** Son numéro, à partir de 1. */
  export let page: number;
  export let parPage: number;
  /** Nombre total de textes ; `null` : inconnu (ancienne API), non affiché. */
  export let total: number | null;
  /** Il existe un lot suivant. */
  export let suivante: boolean;
  /** Ordre garanti par l'API ; `null` : aucun (ancienne API), non annoncé. */
  export let tri: TriDesTextes | null;
  /** Le chemin de la liste (« /laws », « /categories/13 »). */
  export let chemin: string;
  /** Ses filtres dans l'adresse (`lang`, `category`), sans valeur par défaut ni `page`. */
  export let filtres: Record<string, string> = {};
  /** Message d'une liste vide dès le premier lot (« Aucun document… »). */
  export let vide: string;

  let affichees: Ligne[] = [];
  /** Numéro du premier lot affiché : plus de 1 quand la page s'ouvre sur `?page=N`. */
  let premierePage = 1;
  let dernierePage = 0;
  let derniereCle: string | null = null;
  /** Première ligne ajoutée par « Afficher 20 de plus », qui recevra le focus. */
  let aFocaliser: number | null = null;
  /** Un lot demandé par le bouton, pas encore arrivé. */
  let demande = false;

  /**
   * Un clic qui reste dans la page (ni nouvel onglet ni nouvelle fenêtre) :
   * seul celui-là attend un lot ici.
   */
  function surDemande(event: MouseEvent) {
    if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) demande = true;
  }

  /**
   * L'identité de la liste hors pagination : l'adresse de son premier lot. Un
   * lot n'est ajouté aux précédents que pour la même liste (mêmes filtres).
   */
  $: cle = adresseDuLot(chemin, filtres, 1);

  // Seules les données reçues déclenchent ce bloc ; `suivre` lit et écrit
  // l'état de la liste sans en dépendre.
  $: suivre(lignes, page, cle);

  function suivre(recues: Ligne[], n: number, c: string) {
    demande = false;
    if (c === derniereCle && n === dernierePage + 1 && affichees.length) {
      // Une ligne déjà vue n'est pas reprise : entre deux lots, un texte
      // ajouté au corpus décale la liste d'un rang.
      const vues = new Set(affichees.map((l) => l.id));
      const ajout = recues.filter((l) => !vues.has(l.id));
      affichees = [...affichees, ...ajout];
      aFocaliser = ajout[0]?.id ?? null;
    } else {
      affichees = recues;
      premierePage = n;
      aFocaliser = null;
    }
    derniereCle = c;
    dernierePage = n;
  }

  /**
   * La liste telle qu'on la quitte, pour le `snapshot` de la page ; `null`
   * quand elle ne montre qu'un lot, que la page rouverte rendra tel quel.
   * Appelée par SvelteKit au départ de chaque navigation et quand l'onglet
   * passe en arrière-plan, juste après qu'il a noté la position de défilement :
   * la même, lue ici.
   */
  export function capturer(): EtatDeLaListe | null {
    if (derniereCle === null || dernierePage <= premierePage || !affichees.length) return null;
    return {
      cle: derniereCle,
      premierePage,
      dernierePage,
      lignes: affichees,
      x: window.scrollX,
      y: window.scrollY,
    };
  }

  /**
   * Reprend une liste gardée par `capturer`, si c'est celle-ci au même lot
   * (`etatARestaurer`), puis revient à la position de défilement du départ.
   *
   * SvelteKit rend d'abord sa position de défilement, PUIS l'état gardé (au
   * retour arrière comme au rechargement) : sur la page encore courte, le
   * navigateur l'avait ramenée en bas. Une fois les lignes rendues, la
   * position est donc reprise ici. Pas de focus posé : on revient à une
   * lecture, pas à une liste qui s'allonge.
   */
  export function restaurer(etat: unknown): void {
    const reprise = etatARestaurer(etat, cle, page);
    if (!reprise) return;
    affichees = reprise.lignes;
    premierePage = reprise.premierePage;
    dernierePage = reprise.dernierePage;
    derniereCle = reprise.cle;
    aFocaliser = null;
    demande = false;
    void tick().then(() => window.scrollTo(reprise.x, reprise.y));
  }

  /**
   * Le focus va à la première ligne ajoutée, une fois la page mise à jour :
   * au clavier, on poursuit la lecture là où elle s'arrêtait, au lieu de
   * repartir du haut (SvelteKit ramène sinon le focus au début de la page).
   */
  afterNavigate(() => {
    if (aFocaliser === null) return;
    const lien = document.getElementById(`texte-${aFocaliser}`);
    aFocaliser = null;
    lien?.focus();
  });

  $: langue = $language.current;
  $: lienDebut = adresseDuLot(chemin, filtres, 1);
  $: lienPrecedent = adresseDuLot(chemin, filtres, premierePage - 1);
  $: lienSuivant = adresseDuLot(chemin, filtres, dernierePage + 1);
  /** Rang du premier texte affiché : 21 quand la liste s'ouvre sur `?page=2`. */
  $: premierRang = (premierePage - 1) * parPage + 1;
  /** Rang du dernier texte affiché (« 40 » dans « 40 sur 1 277 textes »). */
  $: dernierRang = (premierePage - 1) * parPage + affichees.length;
  /** Le lot suivant compte 20 textes, moins s'il n'en reste pas autant. */
  $: prochainLot = total === null ? parPage : Math.max(0, Math.min(parPage, total - dernierRang));
  $: totalTexte =
    total === null ? "" : remplir($tr(cleSelonNombre("listes.total", total, langue)), { n: formatNombre(total, langue) });
  $: afficheesTexte =
    premierePage > 1
      ? remplir($tr("listes.plage"), {
          debut: formatNombre(premierRang, langue),
          fin: formatNombre(dernierRang, langue),
        })
      : remplir($tr(cleSelonNombre("listes.affiches", affichees.length, langue)), {
          n: formatNombre(affichees.length, langue),
        });
  /**
   * Sous le bouton, où l'on en est dans la liste. Partie du premier lot :
   * « 40 sur 1 277 textes », les 40 sont à l'écran. Ouverte plus loin (sans
   * JavaScript, ou une adresse partagée) : « 21 à 40 sur 1 277 textes ».
   * « 40 sur 1 277 » s'y lisait « 40 affichés » pour vingt lignes à l'écran,
   * et contredisait la ligne du haut (« 21 à 40 affichés »).
   */
  $: progression =
    total === null
      ? ""
      : premierePage > 1
        ? remplir($tr("listes.plageSurTotal"), {
            debut: formatNombre(premierRang, langue),
            fin: formatNombre(dernierRang, langue),
            total: formatNombre(total, langue),
          })
        : remplir($tr("listes.surTotal"), { n: formatNombre(dernierRang, langue), total: formatNombre(total, langue) });
</script>

{#if affichees.length === 0}
  <!-- Au-delà de la fin (une adresse `?page=` trop grande) : le chemin du
       début, plutôt qu'une liste vide sans issue. -->
  <div
    class="rounded-2xl border border-zinc-200 bg-white px-4 py-10 text-center dark:border-zinc-800 dark:bg-zinc-900 sm:py-14"
  >
    {#if page > 1}
      <p class="text-zinc-600 dark:text-zinc-400">{$tr("listes.auDelaDeLaFin")}</p>
      <a
        href={lienDebut}
        class="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-zinc-950 underline decoration-zinc-400 underline-offset-4 hover:decoration-zinc-950 dark:text-white dark:decoration-zinc-500 dark:hover:decoration-white"
        >{$tr("listes.retourDebut")}</a
      >
    {:else}
      <p class="text-zinc-600 dark:text-zinc-400">{vide}</p>
    {/if}
  </div>
{:else}
  <!-- « 1 277 textes · 20 affichés » et l'ordre, tels que l'API les garantit.
       `aria-live` : après « Afficher 20 de plus », un lecteur d'écran entend
       « 40 affichés » ; rien n'est annoncé à l'ouverture de la page. -->
  {#if total !== null || tri === "date_desc"}
    <div
      class="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 pl-1 text-sm text-zinc-600 dark:text-zinc-400"
    >
      <p class="tabular-nums" aria-live="polite">
        <!-- Le blanc après « · » est celui qui précède `afficheesTexte`, hors
             du bloc {#if} : à son bord, Svelte le retirait (« 1 277 textes
             ·20 affichés »). -->
        {#if total !== null}
          <span class="font-semibold text-zinc-950 dark:text-white">{totalTexte}</span> ·
        {/if}
        {afficheesTexte}
      </p>
      {#if tri === "date_desc"}
        <p>{$tr("listes.triRecent")}</p>
      {/if}
    </div>
  {/if}

  <!-- Ouverte sur un lot plus loin que le premier (sans JavaScript, ou une
       adresse partagée) : le lot d'avant, d'un lien. -->
  {#if premierePage > 1}
    <p class="mb-3 pl-1">
      <a
        href={lienPrecedent}
        class="inline-flex min-h-11 items-center text-sm font-medium text-zinc-950 underline decoration-zinc-400 underline-offset-4 hover:decoration-zinc-950 dark:text-white dark:decoration-zinc-500 dark:hover:decoration-white"
        >{remplir($tr("listes.precedents"), { n: parPage })}</a
      >
    </p>
  {/if}

  <!-- Une liste bordée à filets (maquette domaine-p11a). `role="list"` :
       Safari ne lit plus comme une liste un <ul> sans puces. Le bouton
       flottant de l'assistant se retire quand elle passe dessous. -->
  <ul
    role="list"
    data-hors-du-bouton
    class="divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800"
  >
    {#each affichees as ligne (ligne.id)}
      <LigneDeTexte {ligne} />
    {/each}
  </ul>

  {#if suivante && prochainLot > 0}
    <div class="mt-6 flex flex-col items-center gap-2 text-center" data-hors-du-bouton>
      <!-- Le lien du lot suivant, à la recette du bouton secondaire de la
           maquette. `noscroll` : la liste s'allonge sous les yeux au lieu de
           remonter en haut ; `keepfocus` : le focus est posé ensuite sur la
           première ligne ajoutée (afterNavigate). `aria-busy` le temps que le
           lot arrive. -->
      <a
        href={lienSuivant}
        data-sveltekit-noscroll
        data-sveltekit-keepfocus
        aria-busy={demande ? "true" : undefined}
        on:click={surDemande}
        class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-zinc-500 bg-white px-5 text-sm font-semibold text-zinc-950 transition-colors hover:border-zinc-950 dark:border-zinc-400 dark:bg-zinc-900 dark:text-white dark:hover:border-white {demande
          ? 'opacity-60'
          : ''}"
      >
        {remplir($tr("listes.plus"), { n: prochainLot })}
      </a>
      {#if total !== null}
        <p class="text-sm tabular-nums text-zinc-500 dark:text-zinc-400">{progression}</p>
      {/if}
    </div>
  {/if}
{/if}
