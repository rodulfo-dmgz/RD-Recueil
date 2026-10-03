-- Lot Acces, etape 2 (suite) : transitions declenchees par le client.
-- Regression trouvee en verifiant l'acces : 0019 a reecrit rpc_changer_statut
-- sans les transitions gagnee, perdue et entretien_planifie pour le role
-- client (presentes dans 0014 et 0015). Resultat en production : un client ne
-- pouvait ni accepter ou refuser une proposition ni confirmer un rendez-vous
-- (rpc_accepter_proposition, rpc_refuser_proposition et
-- rpc_confirmer_reservation_calcom appellent rpc_changer_statut avec son
-- identite et levaient "Role client non autorise").
--
-- Correctif : un client ne peut declencher soumise, cadrage_valide,
-- cadrage_a_revoir, gagnee, perdue et entretien_planifie que par les
-- fonctions dediees (qui verifient la signature, les questions obligatoires
-- ou le creneau), jamais par un appel direct a rpc_changer_statut. Ces
-- fonctions posent un indicateur valable le temps de la transaction ; un
-- client ne peut pas le poser lui-meme (set_config n'est pas expose par
-- l'API). Il garde l'appel direct pour abandonnee.

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
  v_via_fonction boolean := coalesce(current_setting('app.transition_client_via_rpc', true), '') = 'on';
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

  if v_role = 'client'
     and not (p_vers = 'abandonnee'
              or (v_via_fonction and p_vers in ('soumise', 'cadrage_valide', 'cadrage_a_revoir', 'gagnee', 'perdue', 'entretien_planifie'))) then
    raise exception 'Rôle "%" non autorisé pour la transition vers "%"', v_role, p_vers;
  end if;

  update demandes set statut = p_vers, updated_at = now() where id = p_demande_id;

  insert into evenements (demande_id, type, de, vers, auteur, commentaire)
  values (p_demande_id, 'statut', v_statut_actuel, p_vers, auth.uid(), p_commentaire);
end;
$$;

-- Les fonctions dediees posent l'indicateur autour de leur appel.

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
  perform set_config('app.transition_client_via_rpc', 'on', true);
  perform rpc_changer_statut(p_demande_id, 'soumise', 'Envoi des réponses par le client');
  perform set_config('app.transition_client_via_rpc', 'off', true);
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

  perform set_config('app.transition_client_via_rpc', 'on', true);
  perform rpc_changer_statut(v_demande_id, 'cadrage_a_revoir', p_commentaire);
  perform set_config('app.transition_client_via_rpc', 'off', true);
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

  perform set_config('app.transition_client_via_rpc', 'on', true);
  perform rpc_changer_statut(v_demande_id, 'cadrage_valide', 'Validation de la note de cadrage par le client');
  perform set_config('app.transition_client_via_rpc', 'off', true);
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

  perform set_config('app.transition_client_via_rpc', 'on', true);
  perform rpc_changer_statut(v_demande_id, 'gagnee', 'Proposition acceptée par le client');
  perform set_config('app.transition_client_via_rpc', 'off', true);
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

  perform set_config('app.transition_client_via_rpc', 'on', true);
  perform rpc_changer_statut(v_demande_id, 'perdue', p_commentaire);
  perform set_config('app.transition_client_via_rpc', 'off', true);
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

  perform set_config('app.transition_client_via_rpc', 'on', true);
  perform rpc_changer_statut(p_demande_id, 'entretien_planifie', 'Rendez-vous confirmé via Cal.com');
  perform set_config('app.transition_client_via_rpc', 'off', true);
end;
$$;
