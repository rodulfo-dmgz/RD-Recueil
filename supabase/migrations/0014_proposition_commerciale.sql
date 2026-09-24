-- Proposition commerciale (devis) - 01_ARCHITECTURE.md section 15, devenue
-- une fonctionnalité de la V1 : jusqu'ici cadrage_valide -> proposition_envoyee
-- -> gagnee|perdue n'existaient que comme statuts, sans aucun contenu ni
-- action pour les atteindre.

create table propositions (
  id uuid primary key default gen_random_uuid(),
  demande_id uuid references demandes on delete cascade unique,
  justification_md text not null default '',
  statut text not null default 'brouillon' check (statut in ('brouillon', 'envoyee', 'acceptee', 'refusee')),
  envoyee_le timestamptz,
  decidee_le timestamptz,
  decidee_par uuid references auth.users,
  commentaire_client text
);

create table proposition_lignes (
  id uuid primary key default gen_random_uuid(),
  proposition_id uuid references propositions on delete cascade,
  ordre smallint not null default 0,
  designation text not null,
  quantite numeric not null default 1,
  prix_unitaire numeric not null default 0,
  total numeric generated always as (quantite * prix_unitaire) stored
);

alter table propositions enable row level security;
alter table proposition_lignes enable row level security;

create policy propositions_staff on propositions for all to authenticated
  using (est_staff()) with check (est_staff());

create policy propositions_client_lecture on propositions for select to authenticated
  using (a_acces(demande_id) and statut <> 'brouillon');

create policy proposition_lignes_staff on proposition_lignes for all to authenticated
  using (est_staff()) with check (est_staff());

create policy proposition_lignes_client_lecture on proposition_lignes for select to authenticated
  using (
    exists (
      select 1 from propositions p
      where p.id = proposition_lignes.proposition_id
        and a_acces(p.demande_id)
        and p.statut <> 'brouillon'
    )
  );

-- ─── Acceptation / refus côté client ────────────────────────────────────────
-- Même principe que rpc_valider_cadrage / rpc_demander_modification : le
-- client ne peut pas écrire dans propositions via RLS, ces fonctions
-- security definer contrôlent la transition.

create function rpc_accepter_proposition(p_proposition_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_demande_id uuid;
begin
  select demande_id into v_demande_id from propositions where id = p_proposition_id;
  if v_demande_id is null then
    raise exception 'Proposition introuvable : %', p_proposition_id;
  end if;

  update propositions
  set statut = 'acceptee', decidee_le = now(), decidee_par = auth.uid()
  where id = p_proposition_id;

  perform rpc_changer_statut(v_demande_id, 'gagnee', 'Proposition acceptée par le client');
end;
$$;

create function rpc_refuser_proposition(p_proposition_id uuid, p_commentaire text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_demande_id uuid;
begin
  select demande_id into v_demande_id from propositions where id = p_proposition_id;
  if v_demande_id is null then
    raise exception 'Proposition introuvable : %', p_proposition_id;
  end if;

  update propositions
  set statut = 'refusee', decidee_le = now(), decidee_par = auth.uid(), commentaire_client = p_commentaire
  where id = p_proposition_id;

  perform rpc_changer_statut(v_demande_id, 'perdue', p_commentaire);
end;
$$;

revoke execute on function rpc_accepter_proposition(uuid) from public, anon;
grant execute on function rpc_accepter_proposition(uuid) to authenticated;
revoke execute on function rpc_refuser_proposition(uuid, text) from public, anon;
grant execute on function rpc_refuser_proposition(uuid, text) to authenticated;

-- ─── Autorise le client à décider du sort de sa propre proposition ─────────
-- rpc_changer_statut limitait jusqu'ici le rôle client à
-- soumise/cadrage_valide/cadrage_a_revoir/abandonnee. gagnee/perdue
-- n'étaient atteignables que par le staff, alors qu'ils doivent maintenant
-- résulter de la décision du client sur sa proposition (via les fonctions
-- ci-dessus, jamais par un appel direct du client à rpc_changer_statut).

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

  if v_role = 'client' and p_vers not in ('soumise', 'cadrage_valide', 'cadrage_a_revoir', 'gagnee', 'perdue', 'abandonnee') then
    raise exception 'Rôle "%" non autorisé pour la transition vers "%"', v_role, p_vers;
  end if;

  update demandes set statut = p_vers, updated_at = now() where id = p_demande_id;

  insert into evenements (demande_id, type, de, vers, auteur, commentaire)
  values (p_demande_id, 'statut', v_statut_actuel, p_vers, auth.uid(), p_commentaire);
end;
$$;
