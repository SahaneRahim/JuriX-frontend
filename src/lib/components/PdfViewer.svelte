<script>
    import { onMount, onDestroy } from "svelte";
    import * as pdfjsLib from "pdfjs-dist";
    // Import worker directly to handle Vite optimizeDeps
    import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

    // Now expects a URL to the pdf-data endpoint (JSON with Base64)
    export let url;

    let canvas;
    let pdfDoc = null;
    let pageNum = 1;
    let pageRendering = false;
    let pageNumPending = null;
    let totalPages = 0;
    let scale = 1.5;
    let error = null;
    let loading = true;

    // Convert URL from /download to /pdf-data
    function getPdfDataUrl(downloadUrl) {
        // Replace /download with /pdf-data
        return downloadUrl.replace("/download", "/pdf-data");
    }

    // Keyboard navigation handler
    function handleKeydown(event) {
        // Only handle if PDF is loaded and no input is focused
        if (
            !pdfDoc ||
            document.activeElement.tagName === "INPUT" ||
            document.activeElement.tagName === "TEXTAREA"
        ) {
            return;
        }

        if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
            event.preventDefault();
            onPrevPage();
        } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
            event.preventDefault();
            onNextPage();
        }
    }

    onMount(async () => {
        // Add keyboard listener
        window.addEventListener("keydown", handleKeydown);

        try {
            // Set worker source
            pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

            // Use /pdf-data endpoint which returns JSON with base64
            // JSON responses are NEVER intercepted by IDM
            const pdfDataUrl = url.replace("/download", "/pdf-data");
            console.log("Fetching PDF data from:", pdfDataUrl);

            const response = await fetch(pdfDataUrl);

            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status}: ${response.statusText}`,
                );
            }

            const jsonData = await response.json();
            console.log(
                `Received base64 data: ${(jsonData.data.length / 1024 / 1024).toFixed(2)} MB`,
            );

            // Efficient base64 decoding using Blob API (handles large files better)
            // This method is much faster and more memory-efficient than atob() loop
            const dataUrl = `data:application/pdf;base64,${jsonData.data}`;
            const blobResponse = await fetch(dataUrl);
            const blob = await blobResponse.blob();
            const arrayBuffer = await blob.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);

            console.log(
                `PDF decoded: ${(bytes.length / 1024 / 1024).toFixed(2)} MB`,
            );

            // Load PDF from bytes with configuration for large files and image handling
            const loadingTask = pdfjsLib.getDocument({
                data: bytes,
                // Disable verbose warnings about missing images
                verbosity: 0,
                // Enable image handling options
                isEvalSupported: true,
                // Use standard fonts
                useSystemFonts: true,
            });
            pdfDoc = await loadingTask.promise;
            totalPages = pdfDoc.numPages;
            console.log(`PDF has ${totalPages} pages`);
            loading = false;
            renderPage(pageNum);
        } catch (err) {
            console.error("Error loading PDF:", err);
            error =
                "Impossible de charger le document. " +
                (err.message || "Erreur inconnue");
            loading = false;
        }
    });

    onDestroy(() => {
        // Clean up keyboard listener
        if (typeof window !== "undefined") {
            window.removeEventListener("keydown", handleKeydown);
        }
    });

    function renderPage(num) {
        if (!pdfDoc || !canvas) return;

        pageRendering = true;

        // Clear canvas before rendering new page
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Fetch page
        pdfDoc
            .getPage(num)
            .then(function (page) {
                const viewport = page.getViewport({ scale: scale });
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                const renderContext = {
                    canvasContext: canvas.getContext("2d"),
                    viewport: viewport,
                    // Continue rendering even if some images fail to decode
                    continueCallback: function (cont) {
                        cont();
                    },
                };

                const renderTask = page.render(renderContext);

                // Wait for render to finish - ignore warnings about images
                renderTask.promise
                    .then(function () {
                        pageRendering = false;
                        if (pageNumPending !== null) {
                            renderPage(pageNumPending);
                            pageNumPending = null;
                        }
                    })
                    .catch(function (err) {
                        // Many errors are just warnings about images, still continue
                        console.warn("Render warning:", err?.message || err);
                        pageRendering = false;
                        // Still process pending pages even on error
                        if (pageNumPending !== null) {
                            renderPage(pageNumPending);
                            pageNumPending = null;
                        }
                    });
            })
            .catch(function (err) {
                console.error("Error getting page:", err);
                pageRendering = false;
            });

        // Update page counters
        pageNum = num;
    }

    function queueRenderPage(num) {
        if (pageRendering) {
            pageNumPending = num;
        } else {
            renderPage(num);
        }
    }

    function onPrevPage() {
        if (pageNum <= 1) {
            return;
        }
        pageNum--;
        queueRenderPage(pageNum);
    }

    function onNextPage() {
        if (pageNum >= totalPages) {
            return;
        }
        pageNum++;
        queueRenderPage(pageNum);
    }
</script>

<div
    class="flex flex-col items-center bg-slate-50 p-4 rounded-lg shadow-inner min-h-[600px] justify-center"
>
    {#if error}
        <div class="text-center">
            <div class="text-red-500 font-medium mb-4">{error}</div>
            <p class="text-sm text-slate-500">
                Essayez de désactiver votre gestionnaire de téléchargement (IDM)
                ou utilisez un autre navigateur.
            </p>
        </div>
    {:else if loading}
        <div class="flex flex-col items-center gap-4">
            <div
                class="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800"
            ></div>
            <p class="text-sm text-slate-500">Chargement du document...</p>
        </div>
    {:else}
        <!-- Controls -->
        <div
            class="mb-4 flex items-center gap-4 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-200 sticky top-4 z-10 transition-opacity hover:opacity-100 opacity-90"
        >
            <button
                on:click={onPrevPage}
                disabled={pageNum <= 1}
                class="p-2 rounded-full hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-slate-700"
                title="Page précédente"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="2"
                    stroke="currentColor"
                    class="w-5 h-5"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M15.75 19.5L8.25 12l7.5-7.5"
                    />
                </svg>
            </button>
            <span
                class="font-sans text-sm font-medium text-slate-600 w-24 text-center"
            >
                Page {pageNum} / {totalPages || "--"}
            </span>
            <button
                on:click={onNextPage}
                disabled={pageNum >= totalPages}
                class="p-2 rounded-full hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-slate-700"
                title="Page suivante"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="2"
                    stroke="currentColor"
                    class="w-5 h-5"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M8.25 4.5l7.5 7.5-7.5 7.5"
                    />
                </svg>
            </button>
        </div>

        <!-- Canvas -->
        <div
            class="relative shadow-xl border border-slate-200 bg-white min-h-[500px] min-w-[300px]"
        >
            <canvas bind:this={canvas} class="max-w-full h-auto"></canvas>
        </div>
    {/if}
</div>
