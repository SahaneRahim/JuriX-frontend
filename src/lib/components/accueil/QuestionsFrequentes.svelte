<script context="module" lang="ts">
  /** Le lien d'une question : elle part une fois à l'arrivée sur le chat (H1). */
  export function lienDeQuestion(question: string): string {
    return `/chat?q=${encodeURIComponent(question)}&envoyer=1`;
  }
</script>

<script lang="ts">
  /**
   * « Questions fréquentes · citoyens » : les trois questions de l'accueil du
   * profil (refonte A, E3b), sous le champ unique.
   *
   * DES LIENS, ET NON DES BOUTONS. Chaque question mène à
   * /chat?q=…&envoyer=1 : elle part une seule fois à l'arrivée sur le chat
   * (décision H1), et le lien marche dès le HTML du serveur, avant tout
   * JavaScript. Les questions sont celles de `suggestionsDeLAccueil`, déjà
   * passées par la vraie recherche du chat et relues (src/lib/suggestions.ts) :
   * rien n'est écrit ici.
   *
   * POURQUOI `rel="nofollow"`. Le lien ENVOIE une question à l'ouverture : un
   * robot qui exécute le JavaScript et le suivrait dépenserait un appel au
   * modèle à chaque passage, et l'accueil est public. /chat est en noindex
   * mais reste explorable (src/routes/robots.txt) : rien d'autre ne l'en
   * écarte.
   *
   * LE PROFIL. `persona` vient de la page, qui ne le lit qu'après le montage
   * (au serveur : le profil général, « profil général »). Quand il change,
   * la liste est recréée (`{#key}`, A2 § 2.3) et ses lignes arrivent en
   * cascade, 70 ms d'écart (A2 § 4). Pas à l'arrivée sur la page : la liste
   * du serveur est déjà là, et rien ne doit retarder ce qui est lisible.
   */
  import Icone from "$lib/components/Icone.svelte";
  import { language, tr } from "$lib/stores/language";
  import { PERSONA_SLUG, type Persona } from "$lib/stores/persona";
  import { questionAffichee, suggestionsDeLAccueil } from "$lib/suggestions";

  /** Le profil affiché ; `null` : le profil général. */
  export let persona: Persona | null = null;

  $: questions = suggestionsDeLAccueil(persona, $language.current);
  $: pluriel = $tr(`accueil.faq.${persona ? PERSONA_SLUG[persona] : "general"}`);

  /**
   * Faux tant que le profil n'a pas changé depuis le premier rendu : la
   * cascade ne se joue qu'à un changement.
   */
  let cascade = false;
  let personaVu = persona;
  /** `profil` : le profil reçu, seule dépendance du `$:` plus bas. */
  function surProfil(profil: Persona | null) {
    if (profil === personaVu) return;
    personaVu = profil;
    cascade = true;
  }
  $: surProfil(persona);
</script>

<section aria-labelledby="accueil-faq-titre" data-testid="accueil-faq" class="mt-3.5 w-full max-w-[47.5rem] text-left sm:mt-11">
  <h2
    id="accueil-faq-titre"
    class="mx-0.5 mb-0.5 text-xs/[18px] font-normal text-zinc-500 dark:text-zinc-400 sm:mx-1 sm:mb-1.5 sm:text-[13px]/[18px]"
  >
    {$tr("accueil.faq.titre")} <strong class="font-semibold text-zinc-600 dark:text-zinc-300">{pluriel}</strong>
  </h2>
  {#key persona}
    <ul>
      {#each questions as question, rang (question)}
        <li
          class="border-b border-zinc-200 dark:border-zinc-800 {cascade ? 'mv-monter' : ''}"
          style="--d: {rang * 70}ms; --mv-duree: 0.55s"
        >
          <a
            href={lienDeQuestion(question)}
            rel="nofollow"
            class="group flex min-h-12 items-center gap-3 px-0.5 py-2 text-sm/5 text-zinc-700 motion-safe:transition-colors hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white sm:min-h-[52px] sm:gap-4 sm:px-1 sm:text-[15px]/[22px]"
          >
            <span
              class="line-clamp-2 flex-1 motion-safe:transition-transform motion-safe:duration-[350ms] motion-safe:ease-jx motion-safe:group-hover:translate-x-2"
              >{questionAffichee(question)}</span
            >
            <Icone
              nom="arrow-up-right"
              class="text-base text-zinc-400 group-hover:text-zinc-950 dark:text-zinc-500 dark:group-hover:text-white sm:text-lg motion-safe:transition-[color,transform] motion-safe:duration-[350ms] motion-safe:ease-jx motion-safe:group-hover:-translate-y-[3px] motion-safe:group-hover:translate-x-[3px]"
            />
          </a>
        </li>
      {/each}
    </ul>
  {/key}
</section>
