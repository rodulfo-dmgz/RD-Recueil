-- CRM, lot B etape 3 : un echange note appartient a son auteur. Tout le staff
-- peut lire et en creer, mais seuls l'auteur ou l'admin peuvent le modifier ou
-- le supprimer (la politique `activites_staff` de 0034, "for all", laissait
-- tout consultant effacer l'historique d'un collegue).

drop policy activites_staff on activites;

create policy activites_lecture on activites for select to authenticated
  using (est_staff());

create policy activites_creation on activites for insert to authenticated
  with check (est_staff());

create policy activites_modification on activites for update to authenticated
  using (est_admin() or (est_staff() and auteur = auth.uid()))
  with check (est_admin() or (est_staff() and auteur = auth.uid()));

create policy activites_suppression on activites for delete to authenticated
  using (est_admin() or (est_staff() and auteur = auth.uid()));
