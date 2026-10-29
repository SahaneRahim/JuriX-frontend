import { writable } from 'svelte/store';

export const commandPaletteOpen = writable<boolean>(false);

/**
 * Ce que le chat annonce pendant que la palette est ouverte (étapes, fin de
 * réponse, arrêt, erreurs), dit par une région DANS la palette. Ouverte, elle
 * rend toute la page inerte (src/routes/+layout.svelte), région d'annonce du
 * chat comprise : la fin d'une réponse arrivée pendant une recherche dans la
 * palette n'était jamais dite, ni redite à sa fermeture. Écrit par la page du
 * chat seulement ; vidé à chaque ouverture et à chaque fermeture
 * (CommandPalette.svelte).
 */
export const annonceDansLaPalette = writable('');

export function openCommandPalette(): void {
  commandPaletteOpen.set(true);
}

export function closeCommandPalette(): void {
  commandPaletteOpen.set(false);
}

export function toggleCommandPalette(): void {
  commandPaletteOpen.update((open) => !open);
}
