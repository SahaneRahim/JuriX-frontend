// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import { SUGGESTIONS, questionAffichee } from '$lib/suggestions';
import type { Category } from '$lib/types';

/**
 * L'accueil tel que le serveur l'envoie, avant tout JavaScript : c'est ce HTML
 * que lit un téléphone lent pendant le chargement des scripts, et que garde
 * le cache de Vercel (ISR).
 *
 * Ce que l'on vérifie :
 * - P8 et H10, H12 (refonte A) : le champ unique est un vrai formulaire GET
 *   vers /search, la zone de texte `q` envoyée par un bouton qui s'appelle
 *   « Rechercher » tant qu'aucun JavaScript ne l'a renommé ;
 * - H2, H9, H11 : aucun profil choisi au serveur, le premier exemple écrit en
 *   entier et sans curseur, les démonstrations finies (jamais « armées ») ;
 * - Q2 et Q3 : une seule liste de domaines, dans l'ordre provisoire, le lien
 *   sur le nom (h3 > a) décrit par sa ligne de textes phares, sans compteur
 *   ni pied « Consulter les textes » ; la pastille du téléphone garde le nom
 *   court comme nom du lien ;
 * - Q1 et Q5 : un titre de tâche d'une seule couleur, en Literata, sans
 *   badge, révélé mot à mot sans changer son texte, et un surtitre dont le
 *   chiffre vient de l'API ou n'est pas écrit.
 *
 * Les phrases sont celles du vrai dictionnaire (src/lib/stores/language.ts).
 */

vi.mock('$app/environment', () => ({ browser: false, building: false, dev: false, version: 'test' }));
vi.mock('$app/navigation', () => ({ afterNavigate: () => {}, goto: async () => {}, invalidateAll: async () => {} }));

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

describe('accueil : la recherche part sans JavaScript (P8, H10, H12)', () => {
  it('est un formulaire GET vers /search, repère de recherche, le premier de la page', () => {
    const formulaire = /<form\b[^>]*>/.exec(corpsDeLaPage)?.[0] ?? '';
    expect(formulaire).toContain('method="get"');
    expect(formulaire).toContain('action="/search"');
    expect(formulaire).toContain('role="search"');
    expect(formulaire).toContain('data-hero-recherche');
  });

  it('envoie une zone de texte sous le nom `q`, nommée « Votre question ou votre recherche »', () => {
    const champ = /<textarea\b[^>]*>/.exec(corpsDeLaPage)?.[0] ?? '';
    expect(champ).toContain('name="q"');
    expect(champ).toContain('aria-label="Votre question ou votre recherche"');
    expect(champ).toContain('rows="2"');
    // Un seul `q` : aucun champ caché ne doublerait la requête.
    expect(corpsDeLaPage.match(/name="q"/g)).toHaveLength(1);
    // Aucune touche « Envoyer » du clavier mobile avant le JavaScript : sans
    // lui, Entrée va à la ligne (H12).
    expect(champ).not.toContain('enterkeyhint');
  });

  it('a un vrai bouton d’envoi, nommé « Rechercher », ce qu’il fait sans JavaScript (H10)', () => {
    expect(corpsDeLaPage).toMatch(/<button[^>]*type="submit"[^>]*aria-label="Rechercher"/);
    expect(corpsDeLaPage).not.toContain('Poser la question');
  });

  it('dessine la bascule de mode sur « Assistant IA », en boutons à aria-pressed', () => {
    const assistant = /<button\b[^>]*data-testid="accueil-mode-assistant"[^>]*>/.exec(corpsDeLaPage)?.[0] ?? '';
    const recherche = /<button\b[^>]*data-testid="accueil-mode-recherche"[^>]*>/.exec(corpsDeLaPage)?.[0] ?? '';
    expect(assistant).toContain('type="button"');
    expect(assistant).toContain('aria-pressed="true"');
    expect(recherche).toContain('aria-pressed="false"');
    expect(corpsDeLaPage).toMatch(/role="group"[^>]*aria-label="Mode"/);
  });

  it('ne choisit aucun profil au serveur : quatre profils et « Sans profil », aucun pressé (H2)', () => {
    for (const slug of ['citoyen', 'etudiant', 'avocat', 'entrepreneur', 'sans']) {
      const bouton = new RegExp(`<button\\b[^>]*data-testid="accueil-profil-${slug}"[^>]*>`).exec(corpsDeLaPage)?.[0] ?? '';
      expect(bouton, slug).toContain('aria-pressed="false"');
      expect(bouton, slug).toContain('type="button"');
    }
    expect(corpsDeLaPage).toMatch(/role="group"[^>]*aria-label="Je suis"/);
    // La pastille du profil n'est pas affichée.
    expect(/<span\b[^>]*data-testid="accueil-profil-pastille"[^>]*>/.exec(corpsDeLaPage)?.[0]).toContain('opacity-0');
  });

  it('écrit le premier exemple en entier, sans curseur, caché aux lecteurs d’écran (H9)', () => {
    // Sans curseur au serveur, le texte de l'exemple n'a aucun <span> : il
    // s'arrête au premier </span>.
    const exemple = /<span\b[^>]*data-testid="accueil-exemple"[^>]*>([\s\S]*?)<\/span>/.exec(corpsDeLaPage);
    expect(exemple?.[0]).toContain('aria-hidden="true"');
    expect(texte(exemple?.[1] ?? '')).toBe(`Exemple\u202f: ${questionAffichee(SUGGESTIONS.fr.general[0])}`);
    expect(exemple?.[0]).not.toContain('mv-curseur');
    expect(exemple?.[1]).not.toMatch(/<(a|button|input|textarea)\b/);
  });

  it('garde la mention de confidentialité', () => {
    expect(texte(corpsDeLaPage)).toContain('N’écrivez ni nom ni numéro de téléphone.');
  });
});

describe('accueil : les questions fréquentes (H1)', () => {
  const liens = () =>
    [...corpsDeLaPage.matchAll(/<section\b[^>]*data-testid="accueil-faq"[^>]*>([\s\S]*?)<\/section>/g)]
      .flatMap((m) => [...m[1].matchAll(/<a\b[^>]*href="([^"]+)"/g)])
      .map((m) => m[1].replace(/&amp;/g, '&'));

  it('propose les trois questions du profil général, qui partent vers l’assistant', () => {
    expect(liens()).toEqual(
      SUGGESTIONS.fr.general.map((question) => `/chat?q=${encodeURIComponent(question)}&envoyer=1`),
    );
    expect(texte(corpsDeLaPage)).toContain('Questions fréquentes\u00a0· profil général');
  });
});

describe('accueil : ce que JuriX vous montre (H11)', () => {
  const section = () => /<section\b[^>]*data-testid="accueil-preuves"[^>]*>([\s\S]*?)<\/section>/.exec(corpsDeLaPage)?.[0] ?? '';

  it('rend l’état final, lisible sans JavaScript : jamais « armé » au serveur', () => {
    expect(section()).toContain('data-etat="repos"');
    expect(section()).not.toMatch(/class="[^"]*\barme\b/);
    const lu = texte(section());
    expect(lu).toContain('Ce que JuriX vous montre');
    expect(lu).toContain('Seul le texte publié au Journal officiel fait foi.');
    expect(lu).toContain('Art.\u00a037');
    expect(lu).toContain('Version d’origine, non consolidée');
    expect(lu).toContain('Modifié');
    expect(lu).toContain('Abrogé');
    // Le passage cité : un <mark>, fond ET trait (mv-surligne).
    expect(section()).toMatch(/<mark class="mv-surligne[^"]*">indemnité de licenciement<\/mark>/);
  });
});

describe('accueil : une liste de domaines (Q2 A, Q3 A)', () => {
  it('liste les 14 domaines puis « Tous les textes », dans l’ordre provisoire', () => {
    const toutes = lignes(corpsDeLaPage);
    expect(toutes).toHaveLength(15);
    // Le nom court, nom du lien ; la pastille du téléphone a son nom très
    // court à part (`data-nom="puce"`).
    const noms = toutes.map((li) =>
      texte(/<span[^>]*data-nom="court"[^>]*>([\s\S]*?)<\/span>/.exec(li)?.[1] ?? /<h3[^>]*>([\s\S]*?)<\/h3>/.exec(li)?.[1] ?? ''),
    );
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
      // Toute la tuile, bordure comprise : une pastille de 44 px, 44 px à l'appui.
      expect(lien).toContain('after:-inset-px');
      expect(lien).toContain('focus-visible:after:outline');
    }
  });

  it('décrit chaque lien par sa ligne de textes phares, présente dans la page', () => {
    for (const li of lignes(corpsDeLaPage)) {
      const id = /aria-describedby="([^"]+)"/.exec(li)?.[1];
      expect(id, li.slice(0, 120)).toBeTruthy();
      expect(li).toContain(`id="${id}"`);
    }
    // Travail : le Code du travail, vérifié en base dans ce domaine, en
    // version courte (une tuile de quatre colonnes n'a que 180 à 236 px de
    // texte).
    const travail = /<p id="domaine-4-textes"[^>]*>([\s\S]*?)<\/p>/.exec(lignes(corpsDeLaPage)[0])?.[1] ?? '';
    expect(texte(travail)).toBe('Code du travail, pensions');
  });

  it('nomme la rangée, que le téléphone fait défiler (A4 § 3.1)', () => {
    expect(/<ul\b[^>]*data-testid="accueil-domaines"[^>]*>/.exec(corpsDeLaPage)?.[0]).toContain('aria-label="Domaines du droit"');
  });

  it('donne à la pastille du téléphone un nom très court, et au lien le nom court entier', () => {
    const travail = lignes(corpsDeLaPage)[0];
    const lien = /<a\b[^>]*>([\s\S]*?)<\/a>/.exec(travail)?.[1] ?? '';
    // Le nom court reste le nom du lien : au téléphone, il est seulement
    // retiré de l'écran (`max-sm:sr-only`), et il contient le nom très court
    // qu'on y lit (WCAG 2.5.3).
    expect(lien).toMatch(/<span data-nom="court" class="max-sm:sr-only">Travail et sécurité sociale<\/span>/);
    expect(lien).toMatch(/<span data-nom="puce" aria-hidden="true" class="[^"]*\bsm:hidden\b[^"]*">Travail<\/span>/);
    // « Tous les textes » : la première pastille au téléphone, la dernière
    // tuile au bureau (ordre du DOM).
    expect(lignes(corpsDeLaPage)[14]).toMatch(/<li class="[^"]*\bmax-sm:order-first\b/);
  });

  it('donne à chaque tuile le geste de son icône (A2 § 4)', () => {
    const [travail, penal, , , , civil] = lignes(corpsDeLaPage);
    expect(travail).toContain('mv-geste--tilt');
    expect(penal).toContain('mv-geste--tap');
    expect(civil).toContain('mv-geste--weigh');
    for (const li of lignes(corpsDeLaPage)) {
      expect(li).toMatch(/<li class="[^"]*\bmv-geste\b/);
      expect(li).toContain('mv-geste__icone');
    }
  });

  it('n’affiche ni compteur ni pied « Consulter les textes »', () => {
    const liste = texte(lignes(corpsDeLaPage).join(''));
    expect(liste).not.toMatch(/Consulter les textes/);
    expect(liste).not.toMatch(/\b1[\s\u202f\u00a0]?277\b/);
    expect(liste).not.toMatch(/\b\d+[\s\u202f\u00a0]textes?\b(?! officiels)/);
  });

  it('cache les icônes et la flèche aux lecteurs d’écran', () => {
    for (const li of lignes(corpsDeLaPage)) {
      const icones = [...li.matchAll(/<svg\b[^>]*>/g)].map((m) => m[0]);
      expect(icones).toHaveLength(2);
      for (const icone of icones) expect(icone).toContain('aria-hidden="true"');
      expect(li).toContain('data-icone="arrow-up-right"');
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
      // Quinze domaines : « Tous les textes » complète la rangée (une case),
      // à deux colonnes comme à quatre.
      expect(toutes[15]).not.toContain('sm:col-span-2');
      expect(toutes[15]).toContain('lg:col-span-1');
    });
  });

  it('écrit « Tous les textes » avec le chiffre de l’API, ou sans chiffre', () => {
    expect(texte(lignes(corpsDeLaPage)[14])).toContain('Les 2\u202f275 textes officiels du corpus');
    expect(lignes(corpsDeLaPage)[14]).toContain('sm:col-span-2');
    expect(lignes(corpsDeLaPage)[14]).toContain('lg:col-span-2');
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
    // Plus de mot grisé dans le titre : les masques des mots n'ont aucune
    // couleur à eux.
    expect(h1?.[1]).not.toMatch(/text-(zinc|gray|neutral|slate)-/);
  });

  it('révèle le titre mot à mot sans changer son texte : coupé sur l’espace ordinaire seulement (A2 § 3.5)', () => {
    const interieur = (h1?.[1] ?? '').replace(/<!--[\s\S]*?-->/g, '');
    const mots = [...interieur.matchAll(/<span class="mv-mot" style="--i: (\d+);?">([^<]*)<\/span>/g)];
    expect(mots.map((m) => m[2])).toEqual(['Que', 'dit', 'la', 'loi', 'camerounaise\u202f?']);
    expect(mots.map((m) => Number(m[1]))).toEqual([0, 1, 2, 3, 4]);
    // Le texte exact : une seule espace U+0020 entre deux mots, aucun blanc
    // ailleurs (le texte du <h1> ne passe pas par la normalisation).
    expect(interieur.replace(/<[^>]+>/g, '')).toBe('Que dit la loi camerounaise\u202f?');
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

  it('écrit le surtitre avec le chiffre de l’API, ou sans chiffre', () => {
    const surtitre = (html: string) =>
      texte(/<p\b[^>]*data-testid="accueil-surtitre"[^>]*>([\s\S]*?)<\/p>/.exec(html)?.[1] ?? '');
    // La version du téléphone, puis la phrase entière (sm et plus) : l'une
    // des deux est en `display: none`.
    expect(surtitre(corpsDuGabarit)).toBe(
      '2\u202f275 textes officiels2\u202f275 textes officiels\u00a0· chaque réponse cite ses articles',
    );
    expect(surtitre(corpsDuGabaritSansChiffres)).toBe(
      'Textes officielsTextes officiels\u00a0· chaque réponse cite ses articles',
    );
    expect(surtitre(corpsDuGabaritSansChiffres)).not.toMatch(/\d/);
  });

  it('n’a plus d’onglets « Recherche | Assistant IA » : le mode est dans le champ unique', () => {
    expect(corpsDuGabarit).not.toContain('sliding-pill-tabs');
    const main = /<main\b[\s\S]*<\/main>/.exec(corpsDuGabarit)?.[0] ?? '';
    expect(main).not.toMatch(/<a href="\/chat"/);
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
