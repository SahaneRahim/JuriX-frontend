<script lang="ts">
  /**
   * Métadonnées d'une page — un seul endroit qui décrit leur forme.
   *
   * POURQUOI UN COMPOSANT. `<svelte:head>` fonctionne depuis un composant
   * enfant : dix pages peuvent donc partager la même définition au lieu d'en
   * écrire dix variantes. Ce qui existait avant ce fichier : onze balises
   * `<title>` écrites à la main, trois formes différentes (« JuriX - x »,
   * « JuriX — x », « JuriX » seul), AUCUNE balise `description`, aucune
   * canonique, aucun `og:*` — donc aucun aperçu correct quand un lien du site
   * est partagé — et rien pour sortir de l'index les pages qui n'y ont pas leur
   * place.
   *
   * SvelteKit déduplique les balises rendues dans `<svelte:head>` par leur
   * position dans l'arbre : monter ce composant dans une page qui garde son
   * propre `<title>` produirait DEUX titres. Retirer l'ancien en même temps que
   * l'on pose celui-ci.
   */
  import { titreDePage } from "$lib/seo";

  /** Partie spécifique du titre. `titreDePage` y ajoute le suffixe du site. */
  export let titre: string;
  /** Vide = pas de balise. Une description vide est pire qu'aucune : elle est indexée. */
  export let description = "";
  /** Vide = pas de balise. Attendue absolue (`$lib/seo.urlCanonique`). */
  export let canonique = "";
  /** `website` pour une page de portail, `article` pour un document. */
  export let type: "website" | "article" = "website";
  /**
   * Fausse pour les pages qui ne doivent pas entrer dans l'index : une recherche
   * (une URL par requête, donc une infinité de pages quasi dupliquées), une
   * session de chat, la connexion, l'administration.
   *
   * Toujours `noindex, follow` et jamais `nofollow` : la page ne doit pas être
   * listée, mais elle doit continuer à transmettre l'autorité de ses liens vers
   * les pages qui, elles, sont indexables.
   */
  export let indexable = true;

  $: titreComplet = titreDePage(titre);
</script>

<svelte:head>
  <title>{titreComplet}</title>

  {#if description}
    <meta name="description" content={description} />
  {/if}

  {#if canonique}
    <link rel="canonical" href={canonique} />
  {/if}

  {#if !indexable}
    <meta name="robots" content="noindex, follow" />
  {/if}

  <!-- Aperçu au partage. `og:title` reprend le titre complet : c'est lui qui
       s'affiche dans la carte, hors du contexte de l'onglet. -->
  <meta property="og:type" content={type} />
  <meta property="og:title" content={titreComplet} />
  {#if description}
    <meta property="og:description" content={description} />
  {/if}
  {#if canonique}
    <meta property="og:url" content={canonique} />
  {/if}
  <meta property="og:site_name" content="JuriX" />
</svelte:head>
