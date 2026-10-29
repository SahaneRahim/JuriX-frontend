import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { afterNavigate, pushState, replaceState } from '$app/navigation';
import { page } from '$app/stores';
import type { StatutJuridique } from '$lib/types';
import Page from './+page.svelte';

/**
 * La page d'un texte, montée en entier dans jsdom, avec le routeur de
 * SvelteKit simulé ($app/navigation, $app/stores) et un store de langue
 * simulé. Elle vérifie ce que les tests de bout en bout ne peuvent pas
 * forcer, la réponse de l'API se lisant au serveur : l'ancienne API (sans
 * statut ni dates nouvelles), la nouvelle (statut modifié, historique), et
 * le routage superficiel de P2 (`replaceState` pour Suivant, `pushState` pour
 * le sommaire, retour arrière par `page.state`).
 */

vi.mock('$lib/stores/language', async () => {
  const { derived, writable } = await import('svelte/store');
  const { EN, FR } = await import('$lib/components/loi/dictionnaires-de-test');
  const COMMUNES: Record<string, string> = {
    'badge.decree': 'Décret',
    'nav.documents': 'Documents',
    'common.close': 'Fermer',
    'common.retry': 'Réessayer',
    'laws.title': 'Documents',
  };
  const language = writable<{ current: 'fr' | 'en' }>({ current: 'fr' });
  const tr = derived(
    language,
    ($langue) => (cle: string) => ($langue.current === 'fr' ? FR : EN)[cle] ?? COMMUNES[cle] ?? cle,
  );
  return { language, tr };
});

// Le routeur de SvelteKit : `page` ne change d'adresse qu'à une vraie
// navigation ; le routage superficiel ne change que `page.state`.
vi.mock('$app/stores', async () => {
  const { writable } = await import('svelte/store');
  return {
    page: writable({ url: new URL('http://localhost/laws/1740'), state: {}, params: { id: '1740' } }),
  };
});

vi.mock('$app/navigation', async () => {
  const { page } = await import('$app/stores');
  const deplacer = (methode: 'pushState' | 'replaceState') => (url: string, etat: Record<string, unknown>) => {
    history[methode]({}, '', url);
    (page as unknown as { update: (f: (p: Record<string, unknown>) => unknown) => void }).update((p) => ({
      ...p,
      state: etat,
    }));
  };
  return {
    afterNavigate: vi.fn(),
    invalidateAll: vi.fn(),
    pushState: vi.fn(deplacer('pushState')),
    replaceState: vi.fn(deplacer('replaceState')),
  };
});

// En-tête, pied de page et bouton de l'assistant : hors du sujet, et
// chacun tire ses propres stores. Un composant Svelte 5 est une fonction.
vi.mock('$lib/components/SiteHeader.svelte', () => ({ default: () => {} }));
vi.mock('$lib/components/SiteFooter.svelte', () => ({ default: () => {} }));
vi.mock('$lib/components/ChatFab.svelte', () => ({ default: () => {} }));
// La visionneuse du document d'origine interroge l'API dès son montage
// (`/pdf-info`) : jamais d'appel réseau depuis un test de page.
vi.mock('$lib/components/ImagePdfViewer.svelte', () => ({ default: () => {} }));

type Navigation = Parameters<Parameters<typeof afterNavigate>[0]>[0];

const CONTENU = [
  'LE PRESIDENT DE LA REPUBLIQUE,',
  'Vu la Constitution ;',
  'CHAPITREI DISPOSITIONS GENERALES',
  'Article 1er.- Le présent décret fixe les modalités d’exercice de certaines compétences.',
  'Article 2.-',
  '(1) La Région participe à la création des infrastructures.',
  'CHAPITRE II DES RESSOURCES',
  'Article 3.- Les ressources sont transférées.',
].join('\n');

/** La réponse de l'ANCIENNE API : ni statut, ni dates nouvelles. */
const ANCIENNE = {
  id: 1740,
  reference: 'PRC-9153',
  title: 'Décret N°2021/745 du 28 décembre 2021 fixant les modalités d’exercice de certaines compétences',
  type: 'décret',
  content: CONTENU,
  language: 'fr',
  category_id: 6,
  status: 'published',
  publication_date: '2021-12-28',
  file_id: 'f1',
  original_filename: 'decret.pdf',
  article_count: 3,
  created_at: '2026-10-03T14:24:16.889003',
  updated_at: '2026-10-14T16:45:05.858081',
  category: null,
  articles: [
    { number: '1', page_number: 1 },
    { number: '2', page_number: 1 },
    { number: '3', page_number: 2 },
  ],
};

/** La NOUVELLE API : dates de l'acte, jour d'ajout. */
const NOUVELLE = { ...ANCIENNE, date_signature: '2021-12-28', annee: 2021, date_publication_jo: null, ajoute_le: '2026-10-03' };

const L2026 = {
  id: 1761,
  reference: 'PRC-10679',
  nature: 'loi',
  numero: '2026/002',
  titre: 'Loi N°2026/002 du 14 avril 2026',
  date_signature: '2026-04-14',
  annee: 2026,
  date_publication_jo: null,
  consultable: true,
};

const MODIFIE: StatutJuridique = {
  releve_le: '2026-10-14',
  etat: 'modifie',
  types: ['modifie'],
  abroge: false,
  abroge_par: null,
  version_en_base: null,
  modifie_par: [
    {
      id: 'c1',
      sens: 'modifie_par',
      type: 'modifie',
      nature_modification: 'reecrit_en_entier',
      libelle: 'réécrit en entier',
      texte: L2026,
      etendue: 'articles',
      articles_cibles: ['2'],
      section: null,
      articles_source: ['1'],
      portee: 'réécrit en entier',
      depasse: false,
      depasse_par: null,
      integre_au_texte: false,
    },
  ],
  modifie: [],
  par_article: { '2': ['c1'] },
  par_morceau: {},
};

/**
 * Monte la page, puis joue l'arrivée (`afterNavigate`) comme SvelteKit après
 * l'hydratation. `depuis` : la page du site d'où l'on arrive (lien suivi),
 * sinon un premier chargement.
 *
 * Venu du site, l'entrée de cette page précède celle du texte, comme dans
 * un vrai onglet. Sans elle, les tests de « Retour » ne passaient que grâce
 * aux entrées laissées par les tests d'avant : lancés seuls (`-t`, `.only`,
 * ordre mélangé), ils voyaient un historique d'une entrée, et « Retour »
 * gardait son lien vers la liste.
 */
async function monter(data: Record<string, unknown>, adresse = '/laws/1740', depuis?: string) {
  if (depuis) {
    history.replaceState({}, '', depuis);
    history.pushState({}, '', adresse);
  } else {
    history.replaceState({}, '', adresse);
  }
  (page as unknown as { set: (p: unknown) => void }).set({
    url: new URL(`http://localhost${adresse}`),
    state: {},
    params: { id: '1740' },
  });
  // Données de `load` réduites à ce que la page lit (fixtures plus haut).
  const rendu = render(Page, { props: { data: { erreur: '', statut: null, ...data } as never } });
  await tick();
  const rappel = vi.mocked(afterNavigate).mock.calls.at(-1)?.[0];
  rappel?.({
    from: depuis ? { url: new URL(`http://localhost${depuis}`) } : null,
    to: { url: new URL(window.location.href) },
    type: depuis ? 'link' : 'enter',
  } as unknown as Navigation);
  await tick();
  return rendu;
}

const titreDeLArticle = () => document.querySelector('article.article h2')?.textContent?.replace(/\s+/g, ' ').trim();
/**
 * L'ouverture du texte entier (intitulé, visas). `open` et non `textContent` :
 * celui-ci compte aussi le contenu d'un `<details>` replié, que le lecteur ne
 * voit pas.
 */
const ouverture = () => screen.getByTestId('law-opening') as HTMLDetailsElement;

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('page d’un texte, ancienne API', () => {
  it('rend le texte sans statut inventé, sans cote, ni « en vigueur »', async () => {
    const { container } = await monter({ law: ANCIENNE });
    expect(container.textContent).not.toMatch(/vigueur/i);
    expect(container.textContent).not.toContain('PRC-9153');
    expect(container.textContent).not.toContain('Mis à jour');
    // La date d'avant, sans « Signé » : l'ancienne API ne dit pas ce qu'elle est.
    expect(screen.getByTestId('law-date').textContent).toBe('28 décembre 2021');
    // Le jour d'ajout se lit dans `created_at`.
    expect(screen.getByTestId('law-added').textContent).toBe('Ajouté à JuriX le 3 octobre 2026');
    expect(screen.getByTestId('law-status').dataset.etat).toBe('inconnu');
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(titreDeLArticle()).toBe('Article 1er');
  });
});

describe('page d’un texte, nouvelle API', () => {
  it('date l’acte et dit le statut du relevé', async () => {
    await monter({
      law: NOUVELLE,
      statut: { ...MODIFIE, etat: 'aucune_modification_connue', modifie_par: [], par_article: {} },
    });
    expect(screen.getByTestId('law-date').textContent).toBe('Signé le 28 décembre 2021');
    expect(screen.getByTestId('law-status').textContent?.replace(/\s+/g, ' ')).toContain(
      'Aucune modification relevée par JuriX au 14 oct. 2026.',
    );
  });

  it('modifié : encadré d’article, marque au sommaire et onglet « Historique (1) »', async () => {
    await monter({ law: NOUVELLE, statut: MODIFIE }, '/laws/1740?article=2');
    expect(titreDeLArticle()).toBe('Article 2');
    expect(screen.getByTestId('law-article-status').textContent?.replace(/\s+/g, ' ')).toContain(
      'Article modifié par la loi n° 2026/002 du 14 avril 2026 : réécrit en entier.',
    );
    const lienDuSommaire = screen.getByTestId('law-toc').querySelector('a[href="#art-2"]');
    expect(lienDuSommaire?.textContent).toContain('· modifié');
    const onglet = screen.getByTestId('law-tab-historique');
    expect(onglet.textContent?.trim()).toBe('Historique (1)');
    await fireEvent.click(screen.getByTestId('law-article-history'));
    expect(onglet.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('law-history')).toBeTruthy();
    expect(document.getElementById('panneau-texte')?.hidden).toBe(true);
  });

  it('`#historique` (pastille des listes) ouvre l’onglet, et le retour au texte l’efface', async () => {
    await monter({ law: NOUVELLE, statut: MODIFIE }, '/laws/1740#historique');
    expect(screen.getByTestId('law-tab-historique').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('law-history')).toBeTruthy();
    await fireEvent.click(screen.getByTestId('law-tab-texte'));
    expect(screen.getByTestId('law-tab-texte').getAttribute('aria-selected')).toBe('true');
    expect(window.location.hash).toBe('');
    await fireEvent.click(screen.getByTestId('law-tab-historique'));
    expect(window.location.hash).toBe('#historique');
  });

  it('ancienne API : `#historique` ne casse rien, le texte s’affiche', async () => {
    await monter({ law: ANCIENNE }, '/laws/1740#historique');
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(titreDeLArticle()).toBe('Article 1er');
  });
});

describe('en-tête déplacé par l’OCR (Constitution)', () => {
  it('« Copier le texte » donne l’article entier, fin comprise', async () => {
    const ecrire = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: ecrire }, configurable: true });
    const contenu = [
      '<<PAGE:8>>',
      'Article 5.-',
      "- (1) Le Président de la République est le Chef de l'État.",
      'Article 6.-',
      "- a) l'intérim du Président de la République est exercé de plein droit.",
      'TITRE I1 DU POUVOIR EXÉCUTIF',
      'CHAPITRE 1: DU PRÉSIDENT DE LA RÉPUBLIQUE',
      '<<PAGE:9>>',
      '- b) le Président de la République par intérim ne peut modifier ni la Constitution.',
      '- (6) Le régime de l’élection à la Présidence de la République est fixé par la loi.',
      'Article 7.-',
      '- (1) Le Président de la République élu entre en fonction.',
    ].join('\n');
    await monter({ law: { ...NOUVELLE, content: contenu, articles: [] } }, '/laws/1740?article=6');
    expect(titreDeLArticle()).toBe('Article 6');
    // Sans la puce que la conversion du PDF pose devant les alinéas numérotés.
    expect(document.querySelector('article.article .article-content')?.textContent).toContain('(6) Le régime');
    // Le surtitre de l'article : sa division remise à sa place.
    expect(document.querySelector('article.article p')?.textContent?.trim()).toBe('Titre II · Chapitre 1');
    await fireEvent.click(screen.getByTestId('law-copy-text'));
    await tick();
    expect(String(ecrire.mock.calls[0][0])).toContain('b) le Président de la République par intérim');
    expect(String(ecrire.mock.calls[0][0])).toContain('(6) Le régime de l’élection');
    expect(String(ecrire.mock.calls[0][0])).not.toMatch(/- [ab]\)|- \(\d/);
  });
});

describe('adresse de lecture (P2)', () => {
  it('« Suivant » remplace l’adresse, le sommaire en ajoute une, le retour revient', async () => {
    await monter({ law: NOUVELLE });
    const suivant = document.querySelector<HTMLButtonElement>('.article-navigation button:last-of-type');
    await fireEvent.click(suivant as HTMLButtonElement);
    expect(replaceState).toHaveBeenLastCalledWith('/laws/1740?article=2', { vue: 'article', rang: 1, article: '2' });
    expect(titreDeLArticle()).toBe('Article 2');
    expect(pushState).not.toHaveBeenCalled();

    await fireEvent.click(screen.getByTestId('law-toc').querySelector('a[href="#art-3"]') as Element);
    // Une entrée de plus que l'arrivée : « Retour » saura d'où remonter.
    expect(pushState).toHaveBeenLastCalledWith('/laws/1740?article=3', {
      vue: 'article',
      rang: 2,
      article: '3',
      profondeur: 1,
    });
    expect(titreDeLArticle()).toBe('Article 3');

    // Retour arrière entre deux entrées de la page : SvelteKit rend l'état.
    (page as unknown as { update: (f: (p: Record<string, unknown>) => unknown) => void }).update((p) => ({
      ...p,
      state: { vue: 'article', rang: 1, article: '2' },
    }));
    await tick();
    expect(titreDeLArticle()).toBe('Article 2');
  });

  it('mène à l’article depuis le numéro d’un morceau ou un « bis » (citations du chat)', async () => {
    await monter({ law: NOUVELLE }, '/laws/1740?article=2%20bis');
    expect(titreDeLArticle()).toBe('Article 2');
  });

  it('ouvre l’article d’un lien profond `#art-N`, et ignore un état périmé', async () => {
    await monter({ law: NOUVELLE }, '/laws/1740#art-3');
    expect(titreDeLArticle()).toBe('Article 3');
    // Un état d'historique qui ne désigne plus le même article (texte
    // réingéré) : l'adresse décide.
    (page as unknown as { update: (f: (p: Record<string, unknown>) => unknown) => void }).update((p) => ({
      ...p,
      state: { vue: 'article', rang: 0, article: '99' },
    }));
    await tick();
    expect(titreDeLArticle()).toBe('Article 3');
  });

  it('copie une référence propre, avec le lien de l’article', async () => {
    const ecrire = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: ecrire }, configurable: true });
    await monter({ law: NOUVELLE }, '/laws/1740?article=1');
    await fireEvent.click(screen.getByTestId('law-copy-reference'));
    await tick();
    expect(ecrire).toHaveBeenCalledWith(
      'Art. 1er, décret n° 2021/745 du 28 décembre 2021 fixant les modalités d’exercice de certaines compétences\nhttp://localhost/laws/1740?article=1',
    );
  });
});

/**
 * Un « Chapitre 1 » dans deux titres, comme la Constitution : le chapitre 2
 * du titre II est lu APRÈS l'article 6, sans titre devant lui. La chaîne du
 * sommaire (`enTetesDuSommaire`) ne le nomme que « Chapitre 2 ».
 */
const CONTENU_TITRES = [
  'TITRE II DU POUVOIR EXECUTIF',
  'CHAPITRE 1: DU PRESIDENT DE LA REPUBLIQUE',
  'Article 5.- Le Président de la République est le Chef de l’État.',
  'Article 6.- Le Président de la République est élu au suffrage universel.',
  'CHAPITRE 2: DU GOUVERNEMENT',
  'Article 11.- Le Gouvernement met en œuvre la politique de la Nation.',
  'TITRE III DU POUVOIR LEGISLATIF',
  'CHAPITRE 1: DE L’ASSEMBLEE NATIONALE',
  'Article 15.- L’Assemblée nationale est renouvelée tous les cinq ans.',
].join('\n');

const chaineDuFil = () => screen.getByTestId('law-breadcrumb-divisions').textContent?.trim();
const surtitre = () => document.querySelector('article.article .article-header > p')?.textContent?.trim();
const finDuFil = () => document.querySelector('[aria-current="location"]')?.textContent?.replace(/\s+/g, ' ').trim();
/** Classes d'un élément, sans celle que Svelte ajoute pour la portée des styles. */
const classes = (element: Element | null | undefined) =>
  [...(element?.classList ?? [])].filter((classe) => !classe.startsWith('svelte-'));

describe('fil d’Ariane et surtitre : toute la chaîne des divisions (P10)', () => {
  it('nomme le titre de chaque chapitre, même lu dans une division précédente', async () => {
    await monter({ law: { ...NOUVELLE, content: CONTENU_TITRES, articles: [] } }, '/laws/1740?article=11');
    expect(titreDeLArticle()).toBe('Article 11');
    // « Chapitre 2 » seul ne disait pas de quel titre (vérification r2 du 29/10).
    expect(chaineDuFil()).toBe('Titre II · Chapitre 2');
    expect(surtitre()).toBe('Titre II · Chapitre 2');
    // Infobulle : la chaîne entière, même tronquée à l'écran.
    expect(screen.getByTestId('law-breadcrumb-divisions').getAttribute('title')).toBe('Titre II · Chapitre 2');
  });

  it('distingue deux « Chapitre 1 » de deux titres', async () => {
    await monter({ law: { ...NOUVELLE, content: CONTENU_TITRES, articles: [] } }, '/laws/1740?article=15');
    expect(chaineDuFil()).toBe('Titre III · Chapitre 1');
    await fireEvent.click(screen.getByTestId('law-toc').querySelector('a[href="#art-5"]') as Element);
    expect(chaineDuFil()).toBe('Titre II · Chapitre 1');
    // Le fil va toujours jusqu'à l'article lu.
    expect(finDuFil()).toContain('Article 5');
  });

  it('un texte sans division : ni chaîne au fil, ni surtitre', async () => {
    const sansDivision = ['Article 1er.- Est nommé directeur.', 'Article 2.- Le présent décret sera publié.'].join('\n');
    await monter({ law: { ...NOUVELLE, content: sansDivision, articles: [] } });
    expect(screen.queryByTestId('law-breadcrumb-divisions')).toBeNull();
    expect(surtitre()).toBeUndefined();
    expect(finDuFil()).toContain('Article 1er');
  });
});

describe('rangée de lecture (P10) et titre officiel (Q5)', () => {
  it('la bascule et la barre Précédent / Suivant partagent une rangée ; « Suivant » reste le dernier bouton', async () => {
    await monter({ law: NOUVELLE });
    const barre = document.querySelector('.article-navigation') as HTMLElement;
    const bascule = screen.getByTestId('law-mode-article').parentElement as HTMLElement;
    expect(bascule.getAttribute('role')).toBe('group');
    expect(barre.parentElement).toBe(bascule.parentElement);
    const boutons = [...barre.querySelectorAll('button')];
    expect(boutons.at(-1)?.getAttribute('aria-label')).toBe('Suivant');
    // À côté de la bascule, les libellés n'apparaissent qu'à partir de `xl`.
    expect(classes(boutons.at(-1)?.querySelector('span'))).toEqual(['hidden', 'xl:inline']);

    // Texte entier : la même rangée porte le résumé, et plus de barre.
    await fireEvent.click(screen.getByTestId('law-mode-texte'));
    await tick();
    expect(document.querySelector('.article-navigation')).toBeNull();
    expect(bascule.parentElement?.textContent).toContain('3 articles · 2 chapitres');
    // Le bouton « Sommaire » du fil d'Ariane garde ses 44 px sans grandir le
    // bandeau (76 px au lieu de 52 à 768 px, vérification r2 du 29/10).
    expect(classes(screen.getByTestId('law-toc-toggle-texte'))).toEqual(expect.arrayContaining(['h-11', 'sm:-my-3']));
  });

  it('la carte bornée à 52rem dans un groupe centré, document d’origine ouvert compris', async () => {
    await monter({ law: NOUVELLE });
    const grille = document.querySelector('.layout') as HTMLElement;
    const colonnes = ['md:grid-cols-[minmax(0,52rem)]', 'lg:grid-cols-[280px_minmax(0,52rem)]', 'md:justify-center'];
    expect(classes(grille)).toEqual(expect.arrayContaining(colonnes));
    // La carte n'a plus de largeur à elle : c'est sa colonne qui la borne.
    expect(classes(document.getElementById('contenu')).filter((classe) => classe.includes('max-w'))).toEqual([]);
    // Ouvrir le document d'origine ne déplace pas le groupe.
    await fireEvent.click(screen.getByTestId('law-toggle-document'));
    await tick();
    expect(screen.getByTestId('law-document-viewer')).toBeTruthy();
    expect(classes(grille)).toEqual(expect.arrayContaining(colonnes));
  });

  it('un texte d’un seul article : la barre seule, dans son bloc, libellés dès `sm`', async () => {
    const unSeul = 'Article 1er.- Est nommé directeur général de l’École.';
    await monter({ law: { ...NOUVELLE, content: unSeul, articles: [] } });
    expect(screen.queryByTestId('law-mode-texte')).toBeNull();
    const barre = document.querySelector('.article-navigation') as HTMLElement;
    expect(classes(barre)).toContain('sm:p-4');
    expect(classes(barre.querySelector('button:last-of-type span'))).toEqual(['hidden', 'sm:inline']);
  });

  it('un texte d’un seul article avec une ouverture : la bascule, puis l’ouverture dépliée en texte entier', async () => {
    // L'arrêté d'avancement de 193 inspecteurs (/laws/1797), réduit : seul
    // l'article 2 est reconnu, et le tableau des promus reste dans
    // l'ouverture, que la lecture article par article ne montre jamais.
    const arrete = [
      'ARRETE portant avancement de grade',
      'LE MINISTRE DES FINANCES,',
      'Vu la Constitution ;',
      'ARRETE :',
      '1. ABISSAMA BOLAMO ALAIN',
      'Article 2.- Le Ministre des Finances et le Délégué Général à la Sûreté Nationale sont chargés de l’exécution du présent arrêté.',
    ].join('\n');
    await monter({ law: { ...NOUVELLE, content: arrete, articles: [] } });
    expect(titreDeLArticle()).toBe('Article 2');
    // La barre à côté de la bascule, comme pour un texte de plusieurs articles.
    const barre = document.querySelector('.article-navigation') as HTMLElement;
    expect(classes(barre)).toContain('sm:ml-auto');
    expect(classes(barre.querySelector('button:last-of-type span'))).toEqual(['hidden', 'xl:inline']);

    await fireEvent.click(screen.getByTestId('law-mode-texte'));
    await tick();
    expect(screen.getByTestId('law-full-text')).toBeTruthy();
    expect(ouverture().textContent).toContain('ABISSAMA BOLAMO ALAIN');
    expect(ouverture().open).toBe(true);
    // Le lecteur la replie s'il le veut : elle ne se rouvre pas d'elle-même.
    ouverture().open = false;
    ouverture().dispatchEvent(new Event('toggle'));
    await tick();
    expect(ouverture().open).toBe(false);
  });

  it('le titre officiel garde son interligne de 1,2 à chaque taille d’écran', async () => {
    await monter({ law: NOUVELLE });
    const tailles = (document.querySelector('h1')?.className ?? '')
      .split(/\s+/)
      .filter((classe) => /(^|:)text-(xs|sm|base|lg|\d?xl)\b/.test(classe));
    expect(tailles.length).toBeGreaterThanOrEqual(3);
    // Un `sm:text-2xl` sans interligne remettait celui de Tailwind (1,33).
    for (const classe of tailles) expect(classe).toMatch(/\/\[1\.2\]$/);
  });
});

describe('texte entier (P10)', () => {
  it('bascule, garde l’article lu, et rend l’adresse du texte', async () => {
    await monter({ law: NOUVELLE }, '/laws/1740?article=2');
    await fireEvent.click(screen.getByTestId('law-mode-texte'));
    await tick();
    expect(screen.getByTestId('law-mode-texte').getAttribute('aria-pressed')).toBe('true');
    expect(replaceState).toHaveBeenLastCalledWith('/laws/1740', { vue: 'texte', rang: 1, article: '2' });
    const texte = screen.getByTestId('law-full-text');
    expect([...texte.querySelectorAll('h2')].map((h) => h.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'Chapitre I DISPOSITIONS GENERALES',
      'Chapitre II DES RESSOURCES',
    ]);
    expect([...texte.querySelectorAll('article')].map((a) => a.id)).toEqual(['art-1', 'art-2', 'art-3']);
    // Les visas d'ouverture font partie du texte, repliés : l'adresse ne
    // demandait rien d'introuvable.
    expect(texte.textContent).toContain('Vu la Constitution ;');
    expect(ouverture().open).toBe(false);
    // Le fil d'Ariane va jusqu'à l'article.
    expect(get(page).state).toEqual({ vue: 'texte', rang: 1, article: '2' });
    expect(document.querySelector('[aria-current="location"]')?.textContent).toContain('Article');

    await fireEvent.click(screen.getByTestId('law-mode-article'));
    await tick();
    expect(titreDeLArticle()).toBe('Article 2');
  });
});

describe('« Retour » du fil d’Ariane : la page d’avant, quels que soient les sauts (P2)', () => {
  const retour = () => screen.getByLabelText('Retour');

  it('remonte les sauts du sommaire, et garde le compte aux « Suivant »', async () => {
    const aller = vi.spyOn(history, 'go').mockImplementation(() => {});
    try {
      await monter({ law: NOUVELLE }, '/laws/1740?article=1', '/search?q=licenciement');
      // Arrivée seule : une entrée à remonter.
      expect(await fireEvent.click(retour())).toBe(false);
      expect(aller).toHaveBeenLastCalledWith(-1);

      // Deux sauts du sommaire : deux entrées de plus. Un « Suivant »
      // remplace l'entrée, sans changer le compte.
      await fireEvent.click(screen.getByTestId('law-toc').querySelector('a[href="#art-2"]') as Element);
      await fireEvent.click(screen.getByTestId('law-toc').querySelector('a[href="#art-1"]') as Element);
      await fireEvent.click(document.querySelector('.article-navigation button:last-of-type') as HTMLButtonElement);
      expect(replaceState).toHaveBeenLastCalledWith('/laws/1740?article=2', {
        vue: 'article',
        rang: 1,
        article: '2',
        profondeur: 2,
      });
      // `history.back()` ne défaisait que le dernier saut.
      await fireEvent.click(retour());
      expect(aller).toHaveBeenLastCalledWith(-3);
    } finally {
      aller.mockRestore();
    }
  });

  it('le lien direct d’un article, en texte entier, compte comme un saut', async () => {
    const aller = vi.spyOn(history, 'go').mockImplementation(() => {});
    try {
      await monter({ law: NOUVELLE }, '/laws/1740', '/search?q=region');
      await fireEvent.click(screen.getByTestId('law-mode-texte'));
      await tick();
      const lien = screen.getByLabelText('Lien vers l’article 3');
      // Plus d'entrée native (`#art-3` suivi par le navigateur) : la page
      // écrit elle-même l'adresse, avec son état.
      expect(await fireEvent.click(lien)).toBe(false);
      await tick();
      expect(pushState).toHaveBeenLastCalledWith('/laws/1740#art-3', {
        vue: 'texte',
        rang: 2,
        article: '3',
        profondeur: 1,
      });
      await fireEvent.click(retour());
      expect(aller).toHaveBeenLastCalledWith(-2);
    } finally {
      aller.mockRestore();
    }
  });

  it('le même lien direct cliqué deux fois n’ajoute qu’une entrée', async () => {
    const aller = vi.spyOn(history, 'go').mockImplementation(() => {});
    try {
      await monter({ law: NOUVELLE }, '/laws/1740', '/search?q=region');
      await fireEvent.click(screen.getByTestId('law-mode-texte'));
      await tick();
      const lien = screen.getByLabelText('Lien vers l’article 3');
      await fireEvent.click(lien);
      await tick();
      // Vers l'adresse déjà affichée : l'entrée est remplacée, profondeur
      // comprise, comme le navigateur le fait d'un lien vers la page même.
      expect(await fireEvent.click(lien)).toBe(false);
      await tick();
      expect(pushState).toHaveBeenCalledOnce();
      expect(replaceState).toHaveBeenLastCalledWith('/laws/1740#art-3', {
        vue: 'texte',
        rang: 2,
        article: '3',
        profondeur: 1,
      });
      await fireEvent.click(retour());
      expect(aller).toHaveBeenLastCalledWith(-2);
    } finally {
      aller.mockRestore();
    }
  });

  it.each(['/laws/1740?article=2', '/laws/1740#art-2'])(
    'un saut du sommaire vers l’article déjà lu n’ajoute pas d’entrée (arrivée par %s)',
    async (arrivee) => {
      await monter({ law: NOUVELLE }, arrivee, '/search?q=region');
      await fireEvent.click(screen.getByTestId('law-toc').querySelector('a[href="#art-2"]') as Element);
      expect(pushState).not.toHaveBeenCalled();
      // L'adresse prend sa forme d'article par article, dans la même entrée.
      expect(replaceState).toHaveBeenLastCalledWith('/laws/1740?article=2', { vue: 'article', rang: 1, article: '2' });
    },
  );

  /**
   * Le lien d'évitement de l'en-tête (`#contenu`, SiteHeader, simulé ici),
   * suivi par le navigateur sans la page : jsdom ajoute l'entrée, puis
   * déclenche `popstate` (état nul) et `hashchange`, comme le prévoit la
   * spécification HTML. SvelteKit, simulé aussi, numérote l'entrée d'un lien
   * cliqué (`sveltekit:history`) dans son écouteur de `hashchange`, posé ici
   * APRÈS celui de la page, comme au chargement direct : le routeur ne
   * démarre qu'après l'hydratation. jsdom suit le lien au tour suivant :
   * l'écouteur attend l'événement, il ne se retire qu'après.
   */
  async function suivreLeLienDEvitement() {
    const lien = document.createElement('a');
    lien.href = '#contenu';
    document.body.prepend(lien);
    const numerotee = new Promise<void>((fini) =>
      window.addEventListener(
        'hashchange',
        () => {
          history.replaceState({ ...history.state, 'sveltekit:history': Date.now() }, '', window.location.href);
          fini();
        },
        { once: true },
      ),
    );
    try {
      await fireEvent.click(lien);
      await numerotee;
      await tick();
    } finally {
      lien.remove();
    }
  }

  it('compte l’entrée que le navigateur ajoute seul (lien d’évitement de l’en-tête)', async () => {
    const aller = vi.spyOn(history, 'go').mockImplementation(() => {});
    try {
      await monter({ law: NOUVELLE }, '/laws/1740?article=1', '/search?q=region');
      await fireEvent.click(screen.getByTestId('law-toc').querySelector('a[href="#art-2"]') as Element);
      await suivreLeLienDEvitement();
      // La page adopte l'entrée : l'état de lecture, une profondeur de plus.
      await vi.waitFor(() =>
        expect(replaceState).toHaveBeenLastCalledWith('/laws/1740?article=2#contenu', {
          vue: 'article',
          rang: 1,
          article: '2',
          profondeur: 2,
        }),
      );
      expect(titreDeLArticle()).toBe('Article 2');
      // Arrivée, saut du sommaire, lien d'évitement : trois entrées à remonter
      // avant la recherche. Sans l'adoption, « Retour » s'arrêtait sur le texte.
      await fireEvent.click(retour());
      expect(aller).toHaveBeenLastCalledWith(-3);
    } finally {
      aller.mockRestore();
    }
  });

  it('en texte entier, cette entrée retient la vue : le retour arrière puis avant ne rouvre pas l’article seul', async () => {
    await monter({ law: NOUVELLE }, '/laws/1740', '/search?q=region');
    await fireEvent.click(screen.getByTestId('law-mode-texte'));
    await tick();
    const avant = get(page).state;
    await suivreLeLienDEvitement();
    await vi.waitFor(() =>
      expect(replaceState).toHaveBeenLastCalledWith('/laws/1740#contenu', {
        vue: 'texte',
        rang: 0,
        article: '1',
        profondeur: 1,
      }),
    );
    const adoptee = get(page).state;
    // Retour arrière puis avant : SvelteKit rend l'état de chaque entrée.
    const rendre = (state: unknown) =>
      (page as unknown as { update: (f: (p: Record<string, unknown>) => unknown) => void }).update((p) => ({ ...p, state }));
    rendre(avant);
    await tick();
    rendre(adoptee);
    await tick();
    expect(screen.getByTestId('law-mode-texte').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('law-full-text')).toBeTruthy();
  });

  it('un retour arrière entre deux ancres n’adopte rien : son entrée a déjà un état', async () => {
    await monter({ law: NOUVELLE }, '/laws/1740?article=2', '/search?q=region');
    window.dispatchEvent(new PopStateEvent('popstate', { state: { 'sveltekit:history': 2 } }));
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    // L'adoption est remise au tour suivant (`surHashchange`) : l'attendre.
    await new Promise((fini) => setTimeout(fini, 0));
    await tick();
    expect(replaceState).not.toHaveBeenCalled();
  });

  /**
   * Une ancre tapée dans la barre d'adresse : la même entrée sans état, mais
   * sans clic de lien, que SvelteKit ne numérote pas. La page l'adoptait,
   * et `replaceState` y écrivait l'index de l'entrée d'avant : au retour
   * arrière, SvelteKit, qui se croyait déjà sur cette entrée, ne rendait pas
   * son état, et « Retour » remontait une entrée de trop, hors du site après
   * /search dans un onglet neuf (revue du 29/10).
   */
  it('une ancre tapée dans la barre d’adresse n’est pas adoptée : « Retour » s’arrête à la page d’avant', async () => {
    const aller = vi.spyOn(history, 'go').mockImplementation(() => {});
    try {
      await monter({ law: NOUVELLE }, '/laws/1740?article=1', '/search?q=region');
      await fireEvent.click(screen.getByTestId('law-toc').querySelector('a[href="#art-2"]') as Element);
      const avant = get(page).state;
      vi.mocked(replaceState).mockClear();
      // jsdom ajoute l'entrée, puis `popstate` (état nul) et `hashchange` ;
      // aucun écouteur ne la numérote. Puis le tour de l'adoption remise.
      const suivie = new Promise((fini) => window.addEventListener('hashchange', fini, { once: true }));
      window.location.hash = '#art-3';
      await suivie;
      await new Promise((fini) => setTimeout(fini, 0));
      await tick();
      expect(replaceState).not.toHaveBeenCalled();
      // Retour arrière sur `?article=2` : SvelteKit y laisse `page.state` tel
      // quel. « Retour » remonte le saut et l'arrivée, jusqu'à /search.
      expect(get(page).state).toBe(avant);
      await fireEvent.click(retour());
      expect(aller).toHaveBeenLastCalledWith(-2);
    } finally {
      aller.mockRestore();
    }
  });

  it('au premier chargement, le lien mène à la liste des documents', async () => {
    const aller = vi.spyOn(history, 'go').mockImplementation(() => {});
    // Le clic arrive jusqu'ici sans que la page l'ait retenu ; jsdom ne sait
    // pas ouvrir une autre page, on l'en empêche après coup.
    let retenu: boolean | null = null;
    const noter = (event: Event) => {
      retenu = event.defaultPrevented;
      event.preventDefault();
    };
    window.addEventListener('click', noter);
    try {
      await monter({ law: NOUVELLE });
      await fireEvent.click(retour());
      expect(retenu).toBe(false);
      expect(aller).not.toHaveBeenCalled();
      expect(retour().getAttribute('href')).toBe('/laws');
    } finally {
      window.removeEventListener('click', noter);
      aller.mockRestore();
    }
  });
});

describe('un article que le découpage ne trouve pas (P2, r3)', () => {
  const avis = () => screen.queryByTestId('article-introuvable')?.textContent?.replace(/\s+/g, ' ').trim();

  it('un texte de plusieurs articles : le texte entier, ouverture dépliée, et le numéro demandé', async () => {
    await monter({ law: NOUVELLE }, '/laws/1740?article=9999');
    expect(screen.getByTestId('law-full-text')).toBeTruthy();
    expect(avis()).toBe('L’article 9999 n’a pas été retrouvé dans ce texte : il est affiché en entier.');
    // « En entier » : l'ouverture aussi, où l'OCR range ce qu'il n'a pas su lire.
    expect(ouverture().open).toBe(true);
  });

  it('un saut du sommaire efface l’avis, mais ne replie pas l’ouverture sous le lecteur', async () => {
    await monter({ law: NOUVELLE }, '/laws/1740?article=9999');
    await fireEvent.click(screen.getByLabelText('Lien vers l’article 3'));
    await tick();
    expect(avis()).toBeUndefined();
    // Replier le texte au-dessus de l'article visé le ferait remonter.
    expect(ouverture().open).toBe(true);
  });

  it('un texte d’un seul article : le texte entier aussi, jamais l’autre article sous cette adresse', async () => {
    // Décret 2017/398 (/laws/197), réduit : seul l'article 3 est reconnu, les
    // deux premiers, illisibles à l'OCR, sont dans l'ouverture, que la lecture
    // article par article cache.
    const unSeul = [
      'DECRET N°',
      '2017/398',
      'LE PRESIDENT DE LA REPUBLIQUE,',
      'DECRETE :',
      'Au   d ot  tl   :  e vendredi 28 et samedi 29 juillet 2017, en mémoire des victimes.',
      'Aois le  lns l e  ns c ne :  u territoire national et dans les postes diplomatiques.',
      'Article 3: Le présent décret sera enregistré et publié suivant la procédure d’urgence.',
      'Yaoundé, le 27 JUIL 2017',
    ].join('\n');
    await monter({ law: { ...NOUVELLE, content: unSeul, articles: [] } }, '/laws/1740?article=2');
    expect(document.querySelector('article.article')).toBeNull();
    expect(avis()).toBe('L’article 2 n’a pas été retrouvé dans ce texte : il est affiché en entier.');
    // Le passage est dans l'ouverture : dépliée, il se lit sans rien ouvrir.
    // Repliée, elle ne promettait qu'« intitulé, visas et préambule ».
    expect(ouverture().textContent).toContain('vendredi 28 et samedi 29 juillet 2017');
    expect(ouverture().open).toBe(true);
  });

  it.each([
    ['abrogé, voir wa.me/2376XXXXXXXX', 'abrog%C3%A9%2C%20voir%20wa.me%2F2376XXXXXXXX'],
    ['$&', '%24%26'],
    ["$'", "$'"],
    ['DISPOSITIF', 'DISPOSITIF'],
  ])('ne recopie jamais une valeur qui n’est pas un numéro : %j', async (valeur, encodee) => {
    await monter({ law: NOUVELLE }, `/laws/1740?article=${encodee}`);
    expect(screen.getByTestId('law-full-text')).toBeTruthy();
    expect(avis()).toBe('Le passage demandé n’a pas été retrouvé dans ce texte : il est affiché en entier.');
    expect(screen.getByTestId('article-introuvable').textContent).not.toContain(valeur);
    expect(ouverture().open).toBe(true);
  });

  it.each([
    ['1er', '1er'],
    ['12%20BIS', '12 bis'],
  ])('le numéro demandé s’écrit comme la page écrit les siens : %j', async (demande, ecrit) => {
    const sansPremier = ['Article 2.- Deux.', 'Article 3.- Trois.'].join('\n');
    await monter({ law: { ...NOUVELLE, content: sansPremier, articles: [] } }, `/laws/1740?article=${demande}`);
    expect(avis()).toBe(`L’article ${ecrit} n’a pas été retrouvé dans ce texte : il est affiché en entier.`);
  });
});

describe('aucun article reconnu : le texte tel qu’il est', () => {
  it('sans division non plus, l’ouverture est tout le texte : dépliée', async () => {
    // Arrêté 8448/CAB/PR (/laws/193), tel que la base le donne : ni article ni
    // division. La page n'en montrait qu'un résumé replié.
    const arrete = [
      '/CAB/PR DU 202 N1 ARRETE N° un e ne e o ee ae to lte 2017.',
      'LE PRESIDENT DE LA REPUBLIQUE,',
      'ARRETE',
      'oule l’etendue du territoire de la République du Cameroun.',
      'Yaoundé, le 2 4 j 2017',
    ].join('\n');
    await monter({ law: { ...NOUVELLE, content: arrete, articles: [] } });
    expect(ouverture().open).toBe(true);
    expect(ouverture().textContent).toContain('territoire de la République du Cameroun');
  });

  it('avec des divisions, l’ouverture reste repliée : le texte s’ouvre sur la première', async () => {
    const sansArticle = ['Vu la Constitution ;', 'CHAPITRE I DISPOSITIONS GENERALES', 'Les ressources sont transférées.'].join(
      '\n',
    );
    await monter({ law: { ...NOUVELLE, content: sansArticle, articles: [] } });
    expect(ouverture().open).toBe(false);
    expect(screen.getByTestId('law-full-text').textContent).toContain('Les ressources sont transférées.');
  });
});

describe('extrait d’« Expliquer l’article » et texte copié', () => {
  const ALINEAS = [
    'Article 1er.- Le présent décret fixe les modalités.',
    'Article 2.- (1) La police municipale a pour objet d’assurer le bon ordre sur le territoire de la Communauté Urbaine.',
    '- (2) La police municipale est placée sous l’autorité du Maire.',
    'Article 74 : Imputabilité',
    '(1) Est pénalement responsable celui qui commet l’infraction.',
  ].join('\n');

  it('envoie les lignes du document, puces comprises, et affiche le texte sans elles', async () => {
    const appel = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ explanation: 'Explication.' }),
    } as Response);
    try {
      await monter({ law: { ...NOUVELLE, content: ALINEAS, articles: [] } }, '/laws/1740?article=2');
      expect(document.querySelector('article.article .article-content')?.textContent).not.toContain('- (2)');
      await fireEvent.click(screen.getByTestId('law-explain'));
      const corps = JSON.parse(String(appel.mock.calls[0][1]?.body));
      // Le serveur retrouve « … Urbaine. - (2) » dans le document, pas « … Urbaine. (2) ».
      expect(corps.excerpt).toBe(
        '(1) La police municipale a pour objet d’assurer le bon ordre sur le territoire de la Communauté Urbaine.\n- (2) La police municipale est placée sous l’autorité du Maire.',
      );
      expect(corps.number).toBe('2');
    } finally {
      appel.mockRestore();
    }
  });

  it('« Copier le texte » commence par l’intitulé de l’article', async () => {
    const ecrire = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: ecrire }, configurable: true });
    await monter({ law: { ...NOUVELLE, content: ALINEAS, articles: [] } }, '/laws/1740?article=74');
    expect(document.querySelector('article.article h3')?.textContent?.trim()).toBe('Imputabilité');
    await fireEvent.click(screen.getByTestId('law-copy-text'));
    await tick();
    expect(String(ecrire.mock.calls[0][0])).toMatch(
      /^Imputabilité\n\(1\) Est pénalement responsable celui qui commet l’infraction\.\n\n— Art\. 74, /,
    );
  });
});

/**
 * Un document qui intègre déjà une modification (`version_en_base`, comme
 * l'ordonnance 74/1, /laws/2242), modifié depuis par un texte qu'il ne
 * contient pas.
 */
describe('encadré d’un article dans une version consolidée (P1)', () => {
  const lie = (nature: string, numero: string, date: string) => ({
    ...L2026,
    id: null,
    reference: null,
    nature,
    numero,
    titre: `${nature} N°${numero}`,
    date_signature: date,
    annee: Number(date.slice(0, 4)),
    consultable: false,
  });
  const CONSOLIDE: StatutJuridique = {
    ...MODIFIE,
    version_en_base: { consolidee: true, textes_integres: [lie('ordonnance', '77/1', '1977-01-10')] },
    modifie_par: [{ ...MODIFIE.modifie_par[0], nature_modification: 'modifie', texte: lie('loi', '83-19', '1983-11-26') }],
  };

  it('ne dit pas « version d’origine », article par article comme en texte entier', async () => {
    await monter({ law: NOUVELLE, statut: CONSOLIDE }, '/laws/1740?article=2');
    const encadre = () => screen.getByTestId('law-article-status').textContent?.replace(/\s+/g, ' ') ?? '';
    expect(encadre()).toContain('Le texte ci-dessous ne contient pas cette modification.');
    expect(encadre()).not.toContain('version d’origine');
    await fireEvent.click(screen.getByTestId('law-mode-texte'));
    await tick();
    expect(encadre()).toContain('Le texte ci-dessous ne contient pas cette modification.');
  });
});
