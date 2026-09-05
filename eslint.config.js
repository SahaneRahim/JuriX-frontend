// Configuration ESLint du projet.
//
// Il n'en existait aucune : `package.json` déclarait `"lint": "eslint ."`, qui
// échouait sur « ESLint couldn't find a configuration file ». Le lint n'a donc
// jamais tourné. ESLint 8 était par ailleurs installé SANS `eslint-plugin-svelte`
// ni `svelte-eslint-parser` : même avec un fichier de config, aucun `.svelte`
// n'aurait été analysable.
//
// Le jeu de règles démarre volontairement sur `svelte/recommended` seul.
// Activer d'emblée les règles d'accessibilité du plugin produirait plusieurs
// centaines d'erreurs sur du code qui fonctionne, ce qui rendrait le lint
// inutilisable — donc ignoré, donc inutile. L'accessibilité se traite page par
// page dans une étape dédiée ; les règles seront activées à ce moment-là, quand
// les corriger sera le travail en cours et non un mur à contourner.

import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

export default ts.config(
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: {
        // Nécessaire pour que le parseur Svelte comprenne les alias ($lib, $app)
        // et les options de compilation du projet.
        projectService: true,
        extraFileExtensions: ['.svelte'],
        parser: ts.parser,
        svelteConfig,
      },
    },
  },
  {
    rules: {
      // Le code utilise `any` à 29 endroits, faute de types métier partagés.
      // Les signaler aujourd'hui noierait tout le reste ; ils disparaîtront
      // avec le module de types, en fin de chantier.
      '@typescript-eslint/no-explicit-any': 'off',

      // 45 occurrences. La règle impose le `resolve()` de SvelteKit sur chaque
      // lien interne, ce qui suppose d'adopter les routes typées : c'est un
      // chantier à part entière, pas un ajustement. Laissée éteinte tant que
      // cette décision n'est pas prise, plutôt que désactivée ligne à ligne.
      'svelte/no-navigation-without-resolve': 'off',

      // 32 occurrences, toutes légitimes : sans clé, Svelte réutilise les nœuds
      // par position et peut mélanger l'état entre éléments. À corriger, mais
      // en avertissement pour que le lint reste exploitable d'ici là.
      'svelte/require-each-key': 'warn',

      // 6 occurrences, toutes dans le même bloc réactif de
      // src/routes/categories/[id]/+page.svelte. L'analyse est conservatrice :
      // elle signale qu'une fonction appelée depuis un bloc `$:` écrit dans
      // `error` et `isLoading`. Ces variables ne figurent PAS parmi les
      // dépendances du bloc (isValidId, categoryId, selectedLanguage), donc la
      // boucle n'existe pas. Avertissement, pour ne pas masquer un vrai cas
      // ailleurs.
      'svelte/infinite-reactive-loop': 'warn',

      // Les deux occurrences signalées construisent une chaîne de requête
      // locale (`new URLSearchParams()` passé aussitôt à `fetch`), pas un état
      // réactif. La règle vise les instances mutables conservées dans le
      // composant ; ce n'est pas le cas ici.
      'svelte/prefer-svelte-reactivity': 'off',

      // `svelte/no-at-html-tags` reste une ERREUR, volontairement : les deux
      // occurrences vivantes injectent du HTML d'API non échappé dans une page
      // publique, et le jeton d'authentification est en clair dans
      // localStorage. C'est le seul point du lint qu'on ne négocie pas.

      // Les gestionnaires `catch (e)` qui ignorent volontairement l'erreur sont
      // fréquents et parfois justifiés ; le préfixe `_` reste la convention
      // pour l'annoncer.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },
  {
    ignores: [
      'build/',
      '.svelte-kit/',
      '.vercel/',
      'dist/',
      'node_modules/',
      'package-lock.json',
    ],
  },
);
