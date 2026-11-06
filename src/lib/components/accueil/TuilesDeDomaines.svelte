<script lang="ts">
  /**
   * « Parcourir le droit » : les domaines juridiques et « Tous les textes »
   * (refonte A, E3b), en tuiles au bureau, en pastilles qui défilent au
   * téléphone.
   *
   * UNE SEULE LISTE, DEUX DESSINS. Toujours la même <ul
   * data-testid="accueil-domaines">, une <li> par domaine puis « Tous les
   * textes » (15 avec les 14 domaines de la base) : quatre colonnes de tuiles
   * dès 1 024 px, deux de 640 à 1 023 px, et sous 640 px une rangée de
   * pastilles de 44 px qui défile à l'horizontale, d'un bord de l'écran à
   * l'autre (maquette mobile). Le même HTML pour tous : le serveur ne connaît
   * pas l'écran, et l'accueil est mis en cache.
   *
   * LE LIEN ÉTENDU (Q3 A, gardé). Le lien est sur le NOM (h3 > a) et son
   * ::after couvre toute la tuile ou la pastille ; la ligne de textes phares
   * le décrit (`aria-describedby`). Au téléphone, la pastille affiche le nom
   * très court (« Travail ») et le lien garde pour nom le nom court entier
   * (« Travail et sécurité sociale », en `sr-only`), qui contient ce qu'on
   * lit : le nom à l'écran est dans le nom accessible (WCAG 2.5.3,
   * src/lib/categories.ts, `nomPuce`).
   *
   * « TOUS LES TEXTES » : en pointillé, discret, sur deux colonnes quand la
   * rangée le permet (14 + 2 = 16 cases à quatre colonnes) ; au téléphone,
   * PREMIÈRE pastille (`order-first`), comme la maquette. L'ordre du clavier
   * reste celui du DOM, domaines d'abord : un ordre logique (WCAG 2.4.3).
   *
   * LE MOUVEMENT (A2 § 4). Arrivée en cascade (45 ms d'écart, sans délai
   * initial) ; au survol d'une tuile, elle monte de 4 px, son bord passe à
   * l'encre, la flèche part en diagonale et l'icône joue le geste de son
   * domaine (`gesteCategorie` : la balance pèse, le marteau frappe…), avec
   * une souris seulement (`hover: hover`, src/lib/mouvement.css). Rien de cela
   * en mouvement réduit.
   *
   * POURQUOI DES CLASSES NOMMÉES (`tuile-domaine…`, src/app.css). Quinze tuiles
   * répétaient leurs longues listes d'utilitaires dans le HTML de l'accueil :
   * environ 20 Ko de plus sur le chemin critique du téléphone, et du LCP perdu
   * (PASSATION § 7). Écrites une fois dans la feuille de style, elles
   * ne pèsent plus qu'une fois. `group` et les `mv-` restent ici : les
   * variantes `group-hover:` et mouvement.css les lisent sur l'élément.
   */
  import CategoryIcon from "$lib/components/CategoryIcon.svelte";
  import Icone from "$lib/components/Icone.svelte";
  import { gesteCategorie, nomCategorie, nomPuce, pharesCategorie, descriptionCategorie } from "$lib/categories";
  import type { Language } from "$lib/stores/language";
  import { tr } from "$lib/stores/language";
  import type { Category } from "$lib/types";

  /** Les domaines, déjà dans l'ordre de l'accueil. */
  export let domaines: Category[] = [];
  export let langue: Language = "fr";
  /** La ligne de « Tous les textes » : avec le nombre de textes du corpus, ou sans. */
  export let ligneTousLesTextes = "";

  /**
   * « Tous les textes » complète la dernière rangée : sur deux colonnes, la
   * rangée entière quand les domaines la remplissent (14), la case restante
   * sinon ; sur quatre colonnes, deux cases quand il en reste deux ou zéro,
   * la seule ou les trois restantes sinon. Le nombre de domaines vient de la
   * base : une case vide se lirait comme une tuile manquante. Classes écrites
   * en entier, pour que Tailwind les trouve.
   */
  const ETENDUE_SM = ["sm:col-span-2", "sm:col-span-1"];
  const ETENDUE_LG = ["lg:col-span-2", "lg:col-span-3", "lg:col-span-2", "lg:col-span-1"];
  $: etendueTousLesTextes = `${ETENDUE_SM[domaines.length % 2]} ${ETENDUE_LG[domaines.length % 4]}`;

  /**
   * Une tuile, ou une pastille sous sm. `relative` : elle contient le ::after
   * du lien. `group` : l'icône, la flèche et le nom réagissent au survol de
   * toute la tuile. Le survol n'existe qu'avec une souris
   * (`hoverOnlyWhenSupported`, tailwind.config.js).
   */
  const TUILE = "mv-geste mv-monter group relative tuile-domaine";

  /**
   * Carte pleine et filet des domaines ; « Tous les textes », sans fond, en
   * pointillé, plein au survol (jamais un gros bloc noir : A1 § 2).
   */
  const BORD_DOMAINE = "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900";
  const BORD_TOUS = "border-dashed border-zinc-300 dark:border-zinc-700 hover:border-solid sm:justify-between";

  /**
   * Le lien, sur le nom : son ::after couvre la tuile, et le contour de focus
   * est dessiné sur lui, en retrait de 4 px (la recette de la liste d'avant,
   * Q3 A). Un `outline` et non une ombre : il reste visible en contraste élevé.
   * POURQUOI `-inset-px` : le ::after se mesure depuis l'intérieur de la bordure
   * de la pastille, et la zone d'appui n'aurait fait que 42 px de haut. Il
   * recouvre donc aussi cette bordure : 44 px (redimensionnement.spec.ts).
   */
  const LIEN = "tuile-domaine__lien after:absolute after:-inset-px focus-visible:after:outline";

  /** L'icône du domaine : 17 px dans une pastille, 24 px sur une tuile. */
  const ICONE = "mv-geste__icone tuile-domaine__icone";

  /** La flèche ↗ des tuiles (pas des pastilles) : décorative, le lien est nommé. */
  const FLECHE = "tuile-domaine__fleche";

  const NOM = "tuile-domaine__nom";
  const LIGNE = "tuile-domaine__ligne";
</script>

<!--
  Sous sm, la liste défile de côté : elle déborde de la colonne jusqu'aux
  bords de l'écran (`-mx-4`, marges de <main>), et son propre défilement
  garde la page immobile. `py-1` : le contour de focus d'une pastille n'est
  pas rogné par le défilement. Barre de défilement masquée (la pastille
  coupée à droite dit qu'il y a une suite).
-->
<ul
  data-testid="accueil-domaines"
  aria-label={$tr("accueil.domaines.liste")}
  class="-mx-4 flex snap-x snap-proximity scroll-px-4 gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:p-0 lg:grid-cols-4 [&::-webkit-scrollbar]:hidden"
>
  {#each domaines as categorie, rang (categorie.id)}
    {@const phares = pharesCategorie(categorie.name, langue)}
    <li class="{TUILE} {BORD_DOMAINE} mv-geste--{gesteCategorie(categorie.name)}" style="--d: {rang * 45}ms">
      <CategoryIcon category={categorie.name} class={ICONE} />
      <Icone nom="arrow-up-right" class={FLECHE} />
      <div class="min-w-0">
        <h3 class={NOM}>
          <a href="/categories/{categorie.id}" aria-describedby="domaine-{categorie.id}-textes" class={LIEN}
            ><span data-nom="court" class="max-sm:sr-only">{nomCategorie(categorie.name, langue)}</span><span
              data-nom="puce"
              aria-hidden="true"
              class="whitespace-nowrap sm:hidden">{nomPuce(categorie.name, langue)}</span
            ></a
          >
        </h3>
        <!--
          Les textes phares du domaine, vérifiés en base (pharesCategorie), en
          version courte : une tuile de quatre colonnes n'a que 180 à 236 px
          de texte. Un domaine vide le dit ; un domaine inconnu de
          $lib/categories garde la description de l'API. Masquée sous sm (la
          pastille n'a que le nom), elle décrit toujours le lien.
        -->
        <p id="domaine-{categorie.id}-textes" class={LIGNE}>
          {#if categorie.law_count === 0}
            {$tr("accueil.domaines.vide")}
          {:else if phares}
            {phares.court}
          {:else}
            {descriptionCategorie(categorie.name, categorie.description, langue)}
          {/if}
        </p>
      </div>
    </li>
  {/each}

  <!-- « Tous les textes » : la liste complète (/laws). Toujours là, même si
       la liste des domaines arrivait vide. Son nombre vient de l'API
       (`ligneTousLesTextes`) : la somme des domaines ne compterait pas les
       textes qui n'en ont pas. -->
  <li
    class="{TUILE} {BORD_TOUS} mv-geste--hop max-sm:order-first {etendueTousLesTextes}"
    style="--d: {domaines.length * 45}ms"
  >
    <Icone nom="files" class={ICONE} />
    <Icone nom="arrow-up-right" class={FLECHE} />
    <div class="min-w-0">
      <h3 class={NOM}>
        <a href="/laws" aria-describedby="domaine-tous-textes" class={LIEN}>{$tr("search.allTexts")}</a>
      </h3>
      <p id="domaine-tous-textes" class={LIGNE}>{ligneTousLesTextes}</p>
    </div>
  </li>
</ul>
