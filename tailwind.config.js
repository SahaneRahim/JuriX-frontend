import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{html,js,svelte,ts}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Blue-600 et non Blue-500. #3B82F6 donnait 3,68:1 — sous le seuil AA de
        // 4,5 — DANS LES DEUX SENS : en texte sur fond blanc, et en texte blanc
        // sur bouton bleu. Un seul jeton corrigeait les deux (5,17:1).
        primary: "#2563EB",
        "background-light": "#f8f9fa", // Light gray from reference
        "background-dark": "#0a1628", // Matches reference background
        "card-light": "#fafafa", // Slightly off-white for cards
        "card-dark": "#1a2942", // Slightly lighter for cards (matches gradient end from reference)
        "text-light": "#1a1a1a", // Dark gray/black from reference
        "text-dark": "#F1F5F9",
        "secondary-text-light": "#6b7280", // Gray-500 from reference
        "secondary-text-dark": "#94A3B8",
      },
      fontFamily: {
        display: ["Inter", "sans-serif"],
        body: ["Inter", "sans-serif"],
      },
      boxShadow: {
        'soft': '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.02)',
        'card': '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025)',
      }
    },
  },
  plugins: [
    forms,
    typography,
  ],
};
