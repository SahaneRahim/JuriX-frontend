<script lang="ts">
  /**
   * Champ de mot de passe, avec un bouton qui affiche ou masque la saisie.
   *
   * POURQUOI. Un mot de passe se tape à l'aveugle, souvent sur un clavier de
   * téléphone, sans correcteur : une faute de frappe y passe pour un mauvais
   * mot de passe, et un nouveau mot de passe mal tapé deux fois de suite ne
   * se voit qu'à la connexion suivante. Le bouton montre ce qui est tapé.
   *
   * Un seul composant pour les cinq champs du site (connexion, inscription,
   * réinitialisation deux fois, fenêtre des comptes de l'administration) :
   * recopié, le comportement ci-dessous aurait divergé d'une page à l'autre.
   *
   * CE QUE LA PAGE GARDE. Son `<label for>`, qui vise `id` ; ses classes de
   * champ (`class`) ; et tout autre attribut (`data-testid`, `required`,
   * `minlength`, `aria-describedby`, `name`…), posé tel quel sur le champ.
   * `autocomplete` ne change jamais : current-password à la connexion,
   * new-password ailleurs, que la saisie soit affichée ou non. C'est lui qui
   * guide les gestionnaires de mots de passe.
   *
   * LE BOUTON :
   * - `type="button"` : un bouton d'un formulaire est un bouton d'envoi par
   *   défaut. Basculer l'affichage enverrait la connexion ;
   * - 44 px de côté, posé dans le champ, dont la marge droite lui fait place ;
   * - `mousedown` sans effet par défaut : un clic ou un appui laisse le focus
   *   dans le champ (le clavier du téléphone ne se referme pas), et le
   *   curseur (ou la sélection) est remis à sa place après le changement de
   *   type, qui le ramène au début (voir `basculer`). Activé au clavier, il
   *   garde le focus, et le lecteur d'écran annonce son nouvel état ;
   * - `aria-pressed` porte l'état, l'`aria-label` dit l'action suivante
   *   (« Afficher… », « Masquer… »), comme l'icône : l'œil, puis l'œil barré.
   *
   * Affichée en clair, la saisie n'a ni majuscule automatique, ni correction,
   * ni vérification orthographique : sur téléphone, elles réécrivaient le mot
   * de passe sous les doigts.
   *
   * À l'envoi du formulaire, la saisie est masquée de nouveau : un mot de
   * passe resté en clair après « Se connecter » s'afficherait sous l'erreur,
   * et un champ de type texte au moment de l'envoi peut finir dans
   * l'historique de saisie du navigateur au lieu de son gestionnaire de mots
   * de passe.
   */
  import { onMount, tick } from "svelte";
  import Icone from "$lib/components/Icone.svelte";
  import { tr } from "$lib/stores/language";

  /** id du champ : le `<label for>` de la page s'y rattache. */
  export let id: string;
  /** La saisie (`bind:value`). */
  export let value = "";
  /** current-password (connexion), new-password (création, réinitialisation). */
  export let autocomplete: "current-password" | "new-password";

  let className = "";
  /** Classes du champ : la recette des champs de la page. */
  export { className as class };

  let champ: HTMLInputElement;
  let visible = false;

  async function basculer() {
    // Souris ou toucher : `mousedown` sans effet par défaut a laissé le focus
    // dans le champ. Au clavier, c'est le bouton qui l'a, et il le garde.
    const dansLeChamp = document.activeElement === champ;
    const { selectionStart: debut, selectionEnd: fin, selectionDirection: sens } = champ;
    visible = !visible;
    if (!dansLeChamp) return;
    await tick();
    champ.focus();
    // Chromium reconstruit la zone de saisie à la mise en page qui suit le
    // changement de type, et y remet le curseur au début (mesuré : sélection
    // 2-5 avant, 0-0 à l'image suivante). La mise en page est donc forcée ici,
    // AVANT de reposer la sélection, qui sinon serait écrasée juste après.
    void champ.offsetWidth;
    if (debut !== null && fin !== null) champ.setSelectionRange(debut, fin, sens ?? undefined);
  }

  onMount(() => {
    const formulaire = champ.form;
    if (!formulaire) return;
    // Phase de capture : avant le gestionnaire d'envoi de la page. Le type est
    // aussi posé tout de suite, sans attendre la mise à jour de Svelte.
    const masquer = () => {
      if (!visible) return;
      visible = false;
      champ.type = "password";
    };
    formulaire.addEventListener("submit", masquer, true);
    return () => formulaire.removeEventListener("submit", masquer, true);
  });
</script>

<div class="relative">
  <!-- Les attributs de la page d'abord : ceux qui suivent (type, id,
       autocomplete) ne doivent pas pouvoir être écrasés par eux. -->
  <input
    {...$$restProps}
    bind:this={champ}
    bind:value
    {id}
    type={visible ? "text" : "password"}
    {autocomplete}
    autocapitalize="off"
    autocorrect="off"
    spellcheck="false"
    class="{className} pr-12"
  />
  <button
    type="button"
    aria-controls={id}
    aria-pressed={visible}
    aria-label={visible ? $tr("auth.hidePassword") : $tr("auth.showPassword")}
    data-testid="{id}-afficher"
    on:mousedown={(evenement) => evenement.preventDefault()}
    on:click={basculer}
    class="group absolute inset-y-0 right-0 my-auto flex h-11 w-11 items-center justify-center rounded-xl text-zinc-500 transition-colors hover:text-zinc-950 focus-visible:outline-none dark:text-zinc-400 dark:hover:text-white"
  >
    <!-- Le fond de survol et l'anneau de focus sur une pastille de 32 px :
         le bouton de 44 px déborde d'un champ de 42 px, et son contour
         sortirait du champ. -->
    <span
      class="flex h-8 w-8 items-center justify-center rounded-lg transition-colors group-hover:bg-zinc-100 group-focus-visible:ring-2 group-focus-visible:ring-zinc-950 dark:group-hover:bg-zinc-800 dark:group-focus-visible:ring-white"
    >
      <Icone nom={visible ? "eye-off" : "eye"} class="text-xl" />
    </span>
  </button>
</div>
