/**
 * Les phrases du chat tirées des données de la refonte (contrat-api.md §2,
 * §4, §7) : statut prouvé d'une citation, aperçu d'un article, étapes de la
 * recherche, annonce de fin, périmètre de l'accueil.
 *
 * Fonctions pures : la traduction est passée par l'appelant (`$tr`), comme
 * dans $lib/format. Testées dans libelles.test.ts.
 *
 * RÈGLE QUI LES GOUVERNE TOUTES (contrat §0.4). Ne rien affirmer que les
 * données ne prouvent pas. Jamais « en vigueur » : l'absence de lien connu se
 * dit « aucune modification relevée par JuriX ». « Version d'origine, non
 * consolidée » seulement quand l'aperçu le permet (`version_en_base` nul) :
 * le statut d'une citation (`StatutProuve`) ne dit pas si le document en
 * base intègre déjà des modifications, ce qui est le cas de deux textes.
 */

import { DATE_ABSENTE, formatDate, formatDateCourte } from '$lib/format';
import { nomCourtDuTexte, typographieDesNumeros } from '$lib/sources';

// Réexportée : les écrans du chat la prennent ici, avec les autres libellés.
export { typographieDesNumeros };
import type { Language } from '$lib/stores/language';
import type {
  ArticleApercu,
  ChiffresDuCorpus,
  CitationsDeLaReponse,
  EtatProuve,
  ProgressionDuChat,
  StatutProuve,
  TexteLie,
} from '$lib/types';
import { decoupeDuTitre, sansNoteDeConsolidation } from './nom-du-texte';

/** `$tr` : une clé, sa traduction (la clé elle-même tant qu'elle manque). */
export type Traduire = (cle: string) => string;

/* -------------------------------------------------------------------------- */
/* Désignation d'un texte                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Les espaces de la ponctuation haute, à la française : « Section III: De la
 * suspension… » devient « Section III : De la suspension… », avec une espace
 * insécable devant le deux-points et une fine devant « ; », « ! » et « ? ».
 *
 * Pour les intitulés que l'ingestion a écrits (la section d'un article), et
 * seulement en français : l'anglais n'en met pas. Une ponctuation qui ne
 * finit pas un mot (« 16:00 ») ne bouge pas. Le texte de l'article lui-même
 * n'y passe pas : c'est le texte officiel, montré tel que la base le garde.
 */
export function ponctuationFrancaise(texte: string): string {
  return texte
    .replace(/([\p{L}\p{N})»])[ \t]*:(?=\s|$)/gu, '$1\u00A0:')
    .replace(/([\p{L}\p{N})»])[ \t]*([;!?])(?=\s|$)/gu, '$1\u202F$2');
}

/** L'intitulé jusqu'à sa date : « Loi N°92/007 du 14 août 1992 portant… » → « Loi n° 92/007 du 14 août 1992 ». */
const JUSQU_A_LA_DATE = /^(.{3,120}?\bdu\s+\d{1,2}(?:er)?\s+[\p{L}.]+\s+\d{4})/iu;

/**
 * Le jour d'une date écrite en toutes lettres, sans son zéro : « 07 octobre
 * 1994 » devient « 7 octobre 1994 », et le premier du mois « 1er » (« 01
 * janvier » ou « 1 janvier »). Les intitulés écrivent le jour à deux
 * chiffres ; à côté de « 14 août 1992 », « 07 octobre 1994 » se lisait comme
 * une autre convention (capture chat-citations r2). Un mois collé au jour
 * (« 07septembre », faute de saisie du corpus) en est séparé. Seulement sur
 * ce que le chat compose (repères, nom) : l'intitulé officiel, montré en
 * entier dans l'aperçu, reste tel quel.
 */
const JOUR_DEVANT_LE_MOIS =
  /(^|\D)0?(\d)\s*((?:janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)(?!\p{L}))/giu;

export function joursSansZero(texte: string): string {
  return texte.replace(
    JOUR_DEVANT_LE_MOIS,
    (_date: string, avant: string, jour: string, mois: string) => `${avant}${jour === '1' ? '1er' : jour} ${mois}`,
  );
}

/**
 * L'identité d'un texte (nature, numéro, date), tirée de son intitulé, ou
 * `null` quand l'intitulé n'en a pas la forme (un code, un traité, un nom de
 * fichier).
 */
export function identiteDuTitre(titre: string | null | undefined): string | null {
  const t = (titre ?? '').replace(/\s+/g, ' ').trim();
  const m = t.match(JUSQU_A_LA_DATE);
  return m ? joursSansZero(typographieDesNumeros(m[1])) : null;
}

/**
 * Comparaison sans casse ni espace insécable : « Décret n° 94/199 » écrit
 * avec une espace ordinaire ou avec une insécable (U+00A0) est le même nom.
 */
function plier(texte: string): string {
  return texte.replace(/\s+/g, ' ').toLowerCase();
}

/** Un texte cité, nommé pour le chat : son nom, puis ses repères, sans redite. */
export interface DesignationDuTexteCite {
  /** « Statut Général de la Fonction Publique de l'État », « Code du travail », ou à défaut « Décret n° 2018/9387/CAB/PM ». */
  nom: string;
  /**
   * Ce que le nom ne dit pas déjà : « Décret n° 94/199 du 7 octobre 1994 »
   * sous un objet (l'en-tête de l'intitulé), la date seule (« 30 novembre
   * 2018 ») sous un nom fait de la nature et du numéro ; `null` sans
   * identité tirée de l'intitulé.
   */
  reperes: string | null;
}

/**
 * Le nom d'un texte cité (« Articles cités », « Textes consultés », ligne
 * d'état, titre de l'aperçu) et ses repères.
 *
 * L'OBJET D'ABORD (./nom-du-texte, la découpe du serveur) : « Art. 120 —
 * Statut Général de la Fonction Publique de l'État », puis « Décret n° 94/199
 * du 7 octobre 1994 », comme « Art. 35 — Code du travail » puis « Loi
 * n° 92/007 du 14 août 1992 » (maquette chat-p3a). Le nom se lisait « Décret
 * n° 94/199 » et la ligne dessous le répétait, sans dire de quoi le décret
 * traite.
 *
 * Les repères sont l'en-tête que la découpe a vérifié (nature, numéro, date
 * et rien d'autre) : l'identité cherchée dans l'intitulé courait parfois
 * jusqu'à la date d'un autre acte, cité dans l'objet, et répétait l'objet
 * sous le nom.
 *
 * Sans objet sûr, le nom court d'avant ($lib/sources) : la nature et le
 * numéro, et dessous la seule date, pour ne pas répéter le numéro. Un nom
 * court que l'intitulé prolonge autrement (« Décret n° 2014 », puis « /131 du
 * 31 mars 2014 ») garde l'identité entière dessous.
 */
export function designationDuTexteCite(titre: string | null | undefined, reference = ''): DesignationDuTexteCite {
  const decoupe = decoupeDuTitre(titre);
  if (decoupe) {
    return {
      nom: joursSansZero(typographieDesNumeros(sansNoteDeConsolidation(decoupe.objet))),
      reperes: joursSansZero(typographieDesNumeros(decoupe.enTete)),
    };
  }

  const identite = identiteDuTitre(titre);
  const court = joursSansZero(typographieDesNumeros(nomCourtDuTexte(titre, reference)));
  if (identite && identite.length > court.length && plier(identite).startsWith(plier(court))) {
    const date = /^[\s,]*(?:du|de)\s+(.+)$/i.exec(identite.slice(court.length));
    if (date) return { nom: court, reperes: date[1].trim() };
  }
  return { nom: court, reperes: identite };
}

/**
 * Un nom réduit à `longueur` caractères au plus, suivi de « … » : pour la
 * ligne d'état, qui nomme deux textes sur une ligne de bulle. Un objet de
 * 150 caractères y prenait quatre lignes sur un téléphone. Coupé à une
 * virgule s'il y en a une assez loin (« Code civil applicable au Cameroun… »
 * plutôt que « … de la jurisprudence de la… »), sinon entre deux mots ; une
 * espace insécable (« n° 2016/007 ») ne se coupe pas.
 */
export function nomRaccourci(nom: string, longueur: number): string {
  if (nom.length <= longueur) return nom;
  const coupe = nom.slice(0, longueur);
  const virgule = coupe.lastIndexOf(', ');
  const espace = coupe.lastIndexOf(' ');
  const fin = virgule > longueur * 0.4 ? virgule : espace > longueur / 2 ? espace : longueur;
  return `${coupe.slice(0, fin).replace(/[\s,;:.\-–—]+$/u, '')}…`;
}

/** L'article défini d'une nature de texte, pour « modifié par la loi … ». */
const ARTICLE_DE_LA_NATURE: Record<string, string> = {
  loi: 'la ',
  'décret': 'le ',
  ordonnance: 'l’',
  'arrêté': 'l’',
  'acte uniforme': 'l’',
  'décision': 'la ',
  circulaire: 'la ',
  instruction: 'l’',
};

/** « 14 avril 2026 », « 1er avril 2026 » : la date d'un intitulé, toujours en français. */
function dateDIntitule(date: string): string {
  return formatDate(date, 'fr').replace(/^1 /, '1er ');
}

/**
 * Un texte lié (`TexteLie`), désigné pour une phrase : « la loi n° 2026/002 du
 * 14 avril 2026 » en français. En anglais, la même désignation française, sans
 * article, initiale en capitale : c'est le nom officiel du texte, qui n'a pas
 * de traduction en base. Sans numéro (un code), l'identité tirée du titre.
 */
export function designationDuTexte(texte: TexteLie, langue: Language): string {
  const nature = (texte.nature ?? '').trim().toLowerCase();
  if (texte.numero && nature && nature !== 'autre') {
    const date = texte.date_signature
      ? ` du ${dateDIntitule(texte.date_signature)}`
      : Number.isInteger(texte.annee)
        ? ` de ${texte.annee}`
        : '';
    const corps = `${nature} n°\u00A0${texte.numero}${date}`;
    return langue === 'fr'
      ? `${ARTICLE_DE_LA_NATURE[nature] ?? ''}${corps}`
      : corps.charAt(0).toUpperCase() + corps.slice(1);
  }
  return identiteDuTitre(texte.titre) ?? typographieDesNumeros(texte.titre);
}

/**
 * Le nom d'un article cité, tel que les listes et l'aperçu l'affichent :
 * « Art. 37 — Code du travail », « Art. 120 — Statut Général de la Fonction
 * Publique de l'État » ; sans numéro, le nom du texte seul
 * (`designationDuTexteCite`). Sans intitulé en base, « Texte sans
 * intitulé » : $lib/sources ne rend plus la cote (« PRC-9153 », P2 et P11).
 */
export function libelleDeLaCitation(
  numero: string | null | undefined,
  titre: string,
  reference: string,
  t: Traduire,
): string {
  const nom = designationDuTexteCite(titre, reference).nom || t('chat.citation.sansIntitule');
  const n = numero?.trim();
  return n ? t('chat.citation.article').replace('{n}', n).replace('{nom}', nom) : nom;
}

/* -------------------------------------------------------------------------- */
/* Statut prouvé d'une citation (listes « Articles cités », « Textes consultés ») */
/* -------------------------------------------------------------------------- */

const ETATS_PROUVES: readonly EtatProuve[] = ['abroge', 'remplace', 'abroge_partiellement', 'modifie', 'complete'];

function estObjet(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** « par la Loi n° … » : en anglais, sans l'article français qui ouvre `par_titre`. */
function texteDuLien(parTitre: string, langue: Language): string {
  const t = typographieDesNumeros(parTitre.trim());
  return langue === 'fr' ? t : t.replace(/^(?:la|le|les)\s+|^l['’]\s*/i, '');
}

/**
 * La mention de statut d'une citation, en minuscules pour suivre une identité
 * (« Loi n° 92/007 du 14 août 1992 · aucune modification relevée par JuriX »).
 *
 * - `etat` connu : « abrogé en partie par la Loi n° 2024/016 du 23 décembre
 *   2024 », d'après le lien le plus récent de cette nature ;
 * - `etat` nul mais des liens : des articles du texte ont changé (contrat
 *   §7.2), sans dire lesquels ;
 * - rien de prouvé : « aucune modification relevée par JuriX », avec la date
 *   du relevé quand elle est connue (`GET /corpus`), et JAMAIS « en vigueur ».
 *
 * Chaîne vide si le statut manque (ancienne API) : on n'écrit rien.
 */
export function mentionDuStatut(
  statut: StatutProuve | null | undefined,
  t: Traduire,
  langue: Language,
  releveLe: string | null = null,
): string {
  if (!estObjet(statut)) return '';
  const liens = Array.isArray(statut.liens) ? statut.liens.filter(estObjet) : [];
  const etat = ETATS_PROUVES.includes(statut.etat as EtatProuve) ? (statut.etat as EtatProuve) : null;
  if (etat) {
    const libelle = t(`chat.statut.etat.${etat}`);
    const lien = liens.find((l) => l.nature === etat) ?? liens[0];
    return lien && typeof lien.par_titre === 'string' && lien.par_titre.trim()
      ? t('chat.statut.par').replace('{etat}', libelle).replace('{texte}', texteDuLien(lien.par_titre, langue))
      : libelle;
  }
  if (liens.length) return t('chat.statut.desArticles');
  return releveLe
    ? t('chat.statut.aucuneAu').replace('{date}', formatDateCourte(releveLe, langue))
    : t('chat.statut.aucune');
}

/** Première lettre en capitale : une mention devenue phrase (aperçu d'un texte entier). */
export function enPhrase(mention: string): string {
  if (!mention) return '';
  const p = mention.charAt(0).toUpperCase() + mention.slice(1);
  return /[.!?…]$/.test(p) ? p : `${p}.`;
}

/* -------------------------------------------------------------------------- */
/* Statut de l'article dans son aperçu                                         */
/* -------------------------------------------------------------------------- */

/** Une ligne de l'encadré de statut ; `changement` : à marquer (icône et graisse, jamais de rouge). */
export interface LigneDeStatut {
  texte: string;
  changement: boolean;
}

/**
 * Les lignes de statut de l'aperçu d'un article (P1 étape 2, appliqué à
 * l'article cité), à partir de `statut` de `GET /laws/{id}/articles/{n}` :
 *
 * - un changement ACTUEL (ni dépassé, ni déjà intégré au texte affiché) :
 *   « Article modifié par la loi n° 2026/002 du 14 avril 2026 : réécrit en
 *   entier. », puis ce que montre le texte affiché ;
 * - sinon, « Version d'origine, non consolidée. » (ou ce que le document
 *   intègre déjà) et la date du relevé : « Aucune modification relevée par
 *   JuriX au 14 oct. 2026. ».
 *
 * L'historique (changements dépassés) n'y est pas : il est sur la page du
 * texte, que « Lire dans le texte intégral » ouvre.
 */
export function lignesDuStatutDeLArticle(apercu: ArticleApercu, t: Traduire, langue: Language): LigneDeStatut[] {
  const statut = apercu.statut;
  const date = formatDateCourte(statut.releve_le, langue);
  const actuels = statut.changements.filter((c) => c.sens === 'modifie_par' && !c.depasse && !c.integre_au_texte);
  const consolidee = statut.version_en_base?.consolidee
    ? statut.version_en_base.textes_integres.map((x) => designationDuTexte(x, langue)).join(', ')
    : null;

  const lignes: LigneDeStatut[] = actuels.map((c) => {
    const modele =
      c.etendue === 'texte'
        ? 'chat.apercu.texte'
        : c.nature_modification === 'reecrit_en_entier'
          ? 'chat.apercu.articleReecrit'
          : 'chat.apercu.article';
    return {
      texte: t(modele)
        .replace('{etat}', t(`chat.statut.etat.${c.type}`))
        .replace('{texte}', designationDuTexte(c.texte, langue)),
      changement: true,
    };
  });

  // Texte entier abrogé sans changement « texte » dans la liste : l'état du
  // texte le dit quand même.
  if (
    (statut.etat_du_texte === 'abroge' || statut.etat_du_texte === 'remplace') &&
    !actuels.some((c) => c.etendue === 'texte')
  ) {
    lignes.push({
      texte: t('chat.apercu.texteEtat').replace('{etat}', t(`chat.statut.etat.${statut.etat_du_texte}`)),
      changement: true,
    });
  }

  if (lignes.length) {
    lignes.push({
      texte: consolidee
        ? t('chat.apercu.afficheConsolidee').replace('{textes}', consolidee)
        : t('chat.apercu.afficheOrigine'),
      changement: false,
    });
    return lignes;
  }

  lignes.push({
    texte: consolidee ? t('chat.apercu.consolidee').replace('{textes}', consolidee) : t('chat.apercu.origine'),
    changement: false,
  });
  lignes.push({
    texte: (statut.etat_du_texte === 'modifie' ? t('chat.apercu.aucunePourLArticle') : t('chat.apercu.aucune')).replace(
      '{date}',
      date,
    ),
    changement: false,
  });
  return lignes;
}

/* -------------------------------------------------------------------------- */
/* Étapes de la recherche, annonce de fin                                      */
/* -------------------------------------------------------------------------- */

/** Au-delà, le nom d'un texte est raccourci dans la ligne d'état (voir `nomRaccourci`). */
const LONGUEUR_D_UN_NOM_DANS_L_ETAPE = 70;

/**
 * Le libellé d'une étape du chat en flux. À l'étape « textes trouvés », les
 * noms des deux premiers textes du classement (« 6 articles trouvés : Code du
 * travail, Statut Général de la Fonction Publique de l'État… », maquette
 * chat-attente-p4a), comme le contrat le propose (§7.1) : leur objet, comme
 * dans « Articles cités », et non plus « Décret n° 94/199 », qui ne disait
 * pas de quoi le texte traite. Ailleurs, le libellé du serveur, déjà dans la
 * langue de la question.
 */
export function libelleDeLEtape(progression: ProgressionDuChat, t: Traduire): string {
  const n = progression.nb_articles;
  if (
    progression.etape === 'textes_trouves' &&
    Number.isInteger(n) &&
    (n as number) > 0 &&
    Array.isArray(progression.textes) &&
    progression.textes.length
  ) {
    const noms = [
      ...new Set(
        progression.textes
          .filter(estObjet)
          .map((x) =>
            nomRaccourci(designationDuTexteCite(x.law_title, x.law_reference).nom, LONGUEUR_D_UN_NOM_DANS_L_ETAPE),
          )
          .filter(Boolean),
      ),
    ];
    if (noms.length) {
      // Un second nom déjà raccourci porte son « … » : pas de second.
      const suite = noms.length > 2 && !noms[1].endsWith('…') ? '…' : '';
      const liste = noms.slice(0, 2).join(', ') + suite;
      return t(n === 1 ? 'chat.progress.foundOne' : 'chat.progress.found')
        .replace('{n}', String(n))
        .replace('{textes}', liste);
    }
  }
  const libelle = typeof progression.libelle === 'string' ? progression.libelle.trim() : '';
  return libelle || t('chat.progress.waiting');
}

/**
 * L'annonce unique de fin de réponse, pour les lecteurs d'écran (P4) :
 * « Réponse terminée, 3 articles cités. », plus les citations non
 * retrouvées. Sans les listes (ancienne API), « Réponse terminée. ».
 */
export function annonceDeFin(listes: CitationsDeLaReponse | null | undefined, t: Traduire): string {
  const cites = Array.isArray(listes?.articles_cites) ? listes.articles_cites.length : 0;
  const perdues = Array.isArray(listes?.citations_introuvables) ? listes.citations_introuvables.length : 0;
  let annonce =
    cites === 0
      ? t('chat.announce.done')
      : t(cites === 1 ? 'chat.announce.doneCitedOne' : 'chat.announce.doneCited').replace('{n}', String(cites));
  if (perdues) {
    annonce += ` ${t(perdues === 1 ? 'chat.announce.unfoundOne' : 'chat.announce.unfound').replace('{n}', String(perdues))}`;
  }
  return annonce;
}

/* -------------------------------------------------------------------------- */
/* Accueil : le périmètre                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Le premier message de l'accueil (P4) : « Je réponds à partir de 2 275 textes
 * officiels camerounais, OHADA et CIMA (dernier texte ajouté à JuriX le
 * 14 octobre 2026). Je ne connais ni la jurisprudence ni votre dossier. »
 *
 * Nombre, périmètre et date viennent de `GET /corpus`. La date est
 * `dernier_ajout_le` : le jour où le dernier texte est entré dans JuriX, une
 * date technique (contrat §1.1 et §2). La phrase le dit tel quel. Elle
 * disait « à jour au 14 octobre 2026 », ce qui affirmait que tout texte paru
 * jusque-là était dans JuriX : la donnée ne le prouve pas (contrat §0.4 : ne
 * rien affirmer que les données ne prouvent pas), et la page d'un texte a
 * remplacé pour la même raison « Mis à jour le » par « Ajouté à JuriX le »
 * (P1). Sans ces chiffres (ancienne API, panne), un texte générique SANS
 * nombre ni date : un chiffre écrit en dur vieillirait en silence.
 */
export function phraseDuPerimetre(chiffres: ChiffresDuCorpus | null, langue: Language, t: Traduire): string {
  const sources = chiffres?.libelle_sources?.[langue];
  if (!chiffres || !Number.isInteger(chiffres.textes) || chiffres.textes < 1 || typeof sources !== 'string' || !sources) {
    return t('chat.welcome.scopeGeneric');
  }
  const nombre = new Intl.NumberFormat(langue === 'fr' ? 'fr-FR' : 'en-US').format(chiffres.textes);
  const date = chiffres.dernier_ajout_le ? formatDate(chiffres.dernier_ajout_le, langue) : null;
  // « le 1er octobre » et non « le 1 octobre » (sans effet sur l'anglais).
  const modele =
    date && date !== DATE_ABSENTE
      ? t('chat.welcome.scopeLastAdded').replace('{date}', joursSansZero(date))
      : t('chat.welcome.scopeNoDate');
  return modele.replace('{n}', nombre).replace('{sources}', sources);
}
