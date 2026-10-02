-- CRM, lot B etape 3 : l'auteur d'un echange reference `profils` (et non
-- auth.users) pour que l'application puisse afficher son nom directement
-- (jointure PostgREST). Meme comportement : si le profil disparait, l'auteur
-- devient vide et l'echange reste.

alter table activites drop constraint activites_auteur_fkey;
alter table activites
  add constraint activites_auteur_fkey foreign key (auteur) references profils(user_id) on delete set null;
