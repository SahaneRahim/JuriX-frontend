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
npx playwright test tests/e2e/example.spec.ts

# Exécuter les tests sur un navigateur spécifique
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit

# Générer un rapport HTML
npx playwright show-report
```

## 📁 Structure

```
tests/e2e/
├── README.md          # Ce fichier
└── example.spec.ts    # Tests d'exemple
```

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
