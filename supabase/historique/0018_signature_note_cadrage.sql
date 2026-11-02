-- Signature électronique simple à la validation de la note de cadrage
-- (01_ARCHITECTURE.md sections 7 et 7.1). Le client dessine un tracé sur
-- <canvas>, capturé en data URL (image/png) et enregistré avec la note.

alter table notes_cadrage add column if not exists signature_image text;

drop function if exists rpc_valider_cadrage(uuid);

create function rpc_valider_cadrage(p_note_id uuid, p_signature_image text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_demande_id uuid;
begin
  if p_signature_image is null or length(trim(p_signature_image)) = 0 then
    raise exception 'La signature est obligatoire pour valider la note de cadrage';
  end if;

  select demande_id into v_demande_id from notes_cadrage where id = p_note_id;
  if v_demande_id is null then
    raise exception 'Note de cadrage introuvable : %', p_note_id;
  end if;

  update notes_cadrage
  set statut = 'validee',
      validee_le = now(),
      validee_par = auth.uid(),
      validation_ip = inet_client_addr(),
      signature_image = p_signature_image
  where id = p_note_id;

  perform rpc_changer_statut(v_demande_id, 'cadrage_valide', 'Validation de la note de cadrage par le client');
end;
$$;

grant execute on function rpc_valider_cadrage(uuid, text) to authenticated;
