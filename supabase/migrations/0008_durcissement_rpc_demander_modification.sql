-- Complète 0007 : le premier revoke ne s'était pas appliqué de façon fiable
-- (PUBLIC conservait le droit, même constat qu'en 0005). Revoke explicite de
-- tous les rôles avant de ne redonner l'exécution qu'à authenticated.

revoke all on function rpc_demander_modification(uuid, text) from public, anon, authenticated;
grant execute on function rpc_demander_modification(uuid, text) to authenticated;
