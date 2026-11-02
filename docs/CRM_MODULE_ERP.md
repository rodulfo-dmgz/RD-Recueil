# Module `crm_` de l'ERP : conception et état d'avancement

Le CRM RD Recueil devient un **module de l'ERP**, indépendant des autres modules mais bâti sur le **noyau commun** (`app_*`). Acheté seul, il s'installe avec le noyau : noyau complet + `supabase/modules/crm/`. Il se raccorde plus tard aux autres modules par références souples et événements, sans migration.

Décisions du propriétaire (2026-11-02) : option A (noyau obligatoire), rôle `crm_consultant` ajouté au catalogue, CRM propriétaire de ses clients, contacts, demandes, devis et signatures. Travail sur la branche `crm-prefixe`. Rien n'est appliqué sur un vrai projet Supabase.

## 1. Ce qui est livré (base de données)

Dossier `supabase/modules/crm/` :

| Fichier | Contenu |
|---|---|
| `migrations/20261009400001_crm_module.sql` | Module `crm`, rôles, organisation courante, aides de droits, amorçage à l'activation |
| `migrations/20261009400002_crm_tables.sql` | Séquence, 32 tables, contraintes, index |
| `migrations/20261009400003_crm_fonctions.sql` | 39 fonctions (flux de la demande, signatures, fusion de clients, déclencheurs, droits d'exécution) |
| `migrations/20261009400004_crm_vues_declencheurs.sql` | 3 vues, déclencheurs métier, audit, organisation par défaut, même organisation |
| `migrations/20261009400005_crm_securite.sql` | Sécurité par ligne, 67 politiques, droits, stockage |
| `seed/seed_v1.sql` | Questionnaire (187 questions), glossaire (134 termes) : données de référence |
| `tests/essai_crm_isolation.sql` | 63 contrôles : rôles, isolation entre deux organisations, parcours complet jusqu'au devis signé, événements |

Ordre d'installation : migrations du noyau (`supabase/noyau/migrations`), puis celles du CRM dans l'ordre des noms, puis le seed, puis l'activation du module pour l'organisation (`insert into app_organisation_modules (organisation_id, module_code) values (..., 'crm')`, ce qui crée les probabilités par statut).

Vérifié sur PostgreSQL (PGlite) avec le noyau réel de l'ERP (50 migrations) : les 63 contrôles passent. Aucune table sans sécurité par ligne, aucun droit pour `anon`, aucune fonction exécutable par `anon`, aucune clé étrangère vers `auth.users`, `crm_profils` ou un autre module.

## 2. Rôles et droits

| Rôle | Qui | Accès |
|---|---|---|
| `crm_admin` | Administrateur du CRM (implicite pour l'administrateur d'organisation) | Tout dans l'organisation, factures et journal d'audit compris, attribue les demandes |
| `crm_consultant` | Consultant | Les demandes qui lui sont attribuées et les clients dont il est responsable ou qui y sont liés |
| `crm_client` | Client externe | Uniquement les demandes où il est invité (`crm_demande_acces`, par identifiant de personne ou par e-mail) |

Règles :
- Les politiques utilisent `app_has_role(organisation_id, ...)` du noyau via `crm_est_admin(org)` et `crm_est_staff(org)`.
- Un client est un membre de l'organisation : toute politique exige donc **le rôle ou l'invitation sur la demande**, jamais seulement l'appartenance.
- `crm_profils` a disparu : l'identité est dans `app_personnes`, l'appartenance dans `app_membres`, les rôles dans `app_droits`.
- Module désactivé pour une organisation : plus aucune donnée `crm_` n'est visible, même pour son administrateur.

## 2 bis. Conventions de l'ERP respectées

- Fonctions : `search_path` vide et noms qualifiés (`public.crm_...`) partout ; aucune fonction exécutable par `anon` ; les aides internes (`crm_personne_est_staff`, `crm_ids_admins`, `crm_destinataires_staff`) ne sont pas appelables par l'API.
- Politiques préfixées `crm_` ; aucune clé étrangère vers un autre module ; aucun mot réservé d'un autre module dans le SQL.
- Limite connue : la séquence `crm_demande_seq` (référence `RDF-AAAA-NNNN`) est globale à toutes les organisations ; un compteur par organisation (`app_next_number` du noyau) est à prévoir si la numérotation d'une organisation ne doit pas révéler le volume des autres.

## 2 ter. Intégrité des documents signés

- Le **devis** et la **note de cadrage** ne se signent que par `crm_rpc_accepter_proposition`, `crm_rpc_refuser_proposition`, `crm_rpc_valider_cadrage` et `crm_rpc_demander_modification`, réservées au client invité avec le droit `editeur` et le rôle `crm_client` (`crm_peut_signer`) : un invité en lecture seule (`lecteur`) voit la demande mais ne signe pas, et ni le consultant ni l'administrateur ne signent à la place du client. Ces fonctions exigent l'état `envoyee` (on ne signe ni un brouillon, ni deux fois), une signature `data:image/png;base64,...` de 1 Mo au plus, et un commentaire de 4 000 caractères au plus.
- Des déclencheurs `b0_proteger` interdisent toute écriture directe de la décision, de la signature, du code de vérification et du statut final (drapeau de transaction `app.signature_via_rpc`), toute modification, suppression ou ajout de ligne sur un document signé, refusé ou envoyé, et toute création d'un document déjà signé.
- Le code de vérification (`NNNNNN-NNNNNN`) vient de `gen_random_uuid()` (`crm_code_verification`), plus de `random()`.
- Conservation et effacement : un document signé ou refusé ne se supprime plus du tout, même par un administrateur, donc supprimer une demande ou un client qui en porte un échoue. C'est voulu (preuve). Le droit à l'effacement passera par une fonction dédiée d'anonymisation des données personnelles qui conserve le document ; durée de conservation à décider par le propriétaire.
- Le drapeau `app.signature_via_rpc` n'est posé que par les quatre fonctions de signature. Ne jamais créer de fonction publique qui le pose pour un appelant.
- Mode « saisi par l'équipe » (acceptation par téléphone ou papier) : volontairement absent. S'il est voulu, ce sera un mode distinct (auteur, moyen, date, justificatif), jamais la signature image du client. Un droit distinct « signataire » (plus sûr qu'« editeur » pour un engagement) est à confirmer par le propriétaire.
- Évolution possible : passer par `app_signer` et `app_signatures` du noyau (ajout seul, code généré par la base) ; cela touche l'application.

## 3. Organisation

Chaque table métier porte `organisation_id uuid not null`. Le front n'a pas besoin de l'envoyer :
- à l'insertion, `crm_fn_org_defaut` prend l'organisation du premier parent trouvé (demande, client...), sinon l'organisation courante (`crm_org_courante` : en-tête `x-organisme` du noyau, sinon l'unique organisation de la personne) ;
- `app_private.verifier_meme_organisation` refuse un parent d'une autre organisation.

Données de référence **globales**, exception déclarée au même titre que `app_modules` et `app_roles` : `crm_questionnaires`, `crm_sections`, `crm_questions`, `crm_glossaire`. Livrées par migration, sans politique d'écriture, version figée dans `crm_demandes.questionnaire_id`. Le personnel (`crm_a_acces_staff_module()`) lit tout ; le client (`crm_a_acces_module()`) ne lit que les sections et questions visibles au client. Si une organisation doit un jour personnaliser : `organisation_id` nullable (null = global) et une politique qui lit les lignes globales et celles de son organisation. Les probabilités par statut (`crm_probabilites_statut`) sont **par organisation**, modifiables par `crm_admin`.

## 4. Raccordement aux autres modules

Aucune clé étrangère vers un autre module. Le CRM émet, sans aucun montant (`app_private.emettre_evenement`) :

| Sujet | Quand | Données |
|---|---|---|
| `crm.demande.statut_change` | Chaque changement de statut d'une demande | `demande_id`, `de`, `vers` |
| `crm.devis.signe` | Le client signe le devis | `proposition_id`, `demande_id` |
| `crm.devis.refuse` | Le client refuse le devis | `proposition_id`, `demande_id` |

À ajouter à la liste de contrôle du noyau (§12) : ces trois sujets émis, aucun consommé.

## 5. Correspondance avec l'ancien CRM autonome

| Avant (`supabase/migrations/20261007000000_crm_install.sql`) | Maintenant |
|---|---|
| `crm_est_admin()`, `crm_est_staff()` | `crm_est_admin(org)`, `crm_est_staff(org)` |
| `crm_profils` (rôle, nom, e-mail, mot de passe temporaire) | `app_personnes` + `app_membres` + `app_droits` ; plus de mot de passe temporaire |
| `auth.uid()` partout | `app_personne_id()` (colonnes `user_id`, `consultant_id`, `auteur`... contiennent désormais des identifiants de **personne**) |
| `crm_rpc_marquer_mot_de_passe_change` | Supprimée |
| Trigger sur `auth.users` qui créait le profil client | Supprimé : l'accès se déduit de `crm_demande_acces` (e-mail ou personne) et du droit `crm_client` |
| Buckets `demandes`, `taches` ; politiques `stockage_*` | Buckets `crm-demandes`, `crm-taches` ; politiques `crm_stockage_*` |
| Unicité SIRET, numéro de facture | Par organisation |

## 6. Ce qui reste à faire

Le front et les fonctions serveur utilisent encore l'ancien modèle ; ils ne fonctionnent pas sur ce module tant qu'ils ne sont pas adaptés.

1. **Application (`app/js`)** : profil et rôle depuis `app_personnes`, `app_droits` (au lieu de `crm_profils`) ; en-tête `x-organisme` ; jointures `crm_profils!...(nom, email)` à remplacer par des lectures sur `app_v_personnes` ; identifiants de personne au lieu d'identifiants de compte ; suppression du changement de mot de passe obligatoire ; buckets `crm-*`.
2. **Fonctions serveur** (`supabase/functions`) : `creer-compte` (à remplacer par les invitations du noyau, `app_invitations`), `supprimer-utilisateur`, `envoyer-notification-email` ; noms `crm-*` demandés par l'ERP.
3. **Valeurs en dur** : émetteur du devis (lire `app_organisations`), lien Cal.com, expéditeur des e-mails, préfixe `RDF-` des références.
4. **Reprise des données** (`scripts/migrer-donnees.mjs`) : ajouter l'organisation, créer les personnes et les droits.
5. **Plus tard (optionnel)** : s'appuyer sur `app_audit`, `app_signatures`, `app_fichiers`, `app_notifications` et `app_tiers` du noyau à la place des tables équivalentes du CRM.
6. Relecture par la session ERP (contrat du noyau, nommage, isolation) avant toute application.

## 7. Régénérer les fichiers

Les cinq migrations ont été produites par transformation du script autonome, puis relues. Elles sont désormais **la source de vérité** du module : à modifier directement.
