<script lang="ts">
  import { API_URL, WS_URL } from '$lib/api';
	import { onMount, onDestroy } from "svelte";
	import { goto } from "$app/navigation";
	import { language, tr } from "$lib/stores/language";

	// Types
	interface UploadedFile {
		file: File;
		id: string;
		law_id?: number;
		status: "pending" | "uploading" | "processing" | "published" | "refused";
		progress: number;
		error?: string;
	}

	interface LawStatus {
		id: number;
		title: string;
		reference: string;
		status: string;
		processing_progress: number | null;
		processing_error: string | null;
		created_at: string;
		processing_started_at: string | null;
	}

	// State
	let files: UploadedFile[] = [];
	let isDragging = false;
	let sessionId = "";
	let ws: WebSocket | null = null;
	let laws: LawStatus[] = [];
	let statusFilter: string = "all";
	let isUploading = false;

	// WebSocket connection
	function connectWebSocket() {
		sessionId = crypto.randomUUID();
		const wsUrl = `${WS_URL}/batch-upload/ws/${sessionId}`;
		ws = new WebSocket(wsUrl);

		ws.onopen = () => {
			console.log("WebSocket connected");
		};

		ws.onmessage = (event) => {
			const data = JSON.parse(event.data);
			handleWebSocketMessage(data);
		};

		ws.onerror = (error) => {
			console.error("WebSocket error:", error);
		};

		ws.onclose = () => {
			console.log("WebSocket disconnected");
		};
	}

	function handleWebSocketMessage(data: any) {
		switch (data.type) {
			case "upload_progress":
				// Update overall upload progress
				break;

			case "file_created":
				// Update file with law_id
				const fileIndex = files.findIndex((f) => f.file.name === data.filename);
				if (fileIndex !== -1) {
					files[fileIndex].law_id = data.law_id;
					files[fileIndex].status = "pending";
				}
				break;

			case "processing_start":
				// Update file status to processing
				const processingFile = files.find((f) => f.law_id === data.law_id);
				if (processingFile) {
					processingFile.status = "processing";
					processingFile.progress = 0;
				}
				break;

			case "processing_complete":
				// Update file status to published
				const completedFile = files.find((f) => f.law_id === data.law_id);
				if (completedFile) {
					completedFile.status = data.status;
					completedFile.progress = 100;
				}
				fetchLaws(); // Refresh list
				break;

			case "processing_error":
				// Update file status to refused
				const errorFile = files.find((f) => f.law_id === data.law_id);
				if (errorFile) {
					errorFile.status = "refused";
					errorFile.error = data.error;
				}
				break;
		}

		files = [...files]; // Trigger reactivity
	}

	// File handling
	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragging = false;

		const droppedFiles = Array.from(event.dataTransfer?.files || []);
		addFiles(droppedFiles);
	}

	function handleFileInput(event: Event) {
		const input = event.target as HTMLInputElement;
		const selectedFiles = Array.from(input.files || []);
		addFiles(selectedFiles);
	}

	function addFiles(newFiles: File[]) {
		const pdfFiles = newFiles.filter((f) => f.name.endsWith(".pdf"));

		const uploadedFiles: UploadedFile[] = pdfFiles.map((file) => ({
			file,
			id: crypto.randomUUID(),
			status: "pending",
			progress: 0,
		}));

		files = [...files, ...uploadedFiles];
	}

	function removeFile(id: string) {
		files = files.filter((f) => f.id !== id);
	}

	// Upload
	async function uploadFiles() {
		if (files.length === 0) return;

		isUploading = true;

		const formData = new FormData();
		files.forEach((f) => {
			formData.append("files", f.file);
			f.status = "uploading";
		});

		files = [...files]; // Trigger reactivity

		try {
			const response = await fetch(
				`${API_URL}/batch-upload/upload?session_id=${sessionId}`,
				{
					method: "POST",
					body: formData,
				},
			);

			if (!response.ok) {
				throw new Error("Upload failed");
			}

			const result = await response.json();
			console.log("Upload result:", result);
		} catch (error) {
			console.error("Upload error:", error);
			alert("Upload failed: " + error);
		} finally {
			isUploading = false;
		}
	}

	// Fetch laws
	async function fetchLaws() {
		try {
			const url =
				statusFilter === "all"
					? `${API_URL}/batch-upload/status`
					: `${API_URL}/batch-upload/status?status=${statusFilter}`;

			const response = await fetch(url);
			const data = await response.json();
			laws = data.laws;
		} catch (error) {
			console.error("Failed to fetch laws:", error);
		}
	}

	// Lifecycle
	onMount(() => {
		connectWebSocket();
		fetchLaws();
	});

	onDestroy(() => {
		if (ws) {
			ws.close();
		}
	});

	// Reactive
	$: if (statusFilter) {
		fetchLaws();
	}

	// Status badge color
	function getStatusColor(status: string): string {
		switch (status) {
			case "pending":
				return "bg-yellow-100 text-yellow-800";
			case "processing":
				return "bg-blue-100 text-blue-800";
			case "published":
				return "bg-green-100 text-green-800";
			case "refused":
				return "bg-red-100 text-red-800";
			default:
				return "bg-gray-100 text-gray-800";
		}
	}

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return "N/A";
		return new Date(dateStr).toLocaleString(
			$language.current === "fr" ? "fr-FR" : "en-US",
		);
	}
</script>

<div class="min-h-screen bg-gray-50 p-8">
	<div class="max-w-7xl mx-auto">
		<!-- Header -->
		<div class="mb-8">
			<h1 class="text-3xl font-bold text-gray-900">
				{$tr("admin.batchUpload")}
			</h1>
			<p class="mt-2 text-gray-600">
				{$tr("admin.batchUploadDesc")}
			</p>
		</div>

		<!-- Upload Section -->
		<div class="bg-white rounded-lg shadow-sm p-6 mb-8">
			<h2 class="text-xl font-semibold mb-4">{$tr("admin.selectFiles")}</h2>

			<!-- Drag and Drop Zone -->
			<div
				class="border-2 border-dashed rounded-lg p-12 text-center transition-colors {isDragging
					? 'border-blue-500 bg-blue-50'
					: 'border-gray-300'}"
				on:drop={handleDrop}
				on:dragover|preventDefault={() => (isDragging = true)}
				on:dragleave={() => (isDragging = false)}
			>
				<svg
					class="mx-auto h-12 w-12 text-gray-400"
					stroke="currentColor"
					fill="none"
					viewBox="0 0 48 48"
				>
					<path
						d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
				<p class="mt-2 text-sm text-gray-600">
					{$tr("admin.dragDrop")}
					<label class="text-blue-600 hover:text-blue-500 cursor-pointer">
						{$tr("admin.browse")}
						<input
							type="file"
							multiple
							accept=".pdf"
							class="hidden"
							on:change={handleFileInput}
						/>
					</label>
				</p>
				<p class="mt-1 text-xs text-gray-500">{$tr("admin.fileLimit")}</p>
			</div>

			<!-- File List -->
			{#if files.length > 0}
				<div class="mt-6">
					<h3 class="text-sm font-medium text-gray-700 mb-3">
						{$tr("admin.selectedFiles")} ({files.length})
					</h3>
					<div class="space-y-2">
						{#each files as file (file.id)}
							<div
								class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
							>
								<div class="flex-1">
									<p class="text-sm font-medium text-gray-900">
										{file.file.name}
									</p>
									<p class="text-xs text-gray-500">
										{(file.file.size / 1024 / 1024).toFixed(2)} MB
									</p>

									<!-- Progress Bar -->
									{#if file.status === "processing"}
										<div class="mt-2 w-full bg-gray-200 rounded-full h-2">
											<div
												class="bg-blue-600 h-2 rounded-full transition-all"
												style="width: {file.progress}%"
											></div>
										</div>
									{/if}
								</div>

								<!-- Status Badge -->
								<div class="ml-4 flex items-center gap-2">
									<span
										class="px-2 py-1 text-xs font-medium rounded-full {getStatusColor(
											file.status,
										)}"
									>
										{file.status}
									</span>

									{#if file.status === "pending"}
										<button
											on:click={() => removeFile(file.id)}
											class="text-red-600 hover:text-red-800"
										>
											<svg
												class="w-5 h-5"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M6 18L18 6M6 6l12 12"
												/>
											</svg>
										</button>
									{/if}
								</div>
							</div>
						{/each}
					</div>

					<!-- Upload Button -->
					<button
						on:click={uploadFiles}
						disabled={isUploading || files.every((f) => f.status !== "pending")}
						class="mt-4 w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
					>
						{isUploading
							? $tr("admin.uploading")
							: `${$tr("admin.uploadFiles")} ${files.filter((f) => f.status === "pending").length} ${$tr("admin.files")}`}
					</button>
				</div>
			{/if}
		</div>

		<!-- Documents List -->
		<div class="bg-white rounded-lg shadow-sm p-6">
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-xl font-semibold">{$tr("admin.documents")}</h2>

				<!-- Status Filter -->
				<select
					bind:value={statusFilter}
					class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
				>
					<option value="all">{$tr("admin.all")}</option>
					<option value="pending">{$tr("admin.pending")}</option>
					<option value="processing">{$tr("admin.inProcess")}</option>
					<option value="published">{$tr("admin.publishedPlural")}</option>
					<option value="refused">{$tr("admin.refusedPlural")}</option>
				</select>
			</div>

			<!-- Laws Table -->
			<div class="overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200">
					<thead class="bg-gray-50">
						<tr>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>{$tr("admin.title")}</th
							>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>{$tr("admin.reference")}</th
							>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>{$tr("admin.status")}</th
							>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>{$tr("admin.progress")}</th
							>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>{$tr("admin.date")}</th
							>
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{#each laws as law (law.id)}
							<tr class="hover:bg-gray-50">
								<td class="px-6 py-4 whitespace-nowrap">
									<div class="text-sm font-medium text-gray-900">
										{law.title}
									</div>
									{#if law.processing_error}
										<div class="text-xs text-red-600 mt-1">
											{law.processing_error}
										</div>
									{/if}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
									>{law.reference}</td
								>
								<td class="px-6 py-4 whitespace-nowrap">
									<span
										class="px-2 py-1 text-xs font-medium rounded-full {getStatusColor(
											law.status,
										)}"
									>
										{law.status}
									</span>
								</td>
								<td class="px-6 py-4 whitespace-nowrap">
									{#if law.processing_progress !== null}
										<div class="w-24 bg-gray-200 rounded-full h-2">
											<div
												class="bg-blue-600 h-2 rounded-full"
												style="width: {law.processing_progress}%"
											></div>
										</div>
									{:else}
										<span class="text-sm text-gray-400">-</span>
									{/if}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
									{formatDate(law.created_at)}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>

				{#if laws.length === 0}
					<div class="text-center py-12 text-gray-500">
						{$tr("admin.noDocFound")}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
