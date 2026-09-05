import { expect, type Locator } from '@playwright/test';

/**
 * Interagit avec la page une fois que Svelte a repris la main.
 *
 * POURQUOI CE FICHIER EXISTE. Les pages sont rendues par le serveur : le
 * balisage — donc les boutons et les champs — est présent dans le HTML avant
 * que le JavaScript client ne s'exécute. Playwright considère un élément comme
 * « actionnable » dès qu'il est visible et stable ; il n'a aucun moyen de
 * savoir qu'un gestionnaire `on:click` n'est pas encore attaché. Un clic parti
 * pendant cette fenêtre est accepté par le navigateur et ne déclenche RIEN.
 *
 * C'est ce qui rendait deux tests instables : l'ouverture du panneau de
 * navigation mobile et l'envoi d'un message dans le chat échouaient environ
 * une fois sur trois, et passaient systématiquement lorsqu'ils étaient lancés
 * seuls — parce que la page était alors déjà compilée et l'hydratation
 * immédiate.
 *
 * La correction ne consiste PAS à attendre plus longtemps : une attente fixe
 * déplace le problème sans le supprimer, et ralentit tout le monde. On répète
 * l'interaction jusqu'à ce que son EFFET soit observable. Dès que
 * l'hydratation a eu lieu, la première tentative suffit.
 */

/** Délai maximal accordé à l'hydratation avant de déclarer l'échec. */
const DELAI_HYDRATATION_MS = 15_000;

/**
 * Clique sur `declencheur` jusqu'à ce que `effet` devienne visible.
 *
 * @param declencheur élément à activer (bouton, lien)
 * @param effet ce que le clic doit produire — c'est LUI qui fait foi
 */
export async function cliquerJusqualEffet(
  declencheur: Locator,
  effet: Locator,
): Promise<void> {
  await expect(async () => {
    await declencheur.click();
    await expect(effet).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: DELAI_HYDRATATION_MS });
}

/**
 * Remplit `champ` et valide, jusqu'à ce que `effet` devienne visible.
 *
 * Le champ est vidé avant chaque tentative : sans cela, une seconde tentative
 * concaténerait la saisie à la première.
 */
export async function saisirJusqualEffet(
  champ: Locator,
  texte: string,
  effet: Locator,
): Promise<void> {
  await expect(async () => {
    await champ.fill('');
    await champ.fill(texte);
    await champ.press('Enter');
    await expect(effet).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: DELAI_HYDRATATION_MS });
}
