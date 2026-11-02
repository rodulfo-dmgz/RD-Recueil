-- CRM, lot F etape 1 : journal d'audit (docs/changes.md).
--
-- Un declencheur note qui a cree, modifie ou supprime quoi sur les tables du
-- CRM, avec les colonnes changees (valeur avant et apres). Il ne note pas les
-- simples consultations, ni l'adresse IP (un declencheur de base ne les voit
-- pas). Le journal est en ajout seul : personne ne peut le modifier ni
-- l'effacer depuis l'application, et seul l'admin le lit. Il garde d'anciennes
-- valeurs, coordonnees comprises : une demande d'effacement doit aussi le
-- purger (voir les points ouverts).

create table audit_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid,                       -- compte a l'origine du changement (nul : SQL ou fonction de service)
  auteur text not null,               -- nom ou e-mail au moment du changement : reste lisible si le compte disparait
  action text not null check (action in ('insert', 'update', 'delete')),
  table_name text not null,
  record_id uuid,
  client_id uuid,                     -- contexte pour l'historique d'une fiche (sans cle etrangere : survit a une fusion ou une suppression)
  demande_id uuid,
  libelle text,                       -- nom lisible de la ligne : raison sociale, reference, titre...
  changes jsonb not null              -- { colonne: [avant, apres] }
);

create index idx_audit_log_date on audit_log (created_at desc);
create index idx_audit_log_client on audit_log (client_id, created_at desc);
create index idx_audit_log_table on audit_log (table_name, created_at desc);

alter table audit_log enable row level security;

create policy audit_log_lecture on audit_log for select to authenticated
  using (est_admin());

revoke all on audit_log from anon, authenticated;
grant select on audit_log to authenticated;

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

  -- Une mise a jour qui ne change que la date de modification n'est pas notee.
  if tg_op = 'UPDATE' and v_changes = '{}'::jsonb then
    return null;
  end if;

  v_demande := case tg_table_name when 'demandes' then (v_ligne ->> 'id')::uuid else (v_ligne ->> 'demande_id')::uuid end;
  v_client := case tg_table_name
    when 'clients' then (v_ligne ->> 'id')::uuid
    when 'financements' then (select d.client_id from demandes d where d.id = v_demande)
    when 'factures' then (select d.client_id from demandes d where d.id = v_demande)
    when 'demande_enjeux' then (select d.client_id from demandes d where d.id = v_demande)
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

create trigger trg_audit_clients after insert or update or delete on clients for each row execute function fn_audit();
create trigger trg_audit_contacts after insert or update or delete on contacts for each row execute function fn_audit();
create trigger trg_audit_demandes after insert or update or delete on demandes for each row execute function fn_audit();
create trigger trg_audit_taches after insert or update or delete on taches for each row execute function fn_audit();
create trigger trg_audit_activites after insert or update or delete on activites for each row execute function fn_audit();
create trigger trg_audit_financements after insert or update or delete on financements for each row execute function fn_audit();
create trigger trg_audit_factures after insert or update or delete on factures for each row execute function fn_audit();
create trigger trg_audit_demande_enjeux after insert or update or delete on demande_enjeux for each row execute function fn_audit();
