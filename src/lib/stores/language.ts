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
    'login.title': 'Connexion',
    'login.email': 'Adresse email',
    'login.password': 'Mot de passe',
    'login.submit': 'Se connecter',
    'login.submitting': 'Connexion…',
    'login.accountsNote': 'Les comptes sont créés par un administrateur.',
    'login.errorCredentials': 'Identifiants invalides.',
    'login.errorDisabled': 'Ce compte est désactivé.',
    'login.errorGeneric': 'Connexion impossible. Réessayez dans un instant.',
    'login.errorNetwork': 'Impossible de joindre le serveur.',
    'common.close': 'Fermer',
    'common.cancel': 'Annuler',
    'common.save': 'Enregistrer',
    'common.saving': 'Enregistrement…',
    'admin.users': 'Utilisateurs',
    'admin.usersDesc': 'Comptes autorisés à accéder à l\'administration.',
    'admin.backToSite': 'Retour au site',
    'admin.logout': 'Déconnexion',
    'admin.administration': 'Administration',
    'admin.checkingSession': 'Vérification de la session…',
    'admin.sinceLastMonth': 'depuis le mois dernier',
    'admin.requests': 'requêtes',
    'admin.role.user': 'Utilisateur',
    'admin.role.admin': 'Administrateur',
    'admin.role.superadmin': 'Superadmin',
    'admin.user.new': 'Nouveau compte',
    'admin.user.edit': 'Modifier le compte',
    'admin.user.email': 'Email',
    'admin.user.username': 'Nom d\'utilisateur',
    'admin.user.usernameHint': 'Converti en minuscules à l\'enregistrement.',
    'admin.user.fullName': 'Nom complet',
    'admin.user.role': 'Rôle',
    'admin.user.roleHint': 'Seul un superadmin peut changer un rôle',
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
    'admin.users.searchPlaceholder': 'Rechercher par email, identifiant ou nom…',
    'admin.users.allRoles': 'Tous les rôles',
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
    'admin.doc.editTitle': 'Éditer le document',
    'admin.doc.title': 'Titre',
    'admin.doc.titlePlaceholder': 'Titre du document',
    'admin.doc.category': 'Catégorie',
    'admin.doc.noCategory': '-- Aucune catégorie --',
    'admin.doc.content': 'Contenu',
    'admin.doc.contentPlaceholder': 'Contenu du document…',
    'admin.doc.chars': 'caractères',
    'admin.doc.saveError': 'Erreur : {detail}',
    'admin.doc.unknownError': 'Erreur inconnue',
    'admin.upload.title': 'Ajouter des documents',
    'admin.upload.titlePlaceholder': 'Ex : La Constitution du Cameroun',
    'admin.upload.optional': '(optionnel)',
    'admin.upload.refPlaceholder': 'Ex : LOI-2024-001 ou Décret N°2024/PM/123',
    'admin.upload.refHint': 'Numéro officiel du document juridique',
    'admin.upload.category': 'Catégorie du document',
    'admin.upload.selectCategory': '-- Sélectionner une catégorie --',
    'admin.upload.loadingCategories': 'Chargement des catégories…',
    'admin.upload.clickToSelect': 'Cliquez pour sélectionner des fichiers',
    'admin.upload.formats': 'PDF ou DOCX (1 Go max)',
    'admin.upload.statusUploading': 'Envoi…',
    'admin.upload.statusProcessing': 'Traitement…',
    'admin.upload.statusDone': 'Terminé',
    'admin.upload.statusError': 'Erreur',
    'admin.upload.statusPending': 'En attente',
    'admin.upload.processing': 'Traitement en cours…',
    'admin.upload.start': 'Lancer le traitement',
    'admin.upload.logUploading': '📤 Envoi de {name}…',
    'admin.upload.logProcessing': '⚙️ Traitement de {name} (ID : {id})…',
    'admin.upload.logDone': '✅ {name} envoyé au pipeline.',
    'admin.upload.logError': '❌ Erreur sur {name} : {err}',
    'admin.upload.errUpload': 'Erreur d\'envoi',
    'admin.upload.errIngest': 'Erreur d\'ingestion ({status}) : {text}',
    'batch.uploadFailed': 'Envoi impossible : {err}',
    // Hero section
    'hero.badge': 'IA Juridique Camerounaise',
    'hero.title': 'Votre Assistant Juridique IA',
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
    'chat.errorNetwork': 'Impossible de joindre le serveur.',
    'chat.errorOverloaded': 'Le service est momentanément saturé. Réessayez dans quelques instants.',
    'chat.errorTooShort': 'Votre question est trop courte : au moins 5 caractères.',
    'chat.errorQuota': "Le quota de questions du jour est atteint. L'assistant sera de nouveau disponible demain.",
    'admin.lastDays': 'Les {n} derniers jours',
    'batch.errorUnknown': "Le serveur a signalé une erreur pendant l'import.",

    // Categories
    'categories.title': 'Explorer par Catégorie',
    'categories.subtitle': 'Explorez les textes de loi par grandes catégories',
    'categories.documentsShort': 'doc.',

    // Category names (French)

    // Category descriptions (French)

    // Common
    'common.loading': 'Chargement...',
    'common.retry': 'Réessayer',

    // Search results
    'search.resultsFor': 'Résultats pour',
    'search.searchLaw': 'Rechercher une loi, un décret, un article...',

    // Pagination
    'pagination.prev': 'Précédent',
    'pagination.next': 'Suivant',
    'pagination.page': 'Page',

    // Search page filters & UI
    'search.filters': 'Filtres',
    'search.reset': 'Réinitialiser',
    'search.datePublication': 'Date de publication',
    'search.allTime': 'Toute période',
    'search.thisYear': 'Cette année',
    'search.last5Years': '5 dernières années',
    'search.category': 'Catégorie',
    'search.sortBy': 'Trier par:',
    'search.relevance': 'Pertinence',
    'search.recentDate': 'Date récente',
    'search.oldestDate': 'Date ancienne',
    'search.aboutResults': 'Environ',
    'search.resultsFound': 'résultats trouvés',
    'search.seconds': 'secondes',
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
    // 'nav.signup' conservée : plus aucun lien ne l'utilise (aucun endpoint
    // d'inscription n'existe côté backend), mais la retirer casserait toute
    // traduction encore référencée ailleurs.

    // Footer
    'footer.rights': '© 2025 JuriX. Tous droits réservés. L\'accès au droit pour tous.',

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
    'categories.langLabel': 'Langue',
    'categories.all': 'Tout',
    'categories.retry': 'Réessayer',
    'categories.noDocsTitle': 'Aucun document trouvé',
    'categories.noDocsDesc': 'Essayez de modifier vos filtres.',
    'categories.docsCount': 'document(s) dans cette catégorie',
    'categories.noPreview': 'Aucun aperçu disponible',
    'categories.errorLoad': 'Impossible de charger les documents. Vérifiez que le serveur backend est démarré.',
    'search.bodyMatches': 'Mentions dans le texte',

    // Admin
    'admin.dashboard': 'Tableau de Bord',
    'admin.dashboardDesc': 'Aperçu des performances de JuriX',
    'admin.lastUpdate': 'Dernière mise à jour',
    'admin.statsError': 'Impossible de charger les statistiques. Le serveur est peut-être injoignable.',
    'admin.docsError': 'Impossible de charger les documents. Le serveur est peut-être injoignable.',
    'admin.refresh': 'Actualiser',
    'admin.totalDocs': 'Documents Total',
    'admin.totalSearches': 'Recherches Total',
    'admin.activeUsers': 'Utilisateurs Actifs',
    'admin.responseTime': 'Temps de Réponse',
    'admin.searchActivity': 'Activité de Recherche',
    'admin.noActivityData': 'Aucune donnée d\'activité',
    'admin.latestDocs': 'Derniers Documents',
    'admin.noRecentDocs': 'Aucun document récent',
    'admin.viewAll': 'Voir tout',
    'admin.docManagement': 'Gestion des Documents',
    'admin.docManagementDesc': 'Ajoutez, modifiez ou supprimez des textes de loi',
    'admin.newDoc': 'Nouveau Document',
    'admin.searchDoc': 'Rechercher un document...',
    'admin.allCategories': 'Toutes catégories',
    'admin.allLanguages': 'Toutes langues',
    'admin.allStatuses': 'Tous statuts',
    'admin.docTitle': 'Titre du document',
    'admin.language': 'Langue',
    'admin.dateAdded': 'Date d\'ajout',
    'admin.status': 'Statut',
    'admin.actions': 'Actions',
    'admin.edit': 'Éditer',
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
    'admin.processing': 'Traitement...',
    'admin.pending': 'En attente',
    'admin.refused': 'Refusé',
    'admin.archived': 'Archivé',
    'admin.confirmDelete': 'Êtes-vous sûr de vouloir supprimer',
    'admin.irreversible': 'Cette action est irréversible.',
    'admin.deleteError': 'Erreur lors de la suppression',
    'admin.networkError': 'Erreur réseau lors de la suppression du document',
    'admin.batchUpload': 'Import en lot',
    'admin.batchUploadDesc': 'Uploadez plusieurs PDFs et suivez leur traitement en temps réel',
    'admin.selectFiles': 'Sélectionner les fichiers',
    'admin.dragDrop': 'Glissez-déposez vos fichiers PDF ici, ou',
    'admin.browse': 'parcourez',
    'admin.fileLimit': 'Limite: 1GB par fichier',
    'admin.selectedFiles': 'Fichiers sélectionnés',
    'admin.uploading': 'Upload en cours...',
    'admin.uploadFiles': 'Uploader',
    'admin.files': 'fichier(s)',
    'admin.documents': 'Documents',
    'admin.all': 'Tous',
    'admin.inProcess': 'En traitement',
    'admin.publishedPlural': 'Publiés',
    'admin.refusedPlural': 'Refusés',
    'admin.title': 'Titre',
    'admin.reference': 'Référence',
    'admin.progress': 'Progression',
    'admin.date': 'Date',

    // About
    'about.title': 'À propos de',
    'about.subtitle': 'La référence juridique numérique du Cameroun.',
    'about.mission.title': 'Notre Mission',
    'about.mission.p1': 'JuriX est une plateforme innovante dédiée à la centralisation de l\'ensemble des textes de lois du Cameroun. Notre objectif premier est de démocratiser l\'accès au droit en rendant les textes juridiques accessibles à tous : citoyens, professionnels du droit, étudiants et entreprises.',
    'about.mission.p2': 'Au-delà d\'une simple bibliothèque numérique, JuriX intègre l\'intelligence artificielle de pointe pour révolutionner la compréhension du droit. Grâce à notre assistant juridique IA, les textes complexes deviennent clairs et intelligibles pour tout le monde.',
    'about.centralization.title': 'Centralisation',
    'about.centralization.desc': 'Tous les codes, lois et règlements en un seul endroit.',
    'about.ai.title': 'Intelligence Artificielle',
    'about.ai.desc': 'Explications claires et assistance juridique instantanée.',
    'about.creator': 'Conçu et réalisé par',
    'about.contact.title': 'Contact',
    'about.contact.phone': 'Téléphone',
    'about.contact.whatsapp': 'WhatsApp',
    'about.contact.email': 'Email',
  },
  en: {
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
    'login.title': 'Sign in',
    'login.email': 'Email address',
    'login.password': 'Password',
    'login.submit': 'Sign in',
    'login.submitting': 'Signing in…',
    'login.accountsNote': 'Accounts are created by an administrator.',
    'login.errorCredentials': 'Invalid credentials.',
    'login.errorDisabled': 'This account is disabled.',
    'login.errorGeneric': 'Sign-in failed. Try again in a moment.',
    'login.errorNetwork': 'Unable to reach the server.',
    'common.close': 'Close',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.saving': 'Saving…',
    'admin.users': 'Users',
    'admin.usersDesc': 'Accounts allowed to access the administration.',
    'admin.backToSite': 'Back to site',
    'admin.logout': 'Sign out',
    'admin.administration': 'Administration',
    'admin.checkingSession': 'Checking session…',
    'admin.sinceLastMonth': 'since last month',
    'admin.requests': 'requests',
    'admin.role.user': 'User',
    'admin.role.admin': 'Administrator',
    'admin.role.superadmin': 'Superadmin',
    'admin.user.new': 'New account',
    'admin.user.edit': 'Edit account',
    'admin.user.email': 'Email',
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
    'admin.doc.noCategory': '-- No category --',
    'admin.doc.content': 'Content',
    'admin.doc.contentPlaceholder': 'Document content…',
    'admin.doc.chars': 'characters',
    'admin.doc.saveError': 'Error: {detail}',
    'admin.doc.unknownError': 'Unknown error',
    'admin.upload.title': 'Add documents',
    'admin.upload.titlePlaceholder': 'e.g. The Constitution of Cameroon',
    'admin.upload.optional': '(optional)',
    'admin.upload.refPlaceholder': 'e.g. LOI-2024-001 or Decree No. 2024/PM/123',
    'admin.upload.refHint': 'Official number of the legal document',
    'admin.upload.category': 'Document category',
    'admin.upload.selectCategory': '-- Select a category --',
    'admin.upload.loadingCategories': 'Loading categories…',
    'admin.upload.clickToSelect': 'Click to select files',
    'admin.upload.formats': 'PDF or DOCX (max 1 GB)',
    'admin.upload.statusUploading': 'Uploading…',
    'admin.upload.statusProcessing': 'Processing…',
    'admin.upload.statusDone': 'Done',
    'admin.upload.statusError': 'Error',
    'admin.upload.statusPending': 'Pending',
    'admin.upload.processing': 'Processing…',
    'admin.upload.start': 'Start processing',
    'admin.upload.logUploading': '📤 Uploading {name}…',
    'admin.upload.logProcessing': '⚙️ Processing {name} (ID: {id})…',
    'admin.upload.logDone': '✅ {name} sent to the pipeline.',
    'admin.upload.logError': '❌ Error on {name}: {err}',
    'admin.upload.errUpload': 'Upload error',
    'admin.upload.errIngest': 'Ingestion error ({status}): {text}',
    'batch.uploadFailed': 'Upload failed: {err}',
    // Hero section
    'hero.badge': 'Cameroonian Legal AI',
    'hero.title': 'Your AI Legal Assistant',
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

    // Category names (English)

    // Category descriptions (English)

    // Common
    'common.loading': 'Loading...',
    'common.retry': 'Retry',

    // Search results
    'search.resultsFor': 'Results for',
    'search.searchLaw': 'Search for a law, decree, article...',

    // Pagination
    'pagination.prev': 'Previous',
    'pagination.next': 'Next',
    'pagination.page': 'Page',

    // Search page filters & UI
    'search.filters': 'Filters',
    'search.reset': 'Reset',
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
    'search.seconds': 'seconds',

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

    // Footer
    'footer.rights': '© 2025 JuriX. All rights reserved. Access to law for everyone.',

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
    'categories.langLabel': 'Language',
    'categories.all': 'All',
    'categories.retry': 'Retry',
    'categories.noDocsTitle': 'No documents found',
    'categories.noDocsDesc': 'Try adjusting your filters.',
    'categories.docsCount': 'document(s) in this category',
    'categories.noPreview': 'No preview available',
    'categories.errorLoad': 'Unable to load documents. Check that the backend server is running.',
    'search.bodyMatches': 'Mentioned in the text',

    // Admin
    'admin.dashboard': 'Dashboard',
    'admin.dashboardDesc': 'Overview of JuriX performance',
    'admin.lastUpdate': 'Last update',
    'admin.statsError': 'Could not load statistics. The server may be unreachable.',
    'admin.docsError': 'Could not load documents. The server may be unreachable.',
    'admin.refresh': 'Refresh',
    'admin.totalDocs': 'Total Documents',
    'admin.totalSearches': 'Total Searches',
    'admin.activeUsers': 'Active Users',
    'admin.responseTime': 'Response Time',
    'admin.searchActivity': 'Search Activity',
    'admin.noActivityData': 'No activity data',
    'admin.latestDocs': 'Latest Documents',
    'admin.noRecentDocs': 'No recent documents',
    'admin.viewAll': 'View all',
    'admin.docManagement': 'Document Management',
    'admin.docManagementDesc': 'Add, edit, or delete legal texts',
    'admin.newDoc': 'New Document',
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
    'admin.processing': 'Processing...',
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
    'admin.fileLimit': 'Limit: 1GB per file',
    'admin.selectedFiles': 'Selected files',
    'admin.uploading': 'Uploading...',
    'admin.uploadFiles': 'Upload',
    'admin.files': 'file(s)',
    'admin.documents': 'Documents',
    'admin.all': 'All',
    'admin.inProcess': 'Processing',
    'admin.publishedPlural': 'Published',
    'admin.refusedPlural': 'Refused',
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
    'about.contact.phone': 'Phone',
    'about.contact.whatsapp': 'WhatsApp',
    'about.contact.email': 'Email',
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
