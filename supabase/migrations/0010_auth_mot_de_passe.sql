-- Passage du lien magique à l'e-mail + mot de passe temporaire -
-- 01_ARCHITECTURE.md section 8.1. Les comptes sont créés par l'Edge
-- Function creer-compte (service_role, jamais côté client) et marqués pour
-- changement de mot de passe obligatoire à la première connexion.

alter table profils add column if not exists doit_changer_mot_de_passe boolean not null default false;

-- Pas de politique RLS "chacun peut modifier sa ligne profils" : ça
-- permettrait à un client de modifier sa propre colonne role (élévation de
-- privilège). Seule cette RPC, qui ne touche qu'à une colonne fixe, permet
-- au titulaire de lever son propre indicateur.
create or replace function rpc_marquer_mot_de_passe_change()
returns void
language sql
security definer
set search_path = public
as $$
  update profils set doit_changer_mot_de_passe = false where user_id = auth.uid();
$$;

revoke all on function rpc_marquer_mot_de_passe_change() from public, anon, authenticated;
grant execute on function rpc_marquer_mot_de_passe_change() to authenticated;
