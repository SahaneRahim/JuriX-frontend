## Accueil (bureau)

Fichier : `maquettes/RefonteAccueil.dc.html`

- `@aria-label [logo]` : JuriX, accueil
- `wm` : JuriX
- `@aria-label [nav]` : Navigation principale
- `nav` : Assistant IA
- `nav` : Parcourir
- `nav` : Comparer
- `nav` : Blog
- `@aria-label [bi lb on]` : Passer en français
- `bi` : FR
- `@aria-label [bi lb]` : Switch to English
- `bi` : EN
- `@aria-label [bi]` : Changer de thème
- `lnk` : Se connecter
- `cta` : Créer un compte
- `@aria-label [bi menu]` : Ouvrir le menu
- `mnu` : Assistant IA
- `mnu` : Parcourir
- `mnu` : Comparer
- `mnu` : Blog
- `mnu` : Se connecter
- `mnu` : Créer un compte
- `eyebrow` : 2 275
- `eyebrow` : textes officiels · chaque réponse cite ses articles
- `@aria-label [h1]` : Que dit la loi camerounaise ?
- `wi` : Que
- `wi` : dit
- `wi` : la
- `wi` : loi
- `wi` : camerounaise ?
- `@aria-label [who]` : Je suis
- `whol` : Je suis
- `@aria-label [segb {{pc}}]` : Citoyen
- `segb` : Citoyen
- `@aria-label [segb {{pe}}]` : Étudiant en droit
- `segb` : Étudiant en droit
- `@aria-label [segb {{pa}}]` : Avocat ou juriste
- `segb` : Avocat ou juriste
- `@aria-label [segb {{pn}}]` : Entrepreneur
- `segb` : Entrepreneur
- `@title [skip {{pg}}]` : Continuer sans profil
- `skip` : Sans profil
- `@aria-label [inp]` : Votre question ou votre recherche
- `@placeholder [inp]` :  
- `phl` : Exemple :
- `ph` : {{typed}}
- `hint` : N’écrivez ni nom ni numéro de téléphone.
- `@aria-label [mode]` : Mode
- `@aria-label [modeb {{mAsk}}]` : Assistant IA
- `modeb` : Assistant IA
- `@aria-label [modeb {{mSearch}}]` : Recherche
- `modeb` : Recherche
- `@aria-label [send]` : {{sendLabel}}
- `sugt` : Questions fréquentes ·
- `sugt` : {{personaLabel}}
- `sq` : {{q.t}}
- `@aria-label [sec s2]` : Parcourir le droit
- `h2` : Parcourir le droit
- `lead` : Quatorze domaines, du travail à l’environnement.
- `dtn` : Travail et sécurité sociale
- `dtd` : Code du travail, pensions
- `dtn` : Pénal et procédure pénale
- `dtd` : Code pénal, procédure pénale
- `dtn` : Famille et état civil
- `dtd` : État civil, Code de la nationalité
- `dtn` : Foncier et domaine de l’État
- `dtd` : Régime foncier, titre foncier
- `dtn` : Affaires, banque et OHADA
- `dtd` : Actes uniformes OHADA, sûretés
- `dtn` : Civil et procédure civile
- `dtd` : Code civil, voies d’exécution
- `dtn` : Finances publiques et impôts
- `dtd` : Lois de finances, régime financier
- `dtn` : Constitution et institutions
- `dtd` : Constitution, Code électoral
- `dtn` : Administration et collectivités
- `dtd` : Collectivités territoriales (2019)
- `dtn` : Fonction publique
- `dtd` : Statut général, ordres nationaux
- `dtn` : Traités et accords
- `dtd` : Traités ratifiés, Code CIMA
- `dtn` : Santé publique
- `dtd` : Loi-cadre sur la santé (1996)
- `dtn` : Éducation, culture et médias
- `dtd` : Orientation de l’éducation
- `dtn` : Environnement, mines et forêts
- `dtd` : Code minier, forêts et faune
- `dtn` : Tous les textes
- `dtd` : Les 2 275 textes officiels du corpus
- `@aria-label [sec s1]` : Ce que JuriX montre
- `h2` : Ce que JuriX vous montre
- `lead` : Trois façons de vérifier. Seul le texte publié au Journal officiel fait foi.
- `cits` : … distincte de celle du préavis
- `cc` : Art. 37
- `pc` : Chaque réponse cite ses articles
- `pc` : Touchez une citation : le texte officiel s’ouvre à côté de la réponse.
- `st` : Version d’origine, non consolidée
- `st` : Modifié
- `st` : Abrogé
- `pc` : Chaque texte indique ce que JuriX en sait
- `pc` : Version d’origine, modifié, abrogé : un mot et une icône, jamais la couleur seule.
- `hlt` : … a droit à une
- `hlk` : indemnité de licenciement
- `hlt` : distincte de celle du préavis.
- `pc` : Vérifiable dans le texte
- `pc` : Le passage le plus proche de la phrase est souligné, quand JuriX le retrouve.
- `ft` : JuriX · le droit camerounais, avec ses sources
- `@aria-label` : Pied de page
- `ft` : À propos
- `ft` : Blog

Constantes de texte du script (à reprendre des sources du dépôt, voir PASSATION.md) :

```js
const LABEL = { c: 'citoyens', e: 'étudiants en droit', a: 'avocats et juristes', n: 'entrepreneurs', g: 'profil général' };
const SUG = {
  c: ['Quelles indemnités en cas de licenciement abusif ?', 'Que risque l’auteur d’une escroquerie sur internet ?', 'Quels sont mes droits en garde à vue ?'],
  e: ['Quelle différence entre tentative et complicité en droit pénal ?', 'Comment est élu le Président de la République ?', 'Qu’est-ce qui distingue un contrat de travail à durée déterminée d’un contrat à durée indéterminée ?'],
  a: ['Quels sont les éléments constitutifs de l’abus de confiance ?', 'Quelles peines pour l’accès non autorisé à un système d’information ?', 'Comment former opposition à une injonction de payer en droit OHADA ?'],
  n: ['Quels avantages fiscaux l’ordonnance de 2025 accorde-t-elle à un nouvel investissement ?', 'Quelles pièces justificatives pour immatriculer une société commerciale ?', 'Quelles obligations pour l’employeur lors d’une embauche ?'],
  g: ['Quelles indemnités en cas de licenciement abusif ?', 'Quels sont mes droits en garde à vue ?', 'Que risque l’auteur d’une escroquerie sur internet ?'],
};
```

```js
const KEYS = ['Code du travail', 'licenciement pour motif économique', 'garde à vue', 'permis de recherche minière'];
```

## Accueil (mobile)

Fichier : `maquettes/RefonteMobileAccueil.dc.html`

- `@aria-label [logo]` : JuriX, accueil
- `wm` : JuriX
- `@aria-label [ib]` : Changer de thème
- `@aria-label [ib]` : Ouvrir le menu
- `mnu` : Assistant IA
- `mnu` : Parcourir
- `mnu` : Comparer
- `mnu` : Blog
- `mnu` : Se connecter
- `mnu` : Créer un compte
- `@aria-label [lg]` : Langue
- `lg` : Langue
- `@aria-label [on]` : Passer en français
- `on` : FR
- `@aria-label` : Switch to English
- `lg` : EN
- `eyebrow` : 2 275
- `eyebrow` : textes officiels
- `h1` : Que dit la loi camerounaise ?
- `@aria-label [who]` : Je suis
- `who` : Je suis :
- `who` : {{personaName}}
- `skip` : Sans profil
- `@aria-label [seg]` : Profil
- `@aria-label [segb {{pc}}]` : Citoyen
- `@aria-label [segb {{pe}}]` : Étudiant en droit
- `@aria-label [segb {{pa}}]` : Avocat ou juriste
- `@aria-label [segb {{pn}}]` : Entrepreneur
- `@aria-label [inp]` : Votre question ou votre recherche
- `@placeholder [inp]` :  
- `phl` : Exemple :
- `ph` : {{typed}}
- `@aria-label [mode]` : Mode
- `modeb` : Assistant IA
- `modeb` : Recherche
- `@aria-label [send]` : {{sendLabel}}
- `hint` : N’écrivez ni nom ni numéro de téléphone.
- `sugt` : Questions fréquentes ·
- `sugt` : {{personaLabel}}
- `sq` : {{q.t}}
- `domh` : Parcourir le droit
- `@aria-label [dom]` : Domaines du droit
- `dc` : Tous les textes
- `dc` : Travail
- `dc` : Pénal
- `dc` : Famille
- `dc` : Foncier
- `dc` : Affaires
- `dc` : Civil
- `@aria-label [tabs]` : Navigation
- `tb` : Accueil
- `tb` : Assistant IA
- `tb` : Parcourir

Constantes de texte du script (à reprendre des sources du dépôt, voir PASSATION.md) :

```js
const LABEL = { c: 'citoyens', e: 'étudiants en droit', a: 'avocats et juristes', n: 'entrepreneurs', g: 'profil général' };
const NAME = { c: 'Citoyen', e: 'Étudiant en droit', a: 'Avocat ou juriste', n: 'Entrepreneur', g: 'non précisé' };
const SUG = {
  c: ['Quelles indemnités en cas de licenciement abusif ?', 'Que risque l’auteur d’une escroquerie sur internet ?', 'Quels sont mes droits en garde à vue ?'],
  e: ['Quelle différence entre tentative et complicité en droit pénal ?', 'Comment est élu le Président de la République ?', 'Qu’est-ce qui distingue un contrat de travail à durée déterminée d’un contrat à durée indéterminée ?'],
  a: ['Quels sont les éléments constitutifs de l’abus de confiance ?', 'Quelles peines pour l’accès non autorisé à un système d’information ?', 'Comment former opposition à une injonction de payer en droit OHADA ?'],
  n: ['Quels avantages fiscaux l’ordonnance de 2025 accorde-t-elle à un nouvel investissement ?', 'Quelles pièces justificatives pour immatriculer une société commerciale ?', 'Quelles obligations pour l’employeur lors d’une embauche ?'],
  g: ['Quelles indemnités en cas de licenciement abusif ?', 'Quels sont mes droits en garde à vue ?', 'Que risque l’auteur d’une escroquerie sur internet ?'],
};
```

```js
const KEYS = ['Code du travail', 'licenciement pour motif économique', 'garde à vue', 'permis de recherche minière'];
```

## Assistant et articles cités (bureau ; la feuille mobile est le même fichier)

Fichier : `maquettes/RefonteAssistant.dc.html`

- `@aria-label [logo]` : JuriX, accueil
- `wm` : JuriX
- `@aria-label [nav]` : Navigation principale
- `nav` : Assistant IA
- `nav` : Parcourir
- `nav` : Comparer
- `nav` : Blog
- `@aria-label [bi lb on]` : Passer en français
- `bi` : FR
- `@aria-label [bi lb]` : Switch to English
- `bi` : EN
- `@aria-label [bi]` : Changer de thème
- `lnk` : Se connecter
- `cta` : Créer un compte
- `@aria-label [bi menu]` : Ouvrir le menu
- `mnu` : Assistant IA
- `mnu` : Parcourir
- `mnu` : Comparer
- `mnu` : Blog
- `mnu` : Se connecter
- `mnu` : Créer un compte
- `@aria-label [left {{leftCls}}]` : Conversation
- `@aria-label [chipw]` : Changer de profil, actuel : citoyen
- `chipw` : Citoyen
- `nw` : Nouvelle conversation
- `who` : JuriX
- `say` : Bonjour, je suis JuriX, votre assistant juridique. Je suis là pour vous aider. Quelle est votre question ?
- `say` : Chaque réponse cite ses articles : touchez-les pour lire le texte officiel. N’écrivez ni nom ni numéro de téléphone.
- `sgb` : Quelles indemnités en cas de licenciement abusif ?
- `sgb` : Que risque l’auteur d’une escroquerie sur internet ?
- `sgb` : Quels sont mes droits en garde à vue ?
- `ub` : Quelles indemnités en cas de licenciement ?
- `stp` : Recherche dans les textes…
- `stp` : 2 articles trouvés : Code du travail
- `stp` : Rédaction de la réponse…
- `s` : Réponse directe
- `s` : Si votre contrat à durée indéterminée est rompu par l’employeur et que vous comptez au moins deux ans de service continu dans l’entreprise, vous avez droit à une indemnité de licenciement, distincte de celle du préavis
- `@aria-label [cit c1 {{k37a}}]` : Article 37 du Code du travail : voir le passage
- `cit` : Art. 37 · Code du travail
- `s` : . Ce droit ne s’applique pas en cas de faute lourde
- `@aria-label [cit c2 {{k37b}}]` : Article 37 : voir le passage sur la faute lourde
- `cit` : Art. 37
- `s` : .
- `s` : Pendant le préavis, l’employeur et le travailleur restent tenus de leurs obligations réciproques
- `@aria-label [cit c3 {{k35}}]` : Article 35 du Code du travail : voir le passage
- `cit` : Art. 35 · Code du travail
- `n` : 2
- `peekb` : Articles cités
- `@aria-label [cinp {{hideCls}}]` : Votre question
- `@placeholder [cinp {{hideCls}}]` : Posez votre question juridique…
- `ctyped` : {{typed}}
- `@aria-label [snd {{sndCls}}]` : Poser la question
- `disc` : Information juridique générale, pas un avis sur votre cas. Vérifiez l’article cité avant d’agir.
- `@aria-label [veil {{veilCls}}]` : Fermer les articles cités
- `@aria-label [proofs {{sheetCls}}]` : Articles cités
- `ph` : Articles cités
- `@aria-label [n]` : 2 articles cités
- `@aria-label [xclose]` : Fermer les articles cités
- `empty` : Les articles cités apparaîtront ici, avec leur statut.
- `ref` : Loi n° 92/007 · 14 août 1992
- `art` : Art. 37 — Code du travail
- `chp` : Origine, non consolidée
- `stt` : Version d’origine, non consolidée.
- `stt` : Aucune modification relevée par JuriX au 14 oct. 2026.
- `txt` : (1) En cas de rupture de contrat à durée indéterminée du fait de l’employeur,
- `ps` : hormis le cas de faute lourde
- `txt` : ,
- `ps` : le travailleur ayant accompli dans l’entreprise une durée de service continue au moins égale à deux (2) ans, a droit à une indemnité de licenciement distincte de celle du préavis
- `txt` : .
- `leg` : Souligné : le passage le plus proche de la phrase de la réponse. Extrait : la suite est dans le texte intégral.
- `sa` : Lire dans le texte intégral
- `sa` : {{refLabel}}
- `art` : Art. 35 — Code du travail
- `txt` : (1) Pendant la durée du préavis, l’employeur et le travailleur sont tenus au respect de toutes les
- `ps` : obligations réciproques
- `txt` : qui leur incombent.
- `sa` : Copier la référence
- `pfoot` : Seul le texte publié au Journal officiel fait foi.

Constantes de texte du script (à reprendre des sources du dépôt, voir PASSATION.md) :

```js
const Q = 'Quelles indemnités en cas de licenciement ?';
```

## Lecture d'un texte

Fichier : `maquettes/RefonteLecture.dc.html`

- `@aria-label [logo]` : JuriX, accueil
- `wm` : JuriX
- `@aria-label [nav]` : Navigation principale
- `nav` : Assistant IA
- `nav` : Parcourir
- `nav` : Comparer
- `nav` : Blog
- `@aria-label [bi lb on]` : Passer en français
- `bi` : FR
- `@aria-label [bi lb]` : Switch to English
- `bi` : EN
- `@aria-label [bi]` : Changer de thème
- `lnk` : Se connecter
- `cta` : Créer un compte
- `@aria-label [bi menu]` : Ouvrir le menu
- `mnu` : Assistant IA
- `mnu` : Parcourir
- `mnu` : Comparer
- `mnu` : Blog
- `mnu` : Se connecter
- `mnu` : Créer un compte
- `@aria-label [bc mono]` : Fil d’Ariane
- `bc` : Parcourir
- `bc` : Travail et sécurité sociale
- `bc` : Code du travail
- `h1` : Loi n° 92/007 du 14 août 1992 portant Code du travail
- `stp` : Version d’origine, non consolidée
- `st0` : Aucune modification relevée par JuriX au 14 oct. 2026. Ce relevé peut être incomplet.
- `st0` : Signaler
- `@aria-label [toc]` : Table des matières
- `toch` : Table des matières
- `tocs` : Début du texte
- `sec` : Section III : De la suspension et de la résiliation du contrat de travail
- `sec` : 4 articles
- `ti` : Art. 35
- `ti` : Art. 36
- `ti` : Art. 37
- `ti` : Art. 38
- `@aria-label [read]` : Article
- `eb` : Section III : De la suspension et de la résiliation du contrat de travail
- `arth` : {{artLabel}}
- `body` : (1) Pendant la durée du préavis, l’employeur et le travailleur sont tenus au respect de toutes les
- `hl` : obligations réciproques
- `body` : qui leur incombent.
- `ph0` : [Suite de l’article, à reprendre du corpus]
- `ph0` : [Texte de l’article 36, à reprendre du corpus]
- `body` : (1) En cas de rupture de contrat à durée indéterminée du fait de l’employeur,
- `hl` : hormis le cas de faute lourde
- `body` : ,
- `hl` : le travailleur ayant accompli dans l’entreprise une durée de service continue au moins égale à deux (2) ans, a droit à une indemnité de licenciement distincte de celle du préavis
- `body` : .
- `ph0` : [Texte de l’article 38, à reprendre du corpus]
- `ab` : {{refLabel}}
- `ab` : {{linkLabel}}
- `foi` : Seul le texte publié au Journal officiel fait foi.
- `@aria-label [pn]` : Articles voisins
- `pnb` : Précédent
- `pnb` : {{prevLabel}}
- `pnb` : Suivant
- `pnb` : {{nextLabel}}
- `@aria-label [rail]` : Note de l’assistant
- `nh` : Explication simplifiée (IA)
- `nd` : Demandez à l’assistant d’expliquer cet article en langage courant, à partir de son texte et de son document d’origine. Vous obtiendrez :
- `nl` : Contenu clé :
- `nl` : Le résumé des points importants de l’article.
- `nl` : Implications :
- `nl` : Ce que cela signifie concrètement pour vous.
- `pbtn` : Expliquer l’article
- `wait` : Explication en cours…
- `s` : Contenu clé :
- `s` : Après au moins deux ans de service continu dans l’entreprise, le travailleur dont le contrat à durée indéterminée est rompu par l’employeur a droit à une indemnité de licenciement, distincte de celle du préavis. La faute lourde est exclue.
- `s` : Implications :
- `s` : Vous êtes concerné si votre contrat est à durée indéterminée, si l’employeur y met fin et si vous avez au moins deux ans de service continu.
- `s` : Pendant le préavis, l’employeur et le travailleur restent tenus de leurs obligations réciproques.
- `s` : Tant que le préavis court, chacun doit continuer à respecter ses engagements envers l’autre.
- `aiw` : Réponse générée par une IA. Vérifiez-la dans le texte de l’article.
- `regen` : Régénérer
- `ask` : Poser une question sur cet article

## Résultats de recherche

Fichier : `maquettes/RefonteRecherche.dc.html`

- `@aria-label [logo]` : JuriX, accueil
- `wm` : JuriX
- `@aria-label [nav]` : Navigation principale
- `nav` : Assistant IA
- `nav` : Parcourir
- `nav` : Comparer
- `nav` : Blog
- `@aria-label [bi lb on]` : Passer en français
- `bi` : FR
- `@aria-label [bi lb]` : Switch to English
- `bi` : EN
- `@aria-label [bi]` : Changer de thème
- `lnk` : Se connecter
- `cta` : Créer un compte
- `@aria-label [bi menu]` : Ouvrir le menu
- `mnu` : Assistant IA
- `mnu` : Parcourir
- `mnu` : Comparer
- `mnu` : Blog
- `mnu` : Se connecter
- `mnu` : Créer un compte
- `h1s` : Résultats pour « licenciement »
- `@aria-label [inp]` : Rechercher une loi, un décret, un article
- `@placeholder [inp]` :  
- `ph` : {{typed}}
- `@aria-label [mode]` : Mode
- `modeb` : Assistant IA
- `modeb` : Recherche
- `@aria-label [send {{pressCls}}]` : Lancer la recherche
- `handoff` : Poser « licenciement » à l’assistant IA
- `@aria-label [nt]` : Nature du texte
- `ntab` : Tous
- `n` : 2
- `ntab` : Lois
- `n` : 1
- `ntab` : Décrets
- `ntab` : Arrêtés
- `n` : 0
- `ntab` : Actes uniformes
- `ntab` : Autres
- `stat` : {{countLabel}}
- `stat` : Trier par :
- `stat` : Pertinence
- `rp` : Loi n° 92/007 · 14 août 1992 · Travail et sécurité sociale
- `sr` : Loi n° 92/007,
- `rtl` : Code du travail
- `rx` : … hormis le cas de faute lourde, le travailleur ayant accompli dans l’entreprise une durée de service continue au moins égale à deux (2) ans, a droit à une
- `rx` : indemnité
- `rx` : de
- `rx` : licenciement
- `rx` : distincte de celle du préavis.
- `stl` : Origine, non consolidée
- `chip` : Art. 37
- `rp` : Décret n° 2018/9387/CAB/PM · 30 déc. 2018 · Travail et sécurité sociale
- `sr` : Décret n° 2018/9387/CAB/PM,
- `rtl` : Modalités d’application de certaines dispositions du Code du travail relatives au
- `rtl` : licenciement
- `rtl` : pour motif économique

Constantes de texte du script (à reprendre des sources du dépôt, voir PASSATION.md) :

```js
const Q = 'licenciement';
```
