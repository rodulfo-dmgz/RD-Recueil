-- Archivage reversible d'une demande (01_ARCHITECTURE.md section 4.2,
-- distinct d'une suppression definitive) : masque la demande des listes
-- staff par defaut sans toucher a son statut ni a ses donnees. RPC dediee
-- plutot qu'un update direct (CLAUDE.md) pour tracer l'action dans
-- evenements ; type 'archive' (et non 'statut') pour ne pas declencher
-- fn_notifier_evenement (0023_notifications.sql).

alter table demandes add column archivee boolean not null default false;
alter table demandes add column archivee_le timestamptz;

create or replace function rpc_archiver_demande(p_demande_id uuid, p_archiver boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not est_staff() then
    raise exception 'Reserve au personnel RD Formation.';
  end if;

  update demandes
  set archivee = p_archiver, archivee_le = case when p_archiver then now() else null end
  where id = p_demande_id;

  if not found then
    raise exception 'Demande introuvable : %', p_demande_id;
  end if;

  insert into evenements (demande_id, type, vers, auteur)
  values (p_demande_id, 'archive', case when p_archiver then 'archivee' else 'desarchivee' end, auth.uid());
end;
$$;

revoke all on function rpc_archiver_demande(uuid, boolean) from public, anon, authenticated;
grant execute on function rpc_archiver_demande(uuid, boolean) to authenticated;
