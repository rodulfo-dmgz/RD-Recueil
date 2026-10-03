-- CRM, lot F etape 2 : consentements des contacts (docs/changes.md).
--
-- Une ligne par contact et par type : l'etat courant du consentement (accorde,
-- refuse ou retire) avec sa date, sa source, sa preuve et son expiration. Les
-- changements successifs se lisent dans le journal d'audit.
-- Acces : le personnel qui voit le client du contact (peut_voir_client) ; un
-- client n'y a aucun acces.

create table consentements (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts on delete cascade,
  type text not null check (type in ('email_commercial', 'telephone', 'lettre_information')),
  statut text not null check (statut in ('accorde', 'refuse', 'retire')),
  date_consentement date not null default current_date,
  source text,
  preuve text,
  date_expiration date,
  date_retrait date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contact_id, type),
  check (date_expiration is null or date_expiration >= date_consentement)
);

alter table consentements enable row level security;

create policy consentements_staff on consentements for all to authenticated
  using (exists (select 1 from contacts k where k.id = contact_id and peut_voir_client(k.client_id)))
  with check (exists (select 1 from contacts k where k.id = contact_id and peut_voir_client(k.client_id)));

-- Un consentement retire porte sa date de retrait (aujourd'hui par defaut) ; un
-- consentement redonne l'efface.
create or replace function fn_consentement_maj()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.statut = 'retire' then
    new.date_retrait := coalesce(new.date_retrait, current_date);
  else
    new.date_retrait := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_consentements_maj
  before insert or update on consentements
  for each row execute function fn_consentement_maj();

-- Journal d'audit : meme fonction que 0046, qui apprend aussi cette table (la
-- fiche client se retrouve par le contact).
create or replace function fn_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ancien jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_nouveau jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_ligne jsonb := coalesce(to_jsonb(new), to_jsonb(old));
  v_changes jsonb := '{}'::jsonb;
  v_cle text;
  v_avant jsonb;
  v_apres jsonb;
  v_demande uuid;
  v_client uuid;
  v_libelle text;
  v_auteur text;
begin
  for v_cle in select jsonb_object_keys(v_ligne) loop
    continue when v_cle in ('created_at', 'updated_at');
    v_avant := coalesce(v_ancien -> v_cle, 'null'::jsonb);
    v_apres := coalesce(v_nouveau -> v_cle, 'null'::jsonb);
    if v_avant <> v_apres then
      v_changes := v_changes || jsonb_build_object(v_cle, jsonb_build_array(v_avant, v_apres));
    end if;
  end loop;

  if tg_op = 'UPDATE' and v_changes = '{}'::jsonb then
    return null;
  end if;

  v_demande := case tg_table_name when 'demandes' then (v_ligne ->> 'id')::uuid else (v_ligne ->> 'demande_id')::uuid end;
  v_client := case tg_table_name
    when 'clients' then (v_ligne ->> 'id')::uuid
    when 'financements' then (select d.client_id from demandes d where d.id = v_demande)
    when 'factures' then (select d.client_id from demandes d where d.id = v_demande)
    when 'demande_enjeux' then (select d.client_id from demandes d where d.id = v_demande)
    when 'consentements' then (select k.client_id from contacts k where k.id = (v_ligne ->> 'contact_id')::uuid)
    else (v_ligne ->> 'client_id')::uuid
  end;
  v_libelle := case tg_table_name
    when 'clients' then v_ligne ->> 'raison_sociale'
    when 'contacts' then nullif(btrim(concat_ws(' ', v_ligne ->> 'prenom', v_ligne ->> 'nom')), '')
    when 'demandes' then v_ligne ->> 'reference'
    when 'taches' then v_ligne ->> 'titre'
    when 'activites' then v_ligne ->> 'objet'
    when 'financements' then nullif(btrim(concat_ws(' ', v_ligne ->> 'type', v_ligne ->> 'organisme')), '')
    when 'factures' then coalesce('n° ' || nullif(v_ligne ->> 'numero', ''), v_ligne ->> 'libelle')
    when 'consentements' then concat_ws(' : ', (select nullif(btrim(concat_ws(' ', k.prenom, k.nom)), '') from contacts k where k.id = (v_ligne ->> 'contact_id')::uuid), v_ligne ->> 'type')
    else null
  end;

  if auth.uid() is null then
    v_auteur := 'Système';
  else
    select coalesce(nullif(btrim(p.nom), ''), p.email) into v_auteur from profils p where p.user_id = auth.uid();
    v_auteur := coalesce(v_auteur, 'Compte inconnu');
  end if;

  insert into audit_log (user_id, auteur, action, table_name, record_id, client_id, demande_id, libelle, changes)
  values (
    auth.uid(),
    v_auteur,
    lower(tg_op),
    tg_table_name,
    coalesce((v_ligne ->> 'id')::uuid, (v_ligne ->> 'demande_id')::uuid),
    v_client,
    v_demande,
    v_libelle,
    v_changes
  );
  return null;
end;
$$;

revoke all on function fn_audit() from public, anon, authenticated;

create trigger trg_audit_consentements after insert or update or delete on consentements for each row execute function fn_audit();
