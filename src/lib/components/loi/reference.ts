/**
 * Noms, références et liens d'un texte et de ses articles (P2) : ce que la
 * page copie, partage et envoie, sans jamais la cote interne (« PRC-9153 »),
 * un identifiant de collecte qui ne dit rien au lecteur ni au juriste.
 *
 * Fonctions PURES : la langue et la traduction (`$tr`) sont passées par
 * l'appelant, comme $lib/format. Le texte visible passe par les clés
 * `loi.*` de src/lib/stores/language.ts.
 */

import { ADRESSE_DE_CONTACT } from '$lib/contact';
import type { Language } from '$lib/stores/language';
import { typeDeTexte } from '$lib/type-de-texte';

/** `$tr` : une clé, sa traduction. */
export type Traduire = (cle: string) => string;

/**
 * L'adresse de contact publiée sur /about : celle où partent les
 * signalements (« Signaler », P1). Une seule constante pour les deux pages
 * ($lib/contact), réexportée pour les appelants de ce module.
 */
export { ADRESSE_DE_CONTACT };

/** « N°2021/745 », « N° 2016/007 », « n°96/06 » : le numéro propre de l'acte. */
const NUMERO_DANS_LE_TITRE = /\bN\s*[°º]\s*([0-9][^\s,;]*)/i;

/** La nature et le « N° » en tête d'un intitulé officiel (« Décret N°2021/745 … »). */
const NATURE_EN_TETE =
  /^(loi|décret|decret|ordonnance|arrêté|arrete|décision|decision|circulaire|instruction)\s+N\s*[°º]\s*/i;

/**
 * Le numéro de l'acte lu dans son intitulé (« 2021/745 »), ou `null` pour un
 * code, un traité, un acte nommé par son titre. `GET /laws/{id}` ne sert pas
 * le champ `numero` des listes : la page le lit dans le titre, comme lui.
 */
export function numeroDuTitre(titre: string | null | undefined): string | null {
  const m = NUMERO_DANS_LE_TITRE.exec(titre ?? '');
  // Sans le point final d'une phrase (« … n°96/06. »).
  return m ? m[1].replace(/[.)]+$/, '') : null;
}

/**
 * Le nom court d'un texte, pour le fil d'Ariane et le partage : « Décret
 * n° 2021/745 » (« Decree No. 2021/745 »). Sans numéro, le début de
 * l'intitulé jusqu'à sa première virgule (« Code civil applicable au
 * Cameroun »), MOT POUR MOT : c'est le texte du document, que le fil
 * d'Ariane coupe lui-même à sa largeur.
 */
export function nomCourtDuTexte(
  loi: { title?: string | null; type?: string | null },
  traduire: Traduire,
): string {
  const titre = (loi.title ?? '').trim();
  const numero = numeroDuTitre(titre);
  if (numero && NATURE_EN_TETE.test(titre)) {
    return traduire('loi.nom_court')
      .replace('{nature}', traduire(typeDeTexte(loi.type, titre).cle))
      .replace('{numero}', numero);
  }
  const avantLaVirgule = titre.split(',')[0].trim();
  if (avantLaVirgule.length <= 80) return avantLaVirgule;
  const coupe = avantLaVirgule.slice(0, 80);
  const espace = coupe.lastIndexOf(' ');
  return (espace > 40 ? coupe.slice(0, espace) : coupe).trim();
}

/**
 * L'intitulé du texte tel qu'on le cite dans une phrase : « décret n° 2021/745
 * du 28 décembre 2021 fixant … », nature en minuscule et « n° » suivi d'une
 * espace insécable, sans point final. En anglais, l'intitulé officiel
 * (français) reste tel quel.
 */
export function referenceDuTexte(titre: string | null | undefined, langue: Language): string {
  const propre = (titre ?? '').trim().replace(/[\s.]+$/, '');
  if (langue !== 'fr') return propre;
  const m = NATURE_EN_TETE.exec(propre);
  if (!m) return propre;
  return `${m[1].toLowerCase()} n°\u00a0${propre.slice(m[0].length)}`;
}

/** « 1er » en français pour l'article premier, le numéro tel quel ailleurs. */
export function numeroDArticleEcrit(numero: string, langue: Language): string {
  return langue === 'fr' && numero === '1' ? '1er' : numero;
}

/**
 * La référence d'un article (« Copier la référence ») : « Art. 1er, décret
 * n° 2021/745 du 28 décembre 2021 fixant … ».
 */
export function referenceDeLArticle(
  { numero, titreDuTexte, langue }: { numero: string; titreDuTexte: string; langue: Language },
  traduire: Traduire,
): string {
  return traduire('loi.reference.article')
    .replace('{n}', numeroDArticleEcrit(numero, langue))
    .replace('{texte}', referenceDuTexte(titreDuTexte, langue));
}

/** Ce que copie « Copier la référence » : la référence, puis le lien de l'article. */
export function referenceACopier(reference: string, url: string): string {
  return `${reference}\n${url}`;
}

/**
 * Ce que copie « Copier le texte » : le texte de l'article, sa référence, son
 * lien, et la mention qui rappelle que seul le Journal officiel fait foi
 * (P2) — le texte de JuriX vient d'une lecture du PDF officiel.
 */
export function texteACopier(
  { paragraphes, reference, url }: { paragraphes: string[]; reference: string; url: string },
  traduire: Traduire,
): string {
  const texte = paragraphes.map((p) => p.trim()).filter(Boolean).join('\n');
  return `${texte}\n\n— ${reference}\n${url}\n\n${traduire('loi.copie.foi')}`;
}

/**
 * Lien de partage WhatsApp, repli de `navigator.share` (P2) : WhatsApp a
 * remplacé le SMS au Cameroun, et ce lien ouvre l'application avec le
 * message prêt, sans copier-coller.
 */
export function lienWhatsApp(texte: string, url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${texte}\n${url}`)}`;
}

/**
 * Le lien « Signaler » : un courriel prêt à l'adresse de contact, qui nomme
 * le texte (sa référence, jamais sa cote) et l'adresse de la page lue.
 */
export function lienDeSignalement(
  { reference, url, adresse = ADRESSE_DE_CONTACT }: { reference: string; url: string; adresse?: string },
  traduire: Traduire,
): string {
  const sujet = traduire('loi.signalement.sujet').replace('{reference}', reference);
  const corps = traduire('loi.signalement.corps').replace('{reference}', reference).replace('{url}', url);
  return `mailto:${adresse}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`;
}

/**
 * Identifiant d'ancre d'un article : `art-12`, et `art-12-2` pour le deuxième
 * article qui porte ce numéro (une compilation comme le Code civil en a :
 * deux ancres égales seraient deux identifiants en double).
 */
export function ancreDeLArticle(article: { numero: string; occurrence: number }): string {
  return article.occurrence > 0 ? `art-${article.numero}-${article.occurrence + 1}` : `art-${article.numero}`;
}

/** Lit une ancre `#art-12` ou `#art-12-2` : numéro et rang parmi les homonymes, ou `null`. */
export function lireAncre(hash: string | null | undefined): { numero: string; occurrence: number } | null {
  const m = /^#?art-(\d{1,9})(?:-(\d{1,4}))?$/.exec(hash ?? '');
  if (!m) return null;
  // Le numéro tel qu'écrit : il se compare par `normaliserNumeroArticle`, comme `?article=`.
  return { numero: m[1], occurrence: m[2] ? Math.max(0, Number(m[2]) - 1) : 0 };
}
