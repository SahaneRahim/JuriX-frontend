<script lang="ts">
  import { API_URL, apiFetch } from '$lib/api';
    import { createEventDispatcher, onMount } from "svelte";
    import { fade, scale } from "svelte/transition";

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
                logs = [...logs, `📤 Upload de ${fileName}...`];

                // 1. Upload File
                const formData = new FormData();
                formData.append("file", file);

                const uploadRes = await apiFetch(`/upload`, {
                    method: "POST",
                    body: formData,
                });

                if (!uploadRes.ok) throw new Error("Erreur upload");
                const uploadData = await uploadRes.json();
                const fileId = uploadData.file_id;

                uploadStatus[fileName] = "processing";
                logs = [
                    ...logs,
                    `⚙️ Traitement de ${fileName} (ID: ${fileId})...`,
                ];

                // Get title and reference from filename (without extension)
                const fileNameWithoutExt = fileName.replace(/\.[^/.]+$/, "");

                // 2. Trigger Ingestion Pipeline with metadata
                const ingestPayload: any = {
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
                        `Erreur ingestion (${ingestRes.status}): ${errorText}`,
                    );
                }

                uploadStatus[fileName] = "done";
                logs = [
                    ...logs,
                    `✅ ${fileName} envoyé au pipeline avec succès.`,
                ];
            } catch (e) {
                console.error(e);
                uploadStatus[fileName] = "error";
                logs = [...logs, `❌ Erreur sur ${fileName}: ${e}`];
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
</script>

{#if show}
    <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm"
        transition:fade
    >
        <div
            class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto"
            transition:scale
        >
            <div class="mb-4 flex items-center justify-between">
                <h2 class="text-xl font-bold text-slate-900">
                    Ajouter des Documents
                </h2>
                <button
                    on:click={close}
                    class="text-slate-400 hover:text-slate-600"
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
                            d="M6 18L18 6M6 6l12 12"
                        />
                    </svg>
                </button>
            </div>

            <!-- Document Title -->
            <div class="mb-4">
                <label
                    for="doc-title"
                    class="block text-sm font-medium text-slate-700 mb-1"
                >
                    Titre du document
                </label>
                <input
                    type="text"
                    id="doc-title"
                    bind:value={documentTitle}
                    placeholder="Ex: La Constitution du Cameroun"
                    class="w-full rounded-lg border-slate-300 bg-white py-2 px-3 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
            </div>

            <!-- Document Reference -->
            <div class="mb-4">
                <label
                    for="doc-ref"
                    class="block text-sm font-medium text-slate-700 mb-1"
                >
                    Référence <span class="text-slate-400 font-normal"
                        >(optionnel)</span
                    >
                </label>
                <input
                    type="text"
                    id="doc-ref"
                    bind:value={documentReference}
                    placeholder="Ex: LOI-2024-001 ou Décret N°2024/PM/123"
                    class="w-full rounded-lg border-slate-300 bg-white py-2 px-3 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
                <p class="text-xs text-slate-500 mt-1">
                    Numéro officiel du document juridique
                </p>
            </div>

            <!-- Category Selector -->
            <div class="mb-4">
                <label
                    for="category-select"
                    class="block text-sm font-medium text-slate-700 mb-1"
                >
                    Catégorie du document
                </label>
                <select
                    id="category-select"
                    bind:value={selectedCategoryId}
                    class="w-full rounded-lg border-slate-300 bg-white py-2 px-3 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                    <option value={null}
                        >-- Sélectionner une catégorie --</option
                    >
                    {#each categories as cat}
                        <option value={cat.id}>{cat.icon} {cat.name}</option>
                    {/each}
                </select>
                {#if loadingCategories}
                    <p class="text-xs text-slate-500 mt-1">
                        Chargement des catégories...
                    </p>
                {/if}
            </div>

            <!-- Upload Area -->
            <div class="mb-6">
                <label
                    for="file-upload"
                    class="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 py-10 text-center hover:bg-slate-100 cursor-pointer transition-colors"
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
                        Cliquez pour sélectionner des fichiers
                    </p>
                    <p class="text-xs text-slate-500 mt-1">
                        PDF ou DOCX (Max 1GB)
                    </p>
                    <input
                        id="file-upload"
                        type="file"
                        multiple
                        accept=".pdf,.docx"
                        class="hidden"
                        on:change={handleFileSelect}
                    />
                </label>
            </div>

            <!-- File List -->
            {#if files && files.length > 0}
                <div
                    class="mb-6 max-h-40 overflow-y-auto space-y-2 rounded-lg border border-slate-100 bg-slate-50 p-3"
                >
                    {#each Array.from(files) as file}
                        <div class="flex items-center justify-between text-sm">
                            <span class="truncate max-w-[200px] text-slate-700"
                                >{file.name}</span
                            >
                            {#if uploadStatus[file.name] === "uploading"}
                                <span class="text-blue-600 animate-pulse"
                                    >Upload...</span
                                >
                            {:else if uploadStatus[file.name] === "processing"}
                                <span class="text-amber-600 animate-pulse"
                                    >Traitement...</span
                                >
                            {:else if uploadStatus[file.name] === "done"}
                                <span class="text-emerald-600">Terminé</span>
                            {:else if uploadStatus[file.name] === "error"}
                                <span class="text-red-600">Erreur</span>
                            {:else}
                                <span class="text-slate-400">En attente</span>
                            {/if}
                        </div>
                    {/each}
                </div>
            {/if}

            <!-- Logs (optional) -->
            {#if logs.length > 0}
                <div
                    class="mb-6 max-h-24 overflow-y-auto rounded bg-slate-900 p-2 text-xs font-mono text-emerald-400"
                >
                    {#each logs as log}
                        <div>{log}</div>
                    {/each}
                </div>
            {/if}

            <div class="flex justify-end gap-3">
                <button
                    on:click={close}
                    class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
                    >Annuler</button
                >
                <button
                    on:click={handleUpload}
                    disabled={uploading || !files}
                    class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {uploading
                        ? "Traitement en cours..."
                        : "Lancer le traitement"}
                </button>
            </div>
        </div>
    </div>
{/if}
