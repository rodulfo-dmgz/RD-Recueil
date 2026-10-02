-- CRM, lot A etape 4 : la suppression d'un client est reservee a l'admin
-- (docs/changes.md). `clients_staff` (for all) laissait aussi supprimer aux
-- consultants ; elle est remplacee par une politique par commande. La base
-- refuse deja de supprimer un client qui a des demandes (cle etrangere).

drop policy clients_staff on clients;

create policy clients_staff_lecture on clients for select to authenticated
  using (est_staff());

create policy clients_staff_creation on clients for insert to authenticated
  with check (est_staff());

create policy clients_staff_modification on clients for update to authenticated
  using (est_staff()) with check (est_staff());

create policy clients_admin_suppression on clients for delete to authenticated
  using (exists (select 1 from profils where user_id = auth.uid() and role = 'admin'));
