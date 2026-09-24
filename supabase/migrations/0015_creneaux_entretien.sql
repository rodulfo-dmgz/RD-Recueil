-- Planification de l'entretien - jusqu'ici "Planifier l'entretien" ne faisait
-- que changer le statut de la demande, sans aucune coordination de date. Le
-- consultant propose désormais des créneaux, le client en choisit un ; ce
-- choix confirme le rendez-vous et fait passer la demande à
-- entretien_planifie (déclenché par le client, comme cadrage_valide).

create table entretien_creneaux (
  id uuid primary key default gen_random_uuid(),
  demande_id uuid references demandes on delete cascade,
  debut timestamptz not null,
  fin timestamptz not null,
  choisi boolean not null default false
);

alter table entretien_creneaux enable row level security;

create policy entretien_creneaux_staff on entretien_creneaux for all to authenticated
  using (est_staff()) with check (est_staff());

create policy entretien_creneaux_client_lecture on entretien_creneaux for select to authenticated
  using (a_acces(demande_id));

-- Le client ne peut pas écrire dans entretien_creneaux via RLS : choisir un
-- créneau passe par cette fonction security definer, qui contrôle la
-- transition (même principe que rpc_valider_cadrage / rpc_accepter_proposition).
create function rpc_choisir_creneau(p_creneau_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_demande_id uuid;
begin
  select demande_id into v_demande_id from entretien_creneaux where id = p_creneau_id;
  if v_demande_id is null then
    raise exception 'Créneau introuvable : %', p_creneau_id;
  end if;

  if exists (select 1 from entretien_creneaux where demande_id = v_demande_id and choisi = true) then
    raise exception 'Un créneau est déjà confirmé pour cette demande';
  end if;

  update entretien_creneaux set choisi = true where id = p_creneau_id;

  perform rpc_changer_statut(v_demande_id, 'entretien_planifie', 'Créneau d''entretien choisi par le client');
end;
$$;

revoke execute on function rpc_choisir_creneau(uuid) from public, anon;
grant execute on function rpc_choisir_creneau(uuid) to authenticated;

-- Autorise le client à déclencher entretien_planifie (jusque-là réservé au
-- staff), puisque c'est désormais son choix de créneau qui le fait.
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

  if v_role = 'client' and p_vers not in ('soumise', 'cadrage_valide', 'cadrage_a_revoir', 'gagnee', 'perdue', 'entretien_planifie', 'abandonnee') then
    raise exception 'Rôle "%" non autorisé pour la transition vers "%"', v_role, p_vers;
  end if;

  update demandes set statut = p_vers, updated_at = now() where id = p_demande_id;

  insert into evenements (demande_id, type, de, vers, auteur, commentaire)
  values (p_demande_id, 'statut', v_statut_actuel, p_vers, auth.uid(), p_commentaire);
end;
$$;
