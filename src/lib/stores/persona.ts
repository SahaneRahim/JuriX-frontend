import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';
import { browser } from '$app/environment';

// Persona type
export type Persona = 'lawyer' | 'entrepreneur' | 'citizen' | 'student' | null;

// Storage key
const PERSONA_STORAGE_KEY = 'jurix-persona';

// Get initial persona from localStorage or default
function getInitialPersona(): Persona {
  if (browser) {
    const stored = localStorage.getItem(PERSONA_STORAGE_KEY);
    if (stored === 'lawyer' || stored === 'entrepreneur' || stored === 'citizen' || stored === 'student') {
      return stored;
    }
    if (stored === 'null') {
      return null;
    }
  }
  return null;
}

// Create the persona store
function createPersonaStore() {
  const { subscribe, set } = writable<Persona>(getInitialPersona());

  return {
    subscribe,

    // Set persona
    setPersona: (persona: Persona) => {
      if (browser) {
        if (persona === null) {
          localStorage.setItem(PERSONA_STORAGE_KEY, 'null');
        } else {
          localStorage.setItem(PERSONA_STORAGE_KEY, persona);
        }
      }
      set(persona);
    },

    // Clear persona (set to null)
    clearPersona: () => {
      if (browser) {
        localStorage.removeItem(PERSONA_STORAGE_KEY);
      }
      set(null);
    },

    // Reset to default
    reset: () => {
      if (browser) {
        localStorage.removeItem(PERSONA_STORAGE_KEY);
      }
      set(null);
    }
  };
}

// Export the store
export const personaStore = createPersonaStore();

// Persona display names
export const personaNames = {
  lawyer: {
    fr: 'Avocat / Juriste',
    en: 'Lawyer / Legal Professional'
  },
  entrepreneur: {
    fr: 'Entrepreneur',
    en: 'Entrepreneur'
  },
  citizen: {
    fr: 'Citoyen',
    en: 'Citizen'
  },
  student: {
    fr: 'Étudiant',
    en: 'Student'
  }
} as const;

// Helper to get persona display name
export function getPersonaName(persona: Persona, lang: 'fr' | 'en' = 'fr'): string {
  if (persona === null) {
    return lang === 'fr' ? 'Non sélectionné' : 'Not selected';
  }
  return personaNames[persona][lang];
}
