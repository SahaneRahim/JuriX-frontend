# Lecture d'un texte de loi (`/laws/[id]`)

> **Note d'intégration (lire avant ce rapport).** (0) Les « E1…E26 » du § 4 numérotent les écarts de ce rapport, pas les étapes E0…E8 de `PASSATION.md`. Ce rapport est une exploration en lecture seule du dépôt. En cas de désaccord avec `../PASSATION.md` ou `../annexes/`, **ceux-ci l'emportent** : (1) balance = `BalanceAnimee.svelte` ; (2) mouvement : `src/lib/mouvement.css` + classes `mv-*`, `@keyframes` sous `no-preference` (les animations locales décrites ici peuvent rester dans le `<style>` de la page si elles sont propres à la lecture) ; (3) les questions Q1…Q10 sont tranchées par défaut dans `PASSATION.md` § 5.4 (L1…L9) ; (4) le détail « Étape N » ci-dessous est le plan de **E5** de `PASSATION.md` § 6 ; (5) la maquette met le fil d'Ariane et les repères en Geist Mono : **Inter** (décision D1).


Rapport de passation pour l'agent codeur. Cible : `RefonteLecture.dc.html`. Référence de geste : `Mouvement.dc.html` (feuilleter, tamponner, surligner, écrire). `Texte.dc.html` n'est qu'un état intermédiaire « existant animé » : il garde « Copier le lien + Partager » et le bloc IA sous le texte, ce que la cible remplace.

Chemins relatifs à la racine du dépôt `jurix-frontend`. Les inventaires préalables ont été vérifiés : ils sont exacts sur l'ensemble. Corrections notables : le `README.md` annonce 315 tests unitaires et 191 e2e (chiffres non recomptés ici) ; le sommaire est une colonne de 280 px dès `lg` (1024 px) ; la barre Précédent/Suivant du haut et celle du bas existent toutes deux.

---

## 1. Fichiers lus

Dépôt :
- `README.md`, `tests/e2e/README.md`
- `src/routes/laws/[id]/+page.svelte` (2097 lignes, lu en entier), `+page.server.ts`, `page.test.ts` (noms des tests et blocs d'assertions de mise en page lus ; le reste parcouru)
- `src/lib/components/loi/` : `ActionsDeLArticle`, `BasculeDeLecture`, `StatutDuTexte`, `StatutDeLArticle` (début), `ListeDuSommaire`, `LienDePartage` (en entier) ; `TexteEntier` (signatures, props, événements, `data-testid`) ; `NomDuTexteLie`, `HistoriqueDuTexte` (non relus : hors du périmètre visuel) ; `typographie.ts`, `presse-papiers.ts` (en entier) ; `decoupage.ts`, `reference.ts`, `statut.ts` (exports) ; `composants.test.ts` (blocs StatutDuTexte, ActionsDeLArticle)
- `src/lib/components/StatusBadge.svelte` (admin : sans rapport avec la page de lecture), `src/lib/components/listes/StatutEnBref.svelte` (listes seulement), `src/lib/components/ChatFab.svelte`
- `src/lib/icones.ts` (registre), `src/lib/stores/language.ts` (clés `loi.*`), `src/lib/api-publique.ts` (`adresseDeLArticle`), `src/lib/highlight.ts` (début), `tailwind.config.js` (polices, variante `court:`), `src/app.css` (en-têtes de polices)
- `src/routes/(main)/chat/+page.svelte` (lecture de `?q=`), `+page.ts`
- E2E : `tests/e2e/navigation/ux-lecteur.spec.ts`, `explication-article.spec.ts`, `redimensionnement.spec.ts` (test sommaire d'une loi), plus recherche ciblée (`grep`) dans `responsif.spec.ts`, `accessibilite.spec.ts`, `monochrome.spec.ts`, `ux-complements.spec.ts`, `ux-chat.spec.ts`, `chat-rendu.spec.ts`, `ux-r2.spec.ts`, `ux-r3.spec.ts`

Maquettes et captures : `RefonteLecture.dc.html` (en entier), extraits de `Mouvement.dc.html` et `Texte.dc.html`, captures `RefonteLecture-clair.png` et `Texte-clair.png`. Les variantes sombres n'ont pas été ouvertes (les jetons sombres de la maquette sont dans son CSS : `--hl:#52525B`, `--card:#18181B`…).

Non lus (volontairement) : `HistoriqueDuTexte`, `NomDuTexteLie`, `TexteEntier` hors signatures, `decoupage.test.ts`, `statut.test.ts`, `reference.test.ts`.

---

## 2. Fonctionnement actuel

### 2.1 Données et rendu serveur
- `src/routes/laws/[id]/+page.server.ts` : `load` serveur, `GET {API_URL}/laws/{id}`. 404 uniquement si l'API le dit (`absenceConfirmee`), sinon 503 (`leverIndisponible`). Retourne `{ law, statut, erreur: '' }` ; `law.articles` est réduit à `{number, page_number}` ; `statut` est allégé (`par_morceau: {}`).
- `export const config = { isr: { expiration: 3600 } }` : page en cache une heure, **aucun paramètre dans la clé**. Le HTML en cache montre donc toujours le premier article, en lecture article par article. `?article=N` et `#art-N` sont appliqués **après hydratation** par `afterNavigate` (`+page.svelte` l. 1022-1033, puis `appliquerLaNavigation`). `src/tests/cache-isr.test.ts` verrouille cette clé de cache (adresse d'essai `/laws/12?article=5&utm_source=x&lang=en`).
- Le texte est découpé côté page : `decouperLeTexte(law.content)` (`decoupage.ts`) → `decoupe.divisions[]`, `articles[]` (chacun : `rang`, `numero`, `cle`, `occurrence`, `division`, `titre`, `lignes`). Tout est réactif (`$:`) à `data.law`.

### 2.2 État de lecture (`+page.svelte`, script)
- `mode: "article" | "texte"`, `rangCourant`, `rangVisible` (texte entier, suivi au défilement), `onglet: "texte" | "historique"`, `afficherDocument`, `saisieDuFiltre`/`filtre` (150 ms), `tocOuvert`, `grandEcran` (≥ 1024 px, `matchMedia`), `monte`.
- Dérivés : `articleCourant`, `articleAffiche`, `divisionCourante`, `chaineDuFil`, `nomCourt` (`nomCourtDuTexte`), `libelleDate`, `libelleNombre`, `resumeDuTexte`, `classeTitre` (`tailleDuTitre`, trois paliers selon la longueur du titre), `urlArticle`, `referenceArticle`, `referenceACopierIci`, `texteACopierIci`, `partageDuTexte`, `partageDeLArticle`, `lienSignaler`, `pageDuDocument`, `compteur`, `avecBascule`.
- **Attention (Svelte 5 en mode legacy)** : les blocs `$:` s'exécutent dans l'ordre du source (cf. commentaire de `explication-article.spec.ts`, « Regression : le corps de l'article doit etre la… »). Tout nouveau `$:` doit être écrit APRÈS ceux dont il dépend.

### 2.3 Navigation et adresse (P2)
- `ecrireLAdresse("remplacer" | "ajouter", ancre)` : `replaceState` (Précédent/Suivant, bascule de mode) ou `pushState` (saut du sommaire), état `{vue, rang, article, profondeur}`. `?article=` en article par article, ancre `#art-N[-k]` (homonymes) via `ancreDeLArticle`/`lireAncre` (`reference.ts`).
- `navigateToPrevious/Next` → `rangCourant ±= 1`, `ecrireLAdresse("remplacer")`, `allerAuDebutDeLArticle()` (`scrollIntoView` sur `debutArticle`, lissé sauf `prefers-reduced-motion`).
- `choisirDansLeSommaire` (événement `choisir` de `ListeDuSommaire`/`TexteEntier`) ; clavier : focus sur `#titre-article` (`titreDeLArticle`).
- Retour du fil d'Ariane (`revenir`), adoption des entrées `#contenu` du lien d'évitement (`surHashchange`, `adopterLEntree`), `#historique`. Mécaniques fragiles, couvertes par 8 tests de `page.test.ts` et 4 e2e. **À ne pas toucher.**
- Aucune navigation au clavier par flèches gauche/droite : `surTouche` ne gère que Échap (fermeture du sommaire).

### 2.4 Rendu de la page (ordre actuel, de haut en bas)
1. `SiteHeader` (défile hors écran), puis **fil d'Ariane collant** `.breadcrumb` (`sticky top-0 z-40`) : Retour | Documents › domaine › nom court › chaîne de divisions (`data-testid="law-breadcrumb-divisions"`) › `Article N` (`aria-current="location"`) ; bouton « Sommaire » (`law-toc-toggle-texte`) en texte entier sous `lg`.
2. `.layout` (grille `md:grid-cols-[minmax(0,52rem)]`, `lg:grid-cols-[280px_minmax(0,52rem)]`, `md:justify-center`) :
   - **Sommaire** `#sommaire` (`data-testid="law-toc"`), collant `lg:top-24`, 280 px, carte blanche bordée : titre « Table des matières », champ de filtre, `ListeDuSommaire` (toutes les divisions, plage « art. 5 à 10 », intitulés, articles avec premiers mots, barre de 3 px sur l'article lu, marques « · modifié/abrogé/remplacé », `aria-current="location"`). Sous `lg` : le MÊME élément devient une feuille modale (rôle `dialog`, piège de focus `piegerSiOuvert`, verrou de défilement, Échap, fond `fond-sommaire`). Au-delà de 400 articles, la liste n'est pas rendue au serveur (`SEUIL_DU_SOMMAIRE_AU_SERVEUR`).
   - **`<main id="contenu" data-hors-du-bouton>`** : une **carte blanche** (`border rounded-2xl p-4 sm:p-6 md:p-10 shadow-sm`).
3. Dans la carte : en-tête de document (`.document-header`) : badge du type (`classesBadgeDeType`) + date (`law-date`), `h1` Literata (`POLICE_DES_TITRES`, `classeTitre`), ligne « N articles · Ajouté à JuriX le … » (`law-added`), `<StatutDuTexte>` (encadré zinc-100 `law-status`, `data-etat`), puis `.document-actions` : `LienDePartage` « Partager » (`law-share`), « Télécharger » (`BOUTON_PRINCIPAL`, lien `…/download`), « Document original » (`law-toggle-document`, `ImagePdfViewer`).
4. Onglets « Texte | Historique (N) » (`law-tab-texte/historique`, seulement si `nombreHistorique > 0`), puis panneau texte :
   - **Rangée de lecture** : `BasculeDeLecture` (`law-mode-article/texte`) + barre `.article-navigation` (Précédent, compteur ou bouton `law-toc-toggle`, Suivant ; « Suivant » est le DERNIER bouton) ; en texte entier, le résumé « 24 articles · 7 chapitres » remplace la barre.
   - Avis `article-introuvable`.
   - Mode texte : `<TexteEntier>` (`law-full-text`).
   - Mode article : `<article class="article" id="art-N">` : surtitre (chaîne + intitulé de division), `h2#titre-article` « Article N » (+ `er`), `<ActionsDeLArticle>` (3 boutons), `h3` d'intitulé, `<StatutDeLArticle>` (`law-article-status`), corps `.article-content` (Literata Texte, 16/18 px, `max-w-[36em]`, `<p>` par paragraphe via `paragraphesDeLArticle`), puis **bloc `.ai-explanation`** sous le texte ; en dessous, la barre `.article-navigation-bas`.
5. Panneau « Historique » (`HistoriqueDuTexte`).
6. Hors flux : `<ChatFab eviter="[data-hors-du-bouton]" masque={boutonRetenu}>` (lien `/chat`, rond 56/64 px en bas à droite ; se retire quand `#contenu` passe dessous ; `masque` posé pendant les défilements faits par la page) et `<SiteFooter reserverBouton>`.

### 2.5 Statut, actions, explication
- **Statut du texte** : `StatutDuTexte.svelte`, selon `etatDuBloc(statut)` (`statut.ts`) : `inconnu | origine | modifie | consolide | abroge | remplace`. Pour `origine` : icône `circle-dashed`, **gras** « Version d'origine, non consolidée. » (`loi.statut.origine`), « Aucune modification relevée par JuriX au {date}. » (`loi.statut.aucune_modification`), lien « Signaler » (`mailto:` de `lienDeSignalement`). Pour `inconnu` : sans date. Les quatre autres états sont des variantes du même aplat (liste des textes modificatifs, « Déjà intégrés… », etc.).
- **Statut d'article** : `StatutDeLArticle.svelte` (`law-article-status`), encadré sous l'intitulé : changements actuels, antérieurs, portés ; phrase `mentionDuTexteAffiche` ; lien « Voir l'historique » (événement `historique`).
- **Historique** : `HistoriqueDuTexte` dans l'onglet ; ancre `#historique` (`ANCRE_DE_L_HISTORIQUE`).
- **Actions d'article** : `ActionsDeLArticle.svelte`, props `reference`, `texte`, `lien`, `partage`. Trois boutons `law-copy-reference`, `law-copy-text`, `law-copy-link` (sur écran tactile avec `navigator.share` : « Partager le lien »). Copie : `copierDansLePressePapiers` (repli `execCommand`), annonce `role="status" sr-only`, état « copié » 2,5 s, échec `law-copy-error`. Réinitialisé à chaque changement de `reference`. Le README et l'en-tête du composant disent que ces trois boutons sont un **choix du propriétaire (P2)**.
- **Explication IA** (`expliquerArticle`, l. 1063-1109) : `POST {API_URL}/laws/{id}/explain-article` avec `{number, language, excerpt}` (`extraitDeLArticle(articleCourant).slice(0,12000)`), via `fetch` (pas `apiFetch`). Réponse `{explanation: string}`. États : repos (liste « Contenu clé / Implications » + bouton `law-explain`), chargement (`law-explain-loading`, `role="status"`, spinner `loader-circle motion-safe:animate-spin`), erreur (`law-explain-error` rouge, `law-explain-retry` ; 404 → `loi.ia.introuvable`, 429 → `chat.errorQuota`, 503 → `chat.errorOverloaded`, autre → `chat.errorServer`, réseau → `chat.errorNetwork`), réussite (`law-explain-answer`, `aria-live="polite"`, rendu en NŒUDS Svelte par `blocsDeReponse` de `$lib/texte`, jamais `{@html}` ; `law-explain-disclaimer` ; `law-explain-regenerate`). `explicationJeton` écarte une réponse périmée ; `reinitialiserExplication(rangCourant, law?.id)` remet à zéro à chaque article. Le bloc est en **Inter** (jamais Literata : testé par e2e Q5).
- **Pas d'animation de contenu** sur cette page aujourd'hui, hormis : spinner, panneau du sommaire (`monter`, `fondu`, dans `@media (prefers-reduced-motion: no-preference)`) et chevrons.

### 2.6 Lien vers l'assistant
- `ChatFab` : `<a href="/chat" data-testid="chat-fab">`. Aucun lien « Poser une question sur cet article » n'existe sur la page.
- `src/routes/(main)/chat/+page.svelte` lit déjà `?q=` à l'`onMount` (l. 1574) : la question est **pré-remplie, non envoyée** (`chatInput = q`). Le commentaire parle d'une « entrée profonde depuis /laws/[id] » mais plus rien dans `/laws/[id]` ne produit ce lien (la palette `CommandPalette.svelte` l. 238 produit `/chat?q=…`). `(main)/chat/+page.ts` : `ssr = true`, ISR sans expiration, `?q=` « n'atteint pas la fonction ».
- Aucun mécanisme n'envoie un identifiant de texte ou d'article au chat.

---

## 3. Cible : ce que la maquette demande

### 3.1 Structure (bureau 1440 px, `RefonteLecture.dc.html`)
- Conteneur `.main` : `max-width: 1320px`, marge `28px 48px 80px`, **sans carte blanche** (fond de page `--bg` = zinc-50 / zinc-950 en sombre ; seules la note, les boutons d'action et les boutons de navigation sont des cartes blanches `--card`).
- Fil d'Ariane : `Parcourir › domaine › nom court` (le dernier n'est pas un lien, `aria-current="page"`), 12 px, en Geist Mono (`.mono`).
- `h1` : Literata 600, `font-variation-settings "opsz" 72`, `clamp(1.75rem, 3vw + .5rem, 2.5rem)`, interligne 1,18, `max-width 900px`, `text-wrap: balance`. Le titre y est affiché avec espaces insécables : « Loi n° 92/007 du 14 août 1992 portant Code du travail ».
- Ligne de statut sous le titre (`.st0`, 14 px) : **pastille tamponnée** (`.stp` : bordure `1px dashed --bd2`, `border-radius: 999px`, icône `circle-dashed`, texte 13 px gras « Version d'origine, non consolidée » **sans point final**), puis la phrase « Aucune modification relevée par JuriX au 14 oct. 2026. Ce relevé peut être incomplet. », puis le lien souligné « Signaler ». Plus de frise de versions, plus d'aplat zinc-100.
- Séparateur `border-top` à 48 px sous le statut, puis grille `.grid` : `200px minmax(0,1fr)`, écart 48 px, `padding-top 36px`.
- **Sommaire** `.toc` (`position: sticky; top: 24px`) : titre « Table des matières » (13 px gras), lien « Début du texte », surtitre de la division « Section III : De la suspension et de la résiliation du contrat de travail / 4 articles », puis liste de lignes de **40 px** « Art. 35 »… avec un **repère noir de 2 px** (`.tind`) qui glisse (`transform: translateY(index*40px)`, `.5s cubic-bezier(.34,1.3,.5,1)`) et une ligne active fond `--fill`, texte gras. `aria-current` sur la ligne active.
- **Rangée** `.row` : `minmax(0,1fr) 280px`, écart de colonnes 56 px. Colonne de lecture `.read` : surtitre « Section III : … » (13 px), `h2` `.arth` « Article 37 » (Literata 600, **32 px**, interligne 1,2), corps `.body` : **Literata opsz 16, 400, 19 px, interligne 1,8, couleur pleine, `max-width: 34em`**. Marqueur de texte `[Suite de l'article, à reprendre du corpus]` = texte factice de la maquette, à ne pas reproduire.
- Actions `.acts` : « Copier la référence » (icône `copy` → `check` + « Référence copiée ») et « Copier le lien » (icône `link` → `check` + « Lien copié »), 44 px de haut min, bouton carte blanche bordé `--bd2`, rayon 12 px ; 1,9 s puis retour. La pop de l'icône `check` : `pop .45s cubic-bezier(.3,1.6,.5,1)`.
- Mention `.foi` : « Seul le texte publié au Journal officiel fait foi. » (13 px, `--tx3`), **visible** sur la page.
- Navigation `.pn` (bas de colonne, filet au-dessus) : « Précédent » à gauche et « Suivant » à droite, chacun avec la **petite ligne du voisin** (« Article 36 », « Article 38 »), flèche qui glisse de 4 px au survol. Pas de compteur « n / N », pas de barre du haut, pas de bascule de mode, pas d'onglets.
- **Marge `.rail`** (280 px, à droite du texte) : carte `.note` (`border-radius 18px`, ombre `--sheet`, 18 px de marge interne) :
  - titre « Explication simplifiée (IA) » (icône `sparkles`), puis **repos** : description, deux lignes « Contenu clé : … » et « Implications : … » (clés existantes), bouton noir « Expliquer l'article » ;
  - **chargement** : `role="status"`, balance animée (icône `scale` dont le fléau oscille, `bal wt`, boucle 1,5 s) + « Explication en cours… » + 3 lignes de squelette `shimmer` (40 %, 94 %, 72 %) ;
  - **terminé** : deux paragraphes qui arrivent du flou au net (`blurin .8s`, le second décalé de 0,5 s) : « **Contenu clé :** … » et « **Implications :** … », puis l'avertissement « Réponse générée par une IA. Vérifiez-la dans le texte de l'article. » (12 px) et « Régénérer » (icône `rotate-ccw` qui tourne de 360° au survol) ;
  - toujours en bas : lien « Poser une question sur cet article » (icône `message-circle`, 44 px de haut, mène à l'assistant).
- **Trait et point d'ancrage** (≥ 1280 px seulement) : pseudo-éléments de la note : `::before` trait de 1 px × 44 px à `left:-44px; top:28px`, `::after` point de 9 px à `left:-48px; top:24px`. Le **haut de la note** est calé sur le passage surligné (`--pt`), de sorte que le trait tombe au milieu de la première ligne du `<mark class="hl key">` : `pt = max(0, hl.top - row.top + 17 - 28)` (17 = demi-interligne de 34,2 px, 28 = position verticale du trait dans la note). Une fois la réponse affichée (`.note.live`), le trait passe en couleur pleine `--ink`.
- **Surlignage** : deux passages `<mark class="hl">` : un « clé » (`key`, ancre de la note) et un « sous-passage » (`sub`). Style : `background-image: linear-gradient(--hl), linear-gradient(--ink)` : bande de 0,42 em à 92 % de hauteur (`--hl` = zinc-300, zinc-600 en sombre) et filet de 2 px en bas ; animation `hl .9s` (la taille de fond passe de 0 à 100 %) avec délai propre (`--d`: 900 ms pour la clé, 1100 ms pour le sous-passage).
- **Sous 1280 px** : une seule colonne ; la note passe SOUS le texte (`max-width: 34em`, `padding-top: 28px`), trait et point masqués. **Sous 1024 px** : en-tête condensé avec **menu burger** (`.menu`, panneau `.mnu`, Échap le ferme), marges 24 px, le sommaire devient des **puces** défilantes horizontalement (`.tocl` en `flex`, `overflow-x: auto`, `scrollbar-width: none`) : chaque puce « Art. 35 » fait min 72 px × 44 px, bordée, rayon 12 px ; la puce active est noire (`--ink` / `--inkt`). Le titre, la ligne de titre « Table des matières » et le surtitre de section sont masqués. La note fait toute la largeur.
- Cibles 44 px sous `(pointer: coarse)` (`.bi`, `.ab`, `.pbtn`) ; `prefers-reduced-motion` : toutes les animations et transitions sont coupées (`animation: none !important`).

### 3.2 Animations, avec leur déclencheur (Mouvement + RefonteLecture)
| Geste | Où | Déclencheur | Réglage |
|---|---|---|---|
| Tamponner | pastille de statut | chargement de la page | `stampb .7s cubic-bezier(.3,1.5,.5,1) .8s` : de `translateY(-16px) scale(1.5) rotate(-6deg)` à neutre, plus anneau `ring .9s` à 1,1 s (Mouvement : 0,75 s, « impact ») |
| Surligner | `<mark>` | apparition des passages | `hl .9s` + délai `--d` (Mouvement : 0,8 s « balayage ») |
| Feuilleter | colonne de l'article (surtitre + h2 + corps) | changement d'article | `translateX(±36px)` → 0 et opacité, `.55s cubic-bezier(.22,1,.36,1)` ; `+36px` vers l'avant (suivant), `-36px` vers l'arrière (précédent) ; deux jeux de keyframes `A`/`B` alternés pour relancer l'animation |
| Écrire / citer | note IA | arrivée de la réponse | `blurin .8s` par paragraphe, `s2` décalé de 0,5 s (Mouvement : décalage 450 ms) |
| Peser | note IA | pendant le chargement | balance : fléau oscillant, plateaux à l'horizontale (`bm`, `pl`, `pr`) |
| Dérouler | (non utilisé ici ; menu burger : `translateY(-8px)` + fondu 0,35 s) | | |
| Entrées | note (`rise .7s .9s`), trait (`sweep .7s 1.2s`), point (`pop .4s 1.8s`), titre (`rise .8s .1s`), ligne de statut (`rise .6s .35s`), sommaire (`fade .6s .4s`) | chargement | à garder sobre : voir 6 et 10 |
| Repère du sommaire | `.tind` | changement d'article | glisse, ressort léger |
| Survols | flèches « Précédent/Suivant » (±4 px), icône étincelle (`rotate(18deg) scale(1.15)`), « Régénérer » (−360°), lien « Poser… » (icône −2 px) | survol | transitions courtes |

Règles de `Mouvement.dc.html` : « Un geste, un sens. Pas de rebond décoratif » ; « L'IA bouge pour dire où elle en est » ; « Une seule chose animée à la fois ». **Tension à trancher** : `stampb`, `tind` et `pop` ont un dépassement (`cubic-bezier(.3,1.5,.5,1)`, `.34,1.3,.5,1`, `.3,1.6,.5,1`) : c'est la maquette, à reproduire telle quelle ; mais l'enchaînement d'entrée (statut + sommaire + note + trait + point + surlignage en même temps) contredit « une seule chose animée à la fois » (voir 10).

### 3.3 Interactions simulées dans la maquette (à remplacer par l'état réel)
- Timer 1,5 s de `explain()` → en production : l'état réel de la requête (`explicationEnCours`).
- `copy()` 1,9 s → déjà géré par `ActionsDeLArticle` (2,5 s).
- Passages surlignés écrits en dur dans `is35`/`is37` ; `hasAi` limité aux articles 35 et 37 (en production la note existe pour tout article).
- Le sommaire n'a que 4 articles (une seule section) : démonstration (voir 10).

---

## 4. Écarts, un par un (actuel → cible)

| # | Actuel | Cible | Remarque |
|---|---|---|---|
| E1 | Carte blanche bordée autour du contenu (`main#contenu.rounded-2xl p-10`) | Pas de carte : contenu à plat sur le fond de page | `#contenu` doit rester (lien d'évitement, `retenirLeBouton`, `ChatFab eviter`) |
| E2 | Fil d'Ariane collant `.breadcrumb`, très complet (Retour, chaîne, `Article N`) | Fil statique, mono 12 px, `Parcourir › domaine › nom` | Les tests exigent `.breadcrumb [aria-current="location"]` = « Article N » (`ux-r3`, `ux-complements`) : **garder le fil du dépôt** par défaut, le restyler seulement (voir 10) |
| E3 | Badge de type + date, ligne « N articles · Ajouté à JuriX le », `h1` à 3 paliers de taille | `h1` seul, `clamp` jusqu'à 40 px, titre balancé | Garder `tailleDuTitre` (titres de décret de 200+ caractères) ; type/date/ajout : décision à prendre (voir 10) |
| E4 | `StatutDuTexte` : aplat zinc-100 avec icône, première phrase en gras, texte, « Signaler » | Pastille pointillée tamponnée + phrase + « Signaler » ; « **Ce relevé peut être incomplet.** » en plus | Nouvelle clé de pastille sans point ; nouvelle clé d'avertissement ; le test `composants.test.ts` l. 103-112 et `ux-complements.spec.ts` l. 446 changent |
| E5 | `Partager`, `Télécharger`, `Document original` en tête | Absents de la maquette | Fonctions du produit (P2, P10) : à conserver ailleurs, ou à retirer sur décision du propriétaire |
| E6 | Onglets « Texte / Historique (N) » ; bascule « Article par article / Texte entier » ; barre Précédent/Suivant du haut ; compteur | Absents : une seule navigation en bas | Même remarque. Les tests s'appuient sur `law-mode-*`, `law-tab-*` et sur `.article-navigation button` `.last()` |
| E7 | Sommaire : 280 px, carte bordée, filtre, toutes les divisions, premiers mots, marques « · modifié » | 200 px, sans carte, section courante, « Art. N » sur 40 px, repère glissant | Garder les marques P1 et le filtre (dans la feuille modale) : voir 10 |
| E8 | Sommaire sous `lg` : bouton « Sommaire » + feuille modale | **Puces** « Art. N » défilantes, 44 px | La feuille modale reste utile pour les textes longs ; le test redimensionnement l'utilise |
| E9 | Seuil du sommaire `lg` = 1024 px ; sommaire `lg:top-24` | 1024 px aussi, `top: 24px` | OK pour `lg` ; `top` dépend de la décision sur le fil collant (53 px) |
| E10 | `h2` « Article N » en `text-xl sm:text-2xl` ; la règle « jamais plus grand que le `h1` » (`tailleDuTitre`) | 32 px | Conflit avec cette règle quand le `h1` est à 20-24 px |
| E11 | Corps 16/18 px, interligne `leading-relaxed` (1,625), `zinc-700`, `max-w-[36em]` | 19 px / 1,8, couleur pleine (`zinc-950`), `34em` | `POLICE_DU_TEXTE_OFFICIEL` (`font-texte`) déjà opsz 16 |
| E12 | Pas de surlignage dans l'article | Deux `<mark>` avec bande + filet, animés | Aucune donnée de « passages » dans le produit |
| E13 | Trois actions (référence, texte, lien), icônes `section`, `copy`, `link` | Deux actions : « Copier la référence » (icône `copy`), « Copier le lien » | « Copier le texte » disparaît dans la maquette |
| E14 | Pas de mention « fait foi » visible | `.foi` visible sous les actions | Clé `loi.copie.foi` existante |
| E15 | Bloc IA sous le texte (`.ai-explanation`, rayon 12 px, fond zinc-50, icône carrée noire) | Note à droite ≥ 1280 px (carte blanche 18 px de rayon, ombre), sous le texte en dessous | |
| E16 | Pas d'ancrage | Trait + point, haut de la note calé sur le surlignage (mesuré en JS) | |
| E17 | Chargement : spinner `loader-circle` | Balance animée + squelette | Balance = composant à créer ou à reprendre d'une autre carte |
| E18 | Réponse : blocs montés d'un coup | `blurin` par bloc, décalé de 450-500 ms | La réponse arrive d'un bloc (pas de flux) |
| E19 | Avertissement : « Réponse générée par une IA. Vérifiez-la sur le texte de l'article **ci-dessus**. » | « …Vérifiez-la **dans** le texte de l'article. » | « ci-dessus » faux quand la note est à droite |
| E20 | « Régénérer » : bouton bordé pleine largeur | Lien à icône `rotate-ccw` | Icône à ajouter au registre |
| E21 | Aucun lien vers l'assistant dans la page (le bouton flottant mène à `/chat` sans contexte) | « Poser une question sur cet article » dans la note | `/chat?q=` existe |
| E22 | Navigation du bas : barre encadrée avec compteur | Deux boutons texte avec le libellé du voisin, filet au-dessus | Le texte entier n'a pas de barre : inchangé |
| E23 | Changement d'article instantané | `feuilleter` : glissement ±36 px | |
| E24 | Pas d'animation d'entrée | Tampon, entrée du titre, du sommaire, de la note | |
| E25 | Menu burger de l'en-tête à `xl` (1280 px) | Burger sous 1024 px | Hors de cette zone : `SiteHeader.svelte` est partagé (voir 10) |
| E26 | Fil, boutons et séparateurs « `\|` » du dépôt | Geist Mono sur le fil | Convention du dépôt : la chasse fixe est réservée aux codes (voir 6) |

---

## 5. Plan de modification

Principe : chaque étape laisse `npm test`, `npm run check` et les e2e concernés verts. Les noms de composants Svelte sont proposés ; garder la syntaxe Svelte 4 (`export let`, `$:`, `createEventDispatcher`, `on:`), sans runes.

### Étape 0. Décisions bloquantes (avant de coder)
Obtenir du propriétaire les réponses aux questions de la section 10, en particulier Q1 (fonctions retirées par la maquette : Partager, Télécharger, Document original, Historique, bascule texte entier, Copier le texte), Q2 (passages surlignés : d'où viennent-ils) et Q3 (le fil collant). Le plan suppose les réponses par défaut indiquées ; sinon, l'étape correspondante est à adapter.

### Étape 1. Pastille de statut (E4, E24 partiel)
Modifier `src/lib/components/loi/StatutDuTexte.svelte` :
- Cas `inconnu` et `origine` uniquement : remplacer l'aplat par `<div data-testid="law-status" data-etat={etat.genre}>` contenant la pastille (`<span class="stamp …">` avec `<Icone nom="circle-dashed">` et `$tr("loi.statut.pastille")`), puis la phrase (`aucune_modification` + `loi.statut.incomplet`), puis le lien « Signaler » (`LIEN_DANS_LE_TEXTE`).
- Les états `modifie`, `consolide`, `abroge`, `remplace` n'ont **aucune** maquette : garder leur aplat actuel (même contenu, mêmes `data-etat`) ou les restyler dans la même famille (pastille pointillée pour l'intitulé de l'état + texte). À CONFIRMER avec le propriétaire ; par défaut, ne pas y toucher.
- Garder l'ordre DOM « pastille, phrase, lien » : les tests lisent le texte aplati.
- Animation `tamponner` : `<style>` du composant (ou de la page), `@media (prefers-reduced-motion: no-preference) { .stamp { animation: tamponner .7s cubic-bezier(.3,1.5,.5,1) .8s backwards } .stamp::after { … anneau … } }` : **`backwards`, pas `both`**, et dans le bloc `no-preference` : sans mouvement, rien n'est caché au départ. L'animation est du pur CSS : elle joue sur le HTML du serveur sans JavaScript, et ne touche pas la mise en page (`transform` et `opacity` seulement).
- Ajouter la clé `loi.statut.pastille` (et ne pas modifier `loi.statut.origine`, lue par `StatutDuTexte.svelte` et recopiée dans `loi/dictionnaires-de-test.ts` ; `ux-chat.spec.ts` l. 252 lit la même phrase mais par les clés `chat.statut.*` du chat).

### Étape 2. Icônes et textes (E19, E20, E21 : préparation)
- `src/lib/icones.ts` : ajouter `rotate-ccw` (Lucide : `<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>`) et `message-circle` (`<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>`). **N'ajouter une icône que dans l'étape qui l'utilise** : `icones.test.ts` échoue sur une entrée que rien n'affiche. Les autres icônes de la maquette existent déjà : `sparkles`, `circle-dashed`, `link`, `copy`, `check`, `arrow-left`, `arrow-right`, `chevron-right`, `menu`, `table-of-contents`. `scale` (balance) : À CONFIRMER dans le registre (non vérifié ici ; `SiteHeader` l'emploie sans doute pour le logo).
- Clés i18n : voir section 8 (changer l'avertissement, ajouter les nouvelles). Mettre à jour `src/lib/components/loi/dictionnaires-de-test.ts` **dans les deux langues** (le même texte y est recopié, l. 182 et 358).

### Étape 3. Surlignage (E12)
Créer `src/lib/components/loi/surlignage.ts` (module pur, testé) :
```ts
export interface Passage { texte: string; role: 'cle' | 'sous' }
export interface Segment { texte: string; passage: Passage | null }
export function segmenter(paragraphe: string, passages: Passage[]): Segment[]
```
Recherche **mot pour mot** du passage dans le paragraphe (insensible aux espaces insécables ; utiliser `plier` de `decoupage.ts` seulement pour trouver la position, jamais pour réécrire le texte) ; passage absent → aucun segment marqué. Rendu en nœuds Svelte (`{#each segmenter(paragraphe, passages) as s}{#if s.passage}<mark class="passage" class:passage-cle={s.passage.role === 'cle'}>{s.texte}</mark>{:else}{s.texte}{/if}{/each}`) : **jamais `{@html}`** (convention de `src/lib/highlight.ts`). Dans `+page.svelte`, boucle `{#each paragraphesDeLArticle(articleCourant) as paragraphe, i (i)}` (l. 1840) : remplacer `<p>{paragraphe}</p>`.
CSS `.passage` (dans `<style>` de la page) : `color: inherit; background-color: transparent; background-image: linear-gradient(var(--hl), var(--hl)), linear-gradient(var(--ink), var(--ink))`, tailles `100% .42em, 100% 2px`, positions `0 92%, 0 100%`, `animation: surligner .9s cubic-bezier(.22,1,.36,1) backwards`, `animation-delay: var(--d, 0ms)`, le tout dans `prefers-reduced-motion: no-preference` pour l'animation (le style statique reste). Variables `--hl` et `--ink` : à définir en Tailwind (`zinc-300`/`zinc-600` pour `--hl` ; `zinc-950`/`white` pour `--ink`). Conserver un contraste ≥ 4,5:1 (`axe` balaie la page) ; `<mark>` natif a un fond jaune par défaut, le neutraliser explicitement (`monochrome.spec.ts` échoue sur toute teinte).
Sans passages, rien n'est rendu : étape sans effet visible, tests existants verts. Tests : `surlignage.test.ts` (voir 7).

Source des passages (voir Q2) : v1 front seul = termes de la recherche (`?q=` ajouté à `adresseDeLArticle` côté `SearchResultCard`, lu après hydratation) ; v2 = champ `passages` renvoyé par `explain-article` (backend).

### Étape 4. Extraire la note IA (E15, E17-E20) : `NoteDeLIA.svelte`
Créer `src/lib/components/loi/NoteDeLIA.svelte` en déplaçant le bloc `.ai-explanation` (l. 1849-1952) hors de la page. Props et événements proposés :
```
export let explication: string;            // '' tant que rien
export let enCours: boolean;
export let erreur: string;
export let lienQuestion: string;           // /chat?q=…
export let ancre: number | null = null;    // décalage vertical (px) ; null = non ancrée
export let large = false;                  // ≥ 1280 px : trait et point
dispatch: 'expliquer'                      // bouton principal, « Réessayer » et « Régénérer »
```
- **Conserver** : la classe `ai-explanation` sur la racine, tous les `data-testid` (`law-explain`, `law-explain-loading`, `law-explain-error`, `law-explain-retry`, `law-explain-answer`, `law-explain-disclaimer`, `law-explain-regenerate`), `role="status"`/`aria-live="polite"`, `role="alert"` et le rouge de l'erreur, `blocsDeReponse` en nœuds, Inter (jamais Literata).
- Nouveaux visuels : carte blanche (`bg-white dark:bg-zinc-900`, `rounded-[18px]`, bordure zinc, ombre de feuille), titre + icône `sparkles`, liste repos (clés existantes), bouton noir, **chargement** = `<BalanceAnimee>` + squelette, **terminé** = blocs avec classe d'arrivée `style="animation-delay: {i * 450}ms"`, avertissement, « Régénérer » (icône `rotate-ccw`), lien `message-circle`.
- Étape 4a (refactor pur, aucun changement visuel) puis 4b (restyle). Les tests e2e `explication-article.spec.ts` et `page.test.ts` (blocs « extrait d'Expliquer l'article ») restent verts à 4a.
- `BalanceAnimee.svelte` : `src/lib/components/BalanceAnimee.svelte` (props : `attente: boolean`, `class`). Le même geste sert à l'accueil et à l'assistant : **À CONFIRMER** qu'une autre carte de la passation le crée déjà, pour ne pas le dupliquer. Animation pure CSS (`bm`, `pl`, `pr`, `transform-box: view-box`), coupée sous `prefers-reduced-motion`. Pendant `enCours`, l'icône est décorative (`aria-hidden`) : le texte « Explication en cours… » porte le statut.
- Le squelette et la balance ne remplacent pas l'annonce vocale : garder `role="status"`.

### Étape 5. Actions d'article (E13, E14)
`src/lib/components/loi/ActionsDeLArticle.svelte` :
- Maquette : deux boutons. Par défaut, **garder trois fonctions** mais n'en montrer que deux au premier plan : « Copier la référence » et « Copier le lien » ; « Copier le texte » reste atteignable (bouton tertiaire discret ou lien dans la rangée) tant que le propriétaire n'a pas tranché (README : choix P2). Mettre l'icône `copy` sur la référence (au lieu de `section`) et `link` sur le lien.
- Le bouton lien devient « Partager le lien » sur tactile (comportement existant, `partageNatif`) : garder.
- Ajouter, juste sous la rangée, `<p class="foi">{$tr("loi.copie.foi")}</p>` (13 px, zinc-500 : la ligne de maquette `--tx3` zinc-500 donne 4,6:1 sur `#FAFAFA` ; sur `zinc-100` elle passerait sous AA, d'où l'attention à ne pas la mettre sur un aplat gris).
- Animation `pop` de l'icône `check` (`motion-safe:`). Conserver `data-testid="law-article-actions"` et les trois `law-copy-*`, l'annonce `role="status"`, `law-copy-error`.
- `BOUTON_SECONDAIRE` (`typographie.ts`) reste la source des classes ; les ajustements (rayon 12 px = `rounded-xl`, déjà là) ne changent pas.

### Étape 6. Mise en page : retirer la carte, grille 200/280 (E1, E3, E7-E11, E15, E22)
Modifier `src/routes/laws/[id]/+page.svelte` (gabarit) :
1. **Conteneur** : `max-w-[96rem]` du fil reste ; le contenu passe à `max-w-[82.5rem]` (1320 px) avec marges 48/24/16 px. `.layout` : `lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-12` ; garder la classe `layout` ET `data-testid="law-toc"`.
2. **`<main id="contenu">`** : retirer `bg-white … border … rounded-2xl p-* shadow-sm` ; garder `id="contenu"` et `data-hors-du-bouton` (mais voir l'étape 9 pour le déplacer).
3. **En-tête du document** : `h1` + `<StatutDuTexte>` ; `border-top` à 48 px sous le statut ; le reste de `.document-header` (badge de type, date, « N articles · Ajouté… », `.document-actions`) selon la décision Q1. Par défaut : conserver ces éléments sous forme **discrète** (une ligne de méta en 14 px zinc-500, et les trois actions Partager/Télécharger/Document original en liens texte à droite de la ligne de méta), pour ne rien perdre des fonctions ni des `data-testid` (`law-share`, `law-toggle-document`, `law-date`, `law-added`, `.document-actions`).
4. **Sommaire** (`#sommaire`) : colonne de 200 px, sans carte ni bordure (`lg:border-0 lg:bg-transparent lg:shadow-none`), `lg:sticky lg:top-24` (valeur à recaler si le fil collant change). Rendre via un nouveau mode de `ListeDuSommaire` : `export let variante: 'colonne' | 'puces' | 'feuille' = 'feuille'`. `colonne` = section courante seulement : surtitre de la division + lignes de 40 px « Art. N » + marque « · modifié/abrogé/remplacé » ; `puces` = les mêmes articles en puces 44 px ; `feuille` = comportement actuel (filtre, toutes les divisions, premiers mots), servi par le bouton « Sommaire » qui reste sous `lg` ET est ajouté au-dessus de la colonne (lien « Tout le sommaire ») pour les textes longs. **Un seul élément `#sommaire` dans le DOM** (conserver cette règle : un lien par article pour les lecteurs d'écran et les tests ; ne pas dupliquer le sommaire pour les puces, faire varier la présentation par CSS et par `variante`).
   - Repère glissant : un `<span class="repere" style="transform: translateY({rang * 40}px)">` dans la liste ; **uniquement** sur `colonne` (lignes de hauteur fixe 40 px) ; `transition: transform .5s cubic-bezier(.34,1.3,.5,1)` dans `no-preference`. L'index à utiliser est le rang DANS la division courante, pas le rang global.
   - Les liens restent des `<a href="#art-N">` interceptés par `choisir` (comportement actuel). Pour les puces : `<a>` avec `aria-current="location"`, pas des `button` (la maquette en met mais le dépôt a besoin de liens ouvrables dans un nouvel onglet).
   - « Début du texte » (lien de la maquette) : à brancher sur `changerDeMode("texte")` + défilement en haut, seulement si le texte a une ouverture (`decoupe.divisions[0]?.introduction.length`) ; sinon ne pas l'afficher. À CONFIRMER.
5. **Rangée** (`.row`) : `xl:grid-cols-[minmax(0,1fr)_280px] xl:gap-x-14`. Colonne `.read` à `min-w-0`, corps à `max-w-[34em]` (`POLICE_DU_TEXTE_OFFICIEL`, `text-[19px] leading-[1.8] text-zinc-950 dark:text-zinc-100`). La note occupe `<aside class="rail" aria-label={$tr("loi.ia.titre")}>`. Sous `xl`, la note passe sous le texte, `max-w-[34em]`.
6. **Navigation** : supprimer la barre du haut (`.article-navigation` dans la rangée de lecture) ET le bouton compteur ; transformer `.article-navigation-bas` en `<nav class="article-navigation" aria-label="Articles voisins">` avec deux boutons « Précédent » / « Suivant » et la ligne du voisin (« Article {n−1} » / « Article {n+1} »). Conserver **`article-navigation`** comme classe de ce `nav` et « Suivant » comme dernier `button` : `ux-lecteur.spec.ts` l. 38, `ux-complements.spec.ts` l. 265 et `chat-rendu.spec.ts` l. 214 prennent `.article-navigation button` puis `.last()`. Désactiver (pas masquer) le bouton aux bornes comme aujourd'hui (`disabled`). La cible du défilement (`debutArticle`, `scroll-mt-*`) passe sur le surtitre/h2 de l'article.
7. **Bascule de mode et onglets** : selon Q1. Par défaut, les garder dans une ligne fine au-dessus du texte (`BasculeDeLecture` inchangée, `law-mode-*` inchangés) ; ils ne sont pas dans la maquette mais le mode « texte entier » ne se retrouve nulle part ailleurs et plusieurs tests en dépendent.
8. **Titre** : garder `tailleDuTitre` mais relever le palier court (≤ 40 caractères) vers `clamp(1.75rem, 3vw + .5rem, 2.5rem)` ; garder `/[1.2]`-style ou ajuster le test (`page.test.ts` l. 488-497 exige `/[1.2]` sur chaque classe de taille). Titre « Article N » : 32 px au plus pour les `h1` courts, **jamais plus grand que le `h1`** (règle du dépôt, voir 6).
9. **Surtitre** : conserver `chaine` + `intituleDeDivision` (le surtitre de la maquette montre « Section III : De la suspension… » : c'est `chaine` + `intituleDeDivision` rendus en une ligne).

### Étape 7. Ancrage de la note (E16)
Créer `src/lib/actions/ancrer-la-note.ts` (action Svelte, comme `src/lib/actions/pieger-focus`) :
```ts
export interface OptionsDAncrage {
  cible: () => HTMLElement | null;      // le <mark class="passage-cle"> courant
  repere?: number;                      // 28 : position du trait dans la note
  milieuDeLigne?: number;               // 17
  requete?: string;                     // '(min-width: 1280px)'
  surMesure: (decalage: number | null) => void;
  cle: unknown;                         // change quand l'article change
}
export function ancrerLaNote(rangee: HTMLElement, options: OptionsDAncrage): { update(o: OptionsDAncrage): void; destroy(): void }
```
Posée sur `.row` (`use:ancrerLaNote={{…}}`). Elle tourne **uniquement dans le navigateur** (une action n'est pas exécutée au rendu serveur). Elle remesure :
- au montage, et à chaque changement de `cle` (`update`), après `tick()`/une image (`requestAnimationFrame`) ;
- au redimensionnement : un `ResizeObserver` sur `.row` et sur `.read` plutôt qu'un `window.resize` + `setTimeout` comme la maquette (il couvre aussi le changement de hauteur du texte quand la police arrive) ;
- au chargement des polices : `document.fonts.ready.then(mesurer)` et l'événement `loadingdone` de `document.fonts` (Literata est en `font-display: swap`, elle peut arriver tard et décaler les lignes) ;
- au changement de la requête `(min-width: 1280px)` (`matchMedia(...).addEventListener('change')`).
Calcul : `if (!requete.matches || !cible()) → surMesure(null)` ; sinon `pt = Math.max(0, Math.round(mark.getBoundingClientRect().top − rangee.getBoundingClientRect().top + milieuDeLigne − repere))` ; n'appeler `surMesure` que si l'écart dépasse 1 px. Ne lire que `.top` : la transformation de `feuilleter` (translateX) ne le change pas.
Dans la page : `let decalageDeLaNote: number | null = null;`, passé à `NoteDeLIA` (`ancre`). `<aside class="rail" style="padding-top: {decalageDeLaNote ?? 28}px">`, `transition: padding-top .5s cubic-bezier(.22,1,.36,1)` dans `no-preference`. Trait et point (`::before`/`::after` de la note) : rendus seulement quand `ancre !== null` (classe `ancree`), pour qu'une note sans passage n'ait pas de trait qui vise le vide.
- Sans passage (v1 sans `?q=`) : `cible()` rend `null` → `ancre` reste `null` → note en haut de la marge, ni trait ni point. Dégradation volontaire.

**Éviter tout saut de mise en page** (voir 6 et 10) :
1. Le serveur rend la note **non ancrée** (`padding-top: 28px`, ni trait ni point) : c'est ce que voient aussi les robots et le HTML mis en cache.
2. Avec mouvement permis, la note arrive par `rise` avec un délai (0,9 s) et `backwards` : l'ancrage (mesuré dès le montage) se fait pendant qu'elle est encore invisible.
3. Avec mouvement réduit, il n'y a plus de délai : la note peut sauter une fois (≤ quelques centaines de px, hors flux du texte, qui ne bouge pas). Option : masquer la note par `opacity: 0` tant que `monte && large && !mesure`, à condition d'avoir un repli sans JavaScript (la note doit rester visible sans JS : poser la classe `js` sur `<html>` dans `src/app.html`, ou utiliser `<noscript><style>`). À CONFIRMER.
4. N'utiliser que `transform` et `opacity` pour les animations d'entrée (la transition de `padding-top` fait exception, voulue : elle fait glisser la note vers son passage ; la couper hors `no-preference`).
5. Le texte de l'article ne bouge jamais à cause de la note (colonne de 280 px fixe, `.read` en `minmax(0,1fr)`).

### Étape 8. Feuilleter (E23)
Dans `+page.svelte` : `let feuillete = ""` (`"suivant-A"`, `"suivant-B"`, `"precedent-A"`, `"precedent-B"` ou `""`) et `let basculeFeuilletage = false`. Une fonction `feuilleter(ancien: number, nouveau: number)` : si `nouveau !== ancien`, `basculeFeuilletage = !basculeFeuilletage` ; `feuillete = (nouveau > ancien ? 'suivant' : 'precedent') + (basculeFeuilletage ? '-A' : '-B')`. L'appeler **uniquement** depuis les gestes du lecteur : `navigateToPrevious`, `navigateToNext`, et `choisirDansLeSommaire` en mode article (sens selon le rang d'arrivée). Ne **pas** l'appeler depuis `appliquerLaNavigation`/`afterNavigate` (arrivée sur `?article=N`, retour arrière du navigateur, ancre) : l'article vient d'être posé par l'adresse, un glissement serait déroutant et, au premier chargement, ajouterait un saut après l'hydratation. À la rigueur, l'autoriser pour `popstate` (à décider, par défaut non).
Le conteneur animé est un `<div class="feuille {feuillete}">` autour du seul bloc surtitre + `h2` + corps (pas la note, pas la navigation du bas). Pas de `{#key rangCourant}` : un remontage détruirait `h2#titre-article` (`bind:this={titreDeLArticle}`, qui reçoit le focus après un choix au clavier dans le sommaire, `choisirDansLeSommaire` l. 779), perdrait l'état de `ActionsDeLArticle` et ferait clignoter le contenu. On relance l'animation en alternant deux noms de keyframes identiques (`feuillete-suivant-a`/`-b`), comme la maquette (`tnA`/`tnB`).
CSS (dans `<style>` de la page) :
```css
@media (prefers-reduced-motion: no-preference) {
  .feuille.suivant-a   { animation: feuillete-suivant-a .55s cubic-bezier(.22,1,.36,1) both }
  .feuille.suivant-b   { animation: feuillete-suivant-b .55s cubic-bezier(.22,1,.36,1) both }
  .feuille.precedent-a { animation: feuillete-precedent-a … }
  .feuille.precedent-b { animation: feuillete-precedent-b … }
}
@keyframes feuillete-suivant-a { from { opacity: 0; transform: translateX(36px) } to { opacity: 1; transform: none } }
/* idem -b, et translateX(-36px) pour precedent */
```
Garde-fous : la colonne de lecture porte `overflow-x: clip` (pas `hidden` : `clip` ne crée pas de conteneur de défilement et n'empêche pas `position: sticky` du sommaire) pour que `translateX(36px)` ne crée aucun défilement horizontal à 320 px (`responsif.spec.ts` : `scrollWidth <= innerWidth + 1`). Ne pas animer `.rail` (« une seule chose animée à la fois »). Aucune écoute des flèches du clavier n'existe : rien à brancher côté touches. L'URL et l'historique sont écrits **avant** l'animation (`ecrireLAdresse("remplacer")`) : l'animation est purement visuelle, `aria-live` n'est pas utilisé sur l'article ; le focus de `titreDeLArticle` ne bouge pas.
`reinitialiserExplication` est déjà branchée sur `rangCourant` : la note repasse à « repos » sans animation d'entrée (ne pas relancer `rise`).
L'état `feuillete` est `""` au rendu serveur : le HTML en cache n'a aucune animation.

### Étape 9. Lien « Poser une question sur cet article » et bouton flottant (E21)
- Dans `NoteDeLIA.svelte`, `<a href={lienQuestion} class="ask …" data-testid="law-ask">` avec icône `message-circle`, 44 px de haut minimum (`min-h-11`). C'est un **lien** (fonctionne sans JavaScript, ouvrable dans un nouvel onglet).
- Dans la page : `$: lienQuestion = articleCourant && law ? "/chat?q=" + encodeURIComponent(remplir($tr("loi.ia.question_modele"), { n: numeroEcrit, nom: nomCourt })) : "/chat"`. `remplir` est l'utilitaire de `$lib/components/listes/reperes` déjà importé (le dépôt l'utilise pour que `$&` ne soit pas lu comme motif). Écrire ce `$:` après `numeroEcrit` et `nomCourt` (ordre du source). Le texte est pré-rempli et **non envoyé** (comportement existant de `(main)/chat/+page.svelte` l. 1574 : choix délibéré, éviter un appel au modèle pour une phrase que l'utilisateur n'a pas écrite).
- Limite connue : le chat ne reçoit que du texte. Il retrouvera l'article par la recherche, sans garantie. Une v2 (identifiant de texte et numéro d'article transmis au chat, `&loi=` `&article=`) demande : lecture de ces paramètres dans `(main)/chat/+page.svelte`, un champ de contexte dans la requête du chat, et le backend. Rien n'existe : À CONFIRMER avec l'équipe backend avant de promettre « avec l'article en contexte ».
- **ChatFab** : garder tel quel (aucun test e2e ne le cible ; il est simulé dans `page.test.ts`). Deux ajustements : (a) déplacer `data-hors-du-bouton` de `main#contenu` (qui devient pleine largeur, donc toujours « sous » le bouton) vers la colonne `.read` et le `.rail`, pour qu'il se retire quand le texte ou la note passent dessous et reste affiché à droite de la page sur grand écran ; (b) vérifier à 1280-1439 px que la note (bord droit à `100vw − 48 px`) n'est pas recouverte par le bouton (64 px à 32 px du bord, soit 96 px depuis le bord) : la marge `MARGE = 8` de `ChatFab` le masque quand la note passe dessous. `retenirLeBouton()` (l. 718) lit `#contenu` : adapter si son rectangle devient pleine largeur (il retient alors le bouton à chaque défilement de la page, ce qui est le comportement des petits écrans : acceptable).

### Étape 10. Entrées animées, sobriété, mouvement réduit (E24)
- Entrées de la maquette (titre `rise`, statut `rise`, sommaire `fade`, note `rise`, trait `sweep`, point `pop`) : **à appliquer avec parcimonie** : tampon (étape 1) + note (étape 4) + trait (étape 7) suffisent ; le titre et le sommaire n'ont pas besoin de s'animer (le HTML en cache doit être lisible tout de suite, et l'entrée d'un `h1` rendu par le serveur est le premier élément peint, donc un risque pour le LCP). Garder `rise` du titre hors du plan par défaut.
- Toute animation dans `@media (prefers-reduced-motion: no-preference)` avec `backwards` (jamais `both` pour un état de départ invisible), comme `monter`/`fondu` aujourd'hui dans la page. Les `transition` des survols passent par `motion-reduce:transition-none` (Tailwind) ou le même bloc.
- Ne pas copier la règle globale de la maquette (`.jx * { animation: none !important }`) : elle est trop large pour un site réel ; le garde est par animation.

### Fichiers : récapitulatif
Créer :
- `src/lib/components/loi/NoteDeLIA.svelte`
- `src/lib/components/loi/surlignage.ts` (+ `surlignage.test.ts`)
- `src/lib/actions/ancrer-la-note.ts` (+ `ancrer-la-note.test.ts`)
- `src/lib/components/BalanceAnimee.svelte` (si non créé par une autre carte)
- `tests/e2e/navigation/lecture-mouvement.spec.ts`

Modifier : `src/routes/laws/[id]/+page.svelte` ; `src/lib/components/loi/StatutDuTexte.svelte`, `ActionsDeLArticle.svelte`, `ListeDuSommaire.svelte` ; `src/lib/icones.ts` ; `src/lib/stores/language.ts` ; `src/lib/components/loi/dictionnaires-de-test.ts` ; `src/lib/components/ChatFab.svelte` (seulement si l'étape 9 l'exige : probablement non, c'est `data-hors-du-bouton` qui bouge dans la page) ; tests listés en 7.

Ne pas modifier : `+page.server.ts` (ISR, clé de cache), `decoupage.ts`, `reference.ts`, `statut.ts`, `TexteEntier.svelte`, `HistoriqueDuTexte.svelte`, `StatutDeLArticle.svelte` (sauf si Q1 le demande), `presse-papiers.ts`, `StatusBadge.svelte` (admin), `StatutEnBref.svelte` (listes).

Supprimer : rien (les barres Précédent/Suivant du haut et le bloc `.ai-explanation` disparaissent du gabarit, pas du dépôt).

---

## 6. Contraintes du dépôt qui s'appliquent

- **Noir et blanc zinc** (README ; `tailwind.config.js` : `primary`, `background-light/dark`, `card-*`). Aucune teinte, sauf le rouge des erreurs. Le test `monochrome.spec.ts` relève toute couleur peinte (dégradés, bordures, ombres, pseudo-éléments : donc la bande et le filet du `<mark>`, le trait et le point de la note, l'ombre de la note) en clair et en sombre à 390 et 1440 px, sommaire et explication ouverts (`laws--sommaire`, `law-explain`). Les valeurs de la maquette (`#D4D4D8`, `#52525B`, `#E4E4E7`…) sont toutes des zinc : les écrire en classes/variables zinc, pas en hexadécimal libre.
- **Polices** : Literata Titre (h1, « Article N ») et Literata Texte (corps) auto-hébergées, replis ajustés (`src/app.css`, `font-display: swap`, sans préchargement) ; Inter ailleurs ; **jamais de serif sur ce que l'IA rédige** (`ux-lecteur.spec.ts` l. 264-272 : `.ai-explanation` ne contient pas « Literata »). `font-semibold` toujours avec `font-titre`, jamais `tracking-tight`. `typographie.ts` est la source des classes.
- **Geist Mono** : le commentaire de `tailwind.config.js` réserve la chasse fixe aux codes courts (« Ctrl K ») : « surtitres, dates et compteurs passent en Inter ». La maquette met le **fil d'Ariane en mono** : conflit avec la convention (voir Q8). Par défaut, rester en Inter.
- **Icônes** : uniquement `<Icone nom="…">` (registre `src/lib/icones.ts`, SVG Lucide) ; `icones.test.ts` échoue sur un nom absent comme sur une entrée inutilisée. Les noms ne doivent pas être calculés dans `nom={…}` avec des chaînes littérales d'expression conditionnelle sans les connaître du test : cf. le commentaire de `ActionsDeLArticle.svelte` (« Hors de `nom={…}` : le contrôle des icônes lit toute chaîne de cette expression comme un nom d'icône ») : `$: referenceCopiee = …` puis `nom={referenceCopiee ? "check" : "copy"}`.
- **i18n** : `$tr("cle")` dans le balisage, `t("cle")` dans le script ; clés **identiques** en FR et EN (test de parité `language.test.ts`) ; espace insécable avant « : » en français (` `) ; aucun français affiché dans l'interface anglaise (`monochrome.spec.ts` : page en anglais) ; texte de la loi en `lang={langueDuTexte}` ; pas de clé brute affichée (`ux-r2`). `dictionnaires-de-test.ts` recopie les chaînes pour les tests unitaires de `loi/` : à tenir à jour avec `language.ts`.
- **Rendu serveur / ISR** : `+page.server.ts` et `export const config` inchangés ; **aucun paramètre dans la clé de cache** ; le serveur rend le premier article en lecture article par article ; l'adresse (`?article=`, `#art-N`) est appliquée après l'hydratation. Donc : aucune dépendance au visiteur ni à `$page.url.searchParams` dans le HTML rendu ; tout ce qui vient de `window`, `matchMedia`, `document.fonts`, `?q=` se lit dans `onMount`/`afterNavigate`/action. Les 503 ne sont jamais gardés.
- **Svelte 4 sur moteur Svelte 5 (mode legacy)** : syntaxe `$:`, `export let`, `createEventDispatcher`, `on:`. Les `$:` s'exécutent dans l'ordre du source (piège documenté dans `explication-article.spec.ts`).
- **Accessibilité** : un seul `h1`, un seul `main`, pas de saut de niveau de titre (`h1` → `h2` → `h3` ; la note IA est un `h3` ou un `h4` : aujourd'hui `h4` sous un `h3` éventuel ; ne pas sauter de niveau) ; `aria-current="location"` sur l'article lu du sommaire ; dialogue du sommaire (`role="dialog"`, piège de focus, Échap, verrou) ; annonces `aria-live`/`role="status"` des copies et de l'explication ; **cibles de 44 px au doigt** (la maquette y pourvoit : `(pointer: coarse)`) ; lien d'évitement `#contenu` ; `prefers-reduced-motion` ; balayage axe-core (`accessibilite.spec.ts` couvre `/laws/[id]`).
- **Tests e2e de mise en page** : 1920 à 320 px sans défilement horizontal (`responsif.spec.ts`, `redimensionnement.spec.ts`) ; `scrollWidth <= innerWidth + 1` ; la vue 1024×768 reste « pile » (sommaire en puces) ; l'en-tête bascule à `xl`.
- **Règle « h2 ≤ h1 »** (`tailleDuTitre`, commentaire sur les restes R3 : « le h2 dominait le h1 ») : le `h2` « Article N » ne doit pas dépasser le `h1` quand le titre est long.
- **Commentaires « POURQUOI »** : chaque décision non évidente est expliquée dans le code, en français, avec la date de vérification (`vérification r2 du 29/10/2026`). Le faire pour les choix de cette refonte (ex. pourquoi `backwards` et non `both`, pourquoi pas de `{#key}`, pourquoi le serveur rend la note non ancrée).
- **Contenu juridique** : jamais de texte inventé. Les phrases de la maquette entre crochets (« [Suite de l'article, à reprendre du corpus] ») sont des marqueurs de place, à ne pas rendre. Le titre est celui du corpus : ne pas retoucher sa typographie (voir Q6).
- **Convention du dépôt pour les URL** : `?article=` (liens du chat et de la recherche) ; l'ancre ajoutée pour un homonyme.
- **Pas d'`alert()`** ; la copie est dite dans le bouton et annoncée.
- **Citations de nombres** : `tabular-nums` pour les dates/compteurs.

---

## 7. Tests à mettre à jour ou à ajouter

### Unitaires (vitest)
`src/routes/laws/[id]/page.test.ts` (monte la page entière, ChatFab simulé) :
- l. 412-431 « la bascule et la barre Précédent / Suivant partagent une rangée » : **à réécrire** si la barre du haut disparaît (les assertions sur `.article-navigation` parent identique à celui de la bascule, `['hidden','xl:inline']` et le résumé « 3 articles · 2 chapitres »). La nouvelle assertion : le `nav.article-navigation` existe une fois, « Suivant » en dernier bouton.
- l. 434-446 « la carte bornée à 52rem dans un groupe centré » : **à remplacer** (`lg:grid-cols-[280px_minmax(0,52rem)]` devient `lg:grid-cols-[200px_minmax(0,1fr)]`, plus de `md:grid-cols-[minmax(0,52rem)]`).
- l. 448-465 « un texte d'un seul article : la barre seule, dans son bloc » : `sm:p-4` sur la barre, libellés `hidden sm:inline` : à réécrire.
- l. 488-497 « interligne de 1,2 » : toujours vrai si les classes de taille gardent `/[1.2]` ; sinon adapter.
- Blocs « extrait d'Expliquer l'article » (l. 860+), « adresse de lecture », « Retour » du fil, « article introuvable », « texte entier » : **ne doivent pas bouger** (si un test casse ici, la modification de l'étape 6 a touché la logique de navigation).
- À ajouter : « Suivant » met la classe de feuilletage (`suivant-a`/`-b` alternée) ; « Précédent » `precedent-*` ; l'arrivée par adresse (`afterNavigate`) **n'en pose aucune** ; le lien `law-ask` pointe vers `/chat?q=…` avec le numéro de l'article lu et change au « Suivant » ; l'attribut `data-etat` du statut ; la note rend la balance pendant `enCours` (`role="status"`).
- Remarque : `jsdom` n'a pas de `ResizeObserver` ni de `matchMedia` complet : simuler dans le test de l'action.

`src/lib/components/loi/composants.test.ts` :
- `StatutDuTexte` l. 99-115 : `'Version d’origine, non consolidée. Signaler'` (sans statut) → `'Version d’origine, non consolidée Signaler'` selon le rendu choisi pour la pastille ; l. 111-113 → `'Version d’origine, non consolidée Aucune modification relevée par JuriX au 14 oct. 2026. Ce relevé peut être incomplet. Signaler'`. Les variantes `consolide`, `abroge`, `remplace` (l. 119-155) restent si on ne les restyle pas.
- `ActionsDeLArticle` (l. 353+) : si « Copier le texte » change de place ou de libellé, adapter ; sinon ajouter l'assertion de `loi.copie.foi` et des icônes (`copy` sur la référence).
- `ListeDuSommaire` (l. 293+) : ajouter les trois variantes (`colonne`, `puces`, `feuille`), la présence d'un seul `aria-current="location"`, les marques « · modifié ».
- `BasculeDeLecture` : inchangé si elle reste.
- À ajouter : `NoteDeLIA` (chaque état, `data-testid`, classe `ai-explanation`, avertissement, lien).

Nouveaux fichiers de test :
- `src/lib/components/loi/surlignage.test.ts` : un passage, deux passages, passage absent, passage à cheval sur un espace insécable, passage qui contient un caractère spécial (aucune injection : sortie en nœuds), passages qui se chevauchent (le « clé » contient le « sous »).
- `src/lib/actions/ancrer-la-note.test.ts` : `pt` calculé = `top(mark) − top(rangée) + 17 − 28`, borné à 0, `null` sous `1280 px`, remesure au `ResizeObserver`, à `document.fonts.ready`, au changement de `cle`, pas d'appel si l'écart ≤ 1 px, nettoyage à la destruction.

`src/lib/icones.test.ts` : s'exécute tel quel ; vérifier qu'il reste vert après l'ajout de `rotate-ccw` et `message-circle`.
`src/lib/stores/language.test.ts` : parité FR/EN, à vérifier après chaque ajout de clé.
`src/tests/cache-isr.test.ts` : ne doit pas changer ; s'il casse, un `$page.url.searchParams` ou un paramètre est entré dans le rendu serveur.

### E2E (playwright)
- `tests/e2e/navigation/ux-lecteur.spec.ts` :
  - l. 82-98 (P1 statut) : `law-status` + `data-etat` + lien Signaler : **inchangé**.
  - l. 100-124 (P2 « Suivant » remplace, le sommaire ajoute) : `page.getByTestId('law-toc').getByRole('link')` : le sommaire de 200 px doit garder `law-toc` et des **liens** ; attention : la variante `colonne` ne montre plus que la division courante, or `liens.nth(2)` suppose au moins 3 liens ET qu'un saut change l'article : vérifier que la section de l'article 1 a ≥ 3 articles pour cette loi, sinon le test saute (`test.skip`) ou échoue ; **le plus sûr : que `data-testid="law-toc"` couvre aussi le sommaire complet** (feuille) rendu au serveur, ou adapter le test.
  - l. 201-231 (copier référence/texte/lien) : si « Copier le texte » est retiré, retirer ou garder ses assertions (`law-copy-text`).
  - l. 233-262 (texte entier) : dépend de `law-mode-*` : si la bascule est retirée du premier plan, ouvrir le texte entier autrement.
  - l. 264-272 (Q5) : `article.article h2`, `article.article .article-content`, `.ai-explanation` : garder ces trois sélecteurs.
  - l. 275-296 (téléphone 320 px) : `.document-actions` et `law-article-actions` « sur une rangée, rien ne dépasse » : si `.document-actions` change de forme, adapter (au moins 2 enfants, même `top`, `right <= 320`).
- `tests/e2e/navigation/explication-article.spec.ts` : tous les `data-testid` (`law-explain`, `-answer`, `-disclaimer`, `-loading`, `-error`, `-retry`, `-regenerate`) à conserver. Attention : « le texte de l'article s'affiche dès le premier chargement » vérifie l'absence de « Chargement… » ; « changer d'article efface l'explication précédente » et « une réponse périmée n'atterrit pas sur le nouvel article » passent par « Suivant » (`.article-navigation button` `.last()`) : l'ordre des boutons compte. Avec la note à droite, le clic sur `law-explain` ne doit pas être recouvert par le ChatFab à 1280×720 : `cliquerJusqualEffet` (helper) à utiliser.
- `tests/e2e/navigation/chat-rendu.spec.ts` l. 214, `ux-complements.spec.ts` l. 265 et 371/443-446 (texte exact du statut : **à mettre à jour**), `ux-r2.spec.ts` l. 324, `ux-r3.spec.ts` l. 86/141/209 : relancer et ajuster les sélecteurs touchés.
- `tests/e2e/navigation/redimensionnement.spec.ts` l. 844-873 (sommaire ouvert à 390 px puis 1280 et retour) : utilise `law-toc-toggle` et `role="dialog"` : le bouton `law-toc-toggle` (compteur de la barre du haut) disparaît avec la barre : **garder un bouton `law-toc-toggle`** (par ex. « Sommaire » sous les puces) ou changer le test. Le même test vérifie que, passé à 1280 px, le sommaire n'est plus un dialogue et qu'aucun voile ne reste.
- `tests/e2e/navigation/monochrome.spec.ts` (états `laws--sommaire`, `law-explain`) : pas de modification si les `data-testid` tiennent ; il échouera sur toute teinte du surlignage, de l'ombre ou du trait.
- `tests/e2e/navigation/accessibilite.spec.ts`, `responsif.spec.ts` (page `/laws/[id]`, six tailles, captures `test-results/responsif/laws-id-*.png` **à relire**) : relancer ; vérifier les puces défilantes (zone de défilement horizontal interne sans débordement de page) et `overflow-x: clip`.
- `tests/e2e/pages-du-site.ts` : aucune modification (liste de pages).
- **À ajouter** `tests/e2e/navigation/lecture-mouvement.spec.ts` :
  1. `emulateMedia({ reducedMotion: 'reduce' })` : aucune animation en cours sur la page (`document.getAnimations().length === 0`) après « Suivant », après chargement, et pendant « Expliquer » ; le contenu reste visible.
  2. Mouvement permis : « Suivant » → la colonne de l'article a une animation `feuillete-*` ; « Précédent » → le sens inverse ; chargement par `?article=N` → aucune animation de feuilletage.
  3. Ancrage à 1440×900 : sur un article qui a un passage (page avec `?q=` si Q2 le permet, sinon réponse de `explain-article` simulée avec `passages`), l'ordonnée du centre du trait de la note ≈ celle du centre de la première ligne du `<mark>` (± 2 px) ; après redimensionnement à 1100 px, plus de trait, note sous le texte ; retour à 1440 px : trait de nouveau ; après `document.fonts.ready` aucun écart.
  4. Sans JavaScript (`javaScriptEnabled: false`) : le HTML du serveur contient la note (titre, bouton, lien `law-ask`), le statut et le premier article ; aucune erreur.
  5. Lien `law-ask` : `href` commence par `/chat?q=` ; ouvrir : le champ du chat contient la question et **rien n'a été envoyé** (aucune requête `chat`).
- Ne pas oublier `E2E_EXIGER_BACKEND=1` avant livraison (README).

---

## 8. Chaînes i18n

### Clés existantes réutilisables (clé → français)
- `loi.article` → « Article » ; `loi.fil_ariane` → « Fil d'Ariane » ; `loi.retour` → « Retour » ; `loi.categorie` → « Catégorie »
- `loi.statut.origine` → « Version d'origine, non consolidée. » (garder : utilisée par `StatutDuTexte.svelte`) ; `loi.statut.aucune_modification` → « Aucune modification relevée par JuriX au {date}. » ; `loi.statut.signaler` → « Signaler » ; autres `loi.statut.*` (modifie, consolidee, abroge, remplace…) inchangées
- `loi.copie.reference` → « Copier la référence » ; `loi.copie.reference_faite` → « Référence copiée » ; `loi.copie.lien` → « Copier le lien » ; `loi.copie.lien_fait` → « Lien copié » ; `loi.copie.texte`, `loi.copie.texte_fait` ; `loi.copie.reference_court` (« Référence »), `loi.copie.lien_court` (« Lien »), `loi.copie.fait`, `loi.copie.faite`, `loi.copie.echec` ; `loi.partage.lien` → « Partager le lien » ; `loi.partager` → « Partager »
- `loi.copie.foi` → « Seul le texte publié au Journal officiel fait foi. » (aujourd'hui seulement dans le texte copié ; à afficher sur la page)
- `loi.precedent` → « Précédent » ; `loi.suivant` → « Suivant » ; `loi.sommaire.titre` → « Table des matières » ; `loi.sommaire.debut` → « Début du texte » ; `loi.sommaire.ouvrir` → « Sommaire » ; `loi.sommaire.art` → « Art. » ; `loi.sommaire.nombre` → « {n} articles » ; `loi.sommaire.modifie/abroge/remplace` ; `loi.sommaire.filtre`, `loi.sommaire.aucun`
- `loi.ia.titre` → « Explication simplifiée (IA) » ; `loi.ia.description` → « Demandez à l'assistant d'expliquer cet article en langage courant, à partir de son texte et de son document d'origine. Vous obtiendrez : » ; `loi.ia.contenu_cle` / `loi.ia.contenu_cle_desc` ; `loi.ia.implications` / `loi.ia.implications_desc` ; `loi.ia.expliquer` → « Expliquer l'article » ; `loi.ia.en_cours` → « Explication en cours… » ; `loi.ia.regenerer` → « Régénérer » ; `loi.ia.introuvable`
- Erreurs : `chat.errorServer`, `chat.errorQuota`, `chat.errorOverloaded`, `chat.errorNetwork`, `common.retry`
- `nav.documents` → « Documents » ; `mode.chat` → « Assistant IA » (le nom accessible du bouton flottant)

### Clés à modifier
| clé | français actuel | français cible | anglais actuel → cible |
|---|---|---|---|
| `loi.ia.avertissement` | « Réponse générée par une IA. Vérifiez-la sur le texte de l'article ci-dessus. » | « Réponse générée par une IA. Vérifiez-la dans le texte de l'article. » | « AI-generated answer. Check it against the article text above. » → « AI-generated answer. Check it in the article text. » |

(Mettre à jour aussi `dictionnaires-de-test.ts` l. 182 et 358.)

### Clés nouvelles (proposées)
| clé | français | anglais |
|---|---|---|
| `loi.statut.pastille` | Version d'origine, non consolidée | Original version, not consolidated |
| `loi.statut.incomplet` | Ce relevé peut être incomplet. | This record may be incomplete. |
| `loi.ia.poser_question` | Poser une question sur cet article | Ask a question about this article |
| `loi.ia.question_modele` | Que dit l'article {n} de {nom} ? | What does article {n} of {nom} say? |
| `loi.navigation.voisins` | Articles voisins | Neighbouring articles |
| `loi.navigation.article_voisin` | Article {n} | Article {n} |
| `loi.sommaire.tout` | Tout le sommaire | Full contents |
| `loi.sommaire.articles_section` | {n} articles | {n} articles (réutilise `loi.sommaire.nombre` : ne créer que si le libellé diffère) |
| `loi.sommaire.puces` | Articles de la section | Articles in this section (nom accessible de la liste de puces) |

Notes : « Article {n} » existe sous `loi.article` + numéro ; ne créer `loi.navigation.article_voisin` que si la mise en forme l'exige (`loi.article` suivi du numéro suffit, avec le « er » du premier). Le texte de `loi.statut.pastille` sans point final est voulu (maquette) ; `loi.statut.origine` garde son point pour l'aperçu du chat. Pas de nouvelle clé pour « Copier la référence/le lien », « Précédent/Suivant », « Régénérer » ni « Expliquer l'article ».

---

## 9. Données ou API que la maquette suppose et que le produit n'a peut-être pas

1. **Passages à surligner** (`key` et `sub`) : la maquette les écrit à la main. Aucun champ du produit ne les fournit : `GET /laws/{id}` ne renvoie pas de « passages clés » ; `POST /laws/{id}/explain-article` ne renvoie que `{explanation}`. À valider avec le backend : (a) un champ `passages: [{texte, role}]` ajouté à la réponse d'`explain-article` (les passages ne seraient alors connus qu'**après** le clic, ce qui change la mise en scène : surlignage et trait apparaîtraient à l'arrivée de la réponse, « citer », au lieu d'exister dès le chargement) ; (b) un endpoint à part ; (c) rien côté serveur, et surlignage des termes de la recherche (`?q=`, à ajouter aux liens de `SearchResultCard`/`adresseDeLArticle`, `api-publique.ts` l. 189, qui n'emporte aujourd'hui que `?article=`).
2. **Réponse découpée en deux blocs « Contenu clé » / « Implications »** : la réponse réelle est un texte (`explanation`) rendu par `blocsDeReponse` (titres, puces, paragraphes). La maquette montre deux paragraphes préfixés. Le rendu doit suivre le texte réel ; l'effet « écrire » s'applique aux blocs obtenus, sans supposer un format.
3. **Réponse en flux** : la maquette simule une écriture phrase par phrase ; l'API répond d'un bloc. L'effet est donc un fondu échelonné des blocs reçus, pas un vrai flux.
4. **Contexte d'article pour l'assistant** : voir 2.6 et étape 9. `/chat?q=` ne transmet que du texte.
5. **Statut** : « Ce relevé peut être incomplet. » est un avertissement constant ; aucune donnée en plus. La date du relevé (`statut.releve_le`) existe (`dateDuReleve`). La maquette ne montre que l'état « origine » : les états modifié, consolidé, abrogé, remplacé n'ont pas de maquette.
6. **Sommaire** : la maquette suppose le découpage par section (« Section III … 4 articles ») : `decoupe.divisions` le fournit déjà (`plageDArticles`, `enTetePrincipal`). Aucune donnée manquante.
7. **Voisins** : le libellé « Article 36 » / « Article 38 » des boutons vient de `articles[rangCourant ± 1].numero` : disponible. Pour un homonyme (Code civil), le numéro seul est ambigu : utiliser `numero` tel quel comme le fait déjà `adressePartageable`.
8. **Titre « Loi n° 92/007… » avec espaces insécables** : la capture « existant » montre le titre brut du corpus (« Loi N°92/007 du 14 août 1992… ») ; la maquette l'a normalisé à la main. Rien dans le produit ne le fait. Ne pas réécrire un intitulé officiel (voir Q6).
9. **Domaine et nom court du fil** : `law.category.name` et `nomCourtDuTexte` existent (`nomCategorie`). Le « Code du travail » de la maquette est un nom d'usage ; le produit calcule « Loi n° 92/007 » (`nomCourtDuTexte`) : le libellé diffère.

---

## 10. Pièges, risques et questions ouvertes

### Questions pour le propriétaire (à poser avant l'étape 5-6)
- **Q1. Fonctions absentes de la maquette** : l'agent codeur ne doit pas supprimer sans réponse : « Partager » du texte (`law-share`), « Télécharger », « Document original » (`ImagePdfViewer`), onglet « Historique (N) » et sa pastille de liste (`#historique`), bascule « Texte entier », « Copier le texte », compteur n/N, badge de type, date de signature, « Ajouté à JuriX le », encadré d'article (`StatutDeLArticle`), filtre et premiers mots du sommaire. Elles portent des décisions antérieures (P1, P2, P10). Plan par défaut : toutes conservées, mises au second plan.
- **Q2. D'où viennent les passages surlignés ?** Voir 9 : trois options. Sans réponse, v1 = pas de surlignage (aucune ancre), note en haut de la marge.
- **Q3. Fil d'Ariane collant** : la maquette n'a pas de fil collant ; le dépôt en a un qui porte la chaîne de divisions et `Article N` (testé : `ux-r3`, `ux-complements`). Garder (défaut) implique `top` du sommaire à 96 px (`lg:top-24` actuel) et pas 24 px.
- **Q4. Sommaire** : la maquette montre une seule section de 4 articles sans filtre. Sur le Code civil (2 041 articles), les puces sous 1024 px ne peuvent pas lister tout le texte. Défaut : colonne et puces = section de l'article lu ; le sommaire complet (filtre, toutes les divisions) reste dans la feuille modale.
- **Q5. « Début du texte »** : lien de la maquette ; son rôle exact (ouverture ? texte entier ?) n'est pas défini.
- **Q6. Titre** : afficher « Loi n° 92/007 » avec espace insécable (normalisation d'affichage) ou le titre brut du corpus ?
- **Q7. Bouton flottant** : le garder avec le lien « Poser une question » ? (Défaut : oui.)
- **Q8. Geist Mono** pour le fil d'Ariane : contraire à la convention du dépôt (chasse fixe réservée aux codes) ; défaut : Inter.
- **Q9. En-tête** (hors de cette zone) : la maquette passe en burger sous 1024 px, le dépôt à `xl` (1280 px) (`SiteHeader.svelte`, partagé : « Le menu burger » relève de la carte de l'en-tête). Libellés de navigation de la maquette (« Assistant IA, Parcourir, Comparer, Blog ») différents de ceux du dépôt (Accueil, Documents, Blog, Recherche, Comparer, À propos).
- **Q10. États non maquettés du statut** (modifié, consolidé, abrogé, remplacé) : les restyler comme la pastille ? Défaut : inchangés.

### Pièges techniques
- **Ordre des `$:`** (Svelte 5 legacy) : un `$:` qui lit `numeroEcrit`/`nomCourt` doit venir après eux. Déjà cause d'une régression (« Chargement… » sur la page).
- **`{#key}` autour de l'article** : à éviter (focus du titre, état des actions, scintillement).
- **`retenirLeBouton` / `ChatFab eviter`** lisent `#contenu` : si `#contenu` devient pleine largeur et sans carte, le comportement du bouton flottant change (voir étape 9). La règle de `ChatFab` : « il reste affiché quand la colonne s'arrête avant lui ».
- **ChatFab et la note** entre 1280 et 1439 px : le bord droit de la note est à `100vw − 48 px`, le bouton occupe `100vw − 96 px` à `100vw − 32 px` : chevauchement possible, d'où la zone `data-hors-du-bouton` sur la note.
- **`overflow-x: clip`** sur la colonne animée : `overflow: hidden` casserait `position: sticky` du sommaire s'il est dans le même conteneur de défilement ; `clip` non. Vérifier sur Safari ancien (support de `clip` : 16+) ; repli : `overflow-x: hidden` sur le seul `.read`, jamais sur un ancêtre du sommaire collant.
- **Polices Literata** en `font-display: swap`, sans préchargement : les lignes se recomposent à l'arrivée de la police, donc la position du `<mark>` change. L'ancrage doit se refaire sur `document.fonts` (étape 7) ; sans cela le trait vise la mauvaise ligne.
- **`ResizeObserver` dans `jsdom`** : absent ; garder un repli (`typeof ResizeObserver === 'undefined'`), comme `ChatFab`.
- **Animations d'entrée et LCP** : le `h1` est rendu par le serveur ; lui donner `opacity: 0` au départ retarde le premier affichage. Ne rien cacher au chargement : n'animer que des éléments secondaires (pastille, note).
- **Règle « une seule chose animée à la fois »** : tampon (0,8-1,5 s), surlignage (0,9-1,1 s), note (0,9-1,6 s), trait (1,2-1,9 s) et point (1,8-2,2 s) se chevauchent dans la maquette. Les échelonner réellement (statut → passage → note → trait) ou en supprimer ; `Mouvement.dc.html` le demande lui-même.
- **Feuilleter et défilement** : `allerAuDebutDeLArticle()` fait un `scrollIntoView` lissé en même temps que l'animation : acceptable, mais sur un long article le glissement se joue hors écran ; mesurer à la main sur un téléphone.
- **Anciennes captures de `Texte`** ne sont pas la cible : elles montrent encore « Copier le lien + Partager » et la note sous le texte à 1440 px.
- **Dépassement des courbes** (`cubic-bezier(.3,1.5,.5,1)`) : visibles sur le repère du sommaire (`tind`) ; en contradiction avec « pas de rebond décoratif » : à valider visuellement avec le propriétaire.
- **Séparation du sommaire** (200 px) : « Art. 1er » avec la marque « · modifié » peut ne pas tenir sur 200 px (le sommaire actuel est à 280 px) ; prévoir `truncate` et un `title`.
- **Texte entier** : le sommaire de 200 px et `TexteEntier` (`max-w-[40.5rem]`) doivent cohabiter ; la colonne de lecture passe à `34em` en article par article seulement. Les `law-full-text` (articles `id="art-*"`) restent.
- **Textes de 1,3 Mo et 2 041 articles** : le rendu du sommaire reste côté client au-delà de 400 articles (`SEUIL_DU_SOMMAIRE_AU_SERVEUR`) ; les puces ne doivent pas le contourner (ne rendre que les articles de la division courante : quelques dizaines au plus, sauf divisions géantes).
- **Sans JavaScript** (inoffensif) : le HTML rendu par le serveur montre le premier article, le statut, la pastille tamponnée (CSS), la note en repos, le lien `law-ask` (un lien), les actions de copie sont inertes (présentes mais sans effet : comme aujourd'hui), les puces/liens `#art-N` des autres articles sont inertes (l'article n'est pas dans le DOM), l'ancrage, le surlignage et le feuilletage n'existent pas. Rien ne doit être caché tant que `monte` est faux.
