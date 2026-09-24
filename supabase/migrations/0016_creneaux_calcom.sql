-- Remplace le flux manuel de créneaux par une vraie réservation via Cal.com
-- (agenda réel du consultant) : le client réserve directement sur le widget
-- intégré, et l'événement bookingSuccessfulV2 de l'embed (déclenché côté
-- navigateur, sans webhook) déclenche cette fonction pour enregistrer le
-- rendez-vous confirmé et faire passer la demande à entretien_planifie.

drop function if exists rpc_choisir_creneau(uuid);

create function rpc_confirmer_reservation_calcom(p_demande_id uuid, p_debut timestamptz, p_fin timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from entretien_creneaux where demande_id = p_demande_id and choisi = true) then
    raise exception 'Un entretien est déjà confirmé pour cette demande';
  end if;

  insert into entretien_creneaux (demande_id, debut, fin, choisi)
  values (p_demande_id, p_debut, p_fin, true);

  perform rpc_changer_statut(p_demande_id, 'entretien_planifie', 'Rendez-vous confirmé via Cal.com');
end;
$$;

revoke execute on function rpc_confirmer_reservation_calcom(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function rpc_confirmer_reservation_calcom(uuid, timestamptz, timestamptz) to authenticated;
