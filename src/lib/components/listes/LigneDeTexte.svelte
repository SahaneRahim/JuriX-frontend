<script lang="ts">
  /**
   * Une ligne d'une liste de textes (P11 A, maquette domaine-p11a) : /laws et
   * la page d'un domaine.
   *
   * POURQUOI. Chaque carte répétait « Décret N°… du … portant … », puis la cote
   * (« PRC-6803 »), la date une seconde fois et un extrait brut de l'OCR
   * (« 1 0 DEC 2018 DECRETN° 2018/763 DU portant… ») ; coupé à deux lignes,
   * le titre s'arrêtait précisément sur l'objet, et toutes les fiches se
   * ressemblaient. La ligne porte désormais :
   * - les repères : « Décret n° 2026/285 · 31 août 2026 · 3 articles » ;
   * - l'objet en clair, tiré du titre officiel par le serveur (le titre
   *   entier quand la découpe n'est pas sûre, ou sur l'ancienne API), trois
   *   lignes au plus ;
   * - le statut prouvé, s'il existe.
   * Ni extrait, ni icône de domaine répétée, ni cote interne.
   *
   * TOUTE LA LIGNE EST LE LIEN, et non un ::after étendu depuis le titre : son
   * nom accessible porte ainsi les repères ET l'objet (« Décret n° 2026/285 ·
   * 31 août 2026 · 3 articles, Nomination des… »), ce que P11 demande pour qui
   * parcourt la liste au lecteur d'écran ; et sa boîte, la ligne entière, est
   * une cible confortable au doigt, même pour un objet d'une ligne.
   */
  import StatutEnBref from "./StatutEnBref.svelte";
  import { intituleDuTexte, reperesDuTexte } from "./reperes";
  import { language, tr } from "$lib/stores/language";
  import type { LigneAffichee } from "./lots";

  /** Une ligne déjà réduite au serveur (`ligneAffichee`). */
  export let ligne: LigneAffichee;

  $: reperes = reperesDuTexte(ligne, { langue: $language.current, traduire: $tr, suite: "articles" });
  $: intitule = intituleDuTexte(ligne);
</script>

<li>
  <!-- `id` : après « Afficher 20 de plus », le focus passe à la première
       ligne ajoutée (ListeDeTextes). Anneau de focus à l'intérieur de la
       ligne : la liste coupe ce qui dépasse de ses coins arrondis. -->
  <a
    id="texte-{ligne.id}"
    href="/laws/{ligne.id}"
    class="group block bg-white px-4 py-3.5 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-950 dark:bg-zinc-900 dark:hover:bg-zinc-800/40 dark:focus-visible:ring-white sm:px-5"
  >
    <p class="text-[13px] leading-5 text-zinc-600 dark:text-zinc-400 sm:text-sm">{reperes}</p>
    <!-- Titre de ligne en Inter (16 puis 18 px, mi-gras) : la serif (Q5) est
         réservée aux titres de page et au titre officiel d'un texte. Trois
         lignes au plus, à toutes les tailles : l'objet tient presque toujours
         en une ou deux, et l'intitulé entier (ancienne API) reste lisible.
         `coupe-mots` : un intitulé de fichier sans espace. -->
    <h2
      class="mt-0.5 line-clamp-3 coupe-mots text-base font-semibold leading-snug text-zinc-950 group-hover:underline dark:text-white sm:text-lg"
    >
      {intitule}
    </h2>
    <StatutEnBref statut={ligne.statut} />
  </a>
</li>
