# CLAUDE.md · RD Recueil

Consignes permanentes pour Claude Code sur ce dépôt.

## Contexte

Application web de **RD Formation** (organisme de formation professionnelle, Montpellier) qui permet :
- au client de décrire sa demande via un questionnaire conditionnel ;
- au consultant de mener l'entretien, d'analyser le besoin et de produire une note de cadrage validée en ligne.

Cinq familles de prestations : formation (`FOR`), prestation ponctuelle (`PON`), conception de module (`MOD`), ingénierie (`ING`), démarche certifiante (`CER`).

## Documents de référence (à lire avant toute tâche)

| Ordre | Fichier | Rôle |
|---|---|---|
| 1 | `docs/01_ARCHITECTURE.md` | Architecture, modèle de données, RLS, règles métier, lots |
| 2 | `docs/02_MODELE_RECUEIL_BESOINS.md` | **Source de vérité** des 187 questions |
| 3 | `docs/03_GLOSSAIRE.md` | **Source de vérité** des 134 termes \* |
| 4 | `docs/04_MODELE_NOTE_DE_CADRAGE.md` | Gabarit de la note de cadrage |

Ne jamais modifier une question ou un terme ailleurs que dans ces `.md`. Toute modification passe par : édition du `.md` → `node scripts/parse-questionnaire.mjs` → `node scripts/parse-glossaire.mjs` → `node scripts/check-coherence.mjs` → `node scripts/build-seed.mjs`.

## Pile imposée

- HTML, CSS, JavaScript natif en **modules ES**. Aucun framework, aucun bundler, aucune étape de build pour `app/`.
- Routage SPA par hash (`#/…`), déploiement GitHub Pages depuis `app/`.
- Supabase (Postgres, Auth e-mail + mot de passe, Storage, RLS, Edge Functions) via `@supabase/supabase-js@2` en CDN.
- Comptes créés uniquement via l'Edge Function `creer-compte` (mot de passe temporaire, changement obligatoire à la première connexion). Aucune inscription libre.
- Icônes : Lucide (https://lucide.dev/) uniquement, via `data-lucide="…"` + `lucide.createIcons()`. La skill `.claude/skills/ui-ux-pro-max` (locale, non versionnée) propose des icônes Phosphor/Heroicons dans ses exemples : n'en suivre que la logique (taille, accessibilité, contexte), jamais la bibliothèque suggérée, ni la doc CLI (utilise React) — traduire systématiquement vers Lucide et du HTML/JS natif. Polices : Space Grotesk (titres), Plus Jakarta Sans (texte), JetBrains Mono (code).
- Couleurs : `#1F4590` bleu, `#1CA098` turquoise, `#FF570A` orange, via `app/css/tokens.css` uniquement.
- Scripts et tests : Node 20+, `node:test`, aucune dépendance npm sauf nécessité justifiée.

## Conventions de code

- Identifiants métier en français, alignés sur le schéma SQL (`demandes`, `reponses`, `rempli_par`, `nsp`…).
- `app/js/engine/` contient uniquement des fonctions pures, sans DOM ni Supabase, toutes testées.
- `app/js/services/` est le seul endroit qui appelle Supabase.
- Un composant par type de champ dans `app/js/components/fields/`, avec la même interface : `render(question, valeur, { onChange, lectureSeule })`.
- Les changements de statut passent **toujours** par `rpc_changer_statut`, jamais par un `update` direct.
- Aucune clé `service_role` dans le dépôt. Seule la clé publique figure dans `app/js/config.js`. La clé `service_role` n'existe que comme secret de l'Edge Function `creer-compte`, jamais côté client.

## Règles de rédaction de l'interface

- Français, vouvoiement, phrases courtes.
- **Aucun tiret cadratin (caractère Unicode U+2014)** dans les textes, commentaires ou documents générés.
- Les termes suivis de `\*` sont rendus en infobulle selon `01_ARCHITECTURE.md` section 9.
- Mobile d'abord ; cibles tactiles de 44 px minimum ; accessibilité RGAA niveau AA.

## Façon de travailler

1. Avancer **lot par lot** (section 14 de l'architecture). Ne pas démarrer un lot tant que les critères d'acceptation du précédent ne sont pas atteints.
2. Au début de chaque lot : présenter le plan des fichiers créés ou modifiés et attendre validation.
3. À la fin de chaque lot : lancer `node --test tests/`, lister ce qui est fait, ce qui reste, et les écarts éventuels par rapport à l'architecture.
4. En cas d'ambiguïté dans les `.md`, poser la question plutôt que d'inventer une règle.
5. Préférer une reconstruction propre d'un fichier à une succession de correctifs quand la qualité est insuffisante.

## Commandes

```bash
node scripts/parse-questionnaire.mjs   # docs/02 → data/questionnaire.json
node scripts/parse-glossaire.mjs       # docs/03 → data/glossaire.json
node scripts/check-coherence.mjs       # doit afficher 0 erreur
node scripts/build-seed.mjs v1         # → supabase/seed/seed_v1.sql
node --test tests/                     # tests des moteurs
npx serve app                          # serveur local de développement
```

## Définition de « terminé »

- Tests verts, `check-coherence` à 0 erreur.
- Aucune erreur console sur les parcours client et consultant.
- Politiques RLS vérifiées avec un compte client et un compte consultant.
- Affichage correct à 375 px et 1440 px de large.
- Aucun tiret cadratin dans le diff.
