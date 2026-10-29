<script lang="ts">
  /**
   * L'aperçu d'une citation (P3, maquette chat-p3a-apercu) : statut, texte
   * entier de l'article, passage cité en gras, « Lire dans le texte intégral »
   * et un bouton « Fermer » visible.
   *
   * DEUX FORMES, UN SEUL ÉLÉMENT. Sur téléphone et tablette, une feuille en
   * bas d'écran, MODALE : voile, focus enfermé, page derrière inerte (la page
   * pose `inert`). Sur ordinateur, un panneau à droite de la conversation,
   * NON modal : on continue de lire la réponse et une autre citation remplace
   * le contenu du panneau, sans jamais empiler deux aperçus. La forme suit la
   * largeur EN DIRECT (`modale`, calculé par la page) : un seul élément change
   * de classes, rien n'est recréé, le focus reste où il est.
   *
   * Échap et le retour système ferment l'une et l'autre : c'est la page qui
   * les gère (une seule écoute d'Échap, un état d'historique).
   *
   * Sur l'ancienne API, ou quand l'article est introuvable (404), l'aperçu ne
   * vient pas : la feuille le dit et garde le lien vers le texte intégral
   * (contrat §4 et §8). Un texte cité sans article n'appelle pas l'API : son
   * statut et son lien suffisent.
   *
   * L'ARTICLE, ET LUI SEUL. Le passage que l'API rend peut porter d'autres
   * articles, collés par le découpage de la base (« Art. 35 » du Code du
   * travail : les articles 35 à 40 d'un bloc). L'aperçu s'arrête au premier
   * en-tête d'un autre article et le dit ($lib/components/chat/citations,
   * `articleDuPassage`). Le pied « Lire dans le texte intégral » reste collé
   * au bas de la feuille et du panneau, et le passage en gras est amené dans
   * la vue à l'ouverture : la légende ne promet plus un gras invisible.
   */
  import { onDestroy, onMount, tick } from "svelte";
  import { prefersReducedMotion } from "svelte/motion";
  import { fade, fly } from "svelte/transition";
  import { adresseDeLArticle, sansMarqueursDePage } from "$lib/api-publique";
  import Icone from "$lib/components/Icone.svelte";
  import { language, tr } from "$lib/stores/language";
  import type { ArticleApercu } from "$lib/types";
  import { apercuDeLArticle, type CibleDApercu } from "./apercus";
  import {
    articleDuPassage,
    bruitDeNumerisation,
    langueProbable,
    paragraphesDeLArticle,
    passageLePlusProche,
  } from "./citations";
  import {
    enPhrase,
    lignesDuStatutDeLArticle,
    mentionDuStatut,
    ponctuationFrancaise,
    typographieDesNumeros,
  } from "./libelles";

  export let cible: CibleDApercu;
  /** Feuille modale (sous la largeur du panneau) ou panneau latéral. */
  export let modale: boolean;
  /** Date du relevé des liens (`GET /corpus`), pour un texte cité sans article. */
  export let releveLe: string | null = null;
  export let surFermer: () => void;
  /**
   * Ce que le chat annonce pendant que la feuille est modale : étapes et fin
   * de la réponse qui arrive derrière elle, arrêt, erreurs. Hors d'une boîte
   * aria-modal, TalkBack et VoiceOver ne lisent plus rien, région d'annonce
   * de la page comprise (Chrome et Safari les retirent de l'arbre
   * d'accessibilité) : ces annonces se taisaient. La page les dirige ici.
   */
  export let annonce = "";

  $: t = $tr;
  $: langue = $language.current;

  const duree = (ms: number) => (prefersReducedMotion.current ? 0 : ms);
  const idTitre = `apercu-titre-${Math.random().toString(36).slice(2, 8)}`;
  /** Entre l'intitulé et le statut, quand ils se suivent sur un écran court. */
  const SEPARATEUR_DU_STATUT = " · ";

  let boite: HTMLElement;
  let boutonFermer: HTMLButtonElement;
  /** La zone qui défile (statut, texte, pied collé en bas), et son pied. */
  let zone: HTMLElement;
  let pied: HTMLElement;

  // ------------------------------------------------------------ chargement

  let etat: "chargement" | "pret" | "indisponible" | "texte" = "chargement";
  let apercu: ArticleApercu | null = null;
  let cleChargee = "";
  let controleur: AbortController | null = null;

  async function charger(c: CibleDApercu) {
    cleChargee = c.cle;
    controleur?.abort();
    controleur = null;
    apercu = null;
    // Une autre citation dans le même panneau se lit depuis son début, pas
    // depuis l'endroit où la précédente avait laissé la vue.
    if (zone) zone.scrollTop = 0;
    if (!c.numero) {
      etat = "texte";
      return;
    }
    etat = "chargement";
    const lecture = new AbortController();
    controleur = lecture;
    const lu = await apercuDeLArticle(c.lawId, c.numero, c.articleId, lecture.signal).catch(() => null);
    // Une autre citation a été ouverte, ou l'aperçu fermé, entre-temps.
    if (lecture.signal.aborted || cleChargee !== c.cle) return;
    apercu = lu;
    etat = lu ? "pret" : "indisponible";
  }

  $: if (cible.cle !== cleChargee) {
    void charger(cible);
    void tick().then(() => boutonFermer?.focus());
  }

  onMount(() => {
    // À l'ouverture, le focus va au bouton « Fermer », en haut : le titre est
    // annoncé avec la boîte (aria-labelledby), et l'en-tête, qui ne défile
    // pas, reste en vue. Le texte, lui, ne bouge que pour montrer le passage
    // en gras (`montrerLePassage`), jamais pour suivre le focus.
    boutonFermer?.focus();

    // Le filet du pied suit le débordement : texte chargé, fenêtre tournée ou
    // redimensionnée, feuille devenue panneau.
    const observateur =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => mesurerLeDebordement());
    if (zone) observateur?.observe(zone);
    if (zone?.firstElementChild) observateur?.observe(zone.firstElementChild);
    return () => observateur?.disconnect();
  });

  // Fenêtre rétrécie pendant que le panneau est ouvert : il devient feuille
  // modale, la conversation derrière devient inerte, et le focus qui s'y
  // trouvait (le champ, une citation) tomberait dans le vide. Il entre dans la
  // feuille.
  let modaleAvant = modale;
  $: if (modale !== modaleAvant) {
    modaleAvant = modale;
    if (modale) {
      void tick().then(() => {
        if (!boite?.contains(document.activeElement)) boutonFermer?.focus();
      });
    }
  }
  onDestroy(() => controleur?.abort());

  // ------------------------------------------------------------ contenu

  // L'ORDRE DES `$:` COMPTE (mode legacy : ordre du source). Chacun après ce
  // qu'il lit.
  //
  // Marqueurs de page de l'OCR retirés AVANT de chercher le passage : les
  // positions du gras portent sur le texte affiché. Puis l'article seul :
  // le passage s'arrête à l'en-tête d'un autre article, et un passage
  // englobant se recadre sur l'en-tête du sien (voir `articleDuPassage`).
  $: contenuRendu = apercu ? sansMarqueursDePage(apercu.contenu) : "";
  $: decoupe = apercu ? articleDuPassage(contenuRendu, apercu.numero || cible.numero, apercu.englobant) : null;
  $: contenu = decoupe ? contenuRendu.slice(decoupe.debut, decoupe.fin).trim() : "";
  $: passage = apercu ? passageLePlusProche(contenu, cible.phrases) : null;
  $: paragraphes = apercu ? paragraphesDeLArticle(contenu, passage) : [];
  // `lang` du texte officiel, quand il se laisse deviner : un article anglais
  // lu avec la prononciation française (ou l'inverse) est incompréhensible.
  $: langueDuTexte = apercu ? langueProbable(contenu) : null;
  // Des lettres isolées en série : un passage que l'OCR n'a pas su lire. Le
  // texte reste tel que la base le garde ; une ligne le dit au lecteur.
  $: malLu = apercu ? bruitDeNumerisation(contenu) : false;
  // L'intitulé de section vient de l'ingestion (« Section III: De la… ») : en
  // français, l'espace insécable devant le deux-points.
  $: enFrancais = langueDuTexte === "fr" || (langueDuTexte === null && langue === "fr");
  $: section = apercu?.section ? (enFrancais ? ponctuationFrancaise(apercu.section) : apercu.section) : null;
  $: lignesDeStatut = apercu ? lignesDuStatutDeLArticle(apercu, t, langue) : null;
  $: mention = enPhrase(mentionDuStatut(cible.statut, t, langue, releveLe));
  $: titreDuTexte = typographieDesNumeros(apercu?.texte?.titre || cible.titre);
  $: adresse = adresseDeLArticle(cible.lawId, cible.numero);

  // ------------------------------------------------------------ vue

  /**
   * Le texte déborde de la zone : le pied, collé en bas, porte alors un filet
   * qui le sépare du texte qui défile dessous. Sans débordement, le pied suit
   * le texte, sans filet, comme dans la maquette. Seule la couleur du filet
   * change (il est toujours là, transparent) : un pied qui changerait de
   * hauteur ferait déborder, puis plus, puis de nouveau.
   */
  let deborde = false;
  function mesurerLeDebordement() {
    if (zone) deborde = zone.scrollHeight > zone.clientHeight + 1;
  }
  /** Après chaque changement de contenu ou de forme (sans ResizeObserver, c'est le seul relevé). */
  function remesurer(..._changements: unknown[]) {
    void tick().then(mesurerLeDebordement);
  }
  $: remesurer(etat, apercu, modale);

  /** Marge gardée autour du passage en gras quand il est amené dans la vue. */
  const MARGE_DU_PASSAGE = 24;
  /** L'ouverture dont le passage a déjà été amené dans la vue : une fois chacune. */
  let passageMontre = "";

  /**
   * Amène le passage en gras dans la vue, à l'ouverture. La légende « En gras :
   * le passage le plus proche… » s'affichait au-dessus d'un gras qui, dans un
   * article long, était plusieurs écrans plus bas. Le moins de défilement
   * possible : le passage entier juste au-dessus du pied ; plus haut que la
   * vue, son début en haut. Rien si le lecteur a déjà fait défiler, ni si le
   * gras est déjà en vue. Le focus reste sur « Fermer », dans l'en-tête qui ne
   * défile pas.
   */
  function montrerLePassage() {
    const gras = zone?.querySelectorAll<HTMLElement>('[data-testid="chat-preview-text"] strong');
    if (!zone || !gras?.length || zone.scrollTop > 0) return;
    if (zone.scrollHeight <= zone.clientHeight + 1) return;
    const origine = zone.getBoundingClientRect().top;
    const haut = gras[0].getBoundingClientRect().top - origine;
    const bas = gras[gras.length - 1].getBoundingClientRect().bottom - origine;
    // La part de la zone que le pied, collé en bas, ne couvre pas.
    const visible = zone.clientHeight - (pied?.offsetHeight ?? 0);
    if (bas + MARGE_DU_PASSAGE <= visible) return;
    const position = bas - haut + 2 * MARGE_DU_PASSAGE > visible ? haut - MARGE_DU_PASSAGE : bas + MARGE_DU_PASSAGE - visible;
    zone.scrollTop = Math.max(0, position);
  }
  $: if (etat === "pret" && passage && passageMontre !== cible.cle) {
    passageMontre = cible.cle;
    void tick().then(montrerLePassage);
  }

  // ------------------------------------------------------------ clavier

  const FOCALISABLES = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
  ].join(",");

  /**
   * Feuille modale : la tabulation tourne dans la feuille. Pas l'action
   * partagée `piegerFocus` : elle rend le focus à son départ quand on la
   * retire, ce qui le ferait sortir du panneau au simple passage de la
   * feuille au panneau (fenêtre élargie). Le focus est rendu par la page, à
   * la fermeture seulement.
   */
  function surTabulation(event: KeyboardEvent) {
    if (!modale || event.key !== "Tab") return;
    const liste = Array.from(boite.querySelectorAll<HTMLElement>(FOCALISABLES)).filter(
      (el) => el.offsetParent !== null,
    );
    if (!liste.length) return;
    const premier = liste[0];
    const dernier = liste[liste.length - 1];
    const actif = document.activeElement as HTMLElement | null;
    if (!actif || !liste.includes(actif)) {
      event.preventDefault();
      (event.shiftKey ? dernier : premier).focus();
    } else if (event.shiftKey && actif === premier) {
      event.preventDefault();
      dernier.focus();
    } else if (!event.shiftKey && actif === dernier) {
      event.preventDefault();
      premier.focus();
    }
  }

  // ------------------------------------------------------------ glisser pour fermer

  /**
   * La poignée de la feuille se tire vers le bas pour la fermer (au-delà de
   * 80 px). Sans ce geste, la poignée promettait ce qu'elle ne faisait pas.
   * Le bouton « Fermer » reste là pour qui ne glisse pas.
   */
  const SEUIL_DE_FERMETURE = 80;
  let decalage = 0;
  let depart: number | null = null;
  let pointeur: number | null = null;

  function debutDuGeste(event: PointerEvent) {
    if (!modale || event.button !== 0 || (event.target as Element).closest("button, a")) return;
    depart = event.clientY;
    pointeur = event.pointerId;
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }
  function suiteDuGeste(event: PointerEvent) {
    if (depart === null || event.pointerId !== pointeur) return;
    decalage = Math.max(0, event.clientY - depart);
  }
  function finDuGeste() {
    if (depart === null) return;
    const tire = decalage;
    depart = null;
    pointeur = null;
    decalage = 0;
    if (tire > SEUIL_DE_FERMETURE) surFermer();
  }

  /*
   * Feuille : collée au bas de l'écran, au plus 78 % de sa hauteur VISIBLE
   * (dvh là où il existe), 92 % sur un écran court ; centrée et bornée à
   * 672 px à partir de sm, où une ligne de 700 px ne se lirait plus. z-[56] :
   * au-dessus du voile (55) et de l'en-tête (50), sous la boîte des profils.
   * Panneau : une colonne de la page, à droite de la conversation, de la
   * hauteur de la carte.
   */
  const CLASSES_FEUILLE =
    "fixed inset-x-0 bottom-0 z-[56] mx-auto flex max-h-[78vh] w-full flex-col rounded-t-2xl border-t border-zinc-200 bg-white pb-zone-sure shadow-xl supports-[max-height:1dvh]:max-h-[78dvh] dark:border-zinc-800 dark:bg-zinc-900 sm:max-w-2xl sm:border-x court:max-h-[92vh] court:supports-[max-height:1dvh]:max-h-[92dvh]";
  const CLASSES_PANNEAU =
    "relative flex w-[360px] shrink-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none xl:w-[380px]";
</script>

{#if modale}
  <!-- Voile : un appui à côté ferme la feuille, comme le tiroir des conversations. -->
  <div
    class="fixed inset-0 z-[55] bg-zinc-950/40"
    aria-hidden="true"
    on:click={surFermer}
    transition:fade={{ duration: duree(150) }}
  ></div>
{/if}

<div
  bind:this={boite}
  role="dialog"
  tabindex="-1"
  aria-modal={modale ? "true" : undefined}
  aria-labelledby={idTitre}
  data-testid="chat-preview"
  data-mode={modale ? "feuille" : "panneau"}
  on:keydown={surTabulation}
  class="{modale ? CLASSES_FEUILLE : CLASSES_PANNEAU} {depart === null ? 'motion-safe:transition-transform' : ''}"
  style={decalage ? `transform: translateY(${decalage}px)` : undefined}
  in:fly={{ y: modale ? 48 : 0, duration: duree(200) }}
>
  <!-- La poignée et l'en-tête se tirent vers le bas (feuille seulement) ;
       `touch-none` : le geste ne fait ni défiler ni recharger la page. Un
       geste du pointeur en plus, sans rôle : au clavier, « Fermer » et Échap
       font la même chose.

       ÉCRAN COURT (téléphone en paysage, 740 × 360). En-tête, encadré de
       statut, ligne de section et pied collé ne laissaient voir que deux
       lignes et demie de l'article, l'objet même de la feuille (capture
       chat-apercu r2). Là, la poignée se pose dans la marge du haut au lieu
       de prendre sa ligne, le surtitre s'efface (le titre « Art. 35 — Code du
       travail » dit déjà ce qui est ouvert) et le titre tient sur une ligne :
       l'en-tête n'a plus que la hauteur du bouton « Fermer », 44 px. -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="shrink-0 {modale ? 'touch-none px-4 pt-2' : 'border-b border-zinc-200 px-5 py-4 dark:border-zinc-800'}"
    on:pointerdown={debutDuGeste}
    on:pointermove={suiteDuGeste}
    on:pointerup={finDuGeste}
    on:pointercancel={finDuGeste}
  >
    {#if modale}
      <div
        class="mx-auto mb-2 h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700 court:absolute court:inset-x-0 court:top-1 court:mb-0"
        aria-hidden="true"
      ></div>
    {/if}
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="text-xs font-medium text-zinc-500 dark:text-zinc-400 court:hidden">
          {cible.numero ? t("chat.preview.overlineArticle") : t("chat.preview.overlineText")}
        </p>
        <!-- Deux lignes au plus (une sur écran court) : le nom d'un texte est
             parfois son objet entier, et trois lignes de titre repoussaient
             l'article. L'intitulé complet reste dans l'encadré de statut, et
             le titre entier dans le nom de la boîte. -->
        <h2
          id={idTitre}
          class="coupe-mots line-clamp-2 text-lg font-bold text-zinc-950 dark:text-white court:line-clamp-1 court:leading-[2.75rem]"
        >{cible.libelle}</h2>
      </div>
      <button
        type="button"
        bind:this={boutonFermer}
        data-testid="chat-preview-close"
        on:click={surFermer}
        class="-mr-1 inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-zinc-300 px-3 text-sm font-semibold text-zinc-800 transition-colors hover:border-zinc-950 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-white"
      >
        <Icone nom="x" class="text-lg" />{t("common.close")}
      </button>
    </div>
  </div>

  <!-- La zone qui défile : le contenu, puis le pied, collé en bas de la zone
       quand le contenu déborde (`sticky`), à sa suite sinon. Les marges
       latérales sont celles du contenu et du pied, pas de la zone : collé, le
       pied en couvre toute la largeur, et le texte ne passe pas à côté. -->
  <div bind:this={zone} class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
    <div class="{modale ? 'px-4 pt-3' : 'px-5 pt-4'} court:pt-2">
      <!-- Statut et identité du texte. Les lignes d'un changement actuel portent
           une icône et du gras, jamais du rouge (P1) : ce n'est pas une erreur.
           Sur écran court, l'intitulé et les lignes de statut se suivent dans
           un seul paragraphe, comme dans la maquette chat-p3a-apercu
           (« … portant Code du travail · version d'origine, non consolidée ») :
           deux lignes au lieu de trois ou quatre, prises au texte de
           l'article. -->
      <div
        class="mb-3 rounded-lg bg-zinc-100 px-3 py-2 text-xs leading-relaxed text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 court:mb-2 court:py-1.5"
        data-testid="chat-preview-status"
      >
        <p class="coupe-mots court:inline">{titreDuTexte}</p>
        <!-- Le séparateur en expression (`SEPARATEUR_DU_STATUT`) : Svelte 5
             retire les blancs du bord d'une balise, et « · » se serait collé
             aux deux phrases. -->
        {#if lignesDeStatut || mention}<span class="hidden court:inline" aria-hidden="true">{SEPARATEUR_DU_STATUT}</span
          >{/if}
        {#if lignesDeStatut}
          {#each lignesDeStatut as ligne, i (i)}
            <p
              class="mt-1 flex items-start gap-1.5 court:mt-0 court:inline {i > 0 ? 'court:ml-1' : ''} {ligne.changement
                ? 'font-medium text-zinc-950 dark:text-white'
                : ''}"
            >
              {#if ligne.changement}<Icone nom="rotate-ccw-clock" class="mt-0.5 shrink-0 text-sm court:mr-1 court:mt-0" />{/if}<span
                class="coupe-mots min-w-0">{ligne.texte}</span
              >
            </p>
          {/each}
        {:else if mention}
          <p class="mt-1 coupe-mots court:mt-0 court:inline">{mention}</p>
        {/if}
      </div>

      {#if etat === "chargement"}
        <!-- Lignes d'attente à la largeur du texte ; l'annonce dit ce qu'on
             attend. -->
        <div class="space-y-2.5" aria-hidden="true">
          <div class="h-4 w-full rounded bg-zinc-200 motion-safe:animate-pulse dark:bg-zinc-800"></div>
          <div class="h-4 w-11/12 rounded bg-zinc-200 motion-safe:animate-pulse dark:bg-zinc-800"></div>
          <div class="h-4 w-4/5 rounded bg-zinc-200 motion-safe:animate-pulse dark:bg-zinc-800"></div>
        </div>
        <p class="sr-only" role="status">{t("chat.preview.loading")}</p>
      {:else if etat === "indisponible"}
        <p class="text-sm text-zinc-700 dark:text-zinc-300" data-testid="chat-preview-unavailable">
          {t("chat.preview.unavailable")}
        </p>
      {:else if etat === "pret" && apercu}
        {#if section}
          <p class="coupe-mots mb-2 text-xs text-zinc-500 dark:text-zinc-400 court:mb-1">{section}</p>
        {/if}
        {#if apercu.englobant}
          <!-- Contrat §4 : un morceau qui porte l'article AVEC d'autres doit
               être dit comme tel. Recadré sur l'en-tête de l'article, le texte
               ci-dessous n'est plus que lui : la phrase le dit autrement. -->
          <p
            class="mb-3 flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300 court:mb-2"
            data-testid="chat-preview-englobant"
          >
            <Icone nom="triangle-alert" class="mt-0.5 shrink-0 text-base text-zinc-950 dark:text-white" /><span
              >{decoupe?.recadre ? t("chat.preview.englobantExtrait") : t("chat.preview.englobant")}</span
            >
          </p>
        {/if}
        {#if malLu}
          <!-- Avant le texte, pour qu'on sache, en lisant « e e o n u », que
               ces lettres ne sont pas la loi. Une icône et une phrase, jamais
               de rouge : ce n'est pas une erreur du site. -->
          <p class="mb-3 flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300 court:mb-2" data-testid="chat-preview-ocr">
            <Icone nom="scroll-text" class="mt-0.5 shrink-0 text-base text-zinc-950 dark:text-white" /><span
              >{t("chat.preview.ocr")}</span
            >
          </p>
        {/if}
        {#if passage}
          <p class="mb-2 text-xs text-zinc-500 dark:text-zinc-400 court:mb-1">{t("chat.preview.bold")}</p>
        {/if}
        <!-- Le texte officiel en Literata texte (Q5), jamais ce que l'IA
             rédige. Le gras est la vraie graisse 600 de la police.
             Mesure de 34em (544 px en 16 px, environ 70 caractères) : la
             feuille d'une tablette en portrait (672 px) laissait courir 85 à
             90 caractères par ligne, au-delà des 45 à 75 qu'on lit sans
             perdre la ligne suivante. La mesure du corps d'un article de blog ;
             le panneau d'ordinateur (360 px) et le téléphone restent plus
             étroits qu'elle. -->
        <div
          class="coupe-mots max-w-[34em] space-y-3 font-texte text-base leading-relaxed text-zinc-700 dark:text-zinc-300"
          lang={langueDuTexte ?? undefined}
          data-testid="chat-preview-text"
        >
          {#if apercu.titre}
            <p class="font-semibold text-zinc-950 dark:text-white">{apercu.titre}</p>
          {/if}
          {#each paragraphes as paragraphe, i (i)}
            <p>{paragraphe.avant}{#if paragraphe.gras}<strong class="font-semibold text-zinc-950 dark:text-white"
                  >{paragraphe.gras}</strong
                >{/if}{paragraphe.apres}</p>
          {/each}
        </div>
        {#if decoupe?.suivant && !apercu.englobant}
          <!-- Là où l'aperçu s'arrête : la suite du passage enregistré est un
               autre article (découpage de la base), que le texte intégral
               montre à sa place. -->
          <p class="mt-3 flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300" data-testid="chat-preview-cut">
            <Icone nom="scroll-text" class="mt-0.5 shrink-0 text-base text-zinc-950 dark:text-white" /><span
              >{t("chat.preview.cutBefore").replace("{n}", decoupe.suivant)}</span
            >
          </p>
        {:else if apercu.tronque && !decoupe?.suivant}
          <p class="mt-3 text-sm text-zinc-700 dark:text-zinc-300">{t("chat.preview.truncated")}</p>
        {/if}
      {/if}
    </div>

    <!--
      Le pied : « Lire dans le texte intégral » et la mention du Journal
      officiel. Dans un article long, ils étaient au bout d'un long défilement,
      hors de vue à toutes les tailles (captures r1) ; P3 prévoyait de renvoyer
      au texte depuis l'aperçu d'un article très long. Collé au bas de la zone
      (`sticky`), il reste à portée ; un article court le garde à sa suite,
      comme la maquette. Fond plein : le texte défile dessous sans s'y mêler.
      Écran court (téléphone en paysage) : le bouton et la mention sur une
      ligne, 6 px au-dessus et au-dessous, chaque ligne du texte y comptant.
    -->
    <div
      bind:this={pied}
      data-testid="chat-preview-footer"
      class="sticky bottom-0 border-t bg-white pb-4 pt-4 dark:bg-zinc-900 court:flex court:items-center court:gap-4 court:py-1.5 {modale
        ? 'px-4'
        : 'px-5'} {deborde ? 'border-zinc-200 dark:border-zinc-800' : 'border-transparent'}"
    >
      <!-- Nouvel onglet : de retour sur /chat, la page ne réaffiche pas la
           conversation (même règle que les liens des réponses). -->
      <a
        href={adresse}
        target="_blank"
        rel="noopener"
        data-testid="chat-preview-full"
        class="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-zinc-500 px-4 text-sm font-semibold text-zinc-950 transition-colors hover:border-zinc-950 dark:border-zinc-400 dark:text-white dark:hover:border-white court:w-auto court:shrink-0"
      >
        {cible.numero ? t("chat.preview.readArticle") : t("chat.preview.readText")}<Icone
          nom="arrow-right"
          class="text-base"
        /><span class="sr-only">{t("chat.preview.newTab")}</span>
      </a>
      <p class="mt-3 text-xs text-zinc-500 dark:text-zinc-400 court:mt-0">{t("chat.preview.official")}</p>
    </div>
  </div>

  <!-- La région d'annonce du chat tant que la feuille est modale (voir
       `annonce`). Rendue dans les deux formes : présente dès l'ouverture,
       elle est connue des lecteurs d'écran avant sa première phrase. Hors du
       flux (sr-only). -->
  <p class="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="chat-preview-announce">
    {annonce}
  </p>
</div>
