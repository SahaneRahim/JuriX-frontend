/**
 * RÉSERVÉ AUX TESTS du chat : les textes français proposés pour les clés
 * nouvelles de la refonte (P3, P4, P5), en attendant leur entrée dans
 * src/lib/stores/language.ts (ajoutées à l'intégration, avec l'anglais).
 * Sans eux, `$tr` rend la clé elle-même, et un test ne verrait pas une phrase
 * mal assemblée (« {n} » oublié, ordre des morceaux).
 *
 * Aucun code de l'application ne l'importe.
 */

export const TEXTES_DE_TEST: Record<string, string> = {
  'common.close': 'Fermer',
  // Remplace « chat.welcome.scope » (« …, à jour au {date}. ») : la date est
  // celle du dernier texte ajouté, qui ne prouve pas un corpus à jour.
  'chat.welcome.scopeLastAdded':
    'Je réponds à partir de {n} {sources} (dernier texte ajouté à JuriX le {date}). Je ne connais ni la jurisprudence ni votre dossier.',
  'chat.welcome.scopeNoDate': 'Je réponds à partir de {n} {sources}. Je ne connais ni la jurisprudence ni votre dossier.',
  'chat.welcome.scopeGeneric':
    'Je réponds à partir des textes officiels publiés dans JuriX. Je ne connais ni la jurisprudence ni votre dossier.',
  'chat.welcome.verify': 'Chaque réponse cite ses articles : touchez-les pour lire le texte officiel.',
  'chat.welcome.verifyGeneric': 'Chaque réponse indique ses sources : ouvrez-les pour lire le texte officiel.',
  'chat.welcome.privacy': 'N’écrivez ni nom ni numéro de téléphone.',
  'chat.suggestionsGroup': 'Questions suggérées',
  'chat.disclaimer': 'Information juridique générale, pas un avis sur votre cas. Vérifiez l’article cité avant d’agir.',
  'chat.stop': 'Arrêter',
  'chat.stopAria': 'Arrêter la réponse',
  'chat.stopped': 'Réponse arrêtée avant la fin.',
  'chat.askAgain': 'Reposer la question',
  'chat.send': 'Envoyer',
  'chat.progress.waiting': 'Préparation de la réponse…',
  'chat.progress.found': '{n} articles trouvés : {textes}',
  'chat.progress.foundOne': '1 article trouvé : {textes}',
  'chat.progress.doneSr': 'terminé',
  'chat.announce.done': 'Réponse terminée.',
  'chat.announce.doneCited': 'Réponse terminée, {n} articles cités.',
  'chat.announce.doneCitedOne': 'Réponse terminée, 1 article cité.',
  'chat.announce.unfound': '{n} citations non retrouvées.',
  'chat.announce.unfoundOne': '1 citation non retrouvée.',
  'chat.announce.stopped': 'Réponse arrêtée.',
  'chat.citation.article': 'Art. {n} — {nom}',
  'chat.citation.sansIntitule': 'Texte sans intitulé',
  'chat.citation.unfound': 'Citation non retrouvée dans les textes consultés : vérifiez-la avant de vous y fier.',
  'chat.citation.unfoundMany': 'Citations non retrouvées dans les textes consultés : vérifiez-les avant de vous y fier.',
  'chat.citation.unfoundShort': 'citation non retrouvée',
  'chat.cited.title': 'Articles cités ({n})',
  'chat.consulted.title': 'Textes consultés, non cités ({n})',
  'chat.consulted.read': 'articles lus : {articles}',
  'chat.statut.aucune': 'aucune modification relevée par JuriX',
  'chat.statut.aucuneAu': 'aucune modification relevée par JuriX au {date}',
  'chat.statut.desArticles': 'des articles de ce texte ont été modifiés depuis',
  'chat.statut.par': '{etat} par {texte}',
  'chat.statut.etat.abroge': 'abrogé',
  'chat.statut.etat.remplace': 'remplacé',
  'chat.statut.etat.abroge_partiellement': 'abrogé en partie',
  'chat.statut.etat.modifie': 'modifié',
  'chat.statut.etat.complete': 'complété',
  'chat.apercu.article': 'Article {etat} par {texte}.',
  'chat.apercu.articleReecrit': 'Article {etat} par {texte} : réécrit en entier.',
  'chat.apercu.texte': 'Texte {etat} par {texte}.',
  'chat.apercu.texteEtat': 'Texte {etat}.',
  'chat.apercu.afficheOrigine': 'Texte affiché : version d’origine, non consolidée.',
  'chat.apercu.afficheConsolidee': 'Texte affiché : version qui intègre déjà les modifications de {textes}.',
  'chat.apercu.origine': 'Version d’origine, non consolidée.',
  'chat.apercu.consolidee': 'Version qui intègre déjà les modifications de {textes}.',
  'chat.apercu.aucune': 'Aucune modification relevée par JuriX au {date}.',
  'chat.apercu.aucunePourLArticle':
    'Aucune modification de cet article relevée par JuriX au {date} ; d’autres articles du texte ont été modifiés.',
  'chat.preview.overlineArticle': 'Article cité dans la réponse',
  'chat.preview.overlineText': 'Texte cité dans la réponse',
  'chat.preview.readArticle': 'Lire dans le texte intégral',
  'chat.preview.readText': 'Lire le texte intégral',
  'chat.preview.newTab': '(s’ouvre dans un nouvel onglet)',
  'chat.preview.official': 'Seul le texte publié au Journal officiel fait foi.',
  'chat.preview.loading': 'Chargement de l’article…',
  'chat.preview.unavailable': 'L’aperçu de cet article n’est pas disponible. Le texte intégral reste consultable.',
  'chat.preview.englobant':
    'Cet article n’a pas de découpage propre dans JuriX : le passage ci-dessous le contient avec d’autres articles.',
  'chat.preview.truncated': 'Article coupé ici : la suite est dans le texte intégral.',
  'chat.preview.bold': 'En gras : le passage le plus proche de la phrase de la réponse.',
  'chat.preview.cutBefore':
    'L’aperçu s’arrête avant l’article {n}, que JuriX a enregistré avec celui-ci. La suite est dans le texte intégral.',
  'chat.preview.englobantExtrait':
    'Cet article n’a pas de découpage propre dans JuriX : il est tiré d’un passage qui en contient d’autres.',
  'chat.preview.ocr':
    'Des passages de ce texte ont été mal lus à la numérisation (suites de lettres isolées) : vérifiez-les au Journal officiel.',
  'chat.scrollToLatest': 'Aller au dernier message',
  'chat.barTitle': 'Assistant JuriX',
  'chat.profileLabel': 'Profil\u00a0:',
  'persona.change': 'Changer',
  'persona.general.nom': 'Général',
  'chat.profile.question': 'Avant de répondre : qui êtes-vous ? La réponse s’adapte à votre profil.',
  'chat.profile.skip': 'Continuer sans profil',
  'chat.profile.chosen': 'Profil choisi : {profil}.',
  'chat.profile.none': 'Réponse en profil général.',
  'chat.profile.announce': 'Choisissez votre profil pour obtenir la réponse.',
  'persona.newConversation': 'Choisir un autre profil ouvre une nouvelle conversation.',
  'persona.citoyen.nom': 'Citoyen',
  'persona.etudiant.nom': 'Étudiant en droit',
  'persona.avocat.nom': 'Avocat ou juriste',
  'persona.entrepreneur.nom': 'Entrepreneur',
};

/** `$tr` des tests : le texte proposé, sinon la clé (comme le vrai store). */
export const traduireEnTest = (cle: string): string => TEXTES_DE_TEST[cle] ?? cle;
