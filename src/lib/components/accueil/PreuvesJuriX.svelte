<script lang="ts">
  /**
   * « Ce que JuriX vous montre » (refonte A, E3b, décision H11) : trois
   * cartes, trois gestes du produit montrés en petit. Citer (une puce
   * d'article se pose à côté de sa phrase), tamponner (trois statuts tombent
   * l'un après l'autre), surligner (le passage cité se souligne).
   *
   * ÉTAT FINAL D'ABORD. Le HTML du serveur montre les trois démonstrations
   * finies, lisibles sans JavaScript, en mouvement réduit et pour un moteur de
   * recherche. L'état « armé » (éléments masqués en attendant l'entrée dans
   * l'écran) n'est posé qu'après le montage, et seulement si
   * IntersectionObserver existe, si le mouvement est permis et si la section
   * n'est pas DÉJÀ à l'écran (sinon elle disparaîtrait puis reviendrait sous
   * les yeux). Quand 30 % de la section entrent dans l'écran, les gestes se
   * jouent une fois ; au repos, le survol d'une carte (souris seulement)
   * rejoue la sienne.
   *
   * POURQUOI LE SEUIL NE SUFFIT PAS. Armés, la puce, les statuts et le
   * surlignage sont invisibles : s'ils ne se jouent jamais, ils le restent.
   * Or 30 % de la section peuvent ne jamais tenir dans l'écran : à 400 % de
   * zoom (320 × 180 px utiles, WCAG 1.4.10), les trois cartes empilées font
   * cinq écrans de haut. La section compte donc aussi pour arrivée quand elle
   * occupe 30 % de l'écran (`estArrivee`), et l'observateur a des seuils plus
   * bas pour s'en apercevoir.
   *
   * LES TEXTES. Contenu statique d'illustration (clés i18n), jamais présenté
   * comme une réponse : les extraits français citent l'article 37 de la loi
   * n° 92/007 (Code du travail), relu dans le corpus ; le corpus n'ayant pas
   * son texte anglais, les extraits anglais en sont une traduction, marquée
   * « Example » (décision X6 ⚑, voir src/lib/stores/language.ts). La pastille
   * reprend le format des puces d'articles de la recherche
   * (`search.articleChip`). Les statuts sont les
   * mots et les icônes de la page d'un texte : un mot et une icône, jamais
   * la couleur seule.
   */
  import { onDestroy, onMount } from "svelte";
  import { prefersReducedMotion } from "svelte/motion";
  import Icone from "$lib/components/Icone.svelte";
  import { remplir } from "$lib/components/listes/reperes";
  import { tr } from "$lib/stores/language";

  type Etat = "repos" | "arme" | "joue";

  /** Durée du jeu complet : le dernier statut (0,3 s + 0,6 s) et le surlignage (0,15 s + 1 s). */
  const DUREE_DU_JEU = 1400;

  /** La part de la section, ou de l'écran, à partir de laquelle elle est arrivée. */
  const PART_VISIBLE = 0.3;

  /** Voir l'en-tête : la section est arrivée, même plus haute que l'écran. */
  function estArrivee(entree: IntersectionObserverEntry): boolean {
    if (!entree.isIntersecting) return false;
    return entree.intersectionRatio >= PART_VISIBLE || entree.intersectionRect.height >= PART_VISIBLE * window.innerHeight;
  }

  let etat: Etat = "repos";
  let grille: HTMLDivElement | undefined;
  let observateur: IntersectionObserver | null = null;
  let minuterie: ReturnType<typeof setTimeout> | null = null;

  onMount(() => {
    if (prefersReducedMotion.current || typeof IntersectionObserver === "undefined" || !grille) return;
    const boite = grille.getBoundingClientRect();
    if (boite.top < window.innerHeight && boite.bottom > 0) return;
    etat = "arme";
    observateur = new IntersectionObserver(
      (entrees) => {
        if (!entrees.some(estArrivee)) return;
        observateur?.disconnect();
        observateur = null;
        etat = "joue";
        minuterie = setTimeout(() => (etat = "repos"), DUREE_DU_JEU);
      },
      { threshold: [0.1, 0.2, PART_VISIBLE] },
    );
    observateur.observe(grille);
  });

  onDestroy(() => {
    observateur?.disconnect();
    if (minuterie !== null) clearTimeout(minuterie);
  });

  $: article = remplir($tr("search.articleChip"), { n: 37 });
  $: [avantLePassage, apresLePassage] = $tr("accueil.preuves.demo.extrait2").split("{passage}");

  const CARTE = "carte rounded-2xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900";
  const DEMO =
    "flex h-[132px] items-center justify-center overflow-hidden rounded-xl bg-zinc-50 dark:bg-zinc-800/50";
  const TITRE = "mx-1.5 mt-4 text-[17px]/6 font-bold text-zinc-950 dark:text-white";
  const TEXTE = "mx-1.5 mb-1.5 mt-1 text-sm/[21px] text-zinc-600 dark:text-zinc-400";
  const STATUT =
    "demo-statut flex min-w-[14.75rem] items-center gap-2.5 rounded-xl px-3.5 py-[9px] text-[13px]/[18px] font-medium text-zinc-700 dark:text-zinc-300";
</script>

<section aria-labelledby="accueil-preuves-titre" data-testid="accueil-preuves" class="mt-16 w-full text-left sm:mt-28">
  <h2
    id="accueil-preuves-titre"
    class="font-titre text-2xl/[1.2] font-semibold text-zinc-950 dark:text-white sm:text-3xl/[1.2]"
  >
    {$tr("accueil.preuves.titre")}
  </h2>
  <p class="mb-6 mt-2 text-base text-zinc-600 dark:text-zinc-400 sm:mb-7">
    {$tr("accueil.preuves.sousTitre")}
    {$tr("chat.preview.official")}
  </p>

  <div
    bind:this={grille}
    class="grid grid-cols-1 gap-5 lg:grid-cols-3"
    class:arme={etat === "arme"}
    class:joue={etat === "joue"}
    class:repos={etat === "repos"}
    data-etat={etat}
  >
    <article class={CARTE}>
      <div class={DEMO}>
        <div class="grid justify-items-center gap-2.5 px-4 text-center font-texte text-sm/normal text-zinc-700 dark:text-zinc-300">
          <span>{$tr("accueil.preuves.demo.extrait1")}</span>
          <span
            class="demo-puce rounded-full border border-zinc-300 bg-white px-2.5 font-sans text-xs/[26px] font-semibold text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            >{article}</span
          >
        </div>
      </div>
      <h3 class={TITRE}>{$tr("accueil.preuves.cite.titre")}</h3>
      <p class={TEXTE}>{$tr("accueil.preuves.cite.texte")}</p>
    </article>

    <article class={CARTE}>
      <div class={DEMO}>
        <ul class="grid gap-2">
          <li class="{STATUT} border border-dashed border-zinc-300 dark:border-zinc-700" style="--k: 0">
            <Icone nom="circle-dashed" class="text-base" />{$tr("accueil.preuves.demo.statutOrigine")}
          </li>
          <li class="{STATUT} bg-zinc-100 dark:bg-zinc-800" style="--k: 1">
            <Icone nom="rotate-ccw-clock" class="text-base" />{$tr("accueil.preuves.demo.statutModifie")}
          </li>
          <li class="{STATUT} bg-zinc-100 dark:bg-zinc-800" style="--k: 2">
            <Icone nom="archive" class="text-base" />{$tr("accueil.preuves.demo.statutAbroge")}
          </li>
        </ul>
      </div>
      <h3 class={TITRE}>{$tr("accueil.preuves.statut.titre")}</h3>
      <p class={TEXTE}>{$tr("accueil.preuves.statut.texte")}</p>
    </article>

    <article class={CARTE}>
      <div class={DEMO}>
        <!-- Le passage : fond de marqueur ET soulignement de 2 px de l'encre
             (`mv-surligne`, A2 § 3.2) ; le fond seul (1,5:1) ne porterait pas
             le sens. Un <mark>, pour sa sémantique. -->
        <p class="px-[18px] text-center font-texte text-base/[1.7] text-zinc-950 dark:text-white">
          {avantLePassage}<mark class="mv-surligne demo-passage">{$tr("accueil.preuves.demo.passage")}</mark
          >{apresLePassage}
        </p>
      </div>
      <h3 class={TITRE}>{$tr("accueil.preuves.verif.titre")}</h3>
      <p class={TEXTE}>{$tr("accueil.preuves.verif.texte")}</p>
    </article>
  </div>
</section>

<style>
  /*
   * Les gestes des démonstrations. Tout est sous « no-preference » : en
   * mouvement réduit, aucune règle ne s'applique et l'état final reste
   * affiché (A2 § 2.1). Entrées en `backwards` et @keyframes sans « to » :
   * l'animation s'efface devant le style réel de l'élément (A2 § 2.2).
   * À l'écran seulement : une page imprimée avant d'avoir défilé jusqu'ici
   * sortirait, sinon, avec ses démonstrations invisibles.
   */
  @media screen and (prefers-reduced-motion: no-preference) {
    /* Armé : en attendant l'entrée dans l'écran, posé après le montage seulement. */
    .arme .demo-puce,
    .arme .demo-statut {
      opacity: 0;
    }

    .arme .demo-passage {
      background-size:
        0 0.42em,
        0 2px;
    }

    /* Citer : la puce se pose avec un petit ressort (exception de A2 § 1). */
    .joue .demo-puce {
      animation: preuve-citer 0.7s cubic-bezier(0.3, 1.6, 0.5, 1) backwards;
    }

    /* Tamponner : les statuts tombent l'un après l'autre (150 ms d'écart). */
    .joue .demo-statut {
      animation: preuve-tamponner 0.6s cubic-bezier(0.22, 1, 0.36, 1) backwards;
      animation-delay: calc(var(--k) * 150ms);
    }

    /* Surligner : le fond et le trait se dessinent de gauche à droite. */
    .joue .demo-passage {
      animation: preuve-surligner 1s cubic-bezier(0.22, 1, 0.36, 1) 0.15s backwards;
    }

    /* Au repos, la carte survolée rejoue sa démonstration (souris seulement). */
    @media (hover: hover) {
      .repos .carte:hover .demo-puce {
        animation: preuve-citer 0.7s cubic-bezier(0.3, 1.6, 0.5, 1) backwards;
      }

      .repos .carte:hover .demo-statut {
        animation: preuve-tamponner 0.6s cubic-bezier(0.22, 1, 0.36, 1) backwards;
        animation-delay: calc(var(--k) * 150ms);
      }

      .repos .carte:hover .demo-passage {
        animation: preuve-surligner 1s cubic-bezier(0.22, 1, 0.36, 1) 0.15s backwards;
      }
    }

    @keyframes preuve-citer {
      0% {
        opacity: 0;
        transform: translateY(6px) scale(0.6);
      }
    }

    @keyframes preuve-tamponner {
      0% {
        opacity: 0;
        transform: translateY(-10px) scale(1.1);
      }
      60% {
        opacity: 1;
        transform: scale(0.97);
      }
    }

    @keyframes preuve-surligner {
      0% {
        background-size:
          0 0.42em,
          0 2px;
      }
    }
  }
</style>
