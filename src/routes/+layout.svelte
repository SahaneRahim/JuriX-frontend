<script lang="ts">
  /**
   * Layout racine.
   *
   * Il ne rend volontairement aucune coquille : celle-ci vit dans
   * `$lib/components/SiteHeader` et `SiteFooter`, montés page par page. La
   * monter ici la poserait aussi sur `/admin/*`, qui a sa propre barre latérale,
   * et sur `/login`.
   *
   * Il porte en revanche ce qui n'a de sens qu'au niveau du document : la
   * langue, la question du profil, et la synchronisation du profil avec le
   * compte.
   */
  import { onMount, tick } from "svelte";
  import { afterNavigate } from "$app/navigation";
  import { page } from "$app/stores";
  import ChoixPersona from "$lib/components/ChoixPersona.svelte";
  import { synchroniserPersonaAuDemarrage } from "$lib/persona-compte";
  import { language } from "$lib/stores/language";
  import {
    choixPersonaOuvert,
    fermerChoixPersona,
    personaStore,
    questionAPoser,
  } from "$lib/stores/persona";
  import "../app.css";

  /**
   * La question du profil vit ICI : c'est le seul layout qui couvre toutes les
   * pages d'entrée (un lien profond vers /laws/123 compris) sans être re-monté
   * d'une page à l'autre. Elle attend la synchronisation avec le compte, pour
   * ne jamais apparaître en éclair devant un utilisateur connecté qui a déjà
   * un profil.
   */
  let compteVerifie = false;
  let agentUtilisateur = "";

  onMount(() => {
    agentUtilisateur = navigator.userAgent;
    synchroniserPersonaAuDemarrage().finally(() => (compteVerifie = true));
  });

  // Une boîte de changement ne survit pas à une navigation (retour vers /login…).
  afterNavigate(() => fermerChoixPersona());

  $: accueil =
    compteVerifie &&
    questionAPoser($personaStore, $page.route.id, Boolean($page.error), agentUtilisateur);
  let dialogue: "accueil" | "changement" | null = null;
  $: dialogue = $choixPersonaOuvert ? "changement" : accueil ? "accueil" : null;

  // Fermée, la boîte de CHANGEMENT rend le focus au bouton qui l'a ouverte
  // (en-tête, menu mobile ou chat). Si la page était encore inerte à cet
  // instant, le focus tombe sur <body> : on le rattrape. En accueil, on le
  // laisse au début du document, pour que la première tabulation atteigne le
  // lien d'évitement.
  //
  // Ouverte, la boîte bloque aussi le défilement de la page derrière elle.
  let modePrecedent: typeof dialogue = null;
  let ouvreur: HTMLElement | null = null;
  let debordementAvant = "";
  $: if (typeof document !== "undefined" && dialogue !== modePrecedent) {
    if (modePrecedent === null) {
      debordementAvant = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    } else if (dialogue === null) {
      document.body.style.overflow = debordementAvant;
    }
    if (dialogue === "changement" && modePrecedent !== "changement") {
      ouvreur = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    const ferme = modePrecedent === "changement" && dialogue === null;
    modePrecedent = dialogue;
    if (ferme) {
      const cible = ouvreur;
      tick().then(() => {
        if (document.activeElement !== document.body) return;
        const visible = cible?.isConnected && cible.offsetParent !== null;
        (visible ? cible : document.querySelector<HTMLElement>('[data-testid="persona-toggle"]'))?.focus();
      });
    }
  }

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

<!-- `display: contents` : l'enveloppe ne crée aucune boîte, la mise en page
     des pages ne change pas. `inert` rend la page inerte derrière la question. -->
<div style="display: contents" inert={dialogue !== null}>
  <slot />
</div>

{#if dialogue}
  <ChoixPersona mode={dialogue} />
{/if}
