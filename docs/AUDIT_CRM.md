# Audit du CRM RD Recueil (étape 1 du cahier des charges de refonte)

Date : 3 octobre 2026. Document produit à partir de `docs/new_design.md` (étape 1 « Auditer le projet »). Cet audit décrit l'état **avant** la refonte (il est en lecture seule) ; l'avancement des phases est suivi dans `docs/changes.md`, section 3h. Le schéma de la base est dans `docs/SUPABASE_SCHEMA.md` (étape 2).

## 1. Résumé

- L'application respecte déjà la stack imposée : HTML, CSS, JavaScript natif en modules ES, Supabase, Lucide. Ni framework, ni Tailwind, ni Bootstrap, ni TypeScript. Node ne sert qu'aux tests et aux scripts, pas à l'exécution.
- Elle est **déjà bien avancée** sur plusieurs points du cahier des charges (menu latéral repliable, recherche globale, timeline, calendrier, toasts, séparation `engine` / `services` / `views`, 224 tests). La refonte n'a donc pas à tout reconstruire : elle doit **mutualiser** (tableaux, états vides, squelettes) et **ajouter** ce qui manque (Command Menu, drawer, filtres et vues enregistrés, kanban, fil d'Ariane).
- Le cahier des charges suppose une application à pages HTML multiples (`pages/*.html`, `modules/`). Ce n'est pas la structure actuelle : l'application est une **page unique à routage par hash** (publiée sur GitHub Pages). Je propose de la garder (section 6).
- Trois points demandent une décision avant de refondre (section 9) : le périmètre « formation » (tables du LMS, autre projet), la sécurité de ces tables, et la portée du glisser-déposer du kanban.

## 2. Frontend : inventaire

| Élément | Constat |
|---|---|
| HTML | `app/index.html` (coquille unique) ; `app/mail.html` est un essai d'e-mail sans rapport. |
| Routage | `app/js/router.js`, par hash (`#/...`), 41 routes déclarées dans `app/js/main.js` (client, consultant, admin). |
| JavaScript | environ 16 800 lignes : `engine/` 26 fichiers (2 978 lignes, fonctions pures testées), `services/` 29 (1 635, seuls à parler à Supabase), `components/` 34 + `components/fields/` 19 (4 418), `views/client/` 15 (2 111), `views/consultant/` 24 (4 978), racine 7 (692). |
| CSS | 2 194 lignes, 82 Ko : `tokens.css` (35), `base.css` (47), `components.css` (1 166), `dashboard.css` (758, qui reçoit tous les styles des lots CRM), `login.css`, `print.css`. Thème clair et sombre par variables. |
| Composants réutilisables | `modale-crm` (fenêtres de formulaire), `champs-crm` (champ, liste, zone de texte, case), `toast`, `recherche-globale`, `calendrier`, `liste-navigation`, `ligne-tache`, `liste-journal`, `liste-reclamations`, cartes de la vue 360 (`carte-*`), `entete` (menu latéral et barre du haut), `dashboard-ui` (bandeau, indicateurs, étapes). |
| Pages principales | Client : accueil, mes demandes, demande (sections, récapitulatif, note, proposition, créneaux), documents, rapport, glossaire, charte RGPD, signaler un problème. Personnel : tableau de bord, clients (liste, fiche à 8 onglets, doublons, dormants), demandes (liste, vue 360, entretien, note, proposition), tâches, réclamations, indicateurs. Admin : comptes, import Shine, journal d'audit, données à revoir. |
| Modales | `<dialog>` natifs : `modale-crm`, visionneuse de documents, signature, ajout rapide d'un contact. |
| Scripts Supabase | uniquement dans `services/` (plus `auth.js` et `config.js`). Aucun appel Supabase dans les vues ni dans le HTML. |
| Bibliothèques externes | Lucide (CDN, **version non figée** : `lucide@latest`), `marked` et `dompurify` (CDN, version majeure figée), polices Google (Space Grotesk, Plus Jakarta Sans, JetBrains Mono). |

## 3. Supabase

Voir `docs/SUPABASE_SCHEMA.md` : 39 tables (toutes en RLS), 3 vues, 43 fonctions, 1 bucket privé, 14 tables sans règle de restriction (tables du LMS).

## 4. Fonctionnalités existantes par rapport au cahier des charges

Légende : ✅ fonctionnel, 🟡 partiel, 🔴 cassé, ⚪ absent. Aucun point 🔴 constaté.

| Fonction demandée | État | Constat |
|---|---|---|
| Menu latéral moderne, repliable | ✅ | Repliable (mémorisé), tiroir sur mobile, aperçu de rôle pour l'admin. Pas de sections nommées ni de favoris ni d'espace de travail. |
| En-tête (fil d'Ariane, recherche, création rapide, notifications, profil) | 🟡 | Titre de page, recherche, notifications, thème. Pas de fil d'Ariane ni de création rapide ; le profil est dans le menu latéral. |
| Recherche globale | ✅ | Clients, contacts, demandes, factures (admin), groupée, clavier, droits respectés. |
| Command Menu `Ctrl+K` | ⚪ | La recherche répond à `/`, pas de menu de commandes. |
| Tableaux | 🟡 | Environ neuf tableaux faits à la main (`db-table`) : pas de composant commun, pas de tri par colonne, pas de pagination, pas de sélection multiple, colonnes fixes. |
| Filtres | 🟡 | Filtres simples par écran (statut, gravité, période, recherche). Pas de constructeur de filtres. |
| Vues enregistrées | ⚪ | Aucune table. |
| Drawer latéral | ⚪ | Seulement des fenêtres modales. |
| Fiches (record pages) | 🟡 | Fiche client à onglets et vue 360 d'une demande : bien, mais écrites une par une, pas de structure générique. |
| Timeline d'activité | ✅ | Échanges et étapes d'un client, journal d'audit, historique de la demande. |
| Kanban | ⚪ | Le pipeline du tableau de bord est en lecture seule, sans glisser-déposer. |
| Calendrier | ✅ | Calendrier du mois (étapes et tâches), sans dépendance. |
| Squelettes de chargement | ⚪ | 43 textes « Chargement… » à la place. |
| États vides | 🟡 | 17 messages simples, sans bouton d'action. |
| Toasts | ✅ | `toast.js` (succès, erreur, information). Pas de type « avertissement ». Aucun `alert()` ; 12 `window.confirm` pour les suppressions. |
| Formulaires | 🟡 | `champs-crm` cohérent, validation dans `engine/` (bonne pratique). Pas de liste à recherche (combobox). |
| Modules par domaine | ✅ | `services/` + `engine/` : déjà la séparation demandée, avec 224 tests. |
| Raccourcis clavier | 🟡 | `/`, `Échap`, flèches dans la recherche. Pas de `Ctrl+K`. |
| Responsive | 🟡 | Tiroir mobile, tableaux défilants. Cinq largeurs de rupture différentes (480, 640, 768, 800, 900). |
| Jetons de design, polices, icônes | ✅ | `tokens.css` clair et sombre, polices demandées, Lucide seul. |
| Pagination, colonnes ciblées | 🟡 | Les listes se chargent en entier (la recherche par pages de 1 000) ; 21 `select('*')`. |

## 5. Risques et dette technique

1. **Code dupliqué** : `formaterDate` défini dans 12 fichiers, `mini` (carte de chiffre) dans 5, des fonctions `tableau` et `bouton` dans 2 chacun. À mutualiser avant tout nouveau composant. *(Corrigé en phase 1, sauf quatre `formaterDate` aux formats différents.)*
2. **CSS** : `dashboard.css` grossit à chaque lot (préfixes `cl-`, `db-`, `fi-`, `rc-`, `cs-`, `sa-`, `jr-`, `dbl-`) ; rien n'empêche les doublons de règles. Largeurs de rupture hétérogènes.
3. **Chargements complets** : la liste des clients, la recherche et plusieurs tableaux de bord chargent tout. Acceptable à 4 clients, pas à plusieurs milliers. La vue `v_clients` calcule des sous-requêtes pour chaque client.
4. **Requêtes répétées** : le tableau de bord du personnel charge les clients pour trois blocs ; la recherche a un cache d'une minute, pas les autres écrans.
5. **Lucide en `@latest`** : une mise à jour de la bibliothèque peut changer ou retirer des icônes sans prévenir. *(Corrigé en phase 1 : version 1.50.0 figée.)*
6. **`innerHTML`** : 221 usages ; 7 avec des valeurs insérées. Les noms venant de la base sont échappés (`echapperHtml`) ; les autres cas insèrent des constantes du code. Pas de faille constatée, mais à surveiller pour toute nouvelle vue.
7. **Événements** : aucun `onclick=""` (conforme). Quelques écouteurs globaux uniques (raccourci `/`, clic extérieur des notifications).
8. **Sécurité de la base** : voir la section 7.
9. **Tests de l'interface** : les 224 tests couvrent les calculs, pas l'affichage. Une refonte visuelle n'a aucun filet automatique : il faudra des captures avant et après.

## 6. Écarts entre le cahier des charges et le projet, et structure cible proposée

| Cahier des charges | Projet | Proposition |
|---|---|---|
| `pages/*.html`, `modules/<nom>/` | Page unique, `views/` + `services/` + `engine/` + `components/` | **Garder l'existant** (le document dit lui-même d'adapter à l'existant). Ajouter seulement des composants dans `components/` et des feuilles de style découpées. |
| Entreprises | `clients` | Déjà le module de référence. |
| Prospects | `clients` avec statut `prospect` | Pas de table à part (décision du lot A). |
| Opportunités | `demandes` (pipeline en 5 étapes, montants, probabilités) | Pas de table à part (décision du lot C). Le kanban porterait sur les demandes. |
| Formations, sessions, stagiaires | Tables `sessions`, `stagiaires`, `groupes`... qui appartiennent au **LMS** (autre projet qui partage la base) | **Hors périmètre** tant que vous n'en décidez pas autrement. |
| Devis, factures, relances | `propositions` (devis), `factures` (références Shine), tâches de relance | Déjà couverts. |
| Activités | `activites`, `taches`, `evenements`, `audit_log` | Déjà couverts. |
| Statuts métier à ne pas inventer | 14 statuts de demande dans `engine/statuts.js` ; statuts client prospect, client, archivé | À réutiliser tels quels. |

Structure cible : l'arborescence actuelle plus, dans `app/css/`, les fichiers `layout.css`, `tables.css`, `forms.css`, `modales.css`, `command-menu.css` issus du découpage de `components.css` et `dashboard.css` ; dans `app/js/components/`, `table.js`, `squelette.js`, `etat-vide.js`, `tiroir.js`, `menu-commandes.js`, `filtres.js`, `kanban.js`, `fil-ariane.js`.

## 7. Sécurité

À traiter indépendamment du design :

- **14 tables sans restriction** (politique « vrai pour tous ») : `documents_generes`, `examens_blancs`, `groupes`, `inscriptions_session`, `jurys`, `jurys_sessions`, `profils_utilisateurs`, `sessions`, `stagiaires` (42 colonnes de données personnelles), `titres`, `wall_ideas`, `wall_sessions`, plus `glossaire` et `questionnaires` (lecture publique voulue). Tables du LMS : à vérifier si un compte client de ce CRM peut les lire. C'est le point le plus important du constat et il est déjà signalé dans `docs/changes.md`.
- Alertes de l'audit Supabase d'avant le CRM, non corrigées : `get_my_role` et `update_updated_at_column` sans `search_path` fixe ; `est_staff`, `get_my_role`, `handle_new_user`, `rls_auto_enable` appelables sans connexion ; protection contre les mots de passe compromis désactivée.
- Conforme : clé de service jamais côté navigateur, RLS activée sur les 39 tables, droits du CRM par `peut_voir_client` et `peut_voir_demande`, journal d'audit en ajout seul.

## 8. Incohérences d'interface relevées

- Les tableaux n'ont pas tous les mêmes en-têtes, marges ni comportements au défilement horizontal.
- Boutons et pastilles : deux familles de classes (`btn` dans `components.css`, `db-btn` dans `dashboard.css`) pour des rôles proches.
- Les messages de chargement, de vide et d'erreur diffèrent d'un écran à l'autre.
- Les confirmations de suppression passent par `window.confirm` (boîte du navigateur), alors que les autres fenêtres sont des `<dialog>` à la charte.
- Largeurs de rupture et espacements non uniformes (voir le point 2 des risques).

## 9. Décisions à prendre avant la refonte

1. **Périmètre formation** : confirmez que formations, sessions et stagiaires (LMS) restent hors de cette refonte.
2. **Sécurité des tables du LMS** : à corriger avant d'ajouter de l'interface (recommandé), ou séparément.
3. **Kanban** : le glisser-déposer des demandes ne pourrait autoriser que les passages que le flux de travail permet déjà (`rpc_changer_statut`). Cela vous convient-il ?
4. **Ambition visuelle** : le document demande surtout des **comportements** (Ctrl+K, drawer, vues, kanban) tout en gardant l'identité RD. Je ne changerais donc ni les couleurs ni les polices. Est-ce bien l'intention ?

## 10. Plan proposé

Une phase à la fois, avec les tests et des captures avant et après, sans casser l'existant.

| Phase | Contenu | Risque |
|---|---|---|
| 1 | **Socle commun, sans changement visuel** : découper les feuilles de style ; extraire en un seul module les fonctions dupliquées (`formaterDate`, `mini`, boutons) ; composants `squelette` et `etat-vide` (avec bouton d'action) appliqués à la liste des clients ; figer la version de Lucide. | Faible |
| 2 | Composant **table** (tri, pagination, colonnes, sélection) appliqué aux clients, puis aux réclamations et aux demandes. | Moyen |
| 3 | **Menu de commandes** `Ctrl+K` (créer, chercher, aller à) en réutilisant la recherche globale. | Faible |
| 4 | **Fil d'Ariane** et création rapide dans l'en-tête. | Faible |
| 5 | **Tiroir** (aperçu d'un client depuis la liste). | Moyen |
| 6 | **Filtres** avancés et **vues enregistrées** (une table par utilisateur, avec RLS). | Moyen |
| 7 | **Kanban** des demandes (selon la décision 3). | Moyen |
| 8 | Responsive, accessibilité, performance (pagination côté base), audit final. | Moyen |

Je propose de commencer par la phase 1 après vos réponses aux quatre décisions.
