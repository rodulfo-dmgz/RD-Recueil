-- CRM, lot F etape 3 : reclamations (docs/changes.md).
--
-- Saisies par le personnel sur une fiche client (et, si besoin, une demande de
-- ce client). Qualiopi, indicateur 31 : traitement des reclamations.
-- Acces : le personnel qui voit le client (peut_voir_client) ; jamais un client.
-- Une fiche client qui porte des reclamations ne peut pas etre supprimee
-- (trace qualite) : la fusion les deplace sur la fiche gardee.

create table reclamations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients on delete restrict,
  demande_id uuid references demandes on delete set null,
  date_reception date not null default current_date,
  objet text not null check (btrim(objet) <> ''),
  description text,
  gravite text not null default 'mineure' check (gravite in ('mineure', 'majeure', 'critique')),
  statut text not null default 'ouverte' check (statut in ('ouverte', 'en_cours', 'cloturee')),
  responsable_id uuid references auth.users on delete set null,
  action_corrective text,
  date_cloture date,
  created_by uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Une reclamation ne se cloture qu'avec son action corrective.
  check (statut <> 'cloturee' or (nullif(btrim(action_corrective), '') is not null and date_cloture is not null)),
  check (date_cloture is null or date_cloture >= date_reception)
);

create index idx_reclamations_client on reclamations (client_id, date_reception desc);
create index idx_reclamations_statut on reclamations (statut);

alter table reclamations enable row level security;

create policy reclamations_staff on reclamations for all to authenticated
  using (peut_voir_client(client_id))
  with check (peut_voir_client(client_id));

-- Date de cloture automatique (aujourd'hui) a la cloture, effacee a la reouverture ;
-- la demande doit appartenir au client ; sans responsable, le createur le devient.
create or replace function fn_reclamation_maj()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.statut = 'cloturee' then
    new.date_cloture := coalesce(new.date_cloture, current_date);
  else
    new.date_cloture := null;
  end if;
  if new.demande_id is not null
     and not exists (select 1 from demandes d where d.id = new.demande_id and d.client_id = new.client_id) then
    raise exception 'La demande n''appartient pas a ce client';
  end if;
  if tg_op = 'INSERT' and new.responsable_id is null then
    new.responsable_id := auth.uid();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_reclamations_maj
  before insert or update on reclamations
  for each row execute function fn_reclamation_maj();

-- Journal d'audit : meme fonction que 0047, qui apprend aussi les reclamations
-- et les avis de satisfaction (etape suivante).
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
    when 'reclamations' then v_ligne ->> 'objet'
    when 'satisfactions' then v_ligne ->> 'moment'
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

create trigger trg_audit_reclamations after insert or update or delete on reclamations for each row execute function fn_audit();

-- Fusion de clients (0045) : deplace aussi les reclamations (et, plus tard, les
-- avis de satisfaction : les tables absentes sont ignorees).
create or replace function rpc_fusionner_clients(p_garder uuid, p_absorber uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_garde clients%rowtype;
  v_absorbe clients%rowtype;
  v_demandes int;
  v_activites int;
  v_taches int;
  v_qualite int := 0;
  v_n int;
  v_table text;
  v_contacts_deplaces int := 0;
  v_contacts_fusionnes int := 0;
  v_dup record;
  v_garde_contact contacts%rowtype;
  v_notes text;
begin
  if not est_admin() then
    raise exception 'Reserve a l''administrateur';
  end if;
  if p_garder is null or p_absorber is null or p_garder = p_absorber then
    raise exception 'Choisissez deux clients differents';
  end if;

  perform 1 from clients where id in (p_garder, p_absorber) order by id for update;
  select * into v_garde from clients where id = p_garder;
  select * into v_absorbe from clients where id = p_absorber;
  if v_garde.id is null or v_absorbe.id is null then
    raise exception 'Client introuvable';
  end if;

  for v_dup in
    select k.* from contacts k where k.client_id = p_absorber order by k.created_at
  loop
    select * into v_garde_contact from contacts g
      where g.client_id = p_garder and v_dup.email is not null and lower(g.email) = lower(v_dup.email);
    if v_garde_contact.id is not null then
      update activites set contact_id = v_garde_contact.id where contact_id = v_dup.id;
      update taches set contact_id = v_garde_contact.id where contact_id = v_dup.id;
      update contacts set
        prenom = coalesce(nullif(trim(prenom), ''), v_dup.prenom),
        fonction = coalesce(nullif(trim(fonction), ''), v_dup.fonction),
        telephone = coalesce(nullif(trim(telephone), ''), v_dup.telephone),
        notes = case
          when nullif(trim(v_dup.notes), '') is null then notes
          when nullif(trim(notes), '') is null then v_dup.notes
          else notes || E'\n\n' || v_dup.notes
        end
      where id = v_garde_contact.id;
      delete from contacts where id = v_dup.id;
      v_contacts_fusionnes := v_contacts_fusionnes + 1;
    else
      update contacts set
        client_id = p_garder,
        principal = principal and not exists (select 1 from contacts g where g.client_id = p_garder and g.principal)
      where id = v_dup.id;
      v_contacts_deplaces := v_contacts_deplaces + 1;
    end if;
    v_garde_contact := null;
  end loop;

  update demandes set client_id = p_garder where client_id = p_absorber;
  get diagnostics v_demandes = row_count;
  update activites set client_id = p_garder where client_id = p_absorber;
  get diagnostics v_activites = row_count;
  update taches set client_id = p_garder where client_id = p_absorber;
  get diagnostics v_taches = row_count;

  foreach v_table in array array['reclamations', 'satisfactions'] loop
    if to_regclass('public.' || v_table) is not null then
      execute format('update %I set client_id = $1 where client_id = $2', v_table) using p_garder, p_absorber;
      get diagnostics v_n = row_count;
      v_qualite := v_qualite + v_n;
    end if;
  end loop;

  delete from clients where id = p_absorber;

  v_notes := case
    when nullif(trim(v_absorbe.notes), '') is null then v_garde.notes
    when nullif(trim(v_garde.notes), '') is null then v_absorbe.notes
    else v_garde.notes || E'\n\n--- Notes de ' || v_absorbe.raison_sociale || ' (fusion du ' || to_char(now(), 'DD/MM/YYYY') || E') ---\n' || v_absorbe.notes
  end;

  update clients set
    siret = coalesce(nullif(trim(siret), ''), v_absorbe.siret),
    nom_commercial = coalesce(nullif(trim(nom_commercial), ''), v_absorbe.nom_commercial),
    forme_juridique = coalesce(nullif(trim(forme_juridique), ''), v_absorbe.forme_juridique),
    code_naf = coalesce(nullif(trim(code_naf), ''), v_absorbe.code_naf),
    secteur = coalesce(nullif(trim(secteur), ''), v_absorbe.secteur),
    adresse = coalesce(nullif(trim(adresse), ''), v_absorbe.adresse),
    code_postal = coalesce(nullif(trim(code_postal), ''), v_absorbe.code_postal),
    ville = coalesce(nullif(trim(ville), ''), v_absorbe.ville),
    telephone = coalesce(nullif(trim(telephone), ''), v_absorbe.telephone),
    email_general = coalesce(nullif(trim(email_general), ''), v_absorbe.email_general),
    site_web = coalesce(nullif(trim(site_web), ''), v_absorbe.site_web),
    effectif = coalesce(nullif(trim(effectif), ''), v_absorbe.effectif),
    opco = coalesce(nullif(trim(opco), ''), v_absorbe.opco),
    source = coalesce(nullif(trim(source), ''), v_absorbe.source),
    statut = case when statut = 'prospect' and v_absorbe.statut = 'client' then 'client' else statut end,
    responsable_id = coalesce(responsable_id, v_absorbe.responsable_id),
    notes = v_notes
  where id = p_garder;

  insert into activites (client_id, type, objet, description)
  values (
    p_garder,
    'note',
    'Fusion avec ' || v_absorbe.raison_sociale,
    'La fiche "' || v_absorbe.raison_sociale || '" (SIRET ' || coalesce(nullif(trim(v_absorbe.siret), ''), 'non renseigne') || ', identifiant ' || v_absorbe.id
      || ') a ete fusionnee dans celle-ci : ' || v_demandes || ' demande(s), ' || v_contacts_deplaces || ' contact(s) deplace(s), '
      || v_contacts_fusionnes || ' contact(s) fusionne(s), ' || v_activites || ' echange(s), ' || v_taches || ' tache(s), '
      || v_qualite || ' reclamation(s) ou avis.'
  );

  return jsonb_build_object(
    'demandes', v_demandes,
    'contacts_deplaces', v_contacts_deplaces,
    'contacts_fusionnes', v_contacts_fusionnes,
    'activites', v_activites,
    'taches', v_taches,
    'reclamations_et_avis', v_qualite
  );
end;
$$;

revoke all on function rpc_fusionner_clients(uuid, uuid) from public, anon, authenticated;
grant execute on function rpc_fusionner_clients(uuid, uuid) to authenticated;
