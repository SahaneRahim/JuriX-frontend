import { render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SearchResultCard from '$lib/components/SearchResultCard.svelte';
import { language, t } from '$lib/stores/language';
import ListeDeTextes from './ListeDeTextes.svelte';
import type { LigneAffichee } from './lots';
import { formatNombre, remplir, type ResultatAffiche } from './reperes';

/**
 * Le rendu des lignes de liste (P11) et de recherche (P7) : ce que le lecteur
 * d'écran et le doigt atteignent, et ce que la page n'affirme pas.
 * (Les textes viennent de $tr : ici, sans les clés nouvelles, leurs noms.)
 */

vi.mock('$app/navigation', () => ({ afterNavigate: vi.fn(), goto: vi.fn() }));

const NOUVELLE: LigneAffichee = {
  id: 1087,
  title:
    "Décret N°2026/285 du 31 août 2026 portant nomination des Officiers Magistrats chargés de l'Action publique devant les Chambres Militaires des Cours d'Appel",
  type: 'décret',
  publication_date: '2026-08-31',
  article_count: 3,
  objet: "Nomination des Officiers Magistrats chargés de l'Action publique devant les Chambres Militaires des Cours d'Appel",
  numero: '2026/285',
  date_signature: '2026-08-31',
  annee: 2026,
  date_publication_jo: null,
  statut: null,
};

const ANCIENNE: LigneAffichee = {
  id: 285,
  title: "Décret N°2018/763 du 10 décembre 2018 portant révocation d'un Magistrat.",
  type: 'décret',
  publication_date: '2018-12-10',
  article_count: 4,
};

const proprietes = {
  page: 1,
  parPage: 20,
  chemin: '/categories/13',
  filtres: { lang: 'fr' },
  vide: 'Aucun document',
};

describe('ListeDeTextes', () => {
  it('une ligne = un lien vers le texte, objet en titre, sans cote interne', () => {
    const { container } = render(ListeDeTextes, {
      props: { ...proprietes, lignes: [NOUVELLE, ANCIENNE], total: 1277, suivante: true, tri: 'date_desc' },
    });
    const liens = [...container.querySelectorAll('ul[role="list"] > li > a')];
    expect(liens.map((a) => a.getAttribute('href'))).toEqual(['/laws/1087', '/laws/285']);
    expect(liens[0].querySelector('h2')?.textContent?.trim()).toBe(NOUVELLE.objet);
    // Ancienne API : l'intitulé officiel entier.
    expect(liens[1].querySelector('h2')?.textContent?.trim()).toBe(ANCIENNE.title);
    expect(container.textContent).not.toMatch(/PRC-\d+/);
  });

  it('« Afficher 20 de plus » est un lien vers le lot suivant, avec les filtres', () => {
    const { container } = render(ListeDeTextes, {
      props: { ...proprietes, lignes: [NOUVELLE], total: 1277, suivante: true, tri: 'date_desc' },
    });
    const suivant = container.querySelector('a[data-sveltekit-noscroll]');
    expect(suivant?.getAttribute('href')).toBe('/categories/13?lang=fr&page=2');
  });

  it('ouverte sur un lot suivant : le lien du lot précédent', () => {
    const { container } = render(ListeDeTextes, {
      props: { ...proprietes, page: 3, lignes: [NOUVELLE], total: 1277, suivante: true, tri: 'date_desc' },
    });
    const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/categories/13?lang=fr&page=2');
    expect(hrefs).toContain('/categories/13?lang=fr&page=4');
  });

  it('ancienne API : ni total ni ordre annoncés', () => {
    const { container } = render(ListeDeTextes, {
      props: { ...proprietes, lignes: [ANCIENNE], total: null, suivante: true, tri: null },
    });
    expect(container.querySelector('[aria-live]')).toBeNull();
    expect(container.textContent).not.toContain('listes.triRecent');
    // Le lot suivant reste atteignable.
    expect(container.querySelector('a[data-sveltekit-noscroll]')?.getAttribute('href')).toBe(
      '/categories/13?lang=fr&page=2',
    );
  });

  it('dernier lot : plus de bouton', () => {
    const { container } = render(ListeDeTextes, {
      props: { ...proprietes, lignes: [NOUVELLE], total: 1, suivante: false, tri: 'date_desc' },
    });
    expect(container.querySelector('a[data-sveltekit-noscroll]')).toBeNull();
  });

  describe('retour arrière depuis un texte : la liste allongée revient (snapshot)', () => {
    /** Un lot de 20 lignes : ids 20·(n-1)+1 à 20·n. */
    function lot(n: number): LigneAffichee[] {
      return Array.from({ length: 20 }, (_, i) => ({ ...ANCIENNE, id: 20 * (n - 1) + i + 1, title: `Texte ${20 * (n - 1) + i + 1}` }));
    }
    const base = { ...proprietes, chemin: '/laws', filtres: {}, total: 1277, suivante: true, tri: 'date_desc' as const };
    const lignesAffichees = (container: HTMLElement) => container.querySelectorAll('ul[role="list"] > li').length;
    const lienPrecedent = (container: HTMLElement) =>
      [...container.querySelectorAll('a')].find((a) => a.textContent?.includes(remplir(t('listes.precedents', 'fr'), { n: 20 })));

    let defilement: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      defilement = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
      Object.defineProperty(window, 'scrollY', { value: 2400, configurable: true });
    });
    afterEach(() => {
      defilement.mockRestore();
      Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
    });

    it('trois lots affichés, un texte ouvert, « Précédent » : les 60 lignes et la ligne quittée', async () => {
      // « Afficher 20 de plus » deux fois : l'adresse dit ?page=3, l'écran montre 60 lignes.
      const premiere = render(ListeDeTextes, { props: { ...base, lignes: lot(1), page: 1 } });
      await premiere.rerender({ lignes: lot(2), page: 2 });
      await premiere.rerender({ lignes: lot(3), page: 3 });
      expect(lignesAffichees(premiere.container)).toBe(60);
      // SvelteKit la garde au départ, en sessionStorage (JSON).
      const garde = JSON.parse(JSON.stringify(premiere.component.capturer()));
      premiere.unmount();

      // Le texte ouvert a détruit la liste ; au retour, la page recrée la
      // liste avec le seul lot de l'adresse, puis lui rend l'état gardé.
      const retour = render(ListeDeTextes, { props: { ...base, lignes: lot(3), page: 3 } });
      expect(lignesAffichees(retour.container)).toBe(20);
      expect(lienPrecedent(retour.container)).toBeDefined();

      retour.component.restaurer(garde);
      await tick();
      await tick();
      expect(lignesAffichees(retour.container)).toBe(60);
      expect(lienPrecedent(retour.container)).toBeUndefined();
      // La position de la ligne quittée, reprise une fois les lignes rendues.
      expect(defilement).toHaveBeenLastCalledWith(0, 2400);
    });

    it('un seul lot à l’écran : rien à garder', () => {
      const { component } = render(ListeDeTextes, { props: { ...base, lignes: lot(2), page: 2 } });
      expect(component.capturer()).toBeNull();
    });

    it('l’état d’une autre liste (autres filtres) ne s’applique pas', async () => {
      const premiere = render(ListeDeTextes, { props: { ...base, lignes: lot(1), page: 1 } });
      await premiere.rerender({ lignes: lot(2), page: 2 });
      const garde = premiere.component.capturer();
      premiere.unmount();

      const autre = render(ListeDeTextes, { props: { ...base, filtres: { lang: 'en' }, lignes: lot(2), page: 2 } });
      autre.component.restaurer(garde);
      await tick();
      expect(lignesAffichees(autre.container)).toBe(20);
      expect(defilement).not.toHaveBeenCalled();
    });
  });

  describe('sous « Afficher 20 de plus », où l’on en est', () => {
    /** Le texte sous le bouton, et celui qu'en attend la langue de l'interface. */
    function progression(container: HTMLElement): string | undefined {
      return container.querySelector('a[data-sveltekit-noscroll] + p')?.textContent?.trim();
    }
    const langue = () => get(language).current;
    const nombre = (n: number) => formatNombre(n, langue());

    it('partie du premier lot : « N sur le total », les N lignes sont à l’écran', () => {
      const { container } = render(ListeDeTextes, {
        props: { ...proprietes, lignes: [NOUVELLE, ANCIENNE], total: 1277, suivante: true, tri: 'date_desc' },
      });
      expect(progression(container)).toBe(remplir(t('listes.surTotal', langue()), { n: nombre(2), total: nombre(1277) }));
    });

    it('ouverte sur un lot suivant : la plage affichée, et non « 41 sur 1 277 » pour une seule ligne à l’écran', () => {
      const { container } = render(ListeDeTextes, {
        props: { ...proprietes, page: 3, lignes: [NOUVELLE], total: 1277, suivante: true, tri: 'date_desc' },
      });
      expect(progression(container)).toBe(
        remplir(t('listes.plageSurTotal', langue()), { debut: nombre(41), fin: nombre(41), total: nombre(1277) }),
      );
      // Sans la clé, `t` rendait la clé elle-même des deux côtés : le test
      // passait avec « listes.plageSurTotal » à l'écran.
      expect(progression(container)).not.toContain('listes.');
    });
  });
});

const RESULTAT: ResultatAffiche = {
  id: 2274,
  title: 'Loi N°92/007 du 14 août 1992 portant Code du travail',
  type: 'loi',
  publication_date: '1992-08-14',
  category_id: 4,
  category_name: 'Droit du Travail et Sécurité Sociale',
  objet: 'Code du travail',
  numero: '92/007',
  date_signature: '1992-08-14',
  annee: 1992,
  date_publication_jo: null,
  statut: { abroge: false, textes: 1, natures: { modifie: 1 }, date_dernier_texte: '2019-12-24' },
  extrait: [
    { texte: 'a droit à une ', gras: false },
    { texte: 'indemnité', gras: true },
    { texte: ' de ', gras: false },
    { texte: 'licenciement', gras: true },
  ],
  articles: ['35.1', '35.2'],
};

describe('SearchResultCard', () => {
  it('l’objet en lien étendu, avec la référence pour les lecteurs d’écran', () => {
    const { container } = render(SearchResultCard, { props: { resultat: RESULTAT } });
    const lien = container.querySelector('h2 a');
    expect(lien?.getAttribute('href')).toBe('/laws/2274');
    // « Loi n° 92/007, » : la nature (et le numéro, avec la clé `listes.numero`).
    expect(lien?.querySelector('.sr-only')?.textContent).toMatch(/^Loi\b/);
    expect(lien?.textContent).toContain('Code du travail');
  });

  it('les mots cherchés en gras, sans HTML de l’API', () => {
    const { container } = render(SearchResultCard, { props: { resultat: RESULTAT } });
    expect([...container.querySelectorAll('strong')].map((s) => s.textContent)).toEqual(['indemnité', 'licenciement']);
    expect(container.querySelector('mark')).toBeNull();
  });

  it('une puce par article, vers l’article dans le texte', () => {
    const { container } = render(SearchResultCard, { props: { resultat: RESULTAT } });
    const puces = [...container.querySelectorAll('li > div > a')].map((a) => a.getAttribute('href'));
    expect(puces).toEqual(['/laws/2274?article=35.1', '/laws/2274?article=35.2']);
  });

  it('le statut seulement quand l’API en prouve un', () => {
    const avec = render(SearchResultCard, { props: { resultat: RESULTAT } });
    expect(avec.container.querySelector('[data-icone="rotate-ccw-clock"]')).not.toBeNull();
    const sans = render(SearchResultCard, { props: { resultat: { ...RESULTAT, statut: null } } });
    expect(sans.container.querySelector('[data-icone="rotate-ccw-clock"]')).toBeNull();
  });
});
