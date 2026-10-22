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
  import { authStore } from "$lib/stores/auth";
  import { tr } from "$lib/stores/language";
  import type { User } from '$lib/types';

  export let show = false;
  /** `null` = création (POST), sinon modification (PUT). */
  export let user: User | null = null;

  const dispatch = createEventDispatcher();

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
    class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4"
    role="presentation"
    data-testid="user-modal"
    on:click={onBackdropClick}
    use:bloquerDefilement
  >
    <div
      class="flex max-h-[calc(100%-1rem)] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl sm:max-h-[90%] sm:rounded-2xl"
      use:piegerFocus
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-modal-title"
    >
      <div class="flex shrink-0 items-center justify-between gap-3 px-4 pb-2 pt-3 sm:px-6 sm:pb-6 sm:pt-6">
        <h2 id="user-modal-title" class="min-w-0 text-xl font-bold text-slate-900">
          {enCreation ? $tr("admin.user.new") : $tr("admin.user.edit")}
        </h2>
        <!-- 44 px : la croix seule faisait une cible d'environ 16 × 24 px. -->
        <button
          type="button"
          on:click={close}
          data-testid="user-modal-close"
          aria-label={$tr("common.close")}
          class="-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-2xl leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-700">&times;</button
        >
      </div>

      <form on:submit|preventDefault={save} class="flex min-h-0 flex-1 flex-col">
        <!-- overscroll-contain : arrivé au bout, le défilement ne passe pas à
             la page derrière. -->
        <div class="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-4 sm:px-6">
          <div>
            <label for="u-email" class="mb-1 block text-sm font-medium text-slate-700"
              >{$tr("admin.user.email")}</label
            >
            <input
              id="u-email"
              type="email"
              bind:value={email}
              required
              class="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label for="u-username" class="mb-1 block text-sm font-medium text-slate-700"
              >{$tr("admin.user.username")}</label
            >
            <input
              id="u-username"
              bind:value={username}
              required
              class="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <p class="mt-1 text-xs text-slate-500">
              {$tr("admin.user.usernameHint")}
            </p>
          </div>

          <div>
            <label for="u-fullname" class="mb-1 block text-sm font-medium text-slate-700"
              >{$tr("admin.user.fullName")}</label
            >
            <input
              id="u-fullname"
              bind:value={fullName}
              class="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div class="flex items-end gap-4">
            <div class="min-w-0 flex-1">
              <label for="u-role" class="mb-1 block text-sm font-medium text-slate-700"
                >{$tr("admin.user.role")}</label
              >
              <select
                id="u-role"
                bind:value={role}
                disabled={!peutChangerRole}
                title={peutChangerRole
                  ? undefined
                  : $tr("admin.user.roleHint")}
                class="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
              >
                <option value="user">{$tr("admin.role.user")}</option>
                <option value="admin">{$tr("admin.role.admin")}</option>
                <option value="superadmin">{$tr("admin.role.superadmin")}</option>
              </select>
            </div>

            <!-- Toute l'étiquette est la cible : 44 px de haut, case de 20 px. -->
            <div class="shrink-0">
              <label class="flex min-h-11 items-center gap-2 text-sm font-medium text-slate-700">
                <input type="checkbox" bind:checked={isActive} class="h-5 w-5 rounded" />
                {$tr("admin.user.active")}
              </label>
            </div>
          </div>

          <div>
            <label for="u-password" class="mb-1 block text-sm font-medium text-slate-700"
              >{$tr("admin.user.password")} {enCreation ? "" : $tr("admin.user.passwordKeep")}</label
            >
            <input
              id="u-password"
              type="password"
              bind:value={password}
              autocomplete="new-password"
              required={enCreation}
              class="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <p class="mt-1 text-xs text-slate-500">
              {$tr("admin.user.passwordHint")}
            </p>
          </div>
        </div>

        <!-- Pied toujours visible, au-dessus de la barre d'accueil de l'iPhone
             (zone sûre). L'erreur y vit aussi : en fin de corps défilant, elle
             restait hors de vue sous les champs quand l'enregistrement
             échouait. -->
        <div class="shrink-0 border-t border-slate-100 pb-zone-sure">
          {#if error}
            <p role="alert" class="mx-4 mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:mx-6">
              {error}
            </p>
          {/if}

          <div class="flex justify-end gap-3 px-4 py-3 sm:px-6 sm:pb-6 sm:pt-4">
            <button
              type="button"
              on:click={close}
              data-testid="user-modal-cancel"
              class="inline-flex h-11 flex-1 items-center justify-center rounded-lg px-4 font-medium text-slate-600 hover:bg-slate-100 sm:flex-none"
              >{$tr("common.cancel")}</button
            >
            <button
              type="submit"
              disabled={saving}
              data-testid="user-modal-save"
              class="inline-flex h-11 flex-1 items-center justify-center rounded-lg bg-blue-600 px-5 font-semibold text-white hover:bg-blue-700 disabled:opacity-60 sm:flex-none"
              >{saving ? $tr("common.saving") : $tr("common.save")}</button
            >
          </div>
        </div>
      </form>
    </div>
  </div>
{/if}
