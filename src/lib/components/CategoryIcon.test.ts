import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import {
  ICONE_DOMAINE_INCONNU,
  NOMBRE_DE_DOMAINES,
  _domainesTraduits,
  iconeCategorie,
  nomCategorie,
} from '$lib/categories';
import { ICONES, type NomIcone } from '$lib/icones';
import CategoryIcon from './CategoryIcon.svelte';

/**
 * L'icône de chaque domaine juridique.
 *
 * POURQUOI. L'icône est choisie par mots-clés et non par nom exact : la page
 * d'une catégorie passe le nom traduit, l'accueil le nom français de l'API.
 * Une règle trop large (« publique », « civil ») donnait la même icône à
 * plusieurs domaines, ou celle d'un autre. Ces tests figent le choix fait sur
 * la planche de contact : chacun des 14 noms réels, en français comme en
 * anglais, a SON icône, et aucune n'est partagée.
 */

/** Les 14 noms canoniques, tels que l'API les sert, et l'icône retenue. */
const ATTENDUES: ReadonlyArray<readonly [string, NomIcone]> = [
  ['Droit Constitutionnel', 'landmark'],
  ['Droit Administratif', 'stamp'],
  ['Fonction Publique', 'id-card-lanyard'],
  ['Droit International', 'globe'],
  ['Finances Publiques et Fiscalité', 'coins'],
  ['Droit Pénal et Procédure Pénale', 'gavel'],
  ['Droit Civil et Procédure Civile', 'scale'],
  ['Droit des Personnes, de la Famille et État Civil', 'user-round-group'],
  ['Droit du Travail et Sécurité Sociale', 'hard-hat'],
  ['Droit des Affaires, Banque et OHADA', 'briefcase-business'],
  ['Droit Foncier et Domanial', 'land-plot'],
  ["Droit de l'Environnement et des Ressources Naturelles", 'leaf'],
  ['Santé Publique et Sécurité Sanitaire', 'heart-pulse'],
  ['Éducation, Recherche, Culture et Médias', 'graduation-cap'],
];

describe('iconeCategorie', () => {
  it('connaît exactement les 14 domaines canoniques', () => {
    // Même liste fermée que les traductions (migration 007 du backend) : un
    // domaine ajouté là-bas doit recevoir une traduction ET une icône.
    expect(ATTENDUES).toHaveLength(NOMBRE_DE_DOMAINES);
    expect(ATTENDUES.map(([nom]) => nom.toLowerCase()).sort()).toEqual([..._domainesTraduits()].sort());
  });

  it('donne à chaque nom réel de l’API l’icône retenue', () => {
    for (const [nom, icone] of ATTENDUES) {
      expect(iconeCategorie(nom), nom).toBe(icone);
    }
  });

  it('donne la même icône au nom traduit en anglais', () => {
    // La page d'une catégorie passe `nomCategorie(…, langue)` : en anglais,
    // « Civil Service » ne doit pas devenir le droit civil, ni « Law of
    // Persons, Family and Civil Status ».
    for (const [nom, icone] of ATTENDUES) {
      const anglais = nomCategorie(nom, 'en');
      expect(anglais, `traduction de ${nom}`).not.toBe(nom);
      expect(iconeCategorie(anglais), anglais).toBe(icone);
    }
  });

  it('ignore la casse, les accents et la forme de l’apostrophe', () => {
    expect(iconeCategorie('DROIT PÉNAL ET PROCÉDURE PÉNALE')).toBe('gavel');
    expect(iconeCategorie('droit penal et procedure penale')).toBe('gavel');
    expect(iconeCategorie('Sante Publique et Securite Sanitaire')).toBe('heart-pulse');
    expect(iconeCategorie('Droit de l’Environnement et des Ressources Naturelles')).toBe('leaf');
    expect(iconeCategorie('  Fonction   publique ')).toBe('id-card-lanyard');
    // Accents en forme décomposée (NFD), comme certains copier-coller.
    expect(iconeCategorie('Éducation, Recherche, Culture et Médias'.normalize('NFD'))).toBe('graduation-cap');
  });

  it('ne prend que des mots entiers', () => {
    // « publique » est dans trois noms, « civil » dans quatre : seules les
    // règles précises les reconnaissent, dans l'ordre de la table.
    expect(iconeCategorie('Finances Publiques et Fiscalité')).not.toBe(iconeCategorie('Fonction Publique'));
    expect(iconeCategorie('Droit des Personnes, de la Famille et État Civil')).not.toBe('scale');
    expect(iconeCategorie('Island Affairs')).toBe(ICONE_DOMAINE_INCONNU); // « land » n'est pas dans « island »
  });

  it('attribue 14 icônes différentes, et un repli qui n’en est aucune', () => {
    const icones = ATTENDUES.map(([nom]) => iconeCategorie(nom));
    expect(new Set(icones).size).toBe(NOMBRE_DE_DOMAINES);
    expect(icones).not.toContain(ICONE_DOMAINE_INCONNU);
  });

  it('retombe sur l’icône de repli pour un nom inconnu ou absent', () => {
    expect(iconeCategorie('Droit Spatial')).toBe(ICONE_DOMAINE_INCONNU);
    expect(iconeCategorie('')).toBe(ICONE_DOMAINE_INCONNU);
    expect(iconeCategorie(null)).toBe(ICONE_DOMAINE_INCONNU);
    expect(iconeCategorie(undefined)).toBe(ICONE_DOMAINE_INCONNU);
  });

  it('ne choisit que des icônes du registre', () => {
    for (const icone of [...ATTENDUES.map(([, nom]) => nom), ICONE_DOMAINE_INCONNU]) {
      expect(ICONES[icone], icone).toBeTruthy();
    }
  });
});

describe('CategoryIcon', () => {
  it('rend l’icône Lucide du domaine, décorative', () => {
    const { container } = render(CategoryIcon, { category: 'Droit Civil et Procédure Civile' });
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('data-icone')).toBe('scale');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('stroke')).toBe('currentColor');
    // Les tracés existent, dans l'espace de noms SVG : un élément créé en
    // HTML par erreur ne serait pas dessiné.
    const traces = [...(svg?.children ?? [])];
    expect(traces.length).toBe(5);
    expect(traces.every((t) => t.namespaceURI === 'http://www.w3.org/2000/svg')).toBe(true);
    expect(traces[0].getAttribute('d')).toBe('M12 3v18');
  });

  it('garde 24 px par défaut et prend les classes de l’appelant', () => {
    const parDefaut = render(CategoryIcon, { category: 'Droit Constitutionnel' });
    expect(parDefaut.container.querySelector('svg')?.getAttribute('class')).toBe('icone w-6 h-6');
    parDefaut.unmount();

    const { container } = render(CategoryIcon, {
      category: 'Droit Constitutionnel',
      class: 'w-5 h-5 text-zinc-800',
    });
    expect(container.querySelector('svg')?.getAttribute('class')).toBe('icone w-5 h-5 text-zinc-800');
  });

  it('suit un changement de catégorie', async () => {
    const { container, rerender } = render(CategoryIcon, { category: 'Droit International' });
    expect(container.querySelector('svg')?.getAttribute('data-icone')).toBe('globe');
    await rerender({ category: 'Santé Publique et Sécurité Sanitaire' });
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('data-icone')).toBe('heart-pulse');
    // L'ancien dessin est bien remplacé, et non ajouté au nouveau.
    expect(svg?.innerHTML).not.toContain('M2 12h20');
  });
});
