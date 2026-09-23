# RD Recueil

**Recueil des besoins client et note de cadrage** · RD Formation

Kit de conception d'une application qui transforme une demande client (formation, prestation ponctuelle, module, ingénierie, certification) en une note de cadrage validée, preuve Qualiopi incluse.

## Contenu

| Fichier | Contenu |
|---|---|
| `CLAUDE.md` | Consignes pour Claude Code : pile, conventions, méthode de travail |
| `docs/01_ARCHITECTURE.md` | Vision, rôles, cycle de vie, écrans, pile technique, arborescence, modèle de données SQL, RLS, glossaire à l'exécution, note de cadrage, correspondance Qualiopi, charte, règles métier, lots |
| `docs/02_MODELE_RECUEIL_BESOINS.md` | Questionnaire complet : tronc commun (14 sections), 5 volets spécifiques, espace consultant |
| `docs/03_GLOSSAIRE.md` | 134 termes techniques avec identifiant, catégorie, définition et exemple |
| `docs/04_MODELE_NOTE_DE_CADRAGE.md` | Gabarit de restitution avec variables et blocs conditionnels |

## Le questionnaire en chiffres

| Partie | Sections | Questions |
|---|---|---|
| 1 · Tronc commun | TC-0 à TC-13 | 116 |
| 2 · Volets spécifiques | V-FOR (11), V-PON (10), V-MOD (12), V-ING (14), V-CER (11) | 58 |
| 3 · Espace consultant | ANA | 13 |
| **Total** | | **187** |

Un client ne voit que le tronc commun et les volets correspondant aux prestations cochées en `TC-0.01`.

## Conventions

- **`\*`** après un terme : terme technique défini dans le glossaire. La colonne *Glossaire* du questionnaire donne son identifiant.
- **ID** : `TC-n.nn` pour le tronc commun, `FOR.nn`, `PON.nn`, `MOD.nn`, `ING.nn`, `CER.nn` pour les volets, `ANA.nn` pour l'analyse consultant. Un ID publié ne change jamais.
- **Par** : `C` client, `F` formateur ou consultant, `C/F` les deux.
- **Condition** : règle d'affichage (grammaire en section 6.3 de l'architecture).

## Démarrer avec Claude Code

```bash
git init rd-recueil && cd rd-recueil
# copier CLAUDE.md, README.md et docs/ à la racine
claude
```

Premier message conseillé :

> Lis CLAUDE.md et les quatre fichiers de docs/. Propose-moi le plan détaillé du Lot 0 (scripts de parsing, contrôle de cohérence, seed SQL) sans écrire de code, puis attends ma validation.

## Utilisation sans application

Le fichier `02_MODELE_RECUEIL_BESOINS.md` s'utilise aussi tel quel comme trame d'entretien : parcourir le tronc commun, puis les volets utiles, et reporter les réponses dans le gabarit `04`.
