<script lang="ts">
  // apiFetch est utilisé plus bas pour le téléversement : sans lui dans cet
  // import, chaque clic sur « Téléverser » levait un ReferenceError, capturé
  // par le catch et affiché en alert. Le téléversement par lot était donc
  // totalement inopérant, sans que rien ne le signale à la compilation.
  import { apiFetch, wsUrlAuthentifiee } from '$lib/api';
	import { onMount, onDestroy } from "svelte";
	import { browser } from "$app/environment";

	import { language, tr } from "$lib/stores/language";
	import Icone from "$lib/components/Icone.svelte";
	import StatusBadge from "$lib/components/StatusBadge.svelte";
	import { formatDateHeure } from "$lib/format";
	import type { MessageLotWS } from '$lib/types';

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
		const wsUrl = wsUrlAuthentifiee(`/batch-upload/ws/${sessionId}`);
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

	/** Erreur de LOT signalée par le serveur, distincte des erreurs par fichier. */
	let erreurLot = "";

	function handleWebSocketMessage(data: MessageLotWS) {
		switch (data.type) {
			case "progress":
			case "upload_progress":
				// Avancement global : rien a afficher ligne par ligne, mais la
				// branche doit exister. `progress` n'en avait AUCUNE et tombait
				// donc dans le vide, comme `error` juste en dessous.
				break;

			case "error":
				// Le serveur signale une erreur de LOT, distincte de
				// `processing_error` qui vise un fichier. Sans cette branche,
				// une erreur signalee par le serveur n'atteignait jamais
				// l'ecran : l'import paraissait simplement s'arreter.
				erreurLot = data.error ?? $tr("batch.errorUnknown");
				break;

			case "file_created":
			{
					// Update file with law_id
					const fileIndex = files.findIndex((f) => f.file.name === data.filename);
					if (fileIndex !== -1) {
						files[fileIndex].law_id = data.law_id;
						files[fileIndex].status = "pending";
					}
					break;
			}

			case "processing_start":
			{
					// Update file status to processing
					const processingFile = files.find((f) => f.law_id === data.law_id);
					if (processingFile) {
						processingFile.status = "processing";
						processingFile.progress = 0;
					}
					break;
			}

			case "processing_complete":
			{
					// Update file status to published
					const completedFile = files.find((f) => f.law_id === data.law_id);
					if (completedFile) {
						completedFile.status = data.status;
						completedFile.progress = 100;
					}
					fetchLaws(); // Refresh list
					break;
			}

			case "processing_error":
			{
					// Update file status to refused
					const errorFile = files.find((f) => f.law_id === data.law_id);
					if (errorFile) {
						errorFile.status = "refused";
						errorFile.error = data.error;
					}
					break;
			}

			default:
				// Un type inconnu doit se voir, pas disparaitre. C'est ce
				// silence qui a laisse `progress` et `error` sans branche
				// pendant toute la vie de cet ecran.
				console.warn("Message WebSocket non traite:", data);
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
			const response = await apiFetch(`/batch-upload/upload?session_id=${sessionId}`,
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
			alert($tr("batch.uploadFailed").replace("{err}", String(error)));
		} finally {
			isUploading = false;
		}
	}

	// Fetch laws
	async function fetchLaws() {
		try {
			// apiFetch : endpoint d'administration, il lui faut l'en-tete
			// Authorization et la deconnexion sur 401.
			const chemin =
				statusFilter === "all"
					? "/batch-upload/status"
					: `/batch-upload/status?status=${statusFilter}`;

			const response = await apiFetch(chemin);
			// `apiFetch` ne leve pas sur 4xx (c'est documente et voulu). Sans
			// ce controle, un 401 faisait `laws = undefined` et la page se
			// vidait sans rien dire.
			if (!response.ok) {
				console.error("Chargement des lois impossible:", response.status);
				return;
			}
			const data = await response.json();
			laws = data.laws ?? [];
		} catch (error) {
			console.error("Failed to fetch laws:", error);
		}
	}

	// Lifecycle
	onMount(() => {
		connectWebSocket();
		// fetchLaws() n'est PAS appele ici : le bloc reactif sur statusFilter
		// s'execute deja au montage et lancait la meme requete une seconde fois.
	});

	onDestroy(() => {
		if (ws) {
			ws.close();
		}
	});

	/**
	 * Tableau à partir de lg, cartes en dessous, comme Documents et
	 * Utilisateurs : les trois listes de l'administration changent de forme
	 * à la même largeur. À partir de md, le tableau ne laissait au titre
	 * qu'environ la moitié de la ligne à 768 px (3 à 4 lignes par texte), à
	 * côté des colonnes Statut et Progression.
	 *
	 * Le tableau défilait de côté sans que rien ne l'indique : à 1 024 et
	 * 768 px, la colonne Statut était coupée au milieu des badges, et
	 * Progression et Date sortaient de l'écran ; sur téléphone, seuls le titre
	 * et la moitié de la cote restaient visibles. Or la page sert à suivre le
	 * traitement, donc le statut et la progression.
	 *
	 * Une seule variante est RENDUE, plutôt que masquée en CSS : StatusBadge
	 * porte un data-testid, qui se serait retrouvé en double sur chaque ligne.
	 * La page n'est jamais rendue par le serveur (admin/+layout.ts) : la
	 * largeur se lit dès la création, sans éclair de la mauvaise variante.
	 */
	const REQUETE_TABLEAU = "(min-width: 1024px)";
	let tableau = browser && window.matchMedia(REQUETE_TABLEAU).matches;

	onMount(() => {
		const requete = window.matchMedia(REQUETE_TABLEAU);
		const suivre = () => (tableau = requete.matches);
		suivre();
		requete.addEventListener("change", suivre);
		return () => requete.removeEventListener("change", suivre);
	});

	// Avancement écrit à côté de sa barre : la barre seule ne disait pas où
	// en était le traitement, ni au lecteur d'écran. Tailles des fichiers à la
	// française (« 1,23 Mo ») : « 1.23 MB » était écrit en dur, en anglais.
	$: pourcentage = new Intl.NumberFormat($language.current, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	$: megaOctets = new Intl.NumberFormat($language.current, {
		style: "unit",
		unit: "megabyte",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});

	// Reactive
	$: if (statusFilter) {
		fetchLaws();
	}

	// Status badge color

</script>

<!-- Ni min-h-screen ni marge ici : admin/+layout.svelte fournit déjà le fond
     et l'espacement autour du <slot /> (p-4 à p-8 selon la largeur). Les
     cumuler doublait la marge de cette seule page par rapport aux autres
     écrans d'administration. -->
<div>
	<div class="max-w-7xl mx-auto">
		<!-- Header -->
		<div class="mb-6 sm:mb-8">
			<!-- La page n'avait aucun retour : on n'y arrivait qu'en tapant l'URL.
			     44 px de haut, sauf à partir de lg sous un pointeur fin (la règle
			     de /search et de /compare) : réduit dès sm, le lien n'était plus
			     qu'une ligne de 20 px sur les tablettes, tactiles. -->
			<a
				href="/admin/documents"
				data-testid="batch-back-to-documents"
				class="mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white lg:[@media(pointer:fine)]:min-h-0"
			>
				<Icone nom="arrow-left" class="text-base" />
				{$tr("admin.docManagement")}
			</a>
			<!-- Titre de page du guide (§ 4.2 : 30 puis 36 px) et description à
			     `mt-1`, comme les autres pages de l'administration. -->
			<h1 class="text-3xl font-bold tracking-tight text-zinc-950 dark:text-white sm:text-4xl">
				{$tr("admin.batchUpload")}
			</h1>
			<!-- `text-pretty` : pas de mot seul en dernière ligne, comme les
			     sous-titres des autres pages de l'administration. -->
			<p class="mt-1 text-pretty text-zinc-500 dark:text-zinc-400">
				{$tr("admin.batchUploadDesc")}
			</p>
		</div>

		<!-- Upload Section. Écran court (`court:`, téléphone en paysage) :
		     marges, zone et tuile resserrées. La carte faisait environ 280 px
		     de haut, tout l'écran de 360 px sous la barre du haut, et la liste
		     des documents n'apparaissait qu'après défilement. -->
		<div class="mb-6 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:mb-8 sm:p-6 court:p-4">
			<!-- Titres de carte du guide (§ 4.2 : 16 puis 18 px, gras), comme
			     ceux du tableau de bord : 18 puis 20 px en semi-gras ici. -->
			<h2 class="mb-4 text-base font-bold text-zinc-950 dark:text-white sm:text-lg court:mb-3">{$tr("admin.selectFiles")}</h2>

			<!-- Drag and Drop Zone.
			     Toute la zone est l'étiquette du champ : sur téléphone, sans
			     glisser-déposer, seul le petit mot « parcourez » (60 × 20 px)
			     ouvrait le sélecteur de fichiers. Le champ est sr-only et non
			     plus `hidden` : il reste atteignable au clavier, et la zone
			     s'entoure quand il a le focus.
			     La même zone que la fenêtre « Ajouter des documents »
			     (UploadModal) : fond zinc-50 en pointillés, tuile d'icône du
			     guide (rounded-xl), consigne puis formats et limite. Les deux
			     zones du même geste avaient deux dessins (zone transparente et
			     grande icône nue ici, tuile ronde là-bas). -->
			<label
				for="batch-files"
				class="relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors focus-within:border-zinc-950 focus-within:ring-2 focus-within:ring-zinc-950/20 dark:focus-within:border-zinc-200 dark:focus-within:ring-zinc-200/20 sm:py-10 court:py-4 {isDragging
					? 'border-zinc-950 bg-zinc-100 dark:border-zinc-200 dark:bg-zinc-800'
					: 'border-zinc-300 bg-zinc-50 hover:border-zinc-950 dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:border-zinc-400'}"
				on:drop={handleDrop}
				on:dragover|preventDefault={() => (isDragging = true)}
				on:dragleave={() => (isDragging = false)}
			>
				<span
					class="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 court:mb-2 court:h-9 court:w-9"
				>
					<Icone nom="file-up" class="text-2xl court:text-xl" />
				</span>
				<!-- « Glissez-déposez » ne parle qu'à une souris : au doigt, le
				     texte dit ce que fait le geste disponible. Choisi selon le
				     POINTEUR et non la largeur : un téléphone en paysage ou une
				     tablette, larges mais tactiles, recevaient la consigne de la
				     souris. -->
				<p class="text-sm font-medium text-zinc-950 dark:text-zinc-100">
					<span class="[@media(pointer:fine)]:hidden">{$tr("admin.tapToChoose")}</span>
					<span class="hidden [@media(pointer:fine)]:inline">
						{$tr("admin.dragDrop")}
						<span class="text-zinc-950 underline decoration-zinc-300 underline-offset-4 dark:text-white dark:decoration-zinc-600">{$tr("admin.browse")}</span>
					</span>
				</p>
				<!-- zinc-600 et non 500 : sur le fond zinc-100 du glisser, zinc-500
				     ne fait plus que 4,4:1. -->
				<p class="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{$tr("admin.fileLimit")}</p>
				<input
					id="batch-files"
					type="file"
					multiple
					accept=".pdf"
					class="sr-only"
					on:change={handleFileInput}
				/>
			</label>

			<!-- File List -->
			<!-- Erreur de lot signalée par le serveur. Sans cet affichage, le
			     message arrivait bien par le WebSocket et se perdait : l'import
			     paraissait simplement s'arrêter sans raison. -->
			{#if erreurLot}
				<div
					role="alert"
					class="mb-6 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
				>
					<Icone nom="circle-alert" class="mt-0.5 text-base" />
					<p class="coupe-mots min-w-0">{erreurLot}</p>
				</div>
			{/if}

			{#if files.length > 0}
				<div class="mt-6">
					<h3 class="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
						{$tr("admin.selectedFiles")} ({files.length})
					</h3>
					<div class="space-y-2">
						{#each files as file (file.id)}
							<!-- Les noms de PDF, souvent sans espace
							     (« 10691_decret-n-2026-164-du-… »), ne se coupaient
							     pas et poussaient la ligne, puis la page, hors de
							     l'écran : tronqués ici, en entier au survol. -->
							<div
								class="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700/60 dark:bg-zinc-800/50"
							>
								<div class="min-w-0 flex-1">
									<p class="truncate text-sm font-medium text-zinc-950 dark:text-zinc-100" title={file.file.name}>
										{file.file.name}
									</p>
									<p class="font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
										{megaOctets.format(file.file.size / 1024 / 1024)}
									</p>

									<!-- Progress Bar -->
									{#if file.status === "processing"}
										<div class="mt-2 h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-700">
											<div
												class="h-2 rounded-full bg-zinc-950 transition-all dark:bg-white"
												style="width: {file.progress}%"
											></div>
										</div>
									{/if}
								</div>

								<!-- Status Badge -->
								<div class="flex shrink-0 items-center gap-2">
									<StatusBadge status={file.status} size="sm" />

									<!-- Icône seule : le nom vient de aria-label, qui
									     dit aussi QUEL fichier sera retiré. -->
									{#if file.status === "pending"}
										<button
											type="button"
											on:click={() => removeFile(file.id)}
											aria-label={$tr("admin.removeFile").replace("{name}", file.file.name)}
											class="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-xl text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
										>
											<Icone nom="x" class="h-5 w-5" />
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
						class="mt-4 w-full rounded-xl bg-zinc-950 px-4 py-3 font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
					>
						{isUploading
							? $tr("admin.uploading")
							: `${$tr("admin.uploadFiles")} ${files.filter((f) => f.status === "pending").length} ${$tr("admin.files")}`}
					</button>
				</div>
			{/if}
		</div>

		<!-- Documents List. La carte n'a pas de marge intérieure, son en-tête
		     seul garde la sienne : la bande grise des en-têtes de colonnes va
		     ainsi d'un bord à l'autre, comme dans les tableaux de Documents et
		     d'Utilisateurs (guide, § 4.13), au lieu de flotter en retrait. -->
		<div class="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
			<div class="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 p-4 dark:border-zinc-800 sm:px-6">
				<h2 class="text-base font-bold text-zinc-950 dark:text-white sm:text-lg">{$tr("admin.documents")}</h2>

				<!-- Status Filter. 44 px de haut à toutes les tailles, et 16 px
				     de texte sauf sous un pointeur fin à partir de sm (la règle
				     des pages de compte, login/+page.svelte) : compactée à 38 px
				     et 14 px dès sm, la liste l'était aussi sur un téléphone en
				     paysage (740 px), où iOS zoome au focus, et sur les tablettes.
				     Le filtre des documents, mot pour mot : « Tous statuts » dit
				     ce qu'il filtre (« Tous » seul ne le disait pas), et chaque
				     statut a le libellé de son badge, au singulier. Seuls ces
				     quatre statuts : /batch-upload/status refuse les autres
				     (app/api/routes/batch_upload.py). -->
				<select
					bind:value={statusFilter}
          aria-label={$tr("a11y.filterStatus")}
					class="min-h-11 rounded-xl border border-zinc-200 bg-white py-2 pl-3 pr-10 text-base text-zinc-950 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 dark:border-zinc-500 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-200 dark:focus:ring-zinc-200 sm:[@media(pointer:fine)]:text-sm"
				>
					<option value="all">{$tr("admin.allStatuses")}</option>
					<option value="pending">{$tr("admin.pending")}</option>
					<option value="processing">{$tr("admin.inProcess")}</option>
					<option value="published">{$tr("admin.published")}</option>
					<option value="refused">{$tr("admin.refused")}</option>
				</select>
			</div>

			{#if laws.length === 0}
				<p class="px-4 py-12 text-center text-zinc-500 dark:text-zinc-400 sm:px-6">
					{$tr("admin.noDocFound")}
				</p>
			{:else if tableau}
				<!-- Le statut, ce que la page sert à suivre, garde sa colonne à
				     toute largeur. La cote passe sous le titre, comme dans le
				     tableau des documents : jamais coupée, sa colonne gardait
				     250 px pendant que le titre, borné à 14 rem, tenait sur 5 à 6
				     lignes et se coupait en plein mot (« MINCOMME » / « RCE »).
				     Sous xl, la date rejoint le titre, et la progression le
				     statut : à part, sa colonne prenait un quart de la largeur
				     pour un « — » sur presque toutes les lignes (seul un texte en
				     cours de traitement a une progression). Le titre prend toute
				     la place qui reste. -->
				<div class="overflow-x-auto">
					<table class="w-full text-left text-sm text-zinc-700 dark:text-zinc-300">
						<thead
							class="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400"
						>
							<tr>
								<th class="px-6 py-3">{$tr("admin.title")}</th>
								<th class="px-6 py-3">{$tr("admin.status")}</th>
								<th class="hidden px-6 py-3 xl:table-cell">{$tr("admin.progress")}</th>
								<th class="hidden px-6 py-3 xl:table-cell">{$tr("admin.date")}</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-zinc-200 dark:divide-zinc-800">
							{#each laws as law (law.id)}
								<tr class="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
									<!-- Titre et erreur passent à la ligne : en
									     `whitespace-nowrap`, une ligne prenait la
									     largeur du plus long titre ou message (600 à
									     1 000 px). Les cotes sans espace
									     (« N°2018/9387/CAB/PM ») se coupent au lieu
									     d'élargir la colonne. -->
									<td class="px-6 py-4">
										<div class="coupe-mots">
											<div class="font-medium text-zinc-950 dark:text-zinc-100">
												{law.title}
											</div>
											{#if law.reference}
												<!-- Cotes et dates à la recette « Méta » du guide
												     (§ 4.2) : chasse fixe, chiffres tabulaires,
												     comme au tableau de bord et dans le blog. -->
												<div class="font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">{law.reference}</div>
											{/if}
											{#if law.processing_error}
												<div
													class="mt-1 line-clamp-3 text-xs text-red-600 dark:text-red-400"
													title={law.processing_error}
												>
													{law.processing_error}
												</div>
											{/if}
											<!-- La date sous xl, où sa colonne est masquée. En
											     liste de définitions, comme dans le tableau des
											     documents : privée de son en-tête de colonne,
											     une date seule ne dirait pas ce qu'elle date au
											     lecteur d'écran. -->
											<dl class="mt-1 text-xs text-zinc-500 dark:text-zinc-400 xl:hidden">
												<dt class="sr-only">{$tr("admin.date")}</dt>
												<dd class="font-mono tabular-nums">{formatDateHeure(law.created_at, $language.current)}</dd>
											</dl>
										</div>
									</td>
									<td class="whitespace-nowrap px-6 py-4">
										<StatusBadge status={law.status} size="sm" />
										<!-- La progression sous le badge, sous xl où sa
										     colonne est masquée. En liste de définitions,
										     comme la date sous le titre : privée de son
										     en-tête, « 45 % » seul ne dirait pas ce qu'il
										     mesure au lecteur d'écran. -->
										{#if law.processing_progress !== null}
											<dl class="mt-2 text-xs text-zinc-500 dark:text-zinc-400 xl:hidden">
												<dt class="sr-only">{$tr("admin.progress")}</dt>
												<dd class="flex items-center gap-2">
													<div class="h-2 w-24 rounded-full bg-zinc-200 dark:bg-zinc-700" aria-hidden="true">
														<div
															class="h-2 rounded-full bg-zinc-950 dark:bg-white"
															style="width: {law.processing_progress}%"
														></div>
													</div>
													<span class="tabular-nums">{pourcentage.format(law.processing_progress / 100)}</span>
												</dd>
											</dl>
										{/if}
									</td>
									<td class="hidden whitespace-nowrap px-6 py-4 xl:table-cell">
										{#if law.processing_progress !== null}
											<div class="flex items-center gap-2">
												<div class="h-2 w-24 rounded-full bg-zinc-200 dark:bg-zinc-700" aria-hidden="true">
													<div
														class="h-2 rounded-full bg-zinc-950 dark:bg-white"
														style="width: {law.processing_progress}%"
													></div>
												</div>
												<span class="text-xs tabular-nums text-zinc-500 dark:text-zinc-400"
													>{pourcentage.format(law.processing_progress / 100)}</span
												>
											</div>
										{:else}
											<span class="text-zinc-500 dark:text-zinc-400">—</span>
										{/if}
									</td>
									<td class="hidden whitespace-nowrap px-6 py-4 font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400 xl:table-cell">
										{formatDateHeure(law.created_at, $language.current)}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<!-- Une carte par document, sous lg : le titre en entier (rien
				     d'autre ici ne permet de le lire), sa cote et l'erreur
				     éventuelle, puis le statut, l'avancement et la date sur une
				     ligne qui passe à la ligne au besoin. -->
				<ul class="divide-y divide-zinc-200 dark:divide-zinc-800">
					{#each laws as law (law.id)}
						<li class="space-y-2 p-4 sm:px-6">
							<div class="coupe-mots">
								<p class="font-medium text-zinc-950 dark:text-zinc-100">{law.title}</p>
								{#if law.reference}
									<p class="mt-0.5 font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">{law.reference}</p>
								{/if}
								{#if law.processing_error}
									<p
										class="mt-1 line-clamp-3 text-xs text-red-600 dark:text-red-400"
										title={law.processing_error}
									>
										{law.processing_error}
									</p>
								{/if}
							</div>
							<dl class="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-zinc-500 dark:text-zinc-400">
								<dt class="sr-only">{$tr("admin.status")}</dt>
								<dd class="flex"><StatusBadge status={law.status} size="sm" /></dd>
								{#if law.processing_progress !== null}
									<dt class="sr-only">{$tr("admin.progress")}</dt>
									<dd class="flex items-center gap-2">
										<div class="h-2 w-24 rounded-full bg-zinc-200 dark:bg-zinc-700" aria-hidden="true">
											<div
												class="h-2 rounded-full bg-zinc-950 dark:bg-white"
												style="width: {law.processing_progress}%"
											></div>
										</div>
										<span class="tabular-nums">{pourcentage.format(law.processing_progress / 100)}</span>
									</dd>
								{/if}
								<dt class="sr-only">{$tr("admin.date")}</dt>
								<dd class="font-mono tabular-nums">{formatDateHeure(law.created_at, $language.current)}</dd>
							</dl>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
</div>
