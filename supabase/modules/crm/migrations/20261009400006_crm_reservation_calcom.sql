-- =====================================================================
-- MODULE crm_ 6 : réservation de l'entretien (Cal.com) durcie
-- Avant : tout invité de la demande, même en lecture seule, pouvait réserver, sans contrôle de la plage horaire.
-- Maintenant : le personnel de la demande ou l'invité avec le droit « editeur » et le rôle crm_client
-- (crm_peut_signer), une plage cohérente (fin après début) et pas plus d'un jour dans le passé.
-- La réservation annoncée par le navigateur n'est pas encore vérifiée auprès de Cal.com (évolution à part).
-- =====================================================================

create or replace function public.crm_rpc_confirmer_reservation_calcom(p_demande_id uuid, p_debut timestamp with time zone, p_fin timestamp with time zone)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (public.crm_peut_voir_demande(p_demande_id) or public.crm_peut_signer(p_demande_id)) then
    raise exception 'Demande introuvable : %', p_demande_id;
  end if;

  if p_debut is null or p_fin is null or p_fin <= p_debut then
    raise exception 'Plage horaire invalide : la fin doit suivre le début';
  end if;
  if p_debut < now() - interval '1 day' then
    raise exception 'Le rendez-vous ne peut pas commencer plus d''un jour dans le passé';
  end if;

  if exists (select 1 from public.crm_entretien_creneaux where demande_id = p_demande_id and choisi = true) then
    raise exception 'Un entretien est déjà confirmé pour cette demande';
  end if;

  insert into public.crm_entretien_creneaux (demande_id, debut, fin, choisi)
  values (p_demande_id, p_debut, p_fin, true);

  perform set_config('app.transition_client_via_rpc', 'on', true);
  perform public.crm_rpc_changer_statut(p_demande_id, 'entretien_planifie', 'Rendez-vous confirmé via Cal.com');
  perform set_config('app.transition_client_via_rpc', 'off', true);
end $$;

-- Droits inchangés (remise à l'état explicite, ne pas compter sur les droits par défaut).
revoke all on function public.crm_rpc_confirmer_reservation_calcom(uuid, timestamp with time zone, timestamp with time zone) from public, anon, authenticated;
grant execute on function public.crm_rpc_confirmer_reservation_calcom(uuid, timestamp with time zone, timestamp with time zone) to authenticated, service_role;
