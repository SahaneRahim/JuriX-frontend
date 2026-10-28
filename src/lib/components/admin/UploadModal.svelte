<script lang="ts">
  import { piegerFocus } from '$lib/actions/pieger-focus';
  import { apiFetch } from '$lib/api';
    import { createEventDispatcher, onMount } from "svelte";
    import { fade, scale } from "svelte/transition";
  import Icone from '$lib/components/Icone.svelte';
  import type { NomIcone } from '$lib/icones';
  import { tr, language } from '$lib/stores/language';
  import { nomCategorie } from '$lib/categories';
  import type { IngestPayload } from '$lib/types';

    export let show = false;

    const dispatch = createEventDispatcher();

    // Une seule recette pour les champs et leurs libellés, celle de tout le
    // site (noir et blanc, mode sombre compris) et de UserFormModal : recopiée
    // champ par champ, elle finissait par diverger. Une seule taille aussi,
    // dans les quatre fenêtres de l'administration et les pages de compte :
    // 44 px de haut au moins (38 px ici auparavant), `py-2`, libellé 4 px
    // au-dessus. 16 px de texte sauf à partir de sm sous un pointeur fin
    // (règle de login/+page.svelte) : en dessous, iOS zoome au focus,
    // téléphone en paysage compris. Le retrait horizontal reste à chaque
    // champ : une liste garde la place de son chevron à droite.
    const CHAMP =
        "min-h-11 w-full rounded-xl border border-zinc-200 bg-white py-2 text-base text-zinc-950 placeholder-zinc-400 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 dark:border-zinc-500 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-200 dark:focus:ring-zinc-200 sm:[@media(pointer:fine)]:text-sm";
    const LIBELLE = "mb-1 block text-sm font-medium text-zinc-800 dark:text-zinc-200";

let files: FileList | null = null;
    let uploading = false;
    let uploadStatus: {
        [key: string]:
            | "pending"
            | "uploading"
            | "processing"
            | "done"
            | "error";
    } = {};

    /**
     * Journal du traitement : une ligne par étape et par fichier. Son type
     * choisit l'icône posée devant le texte, celle du site (Lucide), à la
     * place des émojis qui ouvraient les libellés (admin.upload.log*) et dont
     * le dessin et la couleur changeaient d'un système à l'autre ; l'échec se
     * lit aussi à sa couleur, le rouge des erreurs.
     */
    type TypeJournal = "envoi" | "traitement" | "fait" | "erreur";
    const ICONE_JOURNAL: Record<TypeJournal, NomIcone> = {
        envoi: "upload",
        traitement: "loader-circle",
        fait: "circle-check",
        erreur: "circle-x",
    };
    let logs: Array<{ type: TypeJournal; texte: string }> = [];

    // Document metadata
    let documentTitle = "";
    let documentReference = "";

    // Categories
    let categories: Array<{ id: number; name: string; icon: string }> = [];
    let selectedCategoryId: number | null = null;
    let loadingCategories = false;

    onMount(async () => {
        await fetchCategories();
    });

    async function fetchCategories() {
        loadingCategories = true;
        try {
            const response = await apiFetch(`/categories?limit=20`,
            );
            if (response.ok) {
                categories = await response.json();
            }
        } catch (e) {
            console.error("Error fetching categories:", e);
        } finally {
            loadingCategories = false;
        }
    }

    function handleFileSelect(event: Event) {
        const target = event.target as HTMLInputElement;
        if (target.files) {
            files = target.files;
            // Initialize status and auto-fill title from first file
            for (let i = 0; i < files.length; i++) {
                uploadStatus[files[i].name] = "pending";
            }
            // Auto-fill title from first file name
            if (files.length === 1 && !documentTitle) {
                documentTitle = files[0].name.replace(/\.[^/.]+$/, "");
            }
        }
    }

    async function handleUpload() {
        if (!files || files.length === 0) return;
        uploading = true;
        logs = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileName = file.name;

            try {
                uploadStatus[fileName] = "uploading";
                logs = [...logs, { type: "envoi", texte: $tr("admin.upload.logUploading").replace("{name}", fileName) }];

                // 1. Upload File
                const formData = new FormData();
                formData.append("file", file);

                const uploadRes = await apiFetch(`/upload`, {
                    method: "POST",
                    body: formData,
                });

                if (!uploadRes.ok) throw new Error($tr("admin.upload.errUpload"));
                const uploadData = await uploadRes.json();
                const fileId = uploadData.file_id;

                uploadStatus[fileName] = "processing";
                logs = [
                    ...logs,
                    {
                        type: "traitement",
                        texte: $tr("admin.upload.logProcessing").replace("{name}", fileName).replace("{id}", String(fileId)),
                    },
                ];

                // Get title and reference from filename (without extension)
                const fileNameWithoutExt = fileName.replace(/\.[^/.]+$/, "");

                // 2. Trigger Ingestion Pipeline with metadata
                const ingestPayload: IngestPayload = {
                    file_id: fileId,
                    original_filename: fileName,
                    // Use custom title if single file and user entered one, else use filename
                    title:
                        files.length === 1 && documentTitle.trim()
                            ? documentTitle.trim()
                            : fileNameWithoutExt,
                    // Use custom reference if single file and user entered one, else use filename as reference
                    reference:
                        files.length === 1 && documentReference.trim()
                            ? documentReference.trim()
                            : fileNameWithoutExt,
                };

                // Add category_id if selected
                if (selectedCategoryId) {
                    ingestPayload.category_id = selectedCategoryId;
                }

                const ingestRes = await apiFetch(`/laws/admin/ingest`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(ingestPayload),
                    },
                );

                if (!ingestRes.ok) {
                    const errorText = await ingestRes.text();
                    throw new Error(
                        $tr("admin.upload.errIngest").replace("{status}", String(ingestRes.status)).replace("{text}", errorText),
                    );
                }

                uploadStatus[fileName] = "done";
                logs = [
                    ...logs,
                    { type: "fait", texte: $tr("admin.upload.logDone").replace("{name}", fileName) },
                ];
            } catch (e) {
                console.error(e);
                uploadStatus[fileName] = "error";
                logs = [
                    ...logs,
                    { type: "erreur", texte: $tr("admin.upload.logError").replace("{name}", fileName).replace("{err}", String(e)) },
                ];
            }
        }

        uploading = false;
        setTimeout(() => {
            dispatch("refresh"); // Tell parent to refresh list
        }, 1000);
    }

    function close() {
        show = false;
        files = null;
        uploadStatus = {};
        logs = [];
        selectedCategoryId = null;
        documentTitle = "";
        documentReference = "";
        dispatch("close");
    }

  // Échap ferme la modale. Aucune des quatre modales du projet ne le gérait :
  // au clavier, la seule sortie était d'atteindre la croix à la tabulation.
  function onKeydown(event: KeyboardEvent) {
    if (show && event.key === 'Escape') close();
  }

  function onBackdropClick(event: MouseEvent) {
    // Le fond n'avait aucun gestionnaire : cliquer à côté ne fermait rien.
    if (event.target === event.currentTarget) close();
  }

  // Ouverte, la modale fige la page derrière elle, comme le choix du profil
  // (src/routes/+layout.svelte) : sur téléphone, un glisser sur le fond ou sur
  // l'en-tête du panneau faisait défiler la liste des documents dessous.
  function bloquerDefilement(_noeud: HTMLElement) {
    const avant = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return {
      destroy() {
        document.body.style.overflow = avant;
      },
    };
  }
</script>

<svelte:window on:keydown={onKeydown} />

{#if show}
    <!--
      Panneau collé en bas sur téléphone, boîte centrée à partir de sm.

      Le voile n'avait aucune marge : sur téléphone, la boîte touchait les bords
      et perdait ses coins arrondis ; et `max-h-[90vh]` comptait la barre
      d'adresse comme repliée, si bien que le bas passait dessous. Désormais
      seul le corps défile, en-tête et boutons restent visibles. La hauteur
      maximale se rapporte au voile, fixe en inset-0, qui suit déjà l'écran
      réellement visible sans dépendre de l'unité dvh.

      Construite comme les trois autres fenêtres de l'administration : un
      trait sous l'en-tête et un au-dessus du pied, les mêmes marges (16 puis
      24 px), les champs espacés de 16 px. Elle n'avait aucun trait. Largeur
      des formulaires courts, 512 px, comme la fenêtre des comptes.
    -->
    <div
        class="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 backdrop-blur-sm sm:items-center sm:p-4"
        role="presentation"
        data-testid="upload-modal"
        on:click={onBackdropClick}
        use:bloquerDefilement
        transition:fade
    >
        <div
            use:piegerFocus
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-modal-title"
            class="flex max-h-[calc(100%-1rem)] w-full max-w-lg flex-col rounded-t-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none sm:max-h-[90%] sm:rounded-2xl"
            transition:scale
        >
            <div class="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800 sm:px-6 sm:py-4">
                <!-- Titre des fenêtres de l'administration : 20 puis 24 px,
                     comme « Modifier le document » et « Modifier l'article ». -->
                <h2 id="upload-modal-title" class="min-w-0 text-xl font-bold tracking-tight text-zinc-950 dark:text-white sm:text-2xl">
                    {$tr("admin.upload.title")}
                </h2>
                <!-- 44 px : l'icône seule faisait une cible de 24 px. -->
                <button
                    on:click={close}
                    aria-label={$tr("common.close")}
                    class="-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                >
                    <Icone nom="x" class="h-6 w-6" />
                </button>
            </div>

            <!-- overscroll-contain : arrivé au bout, le défilement ne passe pas
                 à la page derrière. -->
            <div class="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-6">
                <!-- Document Title -->
                <div>
                    <label
                        for="doc-title"
                        class={LIBELLE}
                    >
                        {$tr("admin.doc.title")}
                    </label>
                    <input
                        type="text"
                        id="doc-title"
                        bind:value={documentTitle}
                        placeholder={$tr("admin.upload.titlePlaceholder")}
                        class="{CHAMP} px-3"
                    />
                </div>

                <!-- Document Reference. « (optionnel) » gris et sans gras après
                     le libellé, comme dans le générateur d'articles. -->
                <div>
                    <label
                        for="doc-ref"
                        class={LIBELLE}
                    >
                        {$tr("admin.reference")} <span class="font-normal text-zinc-500 dark:text-zinc-400"
                            >{$tr("admin.optional")}</span
                        >
                    </label>
                    <input
                        type="text"
                        id="doc-ref"
                        bind:value={documentReference}
                        placeholder={$tr("admin.upload.refPlaceholder")}
                        class="{CHAMP} px-3"
                    />
                    <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {$tr("admin.upload.refHint")}
                    </p>
                </div>

                <!-- Category Selector -->
                <div>
                    <label
                        for="category-select"
                        class={LIBELLE}
                    >
                        {$tr("admin.upload.category")}
                    </label>
                    <!-- Les options portent le nom seul : l'icône de la base est
                         un émoji, et une <option> ne peut contenir que du
                         texte, donc pas l'icône Lucide du domaine.
                         Première option : « Aucune catégorie », la valeur
                         réelle que garde le texte si l'on n'en choisit pas,
                         comme dans « Modifier le document ». L'invite
                         « -- Sélectionner une catégorie -- », en noir, se
                         lisait comme une catégorie choisie. -->
                    <select
                        id="category-select"
                        bind:value={selectedCategoryId}
                        class="{CHAMP} pl-3 pr-10"
                    >
                        <option value={null}
                            >{$tr("admin.doc.noCategory")}</option
                        >
                        {#each categories as cat (cat.id)}
                            <option value={cat.id}>{nomCategorie(cat.name, $language.current)}</option>
                        {/each}
                    </select>
                    {#if loadingCategories}
                        <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            {$tr("admin.upload.loadingCategories")}
                        </p>
                    {/if}
                </div>

                <!-- Upload Area : le champ est sr-only et non plus `hidden`, qui le
                     rendait inatteignable au clavier ; la zone s'entoure quand il
                     a le focus. La même zone que l'import en lot : tuile d'icône
                     du guide (rounded-xl, et non ronde), l'icône `file-up`, le
                     survol par la bordure. La consigne suit le POINTEUR : « Touchez »
                     au doigt, « Cliquez » à la souris. Sur écran court
                     (`court:`), zone et tuile resserrées, comme sur la page
                     d'import en lot. -->
                <div>
                    <label
                        for="file-upload"
                        class="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-6 py-8 sm:py-10 court:py-4 text-center hover:border-zinc-950 cursor-pointer transition-colors focus-within:border-zinc-950 focus-within:ring-2 focus-within:ring-zinc-950/20 dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:border-zinc-400 dark:focus-within:border-zinc-200 dark:focus-within:ring-zinc-200/20"
                    >
                        <span
                            class="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 court:mb-2 court:h-9 court:w-9"
                        >
                            <Icone nom="file-up" class="text-2xl court:text-xl" />
                        </span>
                        <p class="text-sm font-medium text-zinc-950 dark:text-zinc-100">
                            <span class="[@media(pointer:fine)]:hidden">{$tr("admin.upload.tapToSelect")}</span>
                            <span class="hidden [@media(pointer:fine)]:inline">{$tr("admin.upload.clickToSelect")}</span>
                        </p>
                        <!-- zinc-600 et non 500 : au survol, la zone passe en
                             zinc-100, où zinc-500 ne fait plus que 4,4:1. -->
                        <p class="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                            {$tr("admin.upload.formats")}
                        </p>
                        <input
                            id="file-upload"
                            type="file"
                            multiple
                            accept=".pdf,.docx"
                            class="sr-only"
                            on:change={handleFileSelect}
                        />
                    </label>
                </div>

                <!-- File List : le nom prend la place libre (min-w-0) au lieu d'un
                     plafond de 200 px, et reste lisible en entier au survol. -->
                {#if files && files.length > 0}
                    <div
                        class="max-h-40 overflow-y-auto space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700/60 dark:bg-zinc-800/50"
                    >
                        {#each Array.from(files) as file (file.name)}
                            <div class="flex items-center justify-between gap-3 text-sm">
                                <span class="min-w-0 truncate text-zinc-700 dark:text-zinc-300" title={file.name}
                                    >{file.name}</span
                                >
                                <!-- En noir et blanc, comme les badges de statut : le
                                     libellé et l'icône disent l'état que donnaient le
                                     bleu, l'ambre et le vert ; seul l'échec reste rouge.
                                     Seule l'icône s'anime, et non la ligne : pulsée
                                     jusqu'à 50 % d'opacité, comme le badge
                                     « processing » (StatusBadge), la ligne tombait à
                                     moins de 3:1 au creux de chaque pulsation sur
                                     le bloc zinc-50. Le cercle de chargement tourne
                                     (guide § 4.12), la flèche d'envoi pulse. -->
                                {#if uploadStatus[file.name] === "uploading"}
                                    <span class="inline-flex shrink-0 items-center gap-1 text-zinc-700 dark:text-zinc-300"
                                        ><Icone nom="upload" class="motion-safe:animate-pulse" />{$tr("admin.upload.statusUploading")}</span
                                    >
                                {:else if uploadStatus[file.name] === "processing"}
                                    <span class="inline-flex shrink-0 items-center gap-1 text-zinc-700 dark:text-zinc-300"
                                        ><Icone nom="loader-circle" class="motion-safe:animate-spin" />{$tr("admin.upload.statusProcessing")}</span
                                    >
                                {:else if uploadStatus[file.name] === "done"}
                                    <span class="inline-flex shrink-0 items-center gap-1 text-zinc-950 dark:text-white"
                                        ><Icone nom="circle-check" />{$tr("admin.upload.statusDone")}</span
                                    >
                                {:else if uploadStatus[file.name] === "error"}
                                    <span class="inline-flex shrink-0 items-center gap-1 text-red-600 dark:text-red-400"
                                        ><Icone nom="circle-x" />{$tr("admin.upload.statusError")}</span
                                    >
                                {:else}
                                    <span class="inline-flex shrink-0 items-center gap-1 text-zinc-500 dark:text-zinc-400"
                                        ><Icone nom="clock" />{$tr("admin.upload.statusPending")}</span
                                    >
                                {/if}
                            </div>
                        {/each}
                    </div>
                {/if}

                <!-- Logs (optional) : les noms de fichiers et messages d'erreur
                     sans espace se coupent au lieu d'élargir le panneau. -->
                {#if logs.length > 0}
                    <div
                        class="coupe-mots max-h-24 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs font-mono text-zinc-700 dark:border-zinc-700/60 dark:bg-zinc-800/50 dark:text-zinc-300"
                    >
                        {#each logs as log, i (i)}
                            <div class="flex items-start gap-1.5 {log.type === 'erreur' ? 'text-red-600 dark:text-red-400' : ''}">
                                <Icone nom={ICONE_JOURNAL[log.type]} class="mt-0.5" />
                                <span class="min-w-0">{log.texte}</span>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>

            <!-- Pied toujours visible, au-dessus de la barre d'accueil de
                 l'iPhone (zone sûre) ; sur téléphone, deux boutons de 44 px à
                 parts égales. Séparé du corps par un trait, aux marges des
                 trois autres fenêtres. -->
            <div class="shrink-0 border-t border-zinc-200 pb-zone-sure dark:border-zinc-800">
                <div class="flex justify-end gap-3 px-4 py-3 sm:px-6 sm:py-4">
                    <button
                        on:click={close}
                        class="inline-flex h-11 flex-1 items-center justify-center rounded-xl px-5 text-sm font-semibold text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white sm:flex-none"
                        >{$tr("common.cancel")}</button
                    >
                    <button
                        on:click={handleUpload}
                        disabled={uploading || !files}
                        class="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-zinc-950 px-5 text-sm font-semibold text-white transition-colors hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 sm:flex-none"
                    >
                        {uploading
                            ? $tr("admin.upload.processing")
                            : $tr("admin.upload.start")}
                    </button>
                </div>
            </div>
        </div>
    </div>
{/if}
