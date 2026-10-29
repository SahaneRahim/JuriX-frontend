import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Changement, StatutJuridique, TexteLie } from '$lib/types';
import { language } from '$lib/stores/language';
import ActionsDeLArticle from './ActionsDeLArticle.svelte';
import BasculeDeLecture from './BasculeDeLecture.svelte';
import HistoriqueDuTexte from './HistoriqueDuTexte.svelte';
import ListeDuSommaire from './ListeDuSommaire.svelte';
import StatutDeLArticle from './StatutDeLArticle.svelte';
import StatutDuTexte from './StatutDuTexte.svelte';
import TexteEntier from './TexteEntier.svelte';
import { decouperLeTexte } from './decoupage';
import { changementsParArticle } from './statut';

/**
 * Les composants de la page d'un texte, montés avec un store de langue
 * simulé (dictionnaires-de-test.ts). Ce qu'ils doivent garantir :
 * - le statut ne dit que ce que le relevé prouve, jamais « En vigueur » ;
 * - les phrases se lisent avec leurs espaces (Svelte retire ceux qui
 *   bordent un bloc `{#if}`, d'où des phrases collées si l'on n'y prend garde) ;
 * - un texte lié n'est un lien que s'il est publié dans JuriX ;
 * - les bascules et les onglets disent leur état autrement que par la couleur.
 */

vi.mock('$lib/stores/language', async () => {
  const { derived, writable } = await import('svelte/store');
  const { EN, FR } = await import('./dictionnaires-de-test');
  const language = writable<{ current: 'fr' | 'en' }>({ current: 'fr' });
  const tr = derived(language, ($langue) => (cle: string) => ($langue.current === 'fr' ? FR : EN)[cle] ?? cle);
  return { language, tr };
});

/** Le texte visible, espaces normalisés (l'espace insécable comprise). */
const texte = (element: Element | null) => (element?.textContent ?? '').replace(/\s+/g, ' ').trim();

function lie(numero: string | null, date: string | null, id: number | null, nature = 'loi'): TexteLie {
  return {
    id,
    reference: id ? `PRC-${id}` : null,
    nature,
    numero,
    titre: numero ? `Loi N°${numero}` : 'Code civil applicable au Cameroun',
    date_signature: date,
    annee: date ? Number(date.slice(0, 4)) : null,
    date_publication_jo: null,
    consultable: id !== null,
  };
}

const L2008 = lie('2008/001', '2008-04-14', 1541);
const L2026 = lie('2026/002', '2026-04-14', 1761);

function changement(id: string, partiel: Partial<Changement>): Changement {
  return {
    id,
    sens: 'modifie_par',
    type: 'modifie',
    nature_modification: 'modifie',
    libelle: 'modifié',
    texte: L2008,
    etendue: 'articles',
    articles_cibles: [],
    section: null,
    articles_source: [],
    portee: null,
    depasse: false,
    depasse_par: null,
    integre_au_texte: false,
    ...partiel,
  };
}

/** Le statut réel de la Constitution (`GET /laws/2143`), réduit. */
const CONSTITUTION: StatutJuridique = {
  releve_le: '2026-10-14',
  etat: 'modifie',
  types: ['modifie', 'complete'],
  abroge: false,
  abroge_par: null,
  version_en_base: null,
  modifie_par: [
    changement('c1', { articles_cibles: ['14', '15', '51'], portee: 'seuls sont réécrits l’alinéa 3 a) de l’article 14' }),
    changement('c2', { type: 'complete', nature_modification: 'complete', articles_cibles: ['67'] }),
    changement('c3', { articles_cibles: ['6', '53'], depasse: true, depasse_par: L2026 }),
    changement('c4', { texte: L2026, nature_modification: 'reecrit_en_entier', articles_cibles: ['6'] }),
    changement('c5', { texte: L2026, articles_cibles: ['5', '7', '10', '53', '66'] }),
  ],
  modifie: [],
  par_article: { '14': ['c1'], '67': ['c2'], '6': ['c3', 'c4'], '5': ['c5'] },
  par_morceau: {},
};

afterEach(() => {
  language.set({ current: 'fr' });
  vi.restoreAllMocks();
});

describe('StatutDuTexte', () => {
  it('sans statut (ancienne API) : version d’origine, sans date ni « en vigueur »', () => {
    render(StatutDuTexte, { props: { statut: null, lienSignaler: 'mailto:x@y.z' } });
    const bloc = screen.getByTestId('law-status');
    expect(texte(bloc)).toBe('Version d’origine, non consolidée. Signaler');
    expect(bloc.querySelector('a')?.getAttribute('href')).toBe('mailto:x@y.z');
    expect(texte(bloc).toLowerCase()).not.toContain('vigueur');
  });

  it('sans lien relevé : la date du relevé, en forme courte', () => {
    const statut = { ...CONSTITUTION, etat: 'aucune_modification_connue' as const, modifie_par: [], par_article: {} };
    render(StatutDuTexte, { props: { statut, lienSignaler: 'mailto:x@y.z' } });
    expect(texte(screen.getByTestId('law-status'))).toBe(
      'Version d’origine, non consolidée. Aucune modification relevée par JuriX au 14 oct. 2026. Signaler',
    );
    // D'un seul bloc en fin de ligne : « au 14 oct. / 2026. » se coupait à 768 px.
    expect(screen.getByTestId('law-status').textContent).toContain('14 oct. 2026');
  });

  it('modifié : chaque texte modificatif, ses articles, et un lien vers lui', () => {
    render(StatutDuTexte, { props: { statut: CONSTITUTION, lienSignaler: 'mailto:x@y.z' } });
    const bloc = screen.getByTestId('law-status');
    expect(bloc.dataset.etat).toBe('modifie');
    const lignes = [...bloc.querySelectorAll('li')].map(texte);
    expect(lignes).toEqual([
      'par la loi n° 2008/001 du 14 avril 2008 (art. 14, 15, 51 ; art. 67 complété)',
      'par la loi n° 2026/002 du 14 avril 2026 (art. 5, 7, 10, 53, 66 ; art. 6 réécrit en entier)',
    ]);
    expect(bloc.querySelector('li a')?.getAttribute('href')).toBe('/laws/1541');
    // Le déterminant hors du lien, comme sur la maquette.
    expect(texte(bloc.querySelector('li a'))).toBe('loi n° 2008/001 du 14 avril 2008');
  });

  it('remplacé : le texte qui le remplace, la phrase entière avec ses espaces', () => {
    const ordonnance = lie('2025/002', '2025-07-18', 2106, 'ordonnance');
    const statut: StatutJuridique = {
      ...CONSTITUTION,
      etat: 'remplace',
      abroge: true,
      abroge_par: ordonnance,
      modifie_par: [changement('c1', { type: 'remplace', nature_modification: 'remplace', etendue: 'texte', texte: ordonnance })],
    };
    render(StatutDuTexte, { props: { statut, lienSignaler: 'mailto:x@y.z' } });
    expect(texte(screen.getByTestId('law-status'))).toBe(
      'Remplacé par l’ordonnance n° 2025/002 du 18 juillet 2025. Relevé de JuriX au 14 oct. 2026. Le texte ci-dessous est sa version d’origine. Signaler',
    );
  });

  it('un texte hors de JuriX est nommé sans lien', () => {
    const statut: StatutJuridique = {
      ...CONSTITUTION,
      modifie_par: [changement('c1', { texte: lie('99/011', '1999-07-20', null), articles_cibles: ['5'] })],
    };
    render(StatutDuTexte, { props: { statut, lienSignaler: 'mailto:x@y.z' } });
    const ligne = screen.getByTestId('law-status').querySelector('li');
    expect(ligne?.querySelector('a')).toBeNull();
    expect(texte(ligne)).toBe('par la loi n° 99/011 du 20 juillet 1999 (art. 5)');
  });
});

describe('StatutDeLArticle', () => {
  const decoupe = decouperLeTexte('Article 5.- a\nArticle 6.- b\nArticle 7.- c');
  const parRang = changementsParArticle(CONSTITUTION, decoupe);

  it('article réécrit : le texte, la nature et l’avertissement, puis la modification dépassée', () => {
    render(StatutDeLArticle, { props: { changements: parRang.get(1), historique: true } });
    const bloc = screen.getByTestId('law-article-status');
    const phrases = [...bloc.querySelectorAll(':scope > p')].map(texte);
    expect(phrases).toEqual([
      'Article modifié par la loi n° 2026/002 du 14 avril 2026 : réécrit en entier.',
      'Le texte ci-dessous est la version d’origine, sans cette modification.',
      'Modification antérieure : par la loi n° 2008/001 du 14 avril 2008, dépassée depuis par la loi n° 2026/002 du 14 avril 2026.',
      'Voir l’historique',
    ]);
  });

  it('demande l’onglet « Historique »', async () => {
    const surHistorique = vi.fn();
    render(StatutDeLArticle, {
      props: { changements: parRang.get(1), historique: true },
      events: { historique: surHistorique },
    });
    await fireEvent.click(screen.getByTestId('law-article-history'));
    expect(surHistorique).toHaveBeenCalledOnce();
  });

  it('ne dit rien d’un article absent du relevé', () => {
    render(StatutDeLArticle, { props: { changements: parRang.get(2), historique: true } });
    expect(screen.queryByTestId('law-article-status')).toBeNull();
  });

  it('dit ce qu’un article fait à un autre texte, sans le dire modifié', () => {
    const porteur = changement('c9', {
      sens: 'modifie',
      type: 'abroge_partiellement',
      nature_modification: 'abroge_partiellement',
      articles_cibles: ['246 à 323'],
      section: 'TITRE VIII : La saisie immobilière',
      texte: lie(null, null, 2285, 'autre'),
    });
    render(StatutDeLArticle, { props: { changements: { actuels: [], anciens: [], portes: [porteur] } } });
    expect(texte(screen.getByTestId('law-article-status'))).toBe(
      'Cet article abroge en partie le texte « Code civil applicable au Cameroun » (art. 246 à 323, dans TITRE VIII : La saisie immobilière).',
    );
  });

  it('en anglais, sans un mot de français hors des intitulés', async () => {
    language.set({ current: 'en' });
    render(StatutDeLArticle, { props: { changements: parRang.get(1) } });
    await tick();
    expect(texte(screen.getByTestId('law-article-status').querySelector('p'))).toBe(
      'Article amended by Law No. 2026/002 of April 14, 2026: rewritten in full.',
    );
  });

  /** L'article 5 de l'ordonnance 74/1 (/laws/2242) : la 77/1 intégrée au document, la 83-19 non. */
  const O77 = changement('c1', { texte: lie('77/1', '1977-01-10', null, 'ordonnance'), integre_au_texte: true });
  const L83 = changement('c3', { texte: lie('83-19', '1983-11-26', null) });

  it('une modification intégrée, l’autre non : jamais « version d’origine »', () => {
    render(StatutDeLArticle, {
      props: { changements: { actuels: [O77, L83], anciens: [], portes: [] }, consolide: true },
    });
    const phrases = [...screen.getByTestId('law-article-status').querySelectorAll(':scope > p')].map(texte);
    expect(phrases).toEqual([
      'Article modifié par l’ordonnance n° 77/1 du 10 janvier 1977. Déjà intégrée au texte affiché.',
      'Article modifié par la loi n° 83-19 du 26 novembre 1983.',
      'Le texte ci-dessous ne contient pas cette modification.',
    ]);
  });

  it('version consolidée en base (Code électoral) : « ne contient pas », pas « version d’origine »', () => {
    const { container } = render(StatutDeLArticle, {
      props: { changements: { actuels: [L83], anciens: [], portes: [] }, consolide: true },
    });
    expect(texte(container)).toBe(
      'Article modifié par la loi n° 83-19 du 26 novembre 1983. Le texte ci-dessous ne contient pas cette modification.',
    );
  });

  it('toutes intégrées : « intègre déjà », sans marque ligne à ligne', () => {
    const { container } = render(StatutDeLArticle, {
      props: { changements: { actuels: [O77], anciens: [], portes: [] }, consolide: true },
    });
    expect(texte(container)).toBe(
      'Article modifié par l’ordonnance n° 77/1 du 10 janvier 1977. Le texte ci-dessous intègre déjà cette modification.',
    );
  });
});

describe('HistoriqueDuTexte', () => {
  it('montre toute la chaîne, dépassés compris, en frise', () => {
    render(HistoriqueDuTexte, { props: { statut: CONSTITUTION } });
    const historique = screen.getByTestId('law-history');
    // « Signaler » vit dans l'encadré de statut, juste au-dessus des onglets.
    expect(historique.querySelector('a[href^="mailto:"]')).toBeNull();
    expect([...historique.querySelectorAll('h3')].map(texte)).toEqual([
      'Loi n° 2008/001 du 14 avril 2008',
      'Loi n° 2026/002 du 14 avril 2026',
    ]);
    expect(texte(historique)).toContain('Modification : art. 14, 15, 51');
    expect(texte(historique)).toContain('Complément : art. 67');
    expect(texte(historique)).toContain('Dépassée depuis par la loi n° 2026/002 du 14 avril 2026.');
    expect(texte(historique)).toContain('Réécriture complète : art. 6');
    // La phrase du relevé reste en français, et le dit.
    expect(historique.querySelector('p[lang="fr"]')?.textContent).toBe('seuls sont réécrits l’alinéa 3 a) de l’article 14');
  });

  it('les articles de ce texte, sans les morceaux internes de l’ingestion (Code du travail)', () => {
    // `modifie` réel de GET /laws/2274 : « SECTION_2 » et « 67.3 » sont des morceaux.
    const portes = (id: string, cibles: string[], sources: string[]) =>
      changement(id, {
        sens: 'modifie',
        type: 'abroge_partiellement',
        nature_modification: 'abroge_partiellement',
        texte: lie(null, null, 2285, 'autre'),
        articles_cibles: cibles,
        articles_source: sources,
      });
    const statut: StatutJuridique = {
      ...CONSTITUTION,
      modifie_par: [],
      modifie: [portes('c1', ['1780'], ['SECTION_2', '25', '174']), portes('c2', ['2271'], ['DISPOSITIF'])],
    };
    render(HistoriqueDuTexte, { props: { statut } });
    const lignes = [...screen.getByTestId('law-history').querySelectorAll('li li > p:first-child')].map(texte);
    expect(lignes).toEqual([
      'Abrogation partielle : art. 1780 (art. 25, 174 de ce texte)',
      // Plus aucun numéro : pas de parenthèse vide.
      'Abrogation partielle : art. 2271',
    ]);
  });
});

describe('ListeDuSommaire', () => {
  const decoupe = decouperLeTexte(
    'CHAPITREI DISPOSITIONS GENERALES\nArticle 1er.- Le présent décret fixe les modalités.\nArticle 2.- La Région assure la SÉCURITÉ.\nCHAPITRE V\nDE LA DELIVRANCE\nArticle 12.- La Région délivre.',
  );

  it('donne la plage, les premiers mots, la barre et les marques', () => {
    render(ListeDuSommaire, {
      props: { decoupe, rangCourant: 1, marques: new Map([[2, 'modifie' as const]]), filtre: '' },
    });
    expect(screen.getByText('Chapitre I · art. 1 à 2')).toBeTruthy();
    expect(screen.getByText('Chapitre V · art. 12')).toBeTruthy();
    const liens = screen.getAllByRole('link');
    expect(liens.map((lien) => lien.getAttribute('href'))).toEqual(['#art-1', '#art-2', '#art-12']);
    expect(liens[1].getAttribute('aria-current')).toBe('location');
    expect(liens[0].getAttribute('aria-current')).toBeNull();
    expect(texte(liens[0])).toBe('Art. 1er Le présent décret fixe les modalités.');
    expect(texte(liens[2])).toContain('· modifié');
  });

  it('filtre sans accents et met l’occurrence en gras', () => {
    render(ListeDuSommaire, { props: { decoupe, rangCourant: 0, marques: new Map(), filtre: 'securite' } });
    const liens = screen.getAllByRole('link');
    expect(liens).toHaveLength(1);
    expect(liens[0].querySelector('strong')?.textContent).toBe('SÉCURITÉ');
  });

  it('dit quand rien ne correspond', () => {
    render(ListeDuSommaire, { props: { decoupe, rangCourant: 0, marques: new Map(), filtre: 'zzz' } });
    expect(screen.getByText('Aucun article ne correspond.')).toBeTruthy();
  });

  it('passe le clic simple à la page', async () => {
    const choisir = vi.fn();
    render(ListeDuSommaire, {
      props: { decoupe, rangCourant: 0, marques: new Map(), filtre: '' },
      events: { choisir: (event: CustomEvent<{ rang: number }>) => choisir(event.detail.rang) },
    });
    await fireEvent.click(screen.getAllByRole('link')[2]);
    expect(choisir).toHaveBeenCalledWith(2);
  });
});

describe('BasculeDeLecture', () => {
  it('dit le mode par aria-pressed et ne signale qu’un changement', async () => {
    const changer = vi.fn();
    render(BasculeDeLecture, {
      props: { mode: 'article' },
      events: { change: (event: CustomEvent<string>) => changer(event.detail) },
    });
    const [article, entier] = screen.getAllByRole('button');
    expect(article.getAttribute('aria-pressed')).toBe('true');
    expect(entier.getAttribute('aria-pressed')).toBe('false');
    await fireEvent.click(article);
    expect(changer).not.toHaveBeenCalled();
    await fireEvent.click(entier);
    expect(changer).toHaveBeenCalledWith('texte');
    expect(screen.getByRole('group').getAttribute('aria-label')).toBe('Mode de lecture');
  });
});

describe('ActionsDeLArticle', () => {
  const props = {
    reference: 'Art. 6, loi n° 96/06 du 18 janvier 1996\nhttps://jurix.cm/laws/2143?article=6',
    texte: 'Le texte.\n\n— Art. 6…',
    lien: 'https://jurix.cm/laws/2143?article=6',
    partage: { title: 'Loi', text: 'Art. 6 — Loi n° 96/06', url: 'https://jurix.cm/laws/2143?article=6' },
  };

  it('copie la référence, le dit dans le bouton et l’annonce', async () => {
    const ecrire = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: ecrire }, configurable: true });
    render(ActionsDeLArticle, { props });
    await fireEvent.click(screen.getByTestId('law-copy-reference'));
    await tick();
    await tick();
    expect(ecrire).toHaveBeenCalledWith(props.reference);
    expect(screen.getByRole('status').textContent).toBe('Référence copiée');
    expect(texte(screen.getByTestId('law-copy-reference'))).toContain('Référence copiée');
  });

  it('trois boutons : référence, texte, lien ; sans partage natif, le lien se copie', async () => {
    const ecrire = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: ecrire }, configurable: true });
    render(ActionsDeLArticle, { props });
    const boutons = screen.getAllByRole('button');
    expect(boutons.map((b) => b.dataset.testid)).toEqual(['law-copy-reference', 'law-copy-text', 'law-copy-link']);
    // Plus de second « Partager » : celui de l'en-tête partage le texte.
    expect(screen.queryByText('Partager')).toBeNull();
    const lien = screen.getByTestId('law-copy-link');
    expect(texte(lien)).toContain('Copier le lien');
    await fireEvent.click(lien);
    await tick();
    await tick();
    expect(ecrire).toHaveBeenCalledWith(props.lien);
    expect(screen.getByRole('status').textContent).toBe('Lien copié');
    expect(String(ecrire.mock.calls[0][0])).not.toMatch(/PRC/);
  });

  it('sur un écran tactile qui l’a, le lien ouvre la feuille de partage du système', async () => {
    const partager = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: partager, configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
    const matchMedia = vi.spyOn(window, 'matchMedia').mockImplementation(
      (requete: string) => ({ matches: requete === '(pointer: coarse)' }) as MediaQueryList,
    );
    try {
      render(ActionsDeLArticle, { props });
      await tick();
      const lien = screen.getByTestId('law-copy-link');
      expect(texte(lien)).toContain('Partager le lien');
      await fireEvent.click(lien);
      expect(partager).toHaveBeenCalledWith(props.partage);
    } finally {
      matchMedia.mockRestore();
      Reflect.deleteProperty(navigator, 'share');
      Reflect.deleteProperty(navigator, 'canShare');
    }
  });
});

describe('TexteEntier', () => {
  it('titre les divisions en h2, les articles en h3 avec leur ancre et un lien direct', () => {
    const decoupe = decouperLeTexte('CHAPITREI DISPOSITIONS GENERALES\nArticle 1er.- Un.\nArticle 2.- Deux.');
    render(TexteEntier, { props: { decoupe, changements: new Map() } });
    expect(texte(screen.getByRole('heading', { level: 2 }))).toBe('Chapitre I DISPOSITIONS GENERALES');
    const titres = screen.getAllByRole('heading', { level: 3 });
    expect(titres.map(texte)).toEqual(['Article 1er', 'Article 2']);
    expect(document.getElementById('art-2')?.tagName).toBe('ARTICLE');
    expect(screen.getByLabelText('Lien vers l’article 1er').getAttribute('href')).toBe('#art-1');
    expect(screen.getByText('Haut de page').closest('a')?.getAttribute('href')).toBe('#contenu');
  });

  it('replie l’ouverture (visas) sous un titre, et s’ouvre sur le premier chapitre', () => {
    const decoupe = decouperLeTexte(
      ['2021/745', 'DECRET N°', 'Vu la Constitution ;', 'CHAPITREI DISPOSITIONS GENERALES', 'Article 1er.- Un.'].join('\n'),
    );
    render(TexteEntier, { props: { decoupe, changements: new Map() } });
    const ouverture = screen.getByTestId('law-opening') as HTMLDetailsElement;
    expect(ouverture.tagName).toBe('DETAILS');
    expect(ouverture.open).toBe(false);
    expect(texte(ouverture.querySelector('summary'))).toBe('Début du texte · intitulé, visas et préambule');
    // Replié, le texte reste dans la page (recherche du navigateur comprise).
    expect(ouverture.textContent).toContain('Vu la Constitution ;');
    // Le texte officiel hors des articles a la taille des articles.
    expect(ouverture.querySelector('[lang]')?.className).toContain('sm:text-lg');
  });

  it('déplie l’ouverture à la demande de la page, sans jamais la replier d’elle-même', async () => {
    const decoupe = decouperLeTexte(['DECRET N°', 'Vu la Constitution ;', 'Article 3: Publié.'].join('\n'));
    const { rerender } = render(TexteEntier, { props: { decoupe, changements: new Map(), deplierLOuverture: true } });
    const ouverture = screen.getByTestId('law-opening') as HTMLDetailsElement;
    expect(ouverture.open).toBe(true);
    // La demande retombe (l'avis de la page s'efface au premier saut) :
    // replier ferait remonter le texte sous le lecteur.
    await rerender({ deplierLOuverture: false });
    expect(ouverture.open).toBe(true);
    // Le lecteur la replie, et une nouvelle demande la déplie.
    ouverture.open = false;
    ouverture.dispatchEvent(new Event('toggle'));
    await tick();
    expect(ouverture.open).toBe(false);
    await rerender({ deplierLOuverture: true });
    expect(ouverture.open).toBe(true);
  });

  it('sans division, les articles sont des h2', () => {
    const decoupe = decouperLeTexte('Article 1er.- Un.\nArticle 2.- Deux.');
    render(TexteEntier, { props: { decoupe, changements: new Map() } });
    expect(screen.getAllByRole('heading', { level: 2 }).map(texte)).toEqual(['Article 1er', 'Article 2']);
  });

  it('garde l’article visé pendant le défilement du saut, puis suit le lecteur', async () => {
    // Positions simulées (jsdom ne met rien en page) : `haut[i]` est le haut
    // de l'article i à l'écran ; la ligne de lecture est à 200 px.
    const haut = [0, 150, 900];
    const rects = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const rang = ['art-1', 'art-2', 'art-3'].indexOf(this.id);
      return { top: rang >= 0 ? haut[rang] : 0 } as DOMRect;
    });
    const zones = vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
    const lus: number[] = [];
    // Image immédiate. Rend 0 : rendu après l'appel, un numéro non nul
    // resterait dans `image` et bloquerait les mesures suivantes.
    const image = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((rappel) => {
      rappel(0);
      return 0;
    });
    // `restoreAllMocks` (afterEach) retire l'implémentation du faux matchMedia de setup.ts.
    const media = vi.spyOn(window, 'matchMedia').mockImplementation(() => ({ matches: false }) as MediaQueryList);
    // jsdom n'a pas `scrollIntoView` : le saut lui-même ne déplace rien ici.
    Element.prototype.scrollIntoView = vi.fn();
    try {
      const decoupe = decouperLeTexte('Article 1er.- Un.\nArticle 2.- Deux.\nArticle 3.- Trois.');
      const { component } = render(TexteEntier, {
        props: { decoupe, changements: new Map() },
        events: { courant: (event: CustomEvent<number>) => lus.push(event.detail) },
      });
      await tick();
      await (component as unknown as { allerA: (rang: number) => Promise<void> }).allerA(2);
      expect(lus.at(-1)).toBe(2);
      // Le défilement doux traverse l'article 2 : il n'est pas annoncé.
      window.dispatchEvent(new Event('scroll'));
      expect(lus.at(-1)).toBe(2);
      // Fin du saut, puis un défilement du lecteur : la mesure reprend.
      window.dispatchEvent(new Event('scrollend'));
      window.dispatchEvent(new Event('scroll'));
      expect(lus.at(-1)).toBe(1);
      // Avant le premier article (visas à l'écran) : aucun article lu.
      haut.splice(0, 3, 400, 600, 900);
      window.dispatchEvent(new Event('scroll'));
      expect(lus.at(-1)).toBe(-1);
    } finally {
      rects.mockRestore();
      zones.mockRestore();
      image.mockRestore();
      media.mockRestore();
    }
  });

  it('le lien direct passe par la page, et « Haut de page » ne fait que défiler', async () => {
    const choisir = vi.fn();
    const decoupe = decouperLeTexte('Article 1er.- Un.\nArticle 2.- Deux.');
    const defiler = vi.fn();
    Element.prototype.scrollIntoView = defiler;
    const media = vi.spyOn(window, 'matchMedia').mockImplementation(() => ({ matches: false }) as MediaQueryList);
    const contenu = document.createElement('main');
    contenu.id = 'contenu';
    document.body.append(contenu);
    try {
      render(TexteEntier, {
        props: { decoupe, changements: new Map() },
        events: {
          choisir: (event: CustomEvent<{ rang: number; evenement: MouseEvent }>) => {
            event.detail.evenement.preventDefault();
            choisir(event.detail.rang);
          },
        },
      });
      const avant = window.location.href;
      // Le lien garde son adresse (copie, nouvel onglet) ; le clic simple va à la page.
      const lien = screen.getByLabelText('Lien vers l’article 2');
      expect(lien.getAttribute('href')).toBe('#art-2');
      expect(await fireEvent.click(lien)).toBe(false);
      expect(choisir).toHaveBeenCalledWith(1);
      // « Haut de page » : aucun changement d'adresse, donc aucune entrée
      // d'historique ; le défilement et le focus seulement.
      const haut = screen.getByText('Haut de page').closest('a') as HTMLAnchorElement;
      expect(await fireEvent.click(haut)).toBe(false);
      expect(window.location.href).toBe(avant);
      expect(defiler).toHaveBeenCalledOnce();
      expect(document.activeElement).toBe(contenu);
      // Le focus parti, le contenu redevient inerte au clic.
      haut.focus();
      expect(contenu.hasAttribute('tabindex')).toBe(false);
    } finally {
      media.mockRestore();
      contenu.remove();
    }
  });

  it('rend un grand texte par lots', () => {
    const contenu = Array.from({ length: 400 }, (_, i) => `Article ${i + 1}.- Texte ${i + 1}.`).join('\n');
    render(TexteEntier, { props: { decoupe: decouperLeTexte(contenu), changements: new Map() } });
    expect(document.querySelectorAll('article')).toHaveLength(120);
    expect(screen.getByText('Suite du texte en cours d’affichage…')).toBeTruthy();
  });
});
