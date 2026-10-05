# changes.md : journal de la transformation CRM

Fichier de suivi à relire au début de chaque session. Il dit où l'on en est, ce qui a été décidé, ce qui a été fait (avec les preuves) et ce qui reste ouvert. Mettre à jour à la fin de chaque étape. Le fichier d'analyse de départ est `app/crm_app.md` (voir "Points ouverts" pour son emplacement).

Projet Supabase de Recueil : `kowvfsesbuevylxayinl`. Le LMS est un autre projet (`iomzcbmyzjwtswrkvxqk`), sans lien de clé étrangère.

## 1. Principes retenus (analyse de crm_app.md)

- La demande reste l'objet central. Le CRM s'ajoute autour : fiche client, contacts, puis activités, tâches, montants.
- On étend l'existant plutôt que de créer 25 tables : `clients` est enrichie (pas de table `crm_entreprises`), pas de préfixe `crm_`.
- Pas de table `opportunites` pour l'instant : probabilité, date de signature estimée et motif de perte iront sur `demandes` (lot C), le montant se calcule depuis `proposition_lignes`.
- Prospect = client avec `statut = 'prospect'`. Clients dormants = vue calculée (lot E). Source en colonne texte, validée dans le code. Rôles d'un contact en `text[]`.
- Les données TC-1 (identité) et TC-2 (interlocuteurs) du questionnaire alimentent la fiche par un bouton d'import, jamais automatiquement et sans écraser une saisie manuelle.
- Tout le CRM est réservé au staff (RLS `est_staff()`). Un client ne voit jamais sa fiche interne, ses notes ni les montants pondérés.
- LMS : rien à construire pour l'instant. Plus tard, une demande gagnée pour une formation de salariés créera la demande côté LMS (Edge Function) et on gardera l'identifiant sur la demande.
- Facturation : Shine reste l'outil de devis et factures (son API est bancaire PSD2, réservée aux prestataires agréés, donc inutilisable ici). Le CRM ne stockera que des références (numéro, montant, payée ou non), saisies ou importées en CSV (lot D).

## 2. Feuille de route

| Lot | Contenu | État |
|---|---|---|
| A | Fiche client et contacts | terminé et commité (`db4b088`, non poussé) ; reste un essai avec un vrai compte |
| B | Activités, tâches, bloc "Aujourd'hui", relances dans le calendrier | terminé et commité ; reste un essai avec un vrai compte |
| C | Montants, CA pondéré, pipeline en euros, KPI financiers | terminé et commité ; reste un essai avec un vrai compte |
| Accès | Cloisonnement par consultant (avant le lot D, voir 3d) | terminé et commité ; reste un essai avec un vrai compte |
| D | Financements, références de factures (Shine) | terminé et commité (voir 3e) |
| E | Recherche globale, fusion de doublons, clients dormants | terminé, commité et poussé (voir 3f) |
| F | Satisfaction, réclamations, consentement des contacts, journal d'audit | terminé et commité (voir 3g) |
| Design | Refonte de l'interface inspirée de Twenty (comportements et allure), sans toucher aux données | en cours (voir 3h) |

## 3. Lot A : fiche client et contacts

### Décisions de l'utilisateur
1. Nettoyage : supprimer RDFORMATION (fait). Garder ANATOLCONSEIL ; comme il avait le même SIRET qu'ANATOL FORMATION, fusion choisie : la demande RDF-2026-0006 est rattachée à ANATOLCONSEIL et ANATOL FORMATION est supprimé (fait).
2. Import des interlocuteurs de la demande : par bouton.
3. Statut au départ : `client` pour tout client existant, `prospect` seulement via le nouveau bouton.

### Écrans prévus
| Route | Contenu |
|---|---|
| `#/clients` | Liste : recherche, filtre de statut (archivés masqués), contact principal, nombre de demandes, dernière activité, export CSV, bouton "Nouveau client ou prospect" |
| `#/clients/nouveau` | Même formulaire que la fiche, pré-rempli par la recherche SIRET existante (`services/entreprises.js`) |
| `#/clients/:id` | En-tête, 3 indicateurs, informations modifiables, notes internes, dernières étapes de ses demandes, bandeau d'import depuis la demande |
| `#/clients/:id/contacts` | Cartes, rôles multiples, contact principal, badge "compte actif" (e-mail identique à un profil client), import des interlocuteurs TC-2 |
| `#/clients/:id/demandes` | Demandes du client, bouton "Nouvelle demande" |
| `#/clients/:id/documents` | Documents de toutes ses demandes |
| `#/demandes/nouvelle/:clientId` | Création de demande avec client présélectionné (le routeur ne gère pas les paramètres d'adresse) |

### Fichiers prévus
- Nouveaux : `supabase/migrations/0030_fiche_client.sql`, `0031` (index SIRET), `app/js/engine/fiche-client.js` et `tests/fiche-client.test.mjs`, `app/js/views/consultant/clients.js`, `app/js/views/consultant/client-fiche.js`.
- Modifiés : `services/clients.js`, `main.js` (routes), `components/entete.js` (menu "Clients" et titres de page), `views/consultant/creation.js` (client présélectionné, alerte SIRET existant), `views/consultant/vue-360.js` (lien vers la fiche), `css/dashboard.css`, `docs/01_ARCHITECTURE.md`.
- `creerClient` doit réutiliser le client existant quand le SIRET est déjà connu (supprime les doublons à la source).
- Suppression d'un client : admin uniquement, seulement s'il n'a aucune demande (sinon la base refuse).

### Étapes
- [x] 1. Migration, nettoyage, vérification des droits
- [x] 1b. Index unique sur le SIRET (migration 0031, après fusion du doublon ANATOL)
- [x] 2. Logique testée `engine/fiche-client.js` (extraction TC-1 et TC-2 avec libellés lisibles, fusion sans écrasement, dédoublonnage des contacts par e-mail, normalisation du SIRET)
- [x] 3. Service et liste `#/clients`
- [x] 4. Fiche et modification
- [x] 5. Onglet Contacts avec import
- [x] 6. Onglets Demandes et Documents, puis liens avec le reste de l'application
- [x] 7. Documentation, tests, cohérence, vérification à 375 et 1440 px

### Hors lot A
Journal d'activité, tâches, montants, recherche globale, fusion de doublons, consentement des contacts.

## 3b. Lot B : activités et tâches

### Décisions de l'utilisateur
1. Pas de page "Aujourd'hui" séparée : un bloc "Aujourd'hui" sur le tableau de bord consultant plus une page `#/taches`.
2. **Visibilité** : un consultant ne voit et ne gère que les tâches qui lui sont assignées ; l'admin voit tout et désigne le responsable de chaque tâche. (Les échanges notés restent lisibles par tout le staff.)
3. Pas de priorité sur les tâches, tri par échéance (une date, sans heure).
4. Dans la vue 360, "Noter une relance" (commentaire interne "Relance à faire") devient la création d'une vraie tâche de relance (échéance par défaut : 3 jours).
5. Rappels automatiques (`pg_cron`, e-mail quotidien) : on décidera après le lot B.

### Modèle
- `activites` : client, contact et demande facultatifs, auteur, type (note, appel, email, rendez_vous, autre), objet, description, date. Lecture et écriture pour tout le staff.
- `taches` : client, contact et demande facultatifs, assignee_id, created_by, titre, description, type (appel, email, relance, rendez_vous, autre), echeance (date), statut (a_faire, terminee, annulee), terminee_le et terminee_par (tenus par un trigger). Droits : l'admin tout ; un consultant lit, crée (pour lui seul), modifie et supprime uniquement ses tâches, et ne peut pas les réassigner.
- Notification interne au responsable quand quelqu'un d'autre lui confie une tâche (création ou changement de responsable) ; `notifications.lien` permet de mener à `/clients/:id/activite` ; `reference` porte alors le nom du client.
- `v_clients` : ajout de `nb_taches_ouvertes` et `prochaine_echeance` (selon les droits de l'appelant) ; `derniere_activite` tient compte des échanges notés.
- Les tâches sont internes : elles n'apparaissent jamais dans le calendrier ni dans les données du client.
- Droits des échanges (0035) : tout le staff lit et crée ; seuls l'auteur ou l'admin modifient ou suppriment un échange.

### Écrans prévus
- Fiche client, nouvel onglet "Activité" (`#/clients/:id/activite`) : boutons "Noter un échange" et "Nouvelle tâche", tâches ouvertes à cocher, historique qui mêle échanges et étapes des demandes ; un échange peut créer la tâche de suivi dans le même geste.
- `#/taches` : tâches avec filtre "Mes tâches" par défaut (l'admin peut voir l'équipe), statut et client ; Terminer, Reporter, accès à la fiche.
- Tableau de bord consultant : bloc "Aujourd'hui" (en retard, du jour, de la semaine) et calendrier des échéances (jours cliquables).
- Vue 360 : "Créer une tâche de relance".

### Étapes
- [x] B1. Migrations et droits, vérifiés en base
- [x] B2. Logique testée `engine/taches.js`
- [x] B3. Services `services/activites.js` et `services/taches.js`
- [x] B4. Onglet Activité de la fiche
- [x] B5. Page tâches, bloc "Aujourd'hui" et calendrier
- [x] B6. Vue 360 (relance en tâche) et notifications avec lien
- [x] B7. Documentation, tests, cohérence, vérifications, commit

### Hors lot B
Rappels automatiques, tâches créées automatiquement à chaque changement de statut, priorités, heure d'échéance, tâches récurrentes.

## 3c. Lot C : montants et pipeline en euros

### Décisions de l'utilisateur (les quatre points validés)
1. Un **montant estimé** saisi à la main avant la proposition (sinon le pipeline en euros resterait vide jusqu'à la proposition).
2. **Probabilités par défaut** par statut : brouillon 5, envoyée 10, en saisie 15, soumise 25, entretien planifié 35, en analyse 45, note de cadrage envoyée 55, note à revoir 50, note validée 65, proposition envoyée 75, gagnée 100, perdue, réorientée, abandonnée 0 (en %). Modifiables par l'admin (SQL pour l'instant).
3. **Visibilité** : les chiffres agrégés (tableau de bord, page Indicateurs, colonnes de la fiche et de la liste des clients) sont réservés à l'admin ; le consultant voit les montants d'une demande et de sa proposition, comme aujourd'hui. Limite connue : protection dans l'affichage seulement, les lignes des propositions étant déjà lisibles par tout le staff (la vue `v_demandes_montants` et les colonnes ajoutées à `v_clients` sont, elles, filtrées pour le staff).
4. **Date du CA signé** : la date où le client accepte la proposition (`propositions.decidee_le`) ; la date de facturation viendra avec le lot D.

### Modèle
- Tout en HT (franchise de TVA, art. 293 B du CGI).
- `probabilites_statut` : probabilité par défaut de chaque statut ; lecture staff, modification admin seulement.
- `demande_enjeux` (staff seulement) : `montant_estime` et `probabilite` propres à la demande. Table à part et non colonnes de `demandes` : un client lit ses demandes ligne par ligne et aurait vu ces colonnes internes.
- `v_demandes_montants` (staff seulement) : `montant_propose` (total de la proposition), `montant_retenu` (proposition si chiffrée, sinon estimation, sinon 0), `source_montant` (proposition, estimation ou aucun), `probabilite` effective (100 pour gagnée, 0 pour perdue, réorientée ou abandonnée, sinon celle de la demande, sinon celle du statut), `montant_pondere`, `date_decision`.
- `v_clients` : ajout de `ca_signe` et `pipeline_pondere`.

### Écrans prévus
- Vue 360 : carte "Enjeu commercial" (estimation et probabilité modifiables, montant retenu et sa source, pondéré).
- Tableau de bord admin : ligne d'indicateurs financiers (pipeline, CA pondéré, CA signé de l'année, taux de conversion en euros) et total en euros par colonne du pipeline, montant par demande.
- Page Indicateurs (admin) : pipeline par étape et CA signé des douze derniers mois en tableau.
- Fiche client : "CA signé" et "En cours (pondéré)" (admin) ; liste des clients : colonne "CA signé" (admin) et dans le CSV ; liste des demandes : colonne "Montant HT" dans le CSV.

### Étapes
- [x] C1. Migration et droits, vérifiés en base
- [x] C2. Logique testée `engine/finance.js`
- [x] C3. Services
- [x] C4. Vue 360 : carte "Enjeu commercial"
- [x] C5. Tableau de bord et page Indicateurs
- [x] C6. Fiche client, liste des clients et exports
- [x] C7. Documentation, tests, cohérence, vérifications, commit

### Hors lot C
Date de signature estimée et prévision mensuelle, motif de perte structuré (la raison existe déjà en texte libre), objectifs de chiffre d'affaires, remises, acomptes et factures (lot D), TVA, écran d'administration des probabilités.

## 3d. Lot Accès : cloisonnement par consultant

Origine : en répondant au plan du lot D, l'utilisateur a rappelé que "chaque consultant voit ses demandes, seulement l'admin a une vue sur toutes les demandes". Ce n'était pas appliqué : les 28 politiques de 20 tables s'appuyaient sur `est_staff()` (tout le personnel voit tout). Option A choisie : ce lot d'abord, le lot D ensuite, construit dessus.

### Règle et décisions validées (les cinq points)
- Un consultant voit uniquement ses demandes (`demandes.consultant_id`) et les clients dont il est responsable (`clients.responsable_id`) ou qui ont l'une de ses demandes. L'admin voit tout. Le client ne change pas (`a_acces`).
- Une tâche confiée par l'admin sur un client que le consultant ne voit pas : le consultant voit la tâche, pas la fiche du client (l'admin lui confie le client s'il en a besoin).
- Notifications du personnel : l'admin et le consultant de la demande seulement (plus tous).
- Changer le consultant d'une demande ou le responsable d'un client : réservé à l'admin.
- SIRET déjà suivi par un autre consultant : message sans nom ("déjà suivi, contactez l'administrateur").

### Technique
- Fonctions `peut_voir_demande(id)` et `peut_voir_client(id)` (security definer) pour les tables enfants ; `demandes` et `clients` portent leur règle directement, pour qu'une ligne tout juste insérée reste visible dans le RETURNING.
- Triggers : seul l'admin change `consultant_id` ou `responsable_id` (sans effet pour le SQL direct et les Edge Functions, où `auth.uid()` est nul) ; un consultant qui crée une demande ou un client en devient le titulaire d'office.

### Étapes
- [x] S1. Fonctions d'accès, politiques de toutes les tables, verrous d'assignation, matrice de tests en base
- [x] S2. Fonctions de la base (changement de statut, soumission, signature, archivage, calendrier `rpc_jalons`, notifications) : vérifications d'accès, fermeture de l'accès sans connexion
- [x] S3. Règles du dossier de fichiers (Storage)
- [x] S4. Application : création de client (SIRET), choix du consultant responsable (admin), messages d'accès refusé
- [x] S5. Liste des demandes : colonne et filtre "Consultant" (admin)
- [x] S6. Documentation, tests, audit de sécurité, commit

## 3e. Lot D : financements et factures (références Shine)

### Décisions validées
- Factures réservées à l'admin au niveau de la base. Financements visibles du consultant, pour ses demandes seulement.
- Plusieurs financements par demande (OPCO, région, entreprise...), avec un reste à charge calculé.
- Plusieurs factures par demande (acompte 50 % et solde, jusqu'à 4 paiements) : un libellé libre, une date de paiement par facture, un "reste à facturer" calculé.
- Import d'un export CSV Shine en dernière étape : aperçu avant application, idempotent par numéro de facture, aucune suppression. Il faut un export d'exemple dans `docs/exemples/` (non commité).
- Tout en HT (franchise de TVA).

### Étapes
- [x] D1. Tables `financements` et `factures`, droits, tests en base (migration 0044)
- [x] D2. Calculs purs et tests (reste à charge, reste à facturer, totaux)
- [x] D3. Carte "Financements" dans la vue 360
- [x] D4. Carte "Facturation" (admin)
- [x] D5. Indicateurs de facturation (admin) sur le tableau de bord
- [x] D6. Import CSV Shine, en deux temps : D6a lecteur de l'export et plan d'import ; D6b écran d'import (aperçu, choix de la demande, application)
- [x] D7. Documentation, tests, audit de sécurité, commit

## 3f. Lot E : recherche globale, fusion de doublons, clients dormants

### Décisions validées (les quatre points)
- **Dormant** : client (statut `client`) avec au moins une demande gagnée et aucune activité depuis 12 mois par défaut ; seuil choisi à l'écran (6, 9, 12, 18 ou 24 mois), sans réglage enregistré. Les prospects ne sont pas concernés. L'activité est celle de `v_clients.derniere_activite` (fiche, demandes, échanges ; les tâches n'y comptent pas). CA historique visible de l'admin seulement. Bouton "Créer une tâche de relance" (type `relance`).
- **Fusion (irréversible, admin seulement)** : l'admin choisit la fiche à garder ; demandes, contacts, échanges et tâches passent sur la fiche gardée ; les champs vides de la fiche gardée sont complétés par ceux de l'autre sans rien écraser ; notes concaténées avec un en-tête ; un prospect devient client si l'autre l'était ; résumé avant confirmation ; fusion inscrite dans l'historique de la fiche gardée.
- **Doublons détectés** : noms proches (accents, casse, formes juridiques ignorés) avec la même ville ou le même code postal ; deux clients ayant un contact de même e-mail. Le SIRET identique est déjà impossible (index unique). "Ignorer" est conservé en base.
- **Recherche** : clients (nom, SIRET, ville), contacts (nom, e-mail, téléphone), demandes (référence, client), factures par numéro pour l'admin. Pas d'e-mails, d'opportunités ni de propositions (ils n'existent pas comme objets séparés). Selon les droits de l'utilisateur (un consultant ne cherche que dans ses données).

### Étapes
- [x] E1. Base : `rpc_fusionner_clients`, table des couples ignorés, tests en base (migration 0045)
- [x] E2. Calculs purs et tests (doublons, dormants, recherche)
- [x] E3. Recherche globale (barre dans l'en-tête)
- [x] E4. Écran des doublons (admin) : comparer, fusionner, ignorer
- [x] E5. Clients dormants (filtre, bloc du tableau de bord, relance)
- [x] E6. Documentation, tests, audit de sécurité, commit

## 3g. Lot F : satisfaction, réclamations, consentements, journal d'audit

### Décisions validées (les quatre points)
- **Journal d'audit** : modifications seulement (créations, changements, suppressions) des tables du CRM, avec les colonnes changées (avant et après) et le compte à l'origine ; lecture réservée à l'admin ; ajout seul (ni modification ni effacement depuis l'application). Pas d'adresse IP ni de navigateur (un déclencheur de base ne les voit pas), pas de consultations. Il garde d'anciennes valeurs, coordonnées comprises : une demande d'effacement devra aussi le purger (point ouvert, rien d'automatique).
- **Consentements** : trois types (e-mail commercial, téléphone, lettre d'information) ; statut accordé, refusé ou retiré ; date, source, preuve en texte libre, expiration, date de retrait. Conservation : pas de table de règles ni de suppression automatique ; un écran admin "Données à revoir" liste les fiches sans activité depuis 3 ans (durée de la section 8.3 de l'architecture) et l'admin décide.
- **Réclamations** : saisies par le personnel sur une fiche client ou une demande ; gravité (mineure, majeure, critique), statut (ouverte, en cours, clôturée), responsable, action corrective obligatoire pour clôturer. Un consultant ne voit que celles de ses clients, l'admin voit tout. Le client n'en dépose pas lui-même.
- **Satisfaction** : deux moments ("à chaud", "à froid"), note de 1 à 5 et commentaire ; le consultant demande l'avis sur une demande terminée, le client répond depuis son espace ; notification dans l'application seulement (pas d'e-mail, la fonction d'e-mails et son gabarit étant en attente) ; saisie manuelle possible ; pas de relance automatique.

### Étapes
- [x] F1. Journal d'audit : table, déclencheurs, écran admin et onglet "Modifications" des fiches (migration 0046)
- [x] F2. Consentements des contacts et écran "Données à revoir" (migration 0047)
- [x] F3. Réclamations (migration 0048)
- [x] F4. Satisfaction (migration 0049)
- [x] F5. Indicateurs qualité et export CSV
- [x] F6. Documentation, tests, audit de sécurité, commit

## 3h. Refonte de l'interface (inspirée de Twenty)

Source : `docs/new_design.md` (cahier des charges, déplacé de `app/` vers `docs/` : `app/` est le dossier publié). Audit : `docs/AUDIT_CRM.md` et `docs/SUPABASE_SCHEMA.md`. Principe : s'inspirer des comportements et de l'allure de Twenty (jamais son code ni son identité), garder la stack, la base et l'identité RD (couleurs, polices), une phase à la fois sans casser l'existant.

### Décisions validées
- Garder l'application à page unique (routage par hash), pas de `pages/*.html` : le cahier des charges demande lui-même d'adapter à l'existant.
- Hors périmètre : formations, sessions, stagiaires (tables du LMS, autre projet). Prospects = clients au statut `prospect` ; opportunités = demandes ; devis = propositions.
- Sécurité des tables du LMS (politique "vrai pour tous") : à traiter avant d'ajouter de l'interface, ou à part (recommandé : avant).
- Kanban des demandes : le glisser-déposer n'autorise que les passages que le flux de travail permet déjà (`rpc_changer_statut`).
- **Allure** (réponse à "est-ce que cela donnera un look Twenty ?") : identité RD conservée (bleu, turquoise, orange, Space Grotesk, Plus Jakarta Sans) mais **sobriété et densité de Twenty** : menu latéral **clair et neutre** avec accents bleu RD (le thème sombre reste), tableaux **compacts** (texte de 14 px, lignes de 36 px, option "confortable"), pastilles de relation, panneau latéral. Un **prototype d'un seul écran** (liste des clients) sera montré avant de généraliser.

### Phases
- [x] 1. Socle commun, sans changement visuel
- [x] 1 bis. Prototype d'allure sur la liste des clients (tableau compact, pastilles, menu clair, tiroir) : fait, **à valider par l'utilisateur** avant de généraliser
- [x] 2. Composant tableau (tri, colonnes, sélection) : clients, demandes et comptes migrés ; pagination non faite (volumes faibles)
- [x] 3. Menu de commandes `Ctrl+K`
- [x] 4. Fil d'Ariane et création rapide dans l'en-tête
- [x] 5. Panneau latéral (aperçu d'un client et d'une demande depuis la liste)
- [x] 6. Filtres avancés et vues enregistrées (migration 0052, vues personnelles, clients et demandes)
- [x] 7. Kanban des demandes
- [x] 8. Responsive, accessibilité, performance, audit final (écrans refaits ; audit outillé et lecteur d'écran non faits)

## 4. Journal des étapes

### 2026-10-02 : lot A, étape 1 (migration 0030)

Fait :
- Suppression du client RDFORMATION (sans SIRET, sans demande, vérifié avant). Il reste 5 clients.
- Migration `0030_fiche_client.sql`, appliquée sur la base puis enregistrée dans `supabase/migrations/` :
  - `clients` enrichie : `nom_commercial, forme_juridique, code_naf, secteur, adresse, code_postal, ville, telephone, email_general, site_web, effectif, opco, source, statut` (`prospect`, `client`, `archive`, défaut `client`), `responsable_id`, `notes`, `updated_at` (trigger `fn_touch`).
  - Table `contacts` : `client_id` (cascade), `prenom, nom, fonction, email, telephone, roles text[], principal, actif, notes`. Index uniques : un e-mail par client (insensible à la casse), un seul contact principal par client.
  - Politique RLS `contacts_staff` (staff uniquement).
  - Vue `v_clients` (security_invoker) : nombre de demandes, actives, gagnées, dernière activité, contact principal. `revoke all` pour `anon`.

Vérifié (transactions annulées, aucune donnée de test restante) :
- Compte client : 0 ligne visible dans `clients`, `v_clients`, `contacts`, insertion impossible.
- Compte staff : `v_clients` renvoie 5 clients, insertion d'un contact acceptée, `nb_demandes` correct pour ACCENTEUR.
- Rôle `anon` : accès refusé à `v_clients`, 0 ligne dans `contacts`.
- Après tests : 0 contact, 5 clients, tous au statut `client`.

### 2026-10-02 : lot A, étape 1b (migration 0031)

Fait :
- Fusion du doublon : la demande RDF-2026-0006 passe d'ANATOL FORMATION à ANATOLCONSEIL (SIRET 82518678600018), puis ANATOL FORMATION est supprimé. Aucun fichier n'était rattaché à cette demande, donc aucun chemin de Storage à corriger. Il reste 4 clients : Structure de démonstration, ANATOLCONSEIL, DEMO, ACCENTEUR.
- Migration `0031_siret_unique.sql` : index unique sur le SIRET sans espaces, uniquement pour les SIRET renseignés.

Vérifié (transaction annulée) : un SIRET déjà présent est refusé même écrit avec des espaces ; plusieurs clients sans SIRET restent possibles.

Pas de changement de code applicatif : tests et cohérence non relancés.

### 2026-10-02 : lot A, étape 2 (logique testée)

Fait :
- `app/js/engine/fiche-client.js` (fonctions pures) : constantes `STATUTS_CLIENT`, `SOURCES_CLIENT`, `ROLES_CONTACT` ; `normaliserSiret`, `estVide`, `nomComplet`, `libelleStatutClient`, `libelleRole` ; `extraireFicheClient(reponses, questions)` (TC-1 vers champs de la fiche avec libellés lisibles, TC-2.01 à 2.04 vers contacts avec rôles ; NSP, valeurs vides et "je ne sais pas" ignorés ; une même personne citée deux fois devient un contact à plusieurs rôles) ; `planImportFiche(fiche, extraction)` (champs vides seulement, liste des champs ignorés) ; `planImportContacts(existants, extraits)` (à créer, à enrichir, déjà identiques ; premier contact créé = principal si la fiche n'en a pas).
- Correspondance des rôles : TC-2.01 décideur, TC-2.02 opérationnel, TC-2.03 administratif et financeur, TC-2.04 référent handicap. Le nom d'un contact TC-2 est un champ unique, donc stocké dans `contacts.nom` (`prenom` reste vide).
- Le nom de l'entreprise (TC-1.01) n'est pas importé : le client a déjà sa raison sociale.
- `tests/fiche-client.test.mjs` : 8 tests.

Vérifié : `node --test tests/*.test.mjs` 105 réussis, 0 échec (97 avant) ; `check-coherence` 0 erreur ; aucun tiret cadratin dans les nouveaux fichiers.

Suite : étape 3 (service `services/clients.js` et liste `#/clients`), où l'on ajoutera aussi le filtre de recherche (fonction pure).

### 2026-10-02 : lot A, étape 3 (service et liste des clients)

Fait :
- `engine/fiche-client.js` : ajout de `filtrerClients(clients, { recherche, statut })` (recherche sans casse ni accents sur nom, nom commercial, ville, contact principal, e-mail ; SIRET avec ou sans espaces à partir de 3 chiffres ; archivés masqués sans filtre de statut). 2 tests de plus.
- `services/clients.js` : `trouverClientParSiret` (comparaison sans espaces), `creerClient` qui réutilise le client existant si le SIRET est connu (retourne `dejaExistant`, le SIRET est enregistré sans espaces), `listerClientsDetail` (vue `v_clients`). `listerClients` est inchangée.
- `views/consultant/clients.js` (nouveau) : page `#/clients` avec recherche en direct, filtre de statut, compteur, tableau (entreprise, SIRET, statut, ville, contact principal, demandes avec nombre en cours, dernière activité), export CSV des lignes affichées.
- `components/telechargement.js` (nouveau) : `telechargerCsv` sorti de `views/consultant/liste.js` pour être partagé ; `liste.js` l'importe.
- Route `/clients` (staff) dans `main.js`, entrée "Clients" (icône `building-2`) dans le menu du staff, titre de page "Clients".
- Styles `cl-*` ajoutés à la fin de `css/dashboard.css` (en-tête, filtres, pastille de statut, lien d'entreprise).

Vérifié : `node --test tests/*.test.mjs` 107 réussis, 0 échec ; `check-coherence` 0 erreur ; sur une page de test avec données simulées (supprimée ensuite) : 3 clients affichés sur 4 (l'archivé est masqué), recherche "anatol" et SIRET "825 186" trouvent ANATOLCONSEIL, filtre archivé et prospect corrects, message vide correct, aucune erreur console, à 375 px la page ne défile pas (seul le tableau défile), lien d'entreprise lisible en thème sombre. Non testé avec la vraie base et un vrai compte.

À noter : le lien de chaque entreprise pointe vers `#/clients/:id`, route qui n'existe qu'à l'étape 4 ; ne pas déployer avant.

### 2026-10-02 : lot A, étape 4 (fiche client et création)

Fait :
- Migration `0032_clients_suppression_admin.sql` (appliquée) : la politique `clients_staff` (for all) est remplacée par lecture, création et modification pour le staff, et suppression pour l'admin seulement.
- `engine/fiche-client.js` : `CHAMPS_FICHE` (champs et groupes d'affichage), `FORMES_JURIDIQUES`, `EFFECTIFS`, `OPCOS` (suggestions de saisie, test de concordance avec `data/questionnaire.json`), `ficheDepuisSirene` (données SIRENE vers champs de la fiche), `preparerFiche` (espaces retirés, vides en null, SIRET sans espaces), `validerFiche` (raison sociale obligatoire, SIRET de 14 chiffres, e-mail), `libelleChampFiche`, `QUESTIONS_IMPORT`.
- `services/clients.js` : `obtenirClient`, `enregistrerClient(id|null, champs)` (refuse un SIRET déjà porté par un autre client avec un message qui le nomme), `supprimerClient`, `listerDemandesClient`, `lireImportDisponible` (réponses TC-1 et TC-2 de la demande la plus récente qui en contient, plus le questionnaire pour les libellés), `listerResponsables`.
- `components/formulaire-client.js` (nouveau) : formulaire commun création et modification (identité, coordonnées, suivi : statut, source, responsable, notes internes), SIRET avec suggestions SIRENE qui pré-remplit seulement les champs vides, erreurs sous les champs.
- `views/consultant/client-fiche.js` (nouveau) : `#/clients/:id`, en-tête (statut, SIRET, ville ; Modifier, Archiver ou Désarchiver, Supprimer pour l'admin si aucune demande), bandeau d'import "La demande RDF-… complète cette fiche" (liste ce qui sera importé, jamais d'écrasement), 4 indicateurs, informations par groupe, notes internes, dernières étapes (issues de `rpc_jalons`, donc sans les retours manuels).
- `views/consultant/client-nouveau.js` (nouveau) : `#/clients/nouveau`, statut "prospect" par défaut.
- Routes `/clients/nouveau` et `/clients/:id` (staff) dans `main.js`, bouton "Nouveau client ou prospect" sur la liste, titres de page, styles `cl-*` dans `css/dashboard.css`.
- Pas encore de barre d'onglets : elle arrive avec l'étape 5 (Contacts) ; la fiche actuelle est l'onglet "Aperçu".

Vérifié : `node --test tests/*.test.mjs` 111 réussis, 0 échec ; `check-coherence` 0 erreur. Droits sur la base (transactions annulées) : un admin peut créer et supprimer un client, un consultant peut créer et modifier mais sa suppression touche 0 ligne, un client ne peut rien insérer. Sur une page de test avec données simulées (supprimée ensuite) : bandeau d'import correct (champs déjà renseignés ignorés), import appelle bien l'enregistrement avec les seuls champs manquants, erreurs de validation (raison sociale, e-mail, SIRET à 14 chiffres), SIRET en double signalé, soumission correcte (valeurs nettoyées, SIRET sans espaces), création avec statut prospect, aucune erreur console, 375 px sans défilement horizontal et cibles tactiles de 44 px. Non testé avec la vraie base et un vrai compte.

À noter : `Nouvelle demande` depuis la fiche et les onglets Contacts, Demandes, Documents arrivent aux étapes 5 et 6.

### 2026-10-02 : lot A, étape 5 (onglet Contacts)

Fait :
- `engine/fiche-client.js` : `preparerContact` (nettoyage, e-mail en minuscules, rôles limités aux rôles connus), `validerContact` (nom obligatoire, e-mail valide) ; `planImportContacts` donne à un contact sans nom son e-mail comme nom (la colonne `nom` est obligatoire).
- `services/clients.js` : `listerContacts`, `enregistrerContact` (retire d'abord le principal des autres si besoin, message clair sur l'e-mail en double), `definirContactPrincipal`, `supprimerContact`, `importerContacts` (créations puis enrichissements), `emailsAvecCompte` (e-mails qui correspondent à un profil client).
- `views/consultant/client-contacts.js` (nouveau) : onglet Contacts avec cartes (nom, fonction, e-mail et téléphone cliquables, rôles, badges Principal, Compte actif, Inactif), formulaire d'ajout et de modification (rôles multiples, principal, actif, notes), "Définir comme principal", suppression avec confirmation, bandeau "La demande RDF-… cite des interlocuteurs" avec la liste de ce qui sera créé ou complété et un bouton d'import.
- `views/consultant/client-fiche.js` : barre d'onglets Aperçu et Contacts, paramètre d'onglet, bouton Modifier masqué hors de l'Aperçu, "Contact principal" ajouté aux informations. Route `/clients/:id/:onglet` dans `main.js`. Styles `cl-*` ajoutés.

Vérifié : `node --test tests/*.test.mjs` 114 réussis, 0 échec ; `check-coherence` 0 erreur. Base (transactions annulées, aucune donnée restante) : un deuxième contact principal est refusé, un e-mail en double est refusé même avec une casse différente, la bascule du principal laisse exactement un principal, `v_clients.contact_principal` suit. Page de test avec données simulées (supprimée ensuite) : cartes et badges corrects, bandeau d'import (1 à créer, 1 à compléter, 1 déjà à jour) puis disparition après import, validation du nom et de l'e-mail, doublon signalé, ajout avec rôles et principal, bascule du principal, modification d'un contact inactif, suppression, aucune erreur console, 375 px sans défilement horizontal ni cible tactile sous 40 px. Non testé avec la vraie base et un vrai compte.

Incident de test sans conséquence : une première transaction de test contenait par erreur un `delete` sur ACCENTEUR ; la clé étrangère l'a refusé et toute la transaction a été annulée (4 clients, 0 contact vérifiés ensuite).

### 2026-10-02 : lot A, étape 6 (onglets Demandes et Documents, liens)

Fait :
- `views/consultant/client-demandes.js` (nouveau) : onglet Demandes (tableau : référence cliquable avec mention "Archivée", statut, types, date limite, date de création ; bouton "Nouvelle demande") et onglet Documents (documents partagés avec le client, par demande : note de cadrage, proposition, pièces déposées ; brouillons exclus, comme côté client).
- `components/documents-demande.js` (nouveau) : `construireLignesDemande` sorti de `views/client/documents.js` pour être partagé ; paramètre `lireReponses` (le staff passe `chargerReponsesStaff`). `views/client/documents.js` l'importe, comportement inchangé.
- `engine/statuts.js` : `LIBELLES_TYPE` (FOR, PON, MOD, ING, CER).
- Fiche client : onglets Aperçu, Contacts, Demandes, Documents ; bouton "Nouvelle demande" dans l'en-tête, vers `#/demandes/nouvelle/:clientId`.
- Route `/demandes/nouvelle/:clientId` (staff) ; `creation.js` : client présélectionné et lien de retour vers la fiche ; quand un SIRET saisi (14 chiffres, à la sortie du champ) correspond à un client existant, ce client est sélectionné d'office avec un message (le champ SIRET et la raison sociale se masquent, comme pour tout client existant).
- `views/consultant/vue-360.js` : bouton "Fiche client" dans les actions rapides de la demande.

Vérifié : `node --test tests/*.test.mjs` 114 réussis, 0 échec ; `check-coherence` 0 erreur. Page de test avec services simulés (supprimée ensuite) : 4 onglets et liens corrects, tableau des demandes (statuts, types, archivée), documents (note, pièce déposée) pour une fiche, espace client "Mes documents" toujours correct après le déplacement du code, création avec client présélectionné et retour vers la fiche, sélection automatique d'un SIRET connu (pas pour un SIRET inconnu), 375 px sans défilement horizontal ni cible sous 40 px, aucune erreur propre au code (une erreur d'export manquant venait du faux service de test, corrigée). Non testé avec la vraie base et un vrai compte, ni le bouton "Fiche client" de la vue 360 (modification de 8 lignes, syntaxe vérifiée).

À noter : le lien de la fiche depuis les listes de demandes et le tableau de bord n'est pas ajouté (seulement vue 360, fiche et création).

### 2026-10-02 : lot A, étape 7 (clôture)

Fait :
- `docs/01_ARCHITECTURE.md` : routes du CRM (4.2), tables `clients` (colonnes ajoutées), `contacts` et vue `v_clients` (7), droits (8.2), nouvelle section 17 "CRM (en cours)" avec la feuille de route.
- Contrôle d'ensemble : 114 tests réussis, `check-coherence` 0 erreur, aucun tiret cadratin dans les lignes ajoutées.
- Application réelle (sans mocks) chargée sur une page propre : la page de connexion s'affiche sans erreur console et tous les nouveaux modules (vues, composants, services) se chargent avec les vrais exports. Les parcours connectés n'ont pas pu être joués : ils demandent un compte, et le mot de passe d'un compte ne se saisit pas à la place de l'utilisateur.

Critères de fin de lot, état :
- Tests verts et cohérence à 0 erreur : oui.
- Droits vérifiés : par simulation en base d'un compte client, admin et "consultant" (transactions annulées), pas avec de vrais comptes dans l'application.
- 375 px : vérifié sur chaque écran du lot (page sans défilement horizontal, cibles de 44 px). 1440 px : mise en page de bureau vérifiée sur la liste ; les autres écrans ont la même structure.
- Aucune erreur console sur les parcours client et consultant : non joués avec de vrais comptes.

Fichiers du lot A, prêts à commiter (rien n'est commité ni poussé) :
- Nouveaux : `supabase/migrations/0030_fiche_client.sql`, `0031_siret_unique.sql`, `0032_clients_suppression_admin.sql` ; `app/js/engine/fiche-client.js` ; `app/js/services/clients.js` (étendu) ; `app/js/components/formulaire-client.js`, `documents-demande.js`, `telechargement.js` ; `app/js/views/consultant/clients.js`, `client-fiche.js`, `client-nouveau.js`, `client-contacts.js`, `client-demandes.js` ; `tests/fiche-client.test.mjs` ; `docs/changes.md`.
- Modifiés : `app/css/dashboard.css`, `app/js/main.js`, `app/js/components/entete.js`, `app/js/engine/statuts.js`, `app/js/views/client/documents.js`, `app/js/views/consultant/creation.js`, `liste.js`, `vue-360.js`, `docs/01_ARCHITECTURE.md`.
- À ne pas inclure : `app/assets/images/logo.svg` (modifié hors de ce lot), `app/crm_app.md` (à déplacer dans `docs/` d'abord), `app/arb.bat`, `app/arborescence.txt`, `app/security.md`, `.claude/skills/`, `docs/05_SKELETONS.md` (décision en attente), et les deux fichiers d'e-mails `supabase/functions/creer-compte/mail.ts` et `envoyer-notification-email/index.ts` (pas de déploiement sans accord).

Les migrations 0030 à 0032 sont déjà appliquées sur la base de production alors que le code du lot n'est pas encore poussé : c'est sans effet sur l'application publiée (les nouvelles colonnes ont des valeurs par défaut et la séparation des droits de `clients` garde les mêmes accès pour le staff, sauf la suppression réservée à l'admin).

### 2026-10-02 : lot B, étape B1 (migrations 0033 et 0034) et faille corrigée

**Faille trouvée et corrigée (migration 0033).** La politique `profils_staff` était `for all` : tout membre du staff, donc un simple consultant, pouvait modifier, créer ou supprimer n'importe quel profil depuis son navigateur, en particulier se donner le rôle `admin`. Reproduit en base avant correction (transaction annulée : un "consultant" se passe admin, 1 ligne modifiée). L'application ne fait que lire `profils` (`auth.js`, `services/comptes.js`) ; les créations, changements de rôle et suppressions passent par les Edge Functions avec la clé `service_role`, qui ignore la RLS. La politique est remplacée par `profils_staff_lecture` (lecture seule). Après correction, dans la même simulation : changement de rôle 0 ligne, suppression 0 ligne, lecture des profils toujours possible (4 lignes). La base est intacte (1 admin, 3 clients). Cette faille rendait caduques les droits "admin seulement" (suppression de client, désignation des tâches).

**Migration 0034.**
- `est_admin()` (security definer, comme `est_staff()`), `notifications.lien`, tables `activites` et `taches` avec index et RLS, triggers `trg_taches_maj` (dates de mise à jour et de clôture) et `trg_notifier_tache` (notification au responsable), vue `v_clients` étendue.

Vérifié en base (transactions annulées, un compte client simulé en consultant, rien de résiduel : 0 tâche, 0 activité, 0 notification de tâche, 0 consultant) :
- admin : voit toutes les tâches, crée pour n'importe qui ;
- consultant : voit 1 tâche sur 2 (la sienne), les échanges notés, crée une tâche pour lui, la création pour l'admin est refusée, il termine sa tâche (terminee_le renseignée, terminee_par = lui), terminer celle de l'admin touche 0 ligne, la réaffectation est refusée, `v_clients` ne compte que ses tâches ;
- notifications : le consultant reçoit une notification avec le lien `/clients/<id>/activite` quand l'admin lui confie une tâche, pas l'admin pour sa propre tâche, une réaffectation par l'admin notifie le nouveau responsable une seule fois (une simple modification de titre n'en crée pas) ;
- client : 0 tâche, 0 activité visibles, insertion refusée.

À noter : `app/js/components/entete.js` ouvre encore les notifications vers `#/demandes/:reference`. Le lien `/clients/:id/activite` sera pris en compte à l'étape B6.

### 2026-10-02 : lot B, étape B2 (logique testée)

Fait : `app/js/engine/taches.js` (fonctions pures) et `tests/taches.test.mjs` (10 tests).
- Constantes et libellés : `TYPES_ACTIVITE`, `TYPES_TACHE`, `libelleTypeActivite`, `libelleTypeTache`.
- Dates (une échéance est une chaîne AAAA-MM-JJ, calculée en jours entiers donc insensible aux changements d'heure) : `estCleValide`, `ajouterJours`, `joursDeRetard`, `libelleEcheance` (En retard de N jours, Hier, Aujourd'hui, Demain, date).
- `classerTaches(taches, maintenant)` : seulement les tâches à faire, réparties en `enRetard`, `aujourdhui`, `semaine` (les six jours suivants) et `plusTard`, triées par échéance puis par création.
- Formulaires : `preparerTache` / `validerTache` (titre et échéance obligatoires, `assignee_id` repris seulement s'il est fourni), `preparerActivite` / `validerActivite` (objet obligatoire, date saisie convertie en ISO).
- `fusionnerHistorique(activites, jalons, maintenant)` : échanges et étapes passées d'un client, du plus récent au plus ancien ; dates futures et dates limites exclues.
- `tachesVersJalons(taches)` : tâches à faire converties en éléments de calendrier (type `tache`, `libelle` = titre, `reference` = nom du client, 9 h locales du jour d'échéance). Le calendrier devra connaître ce type (étape B5).

Vérifié : `node --test tests/*.test.mjs` 124 réussis, 0 échec (114 avant) ; les 10 nouveaux tests passent aussi dans les fuseaux America/New_York et Pacific/Auckland ; `check-coherence` 0 erreur ; aucun tiret cadratin.

### 2026-10-02 : lot B, étape B3 (services, migrations 0035 et 0036)

Fait :
- Migration `0035_activites_droits.sql` (appliquée) : la politique `activites_staff` (for all) laissait tout consultant modifier ou effacer l'historique d'un collègue ; elle est remplacée par lecture et création pour le staff, modification et suppression pour l'auteur ou l'admin.
- Migration `0036_activites_auteur_profil.sql` (appliquée) : `activites.auteur` référence `profils` (et non `auth.users`) pour afficher le nom de l'auteur par jointure ; même comportement si le profil disparaît (auteur vide, échange conservé).
- `services/taches.js` : `listerTaches({ clientId, assigneeId, statut })` (jointures client, contact, demande, responsable ; tri par échéance), `creerTache(clientId, champs)` (sans responsable fourni, confiée à l'utilisateur connecté), `modifierTache`, `terminerTache`, `rouvrirTache`, `annulerTache`, `reporterTache(id, echeance)`, `supprimerTache`.
- `services/activites.js` : `listerActivites(clientId, limite)` (jointures contact, demande, auteur, du plus récent au plus ancien), `creerActivite`, `supprimerActivite` (message clair si la base refuse).

Vérifié :
- Droits des échanges en base (transactions annulées, un compte client simulé en consultant) : le consultant lit les 2 échanges, modifie et supprime le sien, ne peut ni modifier ni supprimer celui de l'admin (0 ligne), son nom est renseigné d'office comme auteur ; l'admin peut supprimer celui du consultant.
- Jointures : les deux requêtes exactes des services sont acceptées par l'API REST de Supabase (réponse 200, liste vide faute de session, donc la RLS est bien appliquée) alors qu'une jointure inexistante est refusée (400), ce qui prouve que le contrôle est réel.
- Les services ne sont pas testables hors navigateur avec une vraie session ; ils le seront à travers les écrans (étapes B4 à B6).

### 2026-10-02 : lot B, étape B4 (onglet Activité)

Fait :
- `views/consultant/client-activite.js` (nouveau) : onglet `#/clients/:id/activite`.
  - Tâches ouvertes (en retard d'abord, puis du jour, de la semaine, plus tard) : bouton rond pour terminer, type, échéance en clair ("En retard de 3 jours"), contact, demande, responsable (affiché à l'admin ou quand la tâche n'est pas la sienne), reporter (demain, dans 3 jours, dans 1 semaine), suppression avec confirmation.
  - Historique : échanges notés (icône par type, contact, auteur, lien vers la demande) mêlés aux étapes passées des demandes, du plus récent au plus ancien ; suppression visible seulement pour l'auteur ou l'admin.
  - Formulaire "Noter un échange" (type, date et heure, objet, contact actif, demande, description) avec la case "Créer une tâche de suivi" (titre prérempli "Suivi : objet", échéance dans 3 jours, type relance). Si la tâche échoue après l'échange, l'échange reste enregistré et un message le dit.
  - Formulaire "Nouvelle tâche" (titre, type, échéance, contact, demande, description) ; l'admin choisit le responsable, un consultant crée pour lui seul.
- `components/champs-crm.js` (nouveau) : `bouton`, `champ`, `champSelect`, `zoneTexte`, `caseACocher`, partagés ; `client-contacts.js` et `formulaire-client.js` les importent au lieu de leurs copies locales.
- `engine/taches.js` : ajout de `versChampDatetime` (valeur d'un champ date et heure locale), 1 test de plus.
- `views/consultant/client-fiche.js` : nouvel onglet "Activité" (après Aperçu), indicateur "Tâches ouvertes" sur l'Aperçu ; `views/consultant/clients.js` : colonne "Tâches" et colonne CSV "Tâches ouvertes". Styles `cl-tache*`, `cl-historique*` ; les indicateurs de la fiche passent en grille adaptative (`auto-fit`).

Vérifié : `node --test tests/*.test.mjs` 125 réussis, 0 échec. Page de test avec services simulés (supprimée ensuite), en admin puis en consultant : liste et libellés corrects, validations (titre, échéance, objet), création de tâche avec responsable, échange avec suivi (une activité puis une tâche de type relance), terminer, reporter (échéance recalculée), supprimer tâche et échange, un consultant ne voit pas le choix du responsable et ne peut supprimer que ses propres échanges, échec de la base affiché sans fermer le formulaire, échec de la tâche de suivi sans perdre l'échange, 375 px sans défilement horizontal ni cible sous 40 px. Non testé avec la vraie base et un vrai compte.

### 2026-10-02 : lot B, étape B5 (page des tâches, bloc "Aujourd'hui", calendrier)

Fait :
- `components/ligne-tache.js` (nouveau) : ligne de tâche partagée (fiche client, page des tâches, tableau de bord) avec `echeanceApresReport(jours)` ; `client-activite.js` l'importe au lieu de sa copie.
- `views/consultant/taches.js` (nouveau), route `#/taches` et entrée "Tâches" du menu : filtres statut (à faire, terminées, annulées), client (liste tirée des tâches affichées) et, pour l'admin seulement, responsable ("Moi" par défaut, "Toute l'équipe" ou un consultant) ; les tâches à faire sont groupées en En retard, Aujourd'hui, Cette semaine, Plus tard ; lien vers la fiche du client, Terminer et Reporter.
- Tableau de bord consultant (`tableau-de-bord.js`) : bloc "Aujourd'hui : N tâches" (en retard et du jour, 8 au plus, avec Terminer et Reporter, rendu rafraîchi ensuite), rappel du nombre de tâches de la semaine et lien "Toutes mes tâches", et à côté un calendrier des échéances de mes tâches (jours cliquables, comme côté client).
- Calendrier : nouveau type de jalon `tache` (`engine/jalons.js` : catégorie et libellé ; `components/calendrier.js` : pas d'heure, titre propre, lien vers la fiche ; point orange). Les tâches ne sont jamais envoyées au calendrier du client : `rpc_jalons` n'a pas changé.
- `engine/taches.js` : `tachesVersJalons` ajoute le lien `href` vers l'onglet Activité.
- Cibles tactiles : les flèches du calendrier passent de 36 à 44 px (page client comprise).

Vérifié : `node --test tests/*.test.mjs` 125 réussis, 0 échec ; `check-coherence` 0 erreur. Page de test avec services simulés (supprimée ensuite) : page des tâches (groupes et compteurs, "Moi" puis "Toute l'équipe", filtre par client, terminer puis rechargement, liste des terminées), tableau de bord (appel limité aux tâches de la personne connectée, bloc, lien, calendrier avec points orange et détail du jour contenant un lien vers la fiche, terminer depuis le bloc), 375 px sans défilement horizontal et sans cible sous 44 px. Non testé avec la vraie base et un vrai compte.

### 2026-10-02 : lot B, étape B6 (vue 360 et notifications)

Fait :
- `views/consultant/vue-360.js` : le bloc "Relancer le client" crée maintenant une vraie tâche. Pour chaque personne invitée : une date (par défaut dans 3 jours) et le bouton "Créer une tâche de relance" ; la tâche ("Relancer adresse@e-mail", type relance) est rattachée au client et à la demande et confiée à la personne connectée. Une échéance vide est refusée avant tout appel, une erreur de la base est affichée et le bouton se réactive. L'ancien commentaire interne "Relance à faire" est supprimé (`relancerClient` retiré de `services/demandes.js`).
- `components/entete.js` : une notification peut porter un `lien` (chemin de l'application) ; un clic sur une notification de tâche ouvre `/clients/:id/activite`, les autres notifications ouvrent toujours la demande. Le titre, la référence et le lien sont échappés (`echapperHtml` dans `engine/formatage.js`, 1 test) : jusqu'ici le titre était inséré tel quel dans la page, et le titre d'une tâche est une saisie libre, donc une balise y aurait été exécutée chez le destinataire.
- Style `relance-echeance` (ligne qui passe à la ligne sur mobile).

Vérifié : `node --test tests/*.test.mjs` 126 réussis, 0 échec ; `check-coherence` 0 erreur. Page de test avec services simulés (supprimée ensuite) chargeant le vrai module du panneau de notifications et la vraie vue 360 : badge et liste, titre contenant une balise affiché en texte (rien d'exécuté), clic sur la notification de tâche vers `#/clients/c2/activite` et sur l'autre vers la demande, notifications marquées lues ; vue 360 avec ses deux relances, date par défaut correcte, tâche créée avec les bons champs (client, demande, type, échéance), échéance vide refusée, échec de la base signalé, ancien bouton absent, bouton "Fiche client" présent avec le bon lien (ce qui valide la modification de l'étape 6 du lot A restée non testée), 375 px sans défilement horizontal et cibles de 44 px. Non testé avec la vraie base et un vrai compte.

### 2026-10-02 : lot B, ajout demandé avant la clôture (nouveau contact depuis un échange ou une tâche)

Demande de l'utilisateur : quand la personne jointe ou à rappeler n'est pas encore dans la fiche, pouvoir l'ajouter sur place au lieu de n'avoir que la liste existante.

Fait (`views/consultant/client-activite.js`, styles `cl-contact-rapide*`) :
- Le choix "Contact" des formulaires "Noter un échange" et "Nouvelle tâche" propose "+ Nouveau contact…" ; ce choix ouvre nom (obligatoire), fonction, e-mail et téléphone.
- À l'enregistrement, le contact est créé dans l'onglet Contacts (sans rôle ; contact principal s'il n'y en avait aucun), puis l'échange et la tâche de suivi lui sont rattachés. Si la suite échoue ou si l'e-mail existe déjà ("Un contact avec cet e-mail existe déjà pour ce client."), le formulaire reste ouvert ; une fois le contact créé, le choix le reprend, donc un nouvel essai ne le recrée pas.

Vérifié : `node --test tests/*.test.mjs` 126 réussis, 0 échec. Page de test avec services simulés (supprimée ensuite) : le choix est proposé dans les deux formulaires, nom manquant et e-mail invalide bloqués sans aucun appel, e-mail en double signalé sans créer d'échange, création avec échange et suivi (ordre : contact, échange, tâche ; mêmes identifiants), principal faux quand il y en a déjà un, nouveau contact proposé ensuite dans la liste, 375 px sans défilement horizontal ni cible sous 44 px. Non testé avec la vraie base et un vrai compte.

### 2026-10-02 : lot B, ajout du contact en fenêtre modale (remplace la version dépliée)

Remarque de l'utilisateur : les champs dépliés dans le formulaire allongeaient trop la page, une fenêtre modale est plus sensée.

Fait (`views/consultant/client-activite.js`, styles `modale-formulaire*` dans `css/dashboard.css`) :
- "+ Nouveau contact…" ouvre un `<dialog>` natif (comme la signature et les documents) : nom (obligatoire), fonction, e-mail, téléphone. Le formulaire de l'échange ou de la tâche garde exactement sa taille et ce qui y était déjà saisi.
- "Ajouter le contact" crée le contact tout de suite (onglet Contacts, sans rôle, principal s'il n'y en avait pas), l'ajoute à la liste, le sélectionne et affiche "Contact ajouté.". Les formulaires lisent simplement le choix : plus de création différée à l'envoi, donc plus simple.
- Annuler, clic sur le fond ou Échap referment la fenêtre et rétablissent le choix précédent. Erreurs (nom manquant, e-mail invalide ou en double) affichées dans la fenêtre, qui reste ouverte.
- La fermeture passe par une seule fonction (indépendante de l'événement `close`, que le navigateur du volet de test ne déclenchait pas ; les événements `cancel` et `close` y sont tout de même branchés pour le cas d'Échap).

Vérifié : page de test avec services simulés (supprimée ensuite) : ouverture avec focus sur le nom, formulaire parent inchangé en hauteur et en saisie, validation sans appel, doublon signalé fenêtre ouverte, annuler et fond rétablissent le choix, création avec sélection automatique, échange puis enregistré avec ce contact, événement Échap simulé (`cancel`) ferme proprement, à 375 px la fenêtre tient dans l'écran (338 px) avec des cibles de 44 px. `node --test tests/*.test.mjs` 126 réussis. Non testé avec la vraie base et un vrai compte, ni avec la vraie touche Échap.

### 2026-10-02 : lot B, étape B7 (clôture)

Fait :
- `docs/01_ARCHITECTURE.md` : routes (`#/taches`, onglet Activité, bloc "Aujourd'hui", relance de la vue 360), tables `activites` et `taches`, `notifications.lien`, `est_admin()`, `v_clients` étendue (section 7) ; droits de `activites`, `taches` et `profils` (8.2) et note sur la faille corrigée (8.1) ; notifications de tâches (16) ; lot B réalisé (17).
- Contrôle d'ensemble : 126 tests réussis, `check-coherence` 0 erreur, aucun tiret cadratin dans les lignes ajoutées, toutes les migrations 0030 à 0037 présentes en base et en local.
- Audit de sécurité Supabase relancé : une alerte concernait le lot (`fn_tache_maj` sans `search_path` fixe) ; corrigée par la migration `0037_fn_tache_maj_search_path.sql` (appliquée, trigger revérifié : la date de clôture est toujours renseignée). `est_admin()` n'est pas exécutable par `anon` ; `fn_notifier_tache` n'est exécutable par personne.

Fichiers du lot B (commit) :
- Nouveaux : `supabase/migrations/0033_profils_lecture_staff.sql` à `0037_fn_tache_maj_search_path.sql` ; `app/js/engine/taches.js` ; `app/js/services/taches.js` et `activites.js` ; `app/js/components/champs-crm.js` et `ligne-tache.js` ; `app/js/views/consultant/client-activite.js` et `taches.js` ; `tests/taches.test.mjs`.
- Modifiés : `app/css/dashboard.css`, `app/js/main.js`, `components/calendrier.js`, `components/entete.js`, `components/formulaire-client.js`, `engine/formatage.js`, `engine/jalons.js`, `services/demandes.js`, `views/consultant/client-contacts.js`, `client-fiche.js`, `clients.js`, `tableau-de-bord.js`, `vue-360.js`, `docs/01_ARCHITECTURE.md`, `docs/changes.md`, `tests/formatage.test.mjs`, `tests/jalons.test.mjs`.
- Non inclus : `app/assets/images/logo.svg`, `app/crm_app.md`, `app/arb.bat`, `app/arborescence.txt`, `app/security.md`, `app/mail.ts` et `app/preview.ts` (apparus dans `app/`, que je n'ai pas créés), `.claude/skills/`, `docs/05_SKELETONS.md`, les deux fichiers d'e-mails.

### 2026-10-02 : lot C, étape C1 (migration 0038)

Fait : migration `0038_montants.sql` appliquée sur la base et enregistrée dans `supabase/migrations/` : tables `probabilites_statut` (14 statuts) et `demande_enjeux`, vues `v_demandes_montants` et `v_clients` étendue (voir le modèle ci-dessus).

Vérifié en base (transactions annulées, un compte client simulé en consultant, rien de résiduel : 0 enjeu, 14 probabilités, `soumise` toujours à 25, RDF-2026-0006 toujours `envoyee`, 0 consultant) :
- proposition chiffrée (RDF-2026-0007, 1 000 € HT, proposition envoyée) : montant retenu 1 000, source proposition, probabilité 75, pondéré 750 ;
- estimation seule (RDF-2026-0006, 5 000 €, statut envoyée) : source estimation, probabilité 10, pondéré 500 ; avec une probabilité propre de 50 : 2 500 ;
- statuts finaux : une demande perdue vaut 0 % et 0 € pondéré malgré une probabilité saisie, une demande gagnée vaut 100 % (pondéré = montant) ;
- `v_clients` : ANATOLCONSEIL gagnée donne `ca_signe` 5 000 et pipeline 0 ; DEMO (proposition envoyée) donne `ca_signe` 0 et pipeline 750 ;
- contraintes : probabilité 120 refusée, montant négatif refusé ;
- droits : un consultant voit les 4 demandes, modifie un enjeu, lit les 14 probabilités par défaut mais ne peut pas les modifier (0 ligne) ; l'admin peut ; un client ne voit rien (0 montant, 0 enjeu, 0 probabilité).

### 2026-10-02 : lot C, étape C2 (logique testée)

Fait : `app/js/engine/finance.js` (fonctions pures sur les lignes de `v_demandes_montants`, nombres acceptés en chaînes) et `tests/finance.test.mjs` (11 tests).
- `formaterMontant(valeur, { decimales })` : "4 800 €" (0 décimale par défaut, 2 pour un devis), tiret si absent ; `libelleSourceMontant`.
- `agregerPipeline(montants)` : demandes en cours (ni archivées ni terminées) réparties selon les étapes de suivi (Vos réponses, Entretien, Note de cadrage, Proposition ; l'étape Décision n'en fait pas partie) avec nombre, montant retenu, pondéré et nombre sans montant, plus un total.
- `demandesSansMontant(montants)` : demandes en cours sans proposition chiffrée ni estimation, à partir de l'entretien (avant, rien à signaler).
- `caSigneAnnee(montants, annee)` et `caSigneParMois(montants, maintenant, nbMois)` : demandes gagnées datées par la décision du client (à défaut, par la création), douze mois glissants du plus ancien au plus récent.
- `kpisFinance(montants, maintenant)` : pipeline, pondéré, CA signé de l'année et total, montant moyen d'une demande gagnée, conversion en euros (gagné / (gagné + perdu), vide s'il n'y a rien), nombre de demandes sans montant. Les demandes archivées comptent dans le CA signé et la conversion, pas dans le pipeline.
- `preparerEnjeu` / `validerEnjeu` : saisie "4 800,50" ou "4800.5" lue en nombre (arrondi au centime), vides en null, montant positif ou nul, probabilité entière de 0 à 100.

Vérifié : `node --test tests/*.test.mjs` 137 réussis, 0 échec (126 avant) ; les 11 nouveaux tests passent aussi dans les fuseaux America/New_York et Pacific/Auckland ; `check-coherence` 0 erreur ; aucun tiret cadratin.

### 2026-10-02 : lot C, étape C3 (services)

Fait : `app/js/services/montants.js` (seul endroit qui appelle Supabase pour les montants).
- `listerMontants({ clientId, demandeId })` et `obtenirMontantDemande(demandeId)` : lignes de `v_demandes_montants`, de la plus récente à la plus ancienne.
- `enregistrerEnjeu(demandeId, { montant_estime, probabilite })` : écriture (création ou mise à jour) dans `demande_enjeux` ; `null` pour revenir à la valeur du statut ou à l'absence d'estimation. `obtenirEnjeu(demandeId)` lit ce qui est saisi (pour préremplir le formulaire).
- `listerProbabilitesStatut()` et `modifierProbabiliteStatut(statut, pourcentage)` (message clair si la base refuse : modification réservée à l'admin). Pas encore d'écran qui s'en sert.

Vérifié (requêtes réelles de l'API REST avec la clé publique, sans session) : la vue des montants et `v_clients` répondent "permission refusée" (inaccessibles hors connexion) ; `demande_enjeux` et `probabilites_statut` répondent 200 avec une liste vide (RLS) ; une colonne inexistante est refusée (400, donc le contrôle est réel) ; une écriture au format exact de l'upsert (`on_conflict=demande_id`) est acceptée par l'API puis refusée par la RLS ("new row violates row-level security policy"), ce qui valide le format de la requête et la protection. Les services s'essaieront de bout en bout avec les écrans (C4 à C6). `node --test tests/*.test.mjs` 137 réussis, 0 échec ; `check-coherence` 0 erreur.

### 2026-10-02 : lot C, étape C4 (carte "Enjeu commercial" de la vue 360)

Fait :
- `components/carte-enjeu.js` (nouveau) : carte autonome (elle charge ses données et se redessine après chaque enregistrement) insérée dans `views/consultant/vue-360.js` juste après le suivi par étapes. Elle montre le montant retenu et sa source (Total de la proposition, Estimation ou Aucun montant), la probabilité effective (Par défaut du statut, Saisie pour cette demande, ou Fixée par le statut quand la demande est terminée) et le montant pondéré ; en dessous, le formulaire "Montant estimé (€ HT)" et "Probabilité (%)" (vide : celle du statut ; verrouillée pour une demande terminée).
- Un message "Aucun montant : saisissez une estimation ou chiffrez la proposition." s'affiche pour une demande en cours à partir de l'entretien (pas avant, pas pour une demande terminée).
- Saisie : virgule décimale et espaces acceptés ("4 800,50"), montant négatif, texte ou probabilité hors de 0 à 100 refusés avant tout appel ; erreur de la base affichée sans bloquer le bouton.
- `engine/finance.js` : `formaterMontant` accepte `decimales: 'auto'` (deux décimales seulement si le montant n'est pas un entier), utilisé par la carte ; 1 assertion de plus.
- Style `db-mini__detail`.

Vérifié : `node --test tests/*.test.mjs` 137 réussis, 0 échec. Page de test avec les services simulés (supprimée ensuite) : les trois indicateurs et leur légende pour une demande sans montant, une demande estimée, une proposition chiffrée gagnée et une demande avant l'entretien ; erreurs sans aucun appel ; enregistrement avec "4 800,50" et 60 (appel avec 4800.5 et 60, indicateurs et champs rechargés, message "Enjeu enregistré.") ; probabilité vidée (appel avec null, retour à "Par défaut du statut") ; échec de la base ; affichage "4 800,50 €" et "2 880,30 €" ; à 375 px une seule colonne, aucun débordement, cibles de 44 px. Non testé dans la vraie vue 360 ni avec la vraie base et un vrai compte (la vue 360 est modifiée de deux lignes, syntaxe vérifiée).

### 2026-10-02 : lot C, étape C5 (tableau de bord et page Indicateurs)

Fait (admin seulement ; le consultant ne déclenche même pas la requête des montants) :
- `views/consultant/tableau-de-bord.js` : ligne d'indicateurs financiers sous celle des délais (Pipeline HT, CA pondéré, CA signé de l'année, Conversion en euros) ; sous chaque colonne du pipeline des quatre premières étapes, le total en euros et le pondéré ; sur chaque demande, son montant ("4 000 €") ou "sans montant" (la colonne Décision montre aussi le montant des demandes gagnées et perdues) ; carte d'alerte "N demande(s) sans montant" (à partir de l'entretien) ; le lien "Tous les indicateurs" apparaît dès qu'une des deux lignes d'indicateurs existe. Une panne de la requête des montants n'empêche pas l'affichage du reste.
- `views/consultant/indicateurs.js` : quatre indicateurs (Pipeline, CA pondéré, CA signé de l'année, Montant moyen gagné), tableau "Pipeline par étape" (demandes, montant, pondéré, sans montant, total), tableau "CA signé des 12 derniers mois" (mois, demandes gagnées, CA, total) avec la précision "Daté par l'acceptation de la proposition par le client."
- Style `db-pipeline__montant`.

Vérifié : `node --test tests/*.test.mjs` 137 réussis, 0 échec. Page de test avec services simulés (7 demandes aux montants variés, supprimée ensuite), en admin puis en consultant : pipeline 7 500 €, pondéré 4 175 €, CA signé 5 000 €, conversion 56 % (5 000 / 9 000), synthèses par colonne exactes, montants et "sans montant" par demande, alerte (1 demande) ; en consultant : aucune requête de montants, aucun indicateur financier, aucune synthèse, aucune alerte, pas de lien Indicateurs ; page Indicateurs : tableaux corrects (total pipeline 5 demandes / 7 500 € / 4 175 € / 2 sans montant, 12 mois dont un à 5 000 €) ; 375 px sans défilement horizontal pour les deux écrans. Non testé avec la vraie base et un vrai compte.

### 2026-10-02 : lot C, étape C6 (fiche client, liste des clients, exports)

Fait :
- `views/consultant/client-fiche.js` : deux indicateurs de plus sur l'Aperçu pour l'admin, "CA signé (HT)" et "En cours, pondéré (HT)" (colonnes `ca_signe` et `pipeline_pondere` de `v_clients`).
- `views/consultant/clients.js` : colonne "CA signé" du tableau pour l'admin ; l'export CSV de l'admin ajoute "CA signé (HT)" et "Pipeline pondéré (HT)". Pour un consultant, ni colonne, ni export de ces chiffres.
- `views/consultant/liste.js` : l'export CSV des demandes ajoute "Montant HT" et "Source du montant" (Total de la proposition, Estimation, Aucun montant) ; si la lecture des montants échoue, l'export se fait quand même sans ces colonnes. Ces montants sont ceux d'une demande, visibles du consultant comme décidé.

Vérifié : `node --test tests/*.test.mjs` 137 réussis, 0 échec. Page de test avec services simulés (supprimée ensuite), en admin puis en consultant : liste des clients (colonne et 5 000 € ou tiret, CSV à douze colonnes pour l'admin et dix pour le consultant), fiche (sept indicateurs pour l'admin dont 5 000 € et 750 €, cinq pour le consultant), export des demandes (Montant HT 5000 et 0, sources correctes, et export sans les deux colonnes quand la lecture des montants échoue), 375 px sans défilement horizontal. Non testé avec la vraie base et un vrai compte.

Limite connue (déjà notée plus haut) : la restriction des chiffres agrégés à l'admin est dans l'affichage ; les colonnes `ca_signe` et `pipeline_pondere` de `v_clients` restent lisibles par tout le staff via l'API.

### 2026-10-02 : lot C, étape C7 (clôture)

Fait :
- `docs/01_ARCHITECTURE.md` : routes (tableau de bord admin, page Indicateurs, carte "Enjeu commercial" de la vue 360), tables `probabilites_statut` et `demande_enjeux`, vue `v_demandes_montants` et `v_clients` étendue (section 7), droits (8.2) et limite connue de la restriction aux admins, lot C réalisé (17).
- Contrôle d'ensemble : 137 tests réussis, `check-coherence` 0 erreur, aucun tiret cadratin dans les lignes ajoutées.
- Audit de sécurité Supabase relancé : aucune alerte nouvelle (la liste est celle d'avant le lot C, plus la correction de `fn_tache_maj` du lot B) ; les tables et vues du lot C n'apparaissent pas.

Fichiers du lot C (commit) :
- Nouveaux : `supabase/migrations/0038_montants.sql` ; `app/js/engine/finance.js` ; `app/js/services/montants.js` ; `app/js/components/carte-enjeu.js` ; `tests/finance.test.mjs`.
- Modifiés : `app/css/dashboard.css`, `app/js/views/consultant/vue-360.js`, `tableau-de-bord.js`, `indicateurs.js`, `clients.js`, `client-fiche.js`, `liste.js`, `docs/01_ARCHITECTURE.md`, `docs/changes.md`.
- Non inclus : les mêmes fichiers que pour le lot B (`app/assets/images/logo.svg`, `app/crm_app.md`, `app/arb.bat`, `app/arborescence.txt`, `app/security.md`, `app/mail.ts`, `app/preview.ts`, `.claude/skills/`, `docs/05_SKELETONS.md`, les deux fichiers d'e-mails).

### 2026-10-02 : lot Accès, étape S1 (migration 0039)

Fait : migration `0039_acces_consultant.sql` appliquée sur la base et enregistrée dans `supabase/migrations/`.
- Fonctions `peut_voir_demande` et `peut_voir_client` (exécutables par les comptes connectés seulement).
- Nouvelles politiques : demandes (`consultant_id`), commentaires, invitations (`demande_acces`), enjeux, créneaux, fichiers, notes de cadrage, propositions et leurs lignes, réponses, événements, historique des réponses (`peut_voir_demande`) ; clients (règle directe), contacts, échanges notés (`peut_voir_client`) ; création de tâche (client visible) ; profils (personnel lisible, un profil client seulement s'il est invité sur une demande visible).
- Triggers `trg_demandes_proteger_assignation`, `trg_clients_proteger_assignation`, `trg_demandes_attribuer`, `trg_clients_attribuer`.

Vérifié en base (transactions annulées ; deux consultants simulés c1 et c2 à partir de deux comptes clients, avec c1 titulaire de RDF-2026-0006 et c2 de RDF-2026-0008 ; état revérifié ensuite : 4 demandes toutes à l'admin, 4 clients, 0 consultant, rien de résiduel) :
- l'admin voit exactement tout ce qu'il voyait (demandes 4/4, réponses 145/145, historique 597/597, événements 14/14, invitations 3/3, notes 1/1, propositions 1/1, créneaux 1/1, fichiers 2/2, enjeux 3/3, profils 4/4, clients 4, vues de montants et de clients 4) ;
- c1 et c2 ne voient que les leurs : 1 demande, 1 invitation, 1 enjeu, 1 événement, 1 fichier, 1 client, 1 contact, 1 échange, et 0 réponse, 0 historique, 0 note, 0 proposition, 0 ligne de proposition, 0 créneau (les 145 réponses, 597 lignes d'historique et la proposition appartiennent à d'autres demandes) ; un commentaire interne de l'autre n'est pas visible ;
- c1 crée un client et le retrouve (responsable posé d'office), crée une demande qui lui est attribuée d'office, ne peut pas en créer une pour c2, c2 ne voit ni ce client ni cette demande ;
- écritures croisées refusées : modifier la demande de c2 (0 ligne), réassigner sa propre demande ou son client (exception), noter un échange, ajouter un contact ou créer une tâche chez un client de c2 ;
- tâche confiée par l'admin à c1 sur le client de c2 : c1 la voit, pas la fiche du client ; l'admin réassigne sans obstacle ;
- profils : c1 voit le personnel (3 profils sur 4) mais pas le compte client d'une demande qui n'est pas la sienne.

Constat à part (non traité, hors CRM) : cette base contient aussi des tables d'autres applications (`stagiaires`, `groupes`, `sessions`, `documents_generes`, `titres`, `wall_*`, `profils_utilisateurs`, etc.) dont certaines ont des politiques `authenticated_all` (tout compte connecté lit et écrit). Un compte client de RD Recueil, qui est un compte connecté, pourrait donc lire ou modifier ces données. À regarder avec l'utilisateur avant d'y toucher, au risque de casser ces autres applications.

### 2026-10-02 : lot Accès, étape S2 (migrations 0040 et 0041, Edge Function)

Fait :
- Migration `0040_acces_fonctions.sql` (appliquée) : fonction `acces_demande(id)` (personnel concerné ou client invité) ; vérification d'accès ajoutée dans `rpc_changer_statut`, `rpc_soumettre`, `rpc_demander_modification`, `rpc_valider_cadrage`, `rpc_accepter_proposition`, `rpc_refuser_proposition`, `rpc_confirmer_reservation_calcom` (qui n'en avaient aucune : tout compte connecté pouvait agir sur n'importe quelle demande par son identifiant) ; `rpc_archiver_demande` limité au personnel concerné ; `rpc_jalons` filtré par `acces_demande` ; `fn_notifier_evenement` notifie l'admin et le consultant de la demande (plus tous) ; exécution de `rpc_valider_cadrage` retirée à `anon` (appelable sans connexion) ; `fn_historiser_reponse` et `fn_notifier_evenement` retirées de l'API.
- **Régression trouvée et corrigée (migration `0041_transitions_client.sql`, appliquée).** La migration 0019 avait réécrit `rpc_changer_statut` sans les transitions `gagnee`, `perdue` et `entretien_planifie` pour le rôle client (présentes dans 0014 et 0015). En production, un client ne pouvait donc ni accepter ou refuser une proposition ni confirmer un rendez-vous Cal.com (les fonctions dédiées appellent `rpc_changer_statut` avec son identité et levaient "Rôle client non autorisé"). Correctif : un client ne déclenche `soumise`, `cadrage_valide`, `cadrage_a_revoir`, `gagnee`, `perdue` et `entretien_planifie` que par les fonctions dédiées (qui posent un indicateur de transaction `app.transition_client_via_rpc`, non posable par l'API), jamais par un appel direct à `rpc_changer_statut` (ce qui fermait aussi le contournement de la signature et du contrôle des questions obligatoires) ; il garde `abandonnee` en appel direct. Les parcours client de l'application passent déjà par les fonctions dédiées.
- **Edge Function `envoyer-notification-email` redéployée (version 9).** Elle ne vérifiait que la présence d'un en-tête Authorization : n'importe quel compte connecté pouvait déclencher des e-mails pour n'importe quelle demande. Elle valide maintenant l'appelant (`getUser`), vérifie l'accès à la demande (`acces_demande`, même réponse qu'une demande inexistante), n'envoie que si la transition correspondante a été enregistrée dans les 15 dernières minutes, et écrit à l'admin et au consultant de la demande seulement. Le gabarit déployé est resté celui d'avant (le nouveau gabarit reste local, non déployé comme convenu) : le correctif a été appliqué à la version commitée et déployé ; la même modification a été reportée dans le fichier de travail qui contient le nouveau gabarit.

Vérifié en base (transactions annulées, deux consultants simulés et un vrai compte client de RDF-2026-0007, état revérifié ensuite : statuts inchangés, rien de résiduel) :
- refusés : changement de statut, soumission, archivage et réservation sur la demande d'un autre (consultant étranger comme client étranger), acceptation, refus, validation et demande de modification de documents d'une autre demande ;
- acceptés : le consultant fait avancer, archive et désarchive sa demande ; le client refuse puis accepte sa propre proposition, confirme un rendez-vous (statut entretien_planifie) et peut abandonner ; refusés au client : `gagnee`, `perdue`, `entretien_planifie` et `en_analyse` en appel direct ;
- notifications de soumission : l'admin et le consultant de la demande, pas l'autre consultant ;
- `rpc_jalons` : admin 3 demandes (la quatrième est archivée), consultant 1, client 1 ;
- appel sans connexion à `rpc_valider_cadrage` : permission refusée.
Edge Function : sans session valide elle répond 401 (en-tête absent ou clé publique seule).

À noter : accepter ou refuser une proposition exige désormais d'avoir accès à la demande (un consultant de la demande le pourrait donc encore, comme avant) ; on pourrait réserver ces signatures aux seuls comptes clients invités (valeur de preuve), à décider avec l'utilisateur.

### 2026-10-02 : lot Accès, étape S3 (migration 0042)

Fait : migration `0042_stockage_consultant.sql` (appliquée) : la politique `stockage_staff` du bucket `demandes` ("tout le staff, tout le bucket") devient : l'admin garde tout (y compris les anciens chemins qui commencent par la référence) ; un consultant n'accède qu'aux fichiers dont le deuxième segment du chemin (`{client}/{référence}/…`, cf. 0027) est la référence d'une de ses demandes, en lecture, dépôt, modification et suppression. Les règles du client ne changent pas.

Vérifié en base (transaction annulée, objets de test insérés puis annulés) : 4 fichiers au total (3 de test et 1 ancien) : l'admin en voit 4, chaque consultant 1 (celui de sa demande), le client de RDF-2026-0007 1 (le sien) ; un consultant dépose un fichier chez lui, est refusé chez l'autre, et ne modifie aucun fichier de l'autre (0 ligne).

### 2026-10-02 : lot Accès, étape S4 (application, migration 0043)

Fait :
- Migration `0043_assigner_demande.sql` (appliquée) : `rpc_assigner_demande(demande, consultant)`, réservée à l'admin, qui vérifie que la cible est un admin ou un consultant, change `consultant_id`, journalise l'attribution (événement de type `assignation`, sans effet sur les statuts, le calendrier ni les notifications de statut) et prévient le consultant ("Demande attribuée"). Vérifié en base (transaction annulée) : un consultant est refusé ("Réservé à l'administrateur"), une cible qui n'est pas du personnel est refusée ("Consultant introuvable"), l'admin attribue, le journal indique le nom, la notification est créée.
- `services/demandes.js` : `assignerDemande`. `services/clients.js` : un SIRET déjà porté par un client que le consultant ne voit pas (l'index unique le refuse) donne "Ce SIRET est déjà suivi. Contactez l'administrateur." sans nommer le client, à la création comme à la modification.
- `components/carte-attribution.js` (nouveau), insérée dans la vue 360 pour l'admin : "Demande attribuée à" (liste du personnel, le consultant actuel présélectionné) et "Attribuer" (sans effet si le choix n'a pas changé ; la vue se recharge ensuite).
- `views/consultant/creation.js` : l'admin voit "Consultant responsable" (lui-même par défaut) ; un consultant crée toujours pour lui.
- `components/formulaire-client.js` : le choix du responsable du client n'existe plus que pour l'admin (fiche et création) ; sinon la clé n'est même pas envoyée.
- `components/lecture-demande.js` : l'attribution se lit en clair dans le journal ("Demande attribuée : nom"). Le séparateur des autres lignes du journal passe d'un tiret cadratin à un point médian.
- Messages : "Demande introuvable" (vue 360, éditeur de note, éditeur de proposition, créneaux, entretien) et "Client introuvable" ajoutent "Elle n'existe pas, ou elle n'est pas attribuée à votre compte".

Vérifié : `node --test tests/*.test.mjs` 137 réussis, 0 échec. Pages de test avec services simulés (supprimées ensuite) : création de demande (admin : choix visible, appel avec le consultant choisi ; consultant : choix masqué, appel avec lui-même), carte d'attribution (options, aucun appel quand rien ne change, appel puis rechargement et message), formulaire client (responsable absent et non envoyé pour un consultant, présent et envoyé pour l'admin) ; services réels de clients avec un faux client Supabase : le code d'erreur 23505 devient le message sans nom. Non testé avec la vraie base et un vrai compte.

### 2026-10-03 : lot Accès, étape S5 (liste des demandes pour l'admin)

Fait :
- `services/demandes.js` : `listerDemandes` accepte `consultantId` (un identifiant, ou `aucun` pour les demandes sans consultant) et renvoie `consultant_id` et le nom du consultant (jointure sur `profils`).
- `views/consultant/liste.js` : pour l'admin seulement, un filtre "Consultant" (Tous les consultants, Non attribuées, un choix par membre du personnel), le nom du consultant (ou "non attribuée") sur chaque ligne, et une colonne "Consultant" dans l'export CSV ; un consultant ne voit ni le filtre, ni le nom, ni la colonne (il ne reçoit de toute façon que ses demandes, par la base).

Vérifié : `node --test tests/*.test.mjs` 137 réussis, 0 échec. Requêtes exactes envoyées à l'API REST avec la clé publique : jointure et filtre acceptés (200, liste vide faute de session), jointure inexistante refusée (400). Page de test avec services simulés (supprimée ensuite) : admin (filtre visible, liste complète avec le consultant sur chaque ligne, filtre par consultant et "Non attribuées" avec le bon paramètre, CSV avec la colonne Consultant avant les montants), consultant (filtre masqué, aucun nom, CSV sans la colonne). Non testé avec la vraie base et un vrai compte.

### 2026-10-03 : lot Accès, étape S6 (clôture)

Fait :
- `docs/01_ARCHITECTURE.md` : rôles (le consultant ne voit que ses demandes, l'admin attribue), liste des demandes et carte d'attribution (4.2), fonctions `peut_voir_demande`, `peut_voir_client`, `acces_demande`, `est_admin`, `rpc_assigner_demande` et triggers d'attribution (7), règle d'accès du personnel et lignes de droits corrigées (8.2), destinataires des notifications du personnel (16), ligne "Accès" de la feuille de route (17).
- Contrôle d'ensemble : 137 tests réussis, `check-coherence` 0 erreur, aucun tiret cadratin dans les lignes ajoutées.
- Audit de sécurité Supabase relancé : aucune alerte nouvelle due à ce lot. Restent des alertes déjà présentes avant le lot : `get_my_role` et `update_updated_at_column` sans `search_path` fixe, `est_staff`, `get_my_role`, `handle_new_user` et `rls_auto_enable` appelables sans connexion, liste de fonctions `security definer` appelables par un compte connecté, protection contre les mots de passe compromis désactivée. Non corrigées ici (voir points ouverts).

Fichiers du lot Accès (commit) :
- Nouveaux : `supabase/migrations/0039_acces_consultant.sql`, `0040_acces_fonctions.sql`, `0041_transitions_client.sql`, `0042_stockage_consultant.sql`, `0043_assigner_demande.sql` ; `app/js/components/carte-attribution.js`.
- Modifiés : `supabase/functions/envoyer-notification-email/index.ts` (version déjà déployée : même gabarit qu'avant avec le correctif d'accès), `app/js/services/demandes.js`, `clients.js`, `views/consultant/creation.js`, `vue-360.js`, `liste.js`, `client-fiche.js`, `client-nouveau.js`, `entretien.js`, `creneaux.js`, `editeur-note.js`, `editeur-proposition.js`, `components/formulaire-client.js`, `lecture-demande.js`, `docs/01_ARCHITECTURE.md`, `docs/changes.md`.
- Non inclus (travaux sans rapport avec ce lot) : `app/assets/images/logo.svg` (logo aux bords arrondis), `supabase/functions/creer-compte/mail.ts` (nouveau gabarit d'e-mail), le nouveau gabarit dans `envoyer-notification-email` (seul le correctif d'accès sur l'ancien gabarit est commité, via l'index), `app/crm_app.md`, `app/arb.bat`, `app/arborescence.txt`, `app/security.md`, `app/mail.html`, `.claude/skills/`, `docs/05_SKELETONS.md`.

Les migrations 0039 à 0043 et la nouvelle version de l'Edge Function sont déjà en production ; le code du lot a été poussé ensuite sur GitHub (`ca97dc2`), donc base et application sont alignées. Le comportement réel pour un compte consultant ou client reste à confirmer lors de l'essai réel.

### 2026-10-03 : lot D, étape D1 (migration 0044)

Fait :
- Migration `0044_financements_factures.sql` (appliquée) :
  - `financements` (demande, type `opco`/`cpf`/`france_travail`/`region`/`entreprise`/`autre`, organisme, référence de dossier, montant, statut `en_attente`/`accorde`/`refuse`/`verse`, note). Droits : `peut_voir_demande(demande_id)`, donc l'admin voit tout et un consultant ceux de ses demandes.
  - `factures` (demande, numéro, libellé, montant HT, date d'émission, date de paiement, source `manuelle`/`import`). Droits : admin seulement. Numéro unique quand il est renseigné (l'import s'en servira), jamais vide ou blanc. Une demande qui porte une facture ne peut pas être supprimée (archivage seulement).
  - La notion "payée" se déduit de `date_paiement` ; pas de colonne de statut à tenir à jour.

Vérifié en base (transaction annulée, un consultant simulé à partir d'un compte client) : le consultant crée un financement sur sa demande et pas sur celle d'un autre, ne voit que le sien, ne peut ni créer ni lire une facture ; l'admin voit tous les financements et toutes les factures ; un numéro de facture en double est refusé, deux factures sans numéro sont acceptées, un numéro blanc est refusé ; la suppression d'une demande qui a une facture est refusée ; un client ne voit rien. Après le test : aucune ligne restante, rôle et consultant d'origine intacts.

### 2026-10-03 : lot D, étape D2 (calculs)

Fait :
- `app/js/engine/facturation.js` (nouveau, fonctions pures) : listes et libellés des types et statuts de financement ; `preparerFinancement` / `validerFinancement` et `preparerFacture` / `validerFacture` (virgule décimale acceptée, textes vides en `null`, date d'émission obligatoire, paiement non antérieur à l'émission) ; `syntheseFinancements` ; `estPayee` ; `syntheseFacturation`.
- `engine/finance.js` : `lireNombre` est exporté pour être réutilisé.

Règles de calcul (à relire) :
- Reste à charge = montant retenu moins les financements **accordés ou versés**. Les financements en attente sont affichés à part, les refusés ne comptent pas. Jamais négatif ; l'excédent éventuel est signalé (`surfinance`).
- Facturé = somme des références de factures ; encaissé = celles qui ont une date de paiement ; à encaisser = la différence. Reste à facturer = montant retenu moins facturé, jamais négatif ; un facturé supérieur au montant retenu (ou un montant retenu nul) est signalé en `depassement`.
- Les sommes sont arrondies au centime à chaque ligne (pas d'erreur de virgule flottante).
- Aucune limite à quatre factures par demande : c'est une pratique courante, pas une règle.

Vérifié : `node --test tests/*.test.mjs` 149 réussis (12 nouveaux dans `tests/facturation.test.mjs`), `check-coherence` 0 erreur. Rien d'affichable à tester dans le navigateur à cette étape.

### 2026-10-03 : lot D, étape D3 (carte Financements)

Fait :
- `services/financements.js` (nouveau) : `listerFinancements`, `enregistrerFinancement` (création ou modification), `supprimerFinancement`. Une écriture ou une suppression qui ne touche aucune ligne (droits) est signalée par un message, pas ignorée.
- `components/modale-crm.js` (nouveau) : fenêtre de formulaire commune aux financements et, à l'étape suivante, aux factures (fermeture unique par bouton, fond, Échap ou après l'envoi ; `onEnvoi` retourne `false` pour rester ouverte, une erreur levée s'affiche dans la fenêtre).
- `components/carte-financements.js` (nouveau), insérée dans la vue 360 sous la carte "Enjeu commercial", pour l'admin et le consultant de la demande : trois repères (Financé, En attente, Reste à charge sur le montant retenu), liste des financements (type, organisme, dossier, note, statut, montant) avec Modifier et Supprimer (confirmation), bouton "Ajouter un financement", alerte si les financements dépassent le montant retenu.
- `css/dashboard.css` : lignes de financement (`fi-*`), adaptées au téléphone.
- `engine/finance.js` : rien d'autre que l'export de `lireNombre` (D2).

Vérifié : `node --test tests/*.test.mjs` 149 réussis, `check-coherence` 0 erreur. Page de test avec services simulés (supprimée ensuite) : affichage correct des trois repères et de la liste ; ajout refusé sans montant (fenêtre ouverte, aucun appel) ; ajout valide (appel avec montant 800,5 et statut par défaut "en attente", repères et liste mis à jour) ; modification préremplie puis passage de "En attente" à "Accordé" (le reste à charge baisse en conséquence) ; suppression refusée puis acceptée à la confirmation ; Annuler ferme la fenêtre ; téléphone 375 px sans défilement horizontal. Non testé avec la vraie base et un vrai compte, ni en thème sombre (la page de test s'affiche toujours en clair).

À savoir : le reste à charge part du montant retenu chargé à l'ouverture de la page. Si l'estimation est modifiée dans la carte "Enjeu commercial", la carte Financements ne se met à jour qu'au rechargement de la vue.

### 2026-10-03 : lot D, étape D4 (carte Facturation, admin)

Fait :
- `services/factures.js` (nouveau) : `listerFactures` (triées par date d'émission), `enregistrerFacture` (création, modification, ou simple `date_paiement`), `supprimerFacture`. Un numéro déjà utilisé (erreur 23505) devient "Ce numéro de facture existe déjà." ; une écriture sans effet (droits) est signalée.
- `components/carte-facturation.js` (nouveau), insérée dans la vue 360 **pour l'admin seulement**, entre les cartes Financements et Attribution : repères Facturé (nombre de factures), Encaissé (et reste à encaisser), Reste à facturer (sur le montant retenu) ; liste des factures (libellé, numéro, date d'émission, mention "importée", statut "Payée le ..." ou "À encaisser", montant) ; boutons Payée (date du jour en un clic), Modifier, Supprimer (confirmation précisant que la facture reste dans Shine) ; "Ajouter une facture" ; alerte si le facturé dépasse le montant retenu.
- Formulaire de facture (fenêtre `modale-crm.js`) : numéro, libellé (avec suggestions "Acompte 50 %", "Solde", "Facture unique", saisie libre), montant HT, date d'émission (aujourd'hui par défaut), date de paiement (vide tant que non réglée).
- `engine/facturation.js` : `LIBELLES_FACTURE` et `formaterDateCourte` (+1 test). `css/dashboard.css` : les lignes de financement et de facture passent sur deux lignes quand la place manque.

Le consultant ne voit pas cette carte, et la base lui refuse de toute façon l'accès aux factures (étape D1).

Vérifié : `node --test tests/*.test.mjs` 150 réussis, `check-coherence` 0 erreur. Page de test avec services simulés (supprimée ensuite) : repères initiaux corrects (4 000 facturé, 2 500 encaissé, 1 000 à facturer sur 5 000) ; formulaire refusé sans montant ni date d'émission, puis paiement avant émission refusé (aucun appel envoyé) ; numéro en double : message affiché et fenêtre ouverte ; ajout valide (repères mis à jour) ; "Payée" envoie la date du jour ; modification préremplie ; dépassement signalé (facturé 6 600 sur 5 000) ; suppression après confirmation ; affichage propre à 560 px, sans défilement horizontal. Non testé avec la vraie base et un vrai compte, ni en thème sombre.

### 2026-10-03 : lot D, étape D5 (indicateurs de facturation, admin)

Fait :
- `engine/facturation.js` : `kpisFacturation` (facturé et encaissé de l'année, à encaisser et son nombre de factures), `facturationParMois` (12 derniers mois, facturé et encaissé), `resteAFacturerGagnees` (demandes gagnées dont le montant n'est pas entièrement facturé, jamais négatif par demande). +4 tests.
- `services/factures.js` : `listerToutesFactures` (colonnes utiles seulement).
- Tableau de bord (admin seulement) : une ligne "Facturé {année}", "Encaissé {année}", "À encaisser", "Gagné, à facturer", sous la ligne des indicateurs de CA.
- Page "Indicateurs" (admin) : les mêmes repères avec le nombre de factures ou de demandes concernées, et un tableau "Facturation des 12 derniers mois" (facturé, encaissé, total) avec une note sur les règles de datation.

Règles de datation : facturé = date d'émission ; encaissé = date de paiement (une facture émise en décembre et payée en janvier compte dans les deux mois différents) ; à encaisser = toutes les factures non payées, quelle que soit leur date. Tout en HT.

Vérifié : `node --test tests/*.test.mjs` 154 réussis, `check-coherence` 0 erreur. Pages de test avec services simulés (supprimées ensuite) : page Indicateurs et tableau de bord admin donnent les mêmes chiffres, calculés à la main (7 000 facturé, 5 500 encaissé, 1 500 à encaisser, 1 000 gagné à facturer, tableau mensuel correct) ; avec un rôle consultant, aucun chiffre de finance ni de facturation sur le tableau de bord. Non testé avec la vraie base et un vrai compte.

Limite connue : la lecture de toutes les factures passe par l'API, dont la limite par défaut est de 1 000 lignes par requête (réglage du projet non vérifié). Au rythme actuel c'est très largement suffisant ; au-delà il faudra une vue agrégée côté base.

### 2026-10-03 : lot D, étape D6a (lecteur de l'export Shine)

Constat sur le fichier fourni (`BQ_2021-01-01_2021-12-31.csv`) : c'est l'**export des mouvements bancaires** de Shine, pas une liste de factures. Conséquences :
- Une facture n'y apparaît que si elle a été **payée** (crédit sur le compte). Les factures émises et non payées n'y sont pas.
- Le numéro de facture, le nom du client et la date d'émission ne se lisent que dans le **nom de la pièce jointe** (`FACTURE_3_Nom du client_2021-09-04.pdf`). Le client est un nom de personne ou de société, sans lien avec les fiches du CRM : la demande concernée devra être choisie à l'écran d'import.
- Le fichier contient un IBAN et des noms de tiers : donnée sensible.

Protection : le fichier avait été déposé dans `app/docs/exemples/`, dossier publié sur GitHub Pages et non ignoré par Git. Il a été déplacé dans `docs/exemples/` et ce dossier est ajouté à `.gitignore`. Le fichier n'a jamais été commité ni poussé.

Fait :
- `engine/import-shine.js` (nouveau, fonctions pures) : `decoderCsv` (UTF-8 sinon Windows-1252, BOM retiré), `lireCsv` (guillemets, séparateur, retours à la ligne dans une cellule), `lireMontantCsv`, `lireDateCsv`, `analyserExportBanque` (colonnes retrouvées par leur titre sans accents, message clair si le fichier n'a pas la forme attendue), `extraireFacturesPayees`, `planifierImport`.
- Règles d'extraction : seuls les **crédits** dont la pièce est une facture donnent une facture ; numéro, client et date d'émission viennent du nom de la pièce, la date de paiement est la date d'opération, le montant est le montant HT (sinon le crédit). Plusieurs crédits pour la même facture sont additionnés (date de paiement du dernier). Les autres crédits sont seulement comptés.
- Plan d'import (rien n'est jamais supprimé ni écrasé) : numéro inconnu = "nouvelle" (à créer) ; numéro connu sans date de paiement = "paiement à enregistrer" (on ajoute seulement la date) ; numéro connu avec date de paiement = "déjà à jour". Rejouer le même fichier ne change donc rien.
- Le numéro stocké est celui du nom de la pièce, tel quel (`3`), supposé continu d'une année à l'autre chez Shine.

Vérifié : `node --test tests/*.test.mjs` 163 réussis (9 nouveaux dans `tests/import-shine.test.mjs`, dont un contrôle de comptes sur le vrai fichier, sans donnée personnelle dans le test), `check-coherence` 0 erreur. Les tests utilisent un fichier fabriqué de même forme.

Réponses de l'utilisateur avant D6b : (1) Shine ne propose pas d'export de la liste des factures ; son écran "Nouvel export comptable" propose les transactions (CSV, QIF, OFX) et les documents (factures et relevés en pièces jointes) : le CSV bancaire reste donc la seule source structurée ; (2) choix de la demande ligne par ligne avec suggestion : accepté ; (3) les factures sont numérotées à la suite, sans remise à zéro : le numéro tel quel convient.

### 2026-10-03 : lot D, étape D6b (écran d'import)

Fait :
- `engine/import-shine.js` : `demandesCorrespondantes` (demandes dont le client ressemble au nom du fichier : accents, casse, civilités et formes juridiques ignorés, tous les mots de l'un retrouvés dans l'autre) et `preparerApplication` (plan + choix de l'utilisateur -> factures à créer, dates de paiement à ajouter, factures ignorées faute de demande). Le message d'erreur d'un mauvais fichier cite les vrais titres de colonnes de Shine.
- `services/factures.js` : `listerFacturesImport` ; `appliquerImportFactures` (création en une seule requête, tout ou rien ; puis ajout des dates de paiement manquantes, uniquement quand la date est encore vide ; rien n'est supprimé).
- `views/consultant/import-factures.js` (nouveau), route `#/admin/import-factures` réservée à l'admin, lien "Import Shine" dans le menu admin : choix du fichier, aperçu (nombre de nouvelles, de paiements à enregistrer, de déjà à jour, de virements sans facture ignorés), tableau (numéro, client du fichier, émise le, payée le, montant HT, action, demande), choix de la demande pour chaque facture nouvelle (présélectionnée avec une étoile seulement quand une seule demande correspond ; sinon "Ne pas importer"), résumé, confirmation, puis rechargement de l'aperçu.
- Confidentialité : le fichier est lu dans le navigateur ; seuls le numéro, les dates et le montant des factures retenues partent en base, avec la source `import`. Ni l'IBAN, ni les noms, ni les libellés bancaires ne sont enregistrés.

Vérifié : `node --test tests/*.test.mjs` 165 réussis, `check-coherence` 0 erreur. Page de test avec services simulés et un fichier CSV fabriqué en Windows-1252 (supprimée ensuite) : aperçu exact (une facture à ajouter au paiement, une déjà à jour, deux nouvelles ; la facture payée en deux virements additionnée), présélection correcte quand une seule demande correspond et aucune quand deux correspondent, bouton désactivé tant qu'il n'y a rien à importer, confirmation refusée sans appel, appel exact après confirmation (création des deux factures choisies, date de paiement ajoutée, source `import`), aperçu rechargé ensuite avec tout "déjà à jour" (rejeu sans effet), fichier d'un autre format et fichier vide refusés avec un message clair, affichage lisible. Le vrai fichier d'exemple est aussi lu correctement par les tests (13 mouvements, 4 factures). Non testé avec la vraie base et un vrai compte.

À savoir :
- Le montant importé est la somme encaissée : une facture seulement en partie payée serait enregistrée pour ce qui a été reçu. Il est modifiable ensuite dans la carte Facturation.
- Les factures émises et non payées ne sont pas dans l'export bancaire : elles restent à saisir à la main (ou à compléter par import quand elles sont payées).
- Les factures importées n'ont pas de libellé ("Acompte", "Solde") : à compléter à la main si besoin.

### 2026-10-03 : lot D, étape D7 (clôture)

Fait :
- `docs/01_ARCHITECTURE.md` : routes (carte Financements et Facturation dans la vue 360, facturation dans Indicateurs, `#/admin/import-factures`), tables `financements` et `factures` (section 7), droits (section 8.2), ligne du lot D (section 17).
- Contrôle d'ensemble : 165 tests réussis, `check-coherence` 0 erreur, aucun tiret cadratin dans les lignes ajoutées.
- Audit de sécurité Supabase relancé après la migration 0044 : aucune alerte nouvelle ; les nouvelles tables ont leur RLS (aucune alerte "RLS désactivée"). Restent les alertes d'avant le lot : `get_my_role` et `update_updated_at_column` sans `search_path` fixe, `est_staff`, `get_my_role`, `handle_new_user` et `rls_auto_enable` appelables sans connexion, fonctions `security definer` appelables par un compte connecté (19, aucune nouvelle : le lot D n'ajoute pas de fonction), protection contre les mots de passe compromis désactivée.

Fichiers du lot D (commit) :
- Nouveaux : `supabase/migrations/0044_financements_factures.sql`, `app/js/engine/facturation.js`, `app/js/engine/import-shine.js`, `app/js/services/financements.js`, `app/js/services/factures.js`, `app/js/components/carte-financements.js`, `app/js/components/carte-facturation.js`, `app/js/components/modale-crm.js`, `app/js/views/consultant/import-factures.js`, `tests/facturation.test.mjs`, `tests/import-shine.test.mjs`.
- Modifiés : `app/js/engine/finance.js` (export de `lireNombre`), `app/js/views/consultant/vue-360.js`, `tableau-de-bord.js`, `indicateurs.js`, `app/js/main.js`, `app/js/components/entete.js`, `app/css/dashboard.css`, `.gitignore` (`docs/exemples/`), `docs/01_ARCHITECTURE.md`, `docs/changes.md`.
- Non inclus (travaux sans rapport avec ce lot) : `app/assets/images/logo.svg`, `supabase/functions/creer-compte/mail.ts`, `supabase/functions/envoyer-notification-email/index.ts` (nouveau gabarit, déjà en production dans son ancienne version), `app/crm_app.md`, `app/new_design.md`, `app/arb.bat`, `app/arborescence.txt`, `app/security.md`, `app/mail.html`, `.claude/skills/`, `docs/05_SKELETONS.md`. Le dossier `docs/exemples/` (export bancaire réel) est ignoré par Git.

La migration 0044 est appliquée sur la base de production.

### 2026-10-03 : lot D, retouche de l'écran d'import (retour de l'utilisateur)

Premier essai de l'écran avec le vrai fichier d'exemple : l'aperçu et le choix des demandes fonctionnent (4 factures nouvelles, 1 virement sans facture ignoré). Demande : un bouton "Annuler".

Fait :
- `views/consultant/import-factures.js` : bouton "Annuler" à côté de "Appliquer l'import". Il oublie le fichier et l'aperçu (champ fichier vidé, choix de demandes effacés, focus rendu au champ fichier) ; rien n'a été enregistré avant "Appliquer". Le même fichier peut être rechoisi ensuite.
- `css/dashboard.css` : un bouton `db-btn` désactivé est maintenant grisé (opacité réduite, curseur interdit). Avant, "Appliquer l'import" gardait l'aspect d'un bouton actif quand il n'y avait rien à importer.

Vérifié : `node --test tests/*.test.mjs` 165 réussis, `check-coherence` 0 erreur ; page de test avec services simulés (supprimée ensuite) : Annuler vide l'aperçu et le champ fichier, le même fichier se recharge, le bouton Appliquer est grisé et désactivé quand aucune demande n'est choisie.

### 2026-10-03 : lot E, étape E1 (fusion de clients, migration 0045)

Fait :
- Migration `0045_fusion_clients.sql` (appliquée) :
  - Table `doublons_ignores` (couple de clients, ordre canonique, supprimée en cascade avec l'un des clients) : admin seulement.
  - `rpc_fusionner_clients(p_garder, p_absorber)`, `security definer`, admin seulement, en une seule transaction (les deux fiches sont verrouillées dans un ordre fixe). Elle déplace demandes, échanges et tâches ; fusionne les contacts de même e-mail (casse ignorée : échanges et tâches rattachés au contact gardé, ses champs vides complétés) et déplace les autres, le contact principal de l'ancienne fiche perdant ce statut si la fiche gardée en a déjà un ; supprime l'ancienne fiche **avant** de compléter la fiche gardée (le SIRET, unique, redevient libre) ; complète les champs vides sans rien écraser ; un prospect devient client si l'autre l'était ; concatène les notes ; reprend le responsable s'il manquait ; écrit une note dans l'historique ("Fusion avec ...", ancien SIRET et identifiant, nombres déplacés). Elle renvoie ces nombres.
- Pourquoi dans une fonction : à la suppression d'un client, ses contacts, échanges et tâches partent avec (cascade) et ses demandes bloquent la suppression ; il faut donc tout déplacer avant.
- Les fichiers de Storage ne bougent pas : leur droit d'accès repose sur la référence de la demande (2e segment du chemin), pas sur le client.

Vérifié en base (transactions annulées, un consultant simulé à partir d'un compte client) : le consultant est refusé ("Réservé à l'administrateur") ; fusionner un client avec lui-même et un client inconnu sont refusés ; la fusion déplace 1 demande, 1 échange, 1 tâche, déplace 1 contact et en fusionne 1 (même e-mail en casse différente) ; un seul contact principal reste ; l'échange et la tâche pointent le contact gardé, dont le téléphone et la fonction sont complétés ; la fiche gardée reprend SIRET, ville, OPCO et responsable de l'autre, devient client, ses notes sont concaténées avec l'en-tête ; l'historique contient la ligne de fusion ; le couple ignoré est supprimé avec la fiche absorbée. Second essai : quand les deux fiches ont des valeurs, celles de la fiche gardée sont conservées (SIRET, ville, statut client) et les notes manquantes sont reprises. Après les tests : aucun client de test, rôle et demande d'origine intacts.

### 2026-10-03 : lot E, étape E2 (calculs)

Fait (fonctions pures, sans écran ni base) :
- `engine/texte.js` (nouveau) : `normaliserTexte` (accents et casse), `normaliserMots` (sans ponctuation), `chiffres`. `fiche-client.js` s'en sert à la place de sa copie locale.
- `engine/doublons.js` (nouveau) : `jetonsNom` (mots du nom sans formes juridiques ni mots de liaison), `nomsProches` (mêmes mots, ou tous ceux du plus court dans l'autre, au moins 4 lettres), `cleCouple`, `detecterDoublons` (noms proches ET même ville ou même code postal, nom commercial compris ; même e-mail de contact chez deux clients ; archivés et couples ignorés écartés ; les couples aux raisons cumulées d'abord), `planifierFusion` (résumé avant confirmation : champs complétés, contacts fusionnés ou déplacés, perte du contact principal, passage en client, notes, responsable repris, nombres de demandes, échanges et tâches).
- `engine/dormants.js` (nouveau) : `clientsDormants` (statut client, au moins une demande gagnée, **aucune demande en cours**, dernière activité plus ancienne que le seuil ; les plus anciens d'abord), `moisEcoules`, `libelleInactivite`, `SEUILS_DORMANT` (6, 9, 12, 18, 24), `preparerRelanceDormant` (tâche "Relancer <client>" du jour, type `relance`).
- `engine/recherche.js` (nouveau) : `rechercher` sur des listes déjà chargées (clients : nom, nom commercial, ville, SIRET, e-mail, téléphone ; contacts : nom, e-mail, téléphone ; demandes : référence, client ; factures : numéro, si l'admin les fournit), accents et casse ignorés, tous les mots requis, SIRET et téléphones comparés sans espaces dès 3 chiffres, meilleure correspondance d'abord (identique, commence par, un mot commence par, contient), 5 résultats par groupe avec le total, liens vers les fiches. Terme de moins de 2 caractères utiles : aucun résultat.

Choix à relire :
- Un client avec une demande en cours n'est jamais dormant, même si sa dernière activité est ancienne : c'est une précision par rapport à la décision validée ("aucune activité depuis N mois"), pour ne pas relancer un client qui a un dossier ouvert.
- La recherche se fait sur des listes chargées dans le navigateur (accents ignorés, droits respectés puisque la base ne renvoie que les données visibles). Elle sera adaptée à l'étape E3 pour charger par pages au-delà de 1 000 lignes.
- Les contacts sont rapprochés par e-mail en ignorant casse et accents côté écran ; la fusion en base ignore la casse seulement. Écart sans conséquence pour des adresses e-mail réelles.

Vérifié : `node --test tests/*.test.mjs` 191 réussis (26 nouveaux : `tests/doublons.test.mjs`, `dormants.test.mjs`, `recherche.test.mjs`), `check-coherence` 0 erreur.

### 2026-10-03 : lot E, étape E3 (recherche globale)

Fait :
- `services/recherche.js` (nouveau) : chargement des clients (`v_clients`), contacts, demandes et, pour l'admin, factures, **par pages de 1 000 lignes** jusqu'à la dernière (la base plafonne chaque requête) ; résultat gardé 60 secondes en mémoire ; un échec n'est pas gardé ; `invaliderRecherche()` pour vider la mémoire (à appeler après une fusion). Les droits sont ceux de la base : un consultant ne reçoit que ses clients, contacts et demandes.
- `components/recherche-globale.js` (nouveau) : champ de la barre du haut (personnel seulement, pas pour un client ni en aperçu client), chargement à la prise de focus, résultats groupés sous le champ (Clients, Contacts, Demandes, Factures pour l'admin) avec le détail (ville et SIRET, client et e-mail...), "Clients (5 sur 8)" quand il y en a plus que montrés. Clavier : flèches haut et bas (boucle), Entrée ouvre le résultat choisi, Échap ferme et vide, "/" place le curseur dans le champ depuis n'importe où hors saisie. Messages : "Tapez au moins 2 caractères", "Chargement…", "Aucun résultat pour « ... »", "Recherche indisponible : ..." (nouvel essai au retour dans le champ). Accessibilité : rôle `combobox` et `listbox`, `aria-activedescendant`, groupes nommés.
- `components/entete.js` : montage de la barre entre le titre et les outils ; `css/dashboard.css` : style de la barre et de la liste (clair et sombre par les variables) ; sur téléphone le titre de page disparaît pour laisser la place au champ et la liste s'ouvre sur toute la largeur.

Vérifié : `node --test tests/*.test.mjs` 191 réussis, `check-coherence` 0 erreur. Page de test avec une barre du haut reconstituée et un service simulé (supprimée ensuite) : "/" donne le focus ; 1 caractère = message d'aide ; résultats groupés corrects (accents ignorés : "societe gener" trouve "Société Générale du Sud") ; facture trouvée par son numéro pour l'admin et demandée seulement pour lui (`avecFactures` vrai pour l'admin, faux sinon) ; aucun résultat et panne signalés ; flèches (parcours en boucle), `aria-activedescendant` mis à jour ; Entrée ouvre `#/clients/<id>/contacts`, ferme la liste et vide le champ ; Échap ferme et vide ; affichage lisible à 375 px sans défilement horizontal. Non testé avec la vraie base, ni dans la vraie barre du haut (l'en-tête complet dépend de la connexion), ni en thème sombre.

À savoir : les listes sont chargées entièrement dans le navigateur à la première utilisation de la session (puis toutes les minutes au plus). C'est adapté à quelques milliers de lignes ; au-delà il faudra une recherche côté base.

### 2026-10-03 : lot E, étape E4 (écran des doublons)

Fait :
- `services/doublons.js` (nouveau) : contacts pour la détection, couples ignorés (lecture, `ignorerCouple`, `retablirCouple`, enregistrés dans l'ordre exigé par la table), `compterRattaches` (demandes, échanges, tâches d'un client), `fusionnerClients` (appel de `rpc_fusionner_clients`).
- `views/consultant/clients-doublons.js` (nouveau), route `#/clients/doublons` **réservée à l'admin** (un consultant est renvoyé vers la liste des clients), bouton "Doublons" dans la liste des clients (admin seulement) : une carte par couple (les deux fiches avec ville, SIRET, statut, nombre de demandes, liens vers les fiches ; les raisons du rapprochement) avec trois actions :
  - **Comparer** : tableau côte à côte en lecture seule, les lignes qui diffèrent sont surlignées.
  - **Fusionner** : choix de la fiche à garder (par défaut celle qui porte le plus de demandes), résumé qui se met à jour selon le choix (ce qui passe sur la fiche gardée, contacts déplacés ou fusionnés, perte du contact principal, champs complétés, passage en client, notes, responsable, suppression de l'ancienne fiche), case "Je comprends que cette fusion est définitive" ; le bouton "Fusionner définitivement" reste désactivé tant qu'elle n'est pas cochée ; après la fusion, message, mémoire de la recherche vidée et liste rechargée.
  - **Ignorer** : le couple n'est plus proposé ; section dépliable "Couples ignorés (n)" avec "Remettre dans la liste".
- `components/modale-crm.js` : fenêtre en lecture seule possible (sans `libelleEnvoi` : un bouton "Fermer"), option `large`, retour de `{ envoyer, fermer }` pour désactiver le bouton d'envoi. Les usages existants (financements, factures) sont inchangés.
- `components/entete.js` (titre de page), `main.js` (route placée avant `#/clients/:id`), `css/dashboard.css` (styles `dbl-*`, fenêtre large).

Vérifié : `node --test tests/*.test.mjs` 191 réussis, `check-coherence` 0 erreur. Page de test avec services simulés (supprimée ensuite) : 2 couples détectés (dont un par e-mail seulement) et le couple déjà ignoré absent ; comparaison avec les 8 lignes qui diffèrent surlignées et un seul bouton "Fermer" ; fusion : fiche à garder présélectionnée correctement, résumé exact dans les deux sens (ex. garder la fiche sans SIRET : SIRET, OPCO, téléphone et source complétés, passage en client, responsable repris, contact principal perdu), bouton désactivé tant que la case n'est pas cochée, soumission sans case sans appel, échec affiché dans la fenêtre restée ouverte, puis succès avec l'appel `fusion(a2, a1)`, message, recherche invalidée et liste rechargée ; ignorer et remettre dans la liste (appels exacts, section mise à jour) ; affichage correct à 375 px sans défilement horizontal. La fonction de fusion elle-même a été vérifiée en base à l'étape E1. Non testé avec la vraie base et un vrai compte.

### 2026-10-03 : lot E, étape E5 (clients dormants)

Fait :
- `views/consultant/clients.js` : nouveau choix "Clients dormants" dans le filtre de statut de la liste des clients, accessible aussi par la route `#/clients/dormants` (personnel). Un second choix apparaît alors : "Sans activité depuis 6, 9, 12 (par défaut), 18 ou 24 mois". Le tableau montre l'entreprise, le contact principal, la dernière activité, "Inactif depuis N mois", le CA signé (admin seulement) et un bouton "Créer une tâche de relance" (avec le nombre de tâches déjà ouvertes). La recherche de la liste s'applique aussi. Le bouton crée la tâche "Relancer <client>" du jour, type `relance`, description "Client dormant : dernière activité il y a N mois", confiée au **responsable du client** ou, à défaut, à l'utilisateur connecté (un consultant la crée toujours pour lui : la base l'impose) ; le bouton devient "Relance créée" ; un échec réactive le bouton et affiche le message.
- `components/carte-dormants.js` (nouveau) et `views/consultant/tableau-de-bord.js` : bloc "N clients dormants" (seuil de 12 mois, 5 lignes avec le temps d'inactivité, CA signé pour l'admin seulement) avec le lien "Voir les N clients dormants" ; le bloc n'apparaît pas quand il n'y en a aucun. Le tableau de bord charge pour cela la liste des clients de l'utilisateur (le consultant ne voit que ses clients).
- `main.js` (route `#/clients/dormants` avant `#/clients/:id`), `components/entete.js` (titre de page), `css/dashboard.css`.

Vérifié : `node --test tests/*.test.mjs` 191 réussis, `check-coherence` 0 erreur. Pages de test avec services simulés (supprimées ensuite) : liste préfiltrée par la route, compteur et colonnes exacts ; les deux dormants à 12 mois sont triés du plus ancien au plus récent, un client à 11 mois n'apparaît qu'avec le seuil de 9 mois ; ni prospect, ni client actif, ni client avec une demande en cours ; recherche dans la vue ; création de relance avec les bonnes valeurs (responsable du client, sinon utilisateur connecté), bouton remplacé, échec géré ; retour à la vue normale (colonnes d'origine, 6 lignes) ; vue consultant sans colonne CA ni bouton "Doublons" ; bloc du tableau de bord avec CA pour l'admin et sans CA sinon, absent s'il n'y a aucun dormant ; lisibilité correcte. Le tableau de bord complet n'a pas été chargé en entier avec la page de test (seul le bloc l'a été, la syntaxe de la vue est vérifiée). Non testé avec la vraie base et un vrai compte.

### 2026-10-03 : lot E, étape E6 (clôture)

Fait :
- `docs/01_ARCHITECTURE.md` : routes (`#/clients/dormants`, `#/clients/doublons`, filtre des dormants, recherche globale de la barre du haut, bloc du tableau de bord), table `doublons_ignores` (section 7), fonction `rpc_fusionner_clients` avec ses règles (section 7), droits (section 8.2), ligne du lot E (section 17).
- Contrôle d'ensemble : 191 tests réussis, `check-coherence` 0 erreur, aucun tiret cadratin dans les lignes ajoutées.
- Audit de sécurité Supabase relancé après la migration 0045 : aucune alerte nouvelle sauf la présence de `rpc_fusionner_clients` dans les fonctions `security definer` appelables par un compte connecté (20 au lieu de 19), ce qui est voulu : elle vérifie elle-même que l'appelant est admin (testé à l'étape E1). Pas d'alerte "RLS désactivée" sur `doublons_ignores`. Restent les alertes d'avant le lot (`get_my_role` et `update_updated_at_column` sans `search_path` fixe, quatre fonctions appelables sans connexion, protection contre les mots de passe compromis désactivée).

Fichiers du lot E (commit) :
- Nouveaux : `supabase/migrations/0045_fusion_clients.sql`, `app/js/engine/texte.js`, `doublons.js`, `dormants.js`, `recherche.js`, `app/js/services/recherche.js`, `doublons.js`, `app/js/components/recherche-globale.js`, `carte-dormants.js`, `app/js/views/consultant/clients-doublons.js`, `tests/doublons.test.mjs`, `dormants.test.mjs`, `recherche.test.mjs`.
- Modifiés : `app/js/engine/fiche-client.js` (utilise `texte.js`), `app/js/components/modale-crm.js` (lecture seule, option large, retour du bouton d'envoi), `entete.js` (barre de recherche, titres), `app/js/views/consultant/clients.js`, `tableau-de-bord.js`, `app/js/main.js`, `app/css/dashboard.css`, `docs/01_ARCHITECTURE.md`, `docs/changes.md`.
- Non inclus (travaux sans rapport avec ce lot) : `app/assets/images/logo.svg`, `supabase/functions/creer-compte/mail.ts`, `supabase/functions/envoyer-notification-email/index.ts`, `app/crm_app.md`, `app/new_design.md`, `app/arb.bat`, `app/arborescence.txt`, `app/security.md`, `app/mail.html`, `.claude/skills/`, `docs/05_SKELETONS.md`.

La migration 0045 est appliquée sur la base de production.

### 2026-10-03 : lot F, étape F1 (journal d'audit, migration 0046)

Fait :
- Migration `0046_journal_audit.sql` (appliquée) :
  - Table `audit_log` : date, compte (identifiant et nom ou e-mail **au moment du changement**, lisible même si le compte disparaît), action (`insert`, `update`, `delete`), table, identifiant de la ligne, fiche client et demande de contexte (sans clé étrangère : l'historique survit à une fusion ou une suppression), nom lisible de la ligne, et `changes` = `{ colonne: [avant, après] }`.
  - **Ajout seul** : RLS avec une seule politique de lecture réservée à l'admin ; `insert`, `update`, `delete` retirés aux rôles `anon` et `authenticated` (seul le déclencheur, en `security definer`, écrit). Seul un accès de service peut purger.
  - Fonction `fn_audit()` et déclencheurs `after insert or update or delete` sur `clients`, `contacts`, `demandes`, `taches`, `activites`, `financements`, `factures`, `demande_enjeux`. Les colonnes `created_at` et `updated_at` sont ignorées ; une mise à jour qui ne change rien d'autre n'écrit rien ; à la création et à la suppression seules les colonnes renseignées sont notées. Sans compte (SQL, fonctions de service), l'auteur est "Système".
  - Tables des autres applications de la base : non concernées.
  - Le journal part de zéro : les changements antérieurs à la migration n'y figurent pas.
- `engine/audit.js` (nouveau) : libellés des tables, actions et colonnes, phrase lisible ("Marie Dupont a modifié un client : ABC Formation"), mise en forme des valeurs (vide, oui ou non, dates, comptes par leur nom, textes longs coupés), liens vers la fiche ou la demande. `services/audit.js` : lecture par pages de 50, plus récentes d'abord, filtres table, fiche, compte, période, texte.
- `components/liste-journal.js` et `views/consultant/journal.js` : page **Journal d'audit** (`#/admin/journal`, admin seulement, lien dans le menu admin) avec recherche, type d'élément, compte et période, détail des champs changés sous chaque entrée, "Voir les entrées plus anciennes". `client-fiche.js` : onglet **Modifications** (admin seulement) avec le journal de la fiche (ses contacts, demandes, échanges, tâches, financements et factures compris).

Vérifié en base (transactions annulées, un consultant simulé à partir d'un compte client) : création, modification (seules les colonnes changées, avec avant et après) et suppression notées ; une mise à jour sans changement n'écrit rien ; le contexte client est retrouvé pour un contact et pour une facture (via sa demande) ; l'auteur est le nom du compte ("Système" sans compte) ; l'admin lit le journal, un consultant n'y voit aucune ligne ; un `insert` direct, un `update` et un `delete` du journal sont refusés, même à l'admin ; la création d'une fiche par un consultant est bien notée malgré l'absence de droit d'écriture ; une fusion de fiches note le déplacement de la demande et la suppression de l'ancienne fiche. Après les tests : journal vide, aucune fiche de test, rôle d'origine intact.
Vérifié : `node --test tests/*.test.mjs` 197 réussis (6 nouveaux dans `tests/audit.test.mjs`), `check-coherence` 0 erreur. Page de test avec un service simulé (supprimée ensuite) : liste, création, modification et suppression avec les bons badges et liens (aucun lien pour une fiche supprimée) ; détail des champs (avant → après, création et suppression à une seule valeur, notes coupées) ; "plus anciennes" avec la bonne suite ; filtres type, recherche et période envoyés ; mode "fiche" sans filtres ; message "aucune entrée". Non testé avec la vraie base et un vrai compte.

Limites : le journal ne note pas les consultations ni l'adresse IP ; les changements de la table `propositions`, des réponses au questionnaire et des notes de cadrage n'y figurent pas (leur historique reste dans `evenements` et `reponses_historique`) ; il garde d'anciennes valeurs, y compris des coordonnées (voir les points ouverts).

### 2026-10-03 : lot F, étape F2 (consentements, migration 0047)

Fait :
- Migration `0047_consentements.sql` (appliquée) :
  - Table `consentements` : une ligne par contact et par type (`email_commercial`, `telephone`, `lettre_information`, unique), statut `accorde`, `refuse` ou `retire`, date, source, preuve (texte libre), expiration (jamais avant la date du consentement), date de retrait. Un consentement retiré prend la date du jour comme date de retrait ; redonné, elle est effacée (déclencheur). Les changements successifs se lisent dans le journal d'audit.
  - Droits : le personnel qui voit le client du contact (`peut_voir_client`) ; un compte client n'y a aucun accès.
  - `fn_audit()` apprend la table (fiche client retrouvée par le contact) et un déclencheur la journalise.
- `engine/consentements.js` (nouveau) : types, statuts, suggestions de source, `etatConsentement` (un accord dont l'expiration est dépassée est "expiré" ; le jour d'expiration compris reste valable), `consentementActif`, `sansConsentementEmail`, `preparerConsentement` / `validerConsentement` (source exigée pour un accord seulement), `donneesARevoir` (fiches de tous statuts, archivées comprises, sans activité depuis 36 mois ou plus ; consentements accordés expirés).
- `services/consentements.js`, `components/consentements-contact.js` (nouveau) : bloc "Consentements" dans chaque carte de contact (état, détail, bouton Renseigner ou Modifier ouvrant une fenêtre), repère "Sans consentement e-mail" quand le contact a une adresse sans consentement actif (jamais renseigné, refusé, retiré ou expiré). `views/consultant/client-contacts.js` charge les consentements avec les contacts.
- `views/consultant/donnees-a-revoir.js` (nouveau), route `#/admin/donnees-a-revoir` (admin seulement, lien dans le menu) : fiches à revoir et consentements expirés, avec liens vers les fiches ; **rien n'est supprimé**, l'admin décide depuis la fiche. `components/carte-donnees-a-revoir.js` et `tableau-de-bord.js` : alerte "Données à revoir" pour l'admin, absente quand il n'y a rien.

Vérifié en base (transactions annulées, un consultant simulé à partir d'un compte client) : le consultant crée un consentement sur son contact et pas sur celui d'autrui ; un second consentement du même type, un type inconnu et une expiration antérieure à la date sont refusés ; retrait puis nouvel accord gèrent la date de retrait ; le client invité ne voit et n'écrit rien ; l'admin voit tout ; le journal retrouve le contact et la fiche ; la suppression du contact emporte ses consentements. Base propre ensuite.
Vérifié : `node --test tests/*.test.mjs` 205 réussis (8 nouveaux dans `tests/consentements.test.mjs`), `check-coherence` 0 erreur. Pages de test avec services simulés (supprimées ensuite) : états et détails exacts par contact, repère "Sans consentement e-mail" correct (absent sans adresse), fenêtre (valeurs par défaut, source obligatoire, expiration incohérente refusée sans appel, enregistrement avec les bons champs, préremplissage à la modification, retrait qui fait apparaître le repère), écran "Données à revoir" et alerte du tableau de bord (comptes, liens, absence quand rien à revoir). Non testé avec la vraie base et un vrai compte, ni en thème sombre.

Limites : le repère "Sans consentement e-mail" signale un manque, il n'empêche aucun envoi (l'application n'envoie pas d'e-mails commerciaux) ; la durée de 36 mois est fixe dans le code (pas de table de règles, décision validée).

### 2026-10-03 : lot F, étape F3 (réclamations, migration 0048)

Fait :
- Migration `0048_reclamations.sql` (appliquée) :
  - Table `reclamations` : client, demande facultative, date de réception, objet (non vide), description, gravité (`mineure`, `majeure`, `critique`), statut (`ouverte`, `en_cours`, `cloturee`), responsable, action corrective, date de clôture, créateur. **Une réclamation ne se clôture qu'avec une action corrective** (contrainte en base) ; la date de clôture se met toute seule (aujourd'hui) et s'efface à la réouverture ; la demande doit appartenir au client ; sans responsable, le créateur le devient.
  - Droits : le personnel qui voit le client (`peut_voir_client`) ; un consultant ne voit que celles de ses clients ; un compte client n'y a aucun accès.
  - Une fiche client qui porte des réclamations ne peut pas être supprimée (`on delete restrict` : trace qualité).
  - `fn_audit()` apprend la table (et les avis de satisfaction de l'étape suivante) ; un déclencheur la journalise.
  - `rpc_fusionner_clients` est mise à jour : la fusion déplace aussi les réclamations (et, plus tard, les avis de satisfaction : une table absente est ignorée) et les compte dans l'historique et dans son résultat (`reclamations_et_avis`).
- `engine/reclamations.js` (nouveau) : gravités, statuts, `validerReclamation` (objet, date, action corrective pour clôturer), `preparerReclamation`, `delaiTraitementJours`, `kpisReclamations` (ouvertes, en cours, clôturées, critiques non clôturées, délai moyen de traitement), `filtrerReclamations` (statut, gravité, recherche sans accents sur l'objet, la description, le client et la référence).
- `services/reclamations.js`, `components/liste-reclamations.js`, `views/consultant/reclamations.js` (nouveaux) : page **Réclamations** (`#/reclamations`, personnel, lien dans le menu) avec trois indicateurs (ouvertes, total, délai moyen de traitement), filtres (ouvertes et en cours par défaut, toutes, clôturées ; gravité ; recherche) et liste (gravité, statut, date, objet, client, demande, description, responsable, délai de clôture, action corrective) ; bouton "Nouvelle réclamation" ouvrant une fenêtre (client, demande du client, date, objet, gravité, statut, responsable, description, action corrective) ; modification depuis chaque ligne (client verrouillé). Onglet **Réclamations** sur chaque fiche client (même liste, client imposé).

Vérifié en base (transactions annulées, un consultant simulé à partir d'un compte client) : responsable par défaut = créateur ; création refusée sur le client d'un autre, avec un objet vide, avec la demande d'un autre client ; clôture refusée sans action corrective, acceptée avec, date de clôture automatique, effacée à la réouverture ; le consultant ne voit que la sienne, le client rien, l'admin tout ; le journal note les changements ; la suppression d'une fiche qui porte une réclamation est refusée à l'admin (clé étrangère) ; la fusion de deux fiches déplace la réclamation (`reclamations_et_avis` = 1). Base propre ensuite.
Vérifié : `node --test tests/*.test.mjs` 211 réussis (6 nouveaux dans `tests/reclamations.test.mjs`), `check-coherence` 0 erreur. Page de test avec un service simulé (supprimée ensuite) : indicateurs et filtres exacts, recherche, fenêtre (client et objet obligatoires sans appel ; demandes proposées selon le client ; clôture sans action corrective refusée avec message ; création avec les bons champs et sans responsable pour laisser la base le choisir ; préremplissage et client verrouillé à la modification ; clôture qui met à jour les indicateurs), mode "fiche" sans filtres ni indicateurs. Non testé avec la vraie base et un vrai compte, ni en thème sombre.

Limites : le client ne dépose pas de réclamation lui-même (décision validée) ; pas de pièce jointe ni de contact rattaché à la réclamation ; la page Réclamations montre au consultant ses clients seulement.

### 2026-10-03 : lot F, étape F4 (satisfaction, migration 0049)

Fait :
- Migration `0049_satisfactions.sql` (appliquée) :
  - Table `satisfactions` : demande, client (déduit de la demande par la base), moment (`chaud` ou `froid`), statut (`demandee`, `recue`, `sans_reponse`), note 1 à 5, commentaire, date d'envoi, date de réponse, origine (`client` ou `staff`). **Un seul avis par demande et par moment** ; un avis reçu exige une note ; un avis qui n'est plus "reçu" perd sa note ; la demande et le moment ne se modifient pas.
  - Droits : le personnel qui voit le client lit et écrit ; un client invité sur la demande **lit** ses avis mais ne peut rien écrire directement.
  - Demande d'avis : une notification "Votre avis nous intéresse" (lien vers l'accueil) est créée pour chaque compte client invité sur la demande (aucun e-mail, décision validée : la fonction d'e-mails n'est pas touchée).
  - `rpc_repondre_satisfaction(avis, note, commentaire)` (`security definer`) : le client (ou le personnel) répond à un avis demandé ; refuse un avis inconnu ou hors de sa demande, une seconde réponse, une note hors de 1 à 5 ; la réponse porte la date du jour et son origine ; le consultant de la demande reçoit la notification "Avis de satisfaction reçu".
  - Journal d'audit et fusion de clients : déjà prêts depuis l'étape F3 (les avis suivent la fiche gardée).
- `engine/satisfactions.js` (nouveau) : moments, statuts, `etoiles`, `lireNote`, `validerReponse` / `preparerReponse`, `avisParMoment`, `kpisSatisfaction` (reçus, en attente, sans réponse, moyenne, taux de réponse, détail à chaud et à froid).
- `services/satisfactions.js` (nouveau), `components/carte-satisfaction.js` : carte **Satisfaction** dans la vue 360 d'une demande (personnel) avec l'avis à chaud et l'avis à froid : "Demander l'avis", "Saisir un avis reçu" (fenêtre : note et commentaire, pour une réponse reçue autrement), "Saisir la réponse" et "Sans réponse" sur un avis demandé ; un avis reçu affiche les étoiles, la date, l'origine (répondu par le client ou saisi par l'équipe) et le commentaire.
- `components/carte-avis-client.js` et `views/client/dashboard.js` : carte "Votre avis nous intéresse" en tête du tableau de bord du client, pour chaque avis demandé (note de 1 à 5 en cases avec étoiles, commentaire facultatif, "Envoyer mon avis") ; absente quand rien n'est demandé et en aperçu client de l'admin.

Vérifié en base (transactions annulées, un consultant et deux comptes clients simulés) : le client est déduit de la demande ; un doublon (demande, moment) est refusé ; le client invité reçoit la notification et pas un autre client ; il voit son avis, ne peut pas le modifier directement (0 ligne), ne peut pas envoyer une note de 7 ni répondre deux fois ; un client sans accès à la demande ne voit rien et ne peut pas répondre ("Avis introuvable") ; la saisie manuelle du personnel prend l'origine `staff` ; le passage en "sans réponse" efface la note ; changer le moment est refusé ; un avis "reçu" sans note est refusé ; le journal note les changements ; le consultant est prévenu de la réponse. Base propre ensuite.
Vérifié : `node --test tests/*.test.mjs` 218 réussis (7 nouveaux dans `tests/satisfactions.test.mjs`), `check-coherence` 0 erreur. Pages de test avec un service simulé (supprimées ensuite) : carte de l'équipe (demande, saisie manuelle avec note obligatoire, sans réponse) et carte du client (note obligatoire sans appel, échec serveur affiché avec bouton réactivé, envoi puis disparition de la carte) ; lisibilité correcte. Non testé avec la vraie base et de vrais comptes (client et consultant), ni en thème sombre ; le tableau de bord client complet n'a pas été chargé en entier (syntaxe vérifiée).

Limites : pas d'e-mail ni de relance automatique (décision validée) : le client voit la demande à sa prochaine visite et la notification dans l'application ; un avis ne se supprime pas depuis l'application.

### 2026-10-03 : lot F, étape F5 (indicateurs qualité, exports CSV)

Fait :
- `views/consultant/indicateurs.js` (page admin) : nouvelle section **Qualité : satisfaction et réclamations** avec quatre repères (satisfaction moyenne sur 5, taux de réponse aux avis = reçus sur demandés, réclamations ouvertes, délai moyen de traitement en jours), un tableau des avis par moment (à chaud, à froid : demandés, reçus, note moyenne) et un tableau des réclamations par gravité (total, ouvertes), une note qui explique les calculs (sans réponse, en attente, délai), et deux boutons d'export. Leur indisponibilité n'empêche pas la page.
- `engine/satisfactions.js` : `COLONNES_CSV_AVIS` ; `engine/reclamations.js` : `COLONNES_CSV_RECLAMATIONS`. Exports **Exporter les avis (CSV)** (demande, client, moment, statut, dates, note, commentaire, réponse saisie par le client ou par l'équipe : preuve de l'indicateur 30) et **Exporter les réclamations (CSV)** (client, demande, dates, objet, description, gravité, statut, délai de traitement, action corrective : preuve de l'indicateur 31). Séparateur point-virgule, dates en jj/mm/aaaa, comme les autres exports ; "Rien à exporter" quand la liste est vide.

Vérifié : `node --test tests/*.test.mjs` 220 réussis (2 tests d'export ajoutés), `check-coherence` 0 erreur. Page de test avec services simulés (supprimée ensuite) : repères exacts (4,5 sur 5 pour deux avis reçus de 5 et 4, taux de réponse 50 % pour 2 reçus sur 4 demandés, 2 réclamations ouvertes sur 3, délai moyen de 10 jours), tableaux par moment et par gravité corrects, les deux fichiers CSV produits avec les bons en-têtes et valeurs. Non testé avec la vraie base et un vrai compte, ni en thème sombre.

Limites : les indicateurs portent sur tous les avis et réclamations visibles de l'admin, sans filtre de période (à ajouter si le volume le justifie) ; le CSV des réclamations n'indique pas le responsable.

### 2026-10-03 : lot F, étape F6 (clôture)

Fait :
- `docs/01_ARCHITECTURE.md` : routes (réclamations, journal d'audit, données à revoir, onglets de la fiche client, carte Satisfaction de la vue 360, avis sur l'accueil du client, qualité dans les indicateurs), tables `audit_log`, `consentements`, `reclamations` et `satisfactions` (section 7), fonctions `fn_audit` et `rpc_repondre_satisfaction` et mise à jour de la fusion (section 7), droits (section 8.2), notifications de satisfaction (section 16), ligne du lot F (section 17).
- Contrôle d'ensemble : 220 tests réussis, `check-coherence` 0 erreur, aucun tiret cadratin dans les lignes ajoutées.
- Audit de sécurité Supabase relancé après les migrations 0046 à 0049 : aucune alerte nouvelle sauf la présence de `rpc_repondre_satisfaction` dans les fonctions `security definer` appelables par un compte connecté (21 au lieu de 20), voulue : elle vérifie elle-même l'accès à la demande, refuse une seconde réponse et une note hors de 1 à 5 (testé à l'étape F4). Aucune alerte "RLS désactivée" sur les nouvelles tables. Restent les alertes d'avant le lot (`get_my_role` et `update_updated_at_column` sans `search_path` fixe, quatre fonctions appelables sans connexion, protection contre les mots de passe compromis désactivée).

Fichiers du lot F (commit) :
- Migrations : `0046_journal_audit.sql`, `0047_consentements.sql`, `0048_reclamations.sql`, `0049_satisfactions.sql`.
- Nouveaux (`app/js/`) : `engine/audit.js`, `consentements.js`, `reclamations.js`, `satisfactions.js` ; `services/audit.js`, `consentements.js`, `reclamations.js`, `satisfactions.js` ; `components/liste-journal.js`, `consentements-contact.js`, `carte-donnees-a-revoir.js`, `liste-reclamations.js`, `carte-satisfaction.js`, `carte-avis-client.js` ; `views/consultant/journal.js`, `donnees-a-revoir.js`, `reclamations.js` ; tests `audit`, `consentements`, `reclamations`, `satisfactions`.
- Modifiés : `views/consultant/client-contacts.js`, `client-fiche.js`, `tableau-de-bord.js`, `vue-360.js`, `indicateurs.js`, `views/client/dashboard.js`, `main.js`, `components/entete.js`, `css/dashboard.css`, `docs/01_ARCHITECTURE.md`, `docs/changes.md`.
- Non inclus (travaux sans rapport avec ce lot) : `app/assets/images/logo.svg`, `supabase/functions/creer-compte/mail.ts`, `supabase/functions/envoyer-notification-email/index.ts`, `app/crm_app.md`, `app/new_design.md`, `app/arb.bat`, `app/arborescence.txt`, `app/security.md`, `app/mail.html`, `.claude/skills/`, `docs/05_SKELETONS.md`.

Les migrations 0046 à 0049 sont appliquées sur la base de production.

### 2026-10-03 : lot F, ajout (réclamation déposée par le client, migration 0050)

Origine : l'utilisateur a constaté que le client n'avait aucun moyen de déposer une réclamation (limite du lot F, décision de l'étape 3). Décisions validées ("comme recommandé") : le client la dépose sur l'une de ses demandes (une demande est obligatoire) ; il voit son état et, une fois traitée, la réponse apportée (l'action corrective).

Fait :
- Migration `0050_reclamations_client.sql` (appliquée) : colonne `origine` (`equipe` par défaut, `client`) ; `fn_reclamation_maj` ne fait plus du créateur le responsable quand il n'est pas du personnel ; `rpc_deposer_reclamation(demande, objet, description)` (`security definer` : accès à la demande exigé, objet non vide de 200 caractères au plus, description de 4 000 au plus, au plus cinq dépôts par compte et par jour, réclamation ouverte de gravité mineure attribuée au consultant de la demande, notification "Nouvelle réclamation" au consultant et aux admins) ; `rpc_mes_reclamations()` (les réclamations d'origine client sur les demandes accessibles, avec un état `recue`, `en_cours` ou `traitee`, la date de clôture et la réponse seulement une fois traitée ; **ni gravité, ni responsable, ni les réclamations saisies par l'équipe**). Le client n'a toujours aucun accès direct à la table.
- `engine/reclamations.js` : libellés d'état pour le client, `validerDepot`, `preparerDepot` ; export CSV : colonne "Déposée par" (le client ou l'équipe). `services/reclamations.js` : `deposerReclamation`, `listerMesReclamations`.
- `views/client/reclamation.js` (nouveau), routes `#/reclamation` et `#/reclamation/:ref`, lien "Signaler un problème" dans le menu client et sur la page de chaque demande (demande présélectionnée) : formulaire (demande, objet, description) et liste "Mes réclamations" (état, date, réponse). En aperçu client de l'admin, la liste n'est pas affichée.
- Côté équipe : badge "Déposée par le client" dans la liste des réclamations.

Vérifié en base (transactions annulées, un consultant et deux comptes clients simulés) : le client ne lit rien dans la table et ne peut pas y écrire ; un objet vide ou trop long est refusé ; un autre client ne peut ni déposer sur cette demande ("Demande introuvable") ni voir la réclamation ; le client ne voit que la sienne, pas celle saisie par l'équipe ; la sixième réclamation du jour est refusée ; côté équipe, origine client, responsable = consultant de la demande, gravité mineure ; le client voit l'état suivre (reçue, en cours, traitée avec la réponse) ; le consultant et l'admin sont notifiés, pas le client. Base propre ensuite.
Vérifié : `node --test tests/*.test.mjs` 223 réussis, `check-coherence` 0 erreur. Page de test avec services simulés (supprimée ensuite) : demande présélectionnée depuis le lien, aucun mot "gravité" ni "responsable" à l'écran, validations sans appel, refus du serveur affiché avec bouton réactivé, dépôt avec les bons champs puis réclamation visible dans la liste, formulaire vidé. Non testé avec la vraie base et de vrais comptes, ni en thème sombre ; la page "Ma demande" complète n'a pas été chargée en entier (syntaxe vérifiée).

Limites : pas d'e-mail (notification dans l'application seulement) ; pas de pièce jointe ; le client ne peut ni modifier ni retirer sa réclamation après dépôt.

### 2026-10-03 : lot F, ajout (date, importance et interlocuteur sur la réclamation du client, migration 0051)

Origine : retour de l'utilisateur ("côté client on devrait avoir presque toutes les infos"). Décisions validées : le client précise la **date du problème** et l'**importance** ; il voit la gravité (sous le mot "importance"), son **interlocuteur** et la réponse. Libellés d'importance : « Peu important », « Important », « Urgent » avec une aide courte sous le champ ; le mot "gêne" est écarté (demande de l'utilisateur).

Fait :
- Migration `0051_reclamations_client_infos.sql` (appliquée) : `rpc_deposer_reclamation` reçoit la date du problème (devient la date de réception ; refusée si elle est future ou date de plus de douze mois) et la gravité de départ (`mineure`, `majeure`, `critique` ; le client choisit une importance, l'équipe peut la corriger) ; `rpc_mes_reclamations` ajoute la gravité et le nom de l'interlocuteur (le responsable de la réclamation, par son nom seulement).
- `engine/reclamations.js` : `IMPORTANCES_CLIENT` (libellé et aide), `libelleImportance`, `validerDepot` (date obligatoire et pas dans le futur, importance obligatoire) et `preparerDepot` reprennent ces champs. `services/reclamations.js` : `deposerReclamation` les transmet.
- `views/client/reclamation.js` : champs "Date du problème" (aujourd'hui par défaut, pas de date future) et "Importance pour vous" avec son aide ; la liste "Mes réclamations" montre l'importance, "Problème du ...", "Votre interlocuteur : ..." et la réponse.

Vérifié en base (transactions annulées, un consultant et un client simulés) : date future, date de plus de douze mois et importance inconnue refusées ; la date et la gravité choisies sont enregistrées (visibles côté équipe, origine client) ; valeurs par défaut (aujourd'hui, mineure) quand elles ne sont pas fournies ; l'interlocuteur affiché est le nom du consultant. Base propre ensuite.
Vérifié : `node --test tests/*.test.mjs` 224 réussis, `check-coherence` 0 erreur. Page de test avec services simulés (supprimée ensuite) : champs, listes d'importance et aide qui change au choix, aucun mot "gêne", date par défaut et maximum, date future refusée sans appel, dépôt avec les bons champs, suivi avec importance, date du problème et interlocuteur. Non testé avec la vraie base et de vrais comptes, ni en thème sombre.

### 2026-10-03 : refonte de l'interface, audit et phase 1 (socle commun)

Fait :
- Audit : `docs/AUDIT_CRM.md` (inventaire du code, état des fonctions par rapport au cahier des charges, risques, écarts, plan) et `docs/SUPABASE_SCHEMA.md` (39 tables, 3 vues, 43 fonctions). Constat de sécurité : douze tables du LMS ont une politique "vrai pour tous" (voir `AUDIT_CRM.md`, section 7).
- **Doublons supprimés** : `engine/dates.js` (nouveau : `formaterDateCourte`, `formaterDate`) remplace sept copies de `formaterDate` (il en reste quatre aux formats vraiment différents : devis imprimable, certification, mes demandes, rapport) ; `mini` (carte de chiffre) et `tableau` (tableau simple) passent dans `components/dashboard-ui.js` au lieu de cinq et deux copies ; `bouton` de `client-fiche.js` reprend celui de `champs-crm.js`. `engine/facturation.js` réexporte `formaterDateCourte` : aucun import existant ne casse. +2 tests (`tests/dates.test.mjs`).
- **Squelettes de chargement** : `components/squelette.js` (`squelettePage` : tableau, fiche ou liste ; annoncé comme occupé aux lecteurs d'écran ; animation coupée si l'utilisateur la refuse) et **états vides utiles** : `components/etat-vide.js` (icône, titre, explication, bouton ou lien d'action). Appliqués à la liste des clients (squelette pendant le chargement ; "Aucun client pour le moment" avec "Nouveau client ou prospect" ; "Aucun client ne correspond" avec "Effacer la recherche" ; "Aucun client dormant avec ce seuil"). Styles dans `css/etats.css` (nouveau).
- **CSS découpé sans changement** : les styles des lots D à F quittent `dashboard.css` (653 lignes restantes) pour `css/crm.css` (106 lignes), chargé juste après : l'ordre de la cascade est inchangé (vérifié : la concaténation des deux fichiers redonne exactement l'ancien fichier, règle par règle). `index.html` charge `crm.css` puis `etats.css`.
- **Lucide figé** à la version 1.50.0 (`index.html`) au lieu de `latest` : le fichier est identique à celui servi jusque-là, donc aucun changement visible, mais une mise à jour de la bibliothèque ne peut plus changer ou retirer des icônes sans prévenir.

Vérifié : `node --test tests/*.test.mjs` 226 réussis, `check-coherence` 0 erreur. Page de test avec services simulés (supprimée ensuite) : squelette affiché pendant le chargement (7 lignes, état occupé, texte pour lecteurs d'écran, animation active) puis remplacé par le tableau ; états vides (aucun résultat avec bouton qui efface la recherche, aucun dormant, aucun client avec lien de création) et icône rendue ; `crm.css` et `etats.css` bien chargés dans l'ordre ; `mini` partagé produit la même structure. Non vérifié : les autres écrans qui utilisent les fonctions mutualisées n'ont pas été rechargés un par un dans le navigateur (syntaxe vérifiée partout, noms utilisés tous importés ou définis) ; rendu en thème sombre non vérifié ; pas de comparaison de captures avant et après sur tous les écrans.

### 2026-10-03 : refonte de l'interface, phase 1 bis (prototype d'allure)

Principe : l'allure se **teste et se désactive d'un clic** pour comparer. Un bouton « étincelles » dans la barre du haut (à côté du thème) bascule entre l'allure actuelle et la nouvelle ; le choix est mémorisé dans le navigateur. Tous les styles de la nouvelle allure sont dans `css/allure.css`, préfixés par `body.look-nouveau` : sans cette classe, rien ne change (le clic sur une ligne, le bouton d'aperçu, la pastille d'initiales et le bouton de densité sont même masqués ou inactifs).

Fait :
- `components/allure.js` (nouveau) : allure actuelle ou nouvelle, densité compacte ou confortable, mémorisées ; branché dans `entete.js` (bouton) et `main.js` (application au démarrage).
- **Sobriété** (nouvelle allure) : arrondis de 8 px, plus d'ombres, cartes à bordure fine, boutons et champs de 36 px.
- **Menu latéral clair et neutre** : fond gris très clair, texte sombre, rubrique active en blanc à bordure fine avec icône et texte bleu RD ; fonctionne en thème sombre (mêmes variables).
- **Liste des clients** : tableau compact (texte de 14 px, lignes d'environ 38 px, en-têtes discrets en petit gris non capitalisés, survol de ligne), une seule ligne par client (nom commercial à côté du nom), pastilles de statut teintées (client turquoise, prospect orange) et pastille de personne avec initiales pour le contact principal ; bouton « Compacte / Confortable » dans la barre de filtres (lignes d'environ 52 px en confortable).
- **Tiroir latéral** (`components/tiroir.js`, `components/apercu-client.js`, nouveaux) : un clic sur une ligne (ou le bouton d'aperçu au clavier) ouvre un panneau à droite avec l'essentiel du client (statut, SIRET, ville, contact principal, demandes, tâches ouvertes, dernière activité, CA signé pour l'admin, e-mail, téléphone) et les accès « Ouvrir la fiche », « Contacts », « Demandes ». Accessible : rôle dialogue, focus placé dans le panneau puis rendu à l'élément d'origine, Échap et clic sur le fond ferment, Tab reste dans le panneau, plein écran sur téléphone, animation coupée si l'utilisateur la refuse. Un clic sur le nom du client ouvre toujours la fiche.
- `engine/texte.js` : `initiales` (+1 test).

Vérifié : `node --test tests/*.test.mjs` 227 réussis, `check-coherence` 0 erreur. Page de test reconstituant le menu et la barre du haut avec des services simulés (supprimée ensuite) : les deux allures comparées (lignes de 45 px avant, 38 px après en compact, 52 px en confortable), bascule de densité mémorisée ; tiroir : ouverture par clic de ligne et par le bouton, contenu exact, focus dans le panneau puis rendu au bouton, Tab piégé, Échap, clic sur le fond, clic sur le nom sans effet ; allure actuelle inchangée (clic de ligne sans effet, éléments du prototype masqués) ; thème sombre (menu, tableau et pastilles bien recolorés) ; téléphone 375 px (tiroir plein écran, pas de défilement horizontal). Non vérifié : le vrai menu latéral et la vraie barre du haut ne sont pas chargés dans cette page de test (leur structure est reproduite ; le bouton d'allure et son branchement sont vérifiés par la syntaxe) ; les autres écrans sous la nouvelle allure (seules les règles générales, menu et cartes, les touchent) ; accessibilité complète au lecteur d'écran.

À décider par l'utilisateur après essai : garder cette allure et la généraliser (phase 2 : composant tableau pour les autres listes), ajuster (densité, couleurs des pastilles, largeur du menu, contenu du tiroir) ou abandonner.

### 2026-10-03 : phase 1 bis, itération 2 (plus proche de l'esprit Twenty)

Retour de l'utilisateur : le premier prototype était trop timide. Reprise après lecture du système de design de Twenty (`packages/twenty-ui`, valeurs seulement, aucun code copié) : gris neutres, arrondis de 4 et 8 px, cellules de 8 px, colonne de cases de 32 px, icônes fines de 14 à 16 px, panneau de 500 px, transitions de 0,1 s.

Fait (nouvelle allure uniquement, l'allure actuelle reste masquée par défaut) :
- **Liste des clients plein cadre** : plus de carte ni de titre, barre de vue (statut choisi + nombre, sélection, recherche, densité), tableau quadrillé fin avec en-têtes à icône, colonnes E-mail et Téléphone, ligne de totaux (clients, demandes, tâches ouvertes, CA signé pour l'admin).
- **Cases à cocher** (une par ligne et « tout sélectionner ») : le nombre sélectionné s'affiche et **l'export CSV ne porte que sur la sélection** quand il y en a une.
- **Pastilles** : entreprise en puce grise à carré d'initiales bleu RD, personne en puce à rond turquoise, e-mail et téléphone en pilule, statut teinté.
- **Menu latéral** : sections (« Espace de travail », « Administration »), icônes colorées par rubrique, chevron sur le logo, barre du haut de 48 px.
- Tiroir porté à 500 px.

Vérifié : tests 227 réussis, `check-coherence` 0 erreur, syntaxe des fichiers modifiés. **Non vérifié dans le navigateur** (économie de jetons demandée) : le rendu visuel est à juger par l'utilisateur avec le bouton d'allure ; les règles CSS n'ont pas été testées en thème sombre ni à 375 px dans cette itération.

### 2026-10-03 : phase 1 bis, itération 3 et copie de sécurité

**Retour en arrière** : l'état d'avant la refonte est conservé de deux façons. Le tag git `appv1` (commit `a1e56b0`, dernier état poussé avant la refonte) permet de tout restaurer (`git checkout appv1 -- app`). Une copie de l'application est aussi dans le dossier `appv1/` (ignoré par git, pour consultation locale). Dans l'application actuelle, le bouton « étincelles » rend aussi l'ancienne allure d'un clic.

Fait (nouvelle allure) : lignes de 33 px en compact ; **défilement horizontal** (largeurs de colonnes fixes, case et colonne Entreprise figées à gauche, texte coupé par « … ») ; **une seule ligne** pour la barre de vue et les actions (Doublons, Exporter, Nouveau) ; cellules vides au lieu des tirets ; bloc « Simuler une vue » repliable (replié sauf si une simulation est active, aussi avec l'allure actuelle).

Vérifié : 227 tests, `check-coherence` 0 erreur, syntaxe. Non vérifié dans le navigateur (économie de jetons) : défilement et colonnes figées, ligne unique à largeur réduite.

Retours sur l'itération 3 (même jour) : barre de défilement du tableau fine et sans flèches ; les points « ... » après les cases à cocher étaient le texte coupé de la cellule de la case (corrigé) ; menu latéral plus aéré (liens de 40 px, espaces entre blocs agrandis) ; **profil dans la barre du haut** (avatar, nom, menu avec identité, e-mail et déconnexion) à la place du pied du menu latéral, avec la nouvelle allure seulement. Non vérifié dans le navigateur.

Retour sur l'espacement : le contenu est une **carte inscrite** dans la page (marge de 16 px, bordure fine, coins arrondis de 8 px) au lieu de toucher le menu ; cellules plus aérées (compact : lignes de 37 px au lieu de 33, confortable : 49 px) ; barre de vue plus haute. Non vérifié dans le navigateur.

Retour sur la comparaison avec le modèle fourni (NextAdmin) : **barre du haut et contenu forment une même carte** posée sur le fond gris (marge de 16 px, 8 px sur téléphone, coins arrondis), barre de 64 px ; menu latéral plus ample (marges de 24 px, liens de 42 px à 15 px) ; tableau en 15 px avec cellules de 41 px (compact) et 53 px (confortable) ; barre de vue avec 24 px de marge. Non vérifié dans le navigateur ; la règle `:has()` (coins carrés sous la barre pour les listes) demande un navigateur récent.

### 2026-10-03 : refonte, phase 2 (composant tableau), étape 1

Fait : `components/tableau-liste.js` (nouveau), tableau commun : colonnes à largeur fixe et défilement horizontal, colonne figée, cases à cocher et sélection facultatives, ligne de totaux, clic sur la ligne (nouvelle allure), cellules vides. Chaque écran ne décrit plus que ses colonnes (`titre`, `icone`, `largeur`, `rendu`, `total`).
- **Clients** : refactoré sur ce composant (même rendu qu'avant, code plus court).
- **Demandes** : la liste de liens devient un tableau (Référence, Client, Statut en pastille colorée avec libellé lisible au lieu du code, Types, Consultant pour l'admin, Date limite, Créée le), barre de vue avec nombre, export déplacé en haut à droite, état vide soigné, clic sur la ligne ouvre la demande. Mise en page en `db page-liste` aussi avec l'allure actuelle (tableau simple).

Vérifié : 227 tests, `check-coherence` 0 erreur ; page de test avec services simulés (supprimée) pour la liste des demandes : colonnes, libellés, totaux, lignes de 41 px, aucune erreur console. Non revérifié dans le navigateur : la liste des clients après refactorisation (même code de rendu, syntaxe contrôlée seulement).

Reste de la phase 2 : appliquer le composant aux tâches, réclamations, comptes, journal d'audit, données à revoir ; tri par clic sur les en-têtes et pagination (si les volumes l'exigent).

### 2026-10-03 : refonte, phase 2 (composant tableau), étape 2

Fait : **tri par clic sur les en-têtes** (clic : croissant, deuxième clic : décroissant, troisième : ordre d'origine ; valeurs absentes toujours en dernier ; accents et casse ignorés ; « FOR-2 » avant « FOR-10 ») dans les listes Clients et Demandes ; le tri choisi est retenu par tableau, il survit à une recherche ou à un filtre. Logique pure dans `engine/tri.js` (+4 tests). **Comptes** (admin) migré : tableau Nom, E-mail, Rôle, bouton Supprimer (la confirmation avec la liste des demandes perdues est inchangée), total.

Choix : les **tâches** (cartes regroupées par échéance avec actions sur chaque ligne), les **réclamations** et le **journal d'audit** (listes à détail dépliable, déjà réutilisées dans la fiche client) gardent leur présentation : un tableau y ferait perdre de l'information. À reprendre au besoin pendant la phase 5 (tiroir de détail).

Vérifié : 231 tests, `check-coherence` 0 erreur ; page de test avec services simulés (supprimée) : tri croissant, décroissant, retour à l'ordre d'origine, valeurs absentes en dernier, `aria-sort`, tri par date ; liste des comptes (colonnes, boutons, total) ; aucune erreur console. Non vérifié : la liste des clients après ajout du tri (même composant, syntaxe seulement), la suppression d'un compte de bout en bout.

### 2026-10-03 : refonte, phase 3 (menu de commandes Ctrl+K)

Fait : **Ctrl+K** (ou Cmd+K) ouvre une fenêtre de commandes pour le personnel (admin et consultant ; pas pour le client). On y tape pour : aller à une page du menu (selon le rôle), lancer une action (nouveau client ou prospect, doublons pour l'admin, changer de thème, changer d'allure, se déconnecter), ou retrouver un client, un contact, une demande (mêmes données et même cache que la recherche de la barre du haut ; les factures pour l'admin). Mots sans accent ni casse, synonymes (« sombre », « creer »…), les débuts de mot passent avant le reste. Flèches, Entrée, Échap, clic sur le fond ; Ctrl+K rouvert la ferme ; le focus revient à l'endroit d'origine. Accessible : rôle dialogue, liste d'options reliée au champ (`aria-activedescendant`), Tab garde le focus dans le champ, animation coupée si l'utilisateur la refuse.
- `engine/commandes.js` (filtrage pur, +3 tests), `components/palette-commandes.js`, branché dans `entete.js` ; le champ de recherche du haut annonce le raccourci. Le menu est le même avec les deux allures.

Vérifié : 234 tests, `check-coherence` 0 erreur ; page de test avec données simulées (supprimée) : ouverture au clavier, liste complète, filtres « creer » et « acc », chargement puis résultats, flèches, Entrée (navigation, fermeture, retour du focus), action de thème, Échap, bascule par Ctrl+K, message sans résultat, aucune erreur console ; dimensions du panneau (640 px centré, lignes de 40 px). Non vérifié : le rendu en capture d'écran (elle a expiré), les vraies données et le vrai en-tête.

### 2026-10-03 : refonte, phase 4 (fil d'Ariane)

Fait : la barre du haut affiche un **fil d'Ariane** à la place du titre seul, dans les deux allures : « Clients / ACCENTEUR / Contacts », « Demandes / FOR-2026-001 / Note de cadrage », « Mes demandes / FOR-1 / Récapitulatif » côté client. Les pages parentes sont cliquables, la page courante est en gras (`aria-current="page"`). Le nom du client apparaît dès que la fiche est chargée (« Fiche client » en attendant). Les pages sans parent gardent leur titre. Sur téléphone, comme avant, le titre de la barre reste masqué (la page a son propre lien de retour).
- `engine/fil-ariane.js` (pur, +4 tests), `entete.js` (rendu et `definirNomClientFil`), `client-fiche.js` (fournit le nom), styles dans `css/allure.css`.

Vérifié : 238 tests, `check-coherence` 0 erreur, syntaxe. Non vérifié dans le navigateur : le rendu du fil dans la vraie barre du haut et la mise à jour du nom du client (le calcul des segments est testé, pas l'affichage). Une erreur de syntaxe dans une expression régulière a été trouvée et corrigée avant le commit.

### 2026-10-03 : refonte, phase 5 (tiroir de détail)

L'aperçu d'un client dans le tiroir existait depuis la phase 1 bis ; cette étape l'étend aux **demandes** et factorise le bouton d'aperçu.
- **Demandes** : un clic sur une ligne (nouvelle allure) ou sur le petit bouton d'aperçu (visible au survol ou au clavier) ouvre un tiroir : statut, client, types, consultant (admin seulement, « Non attribuée » si vide), date limite, date de création, archivage ; accès « Ouvrir la demande », « Note de cadrage », « Fiche client ». Un clic sur la référence ouvre toujours la demande. Le client concerné (`client_id`) est maintenant chargé par `listerDemandes`.
- `components/apercu-demande.js` (nouveau), `boutonApercu` ajouté à `tableau-liste.js` (utilisé par les clients et les demandes), `ligne` exportée de `apercu-client.js`.
- Tâches, réclamations, journal d'audit : pas de tiroir pour l'instant (leurs détails se déplient déjà dans la page).

Vérifié : 238 tests, `check-coherence` 0 erreur ; page de test avec services simulés (supprimée) : ouverture par le bouton d'aperçu, contenu (consultant présent pour l'admin, « Non attribuée »), liens, fermeture par Échap, ouverture par un clic de ligne, aucune erreur console. Non vérifié : la requête réelle avec `client_id` (la colonne est utilisée à l'insertion des demandes), le rendu en capture d'écran.

### 2026-10-03 : refonte, phase 6 (filtres avancés et vues enregistrées)

Décisions validées : vues **personnelles seulement** (chacun voit les siennes), sur **Clients et Demandes**.

Fait :
- **Migration 0052** (`vues_enregistrees`, appliquée en production) : une vue = écran (`clients` ou `demandes`), nom (1 à 60 caractères, unique par personne, écran et sans tenir compte de la casse), filtres (liste de 20 au plus), tri, recherche. RLS : on ne voit, crée, modifie et supprime que ses propres vues, et seulement pour le personnel (`est_staff()`). Les filtres sont stockés sous la forme décrite par l'interface ; une colonne retirée plus tard est simplement ignorée à la lecture.
- **Filtres avancés** (bouton « Filtrer · n » dans la barre de vue) : conditions cumulées, une par ligne (colonne, condition, valeur). Types : texte (contient, est, renseigné, vide), choix (est, n'est pas, y compris sur la liste des types d'une demande), nombre (au moins, au plus, égal à, virgule décimale acceptée), date (avant, après, renseignée, vide). Clients : ville, statut, contact principal, SIRET, nombre de demandes, demandes en cours, tâches ouvertes, CA signé (admin), dernière activité. Demandes : statut, type, client, consultant (admin), date limite, date de création. Un filtre incomplet est ignoré. Les filtres s'ajoutent à la recherche et aux sélecteurs déjà présents ; l'export CSV et le total suivent la liste filtrée ; les demandes ne sont pas rechargées à chaque filtre.
- **Vues enregistrées** (bouton « Vues ») : liste des vues, clic pour appliquer (filtres, tri, recherche), corbeille avec confirmation, champ « Nom de la vue actuelle » pour enregistrer. Nom déjà pris : message clair.
- `engine/filtres.js` (pur, +7 tests), `services/vues.js`, `components/outils-vue.js`, `lireTri` et `definirTri` dans `tableau-liste.js`. Panneaux à position fixe (la carte de la liste coupe ce qui dépasse), fermés par Échap, clic à côté ou changement de page.

Vérifié : 245 tests, `check-coherence` 0 erreur. **Base** (transaction annulée) : insertion pour soi acceptée, doublon de nom (casse et espaces différents) refusé, insertion au nom d'un autre refusée, écran inconnu, filtres qui ne sont pas une liste et nom vide refusés, un client ne voit ni ne crée rien. **Navigateur** (services simulés, supprimés ensuite) : Demandes et Clients : ajout, modification et retrait de filtres, compteur du bouton, filtres cumulés, totaux, enregistrement d'une vue (avec tri et recherche), nom en double, application d'une vue avec filtre inconnu ignoré, suppression, Échap, changement de page.

Non vérifié : avec un vrai compte consultant (la base n'en contient pas encore : seul l'admin a été testé comme membre du personnel) ; les vraies requêtes sur le service `vues.js` ; le rendu en capture d'écran ; l'ergonomie sur téléphone.

À noter : pas de limite du nombre de vues par personne (seulement 20 filtres par vue).

### 2026-10-03 : tâches en liste et en Kanban (demande de l'utilisateur, d'après un modèle fourni)

Demande : un groupe « Tâches » dans le menu avec « Liste » et « Kanban », des onglets par statut, et un Kanban où l'on **glisse et dépose une carte d'un statut à l'autre**. Statuts voulus : **À faire, En cours, À réviser, Complet**.

Fait :
- **Migration 0053** (appliquée en production) : la tâche peut aussi être `en_cours` ou `a_reviser` (en plus de `a_faire`, `terminee`, `annulee`). `v_clients` compte désormais les trois statuts ouverts dans `nb_taches_ouvertes` et `prochaine_echeance`. Le déclencheur de date de fin n'a pas changé. Les tâches existantes gardent leur statut.
- **Moteur** (`engine/taches.js`, +6 tests) : `STATUTS_TACHE` (« terminee » s'affiche **Complet**), `estOuverte`, `libelleStatutTache`, `colonnesKanban` (les terminées des 30 derniers jours, les annulées sans colonne), `deplacerTache` (affichage immédiat). Le classement par échéance et le calendrier comptent les trois statuts ouverts. `listerTaches` renvoie par défaut les tâches ouvertes ; `changerStatutTache` est nouveau.
- **Menu** : groupe « Tâches » (Liste, Kanban) déplié, repliable ; le menu de commandes propose « Tâches : Liste » et « Tâches : Kanban » ; le fil d'Ariane affiche « Tâches / Liste » ou « Tâches / Kanban ». Routes `#/taches` et `#/taches/kanban`.
- **Liste** (`views/consultant/taches.js`, réécrite) : onglets Toutes les tâches, À faire, En cours, À réviser, Complet, Annulées ; une carte par statut avec point de couleur, nombre et repli ; chaque ligne garde « Terminer » et « Reporter » et gagne un sélecteur de statut. L'ancien regroupement par échéance (en retard, aujourd'hui…) est remplacé par le regroupement par statut ; une tâche en retard reste signalée en rouge.
- **Kanban** : quatre colonnes ; cartes (titre, client, échéance en rouge si en retard, type, responsable, sélecteur de statut). Glisser-déposer : la carte change de colonne tout de suite, puis le serveur est appelé ; en cas de refus, la carte revient et un message l'explique. Le sélecteur de la carte est l'alternative au clavier et sur écran tactile.

Vérifié : 252 tests, `check-coherence` 0 erreur ; **base** (transaction annulée) : les statuts en cours et à réviser sont acceptés, un statut inconnu refusé, `nb_taches_ouvertes` suit (ouvert, ouvert, terminé), droits de `v_clients` conservés. **Navigateur** (services simulés, supprimés ensuite) : glisser-déposer entre colonnes (survol, déplacement, refus du serveur et retour arrière, message), sélecteur de la carte, onglets, historique complet de l'onglet Complet, annulées, changement de statut depuis une ligne, repli d'un groupe.

Non vérifié : le rendu visuel en capture d'écran (les captures ont expiré), le groupe du menu latéral dans le vrai en-tête, le glisser-déposer à la souris réelle (les événements ont été simulés), un vrai compte consultant, l'écran tactile.

Pas encore fait : le bouton « Ajouter une tâche » du modèle (une tâche est rattachée à un client : elle se crée depuis sa fiche), l'ordre des cartes à l'intérieur d'une colonne (trié par échéance), le Kanban des demandes prévu en phase 7.

### 2026-10-03 : « Ajouter une tâche » (urgence, plusieurs membres, pièces jointes)

Demande (d'après un modèle fourni) : formulaire « Créer une nouvelle tâche » avec statut, **un ou plusieurs membres de l'équipe**, date, **urgence** (faible, moyenne, haute) et **pièces jointes**. Décision validée : **tout le personnel peut ajouter des collègues** à une tâche.

Fait :
- **Migration 0054** (appliquée en production) :
  - `taches.urgence` (faible, moyenne par défaut, haute).
  - `tache_membres` : le responsable (`assignee_id`) reste celui qui crée la tâche (ou que l'admin désigne), les autres membres y sont listés ; un membre voit la tâche et peut la faire avancer, **même si le client ne lui est pas attribué** (il ne voit alors ni la fiche ni le nom du client, mais le titre, le message et les pièces jointes) ; seul le responsable ou l'admin la supprime ; seuls l'admin et les consultants peuvent être membres (jamais un client).
  - `tache_pieces_jointes` et bucket privé `taches` (chemin `{tâche}/{horodatage}-{nom}`, 20 Mo, extensions pdf, docx, xlsx, pptx, png, jpg, jpeg, vérifiées aussi côté stockage) ; l'accès suit celui de la tâche.
  - Fonctions `est_membre_tache`, `peut_voir_tache`, `peut_voir_tache_chemin` (definer, droit d'exécution aux seuls connectés).
- **Formulaire** (`components/modale-tache.js`, bouton « Ajouter une tâche » sur la liste et le Kanban) : nom, client (celui du filtre par défaut), message, statut, membres (bloc à cases ; un consultant reste coché et responsable, l'admin choisit, le premier coché devient responsable), date (aujourd'hui par défaut), urgence, type, pièces jointes (10 au plus, types et taille contrôlés dès le choix). La tâche est créée d'abord ; un membre ou un fichier qui échoue ne l'annule pas, un message le signale.
- **Affichage** : carte Kanban avec urgence en couleur, pile d'avatars (3 puis « +n »), nombre de pièces jointes ; ligne de la liste avec urgence et équipe ; clic sur le titre ou la carte : **tiroir de détail** (statut, urgence, échéance, client, type, équipe, message, pièces jointes à télécharger, ajout de pièces jointes).
- `listerTaches` : « mes tâches » inclut celles où l'on est membre ; `supprimerTache` retire aussi les fichiers du stockage.
- Moteur (+3 tests) : `URGENCES`, `membresDeTache`, `nomFichierSur` (nom sûr pour le stockage), `validerNouvelleTache`.

Vérifié : 255 tests, `check-coherence` 0 erreur. **Base** (transaction annulée, avec trois consultants fictifs) : sans lien, un consultant ne voit rien ; ajouté comme membre, il voit la tâche, la modifie (statut, urgence), ne peut pas la supprimer, ne voit pas le client, voit les membres, peut ajouter un collègue et une pièce jointe, dépose un pdf mais pas un exe ni un chemin quelconque ; un client ne peut pas être membre ; un consultant sans lien ne voit ni la tâche ni ses pièces et ne peut ni s'ajouter, ni déposer ; le responsable supprime, les membres partent avec. **Navigateur** (services simulés, supprimés ensuite) : formulaire complet en admin et en consultant, erreurs de saisie, fichier refusé, appel de création avec les bons champs, carte, tiroir, ajout de pièce jointe, téléchargement.

Non vérifié : le vrai envoi des fichiers vers le stockage et leur téléchargement (services simulés ; règles de la base testées), le rendu en capture d'écran, un vrai compte consultant, l'écran tactile.

À noter : pas de notification quand on est ajouté à une tâche ; pas de retrait d'un membre ni de modification du message depuis le tiroir ; l'ordre des cartes dans une colonne reste celui de l'échéance.

### 2026-10-03 : tâches, refonte de la mise en page d'après le modèle (retour de l'utilisateur)

Retour : la mise en place des éléments (liste, Kanban) et la fenêtre de création ne ressemblaient pas au modèle fourni. Reprise complète de l'apparence, sans changer les données ni la base.
- **Barre d'outils** : onglets à gauche ; à droite, recherche (icône qui déplie un champ), filtres responsable et client en pastilles sans étiquette visible, séparateur et bouton « Ajouter une tâche » (le titre garde sa ligne). Les onglets servent aussi au Kanban (ils n'affichent alors que la colonne choisie).
- **Liste** : un grand bloc arrondi par statut (flèche, point de couleur, nombre) ; **une carte par tâche** : rond pour terminer, titre et client, date en toutes lettres (« 05 janvier 2028 », rouge si en retard), urgence, avatars des membres, nombre de pièces jointes et menu « ... » (passer en un autre statut, reporter, annuler) ; ligne pointillée « + Ajouter une tâche » en bas de chaque bloc (ouvre le formulaire avec ce statut).
- **Kanban** : colonnes arrondies avec « + » pour ajouter dans cette colonne ; cartes (titre, client, date, urgence ou coche verte dans « Complet », puis avatars et pièces jointes).
- **Fenêtre « Créer une nouvelle tâche »** : titre avec croix de fermeture, champs nom, client et message, puis **une seule rangée de pastilles** à icône (statut avec point de couleur, membres, date, urgence, type), et en bas **trombone à gauche, Annuler puis Créer une tâche à droite** sous un filet. Largeur 760 px.
- `ouvrirModaleCrm` accepte une classe CSS et un élément « pied gauche » ; `ligne-tache.js` revient à son état d'origine (la liste utilise ses propres cartes) en gardant l'équipe dans le texte ; `libelleDateLongue` (+1 test).

Vérifié : 256 tests, `check-coherence` 0 erreur ; mesures des positions dans le navigateur avec des données simulées (supprimées) : barre d'outils sur une ligne à droite des onglets quand la place le permet (retour à la ligne à droite sinon), cartes de liste à 7 colonnes sans débordement, colonnes du Kanban, fenêtre à 760 px avec les cinq pastilles sur une seule ligne, pied de fenêtre dans le bon ordre, liste des membres contenue dans la fenêtre.
Non vérifié : **aucune capture d'écran n'a pu être prise** (elles expirent dans mon outil) : l'apparence réelle (couleurs, ombres, espacement) est à juger par l'utilisateur ; l'écran étroit et le thème sombre.

### 2026-10-03 : listes déroulantes arrondies (retour de l'utilisateur)

Retour : la liste d'un `<select>` s'ouvrait en carré, avec le style du système, hors du reste de l'interface. Un seul bloc de styles (`css/allure.css`) s'applique à **tous** les `<select>` simples de l'application, dans les deux allures : liste aux coins arrondis (12 px), bordure fine, ombre douce, options arrondies (survol gris, option choisie teintée de bleu RD avec une coche), flèche qui se retourne à l'ouverture, hauteur limitée avec défilement. Basé sur la fonction du navigateur `appearance: base-select` (Chrome et Edge récents), sans JavaScript, donc accessible au clavier comme avant. Les listes à choix multiple ne changent pas. Les pastilles du formulaire de tâche gardent leur propre flèche.

Limites connues : Firefox et Safari gardent pour l'instant la liste native (le fonctionnement est identique, seul l'aspect diffère) ; la liste d'un champ date (calendrier du navigateur) reste celle du navigateur.

Vérifié : styles calculés sur une page de test (supprimée) : mode appliqué aux listes simples et pas à la liste multiple, fenêtre de choix arrondie, bordure, fond, option arrondie, option choisie teintée, coche présente, flèche masquée dans les pastilles. Non vérifié : l'ouverture réelle de la liste (aucune capture possible, le clic de test ne l'a pas ouverte), le thème sombre.

Suite (même retour) : le triangle noir du navigateur est remplacé, sur toutes les listes déroulantes, par le **chevron fin gris** des pastilles (même dessin, même couleur, il se retourne à l'ouverture) ; les champs et listes de la nouvelle allure ont des coins de 10 px comme les pastilles. Vérifié sur une page de test (supprimée) : chevron de 16 px de la couleur du texte secondaire, écart de 8 px avec le texte. Non vérifié en capture.

Suite (même retour) : texte et chevron des listes sont **centrés verticalement** (alignement du bouton de la liste). Captures d'écran désormais possibles : vérification visuelle de la liste, du Kanban et de la fenêtre de création. Corrigés grâce à elles : icônes de la fenêtre (membres, date, urgence, type, trombone, croix) qui ne s'affichaient pas faute d'appel à `createIcons`, double chevron dans les pastilles (règle de masquage trop faible), pastille « Type » qui passait à la ligne (fenêtre portée à 820 px : les cinq pastilles tiennent sur une ligne).

Suite (même retour) : les listes s'ouvrent toujours **vers le bas** (le navigateur ne les retourne plus vers le haut) ; dans la fenêtre de tâche, le champ occupe **toute la pastille** (un clic sur le chevron ou l'icône ouvre la liste, avant seul le texte réagissait). Vérifié par un vrai clic sur le chevron : liste ouverte sous la pastille, quatre options. Non vérifié : le choix d'une option par clic, le cas d'une pastille tout en bas de l'écran (la liste peut alors dépasser).

Suite : la coche à droite de l'option choisie est supprimée dans toutes les listes déroulantes (l'option choisie reste reconnaissable à son fond bleuté et son texte en gras). Non vérifié en capture.

### 2026-10-05 : refonte, phase 7 (Kanban des demandes)

Fait : page « Demandes en Kanban » (menu : groupe **Demandes** avec Liste et Kanban, route `#/demandes/kanban`, fil d'Ariane « Demandes / Kanban », menu de commandes). Neuf colonnes du parcours : À démarrer (brouillon, envoyée, en saisie), Soumises (soumise, entretien planifié), En analyse, Cadrage (envoyée, à revoir, validée), Proposition, Gagnées, Perdues, Réorientées, Abandonnées ; le statut exact reste affiché sur chaque carte (avec la référence, le client, la date limite, les types et, pour l'admin, le consultant). Recherche par référence ou client, filtre par consultant pour l'admin ; un clic sur la carte ouvre le tiroir de détail.

**Glisser-déposer limité au parcours autorisé** : seuls les changements que le consultant fait déjà d'un clic dans la fiche (rouvrir la saisie d'une demande soumise, réorienter une demande en analyse, abandonner avec confirmation) se font par glisser ; pendant le glissement les colonnes permises sont cerclées de turquoise, les autres atténuées ; un dépôt refusé affiche une explication (étape à faire depuis la demande, gagnée ou perdue = décision du client, demande terminée). La carte change de colonne tout de suite et revient si la base refuse (`rpc_changer_statut` reste l'arbitre). Un sélecteur « Déplacer… » par carte (seulement les changements permis) sert de clavier et d'écran tactile.

`engine/kanban-demandes.js` (pur, +5 tests, vérifie que tous les statuts sont rangés une seule fois), `views/consultant/demandes-kanban.js`, +1 test du fil d'Ariane. Aucune migration.

Vérifié : 262 tests, `check-coherence` 0 erreur ; navigateur (services simulés, supprimés ensuite) : glisser permis (soumise vers à démarrer, abandon avec confirmation), refus expliqués (gagnée, étape dédiée, demande terminée), refus de la base avec retour de la carte, sélecteurs ne proposant que les changements permis, capture de la mise en page (ligne d'infos qui débordait : corrigée). Non vérifié : un vrai compte consultant, l'écran étroit, le thème sombre.

### 2026-10-05 : refonte, phase 8 (téléphone, thème sombre, accessibilité)

Contrôle visuel (captures) des écrans refaits, puis corrections :
- **Thème sombre** : liste des tâches, Kanban, fenêtre de création (avec la liste des membres) : couleurs correctes, rien à changer ; seule la barre de défilement du Kanban restait claire (maintenant fine et discrète comme celle des tableaux).
- **Téléphone (375 px)** : aucun défilement horizontal de la page. Corrigés : onglets des tâches sur une seule ligne défilable ; barre d'outils en pleine largeur avec « Ajouter une tâche » sur toute la largeur et sans séparateur orphelin ; cartes de tâche resserrées (marges réduites, menu « ... » en haut à droite) ; liste des clients : les boutons Doublons, Exporter et Nouveau client ne sont plus coupés (retour à la ligne, bouton principal pleine largeur) ; colonnes du Kanban de 250 px qui défilent dans leur propre zone.
- **Cibles tactiles** : zone cliquable élargie à 44 px pour le rond de validation, le menu « ... » et les boutons « + » (sans changer l'aspect) ; onglets, filtres, recherche et ligne « Ajouter une tâche » à 44 px sur téléphone.
- **Accessibilité** : déjà en place sur ces écrans (rôles, noms accessibles des boutons et listes, focus visible global, alternative au glisser-déposer par sélecteur, annonces des messages) ; non audité à l'outil automatique ni au lecteur d'écran.

Non fait : audit de performance chiffré (volumes actuels faibles ; pas de pagination), test au lecteur d'écran, essai sur un vrai téléphone, pages hors refonte (fiche client, demande) en thème sombre et sur téléphone.

Retour de l'utilisateur (iPhone, Safari) : impossible de faire défiler les tableaux vers la droite ou la gauche. Cause probable : le tableau à largeur fixe est rétréci par Safari au lieu de déborder, et le cadre qui le contient coupe ce qui dépasse. Corrections : largeur minimale du tableau égale à la somme de ses colonnes (variable posée par `tableau-liste.js`), cadre de la liste en `overflow: clip` (coupe sans devenir une zone de défilement), zone de défilement du tableau avec `touch-action: pan-x pan-y`, `-webkit-overflow-scrolling: touch` et largeur maximale du cadre. Vérifié sous Chrome en émulation téléphone (tableau de 1832 px dans 349 px, défilement obtenu, colonnes case et entreprise figées). **Non vérifié sur Safari/iPhone**, où le défaut a été constaté : à retester par l'utilisateur après rechargement forcé.

### 2026-10-05 : phase 8, audit d'accessibilité outillé (axe-core)

Contrôle automatique (axe-core 4.10, règles de contraste, étiquettes, noms de boutons, listes, liens, ARIA) sur la liste des clients, la liste et le Kanban des tâches, le Kanban des demandes et la fenêtre de création, en thème clair et sombre (données simulées, page de test supprimée).
- **Trouvé et corrigé** : contraste insuffisant des pastilles d'urgence « Faible » (2,77 : 1) et « Moyenne » (2,61 : 1), des avatars blancs sur turquoise (3,21 : 1, listes de tâches, puces de personnes, avatar de la barre du haut) et de l'urgence « Haute » en thème sombre (4,48 : 1). Nouvelles couleurs de texte et de fond dérivées des couleurs RD (variables `--fond-avatar`, `--texte-urgence-*`) : plus aucune violation de contraste sur ces écrans dans les deux thèmes.
- **Sans objet** : les alertes de repères (« main » en double) venaient de ma page de test, pas de l'application.
- **Aucune autre violation** sur les noms accessibles des boutons, étiquettes de champs, listes déroulantes, liens, attributs ARIA et nom de la fenêtre de création.

Reste à faire pour clore l'audit : test au lecteur d'écran, essai sur un vrai téléphone, audit de la fiche client, de la fiche demande et du tableau de bord (thème sombre, téléphone, axe-core), mesures de performance.

Suite de l'audit (pages hors refonte : tableau de bord, fiche client avec ses onglets, fiche demande), avec le vrai code des pages et une base simulée (page de test supprimée) :
- **axe-core** : fiche client (aperçu, activité), fiche demande : aucune violation, clair et sombre. Tableau de bord : 2 contrastes insuffisants, corrigés : texte blanc sur le bouton orange « Nouvelle demande » (3,17 : 1) et texte orange sur fond orange pâle des actions de ligne (2,75 : 1). Le bouton orange est désormais un orange un peu plus profond (78 % de l'orange RD, mélangé de noir) pour que le texte blanc soit lisible ; le texte des actions utilise la même couleur foncée que les urgences. **Ajustement de la charte à valider par l'utilisateur** (le bouton orange est légèrement plus sombre).
- **Téléphone (375 px)** : tableau de bord, fiche client et fiche demande sans défilement horizontal de la page (les onglets de la fiche client défilent dans leur propre zone).

Reste : lecteur d'écran, vrai téléphone, onglets de la fiche client autres que l'aperçu et l'activité, pages côté client, mesures de performance.

Suite de l'audit : **pages côté client** (axe-core, clair et sombre, vrai code des pages, base simulée, page de test supprimée) : tableau de bord, mes demandes, mes documents, rapport, charte RGPD, glossaire, signaler un problème, accueil d'une demande, récapitulatif, note de cadrage, proposition, créneaux, connexion. **Une seule violation** : dans le glossaire, la liste des catégories et le champ de recherche n'avaient pas de nom accessible (corrigé par des `aria-label`). Aucune violation de contraste.

Limite : la base simulée est presque vide, donc plusieurs pages (récapitulatif, note de cadrage, proposition, questionnaire par section) n'ont affiché que leur état vide ou d'erreur ; les écrans pleins de données du questionnaire ne sont pas couverts. À compléter avec de vraies données ou un compte client de test.

### 2026-10-05 : un seul parcours « Nouveau client » (SIRET, fiche, demande, compte) et pré-remplissage de « Identification de la structure »

Demande de l'utilisateur : « Créer un compte » faisait doublon avec la création d'un client ; utiliser le SIRET pour tout remplir, y compris la fiche et le formulaire « Identification de la structure ». Décisions validées : **un seul parcours « Nouveau client »** ; réponses **pré-remplies et modifiables** par le client. Un compte (la personne qui se connecte, rattachée à une demande) et un client (l'entreprise) restent deux notions ; la page « Créer un compte » reste pour les consultants et admins et, pour un compte client, renvoie vers le nouveau parcours (le rattachement à une demande déjà ouverte y reste possible).

Fait :
- **SIRET en premier** dans la fiche (création et modification) : la recherche SIRENE existante remplit raison sociale, forme juridique, NAF, secteur, effectif et adresse.
- **Case « Inviter le contact »** sur « Nouveau client ou prospect » : nom et e-mail du contact, types de prestation pressentis, date limite, consultant responsable (admin). À l'enregistrement, en une fois : fiche, contact principal, demande, **réponses de TC-1 pré-remplies** (raison sociale, SIRET, forme juridique, NAF, secteur, adresse du siège, effectif, convention collective, organisme de formation, NDA, Qualiopi quand la base SIRENE les donne, site web de la fiche), compte client avec mot de passe temporaire affiché dans une fenêtre avant d'ouvrir la demande. La fiche passe à « client » (et non « prospect ») dès qu'une demande est ouverte.
- Chaque étape après la fiche peut échouer sans défaire les précédentes (rien n'est supprimé) : un message dit ce qui reste à faire, par exemple « Le compte client n'a pas pu être créé, réessayez depuis la demande ».
- `engine/pre-remplissage.js` (pur, +5 tests : correspondance données SIRENE vers questions TC-1, la fiche prime pour la raison sociale et le SIRET, découpage du nom), `services/ouverture-dossier.js`, `views/consultant/client-nouveau.js` ; la correspondance données vers questions est maintenant partagée avec la recherche par SIRET du questionnaire (`views/client/section.js`).

Vérifié : 267 tests, `check-coherence` 0 erreur ; navigateur (services simulés, supprimés ensuite) : SIRET en premier champ, bloc d'invitation replié puis déplié, erreurs de saisie claires, appel avec les bons champs (statut client, contact, types, consultant), fenêtre des identifiants puis ouverture de la demande ; capture de la mise en page. **Non vérifié** : le parcours complet sur la vraie base (création du compte par la fonction serveur, écriture des réponses, doublon de SIRET), la recherche SIRENE en direct, l'OPCO de la fiche (non repris dans TC-1 : les identifiants des options ne correspondent pas aux libellés de la fiche).

### 2026-10-05 : sauvegarde des 12 tables du LMS (avant nettoyage de rd-flow)

Demande : que le projet Supabase rd-flow ne contienne que les tables de RD Recueil ; export et sauvegarde complète (tables, RLS, politiques) des tables du LMS. **Rien n'a été supprimé** : la base n'a pas été modifiée. Sauvegarde dans `sauvegardes/rd-flow-lms-2026-10-05/` (dossier **ignoré par git** : données personnelles) : `01_schema_lms.sql` (12 tables, contraintes, index, RLS, 34 politiques, 252 droits, commentaires, fonctions `get_my_role` et `handle_new_user`), `02_donnees_lms.sql` (toutes les lignes : 7 + 1 + 10 + 1 + 10 + 2 + 0 + 0 + 7 + 28 + 14 + 77, comptes vérifiés), `LISEZ-MOI.md` (restauration et précautions).

Constats utiles pour la suite : aucune table, vue, fonction ni politique de RD Recueil ne dépend des tables du LMS ; seul le déclencheur `on_auth_user_created` (sur `auth.users`, fonction `handle_new_user`) écrit dans une table du LMS (sans bloquer la création de comptes si la table disparaît) ; les comptes `auth.users` sont communs aux deux applications ; aucun fichier de stockage lié au LMS. Suppression des tables : non faite, à décider par l'utilisateur.

## 5. Points ouverts

- **Journal d'audit et effacement** : une demande d'effacement d'un contact devra aussi purger ses valeurs dans `audit_log` (accès de service, pas de bouton). À prévoir avec la politique de conservation (lot F, étape F2) ; rien d'automatique pour l'instant.

- **Tables d'autres applications ouvertes à tout compte connecté** (voir le constat de l'étape S1) : à décider avec l'utilisateur.
- **Alertes de sécurité Supabase déjà présentes avant le CRM (non traitées)** : `rpc_valider_cadrage(uuid, text)` est exécutable par le rôle `anon` (le `revoke` de 0005 portait sur l'ancienne signature) ; `est_staff`, `get_my_role`, `handle_new_user`, `rls_auto_enable`, `fn_historiser_reponse`, `fn_notifier_evenement` sont exécutables par `anon` ; `get_my_role` et `update_updated_at_column` n'ont pas de `search_path` fixe ; la protection contre les mots de passe compromis est désactivée côté Auth. S'ajoute le trou déjà signalé : `rpc_valider_cadrage` et `rpc_accepter_proposition` ne vérifient pas que l'appelant a accès à la demande. À traiter dans une migration dédiée, avec accord.
- **Fichiers d'essais d'e-mails dans `app/`** : `app/mail.html` n'est pas de moi, sans doute un essai d'e-mail (`app/mail.ts` et `app/preview.ts` n'existent plus). `app/` est publié sur GitHub Pages : à ne pas commiter tels quels, un gabarit d'e-mail n'a pas de raison d'y être. Le fichier `app/assets/images/logo.svg` est aussi modifié sans être commité : à relire avant de le commiter.

- **Essai réel des lots A, B, C, D, E, F et Accès** (pour le lot F : modifier une fiche et lire le journal en admin (un consultant n'y voit rien) ; renseigner un consentement ; enregistrer puis clôturer une réclamation ; demander un avis sur une demande gagnée, y répondre avec un compte client invité et vérifier la notification du consultant ; ouvrir la page Indicateurs et les deux exports ; pour le lot E : tester la recherche et le raccourci "/" dans la vraie barre du haut avec un compte admin puis consultant ; créer deux fiches proches et les fusionner (contacts, demandes, historique), ignorer puis remettre un couple ; vérifier la liste des dormants et la création d'une relance ; pour le lot D : saisir un financement et des factures sur une demande, importer un export Shine avec un vrai compte admin, vérifier qu'un consultant ne voit ni la carte Facturation ni les factures ; pour le lot Accès : créer un compte consultant, lui attribuer une demande, vérifier qu'il ne voit ni les autres demandes ni leurs clients, fichiers ou notifications, et qu'un client peut accepter ou refuser une proposition et réserver un rendez-vous) : à faire une fois déployé, avec un compte admin (liste, fiche, modification, import depuis une demande, contacts, création de demande depuis une fiche, bouton "Fiche client" de la vue 360) et avec un compte client (aucun accès aux fiches).

- `app/crm_app.md` est dans `app/` (dossier publié sur GitHub Pages) et n'est pas versionné : le déplacer dans `docs/` avant tout `git add app`.
- Les lots A (`db4b088`) et B (`b57125b`) sont commités et poussés sur GitHub  et le lot C (`a780eb1`) aussi. Le lot Accès (`ca97dc2`) est poussé lui aussi. Le lot D (`fea958e`) est poussé lui aussi, ainsi que le lot E (`1640423`) et le lot F (`a310dc5`). Toutes les migrations (0030 à 0049) sont appliquées sur la base de production et le code des lots A à F est publié sur GitHub Pages ; l'essai réel avec un compte consultant et un compte client reste à faire.
- Hors CRM, toujours en attente : modèles d'e-mails refondus (`creer-compte/mail.ts`, `envoyer-notification-email/index.ts`) à ne pas déployer sans accord ; `docs/05_SKELETONS.md` non commité ; fichiers locaux non versionnés (`.claude/skills/`, `app/arb.bat`, `app/arborescence.txt`, `app/security.md`) ; trou de droits sur `rpc_valider_cadrage` et `rpc_accepter_proposition` (accès à vérifier par demande), proposé et non traité.
