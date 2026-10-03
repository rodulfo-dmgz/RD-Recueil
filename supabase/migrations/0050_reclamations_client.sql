-- CRM, lot F (suite) : le client peut deposer une reclamation (docs/changes.md).
--
-- Le client n'ecrit jamais directement dans `reclamations` : il depose par
-- rpc_deposer_reclamation (qui verifie son acces a la demande) et lit ses
-- reclamations par rpc_mes_reclamations, qui ne montre ni la gravite ni le
-- responsable. Une reclamation deposee par le client est ouverte, attribuee au
-- consultant de la demande, et previent le consultant et les admins.

alter table reclamations
  add column origine text not null default 'equipe' check (origine in ('equipe', 'client'));

-- Sans responsable, le createur le devient seulement s'il est du personnel (un
-- client qui depose ne devient pas "responsable" de sa propre reclamation).
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
  if tg_op = 'INSERT' and new.responsable_id is null and est_staff() then
    new.responsable_id := auth.uid();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function rpc_deposer_reclamation(p_demande_id uuid, p_objet text, p_description text default null)
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
  -- Garde-fou contre l'abus : au plus cinq reclamations par compte et par jour.
  if (select count(*) from reclamations r where r.created_by = auth.uid() and r.created_at > now() - interval '1 day') >= 5 then
    raise exception 'Trop de reclamations deposees aujourd''hui : contactez-nous directement';
  end if;

  insert into reclamations (client_id, demande_id, objet, description, origine, responsable_id)
  values (
    v_demande.client_id,
    p_demande_id,
    btrim(p_objet),
    nullif(btrim(p_description), ''),
    case when est_staff() then 'equipe' else 'client' end,
    v_demande.consultant_id
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

revoke all on function rpc_deposer_reclamation(uuid, text, text) from public, anon, authenticated;
grant execute on function rpc_deposer_reclamation(uuid, text, text) to authenticated;

-- Les reclamations deposees par le client sur les demandes auxquelles il a acces,
-- avec un etat simple (recue, en cours, traitee) et, une fois traitee, la reponse
-- (action corrective). Ni la gravite ni le responsable.
create or replace function rpc_mes_reclamations()
returns table (
  id uuid,
  demande_id uuid,
  reference text,
  date_reception date,
  objet text,
  description text,
  etat text,
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
    case r.statut when 'ouverte' then 'recue' when 'en_cours' then 'en_cours' else 'traitee' end,
    r.date_cloture,
    case when r.statut = 'cloturee' then r.action_corrective end
  from reclamations r
  join demandes d on d.id = r.demande_id
  where r.origine = 'client' and acces_demande(r.demande_id)
  order by r.created_at desc;
$$;

revoke all on function rpc_mes_reclamations() from public, anon, authenticated;
grant execute on function rpc_mes_reclamations() to authenticated;
