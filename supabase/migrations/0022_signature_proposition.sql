-- Signature électronique simple à l'acceptation de la proposition
-- commerciale (même mécanisme que la note de cadrage, 01_ARCHITECTURE.md
-- section 7/7.1) : dessin ou nom tapé, capturé en image, avec un code de
-- vérification généré côté serveur.

alter table propositions add column if not exists signature_image text;
alter table propositions add column if not exists signature_credential text;

drop function if exists rpc_accepter_proposition(uuid);

create function rpc_accepter_proposition(p_proposition_id uuid, p_signature_image text)
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
    raise exception 'La signature est obligatoire pour accepter la proposition';
  end if;

  select demande_id into v_demande_id from propositions where id = p_proposition_id;
  if v_demande_id is null then
    raise exception 'Proposition introuvable : %', p_proposition_id;
  end if;

  v_credential := to_char(floor(random() * 1000000)::int, 'FM000000')
    || '-' || to_char(floor(random() * 1000000)::int, 'FM000000');

  update propositions
  set statut = 'acceptee',
      decidee_le = now(),
      decidee_par = auth.uid(),
      signature_image = p_signature_image,
      signature_credential = v_credential
  where id = p_proposition_id;

  perform rpc_changer_statut(v_demande_id, 'gagnee', 'Proposition acceptée par le client');
end;
$$;

revoke execute on function rpc_accepter_proposition(uuid, text) from public, anon;
grant execute on function rpc_accepter_proposition(uuid, text) to authenticated;
