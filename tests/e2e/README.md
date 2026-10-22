# Tests E2E - JuriX Frontend

Tests end-to-end (E2E) pour l'application JuriX utilisant Playwright.

## 🚀 Exécution des Tests

### Prérequis

```bash
# Installer les navigateurs Playwright (première fois uniquement)
npx playwright install
```

### Commandes

```bash
# Exécuter tous les tests
npm run test:e2e

# Exécuter les tests en mode UI (interface graphique)
npx playwright test --ui

# Exécuter les tests en mode debug
npx playwright test --debug

# Exécuter un fichier de test spécifique
npx playwright test tests/e2e/navigation/link-integrity.spec.ts

# Exécuter un seul projet (voir playwright.config.ts)
npx playwright test --project=chromium    # la suite habituelle, au viewport de bureau
npx playwright test --project=responsif   # le site sur six tailles d'écran

# Générer un rapport HTML
npx playwright show-report
```

## 📁 Structure

```
tests/e2e/
├── README.md                          # Ce fichier
├── hydratation.ts                     # Helpers : cliquer/saisir apres hydratation
└── navigation/
    ├── accessibilite.spec.ts          # axe sur les pages publiques
    ├── avant-hydratation.spec.ts      # les pages avant leur JavaScript
    ├── backend-down.spec.ts           # comportement backend eteint
    ├── chat-rendu.spec.ts             # rendu des reponses du chat
    ├── comparaison.spec.ts            # grille de comparaison sourcee
    ├── conversations.spec.ts          # panneau des conversations
    ├── explication-article.spec.ts    # bouton « Expliquer l'article »
    ├── inscription.spec.ts            # inscription et connexion
    ├── link-integrity.spec.ts         # aucun lien mort, rendu serveur
    ├── mot-de-passe-oublie.spec.ts    # recuperation de compte
    ├── panne-api.spec.ts              # API injoignable : 503 au rendu serveur
    ├── persona.spec.ts                # question du profil, chat selon le profil
    └── responsif.spec.ts              # six tailles d'ecran (projet responsif)
```

### Le serveur de test

`playwright.config.ts` construit le site (`npm run build`) puis le sert avec
`vite preview` sur le port 4173, et une seconde fois sur 4174 avec une API
injoignable (`panne-api.spec.ts`). Plus de `node build` : le site est déployé
sur Vercel (adapter-vercel), dont le build ne produit plus de serveur Node, et
`node build` relançait sans erreur un ancien build resté sur le disque.

Le site construit lit l'API sur `VITE_API_URL`, `http://127.0.0.1:8000` par
défaut : le même backend que celui que les specs interrogent. `localhost` est
réécrit en `127.0.0.1` à dessein : `src/lib/config.ts` prend
`http://localhost:8000` pour « rien de précisé » et, dans un build, se rabat sur
l'API de production.

### Les tailles d'écran : le projet `responsif`

`navigation/responsif.spec.ts` ouvre les pages du site (accueil, chat, `/laws`,
une loi, une catégorie, recherche, comparaison, à propos, connexion,
inscription, administration) sur six tailles : 360×740, 390×844, 740×360
(téléphone en paysage), 768×1024, 1024×768 (bascule de l'en-tête, pile sur
`lg`) et 1440×900. Les trois premières sont émulées en téléphone : balise
viewport prise en compte, écran tactile, agent Android. Sur trois téléphones
courts (320×568, 360×584, 375×553), elle vérifie en plus que le bouton
flottant de l'assistant ne couvre pas le bouton « Rechercher » de l'accueil.

Pour chaque page et chaque taille :

- la page ne glisse pas de côté (`scrollWidth <= innerWidth + 1`) ; en échec,
  le message nomme les éléments qui dépassent, avec leur bord droit ;
- une capture pleine page, `test-results/responsif/<page>-<largeur>x<hauteur>.png`,
  jointe au rapport HTML. Un test voit ce qui dépasse, pas ce qui est
  disgracieux : les captures sont à relire.

En plus : la saisie et le bouton d'envoi du chat restent dans l'écran, avant et
après une longue réponse ; sous 1 024 px, les conversations sont un tiroir qui
s'ouvre et se referme ; en 390×844, le champ de recherche de l'accueil se voit
sans défiler.

Le projet `chromium` ignore ce fichier : la suite habituelle ne change pas, et
`npm run test:e2e` lance les deux projets.

Le chat, la recherche, la comparaison et l'administration sont interceptés
(`page.route`) : aucun appel au modèle, aucun quota. L'accueil, `/laws`, une loi
et une catégorie sont rendus par le serveur, dont `page.route` ne voit pas les
appels : ils lisent la vraie API, et sont sautés quand elle est éteinte, sauf
avec `E2E_EXIGER_BACKEND=1`. Le clavier virtuel, la barre d'adresse qui se
replie et le zoom au doigt n'existent pas en émulation : ils se vérifient sur un
vrai téléphone.

### Stockage de départ : un profil déjà choisi

À la première visite, le site demande le profil de l'utilisateur dans une
fenêtre modale qui rend le reste de la page inerte. Pour que les tests ne la
rencontrent pas à chaque page, `playwright.config.ts` démarre chaque test avec
`jurix-persona=citoyen` dans le localStorage (`use.storageState`). Les requêtes
du chat portent donc `persona: "citoyen"`, comme avant l'arrivée des profils.

Un fichier qui doit partir d'un navigateur vide — c'est le cas de
`persona.spec.ts` — le déclare en tête :

```typescript
test.use({ storageState: { cookies: [], origins: [] } });
```

Le refus de la question (« Ne pas répondre ») vit dans un cookie de session,
`jurix-persona-refus` : un test le pose avec `context.addCookies`, et un
nouveau contexte (`browser.newContext`) simule la visite suivante.

## ✍️ Écrire des Tests

### Structure de base

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    // Naviguer vers la page
    await page.goto('/');
    
    // Interagir avec les éléments
    await page.click('button');
    
    // Vérifier les résultats
    await expect(page.locator('h1')).toHaveText('Expected Text');
  });
});
```

### Bonnes Pratiques

1. **Utiliser des sélecteurs stables**
   ```typescript
   // ✅ Bon - Utilise data-testid
   page.locator('[data-testid="search-button"]')
   
   // ❌ Éviter - Sélecteur CSS fragile
   page.locator('div > button.btn-primary')
   ```

2. **Attendre les éléments**
   ```typescript
   // Playwright attend automatiquement, mais vous pouvez être explicite
   await expect(page.locator('h1')).toBeVisible();
   ```

3. **Grouper les tests logiquement**
   ```typescript
   test.describe('Search Feature', () => {
     // Tous les tests liés à la recherche
   });
   ```

4. **Nettoyer après chaque test**
   ```typescript
   test.afterEach(async ({ page }) => {
     // Cleanup code
   });
   ```

## 🎯 Tests à Implémenter

### Priorité Haute
- [ ] Navigation principale
- [ ] Recherche de lois
- [ ] Filtrage par langue
- [ ] Affichage des résultats

### Priorité Moyenne
- [ ] Interface chat
- [ ] Gestion des erreurs
- [ ] Pagination
- [ ] Tri des résultats

### Priorité Basse
- [ ] Thème clair/sombre
- [ ] Accessibilité (a11y)
- [ ] Performance
- [ ] SEO

## 🐛 Debugging

### Utiliser Playwright Inspector

```bash
npx playwright test --debug
```

### Capturer des screenshots

```typescript
test('my test', async ({ page }) => {
  await page.goto('/');
  await page.screenshot({ path: 'screenshot.png' });
});
```

### Enregistrer une vidéo

```typescript
// Dans playwright.config.ts
use: {
  video: 'on-first-retry',
}
```

## 📊 Rapport de Tests

Après l'exécution, un rapport HTML est généré:

```bash
npx playwright show-report
```

Le rapport inclut:
- Résultats de tous les tests
- Screenshots des échecs
- Vidéos des exécutions
- Temps d'exécution

## 🔗 Ressources

- [Documentation Playwright](https://playwright.dev/)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [API Reference](https://playwright.dev/docs/api/class-test)
