-- Corrige rpc_changer_statut : depuis cadrage_a_revoir, seul un retour à
-- en_saisie était autorisé, alors que l'éditeur de note (consultant) permet
-- de créer directement une nouvelle version de la note et de la renvoyer
-- sans repasser par la saisie client (01_ARCHITECTURE.md section 3.2).
-- Ajoute cadrage_envoye comme transition valide depuis cadrage_a_revoir.

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
