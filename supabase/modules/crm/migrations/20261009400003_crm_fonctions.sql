-- =====================================================================
-- MODULE crm_ 3 : fonctions
-- Genere depuis supabase/migrations/20261007000000_crm_install.sql par le script de transformation, puis relu.
-- Cles etrangeres : seulement vers app_ et crm_. Aucune reference a un autre module.
-- =====================================================================

set check_function_bodies = off; -- les fonctions SQL s'appellent entre elles dans le désordre

CREATE OR REPLACE FUNCTION public.crm_peut_voir_client(p_client_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.crm_clients c
    where c.id = p_client_id and (
      public.crm_est_admin(c.organisation_id)
      or (public.crm_est_staff(c.organisation_id) and (
        c.responsable_id = public.app_personne_id()
        or exists (select 1 from public.crm_demandes d where d.client_id = c.id and d.consultant_id = public.app_personne_id())
      ))
    )
  );
$function$;

CREATE OR REPLACE FUNCTION public.crm_peut_voir_demande(p_demande_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.crm_demandes d
    where d.id = p_demande_id and (
      public.crm_est_admin(d.organisation_id)
      or (d.consultant_id = public.app_personne_id() and public.crm_est_staff(d.organisation_id))
    )
  );
$function$;

CREATE OR REPLACE FUNCTION public.crm_peut_voir_tache(p_tache uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.crm_taches t
    where t.id = p_tache and (
      public.crm_est_admin(t.organisation_id)
      or (public.crm_est_staff(t.organisation_id) and (t.assignee_id = public.app_personne_id() or public.crm_est_membre_tache(t.id)))
    )
  );
$function$;

-- Accès d'un client à une demande : invité (par identifiant de personne ou par e-mail) ET détenteur du droit crm_client.
-- Un membre de l'organisation qui n'est pas invité sur la demande n'y accède pas.
CREATE OR REPLACE FUNCTION public.crm_a_acces(p_demande_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.crm_demande_acces da
    join public.crm_demandes d on d.id = da.demande_id
    where da.demande_id = p_demande_id
      and (da.user_id = public.app_personne_id() or public.crm_est_mon_email(da.email))
      and public.app_has_role(d.organisation_id, array['crm_client'])
  );
$function$;

-- Signer (devis, note de cadrage) : invité avec le droit « editeur » ET détenteur du droit crm_client. Un invité en lecture seule ne signe pas.
CREATE OR REPLACE FUNCTION public.crm_peut_signer(p_demande_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.crm_demande_acces da
    join public.crm_demandes d on d.id = da.demande_id
    where da.demande_id = p_demande_id
      and (da.user_id = public.app_personne_id() or public.crm_est_mon_email(da.email))
      and da.droit = 'editeur'
      and public.app_has_role(d.organisation_id, array['crm_client'])
  );
$function$;

CREATE OR REPLACE FUNCTION public.crm_client_peut_ecrire_reponse(p_demande_id uuid, p_question_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.crm_demande_acces da
    join public.crm_demandes d on d.id = da.demande_id
    join public.crm_questions q on q.questionnaire_id = d.questionnaire_id and q.id = p_question_id
    where da.demande_id = p_demande_id
      and (da.user_id = public.app_personne_id() or public.crm_est_mon_email(da.email))
      and da.droit = 'editeur'
      and q.rempli_par in ('C', 'C/F')
      and d.statut in ('envoyee', 'en_saisie')
      and public.app_has_role(d.organisation_id, array['crm_client'])
  );
$function$;

CREATE OR REPLACE FUNCTION public.crm_acces_demande(p_demande_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select public.crm_peut_voir_demande(p_demande_id) or public.crm_a_acces(p_demande_id);
$function$;

CREATE OR REPLACE FUNCTION public.crm_est_membre_tache(p_tache uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from public.crm_tache_membres m where m.tache_id = p_tache and m.user_id = public.app_personne_id());
$function$;

CREATE OR REPLACE FUNCTION public.crm_fn_attribuer_client()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.responsable_id is null and public.app_personne_id() is not null and not public.crm_est_admin(new.organisation_id) then
    new.responsable_id := public.app_personne_id();
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_fn_attribuer_demande()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.consultant_id is null and public.app_personne_id() is not null and not public.crm_est_admin(new.organisation_id) then
    new.consultant_id := public.app_personne_id();
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_fn_audit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_table text := regexp_replace(tg_table_name, '^crm_', '');
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

  v_demande := case v_table when 'demandes' then (v_ligne ->> 'id')::uuid else (v_ligne ->> 'demande_id')::uuid end;
  v_client := case v_table
    when 'clients' then (v_ligne ->> 'id')::uuid
    when 'financements' then (select d.client_id from public.crm_demandes d where d.id = v_demande)
    when 'factures' then (select d.client_id from public.crm_demandes d where d.id = v_demande)
    when 'demande_enjeux' then (select d.client_id from public.crm_demandes d where d.id = v_demande)
    when 'consentements' then (select k.client_id from public.crm_contacts k where k.id = (v_ligne ->> 'contact_id')::uuid)
    else (v_ligne ->> 'client_id')::uuid
  end;
  v_libelle := case v_table
    when 'clients' then v_ligne ->> 'raison_sociale'
    when 'contacts' then nullif(btrim(concat_ws(' ', v_ligne ->> 'prenom', v_ligne ->> 'nom')), '')
    when 'demandes' then v_ligne ->> 'reference'
    when 'taches' then v_ligne ->> 'titre'
    when 'activites' then v_ligne ->> 'objet'
    when 'financements' then nullif(btrim(concat_ws(' ', v_ligne ->> 'type', v_ligne ->> 'organisme')), '')
    when 'factures' then coalesce('n° ' || nullif(v_ligne ->> 'numero', ''), v_ligne ->> 'libelle')
    when 'consentements' then concat_ws(' : ', (select nullif(btrim(concat_ws(' ', k.prenom, k.nom)), '') from public.crm_contacts k where k.id = (v_ligne ->> 'contact_id')::uuid), v_ligne ->> 'type')
    when 'reclamations' then v_ligne ->> 'objet'
    when 'satisfactions' then v_ligne ->> 'moment'
    else null
  end;

  if public.app_personne_id() is null then
    v_auteur := 'Système';
  else
    select coalesce(nullif(btrim(concat_ws(' ', p.prenom, p.nom)), ''), p.email) into v_auteur from public.app_personnes p where p.id = public.app_personne_id();
    v_auteur := coalesce(v_auteur, 'Compte inconnu');
  end if;

  insert into public.crm_audit_log (organisation_id, user_id, auteur, action, table_name, record_id, client_id, demande_id, libelle, changes)
  values (
    (v_ligne ->> 'organisation_id')::uuid,
    public.app_personne_id(),
    v_auteur,
    lower(tg_op),
    v_table,
    coalesce((v_ligne ->> 'id')::uuid, (v_ligne ->> 'demande_id')::uuid),
    v_client,
    v_demande,
    v_libelle,
    v_changes
  );
  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_fn_consentement_maj()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.statut = 'retire' then
    new.date_retrait := coalesce(new.date_retrait, current_date);
  else
    new.date_retrait := null;
  end if;
  new.updated_at := now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_fn_historiser_reponse()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if old.valeur is distinct from new.valeur then
    insert into public.crm_reponses_historique (demande_id, question_id, ancienne_valeur, nouvelle_valeur, auteur)
    values (old.demande_id, old.question_id, old.valeur, new.valeur, new.saisi_par);
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_fn_notifier_evenement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_titre text;
  v_vers_staff boolean;
  v_reference text;
begin
  if new.type <> 'statut' then
    return new;
  end if;

  v_titre := case new.vers
    when 'soumise' then 'Nouvelles réponses soumises'
    when 'cadrage_envoye' then 'Note de cadrage envoyée'
    when 'cadrage_a_revoir' then 'Modification demandée sur la note de cadrage'
    when 'cadrage_valide' then 'Note de cadrage validée'
    when 'proposition_envoyee' then 'Proposition commerciale envoyée'
    when 'gagnee' then 'Proposition acceptée'
    when 'perdue' then 'Proposition refusée'
    when 'entretien_planifie' then 'Entretien planifié'
    else null
  end;

  if v_titre is null then
    return new;
  end if;

  select reference into v_reference from public.crm_demandes where id = new.demande_id;
  v_vers_staff := new.vers in ('soumise', 'cadrage_a_revoir', 'cadrage_valide', 'gagnee', 'perdue', 'entretien_planifie');

  if v_vers_staff then
    insert into public.crm_notifications (organisation_id, destinataire, demande_id, reference, type, titre)
    select new.organisation_id, s.personne_id, new.demande_id, v_reference, new.vers, v_titre
    from public.crm_destinataires_staff(new.organisation_id, (select d.consultant_id from public.crm_demandes d where d.id = new.demande_id)) s(personne_id);
  else
    insert into public.crm_notifications (organisation_id, destinataire, demande_id, reference, type, titre)
    select distinct new.organisation_id, p.id, new.demande_id, v_reference, new.vers, v_titre
    from public.crm_demande_acces da
    join public.app_personnes p on p.id = da.user_id or p.email = lower(da.email)
    join public.app_droits dr on dr.personne_id = p.id and dr.organisation_id = new.organisation_id and dr.role_code = 'crm_client'
    where da.demande_id = new.demande_id;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_fn_notifier_membre_tache()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_titre text;
  v_org uuid;
begin
  if new.user_id is not distinct from public.app_personne_id() then
    return new;
  end if;

  select titre, organisation_id into v_titre, v_org from public.crm_taches where id = new.tache_id;
  insert into public.crm_notifications (organisation_id, destinataire, reference, type, titre, lien)
  values (v_org, new.user_id, 'Tâche', 'tache', 'Vous êtes ajouté à la tâche : ' || coalesce(v_titre, ''), '/taches');
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_fn_notifier_satisfaction()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_reference text;
begin
  if new.statut <> 'demandee' then
    return null;
  end if;
  select d.reference into v_reference from public.crm_demandes d where d.id = new.demande_id;
  insert into public.crm_notifications (organisation_id, destinataire, demande_id, reference, type, titre, lien)
  select distinct new.organisation_id, p.id, new.demande_id, v_reference, 'satisfaction', 'Votre avis nous intéresse', '#/accueil'
  from public.crm_demande_acces da
  join public.app_personnes p on p.id = da.user_id or p.email = lower(da.email)
  join public.app_droits dr on dr.personne_id = p.id and dr.organisation_id = new.organisation_id and dr.role_code = 'crm_client'
  where da.demande_id = new.demande_id;
  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_fn_notifier_tache()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_client text;
begin
  if new.assignee_id is null or new.assignee_id is not distinct from public.app_personne_id() then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.assignee_id is not distinct from old.assignee_id then
    return new;
  end if;

  select raison_sociale into v_client from public.crm_clients where id = new.client_id;
  insert into public.crm_notifications (organisation_id, destinataire, demande_id, reference, type, titre, lien)
  values (new.organisation_id, new.assignee_id, new.demande_id, coalesce(v_client, 'Client'), 'tache', 'Nouvelle tâche : ' || new.titre, '/clients/' || new.client_id || '/activite');
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_fn_premiere_saisie()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_client boolean;
  v_statut text;
begin
  select exists (select 1 from public.app_droits d where d.organisation_id = new.organisation_id and d.personne_id = new.saisi_par and d.role_code = 'crm_client') into v_client;
  select statut into v_statut from public.crm_demandes where id = new.demande_id;

  if v_client and v_statut = 'envoyee' then
    update public.crm_demandes set statut = 'en_saisie', updated_at = now() where id = new.demande_id;
    insert into public.crm_evenements (demande_id, type, de, vers, auteur, commentaire)
    values (new.demande_id, 'statut', 'envoyee', 'en_saisie', new.saisi_par, 'Première réponse du client');
    perform app_private.emettre_evenement(new.organisation_id, 'crm.demande.statut_change', jsonb_build_object('demande_id', new.demande_id, 'de', 'envoyee', 'vers', 'en_saisie'));
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_fn_proteger_assignation_client()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.responsable_id is distinct from old.responsable_id and public.app_personne_id() is not null and not public.crm_est_admin(new.organisation_id) then
    raise exception 'Seul l''administrateur peut changer le responsable d''un client.';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_fn_proteger_assignation_demande()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.consultant_id is distinct from old.consultant_id and public.app_personne_id() is not null and not public.crm_est_admin(new.organisation_id) then
    raise exception 'Seul l''administrateur peut changer le consultant d''une demande.';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_fn_reclamation_maj()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.statut = 'cloturee' then
    new.date_cloture := coalesce(new.date_cloture, current_date);
  else
    new.date_cloture := null;
  end if;
  if new.demande_id is not null
     and not exists (select 1 from public.crm_demandes d where d.id = new.demande_id and d.client_id = new.client_id) then
    raise exception 'La demande n''appartient pas a ce client';
  end if;
  if tg_op = 'INSERT' and new.responsable_id is null and public.crm_est_staff(new.organisation_id) then
    new.responsable_id := public.app_personne_id();
  end if;
  new.updated_at := now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_fn_reference()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.reference is null then
    new.reference := 'RDF-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.crm_demande_seq')::text, 4, '0');
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_fn_satisfaction_maj()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'INSERT' then
    select d.client_id into new.client_id from public.crm_demandes d where d.id = new.demande_id;
    if new.client_id is null then
      raise exception 'Cette demande n''est rattachee a aucun client';
    end if;
  elsif new.demande_id <> old.demande_id or new.moment <> old.moment then
    raise exception 'La demande et le moment d''un avis ne se modifient pas';
  end if;
  if new.statut = 'recue' then
    new.date_reponse := coalesce(new.date_reponse, current_date);
    new.origine := coalesce(new.origine, case when public.crm_est_staff(new.organisation_id) then 'staff' else 'client' end);
  else
    new.note := null;
    new.date_reponse := null;
    new.origine := null;
  end if;
  new.updated_at := now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_fn_tache_maj()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at := now();
  if new.statut = 'terminee' and old.statut <> 'terminee' then
    new.terminee_le := now();
    new.terminee_par := public.app_personne_id();
  elsif new.statut <> 'terminee' then
    new.terminee_le := null;
    new.terminee_par := null;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_fn_touch()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_peut_voir_tache_chemin(p_nom text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case
    when (storage.foldername(p_nom))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.crm_peut_voir_tache(((storage.foldername(p_nom))[1])::uuid)
    else false
  end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_rpc_accepter_proposition(p_proposition_id uuid, p_signature_image text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_demande_id uuid;
  v_credential text;
  v_statut text;
begin
  if p_signature_image is null or length(trim(p_signature_image)) = 0 then
    raise exception 'La signature est obligatoire pour accepter la proposition';
  end if;
  if p_signature_image !~ '^data:image/png;base64,' or length(p_signature_image) > 1000000 then
    raise exception 'Signature invalide';
  end if;

  select demande_id, statut into v_demande_id, v_statut from public.crm_propositions where id = p_proposition_id;
  if v_demande_id is null or not public.crm_peut_signer(v_demande_id) then
    raise exception 'Proposition introuvable : %', p_proposition_id;
  end if;
  if v_statut <> 'envoyee' then
    raise exception 'Cette proposition n''est pas en attente de décision';
  end if;

  v_credential := public.crm_code_verification();

  perform set_config('app.signature_via_rpc', 'on', true);
  update public.crm_propositions
  set statut = 'acceptee',
      decidee_le = now(),
      decidee_par = public.app_personne_id(),
      signature_image = p_signature_image,
      signature_credential = v_credential
  where id = p_proposition_id;

  perform set_config('app.signature_via_rpc', 'off', true);
  perform app_private.emettre_evenement((select d.organisation_id from public.crm_demandes d where d.id = v_demande_id), 'crm.devis.signe', jsonb_build_object('proposition_id', p_proposition_id, 'demande_id', v_demande_id));
  perform set_config('app.transition_client_via_rpc', 'on', true);
  perform public.crm_rpc_changer_statut(v_demande_id, 'gagnee', 'Proposition acceptée par le client');
  perform set_config('app.transition_client_via_rpc', 'off', true);
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_rpc_archiver_demande(p_demande_id uuid, p_archiver boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.crm_peut_voir_demande(p_demande_id) then
    raise exception 'Demande introuvable : %', p_demande_id;
  end if;

  update public.crm_demandes
  set archivee = p_archiver, archivee_le = case when p_archiver then now() else null end
  where id = p_demande_id;

  insert into public.crm_evenements (demande_id, type, vers, auteur)
  values (p_demande_id, 'archive', case when p_archiver then 'archivee' else 'desarchivee' end, public.app_personne_id());
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_rpc_assigner_demande(p_demande_id uuid, p_consultant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_nom text;
  v_reference text;
  v_org uuid;
begin
  select organisation_id into v_org from public.crm_demandes where id = p_demande_id;
  if v_org is null or not public.crm_est_admin(v_org) then
    raise exception 'Réservé à l''administrateur.';
  end if;

  select coalesce(nullif(btrim(concat_ws(' ', p.prenom, p.nom)), ''), p.email) into v_nom
  from public.app_personnes p where p.id = p_consultant_id and public.crm_personne_est_staff(v_org, p_consultant_id);
  if v_nom is null then
    raise exception 'Consultant introuvable.';
  end if;

  update public.crm_demandes set consultant_id = p_consultant_id where id = p_demande_id returning reference into v_reference;
  if v_reference is null then
    raise exception 'Demande introuvable : %', p_demande_id;
  end if;

  insert into public.crm_evenements (demande_id, type, vers, auteur, commentaire)
  values (p_demande_id, 'assignation', 'assignee', public.app_personne_id(), v_nom);

  if p_consultant_id is distinct from public.app_personne_id() then
    insert into public.crm_notifications (organisation_id, destinataire, demande_id, reference, type, titre)
    values (v_org, p_consultant_id, p_demande_id, v_reference, 'assignation', 'Demande attribuée');
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_rpc_changer_statut(p_demande_id uuid, p_vers text, p_commentaire text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_statut_actuel text;
  v_org uuid;
  v_staff boolean;
  v_transitions_valides text[];
  v_via_fonction boolean := coalesce(current_setting('app.transition_client_via_rpc', true), '') = 'on';
begin
  if not public.crm_acces_demande(p_demande_id) then
    raise exception 'Demande introuvable : %', p_demande_id;
  end if;

  select statut, organisation_id into v_statut_actuel, v_org from public.crm_demandes where id = p_demande_id;
  if v_statut_actuel is null then
    raise exception 'Demande introuvable : %', p_demande_id;
  end if;

  v_staff := public.crm_est_staff(v_org);

  v_transitions_valides := case v_statut_actuel
    when 'brouillon'            then array['envoyee', 'abandonnee']
    when 'envoyee'               then array['en_saisie', 'abandonnee']
    when 'en_saisie'             then array['soumise', 'abandonnee']
    when 'soumise'               then array['entretien_planifie', 'en_saisie', 'abandonnee']
    when 'entretien_planifie'    then array['en_analyse', 'abandonnee']
    when 'en_analyse'            then array['cadrage_envoye', 'reorientee', 'abandonnee']
    when 'cadrage_envoye'        then array['cadrage_valide', 'cadrage_a_revoir', 'abandonnee']
    when 'cadrage_a_revoir'      then array['en_saisie', 'cadrage_envoye', 'abandonnee']
    when 'cadrage_valide'        then array['proposition_envoyee', 'abandonnee']
    when 'proposition_envoyee'   then array['gagnee', 'perdue', 'abandonnee']
    else array[]::text[]
  end;

  if not (p_vers = any(v_transitions_valides)) then
    raise exception 'Transition non autorisée : % -> %', v_statut_actuel, p_vers;
  end if;

  if not v_staff
     and not (p_vers = 'abandonnee'
              or (v_via_fonction and p_vers in ('soumise', 'cadrage_valide', 'cadrage_a_revoir', 'gagnee', 'perdue', 'entretien_planifie'))) then
    raise exception 'Rôle "client" non autorisé pour la transition vers "%"', p_vers;
  end if;

  update public.crm_demandes set statut = p_vers, updated_at = now() where id = p_demande_id;

  insert into public.crm_evenements (demande_id, type, de, vers, auteur, commentaire)
  values (p_demande_id, 'statut', v_statut_actuel, p_vers, public.app_personne_id(), p_commentaire);
  perform app_private.emettre_evenement(v_org, 'crm.demande.statut_change', jsonb_build_object('demande_id', p_demande_id, 'de', v_statut_actuel, 'vers', p_vers));
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_rpc_confirmer_reservation_calcom(p_demande_id uuid, p_debut timestamp with time zone, p_fin timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.crm_acces_demande(p_demande_id) then
    raise exception 'Demande introuvable : %', p_demande_id;
  end if;

  if exists (select 1 from public.crm_entretien_creneaux where demande_id = p_demande_id and choisi = true) then
    raise exception 'Un entretien est déjà confirmé pour cette demande';
  end if;

  insert into public.crm_entretien_creneaux (demande_id, debut, fin, choisi)
  values (p_demande_id, p_debut, p_fin, true);

  perform set_config('app.transition_client_via_rpc', 'on', true);
  perform public.crm_rpc_changer_statut(p_demande_id, 'entretien_planifie', 'Rendez-vous confirmé via Cal.com');
  perform set_config('app.transition_client_via_rpc', 'off', true);
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_rpc_demander_modification(p_note_id uuid, p_commentaire text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_demande_id uuid;
  v_statut text;
begin
  if length(coalesce(p_commentaire, '')) > 4000 then
    raise exception 'Commentaire trop long';
  end if;
  select demande_id, statut into v_demande_id, v_statut from public.crm_notes_cadrage where id = p_note_id;
  if v_demande_id is null or not public.crm_peut_signer(v_demande_id) then
    raise exception 'Note de cadrage introuvable : %', p_note_id;
  end if;
  if v_statut <> 'envoyee' then
    raise exception 'Cette note n''est pas en attente de validation';
  end if;

  perform set_config('app.signature_via_rpc', 'on', true);
  update public.crm_notes_cadrage set statut = 'a_revoir' where id = p_note_id;
  perform set_config('app.signature_via_rpc', 'off', true);

  perform set_config('app.transition_client_via_rpc', 'on', true);
  perform public.crm_rpc_changer_statut(v_demande_id, 'cadrage_a_revoir', p_commentaire);
  perform set_config('app.transition_client_via_rpc', 'off', true);
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_rpc_deposer_reclamation(p_demande_id uuid, p_objet text, p_description text DEFAULT NULL::text, p_date_reception date DEFAULT CURRENT_DATE, p_gravite text DEFAULT 'mineure'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_demande public.crm_demandes%rowtype;
  v_id uuid;
begin
  select * into v_demande from public.crm_demandes where id = p_demande_id;
  if v_demande.id is null or not public.crm_acces_demande(p_demande_id) then
    raise exception 'Demande introuvable';
  end if;
  if v_demande.client_id is null then
    raise exception 'Cette demande n''est rattachee a aucun client';
  end if;
  if nullif(btrim(p_objet), '') is null then
    raise exception 'Indiquez l''objet de votre reclamation';
  end if;
  if length(p_objet) > 200 or length(coalesce(p_description, '')) > 4000 then
    raise exception 'Texte trop long';
  end if;
  if p_gravite is null or p_gravite not in ('mineure', 'majeure', 'critique') then
    raise exception 'Importance inconnue';
  end if;
  if p_date_reception is null or p_date_reception > current_date or p_date_reception < current_date - 366 then
    raise exception 'La date du probleme doit etre comprise dans les douze derniers mois';
  end if;
  if (select count(*) from public.crm_reclamations r where r.created_by = public.app_personne_id() and r.created_at > now() - interval '1 day') >= 5 then
    raise exception 'Trop de reclamations deposees aujourd''hui : contactez-nous directement';
  end if;

  insert into public.crm_reclamations (client_id, demande_id, objet, description, origine, responsable_id, date_reception, gravite)
  values (
    v_demande.client_id,
    p_demande_id,
    btrim(p_objet),
    nullif(btrim(p_description), ''),
    case when public.crm_est_staff(v_demande.organisation_id) then 'equipe' else 'client' end,
    v_demande.consultant_id,
    p_date_reception,
    p_gravite
  )
  returning id into v_id;

  insert into public.crm_notifications (organisation_id, destinataire, demande_id, reference, type, titre, lien)
  select distinct v_demande.organisation_id, x.u, p_demande_id, v_demande.reference, 'reclamation', 'Nouvelle réclamation', '#/reclamations'
  from (
    select v_demande.consultant_id as u
    union
    select a from public.crm_ids_admins(v_demande.organisation_id) a
  ) x
  where x.u is not null and x.u is distinct from public.app_personne_id();

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_rpc_fusionner_clients(p_garder uuid, p_absorber uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_garde public.crm_clients%rowtype;
  v_absorbe public.crm_clients%rowtype;
  v_demandes int;
  v_activites int;
  v_taches int;
  v_qualite int := 0;
  v_n int;
  v_table text;
  v_contacts_deplaces int := 0;
  v_contacts_fusionnes int := 0;
  v_dup record;
  v_garde_contact public.crm_contacts%rowtype;
  v_notes text;
  v_org uuid;
begin
  select organisation_id into v_org from public.crm_clients where id = p_garder;
  if v_org is null or not public.crm_est_admin(v_org) then
    raise exception 'Reserve a l''administrateur';
  end if;
  if (select organisation_id from public.crm_clients where id = p_absorber) is distinct from v_org then
    raise exception 'Les deux clients doivent appartenir a la meme organisation';
  end if;
  if p_garder is null or p_absorber is null or p_garder = p_absorber then
    raise exception 'Choisissez deux clients differents';
  end if;

  perform 1 from public.crm_clients where id in (p_garder, p_absorber) order by id for update;
  select * into v_garde from public.crm_clients where id = p_garder;
  select * into v_absorbe from public.crm_clients where id = p_absorber;
  if v_garde.id is null or v_absorbe.id is null then
    raise exception 'Client introuvable';
  end if;

  for v_dup in
    select k.* from public.crm_contacts k where k.client_id = p_absorber order by k.created_at
  loop
    select * into v_garde_contact from public.crm_contacts g
      where g.client_id = p_garder and v_dup.email is not null and lower(g.email) = lower(v_dup.email);
    if v_garde_contact.id is not null then
      update public.crm_activites set contact_id = v_garde_contact.id where contact_id = v_dup.id;
      update public.crm_taches set contact_id = v_garde_contact.id where contact_id = v_dup.id;
      update public.crm_contacts set
        prenom = coalesce(nullif(trim(prenom), ''), v_dup.prenom),
        fonction = coalesce(nullif(trim(fonction), ''), v_dup.fonction),
        telephone = coalesce(nullif(trim(telephone), ''), v_dup.telephone),
        notes = case
          when nullif(trim(v_dup.notes), '') is null then notes
          when nullif(trim(notes), '') is null then v_dup.notes
          else notes || E'\n\n' || v_dup.notes
        end
      where id = v_garde_contact.id;
      delete from public.crm_contacts where id = v_dup.id;
      v_contacts_fusionnes := v_contacts_fusionnes + 1;
    else
      update public.crm_contacts set
        client_id = p_garder,
        principal = principal and not exists (select 1 from public.crm_contacts g where g.client_id = p_garder and g.principal)
      where id = v_dup.id;
      v_contacts_deplaces := v_contacts_deplaces + 1;
    end if;
    v_garde_contact := null;
  end loop;

  update public.crm_demandes set client_id = p_garder where client_id = p_absorber;
  get diagnostics v_demandes = row_count;
  update public.crm_activites set client_id = p_garder where client_id = p_absorber;
  get diagnostics v_activites = row_count;
  update public.crm_taches set client_id = p_garder where client_id = p_absorber;
  get diagnostics v_taches = row_count;

  foreach v_table in array array['crm_reclamations', 'crm_satisfactions'] loop
    if to_regclass('public.' || v_table) is not null then
      execute format('update public.%I set client_id = $1 where client_id = $2', v_table) using p_garder, p_absorber;
      get diagnostics v_n = row_count;
      v_qualite := v_qualite + v_n;
    end if;
  end loop;

  delete from public.crm_clients where id = p_absorber;

  v_notes := case
    when nullif(trim(v_absorbe.notes), '') is null then v_garde.notes
    when nullif(trim(v_garde.notes), '') is null then v_absorbe.notes
    else v_garde.notes || E'\n\n--- Notes de ' || v_absorbe.raison_sociale || ' (fusion du ' || to_char(now(), 'DD/MM/YYYY') || E') ---\n' || v_absorbe.notes
  end;

  update public.crm_clients set
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

  insert into public.crm_activites (client_id, type, objet, description)
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
$function$;

CREATE OR REPLACE FUNCTION public.crm_rpc_jalons()
 RETURNS TABLE(demande_id uuid, reference text, client text, type text, date timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with visibles as (
    select d.id, d.reference, c.raison_sociale as client, d.created_at, d.date_limite
    from public.crm_demandes d
    left join public.crm_clients c on c.id = d.client_id
    where d.archivee = false and public.crm_acces_demande(d.id)
  ),
  statuts_valides as (
    select e.demande_id, e.vers, e.created_at
    from public.crm_evenements e
    where e.type = 'statut' and e.vers is not null
      and not exists (
        select 1 from public.crm_evenements c
        where c.demande_id = e.demande_id
          and c.type = 'correction'
          and c.created_at > e.created_at
          and e.created_at > coalesce(
            (select max(p.created_at) from public.crm_evenements p
             where p.demande_id = e.demande_id and p.type = 'statut'
               and p.vers = c.vers and p.created_at < c.created_at),
            '-infinity'::timestamptz)
      )
  )
  select v.id, v.reference, v.client, 'creation'::text, v.created_at from visibles v
  union all
  select v.id, v.reference, v.client, 'echeance'::text, v.date_limite::timestamptz
  from visibles v where v.date_limite is not null
  union all
  select v.id, v.reference, v.client, s.vers, s.created_at
  from visibles v join statuts_valides s on s.demande_id = v.id
  union all
  select v.id, v.reference, v.client, 'entretien'::text, k.debut
  from visibles v join public.crm_entretien_creneaux k on k.demande_id = v.id and k.choisi
$function$;

CREATE OR REPLACE FUNCTION public.crm_rpc_mes_reclamations()
 RETURNS TABLE(id uuid, demande_id uuid, reference text, date_reception date, objet text, description text, gravite text, etat text, interlocuteur text, date_cloture date, reponse text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    r.id,
    r.demande_id,
    d.reference,
    r.date_reception,
    r.objet,
    r.description,
    r.gravite,
    case r.statut when 'ouverte' then 'recue' when 'en_cours' then 'en_cours' else 'traitee' end,
    (select nullif(btrim(concat_ws(' ', p.prenom, p.nom)), '') from public.app_personnes p where p.id = r.responsable_id),
    r.date_cloture,
    case when r.statut = 'cloturee' then r.action_corrective end
  from public.crm_reclamations r
  join public.crm_demandes d on d.id = r.demande_id
  where r.origine = 'client' and public.crm_acces_demande(r.demande_id)
  order by r.created_at desc;
$function$;

CREATE OR REPLACE FUNCTION public.crm_rpc_refuser_proposition(p_proposition_id uuid, p_commentaire text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_demande_id uuid;
  v_statut text;
begin
  if length(coalesce(p_commentaire, '')) > 4000 then
    raise exception 'Commentaire trop long';
  end if;
  select demande_id, statut into v_demande_id, v_statut from public.crm_propositions where id = p_proposition_id;
  if v_demande_id is null or not public.crm_peut_signer(v_demande_id) then
    raise exception 'Proposition introuvable : %', p_proposition_id;
  end if;
  if v_statut <> 'envoyee' then
    raise exception 'Cette proposition n''est pas en attente de décision';
  end if;

  perform set_config('app.signature_via_rpc', 'on', true);
  update public.crm_propositions
  set statut = 'refusee', decidee_le = now(), decidee_par = public.app_personne_id(), commentaire_client = p_commentaire
  where id = p_proposition_id;

  perform set_config('app.signature_via_rpc', 'off', true);
  perform app_private.emettre_evenement((select d.organisation_id from public.crm_demandes d where d.id = v_demande_id), 'crm.devis.refuse', jsonb_build_object('proposition_id', p_proposition_id, 'demande_id', v_demande_id));
  perform set_config('app.transition_client_via_rpc', 'on', true);
  perform public.crm_rpc_changer_statut(v_demande_id, 'perdue', p_commentaire);
  perform set_config('app.transition_client_via_rpc', 'off', true);
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_rpc_repondre_satisfaction(p_id uuid, p_note integer, p_commentaire text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_avis public.crm_satisfactions%rowtype;
  v_reference text;
  v_consultant uuid;
begin
  select * into v_avis from public.crm_satisfactions where id = p_id for update;
  if v_avis.id is null or not public.crm_acces_demande(v_avis.demande_id) then
    raise exception 'Avis introuvable';
  end if;
  if v_avis.statut <> 'demandee' then
    raise exception 'Cet avis a deja recu une reponse';
  end if;
  if p_note is null or p_note not between 1 and 5 then
    raise exception 'La note est un entier de 1 a 5';
  end if;

  update public.crm_satisfactions set
    statut = 'recue',
    note = p_note,
    commentaire = nullif(btrim(p_commentaire), ''),
    date_reponse = current_date,
    origine = case when public.crm_est_staff(v_avis.organisation_id) then 'staff' else 'client' end
  where id = p_id;

  select d.reference, d.consultant_id into v_reference, v_consultant from public.crm_demandes d where d.id = v_avis.demande_id;
  if v_consultant is not null and v_consultant is distinct from public.app_personne_id() then
    insert into public.crm_notifications (destinataire, demande_id, reference, type, titre, lien)
    values (v_consultant, v_avis.demande_id, v_reference, 'satisfaction', 'Avis de satisfaction reçu', '#/demandes/' || v_reference);
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_rpc_soumettre(p_demande_id uuid, p_ids_obligatoires text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_manquantes integer;
begin
  if not public.crm_acces_demande(p_demande_id) then
    raise exception 'Demande introuvable : %', p_demande_id;
  end if;

  select count(*) into v_manquantes
  from unnest(p_ids_obligatoires) as pertinente(question_id)
  left join public.crm_reponses r on r.demande_id = p_demande_id and r.question_id = pertinente.question_id
  where r.demande_id is null or (r.valeur is null and r.nsp is not true);

  if v_manquantes > 0 then
    raise exception '% question(s) obligatoire(s) sans réponse', v_manquantes;
  end if;

  update public.crm_demandes set soumise_le = now() where id = p_demande_id;
  perform set_config('app.transition_client_via_rpc', 'on', true);
  perform public.crm_rpc_changer_statut(p_demande_id, 'soumise', 'Envoi des réponses par le client');
  perform set_config('app.transition_client_via_rpc', 'off', true);
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_rpc_valider_cadrage(p_note_id uuid, p_signature_image text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_demande_id uuid;
  v_credential text;
  v_statut text;
begin
  if p_signature_image is null or length(trim(p_signature_image)) = 0 then
    raise exception 'La signature est obligatoire pour valider la note de cadrage';
  end if;
  if p_signature_image !~ '^data:image/png;base64,' or length(p_signature_image) > 1000000 then
    raise exception 'Signature invalide';
  end if;

  select demande_id, statut into v_demande_id, v_statut from public.crm_notes_cadrage where id = p_note_id;
  if v_demande_id is null or not public.crm_peut_signer(v_demande_id) then
    raise exception 'Note de cadrage introuvable : %', p_note_id;
  end if;
  if v_statut <> 'envoyee' then
    raise exception 'Cette note n''est pas en attente de validation';
  end if;

  v_credential := public.crm_code_verification();

  perform set_config('app.signature_via_rpc', 'on', true);
  update public.crm_notes_cadrage
  set statut = 'validee',
      validee_le = now(),
      validee_par = public.app_personne_id(),
      validation_ip = inet_client_addr(),
      signature_image = p_signature_image,
      signature_credential = v_credential
  where id = p_note_id;

  perform set_config('app.signature_via_rpc', 'off', true);
  perform set_config('app.transition_client_via_rpc', 'on', true);
  perform public.crm_rpc_changer_statut(v_demande_id, 'cadrage_valide', 'Validation de la note de cadrage par le client');
  perform set_config('app.transition_client_via_rpc', 'off', true);
end;
$function$;

REVOKE ALL ON FUNCTION public.crm_a_acces(p_demande_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_a_acces(p_demande_id uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.crm_acces_demande(p_demande_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_acces_demande(p_demande_id uuid) TO service_role, authenticated;
REVOKE ALL ON FUNCTION public.crm_client_peut_ecrire_reponse(p_demande_id uuid, p_question_id text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_client_peut_ecrire_reponse(p_demande_id uuid, p_question_id text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.crm_est_membre_tache(p_tache uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_est_membre_tache(p_tache uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.crm_fn_attribuer_client() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_fn_attribuer_demande() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_fn_audit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_fn_consentement_maj() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_fn_historiser_reponse() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_fn_notifier_evenement() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_fn_notifier_membre_tache() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_fn_notifier_satisfaction() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_fn_notifier_tache() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_fn_premiere_saisie() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_fn_proteger_assignation_client() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_fn_proteger_assignation_demande() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_fn_reclamation_maj() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_fn_reference() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_fn_satisfaction_maj() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_fn_tache_maj() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_fn_touch() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_peut_voir_client(p_client_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_peut_voir_client(p_client_id uuid) TO service_role, authenticated;
REVOKE ALL ON FUNCTION public.crm_peut_voir_demande(p_demande_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_peut_voir_demande(p_demande_id uuid) TO service_role, authenticated;
REVOKE ALL ON FUNCTION public.crm_peut_voir_tache(p_tache uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_peut_voir_tache(p_tache uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.crm_peut_voir_tache_chemin(p_nom text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_peut_voir_tache_chemin(p_nom text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.crm_rpc_accepter_proposition(p_proposition_id uuid, p_signature_image text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_rpc_accepter_proposition(p_proposition_id uuid, p_signature_image text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.crm_rpc_archiver_demande(p_demande_id uuid, p_archiver boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_rpc_archiver_demande(p_demande_id uuid, p_archiver boolean) TO service_role, authenticated;
REVOKE ALL ON FUNCTION public.crm_rpc_assigner_demande(p_demande_id uuid, p_consultant_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_rpc_assigner_demande(p_demande_id uuid, p_consultant_id uuid) TO service_role, authenticated;
REVOKE ALL ON FUNCTION public.crm_rpc_changer_statut(p_demande_id uuid, p_vers text, p_commentaire text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_rpc_changer_statut(p_demande_id uuid, p_vers text, p_commentaire text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.crm_rpc_confirmer_reservation_calcom(p_demande_id uuid, p_debut timestamp with time zone, p_fin timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_rpc_confirmer_reservation_calcom(p_demande_id uuid, p_debut timestamp with time zone, p_fin timestamp with time zone) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.crm_rpc_demander_modification(p_note_id uuid, p_commentaire text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_rpc_demander_modification(p_note_id uuid, p_commentaire text) TO service_role, authenticated;
REVOKE ALL ON FUNCTION public.crm_rpc_deposer_reclamation(p_demande_id uuid, p_objet text, p_description text, p_date_reception date, p_gravite text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_rpc_deposer_reclamation(p_demande_id uuid, p_objet text, p_description text, p_date_reception date, p_gravite text) TO service_role, authenticated;
REVOKE ALL ON FUNCTION public.crm_rpc_fusionner_clients(p_garder uuid, p_absorber uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_rpc_fusionner_clients(p_garder uuid, p_absorber uuid) TO service_role, authenticated;
REVOKE ALL ON FUNCTION public.crm_rpc_jalons() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_rpc_jalons() TO service_role, authenticated;
REVOKE ALL ON FUNCTION public.crm_rpc_mes_reclamations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_rpc_mes_reclamations() TO service_role, authenticated;
REVOKE ALL ON FUNCTION public.crm_rpc_refuser_proposition(p_proposition_id uuid, p_commentaire text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_rpc_refuser_proposition(p_proposition_id uuid, p_commentaire text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.crm_rpc_repondre_satisfaction(p_id uuid, p_note integer, p_commentaire text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_rpc_repondre_satisfaction(p_id uuid, p_note integer, p_commentaire text) TO service_role, authenticated;
REVOKE ALL ON FUNCTION public.crm_rpc_soumettre(p_demande_id uuid, p_ids_obligatoires text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_rpc_soumettre(p_demande_id uuid, p_ids_obligatoires text[]) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.crm_rpc_valider_cadrage(p_note_id uuid, p_signature_image text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_rpc_valider_cadrage(p_note_id uuid, p_signature_image text) TO authenticated, service_role;

-- Aide interne : appelée seulement par les fonctions de signature (security definer), jamais par l'API.
revoke all on function public.crm_peut_signer(uuid) from public, anon, authenticated;

set check_function_bodies = on;
