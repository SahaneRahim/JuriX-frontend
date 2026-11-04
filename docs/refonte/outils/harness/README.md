# Lire et rejouer les maquettes en local

Les maquettes (`../../maquettes/*.dc.html`) sont écrites pour le moteur « Design Component » de l'outil de conception : un gabarit HTML avec des trous `{{variable}}`, des blocs `<sc-if value="{{x}}">` et `<sc-for list="{{liste}}" as="q">`, des événements `onClick="{{fonction}}"`, et une classe `Component extends DCLogic` dont `renderVals()` renvoie les valeurs du gabarit. **Se lisent comme du HTML + CSS + JavaScript** : le CSS est dans `<helmet><style>`, le gabarit dans `<x-dc>`, la logique dans `<script type="text/x-dc">`.

Ce dossier contient un **mini-moteur local** (`runtime.js`, ~150 lignes) qui rend ces fichiers dans Chromium, pour les voir tourner sans l'outil de conception. Ce n'est pas le vrai moteur (même syntaxe, mêmes CSS, mais un rendu simplifié) : suffisant pour regarder, mesurer et rejouer les interactions ; pas pour juger la finesse du rendu des polices.

## Prérequis
Node ≥ 18 et Playwright avec Chromium (`npm i -D playwright` puis `npx playwright install chromium`, dans un dossier à part : ne pas l'ajouter au dépôt JuriX). Les maquettes demandent leurs polices à `fonts.googleapis.com` ; sans réseau, elles retombent sur les polices du système (les retours à la ligne diffèrent légèrement du site, qui auto-héberge Inter et Literata).

## Rendre une maquette en image
```bash
node render.cjs <maquette.dc.html> <sortie.png> <largeur> <hauteur> [clair|sombre] [reduit|mouvement] [attente_ms]
node render.cjs ../../maquettes/RefonteAssistant.dc.html /tmp/assistant.png 1440 900 clair reduit 500
```
`reduit` (défaut) = `prefers-reduced-motion: reduce` : l'état FINAL de chaque maquette s'affiche tout de suite. `mouvement` joue les animations et les séquences chronométrées.

## Scénario d'interaction (cliquer, mesurer)
```bash
MOTION=1 node interact.cjs <maquette> <largeur> <hauteur> <scenario.cjs>
```
`scenario.cjs` exporte `async (page, log) => { … }` (API Playwright). Variable `MOTION=1` : animations actives.

## Captures d'états à des instants donnés
```bash
node capture.cjs <maquette> <largeur> <hauteur> <clair|sombre> <1|0> <spec.json> <dossier>
# spec.json : [{"at":4400,"shot":"nom"},{"click":"css"},{"role":"button","name":"texte"},{"hover":"css"},{"press":"Escape"},{"scroll":[".main",9999]},{"eval":"js"},{"wait":500,"shot":"nom"}]
```
`at` = millisecondes depuis le chargement (séquences chronométrées : par exemple l'assistant tape sa question de 2,9 s à 5,7 s, étapes de 6,3 s à 9,6 s, réponse à 9,6 s).

Le fichier `../extraction.json` liste, par maquette, les variables de couleur, les `@keyframes` et les déclarations d'animation extraites automatiquement.
