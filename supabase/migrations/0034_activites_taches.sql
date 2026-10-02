-- CRM, lot B etape 1 : echanges notes (activites) et taches (docs/changes.md).
-- Les activites sont l'historique commun d'un client, lisible par tout le
-- staff. Les taches sont personnelles : un consultant ne voit et ne gere que
-- celles qui lui sont confiees, l'admin voit tout et designe le responsable.

create or replace function est_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from profils where user_id = auth.uid() and role = 'admin');
$$;

revoke all on function est_admin() from public, anon, authenticated;
grant execute on function est_admin() to authenticated;

-- Une notification peut mener ailleurs qu'a une demande (par exemple la
-- fiche d'un client) : `lien` est alors le chemin de l'application.
alter table notifications add column lien text;

create table activites (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients on delete cascade,
  contact_id uuid references contacts on delete set null,
  demande_id uuid references demandes on delete set null,
  auteur uuid references auth.users on delete set null default auth.uid(),
  type text not null check (type in ('note', 'appel', 'email', 'rendez_vous', 'autre')),
  objet text not null,
  description text,
  date_activite timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index idx_activites_client on activites (client_id, date_activite desc);

alter table activites enable row level security;

create policy activites_staff on activites for all to authenticated
  using (est_staff()) with check (est_staff());

create table taches (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients on delete cascade,
  contact_id uuid references contacts on delete set null,
  demande_id uuid references demandes on delete set null,
  assignee_id uuid references profils(user_id) on delete set null,
  created_by uuid references auth.users on delete set null default auth.uid(),
  titre text not null,
  description text,
  type text not null default 'autre' check (type in ('appel', 'email', 'relance', 'rendez_vous', 'autre')),
  echeance date not null,
  statut text not null default 'a_faire' check (statut in ('a_faire', 'terminee', 'annulee')),
  terminee_le timestamptz,
  terminee_par uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_taches_assignee on taches (assignee_id, statut, echeance);
create index idx_taches_client on taches (client_id);

alter table taches enable row level security;

create policy taches_lecture on taches for select to authenticated
  using (est_admin() or (est_staff() and assignee_id = auth.uid()));

create policy taches_creation on taches for insert to authenticated
  with check (est_admin() or (est_staff() and assignee_id = auth.uid()));

create policy taches_modification on taches for update to authenticated
  using (est_admin() or (est_staff() and assignee_id = auth.uid()))
  with check (est_admin() or (est_staff() and assignee_id = auth.uid()));

create policy taches_suppression on taches for delete to authenticated
  using (est_admin() or (est_staff() and assignee_id = auth.uid()));

-- Date de mise a jour et de cloture tenues par la base.
create or replace function fn_tache_maj()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.statut = 'terminee' and old.statut <> 'terminee' then
    new.terminee_le := now();
    new.terminee_par := auth.uid();
  elsif new.statut <> 'terminee' then
    new.terminee_le := null;
    new.terminee_par := null;
  end if;
  return new;
end;
$$;

create trigger trg_taches_maj
  before update on taches
  for each row execute function fn_tache_maj();

-- Notification interne au responsable quand quelqu'un d'autre lui confie une
-- tache (creation ou changement de responsable). `reference` porte le nom du
-- client : c'est ce que le panneau affiche sous le titre.
create or replace function fn_notifier_tache()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client text;
begin
  if new.assignee_id is null or new.assignee_id is not distinct from auth.uid() then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.assignee_id is not distinct from old.assignee_id then
    return new;
  end if;

  select raison_sociale into v_client from clients where id = new.client_id;
  insert into notifications (destinataire, demande_id, reference, type, titre, lien)
  values (new.assignee_id, new.demande_id, coalesce(v_client, 'Client'), 'tache', 'Nouvelle tâche : ' || new.titre, '/clients/' || new.client_id || '/activite');
  return new;
end;
$$;

revoke all on function fn_notifier_tache() from public, anon, authenticated;

create trigger trg_notifier_tache
  after insert or update of assignee_id on taches
  for each row execute function fn_notifier_tache();

-- v_clients : tâches ouvertes (selon les droits de l'appelant) et prochaine
-- échéance ; la dernière activité tient compte des échanges notés.
create or replace view v_clients with (security_invoker = true) as
select
  c.*,
  (select count(*) from demandes d where d.client_id = c.id and not d.archivee) as nb_demandes,
  (select count(*) from demandes d where d.client_id = c.id and not d.archivee
     and d.statut not in ('gagnee', 'perdue', 'reorientee', 'abandonnee')) as nb_actives,
  (select count(*) from demandes d where d.client_id = c.id and d.statut = 'gagnee') as nb_gagnees,
  greatest(
    c.updated_at,
    (select max(d.updated_at) from demandes d where d.client_id = c.id),
    (select max(a.date_activite) from activites a where a.client_id = c.id)
  ) as derniere_activite,
  (select nullif(trim(concat_ws(' ', k.prenom, k.nom)), '') from contacts k
     where k.client_id = c.id and k.principal limit 1) as contact_principal,
  (select count(*) from taches t where t.client_id = c.id and t.statut = 'a_faire') as nb_taches_ouvertes,
  (select min(t.echeance) from taches t where t.client_id = c.id and t.statut = 'a_faire') as prochaine_echeance
from clients c;

revoke all on v_clients from anon;
