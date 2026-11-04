# A6 — Icônes : ce que la refonte emploie, ce qui manque au registre

Règle du dépôt (`src/lib/icones.ts`, `README.md`) : **toute icône passe par `<Icone nom="…" />`**, des SVG Lucide gardés dans `src/lib/icones.ts` ; ni police d'icônes, ni SVG copié à la main, ni émoji. `src/lib/icones.test.ts` relit les noms employés dans `src` et **échoue** sur un nom absent du registre comme sur une entrée que plus rien n'affiche. Ajouter une entrée = prendre le nom CANONIQUE Lucide (paquet `lucide-static@1.62.0`, procédure dans l'en-tête de `icones.ts`), copier à l'identique les éléments entre `<svg>` et `</svg>`, les classer par ordre alphabétique.

Les maquettes dessinent les icônes en SVG « en ligne » (le moteur des maquettes n'a pas de registre). Chaque icône ci-dessous a été comparée **tracé par tracé** au registre du dépôt (89 entrées au moment de l'analyse).

## 1. Déjà au registre (39 icônes employées par les maquettes)

Utiliser `<Icone nom="…" />` tel quel. Épaisseur de trait : celle de `Icone` (1,75 par défaut), pas le 2 des maquettes (l'écart est voulu : « plus fin, accordé au style noir et blanc du site »).

| Nom Lucide | Où dans les maquettes |
|---|---|
| `scale` | domaine « Civil et procédure civile » (tuile), profil « Avocat ou juriste » ; **et base du logo animé** (voir § 3) |
| `user-round` | profil « Citoyen », chip de profil du chat |
| `graduation-cap` | profil « Étudiant en droit », domaine « Éducation, culture et médias » |
| `briefcase-business` | profil « Entrepreneur », domaine « Affaires, banque et OHADA » |
| `user-round-group` | domaine « Famille et état civil » |
| `hard-hat`, `gavel`, `land-plot`, `coins`, `landmark`, `stamp`, `id-card-lanyard`, `globe`, `heart-pulse`, `leaf` | les autres domaines de l'accueil (déjà ceux de `src/lib/categories.ts` / `CategoryIcon.svelte`) |
| `files` | « textes officiels » (surtitre), tuile « Tous les textes » |
| `search` | mode « Recherche », loupe |
| `sparkles` | « Assistant IA » (onglet mobile du bas), note « Explication simplifiée (IA) » de la lecture |
| `arrow-up` | bouton d'envoi |
| `arrow-right`, `arrow-left` | « Précédent / Suivant » (lecture), passerelles |
| `chevron-up`, `chevron-down`, `chevron-right` | cartes repliables, barre « Articles cités », fil d'Ariane |
| `plus` | « Nouvelle conversation » |
| `x` | fermer |
| `menu` | burger |
| `moon`, `sun` | bascule du thème |
| `house` | onglet mobile « Accueil » |
| `table-of-contents` | onglet mobile « Parcourir » |
| `circle-dashed` | statut « Version d'origine, non consolidée » |
| `rotate-ccw-clock` | statut « Modifié » |
| `archive` | statut « Abrogé » |
| `section` | puce d'article dans un résultat de recherche (§) |
| `copy`, `check`, `link`, `external-link` | « Copier la référence », « Référence copiée », « Copier le lien », « Lire dans le texte intégral » |

## 2. À AJOUTER au registre (4 icônes)

Tracés à copier depuis `lucide-static@1.62.0` (les `d` ci-dessous sont ceux des maquettes, identiques à Lucide) :

| Nom canonique | Éléments | Où |
|---|---|---|
| `sparkle` | `<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" />` (UNE étoile ; `sparkles` en a plusieurs) | mode « Assistant IA » du champ unique (accueil bureau et mobile, résultats), passerelle « Poser « {q} » à l'assistant IA » (résultats) ; le bouton d'envoi de l'assistant porte `arrow-up`, pas `sparkle` |
| `arrow-up-right` | `<path d="M7 7h10v10" /><path d="M7 17 17 7" />` | questions fréquentes, tuiles de domaines (flèche qui part en diagonale au survol) |
| `rotate-ccw` | `<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />` | « Régénérer » (explication IA, page de lecture). Attention : `rotate-ccw-clock` (avec les aiguilles) existe déjà et sert au statut « Modifié » |
| `message-circle` | `<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />` | « Poser une question sur cet article » (note IA de la lecture) |

Le tracé de `sparkle` ci-dessus est le PREMIER élément de l'entrée `sparkles` du registre. **Lucide fait foi** : copier `icons/sparkle.svg` du paquet ; s'il diffère légèrement, garder celui du paquet.

Si une maquette emploie `sparkles` là où le tableau dit `sparkle`, c'est un détail de dessin : la règle est « une étoile pour l'IA dans un bouton compact, `sparkles` pour l'en-tête de la note IA ». Ne pas ajouter plus que nécessaire : « une icône sans usage alourdit le JavaScript de chaque page ».

Retirer une entrée de `icones.ts` **dans l'étape qui supprime son dernier emploi** (le test `icones.test.ts` échoue sinon : on ne peut pas tout nettoyer en fin de parcours) ; vérifier par `grep` avant de retirer. Les candidats habituels sont **encore employés ailleurs et ne se retirent pas** : `loader-circle` (palette de commandes, `SearchBar`, `ImagePdfViewer`, `StatusBadge`, modales d'administration, `laws/[id]`…), `bot` (`ChatFab`, palette, `QuestionDuProfil`, blog, à propos, administration), `send-horizontal` (chat, administration du blog), `zoom-in` / `zoom-out` (`ImagePdfViewer`). Vérifier avec `npm test -- --run icones` à chaque étape. `sparkle` sert à E3b (mode « Assistant IA » du champ unique), E4b (bascule du champ compact), E4c (passerelle) et E5 (bouton « Expliquer l'article », étoile seule) : la première de ces étapes à l'afficher l'ajoute au registre.

## 3. La balance animée n'est PAS une icône du registre

Le logo et l'indicateur d'attente de l'IA sont l'icône `scale` **dont les tracés sont regroupés** pour que le fléau pivote et que les plateaux contre-pivotent (voir `A2-mouvement.md` § 3.1). `<Icone>` rend une icône plate ; il faut un composant dédié, `BalanceAnimee.svelte` (le nom retenu pour toute la refonte ; les rapports `cartes/` disent aussi `Balance`, `LogoBalance`, `GreementBalance` : un seul composant), propriétés `etat: 'repos' | 'intro' | 'attente'`, `class`.

Sans réécrire de SVG à la main : `elementsIcone('scale')` (exporté par `src/lib/icones.ts`) renvoie les 5 éléments dans cet ordre, à répartir dans les groupes :

| Index | Élément | Rôle |
|---|---|---|
| 0 | `M12 3v18` | mât (fixe) |
| 1 | `m19 8 3 8a5 5 0 0 1-6 0zV7` | plateau droit → `<g class="mv-balance__plateau-d">` dans le fléau |
| 2 | `M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1` | fléau → racine de `<g class="mv-balance__fleau">` |
| 3 | `m5 8 3 8a5 5 0 0 1-6 0zV7` | plateau gauche → `<g class="mv-balance__plateau-g">` dans le fléau |
| 4 | `M7 21h10` | base (fixe) |

(Vérifier l'ordre dans `src/lib/icones.ts` : si le registre change de version, l'ordre peut changer.) Structure, noms de classes et CSS : `A2-mouvement.md` § 3.1 (contrat `mv-balance…`). Le composant est décoratif (`aria-hidden`, jamais de `role`) ; l'état d'attente est dit par un texte.

## 4. Où sont les icônes de domaines

`src/lib/categories.ts` et `src/lib/components/CategoryIcon.svelte` portent déjà les 14 icônes de domaines (celles des tuiles de l'accueil). **Réutiliser, ne pas recopier** : la maquette a été dessinée d'après elles.
