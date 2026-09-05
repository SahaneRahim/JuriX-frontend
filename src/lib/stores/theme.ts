import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Theme type
export type Theme = 'light' | 'dark' | 'auto';

// Storage key
const THEME_STORAGE_KEY = 'jurix-theme';

// Default theme
const DEFAULT_THEME: Theme = 'light';

// Get initial theme from localStorage or default
function getInitialTheme(): Theme {
  if (browser) {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'auto') {
      return stored;
    }
  }
  return DEFAULT_THEME;
}

// Detect system theme preference
function getSystemTheme(): 'light' | 'dark' {
  if (browser && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

// Get effective theme (resolves 'auto' to actual theme)
function getEffectiveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'auto') {
    return getSystemTheme();
  }
  return theme;
}

// Apply theme to document
function applyTheme(theme: 'light' | 'dark') {
  if (browser) {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    root.setAttribute('data-theme', theme);
  }
}

// Create the theme store
function createThemeStore() {
  const { subscribe, update } = writable<Theme>(getInitialTheme());

  // Apply initial theme
  if (browser) {
    const initial = getInitialTheme();
    applyTheme(getEffectiveTheme(initial));
  }

  // Listen for system theme changes when theme is 'auto'
  if (browser && window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      const currentTheme = getInitialTheme();
      if (currentTheme === 'auto') {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    });
  }

  // set, setLight, setDark, setAuto, reset et getEffective ont ete retirees :
  // aucun appelant. Le mode 'auto' n'est donc plus POSABLE par l'interface —
  // il reste lisible depuis localStorage, et l'ecouteur matchMedia le sert
  // toujours pour qui l'avait deja enregistre.
  return {
    subscribe,

    // Toggle between light and dark
    toggle: () => {
      update(current => {
        const newTheme: Theme = current === 'light' ? 'dark' : 'light';
        if (browser) {
          localStorage.setItem(THEME_STORAGE_KEY, newTheme);
          applyTheme(getEffectiveTheme(newTheme));
        }
        return newTheme;
      });
    },
  };
}

// Export the store
export const themeStore = createThemeStore();
