#!/usr/bin/env python3
"""Vérifie que les chemins et les clés i18n cités dans les documents de passation existent dans le dépôt.
Usage : python3 verifier-references.py <dossier-passation> <racine-du-depot>
Sortie : chemins introuvables, fichiers .svelte/.ts nommés mais absents, clés i18n absentes (existantes présumées), clés FR/EN."""
import re, sys, os, glob, json

doss, repo = sys.argv[1], sys.argv[2]
docs = [p for p in glob.glob(os.path.join(doss, '**', '*.md'), recursive=True)]
lang = open(os.path.join(repo, 'src/lib/stores/language.ts'), encoding='utf-8').read()
# bloc FR / EN
i_fr = lang.index('  fr: {'); i_en = lang.index('  en: {')
fr, en = lang[i_fr:i_en], lang[i_en:]
def cles(bloc):
    return set(m.group(1) for m in re.finditer(r"^\s*['\"]?([A-Za-z0-9_.\-]+)['\"]?\s*:", bloc, re.M))
K_FR, K_EN = cles(fr), cles(en)

# index de tous les fichiers du dépôt (hors node_modules, .git)
tous = set()
for root, dirs, files in os.walk(repo):
    dirs[:] = [d for d in dirs if d not in ('node_modules', '.git', 'build', '.svelte-kit')]
    for f in files:
        tous.add(os.path.relpath(os.path.join(root, f), repo))
noms = {}
for p in tous: noms.setdefault(os.path.basename(p), []).append(p)

rx_chemin = re.compile(r"`((?:src|tests|static|scripts)/[A-Za-z0-9_\-./()\[\]+@]+?)(?::\d+(?:-\d+)?)?`")
rx_fichier = re.compile(r"`([A-Za-z0-9_\-]+\.(?:svelte|ts|js|css|json|md|mjs))`")
rx_cle = re.compile(r"`((?:chat|loi|persona|common|a11y|nav|home|search|compare|laws|footer|header|error|blog|about|auth|login|signup|admin|status|statut|theme|lang|etat)\.[A-Za-z0-9_.\-]+)`")

manque_chemin, manque_fichier, manque_cle = {}, {}, {}
for d in docs:
    rel = os.path.relpath(d, doss)
    t = open(d, encoding='utf-8').read()
    for m in rx_chemin.finditer(t):
        c = m.group(1).rstrip('.')
        if '*' in c or c.endswith('/'):
            base = c.rstrip('/')
            if not any(p.startswith(base) for p in tous): manque_chemin.setdefault(c, set()).add(rel)
            continue
        if c not in tous and not any(p.startswith(c + '/') for p in tous):
            manque_chemin.setdefault(c, set()).add(rel)
    for m in rx_fichier.finditer(t):
        f = m.group(1)
        if f not in noms: manque_fichier.setdefault(f, set()).add(rel)
    for m in rx_cle.finditer(t):
        k = m.group(1).rstrip('.')
        if k not in K_FR: manque_cle.setdefault(k, set()).add(rel)

def aff(titre, d):
    print(f'\n== {titre} ({len(d)})')
    for k in sorted(d): print('  ', k, '←', ', '.join(sorted(d[k])))
aff('Chemins cités introuvables dans le dépôt', manque_chemin)
aff('Noms de fichiers cités introuvables (nom seul)', manque_fichier)
aff('Clés i18n citées absentes du bloc FR (existantes présumées : à contrôler, ou nouvelles à créer)', manque_cle)
print('\nClés FR sans équivalent EN dans le dépôt :', sorted(K_FR - K_EN)[:10], '…' if len(K_FR-K_EN)>10 else '')
print('Total clés FR / EN :', len(K_FR), len(K_EN))
