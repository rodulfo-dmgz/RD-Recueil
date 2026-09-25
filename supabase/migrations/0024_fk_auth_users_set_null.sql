-- Les references a auth.users hors profils/notifications n'avaient aucune
-- regle de suppression (NO ACTION par defaut) : supprimer un compte ayant
-- deja repondu a une question, valide une note, accepte une proposition,
-- commente, depose un fichier ou ete auteur d'un evenement echouait avec
-- une violation de contrainte. Passe ces references en ON DELETE SET NULL :
-- l'historique reste intact, seule la reference "qui a fait cette action"
-- devient vide au lieu de bloquer la suppression du compte (01_ARCHITECTURE.md
-- section 7/8).

alter table commentaires drop constraint commentaires_auteur_fkey;
alter table commentaires add constraint commentaires_auteur_fkey
  foreign key (auteur) references auth.users(id) on delete set null;

alter table demande_acces drop constraint demande_acces_user_id_fkey;
alter table demande_acces add constraint demande_acces_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

alter table evenements drop constraint evenements_auteur_fkey;
alter table evenements add constraint evenements_auteur_fkey
  foreign key (auteur) references auth.users(id) on delete set null;

alter table fichiers drop constraint fichiers_depose_par_fkey;
alter table fichiers add constraint fichiers_depose_par_fkey
  foreign key (depose_par) references auth.users(id) on delete set null;

alter table notes_cadrage drop constraint notes_cadrage_validee_par_fkey;
alter table notes_cadrage add constraint notes_cadrage_validee_par_fkey
  foreign key (validee_par) references auth.users(id) on delete set null;

alter table propositions drop constraint propositions_decidee_par_fkey;
alter table propositions add constraint propositions_decidee_par_fkey
  foreign key (decidee_par) references auth.users(id) on delete set null;

alter table reponses drop constraint reponses_saisi_par_fkey;
alter table reponses add constraint reponses_saisi_par_fkey
  foreign key (saisi_par) references auth.users(id) on delete set null;
