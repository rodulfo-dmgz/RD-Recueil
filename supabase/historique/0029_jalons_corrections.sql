-- Les retours manuels a un statut anterieur (type 'correction' dans
-- evenements, cf. docs/01_ARCHITECTURE.md section 3.2) annulent les statuts
-- parcourus entre le statut retrouve et le statut quitte : ils ne doivent
-- plus apparaitre dans le calendrier ni fausser les delais (rpc_jalons).
-- Exemple : en_analyse puis reorientee, retour a entretien_planifie -> les
-- deux evenements (en_analyse, reorientee) sont ignores.

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

revoke all on function rpc_jalons() from public, anon, authenticated;
grant execute on function rpc_jalons() to authenticated;
