-- Lot Acces, etape 4 : attribution d'une demande a un consultant, reservee a
-- l'admin (le trigger de 0039 interdit deja a un consultant de changer
-- consultant_id). La fonction journalise l'attribution (type 'assignation',
-- sans effet sur les statuts, le calendrier ou les notifications de statut)
-- et previent le consultant concerne.

create or replace function rpc_assigner_demande(p_demande_id uuid, p_consultant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nom text;
  v_reference text;
begin
  if not est_admin() then
    raise exception 'Réservé à l''administrateur.';
  end if;

  select coalesce(nullif(trim(nom), ''), email) into v_nom
  from profils where user_id = p_consultant_id and role in ('admin', 'consultant');
  if v_nom is null then
    raise exception 'Consultant introuvable.';
  end if;

  update demandes set consultant_id = p_consultant_id where id = p_demande_id returning reference into v_reference;
  if v_reference is null then
    raise exception 'Demande introuvable : %', p_demande_id;
  end if;

  insert into evenements (demande_id, type, vers, auteur, commentaire)
  values (p_demande_id, 'assignation', 'assignee', auth.uid(), v_nom);

  if p_consultant_id is distinct from auth.uid() then
    insert into notifications (destinataire, demande_id, reference, type, titre)
    values (p_consultant_id, p_demande_id, v_reference, 'assignation', 'Demande attribuée');
  end if;
end;
$$;

revoke all on function rpc_assigner_demande(uuid, uuid) from public, anon, authenticated;
grant execute on function rpc_assigner_demande(uuid, uuid) to authenticated;
