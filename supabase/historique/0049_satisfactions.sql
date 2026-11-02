-- CRM, lot F etape 4 : avis de satisfaction (docs/changes.md).
--
-- Le consultant demande un avis sur une demande (a chaud ou a froid) ; le client
-- invite sur la demande y repond depuis son espace (note de 1 a 5 et commentaire)
-- par rpc_repondre_satisfaction ; le personnel peut aussi saisir un avis recu
-- autrement. Qualiopi, indicateur 30. Un seul avis par demande et par moment.
-- Acces : le personnel qui voit le client (peut_voir_client) en lecture et
-- ecriture ; un client invite lit ses propres avis, sans pouvoir les modifier.

create table satisfactions (
  id uuid primary key default gen_random_uuid(),
  demande_id uuid not null references demandes on delete restrict,
  client_id uuid not null references clients on delete restrict,
  moment text not null check (moment in ('chaud', 'froid')),
  statut text not null default 'demandee' check (statut in ('demandee', 'recue', 'sans_reponse')),
  note smallint check (note between 1 and 5),
  commentaire text,
  date_envoi date not null default current_date,
  date_reponse date,
  origine text check (origine in ('client', 'staff')),
  demande_par uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (demande_id, moment),
  check (statut <> 'recue' or (note is not null and date_reponse is not null))
);

create index idx_satisfactions_client on satisfactions (client_id);
create index idx_satisfactions_statut on satisfactions (statut);

alter table satisfactions enable row level security;

create policy satisfactions_staff on satisfactions for all to authenticated
  using (peut_voir_client(client_id))
  with check (peut_voir_client(client_id));

create policy satisfactions_client on satisfactions for select to authenticated
  using (acces_demande(demande_id));

-- Le client vient de la demande ; la reponse prend la date du jour et son origine
-- (client ou personnel) ; un avis qui n'est plus "recu" perd sa note.
create or replace function fn_satisfaction_maj()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    select d.client_id into new.client_id from demandes d where d.id = new.demande_id;
    if new.client_id is null then
      raise exception 'Cette demande n''est rattachee a aucun client';
    end if;
  elsif new.demande_id <> old.demande_id or new.moment <> old.moment then
    raise exception 'La demande et le moment d''un avis ne se modifient pas';
  end if;
  if new.statut = 'recue' then
    new.date_reponse := coalesce(new.date_reponse, current_date);
    new.origine := coalesce(new.origine, case when est_staff() then 'staff' else 'client' end);
  else
    new.note := null;
    new.date_reponse := null;
    new.origine := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_satisfactions_maj
  before insert or update on satisfactions
  for each row execute function fn_satisfaction_maj();

-- Demande d'avis : une notification pour chaque compte client invite sur la demande.
create or replace function fn_notifier_satisfaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reference text;
begin
  if new.statut <> 'demandee' then
    return null;
  end if;
  select d.reference into v_reference from demandes d where d.id = new.demande_id;
  insert into notifications (destinataire, demande_id, reference, type, titre, lien)
  select distinct da.user_id, new.demande_id, v_reference, 'satisfaction', 'Votre avis nous intéresse', '#/accueil'
  from demande_acces da
  join profils p on p.user_id = da.user_id
  where da.demande_id = new.demande_id and da.user_id is not null and p.role = 'client';
  return null;
end;
$$;

revoke all on function fn_notifier_satisfaction() from public, anon, authenticated;

create trigger trg_satisfactions_notifier
  after insert on satisfactions
  for each row execute function fn_notifier_satisfaction();

create trigger trg_audit_satisfactions after insert or update or delete on satisfactions for each row execute function fn_audit();

-- Reponse du client (ou du personnel) a un avis demande. Le consultant de la
-- demande est prevenu.
create or replace function rpc_repondre_satisfaction(p_id uuid, p_note integer, p_commentaire text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avis satisfactions%rowtype;
  v_reference text;
  v_consultant uuid;
begin
  select * into v_avis from satisfactions where id = p_id for update;
  if v_avis.id is null or not acces_demande(v_avis.demande_id) then
    raise exception 'Avis introuvable';
  end if;
  if v_avis.statut <> 'demandee' then
    raise exception 'Cet avis a deja recu une reponse';
  end if;
  if p_note is null or p_note not between 1 and 5 then
    raise exception 'La note est un entier de 1 a 5';
  end if;

  update satisfactions set
    statut = 'recue',
    note = p_note,
    commentaire = nullif(btrim(p_commentaire), ''),
    date_reponse = current_date,
    origine = case when est_staff() then 'staff' else 'client' end
  where id = p_id;

  select d.reference, d.consultant_id into v_reference, v_consultant from demandes d where d.id = v_avis.demande_id;
  if v_consultant is not null and v_consultant is distinct from auth.uid() then
    insert into notifications (destinataire, demande_id, reference, type, titre, lien)
    values (v_consultant, v_avis.demande_id, v_reference, 'satisfaction', 'Avis de satisfaction reçu', '#/demandes/' || v_reference);
  end if;
end;
$$;

revoke all on function rpc_repondre_satisfaction(uuid, integer, text) from public, anon, authenticated;
grant execute on function rpc_repondre_satisfaction(uuid, integer, text) to authenticated;
