/**
 * Métadonnées SEO, pour toute l'application.
 *
 * POURQUOI CE MODULE EXISTE. Quatre routes reçoivent leurs métadonnées en même
 * temps. Sans point commun, chacune réécrirait sa propre troncature de
 * description — et la seule troncature existante du dépôt,
 * `src/lib/components/SearchResultCard.svelte:77`, montre exactement les défauts
 * que quatre copies reproduiraient : `result.content?.substring(0, 200)` coupe
 * au milieu d'un mot, n'ajoute pas d'ellipse, et laisse passer tel quel le
 * markdown du corpus (`#`, `**`, les tuyaux de tableau) ainsi que les marqueurs
 * `<<PAGE:n>>` que l'ingestion insère (`app/services/ocr_service.py:297`,
 * `app/services/llama_parse_service.py:298`). Une balise `<meta
 * name="description">` remplie ainsi affiche « ## Article 12 <<PAGE: 3>> ... »
 * dans les résultats de recherche.
 *
 * Deux routes nettoient déjà ces marqueurs à la main — `laws/[id]:133` et
 * `categories/[id]:271` — avec deux expressions différentes. C'est la troisième
 * et la quatrième copie qu'on évite ici.
 *
 * Fonctions PURES, sans accès au store de langue ni à `$page` : c'est ce qui
 * permet de les couvrir dans `seo.test.ts` sans monter de composant, et de les
 * appeler aussi bien depuis un `load` universel que depuis un composant.
 */

/** Le corpus est ingéré page par page ; l'ingestion marque les coupures ainsi. */
const MARQUEUR_PAGE = /<<\s*PAGE\s*:?\s*\d+\s*>>/gi;

/** Tuyaux de tableau markdown : `| Article | Contenu |`. */
const TUYAUX = /\|/g;

/**
 * Séparateurs de tableau (`---`, `:---:`) et filets de section.
 *
 * Deux caractères au minimum, volontairement : un tiret isolé appartient aux
 * mots composés (« sous-préfet ») et un deux-points isolé à une heure ou à une
 * énumération. Les retirer abîmerait le texte au lieu de le nettoyer.
 */
const FILETS = /[:-]{2,}/g;

/** Marques inline du markdown : titres, gras, italique, code. */
const MARQUES = /[#*_`]/g;

/**
 * Une seule ellipse pour tout le site, et un SEUL caractère : « ... » en
 * coûterait trois, et le budget de `maxCaracteres` est serré.
 */
const ELLIPSE = '…';

/**
 * Ponctuation qu'on ne veut pas voir accolée à l'ellipse.
 *
 * Couper après une virgule donne « le décret, … », qui se lit comme une faute.
 */
const PONCTUATION_FINALE = /[\s,;:.!?«"'-]+$/;

/**
 * Description destinée à `<meta name="description">` et à `og:description`.
 *
 * GARANTIE DE LONGUEUR : la chaîne rendue ne dépasse JAMAIS `maxCaracteres`,
 * ellipse comprise. C'est le seul point qui compte vraiment — Google tronque
 * lui-même au-delà d'environ 155 caractères, et une description coupée par le
 * moteur perd sa fin sans prévenir. 155 par défaut pour cette raison.
 *
 * L'ellipse n'est ajoutée QUE si le texte a réellement été coupé : la poser sur
 * une description complète promet une suite qui n'existe pas.
 */
export function descriptionDepuis(
  texte: string | null | undefined,
  maxCaracteres = 155,
): string {
  if (!texte || maxCaracteres <= 0) return '';

  const propre = texte
    // Les marqueurs de page d'abord : ils contiennent des chevrons, un
    // deux-points et des chiffres que les nettoyages suivants découperaient en
    // débris (`<<PAGE:12>>` deviendrait `<<PAGE 12>>`).
    .replace(MARQUEUR_PAGE, ' ')
    .replace(TUYAUX, ' ')
    .replace(FILETS, ' ')
    // Sans espace de remplacement : `**gras**` doit rendre `gras`, pas ` gras `.
    .replace(MARQUES, '')
    // Après seulement : le corpus OCR est plein de retours à la ligne et
    // d'indentations qui n'ont aucun sens sur une seule ligne de résultat.
    .replace(/\s+/g, ' ')
    .trim();

  if (!propre) return '';
  if (propre.length <= maxCaracteres) return propre;

  const limite = maxCaracteres - ELLIPSE.length;
  // Budget si petit que l'ellipse ne tient pas : mieux vaut rendre un fragment
  // court que dépasser la limite, qui est la garantie du contrat.
  if (limite <= 0) return propre.slice(0, maxCaracteres);

  // Un caractère de plus que le budget, pour distinguer deux cas : la coupe
  // tombe pile sur une espace (le dernier mot est entier, on le garde) ou au
  // milieu d'un mot (on remonte à l'espace précédente).
  const fenetre = propre.slice(0, limite + 1);
  const derniereEspace = fenetre.lastIndexOf(' ');

  const tronque =
    derniereEspace > 0
      ? fenetre.slice(0, derniereEspace)
      : // Aucun espace : un mot unique plus long que la limite. Couper dedans
        // est le seul choix restant, et vaut mieux qu'une chaîne vide.
        propre.slice(0, limite);

  return tronque.replace(PONCTUATION_FINALE, '') + ELLIPSE;
}

/**
 * Titre d'onglet et de résultat de recherche. POLITIQUE UNIQUE DU SITE.
 *
 * L'existant hésitait entre trois formes — `JuriX - {x}` (search, laws/[id],
 * categories/[id], chat, accueil), `JuriX — {x}` (about, laws, +error) et
 * `JuriX` seul (admin) — soit deux séparateurs différents et deux ordres.
 *
 * FORME RETENUE : `{le plus spécifique} — JuriX`. La partie spécifique passe en
 * PREMIER parce que c'est la seule qui distingue une page d'une autre, et que
 * les deux endroits où le titre est lu le tronquent par la fin : l'onglet du
 * navigateur, qui n'affiche que quelques caractères quand plusieurs onglets
 * sont ouverts, et le résultat de recherche, coupé aux alentours de 60
 * caractères. Avec le préfixe `JuriX - `, dix onglets ouverts affichaient dix
 * fois « JuriX - … » et devenaient impossibles à distinguer. Le tiret cadratin
 * plutôt que le trait d'union suit `+error.svelte`, `about` et `laws`, qui sont
 * le code le plus récent.
 *
 * IDEMPOTENTE, et ce n'est pas de la coquetterie : `MetaSeo.svelte` applique
 * cette fonction sur le titre qu'il reçoit, donc une page qui l'appelle déjà de
 * son côté produirait « Recherche — JuriX — JuriX ». La garde rend les deux
 * usages équivalents au lieu d'imposer une convention que rien ne vérifie.
 */
export function titreDePage(titre: string | null | undefined, suffixe = 'JuriX'): string {
  const specifique = titre?.trim();
  // Le suffixe seul plutôt qu'un titre vide ou un « — JuriX » orphelin : une
  // page dont le titre n'a pas encore chargé reste nommée.
  if (!specifique) return suffixe;
  if (specifique === suffixe || specifique.endsWith(` ${suffixe}`)) return specifique;
  return `${specifique} — ${suffixe}`;
}

/**
 * URL canonique : origine + chemin, sans requête ni fragment.
 *
 * POURQUOI JETER LA REQUÊTE. `/laws?page=2` et `/laws?page=2&lang=fr` servent la
 * même page ; laissées telles quelles, elles seraient indexées comme deux
 * documents distincts, et l'autorité de la page se diviserait entre eux. Le
 * paramètre `lang` est le cas le plus net : il ne change que l'interface, pas le
 * contenu indexé.
 *
 * Le fragment disparaît de la même façon — `/laws/42#article-3` n'est pas une
 * page, c'est un endroit dans une page. `URL.pathname` l'exclut déjà, mais le
 * dire ici évite qu'on « corrige » plus tard en concaténant `url.hash`.
 */
export function urlCanonique(url: URL): string {
  return `${url.origin}${url.pathname}`;
}
