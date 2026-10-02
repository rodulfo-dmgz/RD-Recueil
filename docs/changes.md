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
| A | Fiche client et contacts | terminé (reste un essai avec un vrai compte, voir points ouverts) |
| B | Activités, tâches, page "Aujourd'hui", relances dans le calendrier | à faire |
| C | Montants, CA pondéré, pipeline en euros, KPI financiers | à faire |
| D | Financements, références de factures (Shine) | à faire |
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

## 5. Points ouverts

- **Essai réel du lot A** : à faire une fois déployé, avec un compte admin (liste, fiche, modification, import depuis une demande, contacts, création de demande depuis une fiche, bouton "Fiche client" de la vue 360) et avec un compte client (aucun accès aux fiches).

- `app/crm_app.md` est dans `app/` (dossier publié sur GitHub Pages) et n'est pas versionné : le déplacer dans `docs/` avant tout `git add app`.
- Rien du lot A n'est commité pour l'instant (voir l'étape 7 pour la liste des fichiers).
- Hors CRM, toujours en attente : modèles d'e-mails refondus (`creer-compte/mail.ts`, `envoyer-notification-email/index.ts`) à ne pas déployer sans accord ; `docs/05_SKELETONS.md` non commité ; fichiers locaux non versionnés (`.claude/skills/`, `app/arb.bat`, `app/arborescence.txt`, `app/security.md`) ; trou de droits sur `rpc_valider_cadrage` et `rpc_accepter_proposition` (accès à vérifier par demande), proposé et non traité.
