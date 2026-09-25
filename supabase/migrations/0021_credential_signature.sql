-- Code de verification numerique associe a la signature electronique
-- simple - 01_ARCHITECTURE.md section 7 (notes_cadrage.signature_credential).
-- Genere cote serveur au moment de la validation, aux cotes de l'image de
-- signature, de l'horodatage et de l'IP deja enregistres.

alter table notes_cadrage add column if not exists signature_credential text;

drop function if exists rpc_valider_cadrage(uuid, text);

create function rpc_valider_cadrage(p_note_id uuid, p_signature_image text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_demande_id uuid;
  v_credential text;
begin
  if p_signature_image is null or length(trim(p_signature_image)) = 0 then
    raise exception 'La signature est obligatoire pour valider la note de cadrage';
  end if;

  select demande_id into v_demande_id from notes_cadrage where id = p_note_id;
  if v_demande_id is null then
    raise exception 'Note de cadrage introuvable : %', p_note_id;
  end if;

  v_credential := to_char(floor(random() * 1000000)::int, 'FM000000')
    || '-' || to_char(floor(random() * 1000000)::int, 'FM000000');

  update notes_cadrage
  set statut = 'validee',
      validee_le = now(),
      validee_par = auth.uid(),
      validation_ip = inet_client_addr(),
      signature_image = p_signature_image,
      signature_credential = v_credential
  where id = p_note_id;

  perform rpc_changer_statut(v_demande_id, 'cadrage_valide', 'Validation de la note de cadrage par le client');
end;
$$;

grant execute on function rpc_valider_cadrage(uuid, text) to authenticated;
