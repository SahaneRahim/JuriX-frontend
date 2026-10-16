import { describe, expect, it } from 'vitest';
import { DATE_ABSENTE, formatDate, formatDateCourte, formatDateHeure } from './format';

describe('formatDate', () => {
  it('suit la langue au lieu de coder fr-FR en dur', () => {
    // Deux des sept implementations d'origine forcaient "fr-FR" : les dates
    // restaient francaises meme quand l'interface passait en anglais.
    expect(formatDate('2026-05-04', 'fr')).toContain('mai');
    expect(formatDate('2026-05-04', 'en')).toContain('May');
  });

  it('rend un repli unique sur une valeur absente', () => {
    // Les implementations d'origine rendaient "", "N/A" ou "—" selon l'ecran.
    for (const vide of [null, undefined, '']) {
      expect(formatDate(vide, 'fr')).toBe(DATE_ABSENTE);
    }
  });

  it('ne rend jamais « Invalid Date »', () => {
    // Deux appels en ligne (admin/documents, admin/+page) n'avaient aucune
    // garde et affichaient litteralement « Invalid Date » a l'utilisateur.
    expect(formatDate('pas une date', 'fr')).toBe(DATE_ABSENTE);
    expect(formatDateCourte('2026-13-45', 'fr')).toBe(DATE_ABSENTE);
    expect(formatDateHeure('???', 'en')).toBe(DATE_ABSENTE);
  });

  it('la forme courte abrege le mois', () => {
    // Janvier et non mai : en francais « mai » s'ecrit pareil en court et en
    // long, l'assertion aurait ete vraie sans rien prouver.
    const longue = formatDate('2026-01-15', 'fr');
    const courte = formatDateCourte('2026-01-15', 'fr');
    expect(longue).toContain('janvier');
    expect(courte).not.toContain('janvier');
    expect(courte).toContain('2026');
  });

  it("lit un horodatage sans fuseau comme de l'UTC, quel que soit le fuseau local", () => {
    // L'API rend « 2026-10-15T00:30:00 », en UTC mais sans le dire. Lu en heure
    // locale a Douala (UTC+1), il devenait le 14 octobre dans le navigateur et
    // restait le 15 au serveur : le texte changeait a l'hydratation.
    const avant = process.env.TZ;
    process.env.TZ = 'Africa/Douala';
    try {
      expect(formatDate('2026-10-15T00:30:00', 'fr')).toBe('15 octobre 2026');
      expect(formatDate('2026-10-15T00:30:00.123456', 'fr')).toBe('15 octobre 2026');
      // Une chaine qui porte son fuseau n'est pas touchee.
      expect(formatDate('2026-10-15T00:30:00+01:00', 'fr')).toBe('14 octobre 2026');
      expect(formatDateHeure('2026-10-15T00:30:00', 'fr')).toContain('01:30');
    } finally {
      if (avant === undefined) delete process.env.TZ;
      else process.env.TZ = avant;
    }
  });
});
