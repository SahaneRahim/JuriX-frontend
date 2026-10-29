import { describe, expect, it } from 'vitest';
import {
  adresseDeCitation,
  articleDeCitation,
  BLOG_POSTS,
  estUneCoteInterne,
  referenceAffichable,
  titreDeCitation,
} from './blog';

/**
 * Les citations d'un article du blog : ni cote interne (P2), un lien vers
 * l'article cité (`?article=N`), et, pour les articles de la rédaction, des
 * extraits relevés mot pour mot dans la base.
 */

describe('estUneCoteInterne', () => {
  it('reconnaît toutes les formes de cote de jurix_dev (relevé du 29/10/2026)', () => {
    for (const cote of [
      'PRC-4722',
      'PRC-10679',
      'LOI-1992-007',
      'LOI-2019-LF-9',
      'ORD-2020-001',
      'DEC-1994-199',
      'OHADA-AUDCG-2010',
      'OHADA-TRAITE-1993',
      'CODE-CIVIL',
      'CIMA-CODE-2019',
    ]) {
      expect(estUneCoteInterne(cote), cote).toBe(true);
    }
  });

  it('laisse les noms, et les sigles qui ne sont pas des cotes', () => {
    expect(estUneCoteInterne('Code civil applicable au Cameroun')).toBe(false);
    expect(estUneCoteInterne('Loi n° 2010/012 relative à la cybersécurité et la cybercriminalité')).toBe(false);
    expect(estUneCoteInterne('N°2018/9387/CAB/PM')).toBe(false);
    expect(estUneCoteInterne('COVID-19')).toBe(false);
    expect(estUneCoteInterne('')).toBe(false);
    expect(estUneCoteInterne(null)).toBe(false);
  });
});

describe('ce qu’une citation affiche', () => {
  it('écarte la cote que le générateur met dans `reference`', () => {
    expect(referenceAffichable({ reference: 'PRC-4722' })).toBeNull();
    expect(referenceAffichable({ reference: ' LOI-1992-007 ' })).toBeNull();
    expect(referenceAffichable({ reference: 'Code du travail (loi n° 92/007)' })).toBe('Code du travail (loi n° 92/007)');
    expect(referenceAffichable({ reference: '' })).toBeNull();
  });

  it('retire la cote de l’intitulé par défaut du générateur (« Article 35.1 - PRC-4722 »)', () => {
    expect(titreDeCitation({ title: 'Article 35.1 - PRC-4722' })).toBe('Article 35.1');
    expect(titreDeCitation({ title: 'Violation de domicile (PRC-4722)' })).toBe('Violation de domicile');
    expect(titreDeCitation({ title: 'PRC-4722' })).toBe('');
    expect(titreDeCitation({ title: 'Du préavis — Code du travail' })).toBe('Du préavis — Code du travail');
  });

  it('un numéro d’article, ou rien (« ? » du générateur)', () => {
    expect(articleDeCitation({ articleNumber: '299' })).toBe('299');
    expect(articleDeCitation({ articleNumber: ' 35.1 ' })).toBe('35.1');
    expect(articleDeCitation({ articleNumber: '?' })).toBeNull();
    expect(articleDeCitation({})).toBeNull();
  });

  it('le lien vise l’article cité (P2), jamais un texte deviné', () => {
    expect(adresseDeCitation({ lawId: 2236, articleNumber: '299' })).toBe('/laws/2236?article=299');
    expect(adresseDeCitation({ lawId: 2271 })).toBe('/laws/2271');
    expect(adresseDeCitation({ lawId: 2274, articleNumber: '?' })).toBe('/laws/2274');
    // 1 : la valeur par défaut du schéma et de l'exemple du prompt, pas un texte sûr.
    expect(adresseDeCitation({ lawId: 1, articleNumber: '12' })).toBeNull();
    expect(adresseDeCitation({ lawId: 0 })).toBeNull();
    expect(adresseDeCitation({ lawId: Number.NaN })).toBeNull();
  });
});

describe('articles de la rédaction (servis sans l’API)', () => {
  const citations = BLOG_POSTS.flatMap((post) => post.botAnalysis.citations.map((c) => ({ post: post.slug, ...c })));

  it('chaque citation vise un article précis d’un texte vérifié, sans cote', () => {
    expect(citations.length).toBeGreaterThan(0);
    for (const c of citations) {
      expect(adresseDeCitation(c), `${c.post} : ${c.title}`).toMatch(/^\/laws\/\d+\?article=\d+$/);
      expect(referenceAffichable(c), `${c.post} : ${c.title}`).not.toBeNull();
      expect(c.verifie, `${c.post} : ${c.title}`).toBe(true);
    }
  });

  it('les identifiants relevés dans jurix_dev, et non plus ceux d’autres textes', () => {
    // /laws/2 (convocation du corps électoral), /laws/1, /laws/14 et /laws/18
    // (décrets de 2013) étaient cités pour le Code civil, le Code pénal, le
    // Code du travail et la loi sur la cybersécurité.
    const textes = new Set(citations.map((c) => c.lawId));
    for (const ancien of [1, 2, 14, 18]) expect(textes.has(ancien)).toBe(false);
    // 2281 : l'Acte uniforme OHADA sur les voies d'exécution (article 29),
    // cité depuis l'audit r2 pour le concours de la force publique.
    expect([...textes].sort()).toEqual([2236, 2271, 2274, 2281, 2285]);
  });

  it('aucune règle de l’audit r2 sans appui : ni huissier, ni indexation, ni « 6 mois »', () => {
    // Phrases sans article à l'appui, dont l'une contredisait le Code du
    // travail (articles 69 et 74) : retirées, et elles ne doivent pas revenir.
    const texte = JSON.stringify(BLOG_POSTS);
    expect(texte).not.toMatch(/huissier|clause d’indexation|sous réserve de mes droits|délai de 6 mois/);
    const cites = (slug: string) =>
      BLOG_POSTS.find((p) => p.slug === slug)!.botAnalysis.citations.map((c) => c.articleNumber);
    expect(cites('litiges-locatifs-resiliation-bail-expulsion-abusive')).toEqual(['1736', '299', '1737', '1134', '29']);
  });

  it('ni « en vigueur », ni casse anglaise dans les noms de codes', () => {
    const texte = JSON.stringify(BLOG_POSTS);
    expect(texte).not.toMatch(/en vigueur/i);
    expect(texte).not.toMatch(/Code (Civil|Pénal|du Travail)/);
  });
});
