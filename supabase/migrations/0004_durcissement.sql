-- Durcissement suite aux advisors de sécurité Supabase après application de
-- 0001/0002/0003 : search_path fixé sur toutes les fonctions, et exécution
-- via l'API REST révoquée pour les fonctions qui ne doivent être appelées
-- que par des triggers internes.

alter function fn_reference() set search_path = public;
alter function fn_touch() set search_path = public;
alter function fn_historiser_reponse() set search_path = public;
alter function est_staff() set search_path = public;
alter function a_acces(uuid) set search_path = public;
alter function client_peut_ecrire_reponse(uuid, text) set search_path = public;

-- fn_gerer_nouvel_utilisateur et fn_premiere_saisie ne sont appelées que par
-- leurs triggers respectifs (security definer) : aucun rôle ne doit pouvoir
-- les invoquer directement via /rest/v1/rpc/…
revoke execute on function fn_gerer_nouvel_utilisateur() from public, anon, authenticated;
revoke execute on function fn_premiere_saisie() from public, anon, authenticated;

-- Les RPC métier ne sont utiles qu'à un utilisateur authentifié (elles
-- vérifient auth.uid() en interne) : retrait de l'exécution par le rôle anon.
-- (Complété par 0005 : PUBLIC conservait le droit malgré ce revoke.)
revoke execute on function rpc_changer_statut(uuid, text, text) from anon;
revoke execute on function rpc_soumettre(uuid) from anon;
revoke execute on function rpc_valider_cadrage(uuid) from anon;
