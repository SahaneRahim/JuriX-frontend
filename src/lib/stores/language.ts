import { derived, writable } from 'svelte/store';
import type { Writable } from 'svelte/store';
import { browser } from '$app/environment';

// Language type
export type Language = 'fr' | 'en';

// Language state interface
export interface LanguageState {
  current: Language;
}

// Default language
const DEFAULT_LANGUAGE: Language = 'fr';

// Storage key
const LANGUAGE_STORAGE_KEY = 'jurix-language';

// Get initial language from localStorage or default
function getInitialLanguage(): Language {
  if (browser) {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === 'fr' || stored === 'en') {
      return stored;
    }
  }
  return DEFAULT_LANGUAGE;
}

// Create the language store
function createLanguageStore() {
  const { subscribe, set, update } = writable<LanguageState>({
    current: getInitialLanguage()
  });

  return {
    subscribe,
    set,
    update
  };
}

// Export the main language store
export const language: Writable<LanguageState> = createLanguageStore();

// Action: Switch language (with persist and reload)
export const switchLanguage = (newLang: Language) => {
  language.update(state => ({
    ...state,
    current: newLang
  }));

  // Persist to localStorage
  if (browser) {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, newLang);
  }
};

// languageFilter, toggleShowAll et languageStore ont ete retires.
//
// Leur unique consommateur, ShowAllLanguagesToggle.svelte, a ete supprime ;
// l'API du store, elle, est restee, avec les neuf tests qui l'exerçaient. Des
// tests verts sur du code que personne n'appelle donnent une couverture qui
// rassure a tort.

// Comprehensive translations
export const translations = {
  fr: {
    'signup.title': 'Créer un compte',
    'signup.subtitle': 'Conservez vos conversations d\'une visite à l\'autre.',
    'signup.name': 'Nom complet',
    // Exemples des champs de compte : un nom et une adresse de convention,
    // les mêmes d'une langue à l'autre. Le nom était celui du propriétaire,
    // et l'adresse de la connexion (« admin@jurix.cm », en dur) évoquait un
    // compte d'administration plausible.
    'signup.namePlaceholder': 'Jean Dupont',
    'auth.emailPlaceholder': 'vous@exemple.cm',
    'signup.email': 'Adresse email',
    'signup.password': 'Mot de passe',
    'signup.passwordHint': '8 caractères minimum, avec une majuscule, une minuscule et un chiffre.',
    'signup.submit': 'Créer mon compte',
    'signup.submitting': 'Création…',
    'signup.haveAccount': 'Vous avez déjà un compte ?',
    'signup.errorEmailTaken': 'Un compte existe déjà avec cette adresse.',
    'signup.errorInvalid': 'Vérifiez les informations saisies.',
    'signup.errorGeneric': 'Création impossible. Réessayez dans un instant.',
    // ---- Mot de passe oublié, réinitialisation, vérification d'adresse ----
    'forgot.title': 'Mot de passe oublié',
    'forgot.subtitle': 'Indiquez votre adresse : nous vous enverrons un lien pour choisir un nouveau mot de passe.',
    'forgot.email': 'Adresse email',
    'forgot.submit': 'Envoyer le lien',
    'forgot.submitting': 'Envoi…',
    'forgot.sent': 'Message envoyé',
    'forgot.sentDetail': 'Si un compte existe pour cette adresse, un lien vient d\'être envoyé. Le lien expire dans 30 minutes.',
    // Sans nom de domaine, l'expéditeur est réécrit par le service d'envoi :
    // l'utilisateur voit une adresse qu'il ne reconnaît pas. Le dire vaut mieux
    // que le laisser conclure que le service est cassé.
    'forgot.spamHint': 'Pensez à regarder vos courriers indésirables. L\'expéditeur peut apparaître sous un nom inconnu.',
    'forgot.errorGeneric': 'Envoi impossible. Réessayez dans un instant.',
    'forgot.backToLogin': 'Retour à la connexion',
    'lien.usedTitle': 'Lien déjà utilisé',
    // Saut de ligne entre les deux phrases : la page les affiche une par ligne
    // (`whitespace-pre-line`), et non coupées au hasard de l'équilibrage.
    // Espace insécable (U+00A0) avant le dernier mot, en français comme en
    // anglais : en 390 px, « un. » restait seul sur sa ligne, sous une ligne
    // pleine. La page équilibre chaque phrase (`text-balance`) ; l'espace
    // insécable tient aussi là où l'équilibrage n'existe pas.
    'lien.usedDetail': 'Ce lien ne sert qu\'une fois.\nS\'il vous en faut un nouveau, redemandez-en\u00a0un.',
    'reset.title': 'Nouveau mot de passe',
    'reset.subtitle': 'Choisissez un mot de passe pour votre compte.',
    'reset.password': 'Nouveau mot de passe',
    'reset.confirm': 'Confirmez le mot de passe',
    'reset.mismatch': 'Les deux mots de passe ne correspondent pas.',
    'reset.submit': 'Changer mon mot de passe',
    'reset.submitting': 'Modification…',
    'reset.success': 'Mot de passe modifié. Vous pouvez vous connecter.',
    'reset.errorToken': 'Ce lien n\'est plus valide. Demandez-en un nouveau.',
    'reset.errorGeneric': 'Modification impossible. Réessayez dans un instant.',
    'reset.askNewLink': 'Demander un nouveau lien',
    'verify.title': 'Confirmation de l\'adresse',
    'verify.pending': 'Vérification en cours…',
    'verify.success': 'Adresse confirmée. Merci !',
    'verify.errorToken': 'Ce lien n\'est plus valide. Il a peut-être déjà servi.',
    'verify.errorGeneric': 'Vérification impossible. Réessayez dans un instant.',
    'verify.goHome': 'Aller à l\'accueil',
    // `/verify-email` sans jeton : le lien a servi, ce qui est le cas NORMAL
    // après une confirmation réussie. Le texte de `/reset-password` (« S'il
    // vous en faut un nouveau, redemandez-en un ») y promettait une action
    // que la page n'offre pas, et se lisait comme un échec.
    'verify.usedDetail': 'Ce lien a déjà servi : votre adresse est sans doute déjà confirmée. Vous pouvez vous connecter.',
    'login.subtitle': 'Retrouvez vos conversations enregistrées.',
    'login.forgotPassword': 'Mot de passe oublié ?',
    'login.noAccount': 'Pas encore de compte ?',
    'auth.orGoogle': 'ou',
    'auth.googleButton': 'Continuer avec Google',
    'auth.googleError': 'Connexion Google refusée.',
    'auth.googleUnavailable': 'La connexion Google est momentanément indisponible.',
    // ---- Champ de mot de passe (ChampMotDePasse.svelte) et récupération ----
    // Le libellé dit l'action du bouton ; son état passe par aria-pressed.
    'auth.showPassword': 'Afficher le mot de passe',
    'auth.hidePassword': 'Masquer le mot de passe',
    // Sous l'erreur « Identifiants invalides » : un mot de passe oublié en
    // est la cause la plus courante, la sortie s'affiche là où l'on regarde.
    'login.resetHint': 'Vous avez oublié votre mot de passe ?',
    'login.resetLink': 'Recevoir un lien pour le changer',
    // Refus de FORME (champ vide, adresse mal écrite) : il ne dit rien de
    // l'existence d'un compte, contrairement à une réponse sur le fond.
    'forgot.errorInvalid': 'Saisissez une adresse email valide.',
    'nav.signup': 'Créer un compte',
    'chat.conversations': 'Mes conversations',
    'chat.newConversation': 'Nouvelle conversation',
    'chat.untitledConversation': 'Sans titre',
    'chat.deleteConversation': 'Supprimer la conversation',
    'chat.conversationsEmpty': 'Aucune conversation enregistrée.',
    'chat.conversationsError': 'Impossible de charger vos conversations.',
    'chat.errorConversationGone': 'Cette conversation n\'est plus accessible. Une nouvelle a été démarrée.',
    'chat.signInToKeep': 'Créez un compte pour conserver vos conversations.',
    'chat.barTitle': 'Assistant JuriX',
    'chat.backHome': 'Retour à l\'accueil',
    'chat.scrollToLatest': 'Aller au dernier message',
    'chat.showSources': 'Afficher les sources',
    'chat.hideSources': 'Masquer les sources',
    'common.errorNetwork': 'Impossible de joindre le serveur.',
    'pdf.loading': 'Chargement du document…',
    'pdf.errorLoad': 'Impossible de charger le document.',
    'pdf.errorUnknown': 'Erreur inconnue',
    'pdf.errorPage': 'Erreur lors du chargement de la page {n}',
    'pdf.errorHint': 'Essayez de rafraîchir la page ou contactez l\'administrateur.',
    'pdf.previous': '← Précédent',
    'pdf.next': 'Suivant →',
    'pdf.page': 'Page',
    'pdf.of': 'sur',
    'pdf.zoomOut': 'Réduire',
    'pdf.zoomIn': 'Agrandir',
    'pdf.keyboardHint': 'Utilisez les flèches ← → pour naviguer',
    'pdf.pageAlt': 'Page {n}',
    // Noms des boutons réduits à une flèche sur téléphone, et du cadre qui
    // défile une fois la page agrandie.
    'pdf.previousPage': 'Page précédente',
    'pdf.nextPage': 'Page suivante',
    'pdf.fitWidth': 'Ajuster à la largeur',
    'pdf.viewer': 'Page du document',
    'login.title': 'Connexion',
    'login.email': 'Adresse email',
    'login.password': 'Mot de passe',
    'login.submit': 'Se connecter',
    'login.submitting': 'Connexion…',
    'login.errorCredentials': 'Identifiants invalides.',
    'login.errorDisabled': 'Ce compte est désactivé.',
    'login.errorGeneric': 'Connexion impossible. Réessayez dans un instant.',
    'login.errorNetwork': 'Impossible de joindre le serveur.',
    'common.close': 'Fermer',
    'common.cancel': 'Annuler',
    'common.save': 'Enregistrer',
    'common.saving': 'Enregistrement…',
    'admin.users': 'Utilisateurs',
    // Sans point final, comme les sous-titres des quatre autres pages de
    // l'administration.
    'admin.usersDesc': 'Comptes autorisés à accéder à l\'administration',
    'admin.backToSite': 'Retour au site',
    'admin.logout': 'Déconnexion',
    'admin.administration': 'Administration',
    'admin.checkingSession': 'Vérification de la session…',
    // Sous le nombre de documents du tableau de bord (StatsCard) : `recent_laws`
    // compte les textes créés dans les 30 derniers jours
    // (app/api/routes/analytics.py), et non « depuis le mois dernier ».
    'admin.inLast30Days': 'en 30 jours',
    'admin.requests': 'requêtes',
    // Modes de recherche (app/schemas/search.py), sous les barres du
    // graphique du tableau de bord (`libelleMode`) : la valeur brute de
    // l'API, en anglais, s'affichait sur la page française.
    'admin.searchMode.hybrid': 'Hybride',
    'admin.searchMode.text': 'Plein texte',
    'admin.searchMode.semantic': 'Sémantique',
    'admin.role.user': 'Utilisateur',
    'admin.role.admin': 'Administrateur',
    'admin.role.superadmin': 'Super-administrateur',
    'admin.user.new': 'Nouveau compte',
    'admin.user.edit': 'Modifier le compte',
    // « Adresse email », comme la connexion et l'inscription.
    'admin.user.email': 'Adresse email',
    'admin.user.username': 'Nom d\'utilisateur',
    'admin.user.usernameHint': 'Converti en minuscules à l\'enregistrement.',
    'admin.user.fullName': 'Nom complet',
    'admin.user.role': 'Rôle',
    'admin.user.roleHint': 'Seul un super-administrateur peut changer un rôle',
    'admin.user.active': 'Compte actif',
    'admin.user.password': 'Mot de passe',
    'admin.user.passwordKeep': '(laisser vide pour ne pas changer)',
    'admin.user.passwordHint': '8 caractères minimum, avec majuscule, minuscule et chiffre.',
    'admin.user.errEmail': 'Adresse email invalide.',
    'admin.user.errUsernameLen': 'Le nom d\'utilisateur doit faire au moins 3 caractères.',
    'admin.user.errUsernameChars': 'Le nom d\'utilisateur n\'accepte que lettres, chiffres, _ et -.',
    'admin.user.errPwdLen': 'Le mot de passe doit faire au moins 8 caractères.',
    'admin.user.errPwdUpper': 'Le mot de passe doit contenir une majuscule.',
    'admin.user.errPwdLower': 'Le mot de passe doit contenir une minuscule.',
    'admin.user.errPwdDigit': 'Le mot de passe doit contenir un chiffre.',
    'admin.user.errSave': 'Enregistrement impossible ({status}).',
    'admin.users.searchPlaceholder': 'Rechercher par adresse email, identifiant ou nom…',
    // Sans article, comme « Toutes catégories », « Toutes langues » et « Tous
    // statuts » des autres filtres.
    'admin.users.allRoles': 'Tous rôles',
    'admin.users.activePlural': 'Actifs',
    'admin.users.inactivePlural': 'Inactifs',
    'admin.users.activeOne': 'Actif',
    'admin.users.inactiveOne': 'Inactif',
    'admin.users.loadError': 'Chargement impossible ({status}).',
    'admin.users.none': 'Aucun compte ne correspond.',
    'admin.users.account': 'Compte',
    'admin.users.name': 'Nom',
    'admin.users.lastLogin': 'Dernière connexion',
    'admin.users.confirmDelete': 'Supprimer définitivement le compte {email} ?',
    'admin.users.deleteError': 'Suppression impossible ({status}).',
    'admin.doc.editTitle': 'Modifier le document',
    'admin.doc.title': 'Titre',
    'admin.doc.titlePlaceholder': 'Titre du document',
    'admin.doc.category': 'Catégorie',
    // Sans tirets ASCII, dans les deux fenêtres qui choisissent la catégorie
    // d'un texte (EditModal, UploadModal) : c'est une vraie valeur (aucune
    // catégorie), et non une invite. La fenêtre d'ajout affichait en noir
    // « -- Sélectionner une catégorie -- », lu comme une valeur choisie.
    'admin.doc.noCategory': 'Aucune catégorie',
    'admin.doc.content': 'Contenu',
    'admin.doc.contentPlaceholder': 'Contenu du document…',
    'admin.doc.chars': 'caractères',
    'admin.doc.saveError': 'Erreur : {detail}',
    'admin.doc.unknownError': 'Erreur inconnue',
    'admin.upload.title': 'Ajouter des documents',
    'admin.upload.titlePlaceholder': 'Ex : La Constitution du Cameroun',
    // Mention d'un champ facultatif, posée après son libellé en gris et sans
    // gras, dans la fenêtre d'ajout comme dans le générateur d'articles : le
    // générateur l'écrivait dans son libellé, en gras.
    'admin.optional': '(optionnel)',
    'admin.upload.refPlaceholder': 'Ex : LOI-2024-001 ou Décret N°2024/PM/123',
    'admin.upload.refHint': 'Numéro officiel du document juridique',
    'admin.upload.category': 'Catégorie du document',
    'admin.upload.loadingCategories': 'Chargement des catégories…',
    // Zone de dépôt de la fenêtre d'ajout, écrite comme celle de l'import en
    // lot (« Touchez pour choisir… », « … max par fichier ») : seule la
    // consigne à la souris diffère, la fenêtre ne recevant pas de fichiers
    // glissés. 250 Mo : la limite du téléversement unitaire
    // (FileUploadService, max_size_mb=250, app/api/routes/upload.py) ; le
    // « 1 Go » affiché était celui de l'import en lot (MAX_UPLOAD_SIZE).
    'admin.upload.clickToSelect': 'Cliquez pour choisir des fichiers',
    // Consigne au doigt (pointeur grossier), la précédente à la souris.
    'admin.upload.tapToSelect': 'Touchez pour choisir des fichiers',
    'admin.upload.formats': 'PDF ou DOCX (250 Mo max par fichier)',
    'admin.upload.statusUploading': 'Envoi…',
    'admin.upload.statusProcessing': 'Traitement…',
    'admin.upload.statusDone': 'Terminé',
    'admin.upload.statusError': 'Erreur',
    'admin.upload.statusPending': 'En attente',
    'admin.upload.processing': 'Traitement en cours…',
    'admin.upload.start': 'Lancer le traitement',
    'admin.upload.logUploading': 'Envoi de {name}…',
    'admin.upload.logProcessing': 'Traitement de {name} (ID : {id})…',
    'admin.upload.logDone': '{name} envoyé au pipeline.',
    'admin.upload.logError': 'Erreur sur {name} : {err}',
    'admin.upload.errUpload': 'Erreur d\'envoi',
    'admin.upload.errIngest': 'Erreur d\'ingestion ({status}) : {text}',
    'batch.uploadFailed': 'Envoi impossible : {err}',
    // Hero section
    'hero.badge': 'IA Juridique Camerounaise',
    // Titre et mot mis en retrait, rendus sur deux lignes : deux clés, et non un
    // `.replace("IA", "")` qui ne trouvait rien dans le titre anglais.
    'hero.title': 'Votre Assistant Juridique',
    'hero.titleHighlight': 'IA',
    'hero.subtitle': 'Recherchez, consultez et comprenez les lois camerounaises avec l\'aide de l\'intelligence artificielle',

    // Mode switcher
    'mode.search': 'Recherche',
    'mode.chat': 'Assistant IA',

    // Search
    'search.placeholder': 'Rechercher une loi, un mot-clé...',
    'search.button': 'Rechercher',
    'search.searching': 'Recherche en cours...',

    // Chat
    'chat.welcome': 'Bonjour ! Je suis votre assistant juridique IA. Posez-moi une question sur le droit camerounais.',
    'chat.placeholder': 'Posez votre question juridique...',
    'chat.send': 'Envoyer',
    'chat.header': 'Assistant Juridique IA',
    'chat.errorServer': 'Le serveur n\'a pas pu traiter votre question.',
    'chat.errorInvalid': 'La question n\'a pas pu être envoyée telle quelle. Reformulez-la.',
    'chat.errorPersona': 'Votre profil n\'a pas été reconnu. Choisissez-le de nouveau depuis l\'en-tête.',
    'chat.suggestionsLabel': 'Suggestions :',
    // Chat : libellé d'état sous le titre, titre des sources, réponse vide du
    // serveur. Ces textes étaient écrits en dur, en ternaire français/anglais.
    'chat.statusLabel': 'IA Juridique Camerounaise V2.0',
    'chat.sources': 'Sources',
    'chat.emptyAnswer': 'Je n\'ai pas pu traiter votre demande.',
    'persona.chatLabel': 'Profil',
    'persona.general': 'Profil général',
    'persona.citoyen.nom': 'Citoyen',
    'persona.etudiant.nom': 'Étudiant en droit',
    'persona.avocat.nom': 'Avocat ou juriste',
    'persona.entrepreneur.nom': 'Entrepreneur',
    'persona.dialogTitle': 'Qui êtes-vous ?',
    'persona.dialogTitleChange': 'Changer de profil',
    'persona.dialogIntro': 'JuriX adapte ses réponses et ses suggestions de questions à votre profil.',
    'persona.dialogNotice': "Votre choix est gardé dans ce navigateur, et sur votre compte si vous êtes connecté. Il accompagne chacune de vos conversations, que les administrateurs peuvent voir. Changez-le à tout moment depuis l'en-tête.",
    'persona.skip': "Ne pas répondre pour l'instant",
    'persona.generalChoice': 'Profil général, pour cette visite',
    'persona.generalChoiceAccount': 'Profil général, pour cette visite (efface aussi le profil du compte)',
    'persona.current': 'Actuel',
    'persona.toggleLabel': 'Changer de profil (actuel : {persona})',
    'persona.change': 'Changer',
    'persona.citoyen.description': 'Je veux comprendre mes droits et mes démarches.',
    'persona.etudiant.description': "J'étudie le droit : notions, raisonnement, textes.",
    'persona.avocat.description': 'Je pratique le droit : règles exactes, conditions, sanctions.',
    'persona.entrepreneur.description': 'Je crée ou dirige une entreprise : obligations, démarches, délais.',
    'chat.errorNetwork': 'Impossible de joindre le serveur.',
    'chat.errorOverloaded': 'Le service est momentanément saturé. Réessayez dans quelques instants.',
    'chat.errorTooShort': 'Votre question est trop courte : au moins 5 caractères.',
    'chat.errorQuota': "Le quota de questions du jour est atteint. L'assistant sera de nouveau disponible demain.",
    'admin.lastDays': 'Les {n} derniers jours',
    'batch.errorUnknown': "Le serveur a signalé une erreur pendant l'import.",

    // Categories
    // Titres en casse de phrase, à la française : une majuscule au premier
    // mot et aux noms propres seulement (« Explorer par Catégorie », « Notre
    // Mission » suivaient l'usage anglais, à côté de titres déjà en casse de
    // phrase comme « Autres analyses récentes »).
    'categories.title': 'Explorer par catégorie',
    'categories.subtitle': 'Explorez les textes de loi par grandes catégories',
    'categories.documentsShort': 'doc.',
    // Accueil (src/routes/(main)/+page.svelte). Deux formes du compteur des
    // cartes, choisies par Intl.PluralRules selon la langue : le français met
    // le singulier à 0 et à 1 (« 0 texte »), l'anglais le pluriel à 0
    // (« 0 texts ») ; un simple test `> 1` se trompait en anglais.
    'categories.eyebrow': 'Corpus juridique officiel',
    'categories.textCount.one': 'texte',
    'categories.textCount.other': 'textes',
    'categories.browseTexts': 'Consulter les textes',

    // Category names (French)

    // Category descriptions (French)

    // Common
    'common.loading': 'Chargement...',
    'common.retry': 'Réessayer',

    // Search results
    // Titre de /search : la requête entre les guillemets de la langue
    // (« » et espaces fines insécables en français), et non entre des
    // guillemets droits.
    'search.resultsForQuery': 'Résultats pour «\u202F{q}\u202F»',
    'search.searchLaw': 'Rechercher une loi, un décret, un article...',

    // Pagination
    'pagination.prev': 'Précédent',
    'pagination.next': 'Suivant',
    'pagination.page': 'Page',

    // Search page filters & UI
    'search.filters': 'Filtres',
    'search.reset': 'Réinitialiser',
    'search.showResults': 'Voir les résultats',
    'search.datePublication': 'Date de publication',
    'search.allTime': 'Toute période',
    'search.thisYear': 'Cette année',
    'search.last5Years': '5 dernières années',
    'search.category': 'Catégorie',
    // Espace fine insécable avant les deux-points (typographie française).
    'search.sortBy': 'Trier par\u202F:',
    'search.relevance': 'Pertinence',
    'search.recentDate': 'Date récente',
    'search.oldestDate': 'Date ancienne',
    'search.aboutResults': 'Environ',
    'search.resultsFound': 'résultats trouvés',
    // Unité de la durée (« 0,31 s ») : le symbole, comme le nombre mis en forme
    // dans la langue (search/+page.svelte, `dureeAffichee`).
    'search.seconds': 's',
    'search.readFull': 'Lire le texte complet',
    'search.copyLink': 'Copier le lien',
    'search.allTexts': 'Tous les textes',
    'search.laws': 'Lois',
    'search.decrees': 'Décrets',
    'search.articles': 'Articles',
    'badge.law': 'Loi',
    'badge.decree': 'Décret',
    'badge.constitution': 'Constitution',
    'badge.ordinance': 'Ordonnance',
    'badge.text': 'Texte',
    // Types moins courants ($lib/type-de-texte) : /laws affichait la valeur
    // brute de l'API (« arrêté »), et la recherche les rangeait sous « Texte ».
    'badge.arrete': 'Arrêté',
    'badge.circular': 'Circulaire',
    'badge.instruction': 'Instruction',
    'badge.decision': 'Décision',
    'badge.uniformAct': 'Acte uniforme',
    'search.errorSearch': 'Erreur lors de la recherche. Veuillez réessayer.',
    'search.errorServer': 'Impossible de contacter le serveur.',

    // Law details

    // Navigation
    'laws.title': 'Documents',
    'laws.subtitle': 'Parcourir les textes du corpus',
    'laws.allLanguages': 'Toutes les langues',
    'laws.allCategories': 'Toutes les catégories',
    'laws.searchInstead': 'Rechercher un texte',
    'laws.articles': 'articles',
    'laws.empty': 'Aucun document ne correspond à ces filtres.',
    'laws.errorLoad': 'Impossible de charger les documents. Vérifiez que le serveur backend est démarré.',
    'laws.previous': 'Précédent',
    'laws.next': 'Suivant',
    'laws.page': 'Page',
    // Fiche d'une loi : section du sommaire qui précède le premier LIVRE,
    // TITRE ou CHAPITRE du document (le texte n'en donne aucun titre).
    'laws.preamble': 'Préambule / Général',
    'nav.documents': 'Documents',
    'a11y.skipToContent': 'Aller au contenu',
    'a11y.searchField': 'Rechercher',
    'a11y.pageNumber': 'Numéro de page',
    'a11y.chatInput': 'Votre question',
    'a11y.filterCategory': 'Filtrer par catégorie',
    'a11y.filterLanguage': 'Filtrer par langue',
    'a11y.filterStatus': 'Filtrer par statut',
    'a11y.filterRole': 'Filtrer par rôle',
    'a11y.sortBy': 'Trier les résultats',
    'a11y.toggleTheme': 'Changer de thème',
    'a11y.menu': 'Menu',
    'a11y.pagination': 'Pagination',
    'a11y.switchTo': 'Passer en',
    'nav.home': 'Accueil',
    'nav.blog': 'Blog',
    'nav.search': 'Recherche',
    'nav.compare': 'Comparer',
    'compare.title': 'Comparer deux régimes',
    'compare.subtitle': 'Deux recherches distinctes dans le corpus, une grille sourcée article par article.',
    'compare.subjectA': 'Premier sujet',
    'compare.subjectB': 'Second sujet',
    'compare.placeholderA': 'permis de recherche minière',
    'compare.placeholderB': "permis d'exploitation minière",
    'compare.submit': 'Comparer',
    'compare.loading': 'Comparaison en cours…',
    'compare.criterion': 'Critère',
    'compare.sources': 'Sources',
    'compare.showText': 'Voir le texte',
    'compare.hideText': 'Masquer le texte',
    'compare.differences': 'Différences majeures',
    'compare.blindSpots': 'Ce que les textes ne permettent pas de trancher',
    'compare.unmatched': 'Citations sans article correspondant',
    'compare.unmatchedHelp': "Le modèle a cité ces numéros, qui ne figurent dans aucun article consulté. Ne vous y fiez pas.",
    'compare.disclaimer': 'Grille générée par une IA à partir des seuls articles cités. Dépliez le texte pour vérifier chaque cellule.',
    'compare.timing': 'Recherche {r} ms · génération {g} ms',
    'compare.errorEmpty': 'Renseignez les deux sujets à comparer.',
    'compare.errorNotFound': "Aucun texte trouvé pour l'un des deux sujets dans le corpus.",
    'compare.articlesRead': 'Articles consultés',
    'nav.about': 'À propos',
    'nav.admin': 'Administration',
    'nav.login': 'Se connecter',
    'nav.logout': 'Se déconnecter',

    // Page d'erreur (src/routes/+error.svelte)
    'error.notFoundTitle': 'Cette page n\'existe pas',
    'error.notFoundBody': 'Le lien est peut-être périmé, ou l\'adresse comporte une faute. Voici par où repartir.',
    'error.genericTitle': 'Quelque chose s\'est mal passé',
    'error.genericBody': 'Réessayez dans un instant. Si le problème persiste, revenez à l\'accueil.',
    'error.unavailableTitle': 'Service momentanément indisponible',
    'error.unavailableBody': 'Les textes ne peuvent pas être chargés pour l\'instant. Réessayez dans quelques minutes.',
    'error.retry': 'Réessayer',
    // 'nav.signup' est de nouveau utilisée : `POST /api/v1/auth/signup` existe
    // depuis l'ouverture des comptes publics, et l'en-tête y renvoie.

    // Footer
    'footer.rights': '© {annee} JuriX. Tous droits réservés. L\'accès au droit pour tous.',

    // Page titles
    'title.home': 'Accueil',
    'title.search': 'Résultats de recherche',

    // Search empty/error states
    'search.startTitle': 'Commencez votre recherche',
    'search.startDesc': 'Entrez un terme dans la barre de recherche pour trouver des textes juridiques.',
    'search.noResultsTitle': 'Aucun résultat trouvé',
    'search.noResultsDesc': 'Essayez avec d\'autres termes de recherche ou modifiez vos filtres.',
    'search.clearSearch': 'Effacer la recherche',
    'search.noTitle': 'Sans titre',
    'search.noDescription': 'Aucune description disponible.',

    // Categories page
    'categories.backHome': 'Retour à l\'accueil',
    'categories.searchPlaceholder': 'Rechercher une loi, un décret, un article...',
    // Sous sm : le texte complet (317 px) était coupé en plein mot dans un
    // champ de 274 px à 390 px de large, 204 px à 320. Celui-ci en fait 167.
    'categories.searchPlaceholderShort': 'Rechercher un texte…',
    'categories.langLabel': 'Langue',
    'categories.all': 'Tout',
    'categories.retry': 'Réessayer',
    'categories.noDocsTitle': 'Aucun document trouvé',
    'categories.noDocsDesc': 'Essayez de modifier vos filtres.',
    'categories.docsCount': 'document(s) dans cette catégorie',
    'categories.noPreview': 'Aucun aperçu disponible',
    'categories.errorLoad': 'Impossible de charger les documents. Vérifiez que le serveur backend est démarré.',
    'search.bodyMatches': 'Mentions dans le texte',
    // Intitulé du premier groupe, affiché quand les deux groupes existent.
    'search.titleMatches': 'Correspondances dans le titre',

    // Admin
    // Casse de phrase, comme « Conversations par profil » ou « Import en lot » :
    // les majuscules à l'anglaise (« Tableau de Bord ») tranchaient.
    'admin.dashboard': 'Tableau de bord',
    'admin.dashboardDesc': 'Aperçu des performances de JuriX',
    'admin.lastUpdate': 'Dernière mise à jour',
    'admin.statsError': 'Impossible de charger les statistiques. Le serveur est peut-être injoignable.',
    'admin.docsError': 'Impossible de charger les documents. Le serveur est peut-être injoignable.',
    'admin.refresh': 'Actualiser',
    // Titres des chiffres clés, courts : « Documents au total » et « Recherches
    // au total » passaient sur deux lignes dans les cartes étroites
    // (téléphone, quatre colonnes de 222 px), et « au total » contredisait la
    // ligne du dessous (« Les 7 derniers jours ») pour les recherches.
    'admin.totalDocs': 'Documents',
    'admin.totalSearches': 'Recherches',
    'admin.activeUsers': 'Utilisateurs actifs',
    'admin.responseTime': 'Temps de réponse',
    'admin.searchActivity': 'Activité de recherche',
    'admin.noActivityData': 'Aucune donnée d\'activité',
    'admin.latestDocs': 'Derniers documents',
    'admin.noRecentDocs': 'Aucun document récent',
    'admin.viewAll': 'Voir tout',
    'admin.personasTitle': 'Conversations par profil',
    'admin.personasNote': '« Profil général » : les visiteurs qui n\'ont pas répondu à la question du profil, et ceux qui l\'ont choisi.',
    'admin.personasEmpty': 'Aucune conversation sur la période',
    'admin.personasUnavailable': 'Répartition par profil indisponible',
    'admin.docManagement': 'Gestion des documents',
    'admin.docManagementDesc': 'Ajoutez, modifiez ou supprimez des textes de loi',
    // Le libellé de la fenêtre qu'il ouvre (`admin.upload.title`).
    'admin.newDoc': 'Ajouter des documents',
    'admin.searchDoc': 'Rechercher un document...',
    'admin.allCategories': 'Toutes catégories',
    'admin.allLanguages': 'Toutes langues',
    'admin.allStatuses': 'Tous statuts',
    'admin.docTitle': 'Titre du document',
    'admin.language': 'Langue',
    'admin.dateAdded': 'Date d\'ajout',
    'admin.status': 'Statut',
    'admin.actions': 'Actions',
    'admin.edit': 'Modifier',
    'admin.delete': 'Supprimer',
    'admin.loading': 'Chargement...',
    'admin.noDocFound': 'Aucun document trouvé.',
    'admin.showing': 'Affichage',
    'admin.on': 'sur',
    'admin.docs': 'document(s)',
    'admin.page': 'Page',
    'admin.previous': 'Précédent',
    'admin.next': 'Suivant',
    'admin.firstPage': 'Première page',
    'admin.lastPage': 'Dernière page',
    'admin.draft': 'Brouillon',
    'admin.published': 'Publié',
    'admin.processing': 'En traitement',
    'admin.pending': 'En attente',
    'admin.refused': 'Refusé',
    'admin.archived': 'Archivé',
    'admin.confirmDelete': 'Êtes-vous sûr de vouloir supprimer',
    'admin.irreversible': 'Cette action est irréversible.',
    'admin.deleteError': 'Erreur lors de la suppression',
    'admin.networkError': 'Erreur réseau lors de la suppression du document',
    'admin.batchUpload': 'Import en lot',
    'admin.batchUploadDesc': 'Importez plusieurs PDF et suivez leur traitement en temps réel',
    'admin.selectFiles': 'Sélectionner les fichiers',
    'admin.dragDrop': 'Glissez-déposez vos fichiers PDF ici, ou',
    'admin.browse': 'parcourez',
    'admin.tapToChoose': 'Touchez pour choisir des fichiers PDF',
    'admin.removeFile': 'Retirer {name}',
    // Comme la fenêtre d'ajout (« PDF ou DOCX (1 Go max) ») : « Limite: 1GB »
    // n'avait ni l'espace avant les deux-points, ni l'unité française.
    'admin.fileLimit': 'PDF (1 Go max par fichier)',
    'admin.selectedFiles': 'Fichiers sélectionnés',
    'admin.uploading': 'Envoi en cours…',
    'admin.uploadFiles': 'Envoyer',
    'admin.files': 'fichier(s)',
    'admin.documents': 'Documents',
    'admin.blog': 'Blog & Actualités IA',
    // Administration du blog (src/routes/admin/blog/+page.svelte). La page
    // remplace `{n}`, `{status}` et `{title}`.
    'admin.blog.subtitle': 'Générez et publiez des décryptages d\'actualité juridique par l\'IA',
    'admin.blog.generate': 'Générer un article IA',
    'admin.blog.closeGenerator': 'Fermer le générateur',
    'admin.blog.generatorTitle': 'Générateur d\'article automatique',
    'admin.blog.generatorHint': 'Décrivez le sujet ou la question d\'actualité, l\'IA rédige tout l\'article',
    'admin.blog.topicLabel': 'Sujet ou question d\'actualité *',
    'admin.blog.topicPlaceholder': 'Ex : Un propriétaire a-t-il le droit de couper l\'eau d\'un locataire au Cameroun ?',
    // « (optionnel) » vient d'`admin.optional`, posé en gris après le libellé.
    'admin.blog.extraContextLabel': 'Contexte supplémentaire',
    'admin.blog.extraContextPlaceholder': 'Ex : Un fait divers récent à Douala, un locataire a trouvé son compteur débranché après 3 mois d\'impayés...',
    'admin.blog.generating': 'Génération en cours (15-30s)...',
    'admin.blog.generateFull': 'Générer l\'article complet',
    'admin.blog.previewTitle': 'Article généré — Prévisualisation',
    'admin.blog.slug': 'Slug :',
    'admin.blog.contextHeading': 'Le contexte :',
    'admin.blog.summaryHeading': 'Analyse juridique vulgarisée :',
    'admin.blog.keyPointsHeading': 'Points clés :',
    'admin.blog.citationsHeading': 'Citations de lois ({n}) :',
    'admin.blog.impactHeading': 'Impact citoyen :',
    'admin.blog.publishNow': 'Publier maintenant',
    // Tous les articles, brouillons compris : « Articles publiés (2) » comptait
    // aussi le brouillon affiché dans la liste.
    'admin.blog.listTitle': 'Articles ({n})',
    'admin.blog.empty': 'Aucun article. Cliquez sur « Générer un article IA » pour commencer.',
    'admin.blog.view': 'Voir sur le site',
    // Libellé visible du lien, court pour tenir dans un tiers de rangée au
    // téléphone ; `admin.blog.view` reste son nom accessible.
    'admin.blog.viewShort': 'Voir',
    'admin.blog.edit': 'Modifier',
    'admin.blog.editTitle': 'Modifier l\'article',
    'admin.blog.tagsField': 'Mots-clés (séparés par des virgules)',
    'admin.blog.contextField': 'Contexte',
    'admin.blog.summaryField': 'Analyse juridique (résumé)',
    'admin.blog.keyPointsField': 'Points clés (un par ligne)',
    'admin.blog.impactField': 'Impact citoyen',
    'admin.blog.suggestedQuestionField': 'Question suggérée (chat)',
    'admin.blog.publishedField': 'Article publié',
    'admin.blog.httpError': 'Erreur HTTP {status}',
    'admin.blog.confirmDelete': 'Supprimer « {title} » ?',
    // Le filtre de l'import en lot reprend celui des documents : « Tous
    // statuts » (`admin.allStatuses`) et les libellés au singulier des badges
    // (`admin.published`, `admin.refused`). « Tous » seul ne disait pas ce
    // qu'il filtrait, et « Publiés », « Refusés » y étaient au pluriel.
    'admin.inProcess': 'En traitement',
    'admin.title': 'Titre',
    'admin.reference': 'Référence',
    'admin.progress': 'Progression',
    'admin.date': 'Date',

    // About
    'about.title': 'À propos de',
    'about.subtitle': 'La référence juridique numérique du Cameroun.',
    'about.mission.title': 'Notre mission',
    'about.mission.p1': 'JuriX est une plateforme innovante dédiée à la centralisation de l\'ensemble des textes de lois du Cameroun. Notre objectif premier est de démocratiser l\'accès au droit en rendant les textes juridiques accessibles à tous : citoyens, professionnels du droit, étudiants et entreprises.',
    'about.mission.p2': 'Au-delà d\'une simple bibliothèque numérique, JuriX intègre l\'intelligence artificielle de pointe pour révolutionner la compréhension du droit. Grâce à notre assistant juridique IA, les textes complexes deviennent clairs et intelligibles pour tout le monde.',
    'about.centralization.title': 'Centralisation',
    'about.centralization.desc': 'Tous les codes, lois et règlements en un seul endroit.',
    'about.ai.title': 'Intelligence artificielle',
    'about.ai.desc': 'Explications claires et assistance juridique instantanée.',
    'about.creator': 'Conçu et réalisé par',
    'about.contact.title': 'Contact',
    'about.contact.email': 'Email',

    // Palette de commande (CommandPalette.svelte), ouverte depuis l'en-tête
    // (SiteHeader.svelte) ou par Ctrl+K. `{q}` est la saisie de l'utilisateur,
    // insérée par le composant.
    'palette.label': 'Palette de commande',
    'palette.open': 'Recherche et actions rapides',
    'palette.openWithShortcut': 'Recherche et actions rapides (Ctrl+K)',
    'palette.placeholder': 'Rechercher une loi, un sujet, ou poser une question…',
    'palette.clear': 'Effacer',
    'palette.escKey': 'Échap',
    'palette.sectionResults': 'Résultats & Actions',
    'palette.sectionShortcuts': 'Raccourcis & Navigation',
    'palette.noResults': 'Aucun résultat pour « {q} »',
    'palette.noResultsHint': 'Essayez avec d\'autres mots-clés ou posez directement votre question dans le chat.',
    'palette.navigate': 'Naviguer',
    'palette.select': 'Ouvrir',
    'palette.footer': 'Palette universelle JuriX',
    'palette.askAi.title': 'Poser une question à l\'Assistant IA',
    'palette.askAi.subtitle': 'Réponses sourcées par notre IA sur l\'ensemble du droit',
    'palette.blog.title': 'L\'actualité décryptée (blog)',
    'palette.blog.subtitle': 'Analyses hebdomadaires des sujets chauds par l\'IA',
    'palette.laws.title': 'Explorer tous les textes de lois',
    'palette.laws.subtitle': 'Codes, lois, décrets et arrêtés classés par catégories',
    'palette.compare.title': 'Comparer deux régimes juridiques',
    'palette.compare.subtitle': 'Tableau comparatif dynamique article par article',
    'palette.searchAll.title': 'Rechercher « {q} » dans toutes les lois',
    'palette.searchAll.subtitle': 'Lancer la recherche plein texte et sémantique',
    'palette.askAiQuery.title': 'Demander à l\'IA : « {q} »',
    'palette.askAiQuery.subtitle': 'Obtenir une réponse personnalisée et vulgarisée',
    'palette.blogPost': 'Article de blog',
    'palette.lawFallback': 'Texte de loi officiel',
    'palette.badge.assistant': 'Assistant',
    'palette.badge.blog': 'Blog',
    'palette.badge.laws': 'Lois',
    'palette.badge.tool': 'Outil',
    'palette.badge.search': 'Recherche',
    'palette.badge.news': 'Actualité',
    'palette.badge.law': 'Loi',

    // Blog d'actualité (src/routes/blog). Les rubriques et le contenu des
    // articles viennent de l'API, en français : seule l'interface est traduite.
    'blog.metaTitle': 'Actualités juridiques et décryptages IA — Blog',
    'blog.metaDescription': 'Chaque semaine, l\'actualité juridique et économique décryptée en langage clair par l\'intelligence artificielle avec citations des textes de lois.',
    'blog.kicker': 'L\'actualité décryptée par l\'IA',
    'blog.title': 'Le droit face à l\'actualité',
    'blog.subtitle': 'Chaque semaine, un sujet chaud de l\'actualité passé au crible des textes de lois en vigueur au Cameroun. Des explications claires, sans jargon inutile, avec les sources officielles.',
    'blog.all': 'Tous',
    'blog.featured': 'Article à la une',
    // Badge de l'article à la une : une clé, et non plus un texte français
    // écrit par le chargeur (`badge` de $lib/data/blog), qui restait en
    // français dans l'interface anglaise.
    'blog.badge.ai': 'Décryptage IA',
    'blog.badge.weekly': 'Décryptage de la semaine',
    'blog.badge.labour': 'Droit du travail',
    'blog.badge.cybercrime': 'Cybercriminalité',
    'blog.reading': 'de lecture',
    'blog.recently': 'Récemment',
    'blog.readFull': 'Lire le décryptage complet',
    'blog.others': 'Autres décryptages',
    'blog.othersTitle': 'Autres analyses récentes',
    'blog.read': 'Consulter',
    'blog.ctaTitle': 'Vous avez une question sur une actualité ou un litige ?',
    'blog.ctaText': 'Notre assistant juridique intelligent analyse plus de 2 200 lois et 43 000 articles en temps réel pour vous donner une réponse sourcée et vulgarisée.',
    'blog.ctaButton': 'Interroger l\'Assistant IA',
    'blog.metaSuffix': 'Décryptage juridique',
    'blog.breadcrumb': 'Fil d\'Ariane',
    'blog.shareMessage': 'Décryptage juridique par l\'IA :',
    'blog.writtenWith': 'Rédigé avec l\'assistance de',
    'blog.aiName': 'JuriX IA',
    'blog.shareWhatsApp': 'Partager sur WhatsApp',
    'blog.shareLinkedIn': 'Partager sur LinkedIn',
    'blog.shareX': 'Partager sur X (Twitter)',
    'blog.copyLink': 'Copier le lien',
    'blog.copied': 'Copié !',
    'blog.contextTitle': '1. L\'actualité en 2 minutes (le contexte)',
    'blog.lawTitle': '2. Ce que dit la loi — l\'analyse de l\'IA',
    'blog.explanationTitle': 'Explication juridique simplifiée',
    'blog.keyPoints': 'Les règles essentielles à retenir',
    'blog.citationsTitle': 'Textes de loi officiels applicables',
    'blog.article': 'Article',
    'blog.legalExcerpt': 'Extrait légal',
    'blog.readLaw': 'Consulter le texte complet de la loi',
    'blog.impactTitle': 'Ce que cela change concrètement pour vous',
    'blog.assistanceBadge': 'Assistance juridique sur mesure',
    'blog.similarTitle': 'Vous traversez une situation similaire ?',
    'blog.similarText': 'Ne restez pas dans le doute. Posez directement votre question à notre assistant IA, qui analysera les spécificités de votre cas à la lumière des textes officiels.',
    'blog.askAssistant': 'Poser cette question à l\'Assistant',
    'blog.allPosts': 'Tous les décryptages',
    // Rubriques du blog ($lib/data/blog, `nomRubrique`) : l'API les donne en
    // français et en texte libre ; une rubrique composée (« Immobilier &
    // Logement ») se traduit partie par partie. Clé : le nom sans accents,
    // en minuscules, mots joints par des tirets.
    'blog.rubrique.immobilier': 'Immobilier',
    'blog.rubrique.logement': 'Logement',
    'blog.rubrique.travail': 'Travail',
    'blog.rubrique.emploi': 'Emploi',
    'blog.rubrique.economie': 'Économie',
    'blog.rubrique.fiscalite': 'Fiscalité',
    'blog.rubrique.droit-penal': 'Droit pénal',
    'blog.rubrique.famille': 'Famille',
    'blog.rubrique.numerique': 'Numérique',
    'blog.rubrique.affaires': 'Affaires',
    'blog.rubrique.consommation': 'Consommation',
    'blog.rubrique.sante': 'Santé',
    'blog.rubrique.actualite-juridique': 'Actualité juridique',
  },
  en: {
    'signup.title': 'Create an account',
    'signup.subtitle': 'Keep your conversations from one visit to the next.',
    'signup.name': 'Full name',
    'signup.namePlaceholder': 'John Doe',
    'auth.emailPlaceholder': 'you@example.com',
    'signup.email': 'Email address',
    'signup.password': 'Password',
    'signup.passwordHint': 'At least 8 characters, with an uppercase letter, a lowercase letter and a digit.',
    'signup.submit': 'Create my account',
    'signup.submitting': 'Creating…',
    'signup.haveAccount': 'Already have an account?',
    'signup.errorEmailTaken': 'An account already exists with this address.',
    'signup.errorInvalid': 'Check the information you entered.',
    'signup.errorGeneric': 'Could not create the account. Try again in a moment.',
    // ---- Forgotten password, reset, address verification ----
    'forgot.title': 'Forgotten password',
    'forgot.subtitle': 'Enter your address and we will send you a link to choose a new password.',
    'forgot.email': 'Email address',
    'forgot.submit': 'Send the link',
    'forgot.submitting': 'Sending…',
    'forgot.sent': 'Message sent',
    'forgot.sentDetail': 'If an account exists for this address, a link has just been sent. The link expires in 30 minutes.',
    'forgot.spamHint': 'Remember to check your spam folder. The sender may appear under an unfamiliar name.',
    'forgot.errorGeneric': 'Could not send the link. Try again in a moment.',
    'forgot.backToLogin': 'Back to sign-in',
    'lien.usedTitle': 'Link already used',
    'lien.usedDetail': 'This link works only once.\nIf you need a new one, just ask for it\u00a0again.',
    'reset.title': 'New password',
    'reset.subtitle': 'Choose a password for your account.',
    'reset.password': 'New password',
    'reset.confirm': 'Confirm the password',
    'reset.mismatch': 'The two passwords do not match.',
    'reset.submit': 'Change my password',
    'reset.submitting': 'Changing…',
    'reset.success': 'Password changed. You can now sign in.',
    'reset.errorToken': 'This link is no longer valid. Request a new one.',
    'reset.errorGeneric': 'Could not change the password. Try again in a moment.',
    'reset.askNewLink': 'Request a new link',
    'verify.title': 'Address confirmation',
    'verify.pending': 'Verifying…',
    'verify.success': 'Address confirmed. Thank you!',
    'verify.errorToken': 'This link is no longer valid. It may already have been used.',
    'verify.errorGeneric': 'Could not verify. Try again in a moment.',
    'verify.goHome': 'Go to the home page',
    'verify.usedDetail': 'This link has already been used: your address is most likely confirmed already. You can sign in.',
    'login.subtitle': 'Pick up your saved conversations.',
    'login.forgotPassword': 'Forgotten password?',
    'login.noAccount': 'No account yet?',
    'auth.orGoogle': 'or',
    'auth.googleButton': 'Continue with Google',
    'auth.googleError': 'Google sign-in refused.',
    'auth.googleUnavailable': 'Google sign-in is momentarily unavailable.',
    // ---- Password field (ChampMotDePasse.svelte) and account recovery ----
    'auth.showPassword': 'Show password',
    'auth.hidePassword': 'Hide password',
    'login.resetHint': 'Forgotten your password?',
    'login.resetLink': 'Get a link to change it',
    'forgot.errorInvalid': 'Enter a valid email address.',
    'nav.signup': 'Sign up',
    'chat.conversations': 'My conversations',
    'chat.newConversation': 'New conversation',
    'chat.untitledConversation': 'Untitled',
    'chat.deleteConversation': 'Delete conversation',
    'chat.conversationsEmpty': 'No saved conversation yet.',
    'chat.conversationsError': 'Could not load your conversations.',
    'chat.errorConversationGone': 'This conversation is no longer available. A new one has started.',
    'chat.signInToKeep': 'Create an account to keep your conversations.',
    'chat.barTitle': 'JuriX Assistant',
    'chat.backHome': 'Back to home',
    'chat.scrollToLatest': 'Jump to the latest message',
    'chat.showSources': 'Show sources',
    'chat.hideSources': 'Hide sources',
    'common.errorNetwork': 'Unable to reach the server.',
    'pdf.loading': 'Loading document…',
    'pdf.errorLoad': 'Unable to load the document.',
    'pdf.errorUnknown': 'Unknown error',
    'pdf.errorPage': 'Error loading page {n}',
    'pdf.errorHint': 'Try refreshing the page or contact the administrator.',
    'pdf.previous': '← Previous',
    'pdf.next': 'Next →',
    'pdf.page': 'Page',
    'pdf.of': 'of',
    'pdf.zoomOut': 'Zoom out',
    'pdf.zoomIn': 'Zoom in',
    'pdf.keyboardHint': 'Use the ← → arrow keys to navigate',
    'pdf.pageAlt': 'Page {n}',
    'pdf.previousPage': 'Previous page',
    'pdf.nextPage': 'Next page',
    'pdf.fitWidth': 'Fit to width',
    'pdf.viewer': 'Document page',
    'login.title': 'Sign in',
    'login.email': 'Email address',
    'login.password': 'Password',
    'login.submit': 'Sign in',
    'login.submitting': 'Signing in…',
    'login.errorCredentials': 'Invalid credentials.',
    'login.errorDisabled': 'This account is disabled.',
    'login.errorGeneric': 'Sign-in failed. Try again in a moment.',
    'login.errorNetwork': 'Unable to reach the server.',
    'common.close': 'Close',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.saving': 'Saving…',
    'admin.users': 'Users',
    'admin.usersDesc': 'Accounts allowed to access the administration',
    'admin.backToSite': 'Back to site',
    'admin.logout': 'Sign out',
    'admin.administration': 'Administration',
    'admin.checkingSession': 'Checking session…',
    'admin.inLast30Days': 'in 30 days',
    'admin.requests': 'requests',
    'admin.searchMode.hybrid': 'Hybrid',
    'admin.searchMode.text': 'Full text',
    'admin.searchMode.semantic': 'Semantic',
    'admin.role.user': 'User',
    'admin.role.admin': 'Administrator',
    'admin.role.superadmin': 'Superadmin',
    'admin.user.new': 'New account',
    'admin.user.edit': 'Edit account',
    'admin.user.email': 'Email address',
    'admin.user.username': 'Username',
    'admin.user.usernameHint': 'Converted to lowercase when saved.',
    'admin.user.fullName': 'Full name',
    'admin.user.role': 'Role',
    'admin.user.roleHint': 'Only a superadmin can change a role',
    'admin.user.active': 'Active account',
    'admin.user.password': 'Password',
    'admin.user.passwordKeep': '(leave blank to keep unchanged)',
    'admin.user.passwordHint': 'At least 8 characters, with an uppercase letter, a lowercase letter and a digit.',
    'admin.user.errEmail': 'Invalid email address.',
    'admin.user.errUsernameLen': 'The username must be at least 3 characters long.',
    'admin.user.errUsernameChars': 'The username only accepts letters, digits, _ and -.',
    'admin.user.errPwdLen': 'The password must be at least 8 characters long.',
    'admin.user.errPwdUpper': 'The password must contain an uppercase letter.',
    'admin.user.errPwdLower': 'The password must contain a lowercase letter.',
    'admin.user.errPwdDigit': 'The password must contain a digit.',
    'admin.user.errSave': 'Could not save ({status}).',
    'admin.users.searchPlaceholder': 'Search by email, username or name…',
    'admin.users.allRoles': 'All roles',
    'admin.users.activePlural': 'Active',
    'admin.users.inactivePlural': 'Inactive',
    'admin.users.activeOne': 'Active',
    'admin.users.inactiveOne': 'Inactive',
    'admin.users.loadError': 'Could not load ({status}).',
    'admin.users.none': 'No account matches.',
    'admin.users.account': 'Account',
    'admin.users.name': 'Name',
    'admin.users.lastLogin': 'Last sign-in',
    'admin.users.confirmDelete': 'Permanently delete the account {email}?',
    'admin.users.deleteError': 'Could not delete ({status}).',
    'admin.doc.editTitle': 'Edit document',
    'admin.doc.title': 'Title',
    'admin.doc.titlePlaceholder': 'Document title',
    'admin.doc.category': 'Category',
    'admin.doc.noCategory': 'No category',
    'admin.doc.content': 'Content',
    'admin.doc.contentPlaceholder': 'Document content…',
    'admin.doc.chars': 'characters',
    'admin.doc.saveError': 'Error: {detail}',
    'admin.doc.unknownError': 'Unknown error',
    'admin.upload.title': 'Add documents',
    'admin.upload.titlePlaceholder': 'e.g. The Constitution of Cameroon',
    'admin.optional': '(optional)',
    'admin.upload.refPlaceholder': 'e.g. LOI-2024-001 or Decree No. 2024/PM/123',
    'admin.upload.refHint': 'Official number of the legal document',
    'admin.upload.category': 'Document category',
    'admin.upload.loadingCategories': 'Loading categories…',
    'admin.upload.clickToSelect': 'Click to choose files',
    'admin.upload.tapToSelect': 'Tap to choose files',
    'admin.upload.formats': 'PDF or DOCX (max 250 MB per file)',
    'admin.upload.statusUploading': 'Uploading…',
    'admin.upload.statusProcessing': 'Processing…',
    'admin.upload.statusDone': 'Done',
    'admin.upload.statusError': 'Error',
    'admin.upload.statusPending': 'Pending',
    'admin.upload.processing': 'Processing…',
    'admin.upload.start': 'Start processing',
    'admin.upload.logUploading': 'Uploading {name}…',
    'admin.upload.logProcessing': 'Processing {name} (ID: {id})…',
    'admin.upload.logDone': '{name} sent to the pipeline.',
    'admin.upload.logError': 'Error on {name}: {err}',
    'admin.upload.errUpload': 'Upload error',
    'admin.upload.errIngest': 'Ingestion error ({status}): {text}',
    'batch.uploadFailed': 'Upload failed: {err}',
    // Hero section
    'hero.badge': 'Cameroonian Legal AI',
    // Le titre se lit d'un trait, le mot en gris À LA FIN (layout du groupe
    // (main)) : « Your Legal Assistant / AI » donnait un ordre que l'anglais
    // n'emploie pas. « Your Legal / AI Assistant » : « legal AI assistant ».
    'hero.title': 'Your Legal',
    'hero.titleHighlight': 'AI Assistant',
    'hero.subtitle': 'Search, consult and understand Cameroonian laws with the help of artificial intelligence',

    // Mode switcher
    'mode.search': 'Search',
    'mode.chat': 'AI Assistant',

    // Search
    'search.placeholder': 'Search for a law, keyword...',
    'search.button': 'Search',
    'search.searching': 'Searching...',

    // Chat
    'chat.welcome': 'Hello! I am your AI legal assistant. Ask me a question about Cameroonian law.',
    'chat.placeholder': 'Ask your legal question...',
    'chat.send': 'Send',
    'chat.header': 'AI Legal Assistant',
    'chat.errorServer': 'The server could not process your question.',
    'chat.errorInvalid': 'The question could not be sent as is. Please rephrase it.',
    'chat.errorPersona': 'Your profile was not recognised. Please choose it again from the header.',
    'chat.suggestionsLabel': 'Suggestions:',
    // Chat: status label, sources title, empty server answer.
    'chat.statusLabel': 'Cameroonian Legal AI V2.0',
    'chat.sources': 'Sources',
    'chat.emptyAnswer': 'I couldn\'t process your request.',
    'persona.chatLabel': 'Profile',
    'persona.general': 'General profile',
    'persona.citoyen.nom': 'Citizen',
    'persona.etudiant.nom': 'Law student',
    'persona.avocat.nom': 'Lawyer or legal professional',
    'persona.entrepreneur.nom': 'Entrepreneur',
    'persona.dialogTitle': 'Who are you?',
    'persona.dialogTitleChange': 'Change profile',
    'persona.dialogIntro': 'JuriX adapts its answers and suggested questions to your profile.',
    'persona.dialogNotice': 'Your choice is kept in this browser, and on your account if you are signed in. It is stored with each of your conversations, which administrators can see. Change it at any time from the header.',
    'persona.skip': 'Not now',
    'persona.generalChoice': 'General profile, for this visit',
    'persona.generalChoiceAccount': 'General profile, for this visit (also clears your account profile)',
    'persona.current': 'Current',
    'persona.toggleLabel': 'Change profile (current: {persona})',
    'persona.change': 'Change',
    'persona.citoyen.description': 'I want to understand my rights and procedures.',
    'persona.etudiant.description': 'I study law: concepts, reasoning, texts.',
    'persona.avocat.description': 'I practise law: exact rules, conditions, penalties.',
    'persona.entrepreneur.description': 'I run or am starting a business: obligations, procedures, deadlines.',
    'chat.errorNetwork': 'Could not reach the server.',
    'chat.errorOverloaded': 'The service is temporarily overloaded. Please try again shortly.',
    'chat.errorTooShort': 'Your question is too short: at least 5 characters.',
    'chat.errorQuota': "Today's question quota has been reached. The assistant will be available again tomorrow.",
    'admin.lastDays': 'Last {n} days',
    'batch.errorUnknown': 'The server reported an error during the import.',

    // Categories
    'categories.title': 'Browse by Category',
    'categories.subtitle': 'Explore legal texts by major categories',
    'categories.documentsShort': 'doc.',
    // Home page (src/routes/(main)/+page.svelte): plural forms picked by Intl.PluralRules.
    'categories.eyebrow': 'Official Legal Corpus',
    'categories.textCount.one': 'text',
    'categories.textCount.other': 'texts',
    'categories.browseTexts': 'Browse texts',

    // Category names (English)

    // Category descriptions (English)

    // Common
    'common.loading': 'Loading...',
    'common.retry': 'Retry',

    // Search results
    'search.resultsForQuery': 'Results for “{q}”',
    'search.searchLaw': 'Search for a law, decree, article...',

    // Pagination
    'pagination.prev': 'Previous',
    'pagination.next': 'Next',
    'pagination.page': 'Page',

    // Search page filters & UI
    'search.filters': 'Filters',
    'search.reset': 'Reset',
    'search.showResults': 'Show results',
    'search.datePublication': 'Publication date',
    'search.allTime': 'All time',
    'search.thisYear': 'This year',
    'search.last5Years': 'Last 5 years',
    'search.category': 'Category',
    'search.sortBy': 'Sort by:',
    'search.relevance': 'Relevance',
    'search.recentDate': 'Most recent',
    'search.oldestDate': 'Oldest first',
    'search.aboutResults': 'About',
    'search.resultsFound': 'results found',
    'search.seconds': 's',

    'search.readFull': 'Read full text',
    'search.copyLink': 'Copy link',
    'search.allTexts': 'All texts',
    'search.laws': 'Laws',
    'search.decrees': 'Decrees',
    'search.articles': 'Articles',
    'badge.law': 'Law',
    'badge.decree': 'Decree',
    'badge.constitution': 'Constitution',
    'badge.ordinance': 'Ordinance',
    'badge.text': 'Text',
    'badge.arrete': 'Order',
    'badge.circular': 'Circular',
    'badge.instruction': 'Instruction',
    'badge.decision': 'Decision',
    'badge.uniformAct': 'Uniform Act',
    'search.errorSearch': 'Search error. Please try again.',
    'search.errorServer': 'Unable to contact the server.',

    // Law details

    // Navigation
    'laws.title': 'Documents',
    'laws.subtitle': 'Browse the corpus',
    'laws.allLanguages': 'All languages',
    'laws.allCategories': 'All categories',
    'laws.searchInstead': 'Search instead',
    'laws.articles': 'articles',
    'laws.empty': 'No document matches these filters.',
    'laws.errorLoad': 'Could not load documents. Check that the backend is running.',
    'laws.previous': 'Previous',
    'laws.next': 'Next',
    'laws.page': 'Page',
    'laws.preamble': 'Preamble / General',
    'nav.documents': 'Documents',
    'a11y.skipToContent': 'Skip to content',
    'a11y.searchField': 'Search',
    'a11y.pageNumber': 'Page number',
    'a11y.chatInput': 'Your question',
    'a11y.filterCategory': 'Filter by category',
    'a11y.filterLanguage': 'Filter by language',
    'a11y.filterStatus': 'Filter by status',
    'a11y.filterRole': 'Filter by role',
    'a11y.sortBy': 'Sort results',
    'a11y.toggleTheme': 'Toggle theme',
    'a11y.menu': 'Menu',
    'a11y.pagination': 'Pagination',
    'a11y.switchTo': 'Switch to',
    'nav.home': 'Home',
    'nav.blog': 'Blog',
    'nav.search': 'Search',
    'nav.compare': 'Compare',
    'compare.title': 'Compare two regimes',
    'compare.subtitle': 'Two separate searches in the corpus, a grid sourced article by article.',
    'compare.subjectA': 'First subject',
    'compare.subjectB': 'Second subject',
    'compare.placeholderA': 'mining exploration permit',
    'compare.placeholderB': 'mining exploitation permit',
    'compare.submit': 'Compare',
    'compare.loading': 'Comparing…',
    'compare.criterion': 'Criterion',
    'compare.sources': 'Sources',
    'compare.showText': 'Show text',
    'compare.hideText': 'Hide text',
    'compare.differences': 'Key differences',
    'compare.blindSpots': 'What the texts do not settle',
    'compare.unmatched': 'Citations with no matching article',
    'compare.unmatchedHelp': 'The model cited these numbers, which appear in none of the articles consulted. Do not rely on them.',
    'compare.disclaimer': 'Grid generated by an AI from the cited articles only. Expand the text to check each cell.',
    'compare.timing': 'Retrieval {r} ms · generation {g} ms',
    'compare.errorEmpty': 'Fill in both subjects to compare.',
    'compare.errorNotFound': 'No text found for one of the two subjects in the corpus.',
    'compare.articlesRead': 'Articles consulted',
    'nav.about': 'About',
    'nav.admin': 'Admin',
    'nav.login': 'Log in',
    'nav.logout': 'Log out',

    // Error page (src/routes/+error.svelte)
    'error.notFoundTitle': 'This page does not exist',
    'error.notFoundBody': 'The link may be outdated, or the address has a typo. Here is where to go next.',
    'error.genericTitle': 'Something went wrong',
    'error.genericBody': 'Try again in a moment. If the problem persists, head back home.',
    'error.unavailableTitle': 'Service temporarily unavailable',
    'error.unavailableBody': 'The texts cannot be loaded right now. Please try again in a few minutes.',
    'error.retry': 'Try again',

    // Footer
    'footer.rights': '© {annee} JuriX. All rights reserved. Access to law for everyone.',

    // Page titles
    'title.home': 'Home',
    'title.search': 'Search Results',

    // Search empty/error states
    'search.startTitle': 'Start your search',
    'search.startDesc': 'Enter a term in the search bar to find legal texts.',
    'search.noResultsTitle': 'No results found',
    'search.noResultsDesc': 'Try different search terms or adjust your filters.',
    'search.clearSearch': 'Clear search',
    'search.noTitle': 'Untitled',
    'search.noDescription': 'No description available.',

    // Categories page
    'categories.backHome': 'Back to Home',
    'categories.searchPlaceholder': 'Search for a law, decree, article...',
    'categories.searchPlaceholderShort': 'Search for a text…',
    'categories.langLabel': 'Language',
    'categories.all': 'All',
    'categories.retry': 'Retry',
    'categories.noDocsTitle': 'No documents found',
    'categories.noDocsDesc': 'Try adjusting your filters.',
    'categories.docsCount': 'document(s) in this category',
    'categories.noPreview': 'No preview available',
    'categories.errorLoad': 'Unable to load documents. Check that the backend server is running.',
    'search.bodyMatches': 'Mentioned in the text',
    'search.titleMatches': 'Matches in the title',

    // Admin
    'admin.dashboard': 'Dashboard',
    'admin.dashboardDesc': 'Overview of JuriX performance',
    'admin.lastUpdate': 'Last update',
    'admin.statsError': 'Could not load statistics. The server may be unreachable.',
    'admin.docsError': 'Could not load documents. The server may be unreachable.',
    'admin.refresh': 'Refresh',
    'admin.totalDocs': 'Documents',
    'admin.totalSearches': 'Searches',
    'admin.activeUsers': 'Active Users',
    'admin.responseTime': 'Response Time',
    'admin.searchActivity': 'Search Activity',
    'admin.noActivityData': 'No activity data',
    'admin.latestDocs': 'Latest Documents',
    'admin.noRecentDocs': 'No recent documents',
    'admin.viewAll': 'View all',
    'admin.personasTitle': 'Conversations by profile',
    'admin.personasNote': '"General profile": visitors who skipped the profile question, and those who chose it.',
    'admin.personasEmpty': 'No conversations in this period',
    'admin.personasUnavailable': 'Profile breakdown unavailable',
    'admin.docManagement': 'Document Management',
    'admin.docManagementDesc': 'Add, edit, or delete legal texts',
    'admin.newDoc': 'Add documents',
    'admin.searchDoc': 'Search a document...',
    'admin.allCategories': 'All categories',
    'admin.allLanguages': 'All languages',
    'admin.allStatuses': 'All statuses',
    'admin.docTitle': 'Document title',
    'admin.language': 'Language',
    'admin.dateAdded': 'Date added',
    'admin.status': 'Status',
    'admin.actions': 'Actions',
    'admin.edit': 'Edit',
    'admin.delete': 'Delete',
    'admin.loading': 'Loading...',
    'admin.noDocFound': 'No documents found.',
    'admin.showing': 'Showing',
    'admin.on': 'of',
    'admin.docs': 'document(s)',
    'admin.page': 'Page',
    'admin.previous': 'Previous',
    'admin.next': 'Next',
    'admin.firstPage': 'First page',
    'admin.lastPage': 'Last page',
    'admin.draft': 'Draft',
    'admin.published': 'Published',
    'admin.processing': 'Processing',
    'admin.pending': 'Pending',
    'admin.refused': 'Refused',
    'admin.archived': 'Archived',
    'admin.confirmDelete': 'Are you sure you want to delete',
    'admin.irreversible': 'This action is irreversible.',
    'admin.deleteError': 'Deletion error',
    'admin.networkError': 'Network error while deleting the document',
    'admin.batchUpload': 'Batch Upload',
    'admin.batchUploadDesc': 'Upload multiple PDFs and track their processing in real time',
    'admin.selectFiles': 'Select files',
    'admin.dragDrop': 'Drag and drop your PDF files here, or',
    'admin.browse': 'browse',
    'admin.tapToChoose': 'Tap to choose PDF files',
    'admin.removeFile': 'Remove {name}',
    'admin.fileLimit': 'PDF (max 1 GB per file)',
    'admin.selectedFiles': 'Selected files',
    'admin.uploading': 'Uploading…',
    'admin.uploadFiles': 'Upload',
    'admin.files': 'file(s)',
    'admin.documents': 'Documents',
    'admin.blog': 'Blog & AI News',
    // Blog administration (src/routes/admin/blog/+page.svelte).
    'admin.blog.subtitle': 'Generate and publish AI-written explainers of legal news',
    'admin.blog.generate': 'Generate an AI article',
    'admin.blog.closeGenerator': 'Close the generator',
    'admin.blog.generatorTitle': 'Automatic article generator',
    'admin.blog.generatorHint': 'Describe the topic or news question; the AI writes the whole article',
    'admin.blog.topicLabel': 'Topic or news question *',
    'admin.blog.topicPlaceholder': 'E.g.: Can a landlord cut off a tenant\'s water in Cameroon?',
    'admin.blog.extraContextLabel': 'Additional context',
    'admin.blog.extraContextPlaceholder': 'E.g.: A recent incident in Douala: a tenant found their meter disconnected after 3 months of unpaid rent...',
    'admin.blog.generating': 'Generating (15-30s)...',
    'admin.blog.generateFull': 'Generate the full article',
    'admin.blog.previewTitle': 'Generated article — Preview',
    'admin.blog.slug': 'Slug:',
    'admin.blog.contextHeading': 'Context:',
    'admin.blog.summaryHeading': 'Plain-language legal analysis:',
    'admin.blog.keyPointsHeading': 'Key points:',
    'admin.blog.citationsHeading': 'Legal citations ({n}):',
    'admin.blog.impactHeading': 'Impact on citizens:',
    'admin.blog.publishNow': 'Publish now',
    'admin.blog.listTitle': 'Posts ({n})',
    'admin.blog.empty': 'No posts yet. Click “Generate an AI article” to get started.',
    'admin.blog.view': 'View on the site',
    'admin.blog.viewShort': 'View',
    'admin.blog.edit': 'Edit',
    'admin.blog.editTitle': 'Edit the post',
    'admin.blog.tagsField': 'Tags (comma-separated)',
    'admin.blog.contextField': 'Context',
    'admin.blog.summaryField': 'Legal analysis (summary)',
    'admin.blog.keyPointsField': 'Key points (one per line)',
    'admin.blog.impactField': 'Impact on citizens',
    'admin.blog.suggestedQuestionField': 'Suggested question (chat)',
    'admin.blog.publishedField': 'Published',
    'admin.blog.httpError': 'HTTP error {status}',
    'admin.blog.confirmDelete': 'Delete “{title}”?',
    'admin.inProcess': 'Processing',
    'admin.title': 'Title',
    'admin.reference': 'Reference',
    'admin.progress': 'Progress',
    'admin.date': 'Date',

    // About
    'about.title': 'About',
    'about.subtitle': 'Cameroon\'s digital legal reference.',
    'about.mission.title': 'Our Mission',
    'about.mission.p1': 'JuriX is an innovative platform dedicated to centralizing all of Cameroon\'s legal texts. Our primary goal is to democratize access to law by making legal texts accessible to everyone: citizens, legal professionals, students, and businesses.',
    'about.mission.p2': 'Beyond a simple digital library, JuriX integrates cutting-edge artificial intelligence to revolutionize the understanding of law. Thanks to our AI legal assistant, complex texts become clear and understandable for everyone.',
    'about.centralization.title': 'Centralization',
    'about.centralization.desc': 'All codes, laws, and regulations in one place.',
    'about.ai.title': 'Artificial Intelligence',
    'about.ai.desc': 'Clear explanations and instant legal assistance.',
    'about.creator': 'Designed and built by',
    'about.contact.title': 'Contact',
    'about.contact.email': 'Email',

    // Command palette (CommandPalette.svelte, opened from SiteHeader.svelte or Ctrl+K).
    'palette.label': 'Command palette',
    'palette.open': 'Search and quick actions',
    'palette.openWithShortcut': 'Search and quick actions (Ctrl+K)',
    'palette.placeholder': 'Search for a law or a topic, or ask a question…',
    'palette.clear': 'Clear',
    'palette.escKey': 'Esc',
    'palette.sectionResults': 'Results & Actions',
    'palette.sectionShortcuts': 'Shortcuts & Navigation',
    'palette.noResults': 'No results for “{q}”',
    'palette.noResultsHint': 'Try other keywords, or ask your question directly in the chat.',
    'palette.navigate': 'Navigate',
    'palette.select': 'Open',
    'palette.footer': 'JuriX universal palette',
    'palette.askAi.title': 'Ask the AI Assistant a question',
    'palette.askAi.subtitle': 'Sourced answers from our AI across the whole of the law',
    'palette.blog.title': 'News Decoded (Blog)',
    'palette.blog.subtitle': 'Weekly AI analyses of the hot topics',
    'palette.laws.title': 'Explore all legal texts',
    'palette.laws.subtitle': 'Codes, laws, decrees and orders, sorted by category',
    'palette.compare.title': 'Compare two legal regimes',
    'palette.compare.subtitle': 'Dynamic article-by-article comparison table',
    'palette.searchAll.title': 'Search “{q}” in all laws',
    'palette.searchAll.subtitle': 'Run the full-text and semantic search',
    'palette.askAiQuery.title': 'Ask the AI: “{q}”',
    'palette.askAiQuery.subtitle': 'Get a tailored answer in plain language',
    'palette.blogPost': 'Blog post',
    'palette.lawFallback': 'Official legal text',
    'palette.badge.assistant': 'Assistant',
    'palette.badge.blog': 'Blog',
    'palette.badge.laws': 'Laws',
    'palette.badge.tool': 'Tool',
    'palette.badge.search': 'Search',
    'palette.badge.news': 'News',
    'palette.badge.law': 'Law',

    // News blog (src/routes/blog): interface only, post content comes from the API.
    'blog.metaTitle': 'Legal News & AI Analyses — Blog',
    'blog.metaDescription': 'Every week, legal and economic news explained in plain language by artificial intelligence, with citations from the legal texts.',
    'blog.kicker': 'The News, Decoded by AI',
    'blog.title': 'The Law Behind the Headlines',
    'blog.subtitle': 'Every week, a hot news topic examined against the laws in force in Cameroon. Clear explanations, no needless jargon, with the official sources.',
    'blog.all': 'All',
    'blog.featured': 'Featured article',
    'blog.badge.ai': 'AI analysis',
    'blog.badge.weekly': 'Analysis of the week',
    'blog.badge.labour': 'Labour law',
    'blog.badge.cybercrime': 'Cybercrime',
    'blog.reading': 'read',
    'blog.recently': 'Recently',
    'blog.readFull': 'Read the full analysis',
    'blog.others': 'Other analyses',
    'blog.othersTitle': 'Other recent analyses',
    'blog.read': 'Read',
    'blog.ctaTitle': 'Have a question about a news story or a dispute?',
    'blog.ctaText': 'Our intelligent legal assistant analyses more than 2,200 laws and 43,000 articles in real time to give you a sourced, plain-language answer.',
    'blog.ctaButton': 'Ask the AI Assistant',
    'blog.metaSuffix': 'Legal Analysis',
    'blog.breadcrumb': 'Breadcrumb',
    'blog.shareMessage': 'Legal analysis by AI:',
    'blog.writtenWith': 'Written with the help of',
    'blog.aiName': 'JuriX AI',
    'blog.shareWhatsApp': 'Share on WhatsApp',
    'blog.shareLinkedIn': 'Share on LinkedIn',
    'blog.shareX': 'Share on X (Twitter)',
    'blog.copyLink': 'Copy link',
    'blog.copied': 'Copied!',
    'blog.contextTitle': '1. The news in 2 minutes (Context)',
    'blog.lawTitle': '2. What the law says — The AI\'s analysis',
    'blog.explanationTitle': 'Simplified legal explanation',
    'blog.keyPoints': 'Key rules to remember',
    'blog.citationsTitle': 'Applicable official legal texts',
    'blog.article': 'Article',
    'blog.legalExcerpt': 'Legal excerpt',
    'blog.readLaw': 'Read the full text of the law',
    'blog.impactTitle': 'What this actually changes for you',
    'blog.assistanceBadge': 'Tailored legal assistance',
    'blog.similarTitle': 'Going through a similar situation?',
    'blog.similarText': 'Don\'t stay in doubt. Ask our AI assistant your question directly: it will analyse the specifics of your case in light of the official texts.',
    'blog.askAssistant': 'Ask the Assistant this question',
    'blog.allPosts': 'All analyses',
    'blog.rubrique.immobilier': 'Real Estate',
    'blog.rubrique.logement': 'Housing',
    'blog.rubrique.travail': 'Labour',
    'blog.rubrique.emploi': 'Employment',
    'blog.rubrique.economie': 'Economy',
    'blog.rubrique.fiscalite': 'Taxation',
    'blog.rubrique.droit-penal': 'Criminal Law',
    'blog.rubrique.famille': 'Family',
    'blog.rubrique.numerique': 'Digital',
    'blog.rubrique.affaires': 'Business',
    'blog.rubrique.consommation': 'Consumer Affairs',
    'blog.rubrique.sante': 'Health',
    'blog.rubrique.actualite-juridique': 'Legal News',
  }
};

/**
 * Clés déjà signalées, pour ne pas répéter le même avertissement.
 *
 * Une clé manquante rendue dans une boucle — un badge par ligne d'un tableau —
 * produirait des centaines de lignes identiques et noierait tout le reste.
 */
const CLES_SIGNALEES = new Set<string>();

/**
 * Traduction d'une clé.
 *
 * LE REPLI SUR LA CLÉ EST DÉLIBÉRÉ, L'AVERTISSEMENT AUSSI. Une clé absente rend
 * son propre nom : l'interface affiche « laws.errorLoad » au lieu d'une phrase.
 * C'est laid mais lisible, et bien préférable à une chaîne vide ou à une
 * exception en production. Le problème est que RIEN ne le signalait : la faute
 * de frappe se découvrait à l'écran, par hasard, souvent sur une branche
 * d'erreur rarement atteinte.
 *
 * L'avertissement n'existe qu'en développement (`import.meta.env.DEV`) : il est
 * retiré du paquet de production par l'élagage, et n'a donc aucun coût pour
 * l'utilisateur. Le contrat de repli, lui, est inchangé.
 */
export function t(key: string, lang: Language): string {
  const valeur = translations[lang][key as keyof typeof translations.fr];

  if (import.meta.env.DEV && !valeur && !CLES_SIGNALEES.has(`${lang}:${key}`)) {
    CLES_SIGNALEES.add(`${lang}:${key}`);
    // Les deux blocs sont vérifiés : une clé présente en français et absente en
    // anglais est le défaut le plus courant, et le plus discret — l'interface
    // reste correcte tant qu'on ne bascule pas de langue.
    const autre: Language = lang === 'fr' ? 'en' : 'fr';
    const existeAilleurs = Boolean(translations[autre][key as keyof typeof translations.fr]);
    console.warn(
      existeAilleurs
        ? `[i18n] « ${key} » manque en « ${lang} » mais existe en « ${autre} » : traduction asymétrique.`
        : `[i18n] « ${key} » n'existe dans aucune langue : l'interface affichera la clé.`,
    );
  }

  return valeur || key;
}

// Reactive translation helper - automatically uses current language
export const tr = derived(language, ($language) => {
  return (key: string) => t(key, $language.current);
});
