// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import type { Category } from '$lib/types';

/**
 * L'accueil tel que le serveur l'envoie, avant tout JavaScript : c'est ce HTML
 * que lit un téléphone lent pendant le chargement des scripts, et que garde
 * le cache de Vercel (ISR).
 *
 * Ce que l'on vérifie :
 * - P8 : la recherche est un vrai formulaire GET vers /search (champ `q`),
 *   qui part sans JavaScript ;
 * - Q2 et Q3 : une seule liste de domaines, dans l'ordre provisoire, le lien
 *   sur le nom (h3 > a) décrit par sa ligne de textes phares, sans compteur
 *   ni pied « Consulter les textes » ;
 * - Q1 et Q5 : un titre de tâche d'une seule couleur, en Literata, sans
 *   badge, et un sous-titre dont le chiffre vient de l'API ou n'est pas écrit.
 *
 * Les nouvelles chaînes (`accueil.*`) n'existent pas encore dans
 * src/lib/stores/language.ts, que l'intégration complète : `$tr` est doublé
 * pour elles par des phrases d'essai, le reste vient du vrai dictionnaire.
 */

const PHRASES_D_ESSAI: Record<string, string> = {
  'accueil.titre': 'Que dit la loi camerounaise\u202f?',
  'accueil.sousTitre': 'Cherchez dans {n} textes officiels.',
  'accueil.sousTitreSansChiffre': 'Cherchez dans les textes officiels.',
  'accueil.domaines.titre': 'Parcourir par domaine',
  'accueil.domaines.tous': 'Les {n} textes officiels du corpus',
  'accueil.domaines.tousSansChiffre': 'Lois, décrets, arrêtés et autres textes officiels',
  'accueil.domaines.vide': 'Aucun texte pour l’instant',
  'entete.pageDeRecherche': 'Ouvrir la page de recherche',
};

vi.mock('$app/environment', () => ({ browser: false, building: false, dev: false, version: 'test' }));
vi.mock('$app/navigation', () => ({ afterNavigate: () => {}, goto: async () => {}, invalidateAll: async () => {} }));
vi.mock('$lib/stores/language', async (importOriginal) => {
  const original = await importOriginal<typeof import('$lib/stores/language')>();
  const { derived } = await import('svelte/store');
  return {
    ...original,
    tr: derived(original.language, ($l) => (cle: string) => PHRASES_D_ESSAI[cle] ?? original.t(cle, $l.current)),
  };
});

/** Les données de page lues par `$page` : réglées par chaque rendu. */
const etat = vi.hoisted(() => ({ donnees: {} as Record<string, unknown>, route: '/(main)' }));
vi.mock('$app/stores', async () => {
  const { readable } = await import('svelte/store');
  return {
    page: {
      subscribe: (abonne: (valeur: unknown) => void) =>
        readable({
          url: new URL('http://site/'),
          route: { id: etat.route },
          params: {},
          data: etat.donnees,
          error: null,
        }).subscribe(abonne),
    },
  };
});

/** Les 14 domaines tels que l'API les sert (ordre `display_order`), avec leurs compteurs de jurix_dev. */
const CATEGORIES: Category[] = [
  [9, 'Droit Constitutionnel', 41],
  [6, 'Droit Administratif', 175],
  [13, 'Fonction Publique', 1277],
  [14, 'Droit International', 195],
  [5, 'Finances Publiques et Fiscalité', 366],
  [2, 'Droit Pénal et Procédure Pénale', 16],
  [1, 'Droit Civil et Procédure Civile', 6],
  [7, 'Droit des Personnes, de la Famille et État Civil', 8],
  [4, 'Droit du Travail et Sécurité Sociale', 8],
  [8, 'Droit des Affaires, Banque et OHADA', 87],
  [15, 'Droit Foncier et Domanial', 21],
  [16, "Droit de l'Environnement et des Ressources Naturelles", 18],
  [17, 'Santé Publique et Sécurité Sanitaire', 16],
  [18, 'Éducation, Recherche, Culture et Médias', 41],
].map(([id, name, law_count]) => ({
  id: id as number,
  name: name as string,
  description: `Description de ${name}`,
  icon: null,
  created_at: '2026-10-03T00:00:00',
  law_count: law_count as number,
}));

// Comme sur le serveur : ni `window` ni stockage pendant le chargement des
// modules et le rendu (procédé de src/lib/rendu-serveur.test.ts). Rendus
// aussitôt, puis globales rendues : le `beforeEach` de src/tests/setup.ts
// vide le stockage avant chaque test.
const globales = globalThis as Record<string, unknown>;
const sauvegarde = (['window', 'localStorage', 'sessionStorage'] as const).map((nom) => [nom, globales[nom]] as const);

async function rendre(
  module: () => Promise<{ default: unknown }>,
  donnees: Record<string, unknown>,
): Promise<string> {
  for (const [nom] of sauvegarde) delete globales[nom];
  try {
    etat.donnees = donnees;
    const { default: Composant } = await module();
    return render(Composant as never, { props: { data: donnees } as never }).body;
  } finally {
    for (const [nom, valeur] of sauvegarde) globales[nom] = valeur;
  }
}

const page = () => import('./+page.svelte');
const gabarit = () => import('./+layout.svelte');

const AVEC_CHIFFRES = { categories: CATEGORIES, erreur: '', corpus: { textes: 2275, articles: 27157 } };
const ANCIENNE_API = { categories: CATEGORIES, erreur: '' };

const corpsDeLaPage = await rendre(page, AVEC_CHIFFRES);
const corpsSansChiffres = await rendre(page, ANCIENNE_API);
const corpsDuGabarit = await rendre(gabarit, AVEC_CHIFFRES);
const corpsDuGabaritSansChiffres = await rendre(gabarit, ANCIENNE_API);

/**
 * Le texte d'un fragment HTML, sans balises ni commentaires, blancs ASCII
 * réduits. Pas `\s` : il comprend les espaces insécables (U+00A0, U+202F),
 * que l'on vérifie justement.
 */
const texte = (html: string) =>
  html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t\n\r\f]+/g, ' ')
    .trim();

/** Les éléments <li> de la liste des domaines, dans l'ordre. */
function lignes(html: string): string[] {
  const liste = /<ul[^>]*data-testid="accueil-domaines"[^>]*>([\s\S]*?)<\/ul>/.exec(html);
  expect(liste, 'liste des domaines absente').not.toBeNull();
  return [...liste![1].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map((m) => m[0]);
}

describe('accueil : la recherche part sans JavaScript (P8)', () => {
  it('est un formulaire GET vers /search, repère de recherche', () => {
    const formulaire = /<form\b[^>]*>/.exec(corpsDeLaPage)?.[0] ?? '';
    expect(formulaire).toContain('method="get"');
    expect(formulaire).toContain('action="/search"');
    expect(formulaire).toContain('role="search"');
    expect(formulaire).toContain('data-hero-recherche');
  });

  it('envoie le champ sous le nom `q`, nommé « Rechercher »', () => {
    const champ = /<input\b[^>]*>/.exec(corpsDeLaPage)?.[0] ?? '';
    expect(champ).toContain('type="search"');
    expect(champ).toContain('name="q"');
    expect(champ).toContain('aria-label="Rechercher"');
  });

  it('a un vrai bouton d’envoi, nommé « Rechercher »', () => {
    expect(corpsDeLaPage).toMatch(/<button[^>]*type="submit"[^>]*aria-label="Rechercher"/);
  });
});

describe('accueil : une liste de domaines (Q2 A, Q3 A)', () => {
  it('liste les 14 domaines puis « Tous les textes », dans l’ordre provisoire', () => {
    const toutes = lignes(corpsDeLaPage);
    expect(toutes).toHaveLength(15);
    const noms = toutes.map((li) => texte(/<h3[^>]*>([\s\S]*?)<\/h3>/.exec(li)?.[1] ?? ''));
    expect(noms.slice(0, 8)).toEqual([
      'Travail et sécurité sociale',
      'Pénal et procédure pénale',
      'Famille et état civil',
      'Foncier et domaine de l’État',
      'Affaires, banque et OHADA',
      'Civil et procédure civile',
      'Finances publiques et impôts',
      'Constitution et institutions',
    ]);
    expect(noms[14]).toBe('Tous les textes');
  });

  it('pose un seul lien par ligne, sur le nom, vers la page du domaine', () => {
    const toutes = lignes(corpsDeLaPage);
    for (const li of toutes) {
      const liens = [...li.matchAll(/<a\b[^>]*>/g)];
      expect(liens, li.slice(0, 120)).toHaveLength(1);
      expect(li).toMatch(/<h3[^>]*>\s*(<!--[^>]*-->\s*)*<a\b/);
    }
    expect(toutes[0]).toContain('href="/categories/4"');
    expect(toutes[14]).toContain('href="/laws"');
  });

  it('étend le lien à toute la ligne, et dessine le focus autour d’elle', () => {
    for (const li of lignes(corpsDeLaPage)) {
      expect(li).toMatch(/<li class="[^"]*\brelative\b/);
      const lien = /<a\b[^>]*class="([^"]*)"/.exec(li)?.[1] ?? '';
      expect(lien).toContain('after:absolute');
      expect(lien).toContain('after:inset-0');
      expect(lien).toContain('focus-visible:after:outline');
    }
  });

  it('décrit chaque lien par sa ligne de textes phares, présente dans la page', () => {
    for (const li of lignes(corpsDeLaPage)) {
      const id = /aria-describedby="([^"]+)"/.exec(li)?.[1];
      expect(id, li.slice(0, 120)).toBeTruthy();
      expect(li).toContain(`id="${id}"`);
    }
    // Travail : le Code du travail, vérifié en base dans ce domaine ; la
    // version courte sous lg, la longue au-delà.
    const travail = lignes(corpsDeLaPage)[0];
    expect(travail).toContain('Code du travail, pensions</span>');
    expect(travail).toContain('Code du travail, pensions de vieillesse et d’invalidité</span>');
  });

  it('n’affiche ni compteur ni pied « Consulter les textes »', () => {
    const liste = texte(lignes(corpsDeLaPage).join(''));
    expect(liste).not.toMatch(/Consulter les textes/);
    expect(liste).not.toMatch(/\b1[\s\u202f\u00a0]?277\b/);
    expect(liste).not.toMatch(/\b\d+[\s\u202f\u00a0]textes?\b(?! officiels)/);
  });

  it('cache les icônes et le chevron aux lecteurs d’écran', () => {
    for (const li of lignes(corpsDeLaPage)) {
      const icones = [...li.matchAll(/<svg\b[^>]*>/g)].map((m) => m[0]);
      expect(icones).toHaveLength(2);
      for (const icone of icones) expect(icone).toContain('aria-hidden="true"');
      expect(li).toContain('data-icone="chevron-right"');
    }
  });

  it('dit qu’un domaine est vide, au lieu de citer des textes absents', () => {
    const vide = CATEGORIES.map((c) => (c.id === 4 ? { ...c, law_count: 0 } : c));
    return rendre(page, { categories: vide, erreur: '' }).then((html) => {
      const travail = lignes(html)[0];
      expect(texte(travail)).toContain('Aucun texte pour l’instant');
      expect(travail).not.toContain('Code du travail');
    });
  });

  it('garde la description de l’API pour un domaine inconnu, après les 14', () => {
    const avecInconnu = [...CATEGORIES, { ...CATEGORIES[0], id: 99, name: 'Droit Spatial', description: 'Orbites et satellites' }];
    return rendre(page, { categories: avecInconnu, erreur: '' }).then((html) => {
      const toutes = lignes(html);
      expect(toutes).toHaveLength(16);
      expect(texte(toutes[14])).toContain('Droit Spatial');
      expect(texte(toutes[14])).toContain('Orbites et satellites');
      // Quinze domaines : « Tous les textes » complète la rangée (une case).
      expect(toutes[15]).not.toContain('sm:col-span-2');
    });
  });

  it('écrit « Tous les textes » avec le chiffre de l’API, ou sans chiffre', () => {
    expect(texte(lignes(corpsDeLaPage)[14])).toContain('Les 2\u202f275 textes officiels du corpus');
    expect(lignes(corpsDeLaPage)[14]).toContain('sm:col-span-2');
    expect(texte(lignes(corpsSansChiffres)[14])).toContain('Lois, décrets, arrêtés et autres textes officiels');
    expect(texte(lignes(corpsSansChiffres)[14])).not.toMatch(/\d/);
  });

  it('garde « Tous les textes » quand la liste des domaines arrive vide', () => {
    return rendre(page, { categories: [], erreur: '' }).then((html) => {
      const toutes = lignes(html);
      expect(toutes).toHaveLength(1);
      expect(toutes[0]).toContain('href="/laws"');
    });
  });
});

describe('accueil : le hero (Q1 A, Q5 A)', () => {
  const h1 = /<h1\b[^>]*>([\s\S]*?)<\/h1>/.exec(corpsDuGabarit);

  it('a un seul h1, le titre de tâche, d’une seule couleur', () => {
    expect(corpsDuGabarit.match(/<h1\b/g)).toHaveLength(1);
    expect(texte(h1?.[1] ?? '')).toBe('Que dit la loi camerounaise\u202f?');
    // Plus de mot grisé dans le titre.
    expect(h1?.[1]).not.toMatch(/<span/);
  });

  it('compose le titre en Literata 600, équilibré, 36 / 48 / 56 px', () => {
    const classes = /<h1\b[^>]*class="([^"]*)"/.exec(corpsDuGabarit)?.[1] ?? '';
    for (const classe of ['font-titre', 'font-semibold', 'text-balance', 'text-4xl/[1.15]', 'sm:text-5xl/[1.15]', 'lg:text-[3.5rem]/[1.15]']) {
      expect(classes, classe).toContain(classe);
    }
    // Interlettrage nul : l'instance d'affichage est déjà serrée.
    expect(classes).not.toMatch(/tracking-/);
    expect(classes).not.toContain('font-extrabold');
  });

  it('n’a plus de badge à point pulsé', () => {
    expect(corpsDuGabarit).not.toContain('animate-pulse');
    expect(corpsDuGabarit).not.toContain('IA Juridique Camerounaise');
  });

  it('écrit le sous-titre avec le chiffre de l’API, ou sans chiffre', () => {
    expect(texte(corpsDuGabarit)).toContain('Cherchez dans 2\u202f275 textes officiels.');
    expect(texte(corpsDuGabaritSansChiffres)).toContain('Cherchez dans les textes officiels.');
  });

  it('garde les onglets « Recherche » et « Assistant IA »', () => {
    expect(corpsDuGabarit).toMatch(/<a href="\/"[^>]*>[\s\S]*?Recherche/);
    expect(corpsDuGabarit).toMatch(/<a href="\/chat"[^>]*>[\s\S]*?Assistant IA/);
  });

  it('aligne le contenu sur l’en-tête : mêmes marges latérales', () => {
    // Reste r3 n° 42 : le contenu commençait à 40 px en 768 et en 1 024,
    // sous un logo à 24 puis 48 px.
    const main = /<main\b[^>]*class="([^"]*)"/.exec(corpsDuGabarit)?.[1] ?? '';
    expect(main).toContain('sm:pl-[max(1.5rem,env(safe-area-inset-left))]');
    expect(main).toContain('lg:px-12');
    expect(corpsDuGabarit).not.toContain('sm:px-4');
  });
});
