-- CRM, lot F (suite) : le client precise la date et l'importance de sa
-- reclamation, et voit son interlocuteur (docs/changes.md).
--
-- L'importance choisie par le client fixe la gravite de depart (mineure, majeure
-- ou critique) ; l'equipe peut la corriger. La date du probleme devient la date
-- de reception. Le client voit la gravite (sous le mot "importance") et le nom de
-- son interlocuteur (le responsable de la reclamation), jamais son e-mail.

drop function rpc_deposer_reclamation(uuid, text, text);

create or replace function rpc_deposer_reclamation(
  p_demande_id uuid,
  p_objet text,
  p_description text default null,
  p_date_reception date default current_date,
  p_gravite text default 'mineure'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_demande demandes%rowtype;
  v_id uuid;
begin
  select * into v_demande from demandes where id = p_demande_id;
  if v_demande.id is null or not acces_demande(p_demande_id) then
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
  -- Garde-fou contre l'abus : au plus cinq reclamations par compte et par jour.
  if (select count(*) from reclamations r where r.created_by = auth.uid() and r.created_at > now() - interval '1 day') >= 5 then
    raise exception 'Trop de reclamations deposees aujourd''hui : contactez-nous directement';
  end if;

  insert into reclamations (client_id, demande_id, objet, description, origine, responsable_id, date_reception, gravite)
  values (
    v_demande.client_id,
    p_demande_id,
    btrim(p_objet),
    nullif(btrim(p_description), ''),
    case when est_staff() then 'equipe' else 'client' end,
    v_demande.consultant_id,
    p_date_reception,
    p_gravite
  )
  returning id into v_id;

  insert into notifications (destinataire, demande_id, reference, type, titre, lien)
  select distinct x.u, p_demande_id, v_demande.reference, 'reclamation', 'Nouvelle réclamation', '#/reclamations'
  from (
    select v_demande.consultant_id as u
    union
    select p.user_id from profils p where p.role = 'admin'
  ) x
  where x.u is not null and x.u is distinct from auth.uid();

  return v_id;
end;
$$;

revoke all on function rpc_deposer_reclamation(uuid, text, text, date, text) from public, anon, authenticated;
grant execute on function rpc_deposer_reclamation(uuid, text, text, date, text) to authenticated;

drop function rpc_mes_reclamations();

create or replace function rpc_mes_reclamations()
returns table (
  id uuid,
  demande_id uuid,
  reference text,
  date_reception date,
  objet text,
  description text,
  gravite text,
  etat text,
  interlocuteur text,
  date_cloture date,
  reponse text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.demande_id,
    d.reference,
    r.date_reception,
    r.objet,
    r.description,
    r.gravite,
    case r.statut when 'ouverte' then 'recue' when 'en_cours' then 'en_cours' else 'traitee' end,
    (select nullif(btrim(p.nom), '') from profils p where p.user_id = r.responsable_id),
    r.date_cloture,
    case when r.statut = 'cloturee' then r.action_corrective end
  from reclamations r
  join demandes d on d.id = r.demande_id
  where r.origine = 'client' and acces_demande(r.demande_id)
  order by r.created_at desc;
$$;

revoke all on function rpc_mes_reclamations() from public, anon, authenticated;
grant execute on function rpc_mes_reclamations() to authenticated;
