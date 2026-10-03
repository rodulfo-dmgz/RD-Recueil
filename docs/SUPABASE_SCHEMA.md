# Cartographie de la base Supabase (étape 2 du cahier des charges de refonte)

Date : 3 octobre 2026. Projet `kowvfsesbuevylxayinl`. Lecture seule : rien n'a été modifié. Le détail du modèle et des règles est dans `docs/01_ARCHITECTURE.md` (sections 7 et 8) et les 51 migrations dans `supabase/migrations/` (0001 à 0051).

## 1. En chiffres

39 tables (toutes avec la sécurité par ligne activée), 3 vues, 43 fonctions, 1 bucket de fichiers privé, 4 extensions utiles (`pgcrypto`, `uuid-ossp`, `pg_stat_statements`, `supabase_vault`). Les volumes sont faibles : 4 clients, 4 demandes, 4 comptes, quelques centaines de réponses.

## 2. Tables du CRM (ce projet)

| Domaine | Tables (colonnes) | Relations principales | Accès |
|---|---|---|---|
| Clients | `clients` (21), `contacts` (13), `activites` (10), `taches` (15), `doublons_ignores` (4) | `contacts`, `activites`, `taches` -> `clients` ; `taches` -> `profils` | Admin : tout. Consultant : ses clients (`peut_voir_client`). Client : aucun. |
| Demandes | `demandes` (13), `demande_acces` (5), `demande_enjeux` (4), `evenements` (8), `commentaires` (7), `entretien_creneaux` (5) | `demandes` -> `clients`, `profils` (consultant) ; le reste -> `demandes` | Admin, consultant de la demande ; client invité par `demande_acces`. |
| Questionnaire | `questionnaires` (6), `sections` (7), `questions` (12), `glossaire` (6), `reponses` (7), `reponses_historique` (7) | `reponses` -> `demandes`, `questions` | Lecture du questionnaire pour tous ; réponses selon l'accès à la demande. |
| Note et proposition | `notes_cadrage` (11), `propositions` (10), `proposition_lignes` (7) | -> `demandes` | Personnel ; client sur les documents envoyés. |
| Fichiers | `fichiers` (9) + bucket `demandes` (privé) | -> `demandes` | Chemin `client/référence/...` : la référence (2e segment) porte le droit. |
| Finance | `financements` (10), `factures` (10), `probabilites_statut` (2) | -> `demandes` | Financements : personnel de la demande. Factures : admin seul. |
| Qualité et conformité | `consentements` (11), `reclamations` (15), `satisfactions` (13), `audit_log` (11) | `consentements` -> `contacts` ; `reclamations`, `satisfactions` -> `clients`, `demandes` | Personnel du client ; le client passe par des fonctions (`rpc_deposer_reclamation`, `rpc_mes_reclamations`, `rpc_repondre_satisfaction`). Journal : lecture admin, ajout par déclencheur seulement. |
| Comptes et alertes | `profils` (6), `notifications` (9) | `profils.user_id` -> `auth.users` | Profils en lecture seule (créations par fonctions de service). |

## 3. Tables du LMS (autre projet, même base)

`sessions` (13), `stagiaires` (42), `groupes` (13), `inscriptions_session` (13), `jurys` (7), `jurys_sessions` (4), `titres` (28), `examens_blancs` (5), `wall_sessions` (6), `wall_ideas` (7), `profils_utilisateurs` (12), `documents_generes` (9, 57 lignes : aucun code de ce CRM ne l'utilise). Ce CRM ne les utilise pas et n'en dépend pas. **Ces douze tables ont une politique « vrai pour tous »** : voir `docs/AUDIT_CRM.md`, section 7.

## 4. Vues

| Vue | Rôle |
|---|---|
| `v_clients` | Liste des clients avec nombres de demandes, dernière activité, CA signé, pipeline pondéré, contact principal, tâches ouvertes (sous-requêtes par client). Droits de l'appelant. |
| `v_demandes_montants` | Montant retenu, source, probabilité, pondéré, date de décision par demande. Droits de l'appelant. |
| `v_reponses_client` | Réponses sans l'annotation du consultant, pour le client. |

## 5. Fonctions

| Famille | Fonctions |
|---|---|
| Droits (security definer) | `est_admin`, `est_staff`, `get_my_role`, `peut_voir_client`, `peut_voir_demande`, `acces_demande`, `a_acces`, `client_peut_ecrire_reponse` |
| Flux de la demande (security definer) | `rpc_changer_statut`, `rpc_soumettre`, `rpc_valider_cadrage`, `rpc_demander_modification`, `rpc_accepter_proposition`, `rpc_refuser_proposition`, `rpc_confirmer_reservation_calcom`, `rpc_archiver_demande`, `rpc_assigner_demande`, `rpc_jalons` |
| CRM (security definer) | `rpc_fusionner_clients`, `rpc_deposer_reclamation`, `rpc_mes_reclamations`, `rpc_repondre_satisfaction`, `rpc_marquer_mot_de_passe_change` |
| Déclencheurs | `fn_audit`, `fn_notifier_evenement`, `fn_notifier_tache`, `fn_notifier_satisfaction`, `fn_historiser_reponse`, `fn_premiere_saisie`, `fn_gerer_nouvel_utilisateur`, `handle_new_user`, `fn_reference`, `fn_touch`, `fn_tache_maj`, `fn_consentement_maj`, `fn_reclamation_maj`, `fn_satisfaction_maj`, `fn_attribuer_client`, `fn_attribuer_demande`, `fn_proteger_assignation_client`, `fn_proteger_assignation_demande`, `update_updated_at_column` |
| Utilitaire | `rls_auto_enable` |

## 6. Authentification et fichiers

- Authentification par e-mail et mot de passe ; comptes créés uniquement par la fonction de service `creer-compte` (mot de passe temporaire, changement obligatoire). Rôles : `admin`, `consultant`, `client`.
- Fonctions de service (Edge Functions, dossier `supabase/functions/`) : `creer-compte`, `supprimer-utilisateur`, `envoyer-notification-email`, `rncp-lookup` et `certifinfo-lookup` (recherche de certifications).
- Fichiers : bucket privé `demandes`, politiques par référence de demande.

## 7. Points à retenir pour la refonte

- **Pas de table pour les vues enregistrées ni les préférences d'affichage** : la phase « vues » demandera une table nouvelle (par utilisateur, avec RLS). Aucune structure équivalente n'existe.
- **Pas de table « opportunités »** ni « prospects » : ce sont les `demandes` et les `clients` au statut `prospect` (décisions des lots A et C).
- **Volume** : `v_clients` calcule des sous-requêtes pour chaque ligne ; une pagination côté base sera nécessaire avant de gros volumes.
- **Sécurité** : voir `docs/AUDIT_CRM.md`, section 7 (tables du LMS, alertes anciennes).
