# JuriX — interface

SvelteKit 2 (syntaxe Svelte 4 sur moteur Svelte 5), TypeScript strict, Tailwind,
déploiement Vercel. L'interface d'une plateforme de recherche dans le droit
camerounais : recherche plein texte et sémantique, lecture de documents,
assistant conversationnel, administration du corpus.

## Démarrer

```bash
npm install
cp .env.example .env          # VITE_API_URL pointe le backend
npm run dev                   # http://localhost:5173
```

Le port **5173 n'est pas négociable** en développement : `app/main.py` du backend
l'inscrit en dur dans les origines CORS autorisées. Sur un autre port, chaque
appel réseau échoue sans message utile.

Le backend doit tourner en parallèle — voir le README de `JuriX-backend-main`.
Sans lui, l'interface s'affiche et annonce l'indisponibilité plutôt que de
présenter des listes vides comme des résultats ; trois tests e2e vérifient
précisément ce comportement.

## Vérifier

```bash
npm test                # 52 tests unitaires (vitest)
npm run test:e2e        # 58 tests de bout en bout (playwright)
npm run check           # types (svelte-check) — doit rendre 0 erreur
npm run lint            # eslint
npm run build           # build de production
```

`npm run test:e2e` démarre son propre serveur de développement s'il n'y en a pas
déjà un, et réutilise celui qui tourne le cas échéant.

## Ce que couvrent les tests

Les tests unitaires portent sur ce qui se casse en silence : la pagination
(`nombreDePages(0, 15)` doit rendre 1, sinon « Suivant » reste actif sur une
liste vide), le formatage des dates (une date illisible rend un tiret, jamais
`Invalid Date`), les métadonnées SEO (la troncature ne dépasse jamais la limite
demandée et coupe sur un mot entier), et la parité exacte des clés de traduction
entre le français et l'anglais.

Les tests de bout en bout couvrent l'intégrité des liens — chaque `href` du site
mène à une route existante, vérifié contre `src/lib/nav.ts` —, les codes 404 sur
identifiant absent ou non numérique, le contenu rendu par le serveur, la
politique `noindex`, l'accessibilité au clavier et au lecteur d'écran
(balayage axe-core), et la dégradation quand le backend est injoignable.

## Organisation

```
src/lib/
  api.ts          API_URL, apiFetch (injecte le jeton, gère le 401), WebSocket
  nav.ts          manifeste de navigation, source des liens ET des tests
  format.ts       dates — une seule implémentation, il y en avait huit
  pagination.ts   pagination — une seule règle, il y en avait quatre
  seo.ts          titres, descriptions, URL canoniques
  highlight.ts    rendu du surlignage <mark> venu de ts_headline
  stores/         language (i18n), auth, theme
  components/     SearchBar, SearchResultCard, StatusBadge, ImagePdfViewer, admin/
src/routes/
  (main)/         accueil et assistant conversationnel
  laws/           liste et lecture des documents
  categories/[id] documents d'un domaine juridique
  search/         résultats de recherche, titres puis mentions dans le texte
  admin/          tableau de bord, documents, import en masse, comptes
tests/e2e/        playwright : navigation, accessibilité, backend indisponible
```

## Conventions

L'internationalisation passe par `$lib/stores/language` : `$tr("cle")` dans le
balisage, `t("cle")` dans le script. Les deux blocs de langue doivent porter
exactement les mêmes clés — un test le vérifie et échoue sinon.

Les appels vers une route protégée passent par `apiFetch`, qui pose le jeton et
traite le 401 en un seul endroit. `apiFetch` **ne lève pas** sur une réponse
4xx : c'est délibéré, et cela oblige chaque appelant à vérifier `response.ok`.
