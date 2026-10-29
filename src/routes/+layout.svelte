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
   * langue, la boîte « Changer de profil », et la synchronisation du profil
   * avec le compte.
   */
  import { onMount, tick } from "svelte";
  import { afterNavigate } from "$app/navigation";
  import ChoixPersona from "$lib/components/ChoixPersona.svelte";
  import CommandPalette from "$lib/components/CommandPalette.svelte";
  import { synchroniserPersonaAuDemarrage } from "$lib/persona-compte";
  import { commandPaletteOpen } from "$lib/stores/commandPalette";
  import { language } from "$lib/stores/language";
  import { choixPersonaOuvert, fermerChoixPersona } from "$lib/stores/persona";
  // Police servie par le site lui-meme, et non par fonts.googleapis.com : sa
  // feuille de style bloquait l'affichage (0,2 s pour Inter, mesure Lighthouse
  // mobile), sur deux origines tierces. Inter est declaree dans app.css
  // (font-display: optional) et prechargee par src/hooks.server.ts. Les icones
  // ne sont pas une police mais des SVG Lucide (src/lib/icones.ts), inscrits
  // dans la page : rien a telecharger, rien d'invisible en attendant.
  import "../app.css";

  /**
   * La boîte « Changer de profil » vit ICI : c'est le seul layout qui couvre
   * toutes les pages sans être re-monté d'une page à l'autre. Elle ne s'ouvre
   * que sur demande (en-tête, menu mobile, chat).
   *
   * Elle ne s'ouvre PLUS d'elle-même à l'arrivée (P5). Ouverte après
   * l'hydratation sur toute première visite, lien partagé vers une loi
   * compris, elle couvrait 678 px sur 800 d'un téléphone et bloquait la
   * lecture déjà commencée. Le chat pose la question dans son fil, à la
   * première question, là où le profil sert (src/routes/(main)/chat).
   */
  onMount(() => {
    void synchroniserPersonaAuDemarrage();
  });

  // Une boîte de changement ne survit pas à une navigation (retour vers /login…).
  afterNavigate(() => fermerChoixPersona());

  $: dialogue = $choixPersonaOuvert;

  // Fermée, la boîte rend le focus au bouton qui l'a ouverte (en-tête, menu
  // mobile ou chat). Si la page était encore inerte à cet instant, le focus
  // tombe sur <body> : on le rattrape.
  //
  // Ouverte, la boîte bloque aussi le défilement de la page derrière elle.
  let ouvertePrecedemment = false;
  let ouvreur: HTMLElement | null = null;
  let debordementAvant = "";
  $: if (typeof document !== "undefined" && dialogue !== ouvertePrecedemment) {
    if (dialogue) {
      debordementAvant = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      ouvreur = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    } else {
      document.body.style.overflow = debordementAvant;
    }
    const ferme = ouvertePrecedemment && !dialogue;
    ouvertePrecedemment = dialogue;
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
     des pages ne change pas. `inert` rend la page inerte derrière la boîte
     du profil, et derrière la palette (Ctrl K), modale elle aussi
     (`aria-modal`). Sans lui, Maj+Tab menait du champ de la palette à la
     page cachée sous son fond, où Entrée activait un contrôle invisible :
     l'envoi du brouillon du chat, un lien vers une autre page.
     Ouverte, la palette note qui avait le focus (la loupe, la saisie du
     chat) dans la même tâche, avant que le navigateur ne le retire à la
     page devenue inerte (vérifié dans Chrome 154 le 2026-10-29). Fermée,
     elle le lui rend une fois l'inertie levée (CommandPalette.svelte). Un
     navigateur qui ignore `inert` laisse le focus entrer dans la page : la
     palette le renvoie à son champ. Inerte, la page se tait aussi : le chat
     annonce alors par la région de la boîte ouverte (`annonceDuChat`,
     `annonceDansLaPalette`). -->
<div style="display: contents" inert={dialogue || $commandPaletteOpen}>
  <slot />
</div>

{#if dialogue}
  <ChoixPersona />
{/if}

<CommandPalette />
