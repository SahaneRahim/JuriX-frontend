import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';
import defaultTheme from 'tailwindcss/defaultTheme';
import plugin from 'tailwindcss/plugin';

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{html,js,svelte,ts}"],
  darkMode: 'class',
  // Les effets `hover:` ne s'appliquent qu'aux appareils qui survolent
  // vraiment (souris, pave tactile). Sur un ecran tactile, un appui laissait la
  // carte soulevee ou le bouton agrandi jusqu'au prochain appui ailleurs.
  future: {
    hoverOnlyWhenSupported: true,
  },
  theme: {
    extend: {
      colors: {
        // Site en noir et blanc, sur l'échelle ZINC de Tailwind et elle seule :
        // pas de slate, gray, neutral ni stone, aucune teinte. Seule exception,
        // le rouge des erreurs et des actions destructrices. Recettes de classes
        // et règles de contraste : guide de la conversion (data/ui-mono/guide.md
        // dans le dépôt du backend).
        //
        // `primary` vaut zinc-900 et non plus le bleu d'avant : il SE CONFOND
        // avec les fonds sombres (1,1:1 sur background-dark). Jamais seul en
        // texte ou en anneau : toujours avec sa variante `dark:` (blanc).
        primary: "#18181B", // zinc-900
        "background-light": "#FAFAFA", // zinc-50 : fond des pages, theme-color (app.html)
        "background-dark": "#09090B", // zinc-950 : fond des pages en sombre
        "card-light": "#FFFFFF", // cartes, panneaux, fenêtres
        "card-dark": "#121215", // entre zinc-950 et zinc-900 : la carte se détache du fond
        "text-light": "#09090B", // zinc-950 : 19:1 sur le fond clair
        "text-dark": "#F4F4F5", // zinc-100 : 18:1 sur le fond sombre
        // Texte secondaire. zinc-500 : 4,8:1 sur blanc, 4,6:1 sur le fond clair,
        // mais 4,4:1 seulement sur zinc-100, sous le seuil AA : sur une surface
        // zinc-100 ou plus foncée, prendre zinc-600.
        "secondary-text-light": "#71717A", // zinc-500
        // zinc-400 : 7,8:1 sur le fond sombre. zinc-500 n'y fait que 4,1:1.
        "secondary-text-dark": "#A1A1AA", // zinc-400
      },
      fontFamily: {
        // « Inter Variable » : la police auto-hebergee (@fontsource-variable/inter).
        // `sans` est la police du <html> (preflight) et de la classe font-sans :
        // toutes les pages sont en Inter, y compris celles qui ne posent ni
        // font-body ni font-display (fiches, connexion, fenetre des profils).
        sans: ["Inter Variable", ...defaultTheme.fontFamily.sans],
        display: ["Inter Variable", "Inter", "sans-serif"],
        body: ["Inter Variable", "Inter", "sans-serif"],
        // « Geist Mono Variable » : la chasse fixe auto-hebergee
        // (@fontsource-variable/geist-mono, src/app.css). Sans elle, font-mono
        // (et code, kbd, pre, que le preflight met en `mono`) prenait celle du
        // systeme, qui change d'un poste a l'autre. Les polices de Tailwind
        // restent en repli, pour un caractere hors du latin (⌘ des touches).
        mono: ["Geist Mono Variable", ...defaultTheme.fontFamily.mono],
        // Literata, la serif de la refonte (Q5 A), auto-hebergee (src/app.css).
        // Deux voix au plus sur une page : Inter partout, la serif pour les
        // seuls titres d'affichage et le texte officiel. La chasse fixe ne
        // garde que les codes courts (« Ctrl K ») : surtitres, dates et
        // compteurs passent en Inter.
        //
        // `font-titre` : instance figee en taille optique 72, graisse 600, pour
        // le h1 de l'accueil et des pages, le titre officiel d'un texte et
        // « Article N ». Avec `font-semibold` (la graisse du fichier) et sans
        // `tracking-tight` : interlettrage nul, le dessin d'affichage est deja
        // serre. Interligne de 1,15 a 1,25, `text-balance`.
        //
        // `font-texte` : taille optique 16, graisse 400, pour le corps des
        // articles, les apercus de citation et les extraits cites mot pour
        // mot. Jamais pour ce que l'IA redige, qui reste en Inter.
        //
        // Chaque famille est suivie de ses replis ajustes (Noto Serif, puis
        // Georgia ; @font-face de src/app.css), puis de la pile serif de
        // Tailwind pour un poste qui n'aurait ni l'une ni l'autre.
        titre: ["Literata Titre", "Literata Titre repli Noto", "Literata Titre repli Georgia", ...defaultTheme.fontFamily.serif],
        texte: ["Literata Texte", "Literata Texte repli Noto", "Literata Texte repli Georgia", ...defaultTheme.fontFamily.serif],
      },
      boxShadow: {
        'soft': '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.02)',
        'card': '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025)',
      }
    },
  },
  plugins: [
    // Styles des champs posés sur les ÉLÉMENTS seulement (stratégie `base`),
    // repris en noir et blanc dans src/app.css. Les classes `form-checkbox`,
    // `form-input`… (stratégie `class`) pesaient plus lourd que ces reprises :
    // leur bleu revenait, et en mode sombre une case cochée blanche gardait sa
    // coche blanche, invisible. Sans elles, ces classes ne font plus rien.
    forms({ strategy: 'base' }),
    typography,
    // Variante `court:` : ecran court, telephone en paysage (environ 360 px de
    // haut). Elle reduit les marges verticales la ou chaque ligne compte, sans
    // toucher aux tablettes ni aux ordinateurs.
    // Variante et non entree de `theme.screens` : un ecran `raw` desactive en
    // silence toutes les variantes `max-*` et `min-*` de Tailwind (« not
    // supported with a screens configuration containing objects »).
    // `:root &` : une variante de plugin est ecrite AVANT sm:/md:/lg:, et un
    // telephone en paysage depasse 640 px de large ; sans ce gain de
    // specificite, `court:py-1` perdait toujours contre `sm:py-6`. Avec lui, la
    // regle de l'ecran court l'emporte quel que soit l'ordre d'ecriture.
    plugin(({ addVariant }) => {
      addVariant('court', '@media (max-height: 500px) { :root & }');
    }),
  ],
};
