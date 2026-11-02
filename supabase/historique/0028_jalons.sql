-- Dates importantes des demandes (calendrier et rapport de projet du client,
-- indicateurs de l'admin) - 01_ARCHITECTURE.md sections 4.1 et 4.2.
-- Le client n'a aucun acces direct a evenements (peut contenir des
-- commentaires internes) : cette fonction n'expose que le type de jalon et sa
-- date, pour les demandes accessibles a l'appelant (staff : toutes), hors
-- demandes archivees.

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
    where d.archivee = false and (est_staff() or a_acces(d.id))
  )
  select v.id, v.reference, v.client, 'creation'::text, v.created_at from visibles v
  union all
  select v.id, v.reference, v.client, 'echeance'::text, v.date_limite::timestamptz
  from visibles v where v.date_limite is not null
  union all
  select v.id, v.reference, v.client, e.vers, e.created_at
  from visibles v join evenements e on e.demande_id = v.id and e.type = 'statut' and e.vers is not null
  union all
  select v.id, v.reference, v.client, 'entretien'::text, k.debut
  from visibles v join entretien_creneaux k on k.demande_id = v.id and k.choisi
$$;

revoke all on function rpc_jalons() from public, anon, authenticated;
grant execute on function rpc_jalons() to authenticated;
