import { describe, expect, it } from 'vitest';
import {
  ADRESSE_DE_CONTACT,
  ancreDeLArticle,
  lienDeSignalement,
  lienWhatsApp,
  lireAncre,
  nomCourtDuTexte,
  numeroDArticleEcrit,
  numeroDuTitre,
  referenceACopier,
  referenceDeLArticle,
  referenceDuTexte,
  texteACopier,
} from './reference';

/**
 * Références et liens d'un article (P2). Le point dur : jamais la cote
 * interne (« PRC-9153 ») dans ce que la page copie, partage ou envoie.
 */

const FR: Record<string, string> = {
  'loi.nom_court': '{nature} n°\u00a0{numero}',
  'badge.decree': 'Décret',
  'badge.law': 'Loi',
  'loi.reference.article': 'Art. {n}, {texte}',
  'loi.copie.foi': 'Seul le texte publié au Journal officiel fait foi.',
  'loi.signalement.sujet': 'Signalement JuriX : {reference}',
  'loi.signalement.corps': 'Texte : {reference}\nAdresse : {url}',
};
const EN: Record<string, string> = {
  'loi.nom_court': '{nature} No.\u00a0{numero}',
  'badge.decree': 'Decree',
  'loi.reference.article': 'Art. {n}, {texte}',
};
const fr = (cle: string) => FR[cle] ?? cle;
const en = (cle: string) => EN[cle] ?? cle;

const DECRET =
  'Décret N°2021/745 du 28 décembre 2021 fixant les modalités d’exercice de certaines compétences transférées par l’Etat aux Régions';

describe('nom et référence d’un texte', () => {
  it('lit le numéro propre de l’acte dans son intitulé', () => {
    expect(numeroDuTitre(DECRET)).toBe('2021/745');
    expect(numeroDuTitre('Loi N° 2016/007 du 12 juillet 2016 portant Code Pénal')).toBe('2016/007');
    expect(numeroDuTitre('Loi N°96/06 du 18 janvier 1996 portant révision de la Constitution du 02 juin 1972.')).toBe(
      '96/06',
    );
    expect(numeroDuTitre('Code civil applicable au Cameroun')).toBeNull();
  });

  it('donne un nom court, traduit, sans cote', () => {
    expect(nomCourtDuTexte({ title: DECRET, type: 'décret' }, fr)).toBe('Décret n°\u00a02021/745');
    expect(nomCourtDuTexte({ title: DECRET, type: 'décret' }, en)).toBe('Decree No.\u00a02021/745');
    expect(
      nomCourtDuTexte({ title: 'Code civil applicable au Cameroun, annoté de la jurisprudence', type: 'autre' }, fr),
    ).toBe('Code civil applicable au Cameroun');
    const long = nomCourtDuTexte(
      {
        title:
          "Acte uniforme portant organisation des procédures simplifiées de recouvrement et des voies d'exécution révisé",
        type: 'acte uniforme',
      },
      fr,
    );
    expect(long.length).toBeLessThanOrEqual(80);
    expect(long).not.toContain('…');
  });

  it('cite l’intitulé dans une phrase, en français', () => {
    expect(referenceDuTexte(DECRET, 'fr')).toBe(
      'décret n°\u00a02021/745 du 28 décembre 2021 fixant les modalités d’exercice de certaines compétences transférées par l’Etat aux Régions',
    );
    expect(referenceDuTexte('Loi N°96/06 du 18 janvier 1996 portant révision de la Constitution du 02 juin 1972.', 'fr')).toBe(
      'loi n°\u00a096/06 du 18 janvier 1996 portant révision de la Constitution du 02 juin 1972',
    );
    expect(referenceDuTexte(DECRET, 'en')).toBe(DECRET);
  });
});

describe('ce que la page copie', () => {
  const url = 'https://jurix.cm/laws/1740?article=1';

  it('écrit « Art. 1er » en français, « Art. 1 » en anglais', () => {
    expect(numeroDArticleEcrit('1', 'fr')).toBe('1er');
    expect(numeroDArticleEcrit('1', 'en')).toBe('1');
    expect(numeroDArticleEcrit('12', 'fr')).toBe('12');
    expect(referenceDeLArticle({ numero: '1', titreDuTexte: DECRET, langue: 'fr' }, fr)).toMatch(
      /^Art\. 1er, décret n°\u00a02021\/745 du 28 décembre 2021 fixant/,
    );
  });

  it('copie la référence suivie du lien, et le texte avec sa mention', () => {
    const reference = referenceDeLArticle({ numero: '1', titreDuTexte: DECRET, langue: 'fr' }, fr);
    expect(referenceACopier(reference, url)).toBe(`${reference}\n${url}`);
    const texte = texteACopier({ paragraphes: ['Premier alinéa.', '  ', 'Second alinéa.'], reference, url }, fr);
    expect(texte).toBe(
      `Premier alinéa.\nSecond alinéa.\n\n— ${reference}\n${url}\n\nSeul le texte publié au Journal officiel fait foi.`,
    );
    expect(texte).not.toMatch(/PRC-/);
  });

  it('prépare un message WhatsApp et un courriel de signalement', () => {
    expect(lienWhatsApp('Art. 1er — Décret n° 2021/745', url)).toBe(
      `https://wa.me/?text=${encodeURIComponent(`Art. 1er — Décret n° 2021/745\n${url}`)}`,
    );
    const lien = lienDeSignalement({ reference: 'décret n° 2021/745', url }, fr);
    expect(lien.startsWith(`mailto:${ADRESSE_DE_CONTACT}?subject=`)).toBe(true);
    const corps = decodeURIComponent(lien.split('&body=')[1]);
    expect(corps).toBe(`Texte : décret n° 2021/745\nAdresse : ${url}`);
  });
});

describe('ancres des articles', () => {
  it('donne une ancre distincte à chaque homonyme', () => {
    expect(ancreDeLArticle({ numero: '12', occurrence: 0 })).toBe('art-12');
    expect(ancreDeLArticle({ numero: '53', occurrence: 2 })).toBe('art-53-3');
  });

  it('relit une ancre, et rien d’autre', () => {
    expect(lireAncre('#art-12')).toEqual({ numero: '12', occurrence: 0 });
    expect(lireAncre('#art-53-3')).toEqual({ numero: '53', occurrence: 2 });
    expect(lireAncre('#contenu')).toBeNull();
    expect(lireAncre('')).toBeNull();
    expect(lireAncre(`#art-${'9'.repeat(40)}`)).toBeNull();
  });
});
