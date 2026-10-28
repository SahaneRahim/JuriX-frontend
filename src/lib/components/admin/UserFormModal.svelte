<script lang="ts">
  /**
   * Création et modification d'un compte.
   *
   * Un seul composant pour les deux usages : les champs sont identiques à une
   * nuance près — le mot de passe est requis à la création, facultatif à la
   * modification. Deux composants auraient dupliqué la validation, qui est la
   * partie qui compte.
   */
  import { createEventDispatcher } from "svelte";
  import { piegerFocus } from "$lib/actions/pieger-focus";
  import { apiFetch } from "$lib/api";
  import ChampMotDePasse from "$lib/components/ChampMotDePasse.svelte";
  import Icone from "$lib/components/Icone.svelte";
  import { authStore } from "$lib/stores/auth";
  import { tr } from "$lib/stores/language";
  import type { User } from '$lib/types';

  export let show = false;
  /** `null` = création (POST), sinon modification (PUT). */
  export let user: User | null = null;

  const dispatch = createEventDispatcher();

  // Une seule recette pour les champs et leurs libellés, celle de tout le site
  // (noir et blanc, mode sombre compris) : recopiée champ par champ, elle
  // finissait par diverger. Une seule taille aussi, dans les quatre fenêtres
  // de l'administration et les pages de compte : 44 px de haut au moins
  // (38 px ici auparavant), `px-3 py-2`, libellé 4 px au-dessus. 16 px de
  // texte sauf à partir de sm sous un pointeur fin (règle de
  // login/+page.svelte) : sous 16 px, iOS zoome au focus et ne dézoome pas,
  // téléphone en paysage compris.
  const CHAMP =
    "min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-950 placeholder-zinc-400 outline-none focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 dark:border-zinc-500 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-200 dark:focus:ring-zinc-200 sm:[@media(pointer:fine)]:text-sm";
  const LIBELLE = "mb-1 block text-sm font-medium text-zinc-800 dark:text-zinc-200";

  let email = "";
  let username = "";
  let fullName = "";
  let role = "user";
  let isActive = true;
  let password = "";
  let saving = false;
  let error = "";

  // Seul un superadmin peut attribuer ou changer un rôle (admin.py). Afficher
  // un champ actif qui renverrait 403 serait une impasse de plus.
  $: peutChangerRole = $authStore.user?.role === "superadmin";
  $: enCreation = user === null;

  // Réinitialise les champs à chaque ouverture, sinon la modale garde les
  // valeurs du compte précédemment édité.
  $: if (show) {
    email = user?.email ?? "";
    username = user?.username ?? "";
    fullName = user?.full_name ?? "";
    role = user?.role ?? "user";
    isActive = user?.is_active ?? true;
    password = "";
    error = "";
  }

  /**
   * Validation alignée sur `app/schemas/user.py`.
   *
   * Sans elle, une saisie non conforme revient en 422 Pydantic illisible, avec
   * un message en anglais pointant un chemin de champ interne.
   */
  function valider(): string {
    if (!email.includes("@")) return $tr("admin.user.errEmail");
    if (username.trim().length < 3)
      return $tr("admin.user.errUsernameLen");
    if (!/^[a-zA-Z0-9_-]+$/.test(username))
      return $tr("admin.user.errUsernameChars");
    if (enCreation || password) {
      if (password.length < 8)
        return $tr("admin.user.errPwdLen");
      if (!/[A-Z]/.test(password))
        return $tr("admin.user.errPwdUpper");
      if (!/[a-z]/.test(password))
        return $tr("admin.user.errPwdLower");
      if (!/\d/.test(password)) return $tr("admin.user.errPwdDigit");
    }
    return "";
  }

  function close() {
    show = false;
    dispatch("close");
  }

  function onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) close();
  }

  function onKeydown(event: KeyboardEvent) {
    if (show && event.key === "Escape") close();
  }

  // Ouverte, la modale fige la page derrière elle, comme le choix du profil
  // (src/routes/+layout.svelte) : sur téléphone, un glisser sur le fond ou sur
  // l'en-tête du panneau faisait défiler la liste des comptes dessous.
  function bloquerDefilement(_noeud: HTMLElement) {
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return {
      destroy() {
        document.body.style.overflow = avant;
      },
    };
  }

  async function save() {
    error = valider();
    if (error) return;

    saving = true;
    try {
      const corps: Record<string, unknown> = {
        email,
        username,
        full_name: fullName || null,
        is_active: isActive,
      };
      // N'envoyer le rôle que si l'opérateur a le droit de le changer : sinon
      // le backend répond 403 sur une modification que l'utilisateur n'a pas
      // demandée.
      if (peutChangerRole) corps.role = role;
      if (password) corps.password = password;

      const reponse = await apiFetch(
        enCreation ? "/admin/users" : `/admin/users/${user!.id}`,
        {
          method: enCreation ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(corps),
        },
      );

      // `apiFetch` rend une Response et ne lève pas sur 4xx : sans ce contrôle,
      // un 409 « email déjà utilisé » passerait pour un succès et la modale se
      // fermerait sur un compte jamais créé.
      if (!reponse.ok) {
        // Le backend renvoie des messages exploitables en français (403 rôle,
        // 409 doublon, 400 auto-rétrogradation) : les afficher tels quels
        // plutôt que de les remplacer par « Erreur inconnue ».
        const corpsErreur = await reponse.json().catch(() => null);
        error =
          corpsErreur?.detail ??
          $tr("admin.user.errSave").replace("{status}", String(reponse.status));
        return;
      }

      dispatch("saved");
      close();
    } catch {
      error = $tr("common.errorNetwork");
    } finally {
      saving = false;
    }
  }
</script>

<svelte:window on:keydown={onKeydown} />

{#if show}
  <!--
    Panneau collé en bas sur téléphone, boîte centrée à partir de sm.

    La boîte faisait environ 610 px, sans hauteur maximale ni défilement : sur
    un iPhone SE, en paysage ou clavier ouvert, le titre, la croix et
    « Enregistrer » sortaient de l'écran sans qu'on puisse les atteindre.
    Désormais seuls les champs défilent. La hauteur maximale se rapporte au
    voile, fixe en inset-0, qui suit déjà l'écran réellement visible (barre
    d'adresse, clavier Android) sans dépendre de l'unité dvh.
  -->
  <div
    class="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 backdrop-blur-sm sm:items-center sm:p-4"
    role="presentation"
    data-testid="user-modal"
    on:click={onBackdropClick}
    use:bloquerDefilement
  >
    <div
      class="flex max-h-[calc(100%-1rem)] w-full max-w-lg flex-col rounded-t-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none sm:max-h-[90%] sm:rounded-2xl"
      use:piegerFocus
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-modal-title"
    >
      <!-- En-tête séparé du corps par un trait, aux marges de « Modifier le
           document » et de « Modifier l'article » : les quatre fenêtres de
           l'administration ont la même construction (trait sous l'en-tête et
           au-dessus du pied). Celle-ci n'avait que le second. -->
      <div class="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800 sm:px-6 sm:py-4">
        <!-- Titre des fenêtres de l'administration : 20 puis 24 px, comme
             « Modifier le document » et « Modifier l'article ». -->
        <h2 id="user-modal-title" class="min-w-0 text-xl font-bold tracking-tight text-zinc-950 dark:text-white sm:text-2xl">
          {enCreation ? $tr("admin.user.new") : $tr("admin.user.edit")}
        </h2>
        <!-- 44 px : la croix seule faisait une cible d'environ 16 × 24 px. La
             croix est l'icône `x` des autres fenêtres, et non plus le
             caractère « × », dont le dessin dépendait de la police. -->
        <button
          type="button"
          on:click={close}
          data-testid="user-modal-close"
          aria-label={$tr("common.close")}
          class="-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
          ><Icone nom="x" class="h-6 w-6" /></button
        >
      </div>

      <form on:submit|preventDefault={save} class="flex min-h-0 flex-1 flex-col">
        <!-- overscroll-contain : arrivé au bout, le défilement ne passe pas à
             la page derrière. -->
        <div class="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-6">
          <div>
            <label for="u-email" class={LIBELLE}>{$tr("admin.user.email")}</label>
            <input
              id="u-email"
              type="email"
              bind:value={email}
              required
              class={CHAMP}
            />
          </div>

          <div>
            <label for="u-username" class={LIBELLE}>{$tr("admin.user.username")}</label>
            <input
              id="u-username"
              bind:value={username}
              required
              class={CHAMP}
            />
            <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {$tr("admin.user.usernameHint")}
            </p>
          </div>

          <div>
            <label for="u-fullname" class={LIBELLE}>{$tr("admin.user.fullName")}</label>
            <input
              id="u-fullname"
              bind:value={fullName}
              class={CHAMP}
            />
          </div>

          <div class="flex items-end gap-4">
            <div class="min-w-0 flex-1">
              <label for="u-role" class={LIBELLE}>{$tr("admin.user.role")}</label>
              <select
                id="u-role"
                bind:value={role}
                disabled={!peutChangerRole}
                title={peutChangerRole
                  ? undefined
                  : $tr("admin.user.roleHint")}
                class="{CHAMP} pr-10 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-500 dark:disabled:bg-zinc-800/50 dark:disabled:text-zinc-400"
              >
                <option value="user">{$tr("admin.role.user")}</option>
                <option value="admin">{$tr("admin.role.admin")}</option>
                <option value="superadmin">{$tr("admin.role.superadmin")}</option>
              </select>
            </div>

            <!-- Toute l'étiquette est la cible : 44 px de haut, case de 20 px. -->
            <div class="shrink-0">
              <label class="flex min-h-11 items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                <input
                  type="checkbox"
                  bind:checked={isActive}
                  class="h-5 w-5 rounded text-zinc-900 focus:ring-zinc-950 dark:text-white dark:focus:ring-white"
                />
                {$tr("admin.user.active")}
              </label>
            </div>
          </div>

          <div>
            <label for="u-password" class={LIBELLE}
              >{$tr("admin.user.password")} {enCreation ? "" : $tr("admin.user.passwordKeep")}</label
            >
            <ChampMotDePasse
              id="u-password"
              bind:value={password}
              autocomplete="new-password"
              required={enCreation}
              class={CHAMP}
            />
            <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {$tr("admin.user.passwordHint")}
            </p>
          </div>
        </div>

        <!-- Pied toujours visible, au-dessus de la barre d'accueil de l'iPhone
             (zone sûre). L'erreur y vit aussi : en fin de corps défilant, elle
             restait hors de vue sous les champs quand l'enregistrement
             échouait. -->
        <div class="shrink-0 border-t border-zinc-200 pb-zone-sure dark:border-zinc-800">
          {#if error}
            <p
              role="alert"
              class="mx-4 mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300 sm:mx-6"
            >
              <Icone nom="circle-alert" class="mt-0.5 text-base" />{error}
            </p>
          {/if}

          <!-- Boutons du pied à la base du guide (§ 4.4 : 14 px, semi-gras,
               `px-5`), comme dans les trois autres fenêtres de
               l'administration, et aux mêmes marges (12 puis 16 px). -->
          <div class="flex justify-end gap-3 px-4 py-3 sm:px-6 sm:py-4">
            <button
              type="button"
              on:click={close}
              data-testid="user-modal-cancel"
              class="inline-flex h-11 flex-1 items-center justify-center rounded-xl px-5 text-sm font-semibold text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white sm:flex-none"
              >{$tr("common.cancel")}</button
            >
            <button
              type="submit"
              disabled={saving}
              data-testid="user-modal-save"
              class="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-zinc-950 px-5 text-sm font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 sm:flex-none"
              >{saving ? $tr("common.saving") : $tr("common.save")}</button
            >
          </div>
        </div>
      </form>
    </div>
  </div>
{/if}
