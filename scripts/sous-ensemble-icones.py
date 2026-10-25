#!/usr/bin/env python3
"""
Sous-ensemble de Material Icons : les seules ligatures de
src/lib/polices/material-icons.txt.

POURQUOI. La police complète (paquet material-icons, 125 Ko, 2 122 icônes)
était préchargée en priorité haute sur chaque page pour 43 icônes affichées.
Sur une 4G lente, elle disputait la bande passante à la feuille de style et
retardait le premier affichage de 0,6 à 1 s ; les icônes restaient invisibles
jusqu'à son arrivée (font-display: block).

MODE D'EMPLOI. fontTools n'est pas une dépendance du site : un environnement
Python jetable suffit, hors du dépôt.

    python3 -m venv ~/.venvs/fonttools
    ~/.venvs/fonttools/bin/pip install "fonttools[woff]"
    ~/.venvs/fonttools/bin/python scripts/sous-ensemble-icones.py

Lit node_modules/material-icons/iconfont/material-icons.woff2 (npm install
d'abord) et la liste ; écrit src/lib/polices/material-icons.woff2 et
material-icons.empreinte.json, que vérifie src/lib/polices/material-icons.test.ts.
"""

import hashlib
import json
import sys
from pathlib import Path

import fontTools
from fontTools import subset
from fontTools.ttLib import TTFont

RACINE = Path(__file__).resolve().parent.parent
PAQUET = RACINE / "node_modules" / "material-icons"
SOURCE = PAQUET / "iconfont" / "material-icons.woff2"
DOSSIER = RACINE / "src" / "lib" / "polices"
LISTE = DOSSIER / "material-icons.txt"
SORTIE = DOSSIER / "material-icons.woff2"
EMPREINTE = DOSSIER / "material-icons.empreinte.json"


def lire_liste(chemin: Path) -> list[str]:
    """Une ligature par ligne ; `#` ouvre un commentaire."""
    noms = []
    for ligne in chemin.read_text(encoding="utf-8").splitlines():
        ligne = ligne.strip()
        if ligne and not ligne.startswith("#"):
            noms.append(ligne)
    return noms


def ligatures(police: TTFont) -> dict[str, str]:
    """Nom d'icône -> glyphe, lu dans les substitutions de ligatures (GSUB)."""
    caractere = {glyphe: chr(code) for code, glyphe in police.getBestCmap().items()}
    resultat = {}
    for lookup in police["GSUB"].table.LookupList.Lookup:
        for table in lookup.SubTable:
            genre = lookup.LookupType
            if genre == 7:  # extension : la vraie table est dedans
                genre, table = table.ExtensionLookupType, table.ExtSubTable
            if genre != 4:
                continue
            for premier, suites in table.ligatures.items():
                for ligature in suites:
                    composants = [premier, *ligature.Component]
                    if all(glyphe in caractere for glyphe in composants):
                        nom = "".join(caractere[glyphe] for glyphe in composants)
                        resultat[nom] = ligature.LigGlyph
    return resultat


def sha256(chemin: Path) -> str:
    return hashlib.sha256(chemin.read_bytes()).hexdigest()


def main() -> None:
    noms = lire_liste(LISTE)
    if noms != sorted(set(noms)):
        sys.exit(f"{LISTE.name} : noms à trier, sans doublon")

    # Horodatage d'origine conservé : sans cela, chaque exécution changerait
    # les octets de la police (et son empreinte) sans que rien n'ait changé.
    police = TTFont(SOURCE, recalcTimestamp=False)
    toutes = ligatures(police)
    absents = [nom for nom in noms if nom not in toutes]
    if absents:
        sys.exit(f"Absentes de Material Icons : {', '.join(absents)}")

    options = subset.Options()
    options.flavor = "woff2"
    # Material Icons range ses ligatures dans `rlig` (ligatures requises,
    # appliquées par tous les navigateurs) ; `liga` au cas où une version
    # future les y déplace.
    options.layout_features = ["rlig", "liga"]
    # Sans cela, la fermeture GSUB rapatrierait toutes les icônes faites des
    # mêmes lettres, c'est-à-dire toutes : le sous-ensemble reviendrait à la
    # police entière.
    options.layout_closure = False

    sous_ensemble = subset.Subsetter(options)
    sous_ensemble.populate(
        glyphs=sorted({toutes[nom] for nom in noms}),
        # Les lettres qui composent les noms : sans elles dans la table des
        # caractères, le texte « search » ne trouverait pas ses glyphes.
        unicodes=sorted({ord(c) for nom in noms for c in nom}),
    )
    sous_ensemble.subset(police)
    subset.save_font(police, str(SORTIE), options)

    # Contre-vérification sur le fichier écrit : exactement les ligatures
    # demandées, ni plus ni moins.
    obtenues = set(ligatures(TTFont(SORTIE)))
    if obtenues != set(noms):
        sys.exit(
            "Sous-ensemble inattendu : "
            f"manquantes {sorted(set(noms) - obtenues)}, en trop {sorted(obtenues - set(noms))}"
        )

    version = json.loads((PAQUET / "package.json").read_text(encoding="utf-8"))["version"]
    EMPREINTE.write_text(
        json.dumps(
            {
                "liste": sha256(LISTE),
                "police": sha256(SORTIE),
                "source": f"material-icons {version}, iconfont/material-icons.woff2, sha256 {sha256(SOURCE)}",
                "fonttools": fontTools.version,
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"{SORTIE.relative_to(RACINE)} : {len(noms)} icônes, {SORTIE.stat().st_size} octets")


if __name__ == "__main__":
    main()
