<script lang="ts">
  /**
   * Une ligne de résultat de recherche (P7 A, maquette recherche-p7a).
   *
   * POURQUOI UNE LIGNE ET PLUS UNE CARTE. Une carte par résultat (badge, bouton
   * de copie, titre officiel entier, extrait de trois lignes, ligne de méta)
   * prenait environ 480 px sur téléphone : un résultat et demi par écran. La
   * ligne dense dit l'essentiel en quatre étages :
   * - les repères : « Loi n° 92/007 · 14 août 1992 · Travail et sécurité
   *   sociale » (nature et numéro, date de l'acte, domaine en nom court) ;
   * - l'objet du texte en lien (« Code du travail »), qui couvre toute la ligne ;
   * - deux lignes d'extrait, mots cherchés en gras ;
   * - le statut prouvé s'il existe, puis les puces des articles trouvés.
   * Le bouton « Copier le lien » est parti : la page du texte a son partage
   * (P2), et ce bouton ajoutait une cible de 44 px à chaque résultat.
   *
   * Composant gardé sous son nom : il reste la seule vue d'un résultat, et
   * d'autres fichiers y renvoient dans leurs commentaires.
   */
  import { adresseDeLArticle } from "$lib/api-publique";
  import Icone from "$lib/components/Icone.svelte";
  import StatutEnBref from "$lib/components/listes/StatutEnBref.svelte";
  import {
    intituleDuTexte,
    natureEtNumero,
    remplir,
    reperesDuTexte,
    titreDecoupe,
    type ResultatAffiche,
  } from "$lib/components/listes/reperes";
  import { language, tr } from "$lib/stores/language";

  /** Un résultat déjà réduit au serveur (src/routes/search/resultats.ts). */
  export let resultat: ResultatAffiche;

  // `$tr` et `$language` dans les blocs : repères et libellés se refont au
  // changement de langue de l'interface.
  $: reperes = reperesDuTexte(resultat, { langue: $language.current, traduire: $tr, suite: "domaine" });
  $: intitule = intituleDuTexte(resultat);
  // L'objet découpé ne dit plus la nature ni le numéro : le nom du lien les
  // reprend, pour qui parcourt les liens au lecteur d'écran (P11).
  $: reference = titreDecoupe(resultat) ? natureEtNumero(resultat, $tr) : "";
</script>

<!-- La ligne de la maquette : fond de carte, filet entre les lignes (posé par
     la liste), survol en zinc-50. `relative` : le lien du titre s'étend à
     toute la ligne par son ::after (Q3 A, comme les cartes de l'accueil). -->
<li
  class="relative bg-white px-4 py-4 transition-colors hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800/40 sm:px-5"
>
  <!-- Repères en 13 puis 14 px, zinc-600 (7,7:1 sur blanc ; zinc-400 en
       sombre, 6,9:1 sur zinc-900). -->
  <p class="text-[13px] leading-5 text-zinc-600 dark:text-zinc-400 sm:text-sm">{reperes}</p>

  <!-- Le lien couvre toute la ligne (::after) ; son anneau de focus est
       dessiné par ce même ::after, sur le bord intérieur de la ligne : le
       contour d'un lien en ligne ne se voyait pas. `block -my-3 py-3` : la
       boîte du lien gagne 12 px dessus et dessous sans rien déplacer, et
       mesure 44 px même pour un objet d'une ligne (« Code du travail »),
       la cible au doigt du site (redimensionnement.spec.ts). `coupe-mots` :
       un intitulé de fichier sans espace (« ordonnance_n_2015_001… »). -->
  <h2 class="mt-1 coupe-mots text-base font-semibold leading-snug text-zinc-950 dark:text-white sm:text-lg">
    <a
      href="/laws/{resultat.id}"
      class="-my-3 block py-3 after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-zinc-950 dark:focus-visible:after:ring-white"
      >{#if reference}<span class="sr-only">{reference}, </span>{/if}{intitule}</a
    >
  </h2>

  <!-- Deux lignes d'extrait, mots cherchés en gras (P7) : un <strong>, pas le
       fond gris d'un <mark>, qui pesait plus que le titre. Le texte arrive en
       morceaux déjà nettoyés : aucune balise de l'API n'est rendue en HTML
       (src/lib/highlight.ts).

       En Inter, et non en Literata Texte (`font-texte`) : Q5 A borne la serif
       du texte officiel au corps des articles, aux aperçus de citation et aux
       extraits cités dans le chat et la comparaison, et garde Inter pour « la
       recherche » ; l'instance texte n'est chargée que sur /laws, /compare et
       le chat (app.css). L'extrait n'est d'ailleurs pas une citation : des
       fragments recousus, nettoyés de l'OCR et coupés par « … ». Inter est
       donc voulu ici ; passer l'extrait en serif reviendrait au
       propriétaire. -->
  {#if resultat.extrait.length}
    <p class="mt-1 line-clamp-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
      {#each resultat.extrait as morceau, i (i)}{#if morceau.gras}<strong
            class="font-semibold text-zinc-950 dark:text-white">{morceau.texte}</strong
          >{:else}{morceau.texte}{/if}{/each}
    </p>
  {/if}

  <StatutEnBref statut={resultat.statut} />

  <!-- Puces des articles trouvés : chacune mène à l'article dans le texte
       (`?article=`, lu par la page du texte), et passe au-dessus du lien de
       la ligne (`relative z-10`). 36 px de haut comme la maquette, et 44 au
       doigt : le ::before les prolonge de 6 px dessus et dessous depuis
       l'intérieur de leur bordure (5 px au-delà d'elle), dans l'écart de
       10 px qui sépare deux rangées de puces, sans chevauchement.
       Chiffres proportionnels : en chiffres tabulaires (`tabular-nums`),
       Inter donnait au trait d'union la chasse d'un chiffre, et « Art. 45-1
       (nouveau) » se lisait « Art. 45 - 1 », comme une plage ou une
       soustraction. Aucune colonne de nombres n'est à aligner ici. -->
  {#if resultat.articles.length}
    <div class="mt-2 flex flex-wrap gap-x-1.5 gap-y-2.5">
      {#each resultat.articles as numero (numero)}
        <a
          href={adresseDeLArticle(resultat.id, numero)}
          class="relative z-10 inline-flex min-h-9 items-center gap-1 rounded-full border border-zinc-300 bg-white px-2.5 text-xs font-medium text-zinc-700 before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] hover:border-zinc-950 hover:text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-white dark:hover:text-white"
        >
          <Icone nom="section" class="text-sm" />
          {remplir($tr("search.articleChip"), { n: numero })}
        </a>
      {/each}
    </div>
  {/if}
</li>
