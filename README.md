# JuriX — interface

SvelteKit 2 (syntaxe Svelte 4 sur moteur Svelte 5), TypeScript strict, Tailwind,
rendu serveur (adapter-node). L'interface d'une plateforme de recherche dans le droit
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

Les pages sont **rendues par le serveur** (adapter-node) : le HTML d'une fiche,
d'une liste ou d'une catégorie arrive complet, lisible par un moteur qui
n'exécute pas le JavaScript. Seuls `/admin` et `/chat` restent rendus dans le
navigateur (`ssr = false`), en `noindex`.

```bash
VITE_API_URL=https://jurix.exemple.cm npm run build     # dossier build/
ORIGIN=https://jurix.exemple.cm API_INTERNE=http://api:8000 node build
```

`VITE_API_URL` est **figée au build**. En production, le front et l'API sont
servis sous le même domaine, par la même VM (voir `deploiement/oracle` dans le
dépôt backend) : l'API répond sous `/api/v1`, d'où une seule URL, et aucun
CORS.

Le serveur lit ses autres réglages **au démarrage** (voir `.env.example`) :

- `ORIGIN` : l'origine publique, la même que celle de `VITE_API_URL`. Elle fixe
  l'adresse des URL canoniques et celle à laquelle les `load` comparent l'API.
  Sans elle, le serveur la déduit de l'en-tête `Host` reçu : une autre adresse
  (alias www, IP de la VM) ferait prendre l'API pour une autre origine, et les
  pages tomberaient en 503.
- `API_INTERNE` : l'adresse de l'API sur le réseau du serveur. Le rendu y envoie
  ses appels au lieu de ressortir par l'adresse publique
  (`src/hooks.server.ts`). Jamais dans le `.env` de développement.
- `PORT` et `HOST` : 3000 et 0.0.0.0 par défaut.

À l'exécution, seuls `build/` et `package.json` servent : les dépendances sont
intégrées au build.

Quand l'API ne répond pas (ou au-delà de 8 s), l'accueil, une fiche, `/laws` et
une catégorie répondent **503** au rendu serveur : c'est le signal d'une panne
passagère pour un moteur, là où une page 200 « Impossible de charger » serait
indexée telle quelle. La cause est écrite dans le journal du serveur
(`[503] /laws : API indisponible (…)`). En navigation dans le navigateur, ces
pages gardent leur message et leur bouton de reprise.

## Vérifier

```bash
npm test                # 315 tests unitaires (vitest)
npm run test:e2e        # 191 tests de bout en bout (playwright)
npm run check           # types (svelte-check) — doit rendre 0 erreur
npm run lint            # eslint
npm run build           # build de production
```

`npm run test:e2e` construit le site et le sert (`node build`) sur le port 4173. Il ne réutilise
jamais un serveur déjà lancé : un serveur de développement sur du code ancien
ferait passer les tests sur autre chose que ce qu'on croit mesurer. Le port 4173
doit donc être libre ; le développement, sur 5173, peut tourner en même temps.
Le même build est servi une seconde fois sur 4174, avec une API injoignable
(`API_INTERNE` vers un nom qui ne se résout pas) : `panne-api.spec.ts` y vérifie les 503 du
rendu serveur, que `page.route` ne peut pas provoquer.

Sans backend, les tests qui demandent l'API ou ses données sont sautés. Avant un
commit, lancer la suite backend allumé, avec `E2E_EXIGER_BACKEND=1` : un test
sauté devient alors un échec, et une suite verte prouve vraiment le rendu
serveur.

```bash
E2E_EXIGER_BACKEND=1 npm run test:e2e
```

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
  config.ts          API_URL, WS_URL : les adresses de l'API, sans effet de bord
  api.ts             apiFetch (injecte le jeton, gère le 401), WebSocket
  identifiant.ts     identifiants lus dans les URL (/laws/<id>, /categories/<id>)
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
src/hooks.server.ts  rendu serveur : noindex des pages privées, appels de
                     l'API par le réseau interne, journal des erreurs sans jeton
src/error.html       page de dernier recours, sans JavaScript
src/routes/
  (main)/         accueil et assistant conversationnel
  laws/           liste et lecture des documents, explication d'un article par l'IA
  categories/[id] documents d'un domaine juridique
  search/         résultats de recherche, titres puis mentions dans le texte
  signup/         création de compte (nom, adresse, mot de passe, ou Google)
  compare/        comparaison de deux régimes, grille sourcée cellule par cellule
  admin/          tableau de bord, documents, import en masse, comptes
  robots.txt/     robots.txt, en texte (et non la page de l'application)
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
