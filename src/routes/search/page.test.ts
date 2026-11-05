import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { tick } from 'svelte';
import type { Writable } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { afterNavigate } from '$app/navigation';
import { navigating as navigatingDeKit } from '$app/stores';
import { t } from '$lib/stores/language';
import type { ResultatAffiche } from '$lib/components/listes/reperes';
import type { DonneesDeRecherche } from './resultats';
import Page from './+page.svelte';

/**
 * /search montée dans jsdom avec les vrais textes de l'interface : la ligne
 * d'état (ce qu'une carte dit déjà à l'écran, elle ne le répète pas ; elle
 * existe avant de changer, pour être annoncée), le champ de recherche pendant
 * une navigation, les états vides et la colonne de filtres.
 */

vi.mock('$app/stores', async () => {
  const { readable, writable } = await import('svelte/store');
  return {
    page: readable({ url: new URL('http://localhost/search?q=loi'), state: {}, params: {} }),
    navigating: writable(null),
  };
});
vi.mock('$app/navigation', () => ({ afterNavigate: vi.fn(), goto: vi.fn(), invalidateAll: vi.fn(), replaceState: vi.fn() }));
vi.mock('$lib/components/SiteHeader.svelte', () => ({ default: () => {} }));
vi.mock('$lib/components/SiteFooter.svelte', () => ({ default: () => {} }));
vi.mock('$lib/components/MetaSeo.svelte', () => ({ default: () => {} }));
vi.mock('$lib/components/ChatFab.svelte', () => ({ default: () => {} }));

/** Le store `navigating`, écrit par les tests comme le routeur de SvelteKit. */
const navigating = navigatingDeKit as unknown as Writable<unknown>;

/** Une navigation vers `adresse`, telle que la voit `$navigating`. */
function naviguerVers(adresse: string) {
  navigating.set({ from: null, to: { url: new URL(adresse, 'http://localhost') }, type: 'link' });
}

/** Le rappel `afterNavigate` que la page a enregistré à sa création. */
function apresNavigation(): (navigation: { type: string }) => void {
  return vi.mocked(afterNavigate).mock.calls.at(-1)?.[0] as unknown as (navigation: { type: string }) => void;
}

/**
 * La balance qui pèse dans le champ pendant une recherche : le SEUL
 * indicateur d'attente de la page (refonte A, E4b). L'en-tête est simulé :
 * aucune autre balance n'est montée ici.
 */
function balanceQuiPese(container: HTMLElement): Element | null {
  return container.querySelector('svg[data-etat="attente"]');
}

/**
 * Le texte de la ligne d'état tel qu'il s'affiche : sans ce qui n'est que lu
 * aux lecteurs d'écran (sr-only), ligne entière comprise.
 */
function texteAffiche(container: HTMLElement): string {
  const ligne = container.querySelector('#resultats') as HTMLElement;
  if (ligne.classList.contains('sr-only')) return '';
  const copie = ligne.cloneNode(true) as HTMLElement;
  copie.querySelectorAll('.sr-only').forEach((e) => e.remove());
  return copie.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

afterEach(() => {
  cleanup();
  navigating.set(null);
  vi.mocked(afterNavigate).mockClear();
  vi.useRealTimers();
  history.replaceState(null, '', '/');
});

/** Une recherche « loi » de l'ancienne API, sans résultat : chaque test en change l'état. */
const RECHERCHE: DonneesDeRecherche = {
  parametres: { q: 'loi', perimetre: [], nature: null, categories: [], periode: null, tri: null, page: 1 },
  etat: 'resultats',
  erreur: '',
  resultats: [],
  total: 0,
  affinee: false,
  candidats: null,
  natures: null,
  domaines: [],
  nomsDesDomaines: {},
  corpus: null,
};

/** La page sans requête (« Commencez votre recherche »). */
const DEBUT: DonneesDeRecherche = { ...RECHERCHE, parametres: { ...RECHERCHE.parametres, q: '' }, etat: 'debut' };

const AUCUNE_NATURE = { tous: 0, decret: 0, loi: 0, arrete: 0, 'acte-uniforme': 0, autres: 0 };

/** Nouvelle API : 25 textes trouvés, dont 12 décrets ; deux domaines dans les effectifs. */
const AFFINEE: DonneesDeRecherche = {
  ...RECHERCHE,
  affinee: true,
  total: 25,
  candidats: 25,
  natures: { ...AUCUNE_NATURE, tous: 25, decret: 12, loi: 13 },
  domaines: [
    { id: 4, nom: 'Droit du Travail et Sécurité Sociale', n: 3, coche: false },
    { id: 13, nom: 'Fonction Publique', n: 22, coche: false },
  ],
};

describe('/search : la ligne d’état', () => {
  it('en panne, la carte d’erreur dit la panne, et la ligne d’état ne la répète plus', () => {
    const { container, getByTestId } = render(Page, {
      props: { data: { ...RECHERCHE, etat: 'erreur', erreur: 'search.errorSearch' } },
    });
    const message = 'Erreur lors de la recherche. Veuillez réessayer.';
    expect(getByTestId('search-error').querySelector('h2')?.textContent?.trim()).toBe(message);

    // Annoncée, mais plus affichée sous le champ, en rouge, juste au-dessus
    // de la même phrase en titre.
    const statut = getByTestId('search-status');
    expect(statut.getAttribute('role')).toBe('status');
    expect(statut.textContent?.trim()).toBe(message);
    expect(statut.classList.contains('sr-only')).toBe(true);
    expect(statut.className).not.toMatch(/text-red/);
    // Toute la ligne sort du flux : ni rangée vide ni écart au-dessus de la carte.
    expect(container.querySelector('#resultats')?.classList.contains('sr-only')).toBe(true);
  });

  it('avec des résultats comptés, la ligne d’état reste affichée, et n’est lue qu’une fois', () => {
    // Une page au-delà de la dernière : trois résultats, aucune ligne à montrer.
    const { container, getByTestId } = render(Page, { props: { data: { ...RECHERCHE, total: 3 } } });
    expect(getByTestId('search-status').textContent?.trim()).toBe('3 résultats');
    expect(texteAffiche(container)).toBe('3 résultats');
    expect(container.querySelector('#resultats')?.classList.contains('sr-only')).toBe(false);
    // Ce qui s'affiche est caché aux lecteurs d'écran : ils lisent la région, seule.
    const lus = [...container.querySelectorAll('#resultats span')].filter(
      (e) => e.textContent?.trim() === '3 résultats' && !e.closest('[aria-hidden="true"]'),
    );
    expect(lus).toEqual([getByTestId('search-status')]);
  });

  it('sans requête, la région existe déjà, vide et hors de l’écran', () => {
    const { container, getByTestId } = render(Page, { props: { data: DEBUT } });
    const statut = getByTestId('search-status');
    expect(statut.getAttribute('role')).toBe('status');
    expect(statut.textContent?.trim()).toBe('');
    expect(container.querySelector('#resultats')?.classList.contains('sr-only')).toBe(true);
  });

  it('une recherche lancée de la page vide CHANGE la région au lieu de la créer : elle est annoncée', async () => {
    const { getByTestId, rerender } = render(Page, { props: { data: DEBUT } });
    const region = getByTestId('search-status');

    naviguerVers('/search?q=bail');
    await tick();
    expect(region.textContent?.trim()).toBe(t('search.searching', 'fr'));

    await rerender({ data: { ...RECHERCHE, parametres: { ...RECHERCHE.parametres, q: 'bail' }, total: 25 } });
    navigating.set(null);
    await tick();
    // La même région, dont le texte change : un lecteur d'écran l'entend.
    expect(getByTestId('search-status')).toBe(region);
    expect(region.textContent?.trim()).toBe('25 résultats');
  });

  it('vers /search sans requête, rien n’est cherché : ni « Recherche en cours… » ni balance qui pèse', async () => {
    const { getByTestId, container } = render(Page, { props: { data: { ...RECHERCHE, total: 3 } } });
    naviguerVers('/search');
    await tick();
    expect(getByTestId('search-status').textContent?.trim()).toBe('3 résultats');
    expect(texteAffiche(container)).toBe('3 résultats');
    expect(balanceQuiPese(container)).toBeNull();
    expect(container.querySelector('[data-icone="loader-circle"]')).toBeNull();
  });

  it('une recherche faite sur place (une case, un onglet) : l’écran aussi dit « Recherche en cours… »', async () => {
    const { getByTestId, container } = render(Page, { props: { data: { ...RECHERCHE, total: 3 } } });
    naviguerVers('/search?q=loi&nature=decret');
    await tick();
    expect(texteAffiche(container)).toBe(t('search.searching', 'fr'));
    expect(getByTestId('search-status').textContent?.trim()).toBe(t('search.searching', 'fr'));
    // L'attente se voit à un seul endroit : la balance, dans le champ.
    const balance = balanceQuiPese(container);
    expect(balance).not.toBeNull();
    expect(balance?.closest('form[role="search"]')).not.toBeNull();
    expect(container.querySelector('[data-icone="loader-circle"]')).toBeNull();
  });

  it('page créée par une navigation : le nombre s’affiche aussitôt, seule l’annonce attend', async () => {
    vi.useFakeTimers();
    naviguerVers('/search?q=loi');
    const { container, getByTestId } = render(Page, { props: { data: { ...RECHERCHE, total: 3 } } });
    apresNavigation()({ type: 'link' });
    navigating.set(null);
    await tick();
    // Ni balance qui pèse ni liste atténuée : rien ne se cherche, et l'écran ne le dit pas.
    expect(texteAffiche(container)).toBe('3 résultats');
    expect(balanceQuiPese(container)).toBeNull();
    // La région, elle, attend d'être connue des lecteurs d'écran pour changer.
    expect(getByTestId('search-status').textContent?.trim()).toBe(t('search.searching', 'fr'));

    await vi.advanceTimersByTimeAsync(300);
    expect(getByTestId('search-status').textContent?.trim()).toBe('3 résultats');
    expect(texteAffiche(container)).toBe('3 résultats');
  });

  it('page créée par une navigation (accueil, en-tête) : le nombre arrive après la région', async () => {
    vi.useFakeTimers();
    // La page naît pendant la navigation, avec ses résultats déjà là.
    naviguerVers('/search?q=loi');
    const { getByTestId } = render(Page, { props: { data: { ...RECHERCHE, total: 3 } } });
    const region = getByTestId('search-status');
    expect(region.textContent?.trim()).toBe(t('search.searching', 'fr'));

    apresNavigation()({ type: 'link' });
    navigating.set(null);
    await tick();
    // Encore « Recherche en cours… » : la région vient d'être créée.
    expect(region.textContent?.trim()).toBe(t('search.searching', 'fr'));

    await vi.advanceTimersByTimeAsync(300);
    expect(region.textContent?.trim()).toBe('3 résultats');
  });

  it('premier chargement (rendu du serveur) : rien n’est différé', async () => {
    const { getByTestId } = render(Page, { props: { data: { ...RECHERCHE, total: 3 } } });
    apresNavigation()({ type: 'enter' });
    await tick();
    expect(getByTestId('search-status').textContent?.trim()).toBe('3 résultats');
  });
});

describe('/search : le champ pendant une recherche', () => {
  const BAIL: DonneesDeRecherche = { ...AFFINEE, parametres: { ...RECHERCHE.parametres, q: 'bail' } };

  // Horloge simulée : la frappe ne lance pas, 300 ms plus tard, la demande de
  // suggestions de SearchBar vers une API absente.
  beforeEach(() => {
    vi.useFakeTimers();
  });

  function champ(container: HTMLElement): HTMLInputElement {
    return container.querySelector('input[name="q"]') as HTMLInputElement;
  }

  it('une requête corrigée pendant que la recherche part n’est pas effacée à son arrivée', async () => {
    const { container, rerender } = render(Page, { props: { data: BAIL } });
    // Une case cochée : la recherche repart, même requête.
    naviguerVers('/search?q=bail&categorie=13');
    await tick();
    await fireEvent.input(champ(container), { target: { value: 'bail commercial' } });

    await rerender({ data: { ...BAIL, parametres: { ...BAIL.parametres, categories: [13] } } });
    navigating.set(null);
    await tick();
    expect(champ(container).value).toBe('bail commercial');
  });

  it('sans retouche, le champ prend la requête cherchée (retour arrière, autre recherche)', async () => {
    const { container, rerender } = render(Page, { props: { data: BAIL } });
    naviguerVers('/search?q=travail');
    await tick();
    await rerender({ data: { ...BAIL, parametres: { ...BAIL.parametres, q: 'travail' } } });
    navigating.set(null);
    await tick();
    expect(champ(container).value).toBe('travail');
  });

  it('vers /search sans requête (lien « Recherche », retour arrière), un texte écrit AVANT, jamais envoyé, s’efface', async () => {
    const { container, rerender } = render(Page, { props: { data: BAIL } });
    await fireEvent.input(champ(container), { target: { value: 'xyz' } });
    naviguerVers('/search');
    await tick();
    await rerender({ data: DEBUT });
    navigating.set(null);
    await tick();
    expect(champ(container).value).toBe('');
  });

  it('le même texte, puis un onglet (même requête) : le champ reprend la requête cherchée', async () => {
    const { container, rerender } = render(Page, { props: { data: BAIL } });
    await fireEvent.input(champ(container), { target: { value: 'xyz' } });
    naviguerVers('/search?q=bail&nature=loi');
    await tick();
    await rerender({ data: { ...BAIL, parametres: { ...BAIL.parametres, nature: 'loi' } } });
    navigating.set(null);
    await tick();
    expect(champ(container).value).toBe('bail');
  });

  it('une navigation qui en remplace une autre en cours ne prend pas la retouche faite entre les deux pour départ', async () => {
    const { container, rerender } = render(Page, { props: { data: BAIL } });
    naviguerVers('/search?q=bail&categorie=13');
    await tick();
    await fireEvent.input(champ(container), { target: { value: 'bail commercial' } });
    // Une seconde case, cochée avant le retour de la première recherche.
    naviguerVers('/search?q=bail&categorie=13&categorie=4');
    await tick();

    await rerender({ data: { ...BAIL, parametres: { ...BAIL.parametres, categories: [13, 4] } } });
    navigating.set(null);
    await tick();
    expect(champ(container).value).toBe('bail commercial');
  });

  it('le bouton d’envoi reste actif pendant la recherche : Entrée envoie la requête corrigée', async () => {
    const { container } = render(Page, { props: { data: BAIL } });
    naviguerVers('/search?q=bail&categorie=13');
    await tick();
    const envoi = container.querySelector('form[role="search"] button[type="submit"]') as HTMLButtonElement;
    expect(balanceQuiPese(container)).not.toBeNull();
    expect(envoi.disabled).toBe(false);
  });
});

describe('/search : les états vides', () => {
  const VIDE: DonneesDeRecherche = {
    ...AFFINEE,
    parametres: { ...RECHERCHE.parametres, q: 'bail', nature: 'decret' },
    total: 0,
    natures: { ...AUCUNE_NATURE, tous: 2, loi: 2 },
  };

  /** Le titre de la carte de l'état vide (celle à la loupe barrée), et non celui de la colonne. */
  function titre(container: HTMLElement): string | undefined {
    return container.querySelector('[data-icone="search-x"]')?.parentElement?.querySelector('h2')?.textContent?.trim();
  }

  it('onglet seul : « Aucun décret ne contient « bail » », et les natures trouvées', () => {
    const { container } = render(Page, { props: { data: VIDE } });
    expect(titre(container)).toBe(t('search.empty.nature.decret', 'fr').replace('{q}', 'bail'));
  });

  it('onglet et domaine coché : pas de « Aucun décret ne contient… », que le domaine seul explique', () => {
    const { container, getByRole } = render(Page, {
      props: { data: { ...VIDE, parametres: { ...VIDE.parametres, categories: [13] } } },
    });
    expect(titre(container)).toBe(t('search.empty.filtersTitle', 'fr'));
    // « Voir les 25 textes, sans filtre » : nature ET domaine retirés.
    const sansFiltre = getByRole('link', { name: t('search.empty.seeWithoutFilters.other', 'fr').replace('{n}', '25') });
    expect(sansFiltre.getAttribute('href')).toBe('/search?q=bail');
  });

  it('onglet et période : de même', () => {
    const { container } = render(Page, {
      props: { data: { ...VIDE, parametres: { ...VIDE.parametres, periode: 'annee' } } },
    });
    expect(titre(container)).toBe(t('search.empty.filtersTitle', 'fr'));
  });

  it('rien dans le domaine d’une page de domaine : les filtres, rappelés, et la recherche sans eux, sans nombre', () => {
    const { container, getByRole } = render(Page, {
      props: {
        data: {
          ...AFFINEE,
          parametres: { ...RECHERCHE.parametres, q: 'nomination', perimetre: [17] },
          total: 0,
          candidats: 0,
          natures: AUCUNE_NATURE,
          domaines: [],
          nomsDesDomaines: { 17: 'Santé Publique et Sécurité Sanitaire' },
        },
      },
    });
    // Et non « Aucun texte ne contient « nomination » » : ailleurs, il y en a.
    expect(titre(container)).toBe(t('search.empty.filtersTitle', 'fr'));
    const rappel = container.querySelector('a[aria-label^="Retirer le filtre"]');
    expect(rappel?.getAttribute('href')).toBe('/search?q=nomination');
    // Les « candidats » sont ceux du domaine : aucun nombre pour tout le corpus.
    const bouton = getByRole('link', { name: t('search.empty.removeFilters', 'fr') });
    expect(bouton.getAttribute('href')).toBe('/search?q=nomination');
  });
});

describe('/search : la colonne de filtres', () => {
  it('le périmètre d’une page de domaine y est coché sous son nom ; une nouvelle requête le garde', () => {
    const { container } = render(Page, {
      props: {
        data: {
          ...AFFINEE,
          parametres: { ...RECHERCHE.parametres, q: 'nomination', perimetre: [4] },
          domaines: [
            { id: 4, nom: 'Droit du Travail et Sécurité Sociale', n: 5, coche: true },
            { id: 13, nom: 'Fonction Publique', n: 0, coche: false },
          ],
        },
      },
    });
    const colonne = container.querySelector('#filtres-recherche') as HTMLFormElement;
    // Décoché, il quitte le formulaire : la recherche porte alors sur tout le corpus.
    expect(new FormData(colonne).getAll('perimetre')).toEqual(['4']);
    expect(new FormData(colonne).getAll('categorie')).toEqual([]);
    const barre = container.querySelector('form[role="search"]') as HTMLFormElement;
    expect(new FormData(barre).getAll('perimetre')).toEqual(['4']);
  });

  it('ouverte par son ancre avant l’hydratation, elle se referme ensuite au bouton', async () => {
    history.replaceState(null, '', '/search?q=loi#filtres-recherche');
    const { container, getByTestId } = render(Page, { props: { data: AFFINEE } });
    const colonne = container.querySelector('#filtres-recherche') as HTMLElement;
    const bouton = getByTestId('search-filters-toggle');
    expect(bouton.getAttribute('aria-expanded')).toBe('true');
    expect(colonne.classList.contains('block')).toBe(true);

    await fireEvent.click(bouton);
    expect(bouton.getAttribute('aria-expanded')).toBe('false');
    // Plus de `target:block` : la colonne, encore ciblée par l'ancre, l'emportait sur `hidden`.
    expect(colonne.classList.contains('hidden')).toBe(true);
    expect(colonne.classList.contains('target:block')).toBe(false);
  });
});

/* ------------------------------------------------------------------------ */
/* Refonte A (E4) : arrivée des lignes, silhouettes, passerelle, onglets     */
/* ------------------------------------------------------------------------ */

/** Un résultat affiché (forme de ./resultats.ts), d'identifiant `id`. */
function resultat(id: number): ResultatAffiche {
  return {
    id,
    title: `Loi N°92/0${id} du 14 août 1992 portant Code du travail`,
    type: 'loi',
    publication_date: '1992-08-14',
    category_id: 4,
    category_name: 'Droit du Travail et Sécurité Sociale',
    objet: `Code du travail ${id}`,
    numero: `92/0${id}`,
    date_signature: '1992-08-14',
    annee: 1992,
    date_publication_jo: null,
    statut: null,
    extrait: [
      { texte: 'a droit à une ', gras: false },
      { texte: 'indemnité', gras: true },
    ],
    articles: [],
  };
}

/** « loi », nouvelle API : sept lignes à l'écran, 25 trouvées (12 décrets, 13 lois). */
const AVEC_LIGNES: DonneesDeRecherche = {
  ...AFFINEE,
  resultats: [1, 2, 3, 4, 5, 6, 7].map(resultat),
};

/** Les lignes de résultats affichées (et non les silhouettes). */
function lignes(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll('ul[role="list"] > li')] as HTMLElement[];
}

describe('/search : l’arrivée des lignes (R9)', () => {
  it('au premier affichage, chaque ligne monte, décalée de min(rang, 5) × 80 ms', () => {
    const { container } = render(Page, { props: { data: AVEC_LIGNES } });
    const affichees = lignes(container);
    expect(affichees).toHaveLength(7);
    expect(affichees.every((l) => l.classList.contains('mv-monter'))).toBe(true);
    expect(affichees.map((l) => l.style.getPropertyValue('--d'))).toEqual([
      '0ms',
      '80ms',
      '160ms',
      '240ms',
      '320ms',
      '400ms',
      '400ms',
    ]);
  });

  it('ni une autre page, ni un autre tri, ni un onglet ne la rejouent ; une nouvelle requête, si', async () => {
    const { container, rerender } = render(Page, { props: { data: AVEC_LIGNES } });
    const parametres = AVEC_LIGNES.parametres;

    // Page 2 : d'autres lignes, la même recherche.
    await rerender({ data: { ...AVEC_LIGNES, parametres: { ...parametres, page: 2 }, resultats: [8, 9].map(resultat) } });
    await tick();
    expect(lignes(container)).toHaveLength(2);
    expect(container.querySelector('.mv-monter')).toBeNull();
    expect(container.querySelector('.mv-souligner')).toBeNull();

    // Un autre tri, puis un onglet.
    await rerender({ data: { ...AVEC_LIGNES, parametres: { ...parametres, tri: 'recent' }, resultats: [7, 3].map(resultat) } });
    await tick();
    expect(container.querySelector('.mv-monter')).toBeNull();
    await rerender({ data: { ...AVEC_LIGNES, parametres: { ...parametres, nature: 'loi' } } });
    await tick();
    expect(container.querySelector('.mv-monter')).toBeNull();

    // Une autre requête : les lignes arrivent de nouveau.
    await rerender({ data: { ...AVEC_LIGNES, parametres: { ...parametres, q: 'bail' }, resultats: [11, 12].map(resultat) } });
    await tick();
    expect(lignes(container).every((l) => l.classList.contains('mv-monter'))).toBe(true);
  });
});

describe('/search : l’arrivée, au retour en arrière (R6, R9)', () => {
  /** Le routeur tel qu'il est quand la page se recrée : `$navigating` dit encore d'où l'on vient. */
  function revenirVers(adresse: string, type: string) {
    navigating.set({ from: null, to: { url: new URL(adresse, 'http://localhost') }, type });
  }

  it('revenir d’un texte vers ses résultats ne rejoue rien : ni lignes, ni mots, ni statuts, ni onglets', () => {
    revenirVers('/search?q=loi', 'popstate');
    const { container } = render(Page, { props: { data: AVEC_LIGNES } });
    expect(lignes(container)).toHaveLength(7);
    expect(container.querySelector('.mv-monter')).toBeNull();
    expect(container.querySelector('.mv-souligner')).toBeNull();
    expect(container.querySelector('.mv-tamponner')).toBeNull();
    // Le trait des mots reste : c'est l'état final, seul le mouvement est retiré.
    expect(container.querySelectorAll('strong.mv-souligne').length).toBeGreaterThan(0);
  });

  it('un lien vers la page (arrivée ordinaire) la joue, lui', () => {
    revenirVers('/search?q=loi', 'link');
    const { container } = render(Page, { props: { data: AVEC_LIGNES } });
    expect(lignes(container).every((l) => l.classList.contains('mv-monter'))).toBe(true);
  });

  it('revenir à une requête précédente sur la page déjà ouverte : ses lignes arrivent sans monter', async () => {
    const { container, rerender } = render(Page, { props: { data: AVEC_LIGNES } });
    revenirVers('/search?q=bail', 'popstate');
    await rerender({ data: { ...AVEC_LIGNES, parametres: { ...AVEC_LIGNES.parametres, q: 'bail' } } });
    await tick();
    expect(container.querySelector('.mv-monter')).toBeNull();
  });
});

describe('/search : pendant la recherche (R7)', () => {
  it('une NOUVELLE requête : des silhouettes muettes remplacent la liste et les onglets', async () => {
    const { container, getByTestId, queryByTestId, queryByRole } = render(Page, { props: { data: AVEC_LIGNES } });
    naviguerVers('/search?q=bail');
    await tick();

    const silhouettes = getByTestId('search-skeleton');
    expect(silhouettes.getAttribute('aria-hidden')).toBe('true');
    expect(silhouettes.textContent?.trim()).toBe('');
    expect(silhouettes.querySelector('a, button, [title]')).toBeNull();
    expect(lignes(container)).toHaveLength(0);
    // Les effectifs de la requête précédente ne s'affichent plus.
    expect(getByTestId('search-skeleton-tabs').getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('[role="group"][aria-label="Nature du texte"]')).toBeNull();
    // La passerelle nommait la requête précédente.
    expect(queryByRole('link', { name: t('search.askAssistantQuery', 'fr').replace('{q}', 'loi') })).toBeNull();
    // Une seule attente à l'écran : la balance du champ. La ligne d'état l'annonce.
    expect(container.querySelectorAll('svg[data-etat="attente"]')).toHaveLength(1);
    expect(getByTestId('search-status').textContent?.trim()).toBe(t('search.searching', 'fr'));

    // La navigation finit (ici, sans nouvelles données) : les silhouettes partent.
    navigating.set(null);
    await tick();
    expect(queryByTestId('search-skeleton')).toBeNull();
    expect(lignes(container)).toHaveLength(7);
  });

  it('la même requête (un onglet, une case, une page) : la liste reste, atténuée, sans silhouette', async () => {
    const { container, queryByTestId } = render(Page, { props: { data: AVEC_LIGNES } });
    naviguerVers('/search?q=loi&nature=decret');
    await tick();
    expect(queryByTestId('search-skeleton')).toBeNull();
    expect(queryByTestId('search-skeleton-tabs')).toBeNull();
    expect(lignes(container)).toHaveLength(7);
    const liste = container.querySelector('ul[role="list"]')!.parentElement as HTMLElement;
    expect(liste.classList.contains('opacity-60')).toBe(true);
    expect(liste.getAttribute('aria-busy')).toBe('true');
    expect(balanceQuiPese(container)).not.toBeNull();
  });

  it('depuis la page sans requête aussi : la carte « Commencez votre recherche » cède la place aux silhouettes', async () => {
    const { getByTestId, queryByText } = render(Page, { props: { data: DEBUT } });
    naviguerVers('/search?q=bail');
    await tick();
    expect(getByTestId('search-skeleton')).toBeTruthy();
    expect(queryByText(t('search.startTitle', 'fr'))).toBeNull();
  });
});

describe('/search : la passerelle et les onglets (R4)', () => {
  it('« Poser « loi » à l’assistant IA » : nom visible et nom accessible confondus, vers /chat?q=loi, sans préchargement au survol', () => {
    const { getByRole } = render(Page, { props: { data: AVEC_LIGNES } });
    const nom = t('search.askAssistantQuery', 'fr').replace('{q}', 'loi');
    const passerelle = getByRole('link', { name: nom });
    expect(passerelle.textContent?.replace(/\s+/g, ' ').trim()).toBe(nom.replace(/\s+/g, ' '));
    expect(passerelle.getAttribute('href')).toBe('/chat?q=loi');
    expect(passerelle.getAttribute('data-sveltekit-preload-data')).toBe('tap');
    expect(passerelle.querySelector('[data-icone="sparkle"]')).not.toBeNull();
  });

  it('l’effectif dans une pastille, sans texte caché : le nom de l’onglet reste « Lois 13 » ; un onglet vide en pointillés', () => {
    const { getByRole } = render(Page, { props: { data: AVEC_LIGNES } });
    const onglets = getByRole('group', { name: t('search.natureGroup', 'fr') });
    const lois = [...onglets.querySelectorAll('a')].find((a) => a.textContent?.includes(t('search.laws', 'fr')))!;
    expect(lois.textContent?.replace(/\s+/g, ' ').trim()).toBe('Lois 13');
    expect(lois.querySelector('.sr-only')).toBeNull();
    expect(lois.querySelector('span')?.textContent).toBe('13');
    const vide = onglets.querySelector('[aria-disabled="true"]') as HTMLElement;
    expect(vide.getAttribute('role')).toBe('link');
    expect(vide.classList.contains('border-dashed')).toBe(true);
  });

  it('les onglets montent à leur arrivée, à 50 ms l’un de l’autre', () => {
    const { getByRole } = render(Page, { props: { data: AVEC_LIGNES } });
    const onglets = [...getByRole('group', { name: t('search.natureGroup', 'fr') }).children] as HTMLElement[];
    expect(onglets).toHaveLength(6);
    expect(onglets.map((o) => o.style.getPropertyValue('--d'))).toEqual(['0ms', '50ms', '100ms', '150ms', '200ms', '250ms']);
    expect(onglets.every((o) => o.classList.contains('mv-monter'))).toBe(true);
  });
});
