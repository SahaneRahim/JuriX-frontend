# JuriX — interface

SvelteKit 2 (syntaxe Svelte 4 sur moteur Svelte 5), TypeScript strict, Tailwind,
site statique (adapter-static). L'interface d'une plateforme de recherche dans le droit
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

## Construire pour la production

Le front est un **site statique** : aucune page n'a de code serveur, tout passe
par l'API. `npm run build` rend le dossier `build/`, que n'importe quel serveur
web sert tel quel, à une condition : renvoyer `index.html` pour toute route
inconnue, sans quoi un lien profond (`/laws/123`) répond 404.

```bash
VITE_API_URL=https://jurix.exemple.cm npm run build     # dossier build/
```

`VITE_API_URL` est **figée au build**. En production, le front et l'API sont
servis sous le même domaine, par la même VM (voir `deploiement/oracle` dans le
dépôt backend) : l'API répond sous `/api/v1`, d'où une seule URL, et aucun
CORS.

## Vérifier

```bash
npm test                # 166 tests unitaires (vitest)
npm run test:e2e        # 168 tests de bout en bout (playwright)
npm run check           # types (svelte-check) — doit rendre 0 erreur
npm run lint            # eslint
npm run build           # build de production
```

`npm run test:e2e` construit le site et le sert sur le port 4173. Il ne réutilise
jamais un serveur déjà lancé : un serveur de développement sur du code ancien
ferait passer les tests sur autre chose que ce qu'on croit mesurer. Le port 4173
doit donc être libre ; le développement, sur 5173, peut tourner en même temps.

Chaque test e2e part d'un navigateur où le profil **citoyen** est déjà choisi
(`storageState` dans `playwright.config.ts`) : sans cette graine, la question du
profil masquerait chaque page. Un fichier qui doit partir d'un navigateur vide
le déclare, comme `persona.spec.ts` :
`test.use({ storageState: { cookies: [], origins: [] } })`.

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

Le profil a son propre fichier, `persona.spec.ts` : question posée à la première
visite et jamais sur les routes exclues, choix et refus mémorisés, changement en
pleine conversation, synchronisation avec le compte, et corps exact des
requêtes du chat.

## Le profil

Le chat répond selon un profil : **citoyen**, **étudiant**, **avocat** ou
**entrepreneur**. Le profil change le registre et le niveau de détail de la
réponse, et les questions suggérées à l'accueil du chat. Sans profil, le chat
répond en **profil général**, et la requête omet le champ `persona`.

- **La question** est posée à la première visite, dans une fenêtre centrée, sur
  n'importe quelle page d'entrée, un lien profond compris. Elle ne l'est jamais
  sur `/login`, `/signup`, `/forgot-password`, `/reset-password/*`,
  `/verify-email/*`, `/admin*`, sur une page d'erreur, ni pour un robot
  d'indexation (reconnu à son user agent).
- **« Ne pas répondre »**, ou Échap, donne le profil général pour la visite. Le
  refus est gardé dans un cookie de session, `jurix-persona-refus`, que les
  onglets partagent : la question revient à la visite suivante. Il n'est jamais
  envoyé au compte.
- **Le choix** est gardé dans le navigateur (`jurix-persona`, localStorage) et,
  pour un utilisateur connecté, sur son compte (`PATCH /auth/me`), qui le suit
  d'un appareil à l'autre :
  - à la connexion, le profil du compte l'emporte ; un compte sans profil ne
    reçoit pas le choix fait avant la connexion, et la question reviendra à la
    visite suivante ;
  - au démarrage, un envoi resté en attente (`jurix-persona-a-envoyer`) est
    renvoyé ; sinon le compte fait foi, absence de profil comprise ;
  - la déconnexion efface le profil du navigateur : sur un appareil partagé, la
    profession est une donnée personnelle.

  Cette synchronisation appelle `fetch`, pas `apiFetch` : en arrière-plan, elle
  ne doit ni déconnecter ni rediriger qui que ce soit.
- **Changer de profil** se fait depuis l'en-tête et depuis le chat
  (« Changer »). Une conversation garde un seul profil : en changer ouvre une
  nouvelle conversation, et une conversation rouverte continue avec le sien.
- **Les suggestions** (`src/lib/suggestions.ts`) existent pour chaque profil et
  chaque langue. Chacune a été vérifiée contre le corpus avec
  `scripts/eval/comparer_mistral.py --dry-run --questions-libres` (dépôt
  backend), qui interroge la recherche sans appeler le modèle de langue. Une
  suggestion sans extrait pertinent a été remplacée : le corpus n'a ni Code du
  travail ni Actes uniformes OHADA.
- **Le tableau de bord** d'administration compte les conversations par profil.
  La ligne « Profil général » regroupe les refus de la question et le choix
  explicite de ce profil.

## Organisation

```
src/lib/
  api.ts             API_URL, apiFetch (injecte le jeton, gère le 401), WebSocket
  nav.ts             manifeste de navigation, source des liens ET des tests
  format.ts          dates — une seule implémentation, il y en avait huit
  pagination.ts      pagination — une seule règle, il y en avait quatre
  seo.ts             titres, descriptions, URL canoniques
  highlight.ts       rendu du surlignage <mark> venu de ts_headline
  suggestions.ts     questions suggérées par le chat, par profil et par langue
  persona-compte.ts  le profil et le compte (GET et PATCH /auth/me)
  chat-session.ts    conversation en cours, et son profil
  stores/            language (i18n), auth, theme, persona
  actions/           piegerFocus : le focus clavier des fenêtres modales
  components/        SearchBar, SearchResultCard, StatusBadge, ImagePdfViewer,
                     ChoixPersona (la question du profil), admin/
src/routes/
  (main)/         accueil et assistant conversationnel
  laws/           liste et lecture des documents, explication d'un article par l'IA
  categories/[id] documents d'un domaine juridique
  search/         résultats de recherche, titres puis mentions dans le texte
  signup/         création de compte (nom, adresse, mot de passe, ou Google)
  compare/        comparaison de deux régimes, grille sourcée cellule par cellule
  admin/          tableau de bord, documents, import en masse, comptes
tests/e2e/        playwright : navigation, accessibilité, backend indisponible,
                  inscription, conversations enregistrées,
                  explication d'article, comparaison (appel Gemini intercepté)
```

## Conventions

L'internationalisation passe par `$lib/stores/language` : `$tr("cle")` dans le
balisage, `t("cle")` dans le script. Les deux blocs de langue doivent porter
exactement les mêmes clés — un test le vérifie et échoue sinon.

Les appels vers une route protégée passent par `apiFetch`, qui pose le jeton et
traite le 401 en un seul endroit. `apiFetch` **ne lève pas** sur une réponse
4xx : c'est délibéré, et cela oblige chaque appelant à vérifier `response.ok`.
