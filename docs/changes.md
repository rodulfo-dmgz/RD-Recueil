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
| D | Financements, références de factures (Shine) | à faire (après le lot Accès) |
| E | Recherche globale, fusion de doublons, clients dormants | à faire |
| F | Satisfaction, réclamations, consentement des contacts, journal d'audit | à faire |

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

## 5. Points ouverts

- **Tables d'autres applications ouvertes à tout compte connecté** (voir le constat de l'étape S1) : à décider avec l'utilisateur.
- **Alertes de sécurité Supabase déjà présentes avant le CRM (non traitées)** : `rpc_valider_cadrage(uuid, text)` est exécutable par le rôle `anon` (le `revoke` de 0005 portait sur l'ancienne signature) ; `est_staff`, `get_my_role`, `handle_new_user`, `rls_auto_enable`, `fn_historiser_reponse`, `fn_notifier_evenement` sont exécutables par `anon` ; `get_my_role` et `update_updated_at_column` n'ont pas de `search_path` fixe ; la protection contre les mots de passe compromis est désactivée côté Auth. S'ajoute le trou déjà signalé : `rpc_valider_cadrage` et `rpc_accepter_proposition` ne vérifient pas que l'appelant a accès à la demande. À traiter dans une migration dédiée, avec accord.
- **Fichiers d'essais d'e-mails dans `app/`** : `app/mail.html` n'est pas de moi, sans doute un essai d'e-mail (`app/mail.ts` et `app/preview.ts` n'existent plus). `app/` est publié sur GitHub Pages : à ne pas commiter tels quels, un gabarit d'e-mail n'a pas de raison d'y être. Le fichier `app/assets/images/logo.svg` est aussi modifié sans être commité : à relire avant de le commiter.

- **Essai réel des lots A, B, C et Accès** (pour le lot Accès : créer un compte consultant, lui attribuer une demande, vérifier qu'il ne voit ni les autres demandes ni leurs clients, fichiers ou notifications, et qu'un client peut accepter ou refuser une proposition et réserver un rendez-vous) : à faire une fois déployé, avec un compte admin (liste, fiche, modification, import depuis une demande, contacts, création de demande depuis une fiche, bouton "Fiche client" de la vue 360) et avec un compte client (aucun accès aux fiches).

- `app/crm_app.md` est dans `app/` (dossier publié sur GitHub Pages) et n'est pas versionné : le déplacer dans `docs/` avant tout `git add app`.
- Les lots A (`db4b088`) et B (`b57125b`) sont commités et poussés sur GitHub  et le lot C (`a780eb1`) aussi. Le lot Accès (`ca97dc2`) est poussé lui aussi. Toutes les migrations (0030 à 0043) sont appliquées sur la base de production ; le code du lot Accès est publié sur GitHub Pages avec ce push (essai réel avec un compte consultant et un compte client toujours à faire).
- Hors CRM, toujours en attente : modèles d'e-mails refondus (`creer-compte/mail.ts`, `envoyer-notification-email/index.ts`) à ne pas déployer sans accord ; `docs/05_SKELETONS.md` non commité ; fichiers locaux non versionnés (`.claude/skills/`, `app/arb.bat`, `app/arborescence.txt`, `app/security.md`) ; trou de droits sur `rpc_valider_cadrage` et `rpc_accepter_proposition` (accès à vérifier par demande), proposé et non traité.
