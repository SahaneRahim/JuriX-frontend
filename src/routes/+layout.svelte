<script lang="ts">
  /**
   * Layout racine.
   *
   * Il ne rend volontairement aucune coquille : celle-ci vit dans
   * `$lib/components/SiteHeader` et `SiteFooter`, montés page par page. La
   * monter ici la poserait aussi sur `/admin/*`, qui a sa propre barre latérale,
   * et sur `/login`.
   *
   * Il porte en revanche deux choses qui n'ont de sens qu'au niveau du document.
   */
  import { language } from "$lib/stores/language";
  import "../app.css";

  /**
   * `lang` du document, synchronisé sur la langue de l'interface.
   *
   * `src/app.html` fixait `lang="fr"` en dur alors que le site bascule FR/EN :
   * tout le contenu anglais était donc annoncé avec la prononciation
   * française par les lecteurs d'écran, et les moteurs de recherche
   * l'indexaient comme du français.
   *
   * Posé ici plutôt que dans `app.html` parce que la langue vit dans
   * `localStorage`, indisponible au rendu serveur : `app.html` garde `fr` comme
   * valeur initiale, cette ligne la corrige dès l'hydratation. La vraie
   * correction — un cookie lu côté serveur — demande de sortir la langue du
   * localStorage, ce qui dépasse ce lot.
   */
  $: if (typeof document !== "undefined") {
    document.documentElement.lang = $language.current;
  }
</script>

<slot />
