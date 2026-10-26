import { writable } from 'svelte/store';

export const commandPaletteOpen = writable<boolean>(false);

export function openCommandPalette(): void {
  commandPaletteOpen.set(true);
}

export function closeCommandPalette(): void {
  commandPaletteOpen.set(false);
}

export function toggleCommandPalette(): void {
  commandPaletteOpen.update((open) => !open);
}
