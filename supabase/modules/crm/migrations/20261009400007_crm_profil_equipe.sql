-- =====================================================================
-- MODULE crm_ 7 : profil de la personne connectée, équipe et noms des personnes
-- L'application n'a plus de table de profils (crm_profils supprimée) : elle lit son profil, l'équipe et les
-- noms des personnes par ces fonctions. Les colonnes renvoyées gardent les noms que l'application utilise déjà
-- (user_id = identifiant de PERSONNE, nom = prénom et nom, role = admin, consultant ou client).
-- =====================================================================

-- Rôle d'une personne dans une organisation (aide interne, appelée par les fonctions ci-dessous).
create function public.crm_role_de(p_org uuid, p_personne uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when not public.app_module_actif(m.organisation_id, 'crm') then null
    when m.est_admin or exists (select 1 from public.app_droits d where d.organisation_id = m.organisation_id and d.personne_id = m.personne_id and d.role_code = 'crm_admin') then 'admin'
    when exists (select 1 from public.app_droits d where d.organisation_id = m.organisation_id and d.personne_id = m.personne_id and d.role_code = 'crm_consultant') then 'consultant'
    when exists (select 1 from public.app_droits d where d.organisation_id = m.organisation_id and d.personne_id = m.personne_id and d.role_code = 'crm_client') then 'client'
  end
  from public.app_membres m
  where m.organisation_id = p_org and m.personne_id = p_personne and m.statut = 'actif'
$$;

-- Profil de la personne connectée : une ligne par organisation où elle a un rôle du CRM.
-- L'application choisit l'organisation (celle de l'en-tête x-organisme, sinon l'unique ligne).
create function public.crm_rpc_mon_profil()
returns table (user_id uuid, nom text, email text, role text, organisation_id uuid, organisation_nom text)
language sql stable security definer set search_path = '' as $$
  select t.user_id, t.nom, t.email, t.role, t.organisation_id, t.organisation_nom
    from (
      select p.id as user_id,
             coalesce(nullif(btrim(concat_ws(' ', p.prenom, p.nom)), ''), p.email) as nom,
             p.email,
             public.crm_role_de(m.organisation_id, p.id) as role,
             m.organisation_id,
             o.nom as organisation_nom
        from public.app_personnes p
        join public.app_membres m on m.personne_id = p.id and m.statut = 'actif'
        join public.app_organisations o on o.id = m.organisation_id
       where p.id = public.app_personne_id()
         and coalesce(public.app_organisme_actif() = m.organisation_id, true)
    ) t
   where t.role is not null
   order by t.organisation_nom
$$;

-- Équipe de l'organisation courante (administrateurs et consultants), pour les listes de choix. Personnel seulement.
create function public.crm_rpc_equipe()
returns table (user_id uuid, nom text, email text, role text)
language sql stable security definer set search_path = '' as $$
  with org as (select public.crm_org_courante() as id)
  select p.id,
         coalesce(nullif(btrim(concat_ws(' ', p.prenom, p.nom)), ''), p.email),
         p.email,
         public.crm_role_de(m.organisation_id, p.id)
    from org
    join public.app_membres m on m.organisation_id = org.id and m.statut = 'actif'
    join public.app_personnes p on p.id = m.personne_id
   where public.crm_est_staff(org.id)
     and public.crm_role_de(m.organisation_id, p.id) in ('admin', 'consultant')
   order by p.email
$$;

-- Noms de personnes données (auteurs, responsables, membres d'une tâche...), pour le personnel, dans l'organisation courante.
create function public.crm_rpc_personnes(p_ids uuid[])
returns table (user_id uuid, nom text, email text, role text)
language sql stable security definer set search_path = '' as $$
  with org as (select public.crm_org_courante() as id)
  select p.id,
         coalesce(nullif(btrim(concat_ws(' ', p.prenom, p.nom)), ''), p.email),
         p.email,
         public.crm_role_de(m.organisation_id, p.id)
    from org
    join public.app_membres m on m.organisation_id = org.id and m.statut = 'actif'
    join public.app_personnes p on p.id = m.personne_id
   where p.id = any (p_ids) and public.crm_est_staff(org.id)
$$;

-- Comptes ayant un rôle du CRM dans l'organisation courante (page « Comptes »). Administrateur seulement.
create function public.crm_rpc_comptes()
returns table (user_id uuid, nom text, email text, role text)
language sql stable security definer set search_path = '' as $$
  with org as (select public.crm_org_courante() as id)
  select p.id,
         coalesce(nullif(btrim(concat_ws(' ', p.prenom, p.nom)), ''), p.email),
         p.email,
         public.crm_role_de(m.organisation_id, p.id)
    from org
    join public.app_membres m on m.organisation_id = org.id and m.statut = 'actif'
    join public.app_personnes p on p.id = m.personne_id
   where public.crm_est_admin(org.id)
     and public.crm_role_de(m.organisation_id, p.id) is not null
   order by p.email
$$;

-- Parmi des adresses e-mail, celles qui correspondent à un compte client de l'organisation courante (contacts qui peuvent déjà se connecter). Personnel seulement.
create function public.crm_rpc_emails_avec_compte(p_emails text[])
returns setof text
language sql stable security definer set search_path = '' as $$
  with org as (select public.crm_org_courante() as id)
  select distinct lower(p.email)
    from org
    join public.app_membres m on m.organisation_id = org.id and m.statut = 'actif'
    join public.app_personnes p on p.id = m.personne_id
   where public.crm_est_staff(org.id)
     and lower(p.email) = any (select lower(x) from unnest(p_emails) x)
     and public.crm_role_de(m.organisation_id, p.id) = 'client'
$$;

revoke all on function public.crm_role_de(uuid, uuid) from public, anon, authenticated;
revoke all on function public.crm_rpc_mon_profil(), public.crm_rpc_equipe(), public.crm_rpc_personnes(uuid[]), public.crm_rpc_comptes(), public.crm_rpc_emails_avec_compte(text[]) from public, anon;
grant execute on function public.crm_rpc_mon_profil(), public.crm_rpc_equipe(), public.crm_rpc_personnes(uuid[]), public.crm_rpc_comptes(), public.crm_rpc_emails_avec_compte(text[]) to authenticated, service_role;
