<script lang="ts">
  /**
   * Les trois actions d'un article (P2, choix du propriétaire : « trois
   * boutons : référence, texte, lien ») : « Copier la référence » (« Art. 1er,
   * décret n° 2021/745 du 28 décembre 2021 fixant … » et le lien), « Copier le
   * texte » (le texte, sa référence et « Seul le texte publié au Journal
   * officiel fait foi ») et le lien de l'article. Elles remplacent « Copier la
   * citation », qui recopiait l'article suivi de sa cote interne
   * (« PRC-9153 ») et du lien de l'article de DÉPART.
   *
   * LE LIEN. Sur un écran tactile qui l'a (Android, iOS), la feuille de
   * partage du système, avec le lien de l'article : WhatsApp y est, et
   * « Copier » aussi (P2 : au Cameroun, WhatsApp a remplacé le SMS).
   * Ailleurs, « Copier le lien », l'action secondaire que gardait P2. Le
   * bouton se nomme d'après ce qu'il fait. Il ne ressemble plus au « Partager »
   * du texte, en tête : même mot, même icône, et sans partage natif tous deux
   * ouvraient WhatsApp Web dans un nouvel onglet (vérification r1 du 29/10).
   *
   * Pas d'`alert()` : la copie est dite dans le bouton (« Référence
   * copiée », icône `check`) et annoncée aux lecteurs d'écran (région
   * `role="status"`) ; le focus reste sur le bouton. Un échec est écrit
   * sous la rangée.
   *
   * Trois boutons au même gabarit (44 px au doigt, 14 px), une rangée de
   * trois sur téléphone, libellés courts.
   *
   * REFONTE A (maquette RefonteLecture, décision L1). Deux actions au premier
   * plan, en cartes bordées : « Copier la référence » (icône `copy`) et
   * « Copier le lien » ; « Copier le texte », choix du propriétaire (P2) que
   * la maquette ne dessine pas, reste là, au second plan : dernier de la
   * rangée, sans bordure ni fond, même cible de 44 px. La coche de la copie
   * réussie se pose avec un petit ressort (`mv-ressort`, A2 § 3.4), rien en
   * mouvement réduit. Sous la rangée, la mention « Seul le texte publié au
   * Journal officiel fait foi », jusqu'ici dans le seul texte copié, est
   * visible (X7, `loi.copie.foi`) : en zinc-500 sur le fond de la page, et
   * jamais sur un aplat gris, où elle passerait sous 4,5:1.
   */
  import { onDestroy, onMount } from "svelte";
  import Icone from "$lib/components/Icone.svelte";
  import { tr } from "$lib/stores/language";
  import { copierDansLePressePapiers, partageNatifPossible, partagerNativement, type Partage } from "./presse-papiers";
  import { BOUTON_SECONDAIRE } from "./typographie";

  /** Ce que copie « Copier la référence » (référence et lien). */
  export let reference: string;
  /** Ce que copie « Copier le texte ». */
  export let texte: string;
  /** L'adresse de l'article, que copie « Copier le lien ». */
  export let lien: string;
  /** Ce que reçoit la feuille de partage du système (titre, « Art. 6 — Loi n° 96/06 », lien). */
  export let partage: Partage;

  /**
   * L'icône passe au-dessus d'un libellé de 12 px sous 390 px, et non sous
   * 360 px comme les actions du texte : « Référence » demande 55 px à côté de
   * son icône, et une colonne en laisse 59 à 390 px, 51 à 360 px.
   */
  const EMPILE = "max-sm:text-xs max-[389px]:flex-col max-[389px]:gap-0.5";

  /**
   * « Copier le texte », au second plan (L1) : le gabarit du bouton
   * secondaire, sans sa bordure ni son fond. POURQUOI `!` : ces classes
   * doivent l'emporter sur celles de BOUTON_SECONDAIRE, écrites plus loin
   * dans la feuille de Tailwind pour certaines.
   */
  const SECOND_PLAN =
    "!border-transparent !bg-transparent !text-zinc-600 hover:!text-zinc-950 dark:!text-zinc-400 dark:hover:!text-white";

  /**
   * Feuille de partage du système, seulement sous un pointeur tactile : sur
   * un ordinateur, Chrome et Edge l'ont aussi, mais on y attend une copie.
   * Su après le montage ; le rendu serveur dit « Copier le lien ».
   */
  let partageNatif = false;
  onMount(() => {
    partageNatif = partageNatifPossible(partage) && window.matchMedia("(pointer: coarse)").matches;
  });

  type Copie = "reference" | "texte" | "lien";
  let copie: Copie | null = null;
  // Hors de `nom={…}` : le contrôle des icônes (icones.test.ts) lit toute
  // chaîne de cette expression comme un nom d'icône.
  $: referenceCopiee = copie === "reference";
  $: texteCopie = copie === "texte";
  $: lienCopie = copie === "lien";
  let annonce = "";
  let echec = "";
  let minuterie: ReturnType<typeof setTimeout> | undefined;

  const CONTENU: Record<Copie, () => string> = {
    reference: () => reference,
    texte: () => texte,
    lien: () => lien,
  };
  const ANNONCE: Record<Copie, string> = {
    reference: "loi.copie.reference_faite",
    texte: "loi.copie.texte_fait",
    lien: "loi.copie.lien_fait",
  };

  async function copier(quoi: Copie) {
    echec = "";
    const reussie = await copierDansLePressePapiers(CONTENU[quoi]());
    clearTimeout(minuterie);
    if (!reussie) {
      copie = null;
      echec = $tr("loi.copie.echec");
      annonce = echec;
      return;
    }
    copie = quoi;
    annonce = $tr(ANNONCE[quoi]);
    minuterie = setTimeout(() => {
      copie = null;
      annonce = "";
    }, 2500);
  }

  function lienDeLArticle() {
    // Appelé dans le geste du lecteur, sans `await` avant : le navigateur
    // refuse `navigator.share` hors d'un geste.
    if (partageNatif && partageNatifPossible(partage)) {
      echec = "";
      void partagerNativement(partage).then((resultat) => {
        if (resultat !== "echec") return;
        echec = $tr("loi.partage.echec");
        annonce = echec;
      });
      return;
    }
    void copier("lien");
  }

  // Un autre article : l'état « copiée » de l'article précédent ne le suit pas.
  $: reinitialiser(reference);
  function reinitialiser(_cle: string) {
    clearTimeout(minuterie);
    copie = null;
    annonce = "";
    echec = "";
  }

  onDestroy(() => clearTimeout(minuterie));
</script>

<div class="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center" data-testid="law-article-actions">
  <button
    type="button"
    class="{BOUTON_SECONDAIRE} {EMPILE}"
    on:click={() => copier("reference")}
    data-testid="law-copy-reference"
  >
    <Icone nom={referenceCopiee ? "check" : "copy"} class="h-4 w-4 shrink-0 {referenceCopiee ? 'mv-ressort' : ''}" />
    <span class="sm:hidden">{referenceCopiee ? $tr("loi.copie.faite") : $tr("loi.copie.reference_court")}</span>
    <span class="hidden sm:inline">
      {referenceCopiee ? $tr("loi.copie.reference_faite") : $tr("loi.copie.reference")}
    </span>
  </button>
  <!-- Nommé par son libellé visible, comme les deux autres boutons : une
       étiquette plus longue ne contiendrait plus « Copié » pendant
       l'annonce (critère WCAG 2.5.3, l'étiquette dans le nom). -->
  <button
    type="button"
    class="{BOUTON_SECONDAIRE} {EMPILE}"
    on:click={lienDeLArticle}
    data-testid="law-copy-link"
  >
    <Icone nom={lienCopie ? "check" : "link"} class="h-4 w-4 shrink-0 {lienCopie ? 'mv-ressort' : ''}" />
    <span class="sm:hidden">{lienCopie ? $tr("loi.copie.fait") : $tr("loi.copie.lien_court")}</span>
    <span class="hidden sm:inline"
      >{lienCopie
        ? $tr("loi.copie.lien_fait")
        : partageNatif
          ? $tr("loi.partage.lien")
          : $tr("loi.copie.lien")}</span
    >
  </button>
  <!-- Au second plan (L1) : le même bouton, sans bordure ni fond. -->
  <button
    type="button"
    class="{BOUTON_SECONDAIRE} {EMPILE} {SECOND_PLAN}"
    on:click={() => copier("texte")}
    data-testid="law-copy-text"
  >
    <Icone nom={texteCopie ? "check" : "file-text"} class="h-4 w-4 shrink-0 {texteCopie ? 'mv-ressort' : ''}" />
    <span class="sm:hidden">{texteCopie ? $tr("loi.copie.fait") : $tr("loi.copie.texte_court")}</span>
    <span class="hidden sm:inline">{texteCopie ? $tr("loi.copie.texte_fait") : $tr("loi.copie.texte")}</span>
  </button>
</div>
<p role="status" class="sr-only">{annonce}</p>
{#if echec}
  <p class="mt-2 text-sm text-red-600 dark:text-red-400" data-testid="law-copy-error">{echec}</p>
{/if}
<p class="mt-3 text-[13px] leading-[18px] text-zinc-500 dark:text-zinc-400" data-testid="law-copy-foi">
  {$tr("loi.copie.foi")}
</p>
