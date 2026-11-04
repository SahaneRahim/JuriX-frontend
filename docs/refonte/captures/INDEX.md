# Index des captures

Rendues dans Chromium avec le mini-moteur de `../outils/harness/`, **sans les vraies polices** (repli système : les retours à la ligne diffèrent légèrement du site réel). Elles montrent l'état FINAL de chaque maquette, sauf `etats/` qui montre les états intermédiaires.

## planches/ — les écrans cibles (clair et sombre)
| Fichier | Écran | Taille |
|---|---|---|
| `RefonteAccueil-*` | Accueil, bureau (page entière) | 1440 × 2260 |
| `RefonteMobileAccueil-*` | Accueil, téléphone | 390 × 844 |
| `RefonteAssistant-*` | Assistant + panneau « Articles cités » | 1440 × 900 |
| `RefonteMobilePreuves-*` | Assistant, téléphone, feuille « Articles cités » ouverte | 390 × 844 |
| `RefonteLecture-*` | Lecture d'un article + note « Explication simplifiée (IA) » | 1440 × 1040 |
| `RefonteRecherche-*` | Résultats de recherche | 1440 × 900 |
| `Mouvement-*` | Catalogue des 8 gestes et règles | 1440 × 1140 |
| `Comparer-*` | Page /compare animée (structure actuelle du site) | 1440 × 1140 |

## etats/ — les états intermédiaires (clair)
- `accueil-01…04` : défaut, profil « Étudiant en droit », « Sans profil », mode « Recherche » ; `accueil-05` frappe de l'exemple ; `accueil-06` tuile de domaine survolée ; `accueil-07…09` démonstrations « Ce que JuriX vous montre » (à l'arrivée, au repos, au survol d'une carte).
- `accueil-mobile-01…03` : défaut, défilé jusqu'aux domaines, menu burger ouvert.
- `assistant-01…07` : accueil vide, frappe, attente « Recherche dans les textes… » (balance + squelettes), attente « Rédaction… », réponse + articles cités, puce « faute lourde » (autre passage), article 35.
- `assistant-mobile-01…03` : réponse avec la barre « N articles cités », feuille ouverte, menu burger ouvert.
- `lecture-01…04` : défaut, explication IA en attente (balance + squelette), résultat, article 35.
- `recherche-01…04` : frappe, chargement (balance + squelettes), résultats, filtre « Décrets ».

## references-existant-anime/
Captures de l'ancienne structure avec animations (`Main`, `Recherche`, `Texte`, `Chat`, `Assistant`) : **références de mouvement seulement, NE PAS implémenter ces écrans**.
