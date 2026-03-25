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
  const { subscribe, set, update } = writable<Theme>(getInitialTheme());

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

  return {
    subscribe,

    // Set theme
    set: (value: Theme) => {
      if (browser) {
        localStorage.setItem(THEME_STORAGE_KEY, value);
        applyTheme(getEffectiveTheme(value));
      }
      set(value);
    },

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

    // Set to light theme
    setLight: () => {
      const newTheme: Theme = 'light';
      if (browser) {
        localStorage.setItem(THEME_STORAGE_KEY, newTheme);
        applyTheme('light');
      }
      set(newTheme);
    },

    // Set to dark theme
    setDark: () => {
      const newTheme: Theme = 'dark';
      if (browser) {
        localStorage.setItem(THEME_STORAGE_KEY, newTheme);
        applyTheme('dark');
      }
      set(newTheme);
    },

    // Set to auto (follow system)
    setAuto: () => {
      const newTheme: Theme = 'auto';
      if (browser) {
        localStorage.setItem(THEME_STORAGE_KEY, newTheme);
        applyTheme(getSystemTheme());
      }
      set(newTheme);
    },

    // Reset to default
    reset: () => {
      if (browser) {
        localStorage.removeItem(THEME_STORAGE_KEY);
        applyTheme(getEffectiveTheme(DEFAULT_THEME));
      }
      set(DEFAULT_THEME);
    },

    // Get effective theme (resolves 'auto')
    getEffective: (): 'light' | 'dark' => {
      return getEffectiveTheme(getInitialTheme());
    }
  };
}

// Export the store
export const themeStore = createThemeStore();
