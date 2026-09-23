-- Le client n'a aucun droit d'écriture directe sur notes_cadrage (0003_rls.sql) :
-- demander une modification doit passer par une RPC security definer, comme
-- rpc_valider_cadrage. 01_ARCHITECTURE.md section 10.2.

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
  if v_demande_id is null then
    raise exception 'Note de cadrage introuvable : %', p_note_id;
  end if;

  update notes_cadrage set statut = 'a_revoir' where id = p_note_id;

  perform rpc_changer_statut(v_demande_id, 'cadrage_a_revoir', p_commentaire);
end;
$$;

revoke execute on function rpc_demander_modification(uuid, text) from public;
grant execute on function rpc_demander_modification(uuid, text) to authenticated;
