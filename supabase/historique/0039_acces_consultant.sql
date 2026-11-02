-- Lot Acces, etape 1 (docs/changes.md) : cloisonnement par consultant.
-- Regle : un consultant ne voit que SES demandes (demandes.consultant_id) et
-- les clients dont il est responsable (clients.responsable_id) ou qui ont une
-- de ses demandes ; l'admin voit tout ; le client ne change pas (a_acces).
-- Jusqu'ici tout le staff voyait tout (est_staff() dans 28 politiques).
-- Il n'y a pas encore de compte consultant : l'admin garde exactement les
-- memes acces.

-- ─── Fonctions d'acces ──────────────────────────────────────────────────────
-- security definer : elles lisent `demandes` et `clients` sans repasser par
-- leur RLS (pas de recursion). Utilisees pour les tables enfants ; `demandes`
-- et `clients` portent leur regle directement (une ligne qu'on vient
-- d'inserer doit rester visible dans le RETURNING).

create or replace function peut_voir_demande(p_demande_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select est_admin() or exists (
    select 1 from demandes d
    where d.id = p_demande_id and d.consultant_id = auth.uid() and est_staff()
  );
$$;

create or replace function peut_voir_client(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select est_admin() or (est_staff() and (
    exists (select 1 from clients c where c.id = p_client_id and c.responsable_id = auth.uid())
    or exists (select 1 from demandes d where d.client_id = p_client_id and d.consultant_id = auth.uid())
  ));
$$;

revoke all on function peut_voir_demande(uuid) from public, anon, authenticated;
revoke all on function peut_voir_client(uuid) from public, anon, authenticated;
grant execute on function peut_voir_demande(uuid) to authenticated;
grant execute on function peut_voir_client(uuid) to authenticated;

-- ─── Demandes ───────────────────────────────────────────────────────────────

drop policy demandes_staff on demandes;
create policy demandes_staff on demandes for all to authenticated
  using (est_admin() or (est_staff() and consultant_id = auth.uid()))
  with check (est_admin() or (est_staff() and consultant_id = auth.uid()));

-- Tables rattachees a une demande.
drop policy commentaires_staff on commentaires;
create policy commentaires_staff on commentaires for all to authenticated
  using (peut_voir_demande(demande_id)) with check (peut_voir_demande(demande_id));

drop policy demande_acces_staff on demande_acces;
create policy demande_acces_staff on demande_acces for all to authenticated
  using (peut_voir_demande(demande_id)) with check (peut_voir_demande(demande_id));

drop policy demande_enjeux_staff on demande_enjeux;
create policy demande_enjeux_staff on demande_enjeux for all to authenticated
  using (peut_voir_demande(demande_id)) with check (peut_voir_demande(demande_id));

drop policy entretien_creneaux_staff on entretien_creneaux;
create policy entretien_creneaux_staff on entretien_creneaux for all to authenticated
  using (peut_voir_demande(demande_id)) with check (peut_voir_demande(demande_id));

drop policy fichiers_staff on fichiers;
create policy fichiers_staff on fichiers for all to authenticated
  using (peut_voir_demande(demande_id)) with check (peut_voir_demande(demande_id));

drop policy notes_cadrage_staff on notes_cadrage;
create policy notes_cadrage_staff on notes_cadrage for all to authenticated
  using (peut_voir_demande(demande_id)) with check (peut_voir_demande(demande_id));

drop policy propositions_staff on propositions;
create policy propositions_staff on propositions for all to authenticated
  using (peut_voir_demande(demande_id)) with check (peut_voir_demande(demande_id));

drop policy proposition_lignes_staff on proposition_lignes;
create policy proposition_lignes_staff on proposition_lignes for all to authenticated
  using (exists (select 1 from propositions p where p.id = proposition_lignes.proposition_id and peut_voir_demande(p.demande_id)))
  with check (exists (select 1 from propositions p where p.id = proposition_lignes.proposition_id and peut_voir_demande(p.demande_id)));

drop policy reponses_staff on reponses;
create policy reponses_staff on reponses for all to authenticated
  using (peut_voir_demande(demande_id)) with check (peut_voir_demande(demande_id));

drop policy evenements_staff on evenements;
create policy evenements_staff on evenements for select to authenticated
  using (peut_voir_demande(demande_id));

drop policy reponses_historique_staff on reponses_historique;
create policy reponses_historique_staff on reponses_historique for select to authenticated
  using (peut_voir_demande(demande_id));

-- ─── Clients et ce qui leur est rattache ────────────────────────────────────

drop policy clients_staff_lecture on clients;
create policy clients_staff_lecture on clients for select to authenticated
  using (
    est_admin() or (est_staff() and (
      responsable_id = auth.uid()
      or exists (select 1 from demandes d where d.client_id = clients.id and d.consultant_id = auth.uid())
    ))
  );

drop policy clients_staff_creation on clients;
create policy clients_staff_creation on clients for insert to authenticated
  with check (est_admin() or (est_staff() and responsable_id = auth.uid()));

drop policy clients_staff_modification on clients;
create policy clients_staff_modification on clients for update to authenticated
  using (
    est_admin() or (est_staff() and (
      responsable_id = auth.uid()
      or exists (select 1 from demandes d where d.client_id = clients.id and d.consultant_id = auth.uid())
    ))
  )
  with check (
    est_admin() or (est_staff() and (
      responsable_id = auth.uid()
      or exists (select 1 from demandes d where d.client_id = clients.id and d.consultant_id = auth.uid())
    ))
  );

drop policy contacts_staff on contacts;
create policy contacts_staff on contacts for all to authenticated
  using (peut_voir_client(client_id)) with check (peut_voir_client(client_id));

drop policy activites_lecture on activites;
create policy activites_lecture on activites for select to authenticated
  using (peut_voir_client(client_id));

drop policy activites_creation on activites;
create policy activites_creation on activites for insert to authenticated
  with check (peut_voir_client(client_id));

drop policy activites_modification on activites;
create policy activites_modification on activites for update to authenticated
  using (est_admin() or (peut_voir_client(client_id) and auteur = auth.uid()))
  with check (est_admin() or (peut_voir_client(client_id) and auteur = auth.uid()));

drop policy activites_suppression on activites;
create policy activites_suppression on activites for delete to authenticated
  using (est_admin() or (peut_voir_client(client_id) and auteur = auth.uid()));

-- Taches : un consultant en cree pour lui sur un client qu'il voit ; une tache
-- que l'admin lui confie reste lisible et modifiable meme sur un client qu'il
-- ne voit pas (decision de l'utilisateur).
drop policy taches_creation on taches;
create policy taches_creation on taches for insert to authenticated
  with check (est_admin() or (est_staff() and assignee_id = auth.uid() and peut_voir_client(client_id)));

-- Profils : le personnel reste lisible (noms, responsables) ; un profil client
-- seulement s'il est invite sur une demande visible.
drop policy profils_staff_lecture on profils;
create policy profils_staff_lecture on profils for select to authenticated
  using (
    est_admin() or (est_staff() and (
      role in ('admin', 'consultant')
      or exists (select 1 from demande_acces da where da.user_id = profils.user_id)
    ))
  );

-- ─── Assignation : reservee a l'admin ───────────────────────────────────────
-- Un consultant ne peut ni se donner une demande ou un client, ni en donner
-- un autre. auth.uid() nul (SQL direct, Edge Functions) : pas de blocage.

create or replace function fn_proteger_assignation_demande()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.consultant_id is distinct from old.consultant_id and auth.uid() is not null and not est_admin() then
    raise exception 'Seul l''administrateur peut changer le consultant d''une demande.';
  end if;
  return new;
end;
$$;

create trigger trg_demandes_proteger_assignation
  before update on demandes
  for each row execute function fn_proteger_assignation_demande();

create or replace function fn_proteger_assignation_client()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.responsable_id is distinct from old.responsable_id and auth.uid() is not null and not est_admin() then
    raise exception 'Seul l''administrateur peut changer le responsable d''un client.';
  end if;
  return new;
end;
$$;

create trigger trg_clients_proteger_assignation
  before update on clients
  for each row execute function fn_proteger_assignation_client();

-- Un consultant qui cree une demande ou un client en devient le titulaire
-- d'office (sans quoi il ne le verrait plus).
create or replace function fn_attribuer_demande()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.consultant_id is null and auth.uid() is not null and not est_admin() then
    new.consultant_id := auth.uid();
  end if;
  return new;
end;
$$;

create trigger trg_demandes_attribuer
  before insert on demandes
  for each row execute function fn_attribuer_demande();

create or replace function fn_attribuer_client()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.responsable_id is null and auth.uid() is not null and not est_admin() then
    new.responsable_id := auth.uid();
  end if;
  return new;
end;
$$;

create trigger trg_clients_attribuer
  before insert on clients
  for each row execute function fn_attribuer_client();
