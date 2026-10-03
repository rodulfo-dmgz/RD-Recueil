-- Lot Acces, etape 2 (docs/changes.md) : les fonctions security definer
-- contournent la RLS ; elles verifient maintenant elles-memes l'acces a la
-- demande. Corrige aussi un trou ancien : rpc_changer_statut,
-- rpc_valider_cadrage, rpc_accepter_proposition, rpc_refuser_proposition,
-- rpc_demander_modification, rpc_soumettre et rpc_confirmer_reservation_calcom
-- ne verifiaient pas que l'appelant avait acces a la demande (n'importe quel
-- compte connecte pouvait agir sur n'importe quelle demande, par son
-- identifiant), et rpc_valider_cadrage etait appelable sans connexion.

-- Acces a une demande : le personnel concerne (admin, ou consultant de la
-- demande) ou un compte client invite sur elle.
create or replace function acces_demande(p_demande_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select peut_voir_demande(p_demande_id)
    or exists (select 1 from demande_acces da where da.demande_id = p_demande_id and da.user_id = auth.uid());
$$;

revoke all on function acces_demande(uuid) from public, anon, authenticated;
grant execute on function acces_demande(uuid) to authenticated;

-- ─── Changement de statut ───────────────────────────────────────────────────

create or replace function rpc_changer_statut(p_demande_id uuid, p_vers text, p_commentaire text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_statut_actuel text;
  v_role text;
  v_transitions_valides text[];
begin
  if not acces_demande(p_demande_id) then
    raise exception 'Demande introuvable : %', p_demande_id;
  end if;

  select statut into v_statut_actuel from demandes where id = p_demande_id;
  if v_statut_actuel is null then
    raise exception 'Demande introuvable : %', p_demande_id;
  end if;

  select role into v_role from profils where user_id = auth.uid();
  if v_role is null then
    raise exception 'Profil introuvable pour l''utilisateur courant';
  end if;

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

  if v_role = 'client' and p_vers not in ('soumise', 'cadrage_valide', 'cadrage_a_revoir', 'abandonnee') then
    raise exception 'Rôle "%" non autorisé pour la transition vers "%"', v_role, p_vers;
  end if;

  update demandes set statut = p_vers, updated_at = now() where id = p_demande_id;

  insert into evenements (demande_id, type, de, vers, auteur, commentaire)
  values (p_demande_id, 'statut', v_statut_actuel, p_vers, auth.uid(), p_commentaire);
end;
$$;

-- ─── Fonctions qui modifient avant de changer le statut ─────────────────────

create or replace function rpc_soumettre(p_demande_id uuid, p_ids_obligatoires text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manquantes integer;
begin
  if not acces_demande(p_demande_id) then
    raise exception 'Demande introuvable : %', p_demande_id;
  end if;

  select count(*) into v_manquantes
  from unnest(p_ids_obligatoires) as pertinente(question_id)
  left join reponses r on r.demande_id = p_demande_id and r.question_id = pertinente.question_id
  where r.demande_id is null or (r.valeur is null and r.nsp is not true);

  if v_manquantes > 0 then
    raise exception '% question(s) obligatoire(s) sans réponse', v_manquantes;
  end if;

  update demandes set soumise_le = now() where id = p_demande_id;
  perform rpc_changer_statut(p_demande_id, 'soumise', 'Envoi des réponses par le client');
end;
$$;

create or replace function rpc_demander_modification(p_note_id uuid, p_commentaire text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_demande_id uuid;
begin
  select demande_id into v_demande_id from notes_cadrage where id = p_note_id;
  if v_demande_id is null or not acces_demande(v_demande_id) then
    raise exception 'Note de cadrage introuvable : %', p_note_id;
  end if;

  update notes_cadrage set statut = 'a_revoir' where id = p_note_id;

  perform rpc_changer_statut(v_demande_id, 'cadrage_a_revoir', p_commentaire);
end;
$$;

create or replace function rpc_valider_cadrage(p_note_id uuid, p_signature_image text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_demande_id uuid;
  v_credential text;
begin
  if p_signature_image is null or length(trim(p_signature_image)) = 0 then
    raise exception 'La signature est obligatoire pour valider la note de cadrage';
  end if;

  select demande_id into v_demande_id from notes_cadrage where id = p_note_id;
  if v_demande_id is null or not acces_demande(v_demande_id) then
    raise exception 'Note de cadrage introuvable : %', p_note_id;
  end if;

  v_credential := to_char(floor(random() * 1000000)::int, 'FM000000')
    || '-' || to_char(floor(random() * 1000000)::int, 'FM000000');

  update notes_cadrage
  set statut = 'validee',
      validee_le = now(),
      validee_par = auth.uid(),
      validation_ip = inet_client_addr(),
      signature_image = p_signature_image,
      signature_credential = v_credential
  where id = p_note_id;

  perform rpc_changer_statut(v_demande_id, 'cadrage_valide', 'Validation de la note de cadrage par le client');
end;
$$;

create or replace function rpc_accepter_proposition(p_proposition_id uuid, p_signature_image text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_demande_id uuid;
  v_credential text;
begin
  if p_signature_image is null or length(trim(p_signature_image)) = 0 then
    raise exception 'La signature est obligatoire pour accepter la proposition';
  end if;

  select demande_id into v_demande_id from propositions where id = p_proposition_id;
  if v_demande_id is null or not acces_demande(v_demande_id) then
    raise exception 'Proposition introuvable : %', p_proposition_id;
  end if;

  v_credential := to_char(floor(random() * 1000000)::int, 'FM000000')
    || '-' || to_char(floor(random() * 1000000)::int, 'FM000000');

  update propositions
  set statut = 'acceptee',
      decidee_le = now(),
      decidee_par = auth.uid(),
      signature_image = p_signature_image,
      signature_credential = v_credential
  where id = p_proposition_id;

  perform rpc_changer_statut(v_demande_id, 'gagnee', 'Proposition acceptée par le client');
end;
$$;

create or replace function rpc_refuser_proposition(p_proposition_id uuid, p_commentaire text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_demande_id uuid;
begin
  select demande_id into v_demande_id from propositions where id = p_proposition_id;
  if v_demande_id is null or not acces_demande(v_demande_id) then
    raise exception 'Proposition introuvable : %', p_proposition_id;
  end if;

  update propositions
  set statut = 'refusee', decidee_le = now(), decidee_par = auth.uid(), commentaire_client = p_commentaire
  where id = p_proposition_id;

  perform rpc_changer_statut(v_demande_id, 'perdue', p_commentaire);
end;
$$;

create or replace function rpc_confirmer_reservation_calcom(p_demande_id uuid, p_debut timestamptz, p_fin timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not acces_demande(p_demande_id) then
    raise exception 'Demande introuvable : %', p_demande_id;
  end if;

  if exists (select 1 from entretien_creneaux where demande_id = p_demande_id and choisi = true) then
    raise exception 'Un entretien est déjà confirmé pour cette demande';
  end if;

  insert into entretien_creneaux (demande_id, debut, fin, choisi)
  values (p_demande_id, p_debut, p_fin, true);

  perform rpc_changer_statut(p_demande_id, 'entretien_planifie', 'Rendez-vous confirmé via Cal.com');
end;
$$;

-- ─── Archivage : le personnel concerne seulement ────────────────────────────

create or replace function rpc_archiver_demande(p_demande_id uuid, p_archiver boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not peut_voir_demande(p_demande_id) then
    raise exception 'Demande introuvable : %', p_demande_id;
  end if;

  update demandes
  set archivee = p_archiver, archivee_le = case when p_archiver then now() else null end
  where id = p_demande_id;

  insert into evenements (demande_id, type, vers, auteur)
  values (p_demande_id, 'archive', case when p_archiver then 'archivee' else 'desarchivee' end, auth.uid());
end;
$$;

-- ─── Calendrier ─────────────────────────────────────────────────────────────

create or replace function rpc_jalons()
returns table (demande_id uuid, reference text, client text, type text, date timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with visibles as (
    select d.id, d.reference, c.raison_sociale as client, d.created_at, d.date_limite
    from demandes d
    left join clients c on c.id = d.client_id
    where d.archivee = false and acces_demande(d.id)
  ),
  statuts_valides as (
    select e.demande_id, e.vers, e.created_at
    from evenements e
    where e.type = 'statut' and e.vers is not null
      and not exists (
        select 1 from evenements c
        where c.demande_id = e.demande_id
          and c.type = 'correction'
          and c.created_at > e.created_at
          and e.created_at > coalesce(
            (select max(p.created_at) from evenements p
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
  from visibles v join entretien_creneaux k on k.demande_id = v.id and k.choisi
$$;

-- ─── Notifications du personnel : l'admin et le consultant de la demande ────

create or replace function fn_notifier_evenement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

  select reference into v_reference from demandes where id = new.demande_id;
  v_vers_staff := new.vers in ('soumise', 'cadrage_a_revoir', 'cadrage_valide', 'gagnee', 'perdue', 'entretien_planifie');

  if v_vers_staff then
    insert into notifications (destinataire, demande_id, reference, type, titre)
    select p.user_id, new.demande_id, v_reference, new.vers, v_titre
    from profils p
    where p.role = 'admin'
       or (p.role = 'consultant' and p.user_id = (select d.consultant_id from demandes d where d.id = new.demande_id));
  else
    insert into notifications (destinataire, demande_id, reference, type, titre)
    select da.user_id, new.demande_id, v_reference, new.vers, v_titre
    from demande_acces da
    where da.demande_id = new.demande_id and da.user_id is not null;
  end if;

  return new;
end;
$$;

-- ─── Droits d'execution ─────────────────────────────────────────────────────
-- rpc_valider_cadrage (signature a deux arguments) etait appelable sans
-- connexion : le revoke de 0005 portait sur l'ancienne signature.

revoke all on function rpc_valider_cadrage(uuid, text) from public, anon;
grant execute on function rpc_valider_cadrage(uuid, text) to authenticated;
revoke all on function fn_historiser_reponse() from public, anon, authenticated;
revoke all on function fn_notifier_evenement() from public, anon, authenticated;
