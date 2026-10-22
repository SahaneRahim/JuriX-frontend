<script lang="ts">
  import { piegerFocus } from '$lib/actions/pieger-focus';
  import { apiFetch } from '$lib/api';
    import { createEventDispatcher, onMount } from "svelte";
    import { fade, scale } from "svelte/transition";
  import { tr, language } from '$lib/stores/language';
  import { nomCategorie } from '$lib/categories';
  import type { IngestPayload } from '$lib/types';

    export let show = false;

    const dispatch = createEventDispatcher();
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
    let logs: string[] = [];

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
                logs = [...logs, $tr("admin.upload.logUploading").replace("{name}", fileName)];

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
                    $tr("admin.upload.logProcessing").replace("{name}", fileName).replace("{id}", String(fileId)),
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
                    $tr("admin.upload.logDone").replace("{name}", fileName),
                ];
            } catch (e) {
                console.error(e);
                uploadStatus[fileName] = "error";
                logs = [...logs, $tr("admin.upload.logError").replace("{name}", fileName).replace("{err}", String(e))];
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
    -->
    <div
        class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4"
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
            class="flex max-h-[calc(100%-1rem)] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl sm:max-h-[90%] sm:rounded-2xl"
            transition:scale
        >
            <div class="flex shrink-0 items-center justify-between gap-3 px-4 pb-2 pt-3 sm:px-6 sm:pb-4 sm:pt-6">
                <h2 id="upload-modal-title" class="min-w-0 text-xl font-bold text-slate-900">
                    {$tr("admin.upload.title")}
                </h2>
                <!-- 44 px : l'icône seule faisait une cible de 24 px. -->
                <button
                    on:click={close}
                    aria-label={$tr("common.close")}
                    class="-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-600"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="2"
                        stroke="currentColor"
                        class="h-6 w-6"
                        aria-hidden="true"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                        />
                    </svg>
                </button>
            </div>

            <!-- overscroll-contain : arrivé au bout, le défilement ne passe pas
                 à la page derrière. -->
            <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6">
                <!-- Document Title -->
                <div class="mb-4">
                    <label
                        for="doc-title"
                        class="block text-sm font-medium text-slate-700 mb-1"
                    >
                        {$tr("admin.doc.title")}
                    </label>
                    <input
                        type="text"
                        id="doc-title"
                        bind:value={documentTitle}
                        placeholder={$tr("admin.upload.titlePlaceholder")}
                        class="w-full rounded-lg border-slate-300 bg-white py-2 px-3 text-base shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                </div>

                <!-- Document Reference -->
                <div class="mb-4">
                    <label
                        for="doc-ref"
                        class="block text-sm font-medium text-slate-700 mb-1"
                    >
                        {$tr("admin.reference")} <span class="text-slate-500 font-normal"
                            >{$tr("admin.upload.optional")}</span
                        >
                    </label>
                    <input
                        type="text"
                        id="doc-ref"
                        bind:value={documentReference}
                        placeholder={$tr("admin.upload.refPlaceholder")}
                        class="w-full rounded-lg border-slate-300 bg-white py-2 px-3 text-base shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                    <p class="text-xs text-slate-500 mt-1">
                        {$tr("admin.upload.refHint")}
                    </p>
                </div>

                <!-- Category Selector -->
                <div class="mb-4">
                    <label
                        for="category-select"
                        class="block text-sm font-medium text-slate-700 mb-1"
                    >
                        {$tr("admin.upload.category")}
                    </label>
                    <select
                        id="category-select"
                        bind:value={selectedCategoryId}
                        class="w-full rounded-lg border-slate-300 bg-white py-2 px-3 text-base shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    >
                        <option value={null}
                            >{$tr("admin.upload.selectCategory")}</option
                        >
                        {#each categories as cat (cat.id)}
                            <option value={cat.id}>{cat.icon} {nomCategorie(cat.name, $language.current)}</option>
                        {/each}
                    </select>
                    {#if loadingCategories}
                        <p class="text-xs text-slate-500 mt-1">
                            {$tr("admin.upload.loadingCategories")}
                        </p>
                    {/if}
                </div>

                <!-- Upload Area : le champ est sr-only et non plus `hidden`, qui le
                     rendait inatteignable au clavier ; la zone s'entoure quand il
                     a le focus. -->
                <div class="mb-6">
                    <label
                        for="file-upload"
                        class="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 py-8 sm:py-10 text-center hover:bg-slate-100 cursor-pointer transition-colors focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/30"
                    >
                        <div
                            class="rounded-full bg-blue-100 p-3 text-blue-600 mb-3"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke-width="2"
                                stroke="currentColor"
                                class="h-6 w-6"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                                />
                            </svg>
                        </div>
                        <p class="text-sm font-medium text-slate-900">
                            {$tr("admin.upload.clickToSelect")}
                        </p>
                        <p class="text-xs text-slate-500 mt-1">
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
                        class="mb-6 max-h-40 overflow-y-auto space-y-2 rounded-lg border border-slate-100 bg-slate-50 p-3"
                    >
                        {#each Array.from(files) as file (file.name)}
                            <div class="flex items-center justify-between gap-3 text-sm">
                                <span class="min-w-0 truncate text-slate-700" title={file.name}
                                    >{file.name}</span
                                >
                                {#if uploadStatus[file.name] === "uploading"}
                                    <span class="shrink-0 text-blue-600 motion-safe:animate-pulse"
                                        >{$tr("admin.upload.statusUploading")}</span
                                    >
                                {:else if uploadStatus[file.name] === "processing"}
                                    <span class="shrink-0 text-amber-600 motion-safe:animate-pulse"
                                        >{$tr("admin.upload.statusProcessing")}</span
                                    >
                                {:else if uploadStatus[file.name] === "done"}
                                    <span class="shrink-0 text-emerald-600">{$tr("admin.upload.statusDone")}</span>
                                {:else if uploadStatus[file.name] === "error"}
                                    <span class="shrink-0 text-red-600">{$tr("admin.upload.statusError")}</span>
                                {:else}
                                    <span class="shrink-0 text-slate-500">{$tr("admin.upload.statusPending")}</span>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {/if}

                <!-- Logs (optional) : les noms de fichiers et messages d'erreur
                     sans espace se coupent au lieu d'élargir le panneau. -->
                {#if logs.length > 0}
                    <div
                        class="coupe-mots mb-6 max-h-24 overflow-y-auto rounded bg-slate-900 p-2 text-xs font-mono text-emerald-400"
                    >
                        {#each logs as log, i (i)}
                            <div>{log}</div>
                        {/each}
                    </div>
                {/if}
            </div>

            <!-- Pied toujours visible, au-dessus de la barre d'accueil de
                 l'iPhone (zone sûre) ; sur téléphone, deux boutons de 44 px à
                 parts égales. -->
            <div class="shrink-0 pb-zone-sure">
                <div class="flex justify-end gap-3 px-4 py-3 sm:px-6 sm:pb-6 sm:pt-2">
                    <button
                        on:click={close}
                        class="inline-flex h-11 flex-1 items-center justify-center rounded-lg px-4 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 sm:flex-none"
                        >{$tr("common.cancel")}</button
                    >
                    <button
                        on:click={handleUpload}
                        disabled={uploading || !files}
                        class="inline-flex h-11 flex-1 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors sm:flex-none"
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
