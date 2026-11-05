<script lang="ts">
  /**
   * La note « Explication simplifiée (IA) » de la page d'un texte (refonte A,
   * maquette RefonteLecture) : l'explication d'un article par le modèle, dans
   * une carte posée à droite du texte à partir de 1 280 px, sous le texte en
   * dessous. Sortie de la page (`+page.svelte`, l'ancien bloc
   * `.ai-explanation` sous l'article), sans rien changer à ce qu'elle fait :
   * la page garde la requête, le jeton anti-course et la remise à zéro à chaque
   * article ; la note ne fait que montrer l'état qu'on lui donne et demander
   * une explication (`expliquer`).
   *
   * QUATRE ÉTATS, AVEC LEURS REPÈRES DE TEST. Repos (description, « Contenu
   * clé / Implications », bouton `law-explain`) ; attente (`law-explain-loading`,
   * `role="status"` : la balance pèse, l'annonce est le texte « Explication en
   * cours… », la balance et le squelette sont décoratifs) ; erreur
   * (`law-explain-error`, `role="alert"`, rouge : c'est bien une erreur,
   * « Réessayer » `law-explain-retry`) ; réponse (`law-explain-answer`,
   * `aria-live`, avertissement `law-explain-disclaimer`, « Régénérer »
   * `law-explain-regenerate`). Toujours, en bas : « Poser une question sur
   * cet article » (`law-ask`), un LIEN vers l'assistant, question pré-remplie
   * et non envoyée (décision L7) : il marche sans JavaScript et s'ouvre dans
   * un nouvel onglet.
   *
   * POURQUOI LA CLASSE `ai-explanation` RESTE. Les tests de bout en bout la
   * lisent : tout ce que l'IA rédige est en Inter, jamais dans la serif du
   * texte officiel (décision Q5, ux-lecteur.spec.ts) : habillée comme la loi,
   * une réponse générée paraîtrait plus sûre qu'elle ne l'est.
   *
   * POURQUOI LA RÉPONSE EN NŒUDS. Le markdown du modèle est reconnu par
   * `blocsDeReponse` et rendu bloc par bloc, jamais passé à `{@html}`.
   *
   * LE MOUVEMENT (A2). La note arrive après le statut (`mv-monter`, 0,9 s :
   * D9, aucun délai au-delà d'une seconde) ; la balance pèse pendant l'attente
   * réelle ; la réponse arrive bloc par bloc, du flou au net (`mv-ecrire`).
   * Tout est sous « mouvement réduit = rien ne bouge » (mouvement.css) : le
   * style statique est l'état final, la note est lisible sans animation et
   * sans JavaScript.
   *
   * LE TRAIT ET LE POINT (`ancree`). Quand la page a calé la note sur un
   * passage surligné (action `ancrerLaNote`, à partir de 1 280 px), un trait
   * et un point la relient à la ligne du passage ; le trait passe à l'encre
   * quand la réponse est là. Sans passage (la v1 n'en a aucun : décision L2),
   * ni trait ni point : rien ne vise le vide.
   */
  import { createEventDispatcher } from "svelte";
  import BalanceAnimee from "$lib/components/BalanceAnimee.svelte";
  import Icone from "$lib/components/Icone.svelte";
  import { tr } from "$lib/stores/language";
  import { blocsDeReponse } from "$lib/texte";

  /** La réponse du modèle (markdown), vide tant qu'il n'y en a pas. */
  export let explication = "";
  /** Une explication est demandée et pas encore arrivée. */
  export let enCours = false;
  /** Le message d'erreur à montrer, vide sinon. */
  export let erreur = "";
  /** « Poser une question sur cet article » : `/chat?q=…`, pré-rempli. */
  export let lienQuestion = "/chat";
  /** Calée sur un passage surligné : trait et point (à partir de 1 280 px). */
  export let ancree = false;
  /** Arrive au chargement de la page ; faux quand la note est recréée en cours de lecture. */
  export let entree = true;

  const dispatch = createEventDispatcher<{ expliquer: null }>();

  function expliquer() {
    dispatch("expliquer", null);
  }

  /**
   * Décalage d'un bloc de la réponse : 450 ms de l'un à l'autre (A2 § 3.5),
   * plafonné à 0,9 s (D9) : une réponse de dix blocs ne fait pas attendre
   * son dernier paragraphe quatre secondes.
   */
  const ECART_DES_BLOCS = 450;
  const DELAI_MAXIMAL = 900;
  const delai = (rang: number) => Math.min(rang * ECART_DES_BLOCS, DELAI_MAXIMAL);

  /** La réponse est affichée : le trait d'ancrage passe à l'encre. */
  $: vivante = Boolean(explication) && !enCours && !erreur;
</script>

<div
  class="ai-explanation relative rounded-2xl border border-zinc-200 bg-white p-[18px] shadow-feuille coupe-mots dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-feuille-sombre"
  class:mv-monter={entree}
  class:ancree
  class:vivante
  style="--d: 900ms; --mv-duree: 0.7s"
  {...$$restProps}
>
  <!-- h3 : après le h2 « Article N » de la colonne voisine, sans sauter de
       niveau ; les titres de la réponse sont des h4. -->
  <h3 class="flex items-center gap-2 text-sm font-bold text-zinc-950 dark:text-white">
    <Icone nom="sparkles" class="shrink-0 text-base" />
    {$tr("loi.ia.titre")}
  </h3>

  {#if enCours}
    <div
      role="status"
      aria-live="polite"
      data-testid="law-explain-loading"
      class="mt-3 flex items-center gap-2.5 text-[13px] font-medium text-zinc-950 dark:text-white"
    >
      <!-- La balance pèse pendant l'attente réelle (A2 § 3.1). Décorative :
           l'annonce est le texte qui suit. -->
      <BalanceAnimee etat="attente" class="shrink-0 text-[22px]" />
      {$tr("loi.ia.en_cours")}
    </div>
    <div class="mt-3 grid gap-2" aria-hidden="true">
      <div class="mv-squelette h-2.5 w-[40%] rounded-md"></div>
      <div class="mv-squelette h-2.5 w-[94%] rounded-md"></div>
      <div class="mv-squelette h-2.5 w-[72%] rounded-md"></div>
    </div>
  {:else if erreur}
    <div
      role="alert"
      data-testid="law-explain-error"
      class="mt-3 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
    >
      <Icone nom="circle-alert" class="mt-0.5 shrink-0 text-base" />
      <div class="min-w-0">
        <p>{erreur}</p>
        <button
          type="button"
          on:click={expliquer}
          data-testid="law-explain-retry"
          class="mt-2 inline-flex min-h-11 items-center font-medium underline hover:no-underline lg:[@media(pointer:fine)]:min-h-0"
        >
          {$tr("common.retry")}
        </button>
      </div>
    </div>
  {:else if explication}
    <div
      data-testid="law-explain-answer"
      aria-live="polite"
      class="mt-3 space-y-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300"
    >
      {#each blocsDeReponse(explication) as bloc, i (i)}
        {#if bloc.type === "titre"}
          <h4 class="mv-ecrire pt-1 font-semibold text-zinc-950 dark:text-white" style="--d: {delai(i)}ms">
            {bloc.texte}
          </h4>
        {:else if bloc.type === "puce"}
          <p
            class="mv-ecrire relative pl-5 before:absolute before:left-1 before:font-bold before:text-zinc-950 before:content-['•'] dark:before:text-white"
            style="--d: {delai(i)}ms"
          >
            {bloc.texte}
          </p>
        {:else}
          <p class="mv-ecrire" style="--d: {delai(i)}ms">{bloc.texte}</p>
        {/if}
      {/each}
    </div>
    <p class="mt-3 text-xs leading-[17px] text-zinc-600 dark:text-zinc-400" data-testid="law-explain-disclaimer">
      {$tr("loi.ia.avertissement")}
    </p>
    <!-- Un bouton texte, comme la maquette : la réponse est là, la régénérer
         n'est plus l'action principale. L'icône fait un tour au survol. -->
    <button
      type="button"
      on:click={expliquer}
      data-testid="law-explain-regenerate"
      class="group mt-1 inline-flex min-h-11 items-center gap-2 rounded-lg text-[13px] font-semibold text-zinc-600 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white lg:[@media(pointer:fine)]:min-h-10"
    >
      <Icone
        nom="rotate-ccw"
        class="shrink-0 text-[15px] ease-jx motion-safe:transition-transform motion-safe:duration-[600ms] motion-safe:group-hover:-rotate-[360deg]"
      />
      {$tr("loi.ia.regenerer")}
    </button>
  {:else}
    <p class="mt-2 text-[13px] leading-5 text-zinc-600 dark:text-zinc-400">{$tr("loi.ia.description")}</p>
    <ul class="mb-3.5 mt-2.5 grid gap-1 text-[13px] leading-[19px] text-zinc-600 dark:text-zinc-400">
      <li>
        <strong class="font-semibold text-zinc-950 dark:text-white">{$tr("loi.ia.contenu_cle")}</strong>
        {$tr("loi.ia.contenu_cle_desc")}
      </li>
      <li>
        <strong class="font-semibold text-zinc-950 dark:text-white">{$tr("loi.ia.implications")}</strong>
        {$tr("loi.ia.implications_desc")}
      </li>
    </ul>
    <!-- Le seul bouton plein de la page (maquette) ; une étoile seule
         (`sparkle`, décision D14), qui tourne un peu au survol. -->
    <button
      type="button"
      on:click={expliquer}
      data-testid="law-explain"
      class="group inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 sm:w-auto lg:[@media(pointer:fine)]:min-h-10"
    >
      <Icone
        nom="sparkle"
        class="shrink-0 text-[15px] ease-jx motion-safe:transition-transform motion-safe:duration-[400ms] motion-safe:group-hover:rotate-[18deg] motion-safe:group-hover:scale-[1.15]"
      />
      {$tr("loi.ia.expliquer")}
    </button>
  {/if}

  <a
    href={lienQuestion}
    data-testid="law-ask"
    class="group mt-1.5 flex min-h-11 w-fit items-center gap-2 rounded-lg text-[13px] font-semibold text-zinc-700 transition-colors hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
  >
    <Icone
      nom="message-circle"
      class="shrink-0 text-base ease-jx motion-safe:transition-transform motion-safe:duration-[350ms] motion-safe:group-hover:-translate-y-0.5"
    />
    {$tr("loi.ia.poser_question")}
  </a>
</div>

<style>
  /*
   * Le trait et le point qui relient la note à son passage, seulement dans la
   * marge (à partir de 1 280 px) et seulement quand la note est calée sur un
   * passage (`ancree`). Couleurs de l'échelle zinc écrites en clair : un
   * pseudo-élément ne prend pas de classe Tailwind. Le trait est pâle tant que
   * la réponse n'est pas là, à l'encre ensuite (maquette, `.note.live`).
   */
  @media (min-width: 1280px) {
    .ancree::before {
      content: "";
      position: absolute;
      left: -44px;
      top: 28px;
      width: 44px;
      height: 1px;
      background-color: #d4d4d8; /* zinc-300 */
      pointer-events: none;
    }

    .ancree::after {
      content: "";
      position: absolute;
      left: -48px;
      top: 24px;
      width: 9px;
      height: 9px;
      border-radius: 9999px;
      background-color: #09090b; /* zinc-950 */
      pointer-events: none;
    }

    .ancree.vivante::before {
      background-color: #09090b;
    }

    :global(.dark) .ancree::before {
      background-color: #3f3f46; /* zinc-700 */
    }

    :global(.dark) .ancree::after,
    :global(.dark) .ancree.vivante::before {
      background-color: #ffffff;
    }
  }

  /*
   * Le trait se trace depuis le passage, puis le point se pose (A2 § 4,
   * « Trait d'ancrage ») : délais sous une seconde (D9 ; la maquette disait
   * 1,2 et 1,8 s). Les @keyframes sont ceux de mouvement.css (`mv-tracer`,
   * `mv-ressort`), déclarés eux aussi sous « no-preference ».
   */
  @media (min-width: 1280px) and (prefers-reduced-motion: no-preference) {
    .ancree::before {
      transform-origin: left;
      animation: mv-tracer 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.45s backwards;
    }

    .ancree::after {
      animation: mv-ressort 0.4s cubic-bezier(0.3, 1.6, 0.5, 1) 0.8s backwards;
    }
  }
</style>
