<script context="module" lang="ts">
  /**
   * Le délai d'une lettre, de 38 à 72 ms. Irrégulier, comme une frappe, mais
   * calculé et non tiré au hasard : la même phrase se tape toujours au même
   * rythme, et les tests le rejouent à l'identique.
   */
  export function delaiDeLettre(rang: number): number {
    return 38 + ((rang * 7919) % 35);
  }
</script>

<script lang="ts">
  /**
   * L'exemple tapé du champ de l'accueil (refonte A, décision H9) : « Exemple :
   * Quelles indemnités en cas de licenciement abusif ? », écrit lettre à
   * lettre par-dessus le champ vide, puis effacé, et le suivant.
   *
   * CE QU'IL FAIT.
   * - UNE boucle : chaque exemple est tapé (38 à 72 ms par lettre), gardé
   *   2,2 s, effacé (3 lettres toutes les 16 ms), puis le suivant ; le
   *   DERNIER reste affiché, et la boucle s'arrête (A2 § 4).
   * - Il s'interrompt dès que le champ a le focus ou n'est plus vide (`actif`
   *   faux), et repart à zéro quand il redevient actif (le champ quitté
   *   vide). Une nouvelle liste (profil ou mode changé) le fait aussi
   *   repartir à zéro.
   * - Le préfixe « Exemple : » reste affiché en permanence, effacement
   *   compris, pour qu'on ne prenne jamais l'exemple pour une saisie (la
   *   maquette ne le montrait qu'avec la première lettre : écart voulu).
   *
   * POURQUOI LE PREMIER EXEMPLE EST DANS LE HTML DU SERVEUR. Sans JavaScript,
   * avant l'hydratation et en mouvement réduit, aucune frappe n'a lieu : le
   * premier exemple, entier et sans curseur, est l'état lisible. Monté, le
   * composant part de cet état (l'exemple est « déjà tapé ») : il le garde
   * 2,2 s, puis l'efface et tape le suivant. Rien ne disparaît à
   * l'hydratation.
   *
   * POURQUOI `aria-hidden`. Texte décoratif : un lecteur d'écran n'a pas à
   * entendre la frappe, et le champ porte déjà son vrai nom (« Votre question
   * ou votre recherche »). Aucun élément focalisable dedans.
   *
   * MOUVEMENT RÉDUIT : `prefersReducedMotion` de svelte/motion (le mécanisme
   * du site, comme `duree`), lu à chaque départ et à chaque pas de la boucle :
   * activé pendant la frappe, il l'arrête au pas suivant. Aucune minuterie ne
   * tourne, aucun curseur : le premier exemple de la liste, entier. Un
   * changement de profil ou de mode change cet exemple, sans frappe.
   *
   * Le masquage au focus et dès la première lettre saisie est fait en CSS par
   * le champ (`peer-focus`, `peer-placeholder-shown`, ChampUnique.svelte) :
   * il vaut aussi sans JavaScript. Ce composant ne gère que le texte et ses
   * minuteries.
   */
  import { onDestroy, onMount } from "svelte";
  import { prefersReducedMotion } from "svelte/motion";

  /** Les exemples, dans l'ordre de la boucle. */
  export let exemples: readonly string[] = [];
  /** Faux quand le champ a le focus ou n'est pas vide : la frappe s'arrête. */
  export let actif = true;
  /** « Exemple : », toujours affiché devant le texte. */
  export let libelle = "";

  let className = "";
  export { className as class };

  /** Réglages de la maquette (A2 § 4). */
  const PAUSE_PLEIN = 2200;
  const LETTRES_PAR_EFFACEMENT = 3;
  const PAS_D_EFFACEMENT = 16;
  const PAUSE_ENTRE_DEUX = 420;
  const DEPART = 500;

  type Phase = "frappe" | "plein" | "efface" | "fini";

  let monte = false;
  /** La boucle tourne : il y a quelque chose à taper ou à effacer. */
  let anime = false;
  /** Rien n'a encore bougé depuis le rendu du serveur. */
  let intact = true;
  let rang = 0;
  let lettres = (exemples[0] ?? "").length;
  let phase: Phase = "plein";
  let minuterie: ReturnType<typeof setTimeout> | null = null;
  let listeVue = exemples.join("\n");
  let actifAvant = actif;

  function arreter() {
    if (minuterie !== null) clearTimeout(minuterie);
    minuterie = null;
  }

  function planifier(ms: number) {
    arreter();
    minuterie = setTimeout(pas, ms);
  }

  /** Le premier exemple, entier, sans frappe ni curseur. */
  function figer() {
    arreter();
    anime = false;
    rang = 0;
    lettres = (exemples[0] ?? "").length;
    phase = "fini";
  }

  /** Repart de zéro : le premier exemple sera tapé depuis la première lettre. */
  function repartir() {
    if (!monte) return;
    intact = false;
    if (prefersReducedMotion.current || exemples.length === 0) {
      figer();
      return;
    }
    arreter();
    anime = true;
    rang = 0;
    lettres = 0;
    phase = "frappe";
    if (actif) planifier(DEPART);
  }

  function pas() {
    minuterie = null;
    if (!actif || !anime) return;
    if (prefersReducedMotion.current) {
      figer();
      return;
    }
    intact = false;
    const courant = exemples[rang] ?? "";
    if (phase === "frappe") {
      lettres = Math.min(lettres + 1, courant.length);
      if (lettres < courant.length) planifier(delaiDeLettre(lettres));
      else if (rang >= exemples.length - 1) {
        // Le dernier reste affiché : la boucle s'arrête là.
        phase = "fini";
        anime = false;
      } else {
        phase = "plein";
        planifier(PAUSE_PLEIN);
      }
    } else if (phase === "plein") {
      phase = "efface";
      planifier(PAS_D_EFFACEMENT);
    } else if (phase === "efface") {
      lettres = Math.max(lettres - LETTRES_PAR_EFFACEMENT, 0);
      if (lettres > 0) planifier(PAS_D_EFFACEMENT);
      else {
        rang += 1;
        phase = "frappe";
        planifier(PAUSE_ENTRE_DEUX);
      }
    }
  }

  /** `_liste` : la nouvelle liste, dépendance du `$:` plus bas. */
  function surNouvelleListe(_liste: readonly string[]) {
    const cle = exemples.join("\n");
    if (cle === listeVue) return;
    const premierAvant = listeVue.split("\n")[0];
    listeVue = cle;
    if (!monte) {
      // Au serveur et avant le montage : le premier exemple, entier.
      rang = 0;
      lettres = (exemples[0] ?? "").length;
      return;
    }
    // Au montage, le profil lu dans le navigateur remplace celui du serveur
    // (profil général). Si l'exemple affiché ne change pas (« Quelles
    // indemnités… » ouvre les deux listes), rien ne repart : l'effacer pour
    // le retaper aussitôt ferait un saut sans raison.
    if (intact && exemples[0] === premierAvant) return;
    repartir();
  }

  /** `_actif` : l'état du champ, dépendance du `$:` plus bas. */
  function surActif(_actif: boolean) {
    if (actif === actifAvant) return;
    actifAvant = actif;
    if (actif) repartir();
    else arreter();
  }

  $: surNouvelleListe(exemples);
  $: surActif(actif);
  // APRÈS les deux lignes qui précèdent (PASSATION § 8, piège 6) : en mode
  // « legacy », les `$:` s'exécutent dans l'ordre du source, et un texte
  // calculé avant elles garderait, le temps d'une mise à jour, l'exemple
  // d'avant le changement de liste.
  $: texte = (exemples[rang] ?? "").slice(0, lettres);

  onMount(() => {
    monte = true;
    if (prefersReducedMotion.current || exemples.length < 2) {
      figer();
      return;
    }
    // Le premier exemple est déjà affiché, entier : il est gardé, puis effacé.
    anime = true;
    phase = "plein";
    if (actif) planifier(PAUSE_PLEIN);
    else intact = false;
  });

  onDestroy(arreter);
</script>

<!-- Le curseur (`mv-curseur`, src/lib/mouvement.css) n'existe que pendant la
     boucle, et seulement si le mouvement est permis : sa classe ne
     s'affiche que dans le bloc « no-preference ». Ni au serveur, ni à la
     fin de la boucle. -->
<span aria-hidden="true" data-testid="accueil-exemple" class={className}
  ><b class="font-medium">{libelle}</b> {texte}{#if anime}<span
      class="mv-curseur ml-0.5 h-[1.1em] w-0.5 bg-zinc-950 align-[-0.2em] dark:bg-white"
    ></span>{/if}</span
>
