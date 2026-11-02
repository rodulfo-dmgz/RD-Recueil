-- Complète 0004 : PostgreSQL accorde EXECUTE à PUBLIC par défaut à la création
-- d'une fonction. "revoke ... from anon" seul ne suffit donc pas tant que
-- PUBLIC conserve le droit (l'advisor de sécurité Supabase le confirmait
-- toujours après 0004). On révoque PUBLIC puis on redonne explicitement le
-- droit à authenticated, seul rôle censé appeler ces RPC.

revoke execute on function rpc_changer_statut(uuid, text, text) from public;
revoke execute on function rpc_soumettre(uuid) from public;
revoke execute on function rpc_valider_cadrage(uuid) from public;

grant execute on function rpc_changer_statut(uuid, text, text) to authenticated;
grant execute on function rpc_soumettre(uuid) to authenticated;
grant execute on function rpc_valider_cadrage(uuid) to authenticated;
