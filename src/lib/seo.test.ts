import { describe, expect, it } from 'vitest';
import { descriptionDepuis, titreDePage, urlCanonique } from './seo';

describe('descriptionDepuis', () => {
  it('rend une chaine vide sur une entree absente', () => {
    // Une meta description vide est indexee telle quelle : mieux vaut ne pas
    // rendre la balise du tout, ce que MetaSeo decide sur cette chaine vide.
    for (const vide of [null, undefined, '', '   ']) {
      expect(descriptionDepuis(vide)).toBe('');
    }
  });

  it('laisse intact un texte plus court que la limite, sans ellipse', () => {
    // L'ellipse promet une suite : la poser sur un texte complet est un
    // mensonge, et c'est le defaut de SearchResultCard qui coupait a 200 sans
    // jamais verifier si la coupe avait eu lieu.
    const court = 'Decret portant approbation des statuts de la SOCADEL.';
    expect(descriptionDepuis(court)).toBe(court);
    expect(descriptionDepuis(court)).not.toContain('…');
  });

  it('ne depasse jamais la limite, ellipse comprise', () => {
    // La garantie centrale du contrat : Google tronque lui-meme au-dela
    // d'environ 155 caracteres, et une description coupee par le moteur perd sa
    // fin sans prevenir.
    const long = 'mot '.repeat(200);
    for (const max of [155, 80, 20, 6, 1]) {
      expect(descriptionDepuis(long, max).length).toBeLessThanOrEqual(max);
    }
  });

  it('coupe sur une frontiere de mot', () => {
    const texte = 'Republique du Cameroun Paix Travail Patrie decret ministeriel';
    const rendu = descriptionDepuis(texte, 30);
    expect(rendu.endsWith('…')).toBe(true);
    // Aucun mot tronque : chaque mot rendu existe entier dans la source.
    for (const mot of rendu.replace('…', '').trim().split(' ')) {
      expect(texte.split(' ')).toContain(mot);
    }
  });

  it('coupe dans le mot quand un seul mot depasse la limite', () => {
    // Sans ce cas, la recherche de la derniere espace ne trouve rien et la
    // fonction rendrait une chaine vide — une description vide au lieu d'un
    // fragment lisible.
    const rendu = descriptionDepuis('anticonstitutionnellement', 12);
    expect(rendu.length).toBeLessThanOrEqual(12);
    expect(rendu.length).toBeGreaterThan(1);
  });

  it('retire les marqueurs de page inseres a l ingestion', () => {
    // `<<PAGE:n>>` vient de llama_parse_service et ocr_service : sans nettoyage
    // la description commencerait par « <<PAGE:1>> REPUBLIQUE DU CAMEROUN ».
    const rendu = descriptionDepuis('<<PAGE:1>>\nREPUBLIQUE DU CAMEROUN\n<<PAGE: 2>> suite');
    expect(rendu).not.toContain('PAGE');
    expect(rendu).not.toContain('<<');
    expect(rendu).toContain('REPUBLIQUE DU CAMEROUN');
  });

  it('retire le markdown du corpus OCR', () => {
    const rendu = descriptionDepuis('## **DECRET** N°2026/164 | col | ---');
    expect(rendu).not.toMatch(/[#*|`]/);
    expect(rendu).toContain('DECRET');
  });

  it('reduit les blancs multiples a une espace simple', () => {
    // Le contenu OCR est plein de retours a la ligne et d'indentations, qui
    // n'ont aucun sens sur la ligne unique d'un resultat de recherche.
    expect(descriptionDepuis('a\n\n  b\t\tc')).toBe('a b c');
  });

  it('ne colle pas l ellipse a une ponctuation', () => {
    // « le decret, … » se lit comme une faute de frappe.
    const rendu = descriptionDepuis('le decret, portant approbation des statuts', 14);
    expect(rendu).not.toMatch(/[\s,;:.!?]…$/);
  });
});

describe('titreDePage', () => {
  it('place la partie specifique en premier', () => {
    // L'existant prefixait « JuriX - » : dix onglets ouverts affichaient dix
    // fois le meme debut et devenaient impossibles a distinguer.
    expect(titreDePage('Recherche')).toBe('Recherche — JuriX');
  });

  it('rend le suffixe seul quand il n y a pas de titre specifique', () => {
    for (const vide of [null, undefined, '', '  ']) {
      expect(titreDePage(vide)).toBe('JuriX');
    }
  });

  it('est idempotente', () => {
    // MetaSeo applique la fonction sur le titre recu : une page qui l'appelle
    // deja de son cote produirait « Recherche — JuriX — JuriX ».
    expect(titreDePage(titreDePage('Recherche'))).toBe('Recherche — JuriX');
    expect(titreDePage('JuriX')).toBe('JuriX');
  });
});

describe('urlCanonique', () => {
  it('retire la chaine de requete et le fragment', () => {
    // /laws?page=2 et /laws?page=2&lang=fr servent la meme page : indexees
    // separement, elles se partageraient l'autorite de la page.
    expect(urlCanonique(new URL('https://jurix.cm/laws?page=2&lang=fr'))).toBe(
      'https://jurix.cm/laws',
    );
    expect(urlCanonique(new URL('https://jurix.cm/laws/42#article-3'))).toBe(
      'https://jurix.cm/laws/42',
    );
  });

  it('conserve le chemin exact', () => {
    expect(urlCanonique(new URL('http://localhost:5173/categories/7'))).toBe(
      'http://localhost:5173/categories/7',
    );
  });
});
