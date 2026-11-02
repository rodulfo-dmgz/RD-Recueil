-- Fonctions et triggers : 01_ARCHITECTURE.md section 7 (tableau) et section 3.2 (transitions).

-- ─── Génération de la référence ────────────────────────────────────────────

create or replace function fn_reference()
returns trigger
language plpgsql
as $$
begin
  if new.reference is null then
    new.reference := 'RDF-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('demande_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

create trigger trg_demandes_reference
  before insert on demandes
  for each row execute function fn_reference();

-- ─── updated_at ─────────────────────────────────────────────────────────────

create or replace function fn_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_demandes_touch
  before update on demandes
  for each row execute function fn_touch();

create trigger trg_reponses_touch
  before update on reponses
  for each row execute function fn_touch();

-- ─── Historisation des réponses ─────────────────────────────────────────────

create or replace function fn_historiser_reponse()
returns trigger
language plpgsql
as $$
begin
  if old.valeur is distinct from new.valeur then
    insert into reponses_historique (demande_id, question_id, ancienne_valeur, nouvelle_valeur, auteur)
    values (old.demande_id, old.question_id, old.valeur, new.valeur, new.saisi_par);
  end if;
  return new;
end;
$$;

create trigger trg_reponses_historique
  after update on reponses
  for each row execute function fn_historiser_reponse();

-- ─── Première saisie client : envoyee -> en_saisie ──────────────────────────

create or replace function fn_premiere_saisie()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_statut text;
begin
  select role into v_role from profils where user_id = new.saisi_par;
  select statut into v_statut from demandes where id = new.demande_id;

  if v_role = 'client' and v_statut = 'envoyee' then
    update demandes set statut = 'en_saisie', updated_at = now() where id = new.demande_id;
    insert into evenements (demande_id, type, de, vers, auteur, commentaire)
    values (new.demande_id, 'statut', 'envoyee', 'en_saisie', new.saisi_par, 'Première réponse du client');
  end if;

  return new;
end;
$$;

create trigger trg_reponses_premiere_saisie
  after insert on reponses
  for each row execute function fn_premiere_saisie();

-- ─── Rattachement d'un nouvel utilisateur (première connexion client) ──────
-- 01_ARCHITECTURE.md section 8.1 : l'invitation crée une ligne demande_acces ;
-- à la première connexion, un trigger rattache user_id et crée le profil client.

create or replace function fn_gerer_nouvel_utilisateur()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update demande_acces set user_id = new.id where email = new.email and user_id is null;

  if not exists (select 1 from profils where user_id = new.id)
     and exists (select 1 from demande_acces where email = new.email) then
    insert into profils (user_id, role, email) values (new.id, 'client', new.email);
  end if;

  return new;
end;
$$;

-- Nommé de façon spécifique (et non "on_auth_user_created") : auth.users est une
-- ressource partagée par project Supabase, plusieurs applications RD Formation
-- peuvent y avoir chacune leur propre trigger after-insert.
create trigger trg_rd_recueil_nouvel_utilisateur
  after insert on auth.users
  for each row execute function fn_gerer_nouvel_utilisateur();

-- ─── Fonctions utilitaires pour les politiques RLS ─────────────────────────

create or replace function est_staff()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from profils where user_id = auth.uid() and role in ('admin', 'consultant')
  );
$$;

create or replace function a_acces(p_demande_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from demande_acces
    where demande_id = p_demande_id and user_id = auth.uid()
  );
$$;

create or replace function client_peut_ecrire_reponse(p_demande_id uuid, p_question_id text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from demande_acces da
    join demandes d on d.id = p_demande_id
    join questions q on q.questionnaire_id = d.questionnaire_id and q.id = p_question_id
    where da.demande_id = p_demande_id
      and da.user_id = auth.uid()
      and da.droit = 'editeur'
      and q.rempli_par in ('C', 'C/F')
      and d.statut in ('envoyee', 'en_saisie')
  );
$$;

-- ─── Transitions de statut ──────────────────────────────────────────────────
-- Cf. 01_ARCHITECTURE.md section 3.2. Seul moyen de changer demandes.statut :
-- aucun update direct n'est autorisé par les politiques RLS (section 8.2).

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
    when 'cadrage_a_revoir'      then array['en_saisie', 'abandonnee']
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

-- ─── Soumission côté client ─────────────────────────────────────────────────

create or replace function rpc_soumettre(p_demande_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manquantes integer;
begin
  select count(*) into v_manquantes
  from questions q
  join demandes d on d.questionnaire_id = q.questionnaire_id
  left join reponses r on r.demande_id = d.id and r.question_id = q.id
  where d.id = p_demande_id
    and q.obligatoire = true
    and q.rempli_par in ('C', 'C/F')
    and (r.demande_id is null or (r.valeur is null and r.nsp is not true));

  if v_manquantes > 0 then
    raise exception '% question(s) obligatoire(s) sans réponse', v_manquantes;
  end if;

  update demandes set soumise_le = now() where id = p_demande_id;
  perform rpc_changer_statut(p_demande_id, 'soumise', 'Envoi des réponses par le client');
end;
$$;

-- ─── Validation de la note de cadrage côté client ──────────────────────────

create or replace function rpc_valider_cadrage(p_note_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_demande_id uuid;
begin
  select demande_id into v_demande_id from notes_cadrage where id = p_note_id;
  if v_demande_id is null then
    raise exception 'Note de cadrage introuvable : %', p_note_id;
  end if;

  update notes_cadrage
  set statut = 'validee', validee_le = now(), validee_par = auth.uid(), validation_ip = inet_client_addr()
  where id = p_note_id;

  perform rpc_changer_statut(v_demande_id, 'cadrage_valide', 'Validation de la note de cadrage par le client');
end;
$$;
