import { describe, expect, it } from 'vitest';
import { compteDesVerdicts, controleDepuis, groupesDePhrases, relectureDepuis } from './controle';
import { BROUILLON, PHRASES, phrase } from './donnees-de-test';

/**
 * Le contrôle IA et la relecture, tels que les rend l'API (contrat du 30/10),
 * lus défensivement : un verdict inconnu n'est jamais un accord, une case
 * absente n'est jamais cochée.
 */

describe('controleDepuis', () => {
  it('lit le contrôle du contrat', () => {
    const controle = controleDepuis(BROUILLON.controle_ia)!;
    expect(controle.modele).toBe('ministral-14b-latest');
    expect(controle.faitLe).toBe('2026-10-30T09:12:00+00:00');
    expect(controle.phrases).toHaveLength(PHRASES.length);
    expect(controle.phrases[2]).toEqual({
      id: 'p3',
      partie: 'point_cle',
      index: 0,
      texte: 'Pas d’expulsion sans décision de justice.',
      verdict: 'soutenue',
      extraits: [2, 3],
      raison: 'Les extraits 2 et 3 encadrent la fin du bail.',
    });
  });

  it('pas de contrôle (génération dont le contrôle a échoué, article ancien) : null', () => {
    expect(controleDepuis(null)).toBeNull();
    expect(controleDepuis(undefined)).toBeNull();
    expect(controleDepuis({ phrases: 'x' })).toBeNull();
  });

  it('un verdict inconnu se lit « non soutenue », jamais « soutenue »', () => {
    const controle = controleDepuis({ phrases: [phrase('a', 'resume', 0, 'Texte.', 'plausible', [1])] })!;
    expect(controle.phrases[0].verdict).toBe('non_soutenue');
  });

  it('écarte une phrase sans texte ou d’une partie inconnue ; un identifiant en double est remplacé', () => {
    const controle = controleDepuis({
      phrases: [
        phrase('a', 'resume', 0, 'Première.', 'soutenue'),
        phrase('a', 'resume', 0, 'Seconde, même identifiant.', 'soutenue'),
        phrase('b', 'titre', 0, 'Partie inconnue.', 'soutenue'),
        phrase('c', 'impact', 0, '  ', 'soutenue'),
        null,
        { id: 'd', partie: 'impact', index: 'x', texte: 'Index illisible.', verdict: 'contredite', extraits: [2, '3', 0, -1, 2], raison: 7 },
      ],
    })!;
    expect(controle.phrases.map((p) => p.texte)).toEqual(['Première.', 'Seconde, même identifiant.', 'Index illisible.']);
    expect(new Set(controle.phrases.map((p) => p.id)).size).toBe(3);
    // Les numéros d'extraits : entiers positifs, sans doublon, dans l'ordre.
    expect(controle.phrases[2]).toMatchObject({ index: 0, extraits: [2, 3], raison: '7' });
  });

  it('compte les verdicts', () => {
    expect(compteDesVerdicts(controleDepuis(BROUILLON.controle_ia))).toEqual({ soutenue: 5, non_soutenue: 1, contredite: 0, hors_sources: 1 });
    expect(compteDesVerdicts(null)).toEqual({ soutenue: 0, non_soutenue: 0, contredite: 0, hors_sources: 0 });
  });
});

describe('relectureDepuis', () => {
  it('seul `true` coche une case ; qui et quand, notés par le serveur', () => {
    const relecture = relectureDepuis({
      parties: { contexte: true, resume: 'true', points_cles: 1, impact: true },
      par: 'admin@jurix.cm',
      le: '2026-10-30T09:40:00+00:00',
    });
    expect(relecture.parties).toEqual({ contexte: true, resume: false, points_cles: false, impact: true, explications: false, question: false });
    expect(relecture.par).toBe('admin@jurix.cm');
    expect(relectureDepuis(undefined)).toEqual({
      parties: { contexte: false, resume: false, points_cles: false, impact: false, explications: false, question: false },
      par: null,
      le: null,
    });
  });
});

describe('groupesDePhrases : chaque phrase sous son point clé ou sa citation', () => {
  const controle = controleDepuis({
    phrases: [
      phrase('a', 'explication', 1, 'Le congé suit l’usage des lieux.', 'soutenue', [2]),
      phrase('b', 'explication', 0, 'Entrer chez autrui est puni.', 'soutenue', [1]),
      phrase('c', 'point_cle', 0, 'Premier point.', 'soutenue'),
      phrase('d', 'point_cle', 0, 'Il a deux phrases.', 'non_soutenue'),
      phrase('e', 'resume', 0, 'Résumé.', 'soutenue'),
      phrase('f', 'resume', 1, 'Seconde phrase du résumé.', 'hors_sources'),
    ],
  });

  it('une partie d’un seul texte : un seul groupe, dans l’ordre du contrôle', () => {
    expect(groupesDePhrases(controle, 'resume')).toEqual([{ rang: null, phrases: [controle!.phrases[4], controle!.phrases[5]] }]);
    expect(groupesDePhrases(controle, 'impact')).toEqual([]);
  });

  it('les explications, rangées par citation dans l’ordre des citations', () => {
    const groupes = groupesDePhrases(controle, 'explications', ['Entrer chez autrui est puni.', 'Le congé suit l’usage des lieux.']);
    expect(groupes.map((g) => [g.rang, g.phrases.map((p) => p.id)])).toEqual([
      [0, ['b']],
      [1, ['a']],
    ]);
  });

  it('le texte décide, pas l’index : un index compté à partir de 1 ne range pas l’explication sous la mauvaise citation', () => {
    const decale = controleDepuis({
      phrases: [phrase('a', 'explication', 1, 'Entrer chez autrui est puni.', 'soutenue', [1])],
    });
    const [groupe] = groupesDePhrases(decale, 'explications', ['Entrer chez autrui est puni.', 'Le congé.']);
    expect(groupe.rang).toBe(0);
    // Apostrophes et espaces ne changent rien au rattachement.
    const typographie = controleDepuis({ phrases: [phrase('a', 'point_cle', 3, "Pas d'expulsion  sans juge.", 'soutenue')] });
    expect(groupesDePhrases(typographie, 'points_cles', ['Pas d’expulsion sans juge.'])[0].rang).toBe(0);
  });

  it('les deux phrases d’un même point clé restent ensemble', () => {
    const [groupe] = groupesDePhrases(controle, 'points_cles', ['Premier point. Il a deux phrases.']);
    expect(groupe).toEqual({ rang: 0, phrases: [controle!.phrases[2], controle!.phrases[3]] });
  });
});
