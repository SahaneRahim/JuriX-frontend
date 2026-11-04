# A2 — Le mouvement de JuriX : spécification et code de référence

Source de vérité visuelle : `maquettes/Mouvement.dc.html` (catalogue des 8 gestes, rejouable en boucle) et les maquettes `Refonte*.dc.html` (les gestes en situation). Les extraits ci-dessous sont copiés des maquettes ; les noms de classes sont ceux des maquettes, à renommer avec le préfixe `mv-` (obligatoire : § 2.5).

## 1. Principe

> Chaque animation reprend un geste du droit (peser, surligner, tamponner, citer). Elle dit ce qui se passe, puis s'efface.

Trois règles de la maquette `Mouvement.dc.html` :

1. **Un geste, un sens.** Pas de rebond décoratif : si rien n'est dit, rien ne bouge.
2. **L'IA bouge pour dire où elle en est.** Elle pèse, cherche, rédige ; jamais pour impressionner.
3. **Une seule chose animée à la fois.** L'étape en cours, le résultat qui arrive ; le reste attend.

Réglages communs :

| Réglage | Valeur |
|---|---|
| Durées | trois repères : **150 ms** (toucher), **300 ms** (changement d'état), **800 ms** (arrivée d'une page ou d'un bloc) ; les durées exactes de chaque geste sont celles des § 3 et § 4 (250 à 350 ms pour les survols). Les gestes expressifs (tampon, citation, balance) dépassent un peu, jamais 1 s, sauf l'introduction du logo (1,9 s, une seule fois), les boucles d'attente (balance : 1,5 s) et le compte du corpus (1,3 s, optionnel) |
| Courbe | **une seule pour les arrivées et les changements d'état** : `cubic-bezier(.22, 1, .36, 1)` (départ vif, arrivée posée) ; les boucles d'attente (balance `ease-in-out`, squelette `linear`, curseur `steps(1)`) et l'anneau `ring` (`ease-out`) ne sont pas des arrivées : ils gardent la courbe de leur extrait. Exceptions assumées : ressort `cubic-bezier(.3, 1.6, .5, 1)` pour la citation et les petites confirmations, `cubic-bezier(.3, 1.5, .5, 1)` pour le tampon. **Les pastilles qui glissent (profil, mode), le repère du sommaire, la bulle d'envoi et l'icône agrandie de l'onglet du bas n'ont pas d'exception** par défaut (décision X2 de `PASSATION.md` : courbe commune) ; les maquettes y mettent `cubic-bezier(.34, 1.35, .5, 1)`, `(.34, 1.3, .5, 1)`, `(.3, 1.25, .5, 1)` et `(.3, 1.6, .5, 1)` : **ne pas les reprendre** ; c'est l'alternative prévue si le propriétaire préfère ce léger dépassement (une constante à changer) |
| Décalage | selon l'élément : **40 à 70 ms** pour les petits éléments d'une liste (tuiles 45 ms, onglets 50 ms, pastilles 70 ms) ; 70 ms (questions fréquentes après un changement de profil) ; 90 ms (suggestions du chat) ; **80 ms plafonné à 5 rangs** pour les lignes de résultats (`PASSATION.md` R9 ; la maquette dit 120 ms) ; 150 ms pour les gros blocs (cartes d'articles). La règle « 40–60 ms » de `Mouvement.dc.html` ne vaut que pour les petits éléments |
| Propriétés animées | `transform`, `opacity`, `filter: blur()` ; `background-size` (surlignage) ; `grid-template-rows` 0fr→1fr (déroulé). Jamais `top/left/width/height` |

## 2. Règles techniques (apprises en construisant les maquettes : à respecter)

### 2.1 Mouvement réduit : l'état de base EST l'état final

Les maquettes coupent tout avec une règle globale (`.jx * { animation: none !important; transition: none !important }`) : c'est un raccourci de maquette. **Ne pas la copier dans le site** (trop large). Le dépôt garde par animation : `@media (prefers-reduced-motion: no-preference) { … }` autour des animations et des transitions décoratives, ou les variantes Tailwind `motion-safe:` / `motion-reduce:` (42 occurrences dans 22 fichiers de `src`), ou `prefersReducedMotion` de `svelte/motion` (déjà importé par `SiteHeader.svelte`) pour les minuteries JavaScript.

Cela n'est correct que si **le style statique de chaque élément est son état final visible** : ne jamais écrire « caché au repos, révélé par l'animation » sans prévoir le cas où l'animation n'a pas lieu. Sous mouvement réduit : plus de frappe animée (le premier exemple s'affiche, sans curseur), plus de défilement automatique, la balance reste droite, les statuts, surlignages, puces et cartes apparaissent d'un coup, lisibles. Un test e2e le vérifie (`page.emulateMedia({ reducedMotion: 'reduce' })`).

### 2.2 `fill-mode` : `backwards`, presque jamais `both`

Un `animation-fill-mode: both` (ou `forwards`) **fige la dernière image et écrase le CSS statique** : un `:hover { transform: translateY(-4px) }` n'a alors plus aucun effet sur la tuile qui vient d'apparaître. Pour toute animation d'ENTRÉE sur un élément qui a un état `:hover`/`:focus`/`:active` avec `transform`, utiliser `animation-fill-mode: backwards` (l'élément est masqué pendant le délai, puis l'animation s'efface devant le style statique). Écrire de même les `@keyframes` d'entrée **sans `to`** : `@keyframes fade { from { opacity: 0 } }`, pour que l'arrivée se fasse vers l'opacité réelle de l'élément (certains éléments sont à 0,85 ou 0,55 au repos : la pile de cartes sous le champ).

Toutes les entrées des § 3 s'écrivent en `backwards` (le dernier `@keyframes` égale le style statique) : les extraits ci-dessous le font. Seul `forwards` est conservé, sur le pseudo-élément `ring` de la pastille de statut (`opacity: 0` au repos : invisible avant son délai).

### 2.3 Rejouer une animation

CSS ne rejoue pas une animation dont on remet le même nom. Deux techniques, utilisées dans les maquettes :

- **Alterner deux noms identiques** (`@keyframes sqa` et `@keyframes sqb` au contenu identique, classe `.fa`/`.fb` qui bascule à chaque changement de profil) ; ou `tnA/tnB/tpA/tpB` pour le feuilletage des articles (suivant/précédent × A/B).
- **Re-créer l'élément.** En Svelte : `{#key valeur} … {/key}` (le bloc est détruit et recréé, l'animation d'entrée se rejoue). À préférer pour une liste ou un bloc simple (`{#key persona}` sur les questions fréquentes) ; **jamais sur la page de lecture** (§ 3.6 : le titre qui reçoit le focus y serait détruit).

Ne pas faire jouer à la sortie d'un survol l'animation d'entrée : dans `Comparer.dc.html` et les maquettes « existant animé », `.logo:hover .bal .bm { animation: bm2 … }` rejoue la balance quand le pointeur part (le nom d'animation repasse à `bm`) : défaut de ces anciennes maquettes, déjà retiré des écrans de la refonte. **Décision : pas d'animation de balance au survol du logo.** L'introduction (une fois, au chargement) suffit.

### 2.4 Performance et rendu serveur (le dépôt y tient)

- **Le LCP ne doit pas attendre une animation.** Dans les maquettes, le champ unique de l'accueil arrive avec `rise .8s … .65s backwards` : c'est une MISE EN SCÈNE de maquette. En production, **le titre (h1) et le champ n'ont aucun délai initial (le premier mot du titre part à 0 ms ; échelonnement de 30 ms entre mots) ni durée > 0,5 s**, ou aucune animation d'entrée ; l'échelonnement (délais de 40 à 150 ms) ne vaut que pour les éléments secondaires (suggestions, tuiles, cartes). Les pages `/`, `/laws/[id]`, `/search` sont rendues par le serveur : tout contenu doit être lisible sans JavaScript et ne jamais rester masqué si l'hydratation tarde (voir `tests/e2e/navigation/avant-hydratation.spec.ts`).
- Aucune animation **infinie** hors états d'attente réels (balance qui oscille pendant la recherche, squelettes pendant le chargement) et le curseur du champ ; elles s'arrêtent avec l'attente. (La pile d'ouvrages qui respire dans l'état vide du panneau « Articles cités » est le seul décor : à arrêter dès la première citation, ou à supprimer.)
- Les minuteries des maquettes (frappe, étapes de la réponse, ouverture automatique de la feuille mobile) sont des **simulations**. En production, les animations se branchent sur l'**état réel** de la requête (voir `cartes/assistant-preuves.md`, états de la réponse). L'ouverture automatique de la feuille mobile (`AUTO_SHEET`) n'existe QUE pour la planche de présentation : ne pas la reproduire.
- Les démonstrations de la section « Ce que JuriX vous montre » (accueil) se jouent **une fois** quand le bloc entre dans l'écran (IntersectionObserver), puis au survol de chaque carte ; l'état de repos est l'état final visible. Sans JavaScript ou en mouvement réduit : l'état final, c'est tout.

### 2.5 Où ranger le code de mouvement (décision de cette passation)

Un seul module partagé, pas cinq copies : **`src/lib/mouvement.css`**, importé par `import "$lib/mouvement.css";` dans `src/routes/+layout.svelte`, juste après `import "../app.css";` (pas par un `@import` dans `app.css` : une règle `@import` n'est valide qu'avant toute autre règle, et `app.css` commence par des `@font-face`). Il contient les `@keyframes` des gestes (A2 § 3 et § 4) et les classes `mv-*` (`mv-monter`, `mv-fondre`, `mv-ressort`, `mv-surligner`, `mv-tamponner`, `mv-citer`, `mv-ecrire`, `mv-feuilleter-*`, `mv-derouler`…), **toutes les animations déclarées dans `@media (prefers-reduced-motion: no-preference)`**. **Nommage** : tous les `@keyframes` et toutes les classes de `mouvement.css` sont préfixés `mv-` ; **jamais** `spin`, `pulse`, `ping`, `bounce` (noms de Tailwind : un `@keyframes spin` ici, chargé après `app.css`, remplacerait celui de `animate-spin`, que la palette, `SearchBar`, `EtatDeLaReponse` et l'administration emploient) : les gestes d'icône du § 4 s'appellent `mv-icone-spin`, `mv-icone-flip`, etc. **Test** : `src/lib/mouvement.test.ts` lit le fichier (`readFileSync`) et vérifie qu'aucun `@keyframes` n'est hors d'un bloc `prefers-reduced-motion: no-preference` et que tous sont préfixés `mv-`. Les délais d'échelonnement passent par une variable (`style="--d: 120ms"`). La courbe est un jeton : `theme.extend.transitionTimingFunction.jx = 'cubic-bezier(.22,1,.36,1)'` dans `tailwind.config.js` (classe `ease-jx`). Les styles propres à un seul composant (ex. la mise en page de la note de lecture) restent dans son `<style>`. Les cartes `cartes/*.md` proposent des noms différents (`jx-*`, `tamponner`…) : **les noms d'ici l'emportent**.

Les deux composants Svelte communs : `BalanceAnimee.svelte` (balance : intro, attente) ; si besoin d'un déclencheur d'entrée dans l'écran (démonstrations de l'accueil), une action `entrerDansLEcran` (IntersectionObserver, `src/lib/actions/`).

## 3. Les huit gestes

Les noms des extraits des §§ 3.2 à 3.8 sont ceux des maquettes ; dans `mouvement.css`, tout est préfixé `mv-` : `mv-surligner`, `mv-tamponner`, `mv-tamponner-bague`, `mv-citer`, `mv-ecrire`, `mv-mot`, `mv-feuilleter-suivant-a` / `-b`, `mv-feuilleter-precedent-a` / `-b`, `mv-derouler`… (la balance : `mv-balance…`, § 3.1).

### 3.1 Peser — la balance (logo, attente de l'IA)

**Sens.** La balance du logo pèse : introduction du logo (une fois), puis « l'IA pèse » pendant toute attente réelle : recherche en cours dans le chat, comparaison, explication d'un article, chargement des résultats de recherche. À l'arrivée du résultat, elle s'arrête et se remet droite.

**Structure.** L'icône « scale » de Lucide, dont les 5 tracés sont regroupés : le fléau pivote, **les plateaux contre-pivotent pour rester à l'horizontale**. Ce n'est pas l'icône du registre telle quelle : composant dédié `BalanceAnimee.svelte` (construction sur `elementsIcone('scale')` : `A6-icones.md` § 3). **Contrat de nommage** : les classes `bm` / `pl` / `pr` et les `@keyframes bm` / `pn` des maquettes sont renommés comme ci-dessous.

```html
<svg class="icone mv-balance mv-balance--{etat}" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true"
     fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 3v18"/><path d="M7 21h10"/>
  <g class="mv-balance__fleau">                                                  <!-- ex-.bm : le fléau -->
    <path d="M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1"/>
    <g class="mv-balance__plateau-g"><path d="m5 8 3 8a5 5 0 0 1-6 0zV7"/></g>   <!-- ex-.pl -->
    <g class="mv-balance__plateau-d"><path d="m19 8 3 8a5 5 0 0 1-6 0zV7"/></g>  <!-- ex-.pr -->
  </g>
</svg>
```
(`stroke-width="1.75"` et `1em` sont ceux de `Icone.svelte` ; la maquette met 2.) **Les `@keyframes` et les états `--intro` / `--attente` vivent dans `mouvement.css`, sous `prefers-reduced-motion: no-preference`** ; les trois règles de géométrie (`transform-box`, `transform-origin`) restent hors du bloc (elles ne produisent aucun mouvement) ; le composant n'écrit que le balisage.

```css
.mv-balance__fleau     { transform-box: view-box; transform-origin: 12px 5px }
.mv-balance__plateau-g { transform-box: view-box; transform-origin: 5px 7px }
.mv-balance__plateau-d { transform-box: view-box; transform-origin: 19px 7px }

@media (prefers-reduced-motion: no-preference) {
  /* introduction du logo : une fois, 1,9 s, après 0,35 s */
  .mv-balance--intro .mv-balance__fleau { animation: mv-balance-fleau 1.9s cubic-bezier(.22,1,.36,1) .35s backwards }
  .mv-balance--intro .mv-balance__plateau-g,
  .mv-balance--intro .mv-balance__plateau-d { animation: mv-balance-plateau 1.9s cubic-bezier(.22,1,.36,1) .35s backwards }

  /* attente réelle : en boucle tant que l'attente dure */
  .mv-balance--attente .mv-balance__fleau { animation: mv-balance-fleau 1.5s ease-in-out infinite }
  .mv-balance--attente .mv-balance__plateau-g,
  .mv-balance--attente .mv-balance__plateau-d { animation: mv-balance-plateau 1.5s ease-in-out infinite }

  @keyframes mv-balance-fleau   { 0%{transform:rotate(0)} 18%{transform:rotate(-11deg)} 42%{transform:rotate(7deg)} 66%{transform:rotate(-3.5deg)} 84%{transform:rotate(1.4deg)} 100%{transform:rotate(0)} }
  @keyframes mv-balance-plateau { 0%{transform:rotate(0)} 18%{transform:rotate(11deg)} 42%{transform:rotate(-7deg)} 66%{transform:rotate(3.5deg)} 84%{transform:rotate(-1.4deg)} 100%{transform:rotate(0)} }
}
```

**Introduction du logo : une fois par chargement du document**, pas à chaque navigation interne (`SiteHeader` est recréé à chaque page) : `PASSATION.md` E2 (`introDejaJouee`, lu et écrit côté navigateur seulement).

Dans `Mouvement.dc.html` la version « catalogue » boucle en 3,4 s (`bmL`/`pnL`) avec une pause : c'est du catalogue, pas du produit. Mouvement réduit : balance droite, aucune animation. Accessibilité : la balance est décorative (`aria-hidden`) et **ne porte jamais de `role`** ; l'attente est dite par le texte d'étape du composant appelant. Recherche, comparaison, note de lecture : ce texte est dans la région `role="status"` de la page. **Dans le chat, ne PAS en ajouter** : la seule région d'annonce est `chat-announce` (`PASSATION.md` § 8, piège 12).

### 3.2 Surligner — le passage cité, les mots cherchés

**Sens.** Montrer, dans le texte officiel, le passage qui soutient une phrase de la réponse (aperçu des articles cités, page de lecture) ou les mots cherchés (extrait d'un résultat de recherche).

**Deux dessins, un geste** : un fond de marqueur (zinc-300 / zinc-600 en sombre) ET un soulignement de 2 px de la couleur d'encre, tous deux dessinés par `background-size`. Le soulignement porte l'information quand le fond est trop discret (contraste du marqueur 1,5:1 sur blanc : il n'est JAMAIS seul porteur du sens). Élément : `<mark>` (sémantique), pas un `<span>`.

```css
.surligne {                      /* passage cité (aperçu, lecture) */
  color: inherit; background-color: transparent;
  background-image: linear-gradient(var(--hl), var(--hl)), linear-gradient(var(--ink), var(--ink));
  background-repeat: no-repeat;
  background-position: 0 92%, 0 100%;
  background-size: 100% .42em, 100% 2px;           /* état final = état de repos */
}
.surligne.joue { animation: hl .9s cubic-bezier(.22,1,.36,1) backwards }   /* délai: --d */
@keyframes hl { from { background-size: 0 .42em, 0 2px } }

.extrait strong {                /* mots cherchés dans un résultat : gras + soulignement */
  font-weight: 600; color: var(--tx);
  background-image: linear-gradient(var(--ink), var(--ink));
  background-repeat: no-repeat; background-position: 0 100%; background-size: 100% 2px;
}
.extrait.joue strong { animation: ul .8s cubic-bezier(.22,1,.36,1) backwards }
@keyframes ul { from { background-size: 0 2px } }
```

Dans l'assistant, l'activation est **par passage** : `.ps` (hors état actif : `background-size: 0 .42em, 0 2px`) bascule en `.ps.on` (`100% .42em, 100% 2px`) avec `transition: background-size .8s var(--ease)` ; une seule citation active à la fois (voir `A1-ecrans.md`, écran Assistant). Le dépôt a décidé (commentaire de `SearchResultCard.svelte`) de mettre les mots cherchés en `<strong>` et **pas** en `<mark>` à fond gris : on garde ce choix pour les résultats de recherche (gras + soulignement fin).

### 3.3 Tamponner — le statut d'un texte

**Sens.** Le statut d'un texte (« Version d'origine, non consolidée », « Modifié », « Abrogé ») se **pose une fois**, avec son onde d'impact ; jamais en boucle. Statut = un mot + une icône, jamais la couleur seule (le site n'a que du zinc).

```css
.statut .i { animation: stamp .7s cubic-bezier(.3,1.5,.5,1) .35s backwards }   /* page de lecture : voir `.pastille` ci-dessous (`stampb`, délai .8 s) */
@keyframes stamp { 0%{opacity:0;transform:translateY(-14px) scale(1.9) rotate(-16deg)} 60%{opacity:1;transform:translateY(0) scale(.88) rotate(3deg)} 80%{transform:scale(1.07) rotate(-1deg)} 100%{transform:none} }

/* page de lecture : la pastille entière tombe (stampb) puis un anneau s'étend (ring) */
.pastille { animation: stampb .7s cubic-bezier(.3,1.5,.5,1) .8s backwards }
@keyframes stampb { 0%{opacity:0;transform:translateY(-16px) scale(1.5) rotate(-6deg)} 60%{opacity:1;transform:translateY(0) scale(.94) rotate(1deg)} 80%{transform:scale(1.04)} 100%{transform:none} }
.pastille::after { content:""; position:absolute; inset:-6px; border-radius:999px; border:2px solid var(--tx3); opacity:0;
                   animation: ring .9s ease-out .95s forwards }     /* forwards, pas backwards : invisible avant son délai ; .95 s et non 1,1 s : D9 */
@keyframes ring { 0%{opacity:.7;transform:scale(.6)} 100%{opacity:0;transform:scale(1.5)} }
```

Déclencheur réel : au **montage** de l'élément de statut (page de lecture) ou à la **sélection** de la carte d'un article (panneau des articles cités : le tampon se joue à l'ouverture de la carte, pas au chargement du panneau).

### 3.4 Citer — les puces d'articles

**Sens.** Chaque article qui soutient une phrase de la réponse se pose à côté de sa phrase.

```css
.cit { animation: popc .5s cubic-bezier(.3,1.6,.5,1) backwards; animation-delay: var(--d) }
@keyframes popc { 0%{opacity:0;transform:translateY(6px) scale(.6)} 100%{opacity:1;transform:none} }
```

Déclencheur réel : à l'événement `done` (les citations n'existent pas avant : `PASSATION.md` C11), puce par puce (décalage ≈ 350 ms). Les petites confirmations (« Référence copiée », coche du bouton « Copier ») utilisent le même ressort (`pop .45s`, de `scale(.4)` à 1).

### 3.5 Écrire — la réponse de l'IA

**Sens.** La réponse arrive phrase par phrase, du flou au net : pas de frappe lettre à lettre (la frappe est réservée au champ de saisie de l'accueil).

```css
.reponse .s { animation: blurin .8s cubic-bezier(.22,1,.36,1) backwards }
.reponse .s2 { animation-delay: .5s }                  /* décalage entre phrases : 450 à 500 ms */
@keyframes blurin { from{opacity:0;filter:blur(6px);transform:translateY(6px)} to{opacity:1;filter:none;transform:none} }
```

Déclencheur réel : à l'arrivée de chaque paragraphe ou phrase de la réponse (le flux du chat est incrémental : voir `cartes/assistant-preuves.md` pour la façon dont le dépôt découpe la réponse). Le titre « Réponse directe » est un nœud à part ; les citations sont posées après la phrase (3.4).

**Titre de l'accueil.** « Que dit la loi camerounaise ? » se révèle **mot à mot** (masque + translation), pas lettre à lettre. CSS de la maquette (le masque porte des marges de garde contre le rognage des jambages et des accents) **avec le réglage de production** :

```css
.h1 { display:flex; flex-wrap:wrap; justify-content:center; column-gap:.28em; line-height:1.12 }
.h1 .wd { display:inline-block; overflow:hidden; padding:.1em .04em .16em; margin:-.1em -.04em -.16em }
.h1 .wi { display:inline-block; animation: word .45s cubic-bezier(.22,1,.36,1) backwards;
          animation-delay: calc(var(--i) * 30ms) }                  /* production : --i = rang du mot, 0 pour le premier */
@keyframes word { from{transform:translateY(112%)} }
```
La maquette joue `word .9s … both` avec des délais de 150 à 510 ms : **mise en scène de présentation, à ne pas reprendre**. Règle LCP (§ 2.4) : le titre est dans le HTML du serveur ; **aucun délai initial** (le premier mot part à 0 ms, les suivants à 30 ms d'écart), durée ≤ 0,5 s, `transform` seulement ; sous mouvement réduit, le texte est simplement là. **Le `textContent` du `<h1>` reste strictement `Que dit la loi camerounaise ?`** : découper `accueil.titre` sur l'espace ordinaire U+0020 seulement (la clé contient une espace fine insécable avant le « ? », qui reste collé au dernier mot) et garder un vrai nœud texte U+0020 entre deux `<span class="wd">` (`accueil.serveur.test.ts` et `ux-accueil.spec.ts` lisent ce texte exact). Si une mesure Lighthouse avant/après montre un LCP dégradé, supprimer l'effet.

### 3.6 Feuilleter — passer d'un article à l'autre

**Sens.** La page glisse dans le sens de la lecture : de droite à gauche vers l'article suivant (`translateX(36px)` → 0), de gauche à droite vers le précédent (`translateX(-36px)` → 0), 0,55 s.

```css
@keyframes tnA { from{opacity:0;transform:translateX(36px)}  to{opacity:1;transform:none} }  /* suivant, variante A */
@keyframes tnB { from{opacity:0;transform:translateX(36px)}  to{opacity:1;transform:none} }  /* suivant, variante B (identique : redémarrage) */
@keyframes tpA { from{opacity:0;transform:translateX(-36px)} to{opacity:1;transform:none} }  /* précédent */
@keyframes tpB { from{opacity:0;transform:translateX(-36px)} to{opacity:1;transform:none} }
.art.nA{animation:tnA .55s cubic-bezier(.22,1,.36,1) backwards} .art.nB{animation:tnB .55s cubic-bezier(.22,1,.36,1) backwards}
.art.pA{animation:tpA .55s cubic-bezier(.22,1,.36,1) backwards} .art.pB{animation:tpB .55s cubic-bezier(.22,1,.36,1) backwards}
```
En Svelte, **ne PAS utiliser `{#key article}`** sur la page de lecture : il détruit `h2#titre-article` (qui reçoit le focus après un choix au clavier dans le sommaire) et l'état de `ActionsDeLArticle`, et la page clignote. Garder le bloc et alterner la classe `nA` / `nB` (suivant) ou `pA` / `pB` (précédent) à chaque navigation, comme la maquette. Noms de production : classes et `@keyframes` `mv-feuilleter-suivant-a`, `mv-feuilleter-suivant-b`, `mv-feuilleter-precedent-a`, `mv-feuilleter-precedent-b` (`tnA`… sont ceux de la maquette). L'animation ne s'applique qu'à la NAVIGATION entre articles (clics sur Précédent/Suivant/sommaire), jamais au premier affichage (rendu serveur).

### 3.7 Compter — le corpus

**Sens.** « 2 275 textes officiels » se compte à l'arrivée : 1,3 s, décélération cubique `1 - (1-k)^3`, sans que la phrase ne bouge (chiffres tabulaires `font-variant-numeric: tabular-nums`, largeur minimale `5ch`). Dans les maquettes d'accueil, ce compte n'est PAS animé (valeur fixe) ; le geste est défini dans `Mouvement.dc.html` pour usage éventuel. **Optionnel**, et le nombre doit venir de l'API (pas de constante).

### 3.8 Dérouler — plier et déplier en place

**Sens.** Vérifier une cellule, ouvrir une carte d'article, une section : le contenu se déplie en place, hauteur automatique, sans mesurer en JavaScript.

```css
.deroule      { display:grid; grid-template-rows: 0fr; transition: grid-template-rows .55s cubic-bezier(.22,1,.36,1) }
.deroule.ouvert { grid-template-rows: 1fr }
.deroule > div { min-height: 0; overflow: hidden }
.chevron { transition: transform .5s cubic-bezier(.22,1,.36,1) }       /* le chevron tourne de 180° */
.ouvert .chevron { transform: rotate(180deg) }
```
Utilisé par : cartes du panneau « Articles cités » (une seule ouverte à la fois). **Exceptions** : le message d'accueil du chat se replie à l'ENVOI par `max-height` → 0 en 0,7 s avec `opacity` en 0,35 s (A1 § 4, étape 2 ; `PASSATION.md` C8) ; « Voir le texte » de `/compare` : `transition:slide` de Svelte, `{#if}` conservé, durée 0 en mouvement réduit (`PASSATION.md` E7). Accessibilité : le bouton d'en-tête porte `aria-expanded` ; le contenu replié doit être inerte (`inert` ou `visibility: hidden` quand fermé) pour ne pas piéger la tabulation.

## 4. Micro-interactions (hors des huit gestes)

| Interaction | Réglage (maquettes) | Où |
|---|---|---|
| **Apparition** (`rise`) | `opacity 0 → 1` + `translateY(14–16px) → 0`, 0,6–0,8 s, courbe commune ; `animation-fill-mode: backwards` | blocs secondaires de chaque page, tuiles (maquette : `1,6 s + i × 45 ms` ; production : délai initial 0, puis `i × 45 ms`, § 2.4), lignes de résultats (`min(rang, 5) × 80 ms` : `PASSATION.md` R9 ; la maquette a `i × 120 ms`) |
| **Fondu** (`fade`) | `from { opacity: 0 }`, 0,3–0,8 s | piles de cartes sous le champ, fil d'Ariane, squelettes |
| **Pastille qui glisse** | pastille `position:absolute` de couleur d'encre derrière les boutons, `transform: translateX(<index × 100 %>)`, `transition .5s` en courbe commune (**défaut X2** ; la maquette a `.55s cubic-bezier(.34,1.35,.5,1)` pour le profil et `.5s` pour le mode, avec un léger dépassement) ; texte du bouton choisi passe à la couleur « sur encre » en 0,2 s | choix du profil (4 segments), du mode (2 segments) ; « Sans profil » : la pastille s'efface (`opacity 0`) |
| **Liste de questions** (`sqa`/`sqb`) | `from { opacity:0; transform: translateY(12px) }`, 0,55 s, délai `i × 70 ms` après changement de profil (`1,3 s + i × 80 ms` au premier chargement dans la maquette) | questions fréquentes |
| **Tuile de domaine** | survol : `translateY(-4px)` + bordure d'encre + ombre en 0,35 s ; l'icône joue un geste court (0,8 s) lié à son sens : `weigh` (civil), `tap` (pénal), `tilt` (travail), `press` (administration), `swing` (fonction publique), `sway` (environnement), `spin`/`flip` (traités, finances), `beat` (santé), `hop` (les autres) | accueil, 14 domaines. **À garder simple** : si l'agent doit réduire, ne garder que `hop` générique + `weigh` et `tap` pour les deux icônes dont le geste dit quelque chose |
| **Soulignement des liens** (en-tête) | trait de 2 px sous le libellé : `scaleX(0 → 1)` depuis la gauche en 0,35 s au survol et au focus clavier ; **déjà tracé** sous le lien courant (`aria-current`, texte en demi-gras) | en-tête, à partir de `lg` |
| **Icône du thème** | l'icône tourne de 22° au survol du bouton (0,35 s) ; la lune devient un soleil au changement de thème | en-tête |
| **Flèche ↗** | `translate(3px,-3px)` au survol, 0,35 s | tuiles, questions fréquentes, liens |
| **Envoi** | appui : `scale(.92)` en 0,18 s ; la bulle de l'utilisateur monte de 80 px (`send`, 0,6 s en courbe commune : X2 ; la maquette a `cubic-bezier(.3,1.25,.5,1)`) | chat |
| **Étapes de la réponse** | une ligne par étape (« Recherche dans les textes… », « N articles trouvés : … », « Rédaction de la réponse… ») avec coche qui se trace (`draw`, `stroke-dashoffset 24 → 0`, 0,45 s) ; la balance oscille sur l'étape en cours | chat (zone de réponse en attente) |
| **Squelette** | barres `linear-gradient(90deg, fill, bd, fill)` taille `200% 100%`, `shim 1.3s linear infinite` (`background-position 100% → -100%`) | cartes d'articles en attente, résultats, note IA |
| **Carte d'article** (`sin`) | `from { opacity:0; transform: translateX(44px) }`, 0,65 s, décalage `i × 150 ms` | panneau « Articles cités » à l'arrivée des cartes |
| **Feuille mobile** | `transform: translateY(100%)` → 0 en 0,6 s, `visibility: hidden` quand fermée (retardée de 0,6 s pour laisser finir la sortie), voile `opacity` 0,45 s | assistant < 1 024 px |
| **Menu mobile** | `translateY(-8px)` → 0 en 0,35 s, `opacity` en 0,25 s, `visibility` retardée de 0,35 s (**maquette** : panneau toujours dans le DOM ; le site le monte par `{#if mobileOpen}` : `in:fly` sans `visibility`, fermeture sans transition, voir `PASSATION.md` E2) | en-tête < 1 024 px |
| **Trait d'ancrage** | `sweep` : `scaleX(0 → 1)`, 0,7 s, délai ≤ 1 s (0,9 s ; la maquette dit 1,2 s) ; point `pop` : délai ≤ 1 s aussi (la maquette dit 1,8 s ; D9) | page de lecture, note IA |
| **Curseur** | `caret 1s steps(1) infinite` (clignote) ; masqué en mouvement réduit | champ de l'accueil (exemple tapé) |
| **Frappe de l'exemple** | une boucle par profil (en mode « Recherche » : **4 mots-clés fixes** `accueil.exemples.recherche.1…4` à la place des questions ; tout changement de profil ou de mode relance la frappe) : chaque exemple est tapé (38–72 ms par caractère), gardé 2,2 s, effacé (3 caractères par tick de 16 ms), puis le suivant ; **le dernier reste affiché** ; s'interrompt au focus ou quand le champ n'est pas vide, et repart à zéro au blur si le champ est resté vide ; absente en mouvement réduit (premier exemple affiché, avec le préfixe « Exemple : ») | accueil. Texte décoratif `aria-hidden`, doublé du vrai `<label>` |

## 5. Contrôle (à chaque écran)

- Mouvement réduit activé : aucune animation ni transition ; rien d'invisible ; le chat fonctionne ; aucune minuterie ne tourne.
- Réseau lent / JavaScript bloqué : le contenu est lisible, rien n'est masqué en attente d'une animation.
- Une seule chose animée à la fois dans l'écran de l'assistant (balance OU écriture OU citations, séquencées).
- Aucune animation ne déplace du texte déjà lu (pas de saut de mise en page : animer `transform`/`opacity`, réserver la place).
- Les cibles tactiles restent de 44 px pendant et après l'animation.
