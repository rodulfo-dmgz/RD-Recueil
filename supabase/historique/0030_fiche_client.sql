-- CRM, lot A : fiche client et contacts (docs/changes.md, lot A etape 1).
-- Etend `clients` (au lieu de creer une table crm_entreprises : tout le code
-- s'appuie deja sur `clients`) et ajoute `contacts`. Tout reste reserve au
-- staff : un client ne voit ni sa fiche interne ni ses notes.
-- L'index unique sur le SIRET n'est pas ici : il vient avec 0031, une fois
-- le doublon ANATOLCONSEIL / ANATOL FORMATION traite.

alter table clients
  add column nom_commercial text,
  add column forme_juridique text,
  add column code_naf text,
  add column secteur text,
  add column adresse text,
  add column code_postal text,
  add column ville text,
  add column telephone text,
  add column email_general text,
  add column site_web text,
  add column effectif text,
  add column opco text,
  add column source text,
  add column statut text not null default 'client' check (statut in ('prospect', 'client', 'archive')),
  add column responsable_id uuid references profils(user_id) on delete set null,
  add column notes text,
  add column updated_at timestamptz default now();

create trigger trg_clients_touch
  before update on clients
  for each row execute function fn_touch();

create table contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients on delete cascade,
  prenom text,
  nom text not null,
  fonction text,
  email text,
  telephone text,
  roles text[] not null default '{}',
  principal boolean not null default false,
  actif boolean not null default true,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index contacts_email_unique on contacts (client_id, lower(email)) where email is not null;
create unique index contacts_un_principal on contacts (client_id) where principal;
create index idx_contacts_client on contacts (client_id);

create trigger trg_contacts_touch
  before update on contacts
  for each row execute function fn_touch();

alter table contacts enable row level security;

create policy contacts_staff on contacts for all to authenticated
  using (est_staff()) with check (est_staff());

-- Liste des clients avec leurs compteurs. security_invoker : la vue applique
-- les politiques RLS de l'utilisateur appelant (staff uniquement).
create view v_clients with (security_invoker = true) as
select
  c.*,
  (select count(*) from demandes d where d.client_id = c.id and not d.archivee) as nb_demandes,
  (select count(*) from demandes d where d.client_id = c.id and not d.archivee
     and d.statut not in ('gagnee', 'perdue', 'reorientee', 'abandonnee')) as nb_actives,
  (select count(*) from demandes d where d.client_id = c.id and d.statut = 'gagnee') as nb_gagnees,
  greatest(c.updated_at, (select max(d.updated_at) from demandes d where d.client_id = c.id)) as derniere_activite,
  (select nullif(trim(concat_ws(' ', k.prenom, k.nom)), '') from contacts k
     where k.client_id = c.id and k.principal limit 1) as contact_principal
from clients c;

revoke all on v_clients from anon;
