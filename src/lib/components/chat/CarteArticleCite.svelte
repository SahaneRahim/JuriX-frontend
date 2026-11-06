<script lang="ts">
  /**
   * Une carte du panneau « Articles cités » (refonte A, A1 § 4) : un article
   * cité par la réponse, replié ou ouvert, une seule carte ouverte à la fois
   * (la page décide).
   *
   * Repliée : référence, titre, chevron, pastille de statut (C7 : connue quand
   * l'aperçu est lu, sinon absente, jamais inventée). Ouverte : encadré de
   * statut tamponné, texte officiel, passage souligné, légende, « Lire dans le
   * texte intégral » et « Copier la référence ».
   *
   * Sur l'ancienne API, ou quand l'article est introuvable (404), l'aperçu ne
   * vient pas : la carte le dit et garde le lien vers le texte intégral
   * (contrat §4 et §8). Un texte cité sans article n'appelle pas l'API : son
   * statut et son lien suffisent.
   *
   * L'ARTICLE, ET LUI SEUL. Le passage que l'API rend peut porter d'autres
   * articles, collés par le découpage de la base (« Art. 35 » du Code du
   * travail : les articles 35 à 40 d'un bloc). La carte s'arrête au premier
   * en-tête d'un autre article et le dit (`articleDuPassage`).
   *
   * POURQUOI LE CORPS N'EST RENDU QU'OUVERT. Fermée, une carte n'a pas à
   * laisser dans la page un texte, des liens et des `data-testid` en double :
   * son corps naît à l'ouverture, ce qui rejoue aussi le tampon, et reste le
   * temps du repli (`mv-derouler`), inerte et sans `data-testid`.
   */
  import { onDestroy, tick } from "svelte";
  import { adresseDeLArticle, sansMarqueursDePage } from "$lib/api-publique";
  import Icone from "$lib/components/Icone.svelte";
  import { copierDansLePressePapiers } from "$lib/components/loi/presse-papiers";
  import { referenceACopier, referenceDeLArticle, referenceDuTexte } from "$lib/components/loi/reference";
  import { duree } from "$lib/mouvement";
  import { language, tr } from "$lib/stores/language";
  import type { ArticleApercu } from "$lib/types";
  import { apercuDeLArticle } from "./apercus";
  import { articleDuPassage, bruitDeNumerisation, langueProbable } from "./citations";
  import {
    cleDeLaPastille,
    designationDuTexteCite,
    enPhrase,
    libelleDeLaCitation,
    lignesDuStatutDeLArticle,
    mentionDuStatut,
    ponctuationFrancaise,
    typographieDesNumeros,
  } from "./libelles";
  import { paragraphesAvecPassages, passagesDeLArticle, type CarteDeLaReponse } from "./passages";

  export let carte: CarteDeLaReponse;
  /** Identifiant unique dans la page, pour `aria-controls`. */
  export let idCarte: string;
  export let ouverte = false;
  /** La citation touchée, si elle est de cette carte ; `null` : carte ouverte par son en-tête. */
  export let citationActive: number | null = null;
  /** Lire l'aperçu sans attendre l'ouverture, pour la pastille (C7 : trois cartes au plus). */
  export let precharger = false;
  /** Date du relevé des liens (`GET /corpus`), pour un texte cité sans article. */
  export let releveLe: string | null = null;
  export let surBasculer: () => void;
  /** Dit le résultat de la copie par la région d'annonce de la page : aucune ici (PASSATION § 8.12). */
  export let surAnnonce: (texte: string) => void = () => {};

  $: t = $tr;
  $: langue = $language.current;

  /** La durée de `mv-derouler` (0,55 s), plus une image. */
  const DUREE_DU_DEROULE = 570;
  /** « Référence copiée » reste 1,8 s (maquette). */
  const DUREE_DE_LA_COPIE = 1800;
  /** Entre l'intitulé et le statut, quand ils se suivent sur un écran court. */
  const SEPARATEUR_DU_STATUT = " · ";

  let racine: HTMLElement;

  // ------------------------------------------------------------ chargement

  let etat: "attente" | "chargement" | "pret" | "indisponible" | "texte" = carte.numero ? "attente" : "texte";
  let apercu: ArticleApercu | null = null;
  let controleur: AbortController | null = null;

  async function charger() {
    if (!carte.numero) return;
    etat = "chargement";
    const lecture = new AbortController();
    controleur = lecture;
    const lu = await apercuDeLArticle(carte.lawId, carte.numero, carte.articleId, lecture.signal).catch(() => null);
    if (lecture.signal.aborted) return;
    apercu = lu;
    etat = lu ? "pret" : "indisponible";
  }

  $: if (etat === "attente" && (ouverte || precharger)) void charger();

  // ------------------------------------------------------------ ouverture

  /** Le corps est rendu : carte ouverte, ou qui finit de se replier. */
  let corps = ouverte;
  let ouverteDepuis = 0;
  let ouverteAvant = ouverte;
  let minuterieDuRepli: ReturnType<typeof setTimeout> | undefined;

  function suivreLOuverture(oui: boolean) {
    if (oui === ouverteAvant) return;
    ouverteAvant = oui;
    clearTimeout(minuterieDuRepli);
    if (oui) {
      corps = true;
      ouverteDepuis = Date.now();
      passageMontre = null;
      // Une panne passagère ne condamne pas l'aperçu : rouvrir réessaie.
      if (etat === "indisponible") void charger();
    } else {
      minuterieDuRepli = setTimeout(() => (corps = false), duree(DUREE_DU_DEROULE));
    }
  }
  $: suivreLOuverture(ouverte);

  // ------------------------------------------------------------ contenu

  // L'ORDRE DES `$:` COMPTE (mode legacy : ordre du source). Chacun après ce
  // qu'il lit.
  //
  // Marqueurs de page de l'OCR retirés AVANT de chercher les passages : leurs
  // positions portent sur le texte affiché. Puis l'article seul : le passage
  // s'arrête à l'en-tête d'un autre article, et un passage englobant se
  // recadre sur l'en-tête du sien (voir `articleDuPassage`).
  $: contenuRendu = apercu ? sansMarqueursDePage(apercu.contenu) : "";
  $: decoupe = apercu ? articleDuPassage(contenuRendu, apercu.numero || carte.numero, apercu.englobant) : null;
  $: contenu = decoupe ? contenuRendu.slice(decoupe.debut, decoupe.fin).trim() : "";
  $: passages = apercu ? passagesDeLArticle(contenu, carte.citations) : new Map();
  /**
   * Le passage souligné. La citation touchée a le sien, ou aucun (C10 : carte
   * sans souligné ni légende). Ouverte par son en-tête, sans citation, la
   * carte souligne le premier passage connu : l'ancienne liste en montrait
   * un aussi, et la légende reste vraie.
   */
  $: actif =
    citationActive !== null
      ? citationActive
      : (carte.citations.find((c) => passages.get(c.indexCitation))?.indexCitation ?? null);
  $: aUnPassage = actif !== null && Boolean(passages.get(actif));
  $: paragraphes = apercu ? paragraphesAvecPassages(contenu, passages, actif) : [];
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
  $: mention = enPhrase(mentionDuStatut(carte.statut, t, langue, releveLe));
  $: titreDuTexte = typographieDesNumeros(apercu?.texte?.titre || carte.titre);
  $: adresse = adresseDeLArticle(carte.lawId, carte.numero);
  $: libelle = libelleDeLaCitation(carte.numero, carte.titre, carte.reference, t);
  $: clePastille = cleDeLaPastille(apercu);
  // Repères, et statut prouvé de la citation tant que la pastille manque :
  // l'ancienne liste le disait à chaque ligne, il ne doit pas disparaître.
  $: reperes = [
    designationDuTexteCite(carte.titre, carte.reference).reperes,
    clePastille ? "" : mentionDuStatut(carte.statut, t, langue, releveLe),
  ]
    .filter(Boolean)
    .join(" · ");

  // ------------------------------------------------------------ vue

  /** Marge gardée autour du passage quand il est amené dans la vue. */
  const MARGE_DU_PASSAGE = 24;
  /** La citation dont le passage a déjà été amené dans la vue : une fois chacune. */
  let passageMontre: number | null = null;
  let minuterieDuPassage: ReturnType<typeof setTimeout> | undefined;

  /**
   * Amène le passage dans la vue de la zone qui défile. La légende promettait
   * un souligné qui, dans un article long, était plusieurs écrans plus bas. Le
   * moins de défilement possible ; plus haut que la vue, son début en haut. Le
   * focus ne bouge pas.
   */
  function montrerLePassage() {
    const zone = racine?.closest<HTMLElement>("[data-zone-preuves]");
    const marques = racine?.querySelectorAll<HTMLElement>("mark");
    if (!zone || !marques?.length) return;
    const origine = zone.getBoundingClientRect().top;
    const haut = marques[0].getBoundingClientRect().top - origine;
    const bas = marques[marques.length - 1].getBoundingClientRect().bottom - origine;
    if (haut >= MARGE_DU_PASSAGE && bas + MARGE_DU_PASSAGE <= zone.clientHeight) return;
    const decalage =
      bas - haut + 2 * MARGE_DU_PASSAGE > zone.clientHeight || haut < MARGE_DU_PASSAGE
        ? haut - MARGE_DU_PASSAGE
        : bas + MARGE_DU_PASSAGE - zone.clientHeight;
    zone.scrollTop = Math.max(0, zone.scrollTop + decalage);
  }

  /**
   * POURQUOI ATTENDRE LA FIN DU DÉROULÉ. Pendant les 0,55 s de `mv-derouler`,
   * la carte n'a pas sa hauteur : mesuré tout de suite, le passage paraît hors
   * de vue, ou dedans, à tort.
   */
  $: if (ouverte && etat === "pret" && aUnPassage && passageMontre !== actif) {
    passageMontre = actif;
    clearTimeout(minuterieDuPassage);
    const reste = Math.max(0, duree(DUREE_DU_DEROULE) - (Date.now() - ouverteDepuis));
    void tick().then(() => {
      minuterieDuPassage = setTimeout(montrerLePassage, reste);
    });
  }

  // ------------------------------------------------------------ copie

  let copie: "repos" | "faite" | "echec" = "repos";
  let minuterieDeCopie: ReturnType<typeof setTimeout> | undefined;

  /**
   * « Copier la référence » : la fonction et le format de la page d'un texte
   * (décision C9), à partir des seuls champs de l'API.
   */
  async function copierLaReference() {
    const reference = carte.numero
      ? referenceDeLArticle({ numero: carte.numero, titreDuTexte: carte.titre, langue }, t)
      : referenceDuTexte(carte.titre, langue);
    const reussie = await copierDansLePressePapiers(referenceACopier(reference, new URL(adresse, location.origin).href));
    copie = reussie ? "faite" : "echec";
    surAnnonce(reussie ? t("loi.copie.reference_faite") : t("loi.copie.echec"));
    clearTimeout(minuterieDeCopie);
    if (reussie) minuterieDeCopie = setTimeout(() => (copie = "repos"), DUREE_DE_LA_COPIE);
  }

  onDestroy(() => {
    controleur?.abort();
    clearTimeout(minuterieDuRepli);
    clearTimeout(minuterieDuPassage);
    clearTimeout(minuterieDeCopie);
  });
</script>

<article
  bind:this={racine}
  data-testid="chat-carte"
  data-ouverte={ouverte ? "true" : "false"}
  class="rounded-xl border bg-white transition-colors dark:bg-zinc-900 {ouverte
    ? 'mv-ouvert border-zinc-950 dark:border-zinc-300'
    : 'border-zinc-200 dark:border-zinc-800'}"
>
  <h3>
    <button
      type="button"
      data-testid="chat-article-cite"
      aria-expanded={ouverte}
      aria-controls={idCarte}
      on:click={surBasculer}
      class="flex min-h-11 w-full items-start gap-3 rounded-xl px-4 py-3 text-left"
    >
      <span class="min-w-0 flex-1">
        {#if reperes}
          <span class="coupe-mots block text-xs text-zinc-500 dark:text-zinc-400">{reperes}</span>
        {/if}
        <span class="coupe-mots block text-sm font-bold text-zinc-950 dark:text-white">{libelle}</span>
        <!-- Fermée seulement : ouverte, l'encadré de statut le dit en entier. -->
        {#if clePastille && !ouverte}
          <span
            data-testid="chat-carte-statut"
            class="mt-1.5 inline-flex items-center gap-1 rounded-full border border-dashed border-zinc-500 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:border-zinc-400 dark:text-zinc-300"
          >
            <Icone nom="circle-dashed" class="shrink-0 text-xs" />{t(clePastille)}
          </span>
        {/if}
      </span>
      <Icone nom="chevron-down" class="mv-chevron mt-0.5 shrink-0 text-lg text-zinc-500 dark:text-zinc-400" />
    </button>
  </h3>

  <div id={idCarte} class="mv-derouler {ouverte ? 'mv-ouvert' : ''}" inert={!ouverte}>
    <div>
      {#if corps}
        <div class="px-4 pb-4 court:pb-2">
          <!-- Statut et identité du texte. Les lignes d'un changement actuel
               portent une icône et du gras, jamais du rouge (P1) : ce n'est
               pas une erreur. Sur écran court, l'intitulé et les lignes de
               statut se suivent dans un seul paragraphe : deux lignes au lieu
               de trois ou quatre, prises au texte de l'article. -->
          <div
            class="mb-3 rounded-lg bg-zinc-100 px-3 py-2 text-xs leading-relaxed text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 court:mb-2 court:py-1.5"
            data-testid={ouverte ? "chat-preview-status" : undefined}
          >
            <p class="coupe-mots court:inline">{titreDuTexte}</p>
            <!-- Le séparateur en expression : Svelte 5 retire les blancs du
                 bord d'une balise, et « · » se serait collé aux deux phrases. -->
            {#if lignesDeStatut || mention}<span class="hidden court:inline" aria-hidden="true"
                >{SEPARATEUR_DU_STATUT}</span
              >{/if}
            {#if lignesDeStatut}
              {#each lignesDeStatut as ligne, i (i)}
                <p
                  class="mt-1 flex items-start gap-1.5 court:mt-0 court:inline {i > 0 ? 'court:ml-1' : ''} {ligne.changement
                    ? 'font-medium text-zinc-950 dark:text-white'
                    : ''}"
                >
                  <!-- Le geste « tamponner » : l'icône tombe sur l'encadré, à
                       l'ouverture (le corps naît avec elle). -->
                  {#if ligne.changement}<Icone
                      nom="rotate-ccw-clock"
                      class="mv-tamponner mt-0.5 shrink-0 text-sm court:mr-1 court:mt-0"
                    />{:else if i === 0}<Icone
                      nom="circle-dashed"
                      class="mv-tamponner mt-0.5 shrink-0 text-sm court:mr-1 court:mt-0"
                    />{/if}<span class="coupe-mots min-w-0">{ligne.texte}</span>
                </p>
              {/each}
            {:else if mention}
              <p class="mt-1 coupe-mots court:mt-0 court:inline">{mention}</p>
            {/if}
          </div>

          {#if etat === "chargement" || etat === "attente"}
            <!-- Lignes d'attente à la largeur du texte. Pas de role="status" :
                 une seule région d'annonce dans le chat (PASSATION § 8.12). -->
            <div class="space-y-2.5" aria-hidden="true">
              <div class="mv-squelette h-4 w-full rounded"></div>
              <div class="mv-squelette h-4 w-11/12 rounded"></div>
              <div class="mv-squelette h-4 w-4/5 rounded"></div>
            </div>
            <p class="sr-only">{t("chat.preview.loading")}</p>
          {:else if etat === "indisponible"}
            <p
              class="text-sm text-zinc-700 dark:text-zinc-300"
              data-testid={ouverte ? "chat-preview-unavailable" : undefined}
            >
              {t("chat.preview.unavailable")}
            </p>
          {:else if etat === "pret" && apercu}
            {#if section}
              <p class="coupe-mots mb-2 text-xs text-zinc-500 dark:text-zinc-400 court:mb-1">{section}</p>
            {/if}
            {#if apercu.englobant}
              <!-- Contrat §4 : un morceau qui porte l'article AVEC d'autres doit
                   être dit comme tel. Recadré sur l'en-tête de l'article, le
                   texte ci-dessous n'est plus que lui : la phrase le dit autrement. -->
              <p
                class="mb-3 flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300 court:mb-2"
                data-testid={ouverte ? "chat-preview-englobant" : undefined}
              >
                <Icone nom="triangle-alert" class="mt-0.5 shrink-0 text-base text-zinc-950 dark:text-white" /><span
                  >{decoupe?.recadre ? t("chat.preview.englobantExtrait") : t("chat.preview.englobant")}</span
                >
              </p>
            {/if}
            {#if malLu}
              <!-- Avant le texte, pour qu'on sache, en lisant « e e o n u », que
                   ces lettres ne sont pas la loi. Une icône et une phrase,
                   jamais de rouge : ce n'est pas une erreur du site. -->
              <p
                class="mb-3 flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300 court:mb-2"
                data-testid={ouverte ? "chat-preview-ocr" : undefined}
              >
                <Icone nom="scroll-text" class="mt-0.5 shrink-0 text-base text-zinc-950 dark:text-white" /><span
                  >{t("chat.preview.ocr")}</span
                >
              </p>
            {/if}
            <!-- Le texte officiel en Literata texte (Q5), jamais ce que l'IA
                 rédige. Mesure de 34em (environ 70 caractères) : la feuille
                 d'une tablette en portrait laissait courir 85 à 90 caractères
                 par ligne.

                 UN <mark> POUR LE PASSAGE SOULIGNÉ, ET LUI SEUL. Les passages
                 des autres citations de l'article restent du texte ordinaire
                 (A1 § 4) : un <mark> sans apparence y serait annoncé comme un
                 surlignage que l'œil ne voit pas. Une autre puce déplace le
                 <mark>, et le geste « surligner » rejoue, car il naît. -->
            <div
              class="coupe-mots max-w-[34em] space-y-3 font-texte text-base leading-relaxed text-zinc-700 dark:text-zinc-300"
              lang={langueDuTexte ?? undefined}
              data-testid={ouverte ? "chat-preview-text" : undefined}
            >
              {#if apercu.titre}
                <p class="font-semibold text-zinc-950 dark:text-white">{apercu.titre}</p>
              {/if}
              {#each paragraphes as morceaux, i (i)}
                <p>{#each morceaux as morceau, j (j)}{#if morceau.actif}<mark
                        class="mv-surligne mv-surligner text-zinc-950 dark:text-white">{morceau.texte}</mark
                      >{:else}{morceau.texte}{/if}{/each}</p>
              {/each}
            </div>
            {#if decoupe?.suivant && !apercu.englobant}
              <!-- Là où l'aperçu s'arrête : la suite du passage enregistré est un
                   autre article (découpage de la base), que le texte intégral
                   montre à sa place. -->
              <p
                class="mt-3 flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300"
                data-testid={ouverte ? "chat-preview-cut" : undefined}
              >
                <Icone nom="scroll-text" class="mt-0.5 shrink-0 text-base text-zinc-950 dark:text-white" /><span
                  >{t("chat.preview.cutBefore").replace("{n}", decoupe.suivant)}</span
                >
              </p>
            {:else if apercu.tronque && !decoupe?.suivant && !aUnPassage}
              <p class="mt-3 text-sm text-zinc-700 dark:text-zinc-300">{t("chat.preview.truncated")}</p>
            {/if}
            {#if aUnPassage}
              <p
                class="mt-3 text-xs text-zinc-500 dark:text-zinc-400 court:mt-1"
                data-testid={ouverte ? "chat-carte-legende" : undefined}
              >
                {t("chat.carte.legende")}{#if apercu.tronque && !decoupe?.suivant}{` ${t("chat.carte.legendeExtrait")}`}{/if}
              </p>
            {/if}
          {/if}

          <!-- Nouvel onglet : de retour sur /chat, la page ne réaffiche pas la
               conversation (même règle que les liens des réponses). -->
          <div class="mt-3 flex flex-wrap gap-2 court:mt-2">
            <a
              href={adresse}
              target="_blank"
              rel="noopener"
              data-testid={ouverte ? "chat-preview-full" : undefined}
              class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-zinc-500 px-4 text-sm font-semibold text-zinc-950 transition-colors hover:border-zinc-950 dark:border-zinc-400 dark:text-white dark:hover:border-white"
            >
              {carte.numero ? t("chat.preview.readArticle") : t("chat.preview.readText")}<Icone
                nom="external-link"
                class="text-base"
              /><span class="sr-only">{t("chat.preview.newTab")}</span>
            </a>
            <button
              type="button"
              data-testid={ouverte ? "chat-carte-copier" : undefined}
              on:click={copierLaReference}
              class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
            >
              {#if copie === "faite"}
                <Icone nom="check" class="mv-dessiner text-base" />{t("loi.copie.reference_faite")}
              {:else}
                <Icone nom="copy" class="text-base" />{t("loi.copie.reference")}
              {/if}
            </button>
          </div>
          {#if copie === "echec"}
            <p class="mt-2 text-xs text-zinc-700 dark:text-zinc-300" data-testid="chat-carte-copie-echec">
              {t("loi.copie.echec")}
            </p>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</article>
