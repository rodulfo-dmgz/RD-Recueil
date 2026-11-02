-- =====================================================================
-- MODULE crm_ 1 : enregistrement, rôles, organisation courante et aides de droits
-- Genere depuis supabase/migrations/20261007000000_crm_install.sql par le script de transformation, puis relu.
-- Cles etrangeres : seulement vers app_ et crm_. Aucune reference a un autre module.
-- =====================================================================


-- ---------- Enregistrement et rôles ----------
insert into public.app_modules (code, nom, version) values ('crm', 'Relation client et recueil de besoins', '1');

insert into public.app_roles (code, module_code, libelle, description, ordre) values
  ('crm_admin',      'crm', 'Administrateur du CRM', 'Tout, sur tous les clients et toutes les demandes de l''organisation ; attribue les demandes ; voit factures et journal d''audit', 10),
  ('crm_consultant', 'crm', 'Consultant',            'Voit et traite les demandes qui lui sont attribuées et les clients dont il est responsable ou qui y sont liés', 20),
  ('crm_client',     'crm', 'Client',                'Accède uniquement aux demandes auxquelles il est invité (table crm_demande_acces) ; remplit le questionnaire, signe la note de cadrage et la proposition', 30);

-- ---------- Organisation courante ----------
-- Organisation de la personne connectée : celle choisie par l'application (en-tête x-organisme), sinon son
-- unique organisation avec le module actif. Plusieurs organisations sans choix : erreur explicite.
create function public.crm_org_courante()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare
  v_actif uuid := public.app_organisme_actif();
  v_orgs uuid[];
begin
  if v_actif is not null then
    return v_actif;
  end if;
  select array_agg(m.organisation_id) into v_orgs
    from public.app_membres m
   where m.personne_id = public.app_personne_id() and m.statut = 'actif' and public.app_module_actif(m.organisation_id, 'crm');
  if v_orgs is null then
    return null;
  end if;
  if array_length(v_orgs, 1) > 1 then
    raise exception 'plusieurs organisations possibles : choisissez-en une (en-tête x-organisme)' using errcode = 'check_violation';
  end if;
  return v_orgs[1];
end $$;

-- Renseigne organisation_id à l'insertion : celui du premier parent trouvé (colonne, table), sinon l'organisation courante.
-- Arguments du déclencheur : couples ('colonne_parent', 'table_parent'). Un parent d'une autre organisation est refusé
-- ensuite par app_private.verifier_meme_organisation.
create function public.crm_fn_org_defaut()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  v_ref uuid;
  i int := 0;
begin
  if new.organisation_id is not null then
    return new;
  end if;
  while i + 1 < tg_nargs loop
    v_ref := nullif(to_jsonb(new) ->> tg_argv[i], '')::uuid;
    if v_ref is not null then
      execute format('select organisation_id from public.%I where id = $1', tg_argv[i + 1]) into v_org using v_ref;
      exit when v_org is not null;
    end if;
    i := i + 2;
  end loop;
  new.organisation_id := coalesce(v_org, public.crm_org_courante());
  return new;
end $$;

-- ---------- Aides de droits (remplacent crm_est_admin() et crm_est_staff() du CRM autonome) ----------
create function public.crm_est_admin(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.app_has_role(p_org, array['crm_admin'])
$$;

create function public.crm_est_staff(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.app_has_role(p_org, array['crm_admin', 'crm_consultant'])
$$;

-- Vrai si la personne connectée tient un rôle du CRM (ou administre l'organisation) dans une organisation où le module est actif.
create function public.crm_a_acces_module()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.app_membres m
     where m.personne_id = public.app_personne_id() and m.statut = 'actif'
       and coalesce(public.app_organisme_actif() = m.organisation_id, true)
       and public.app_module_actif(m.organisation_id, 'crm')
       and (m.est_admin or exists (
             select 1 from public.app_droits d
              where d.organisation_id = m.organisation_id and d.personne_id = m.personne_id
                and d.role_code in ('crm_admin', 'crm_consultant', 'crm_client'))))
$$;

-- Idem, réservé au personnel (administrateur d'organisation, crm_admin, crm_consultant) : lecture complète du questionnaire.
create function public.crm_a_acces_staff_module()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.app_membres m
     where m.personne_id = public.app_personne_id() and m.statut = 'actif'
       and coalesce(public.app_organisme_actif() = m.organisation_id, true)
       and public.app_module_actif(m.organisation_id, 'crm')
       and (m.est_admin or exists (
             select 1 from public.app_droits d
              where d.organisation_id = m.organisation_id and d.personne_id = m.personne_id
                and d.role_code in ('crm_admin', 'crm_consultant'))))
$$;

create function public.crm_est_mon_email(p_email text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_email is not null and exists (
    select 1 from public.app_personnes where id = public.app_personne_id() and email = lower(p_email))
$$;

-- La personne est membre actif de l'organisation et consultant, administrateur du CRM ou administrateur d'organisation.
create function public.crm_personne_est_staff(p_org uuid, p_personne uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.app_membres m
     where m.organisation_id = p_org and m.personne_id = p_personne and m.statut = 'actif'
       and (m.est_admin or exists (
             select 1 from public.app_droits d
              where d.organisation_id = m.organisation_id and d.personne_id = m.personne_id
                and d.role_code in ('crm_admin', 'crm_consultant'))))
$$;

-- Version appelée par les politiques : l'appelant doit lui-même être membre de l'organisation.
create function public.crm_membre_staff_valide(p_org uuid, p_personne uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.app_est_membre(p_org) and public.crm_personne_est_staff(p_org, p_personne)
$$;

-- Administrateurs du CRM d'une organisation (administrateurs d'organisation compris).
create function public.crm_ids_admins(p_org uuid)
returns setof uuid language sql stable security definer set search_path = '' as $$
  select m.personne_id from public.app_membres m
   where m.organisation_id = p_org and m.statut = 'actif'
     and (m.est_admin or exists (
           select 1 from public.app_droits d
            where d.organisation_id = m.organisation_id and d.personne_id = m.personne_id and d.role_code = 'crm_admin'))
$$;

-- Destinataires des notifications « équipe » : administrateurs + consultant de la demande.
create function public.crm_destinataires_staff(p_org uuid, p_consultant uuid)
returns setof uuid language sql stable security definer set search_path = '' as $$
  select public.crm_ids_admins(p_org)
  union
  select p_consultant where p_consultant is not null and public.crm_personne_est_staff(p_org, p_consultant)
$$;

-- Code de vérification d'une signature : 12 chiffres tirés de gen_random_uuid() (générateur sécurisé), format NNNNNN-NNNNNN.
create function public.crm_code_verification()
returns text language sql volatile set search_path = '' as $$
  select lpad((('x' || substr(gen_random_uuid()::text, 1, 8))::bit(32)::bigint % 1000000)::text, 6, '0')
      || '-' || lpad((('x' || substr(gen_random_uuid()::text, 1, 8))::bit(32)::bigint % 1000000)::text, 6, '0')
$$;
revoke all on function public.crm_code_verification() from public, anon, authenticated;

-- ---------- Amorçage à l'activation du module pour une organisation ----------
create function app_private.crm_amorcer_organisation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.module_code = 'crm' and new.est_actif then
    insert into public.crm_probabilites_statut (organisation_id, statut, pourcentage) values
      (new.organisation_id, 'brouillon', 5), (new.organisation_id, 'envoyee', 10), (new.organisation_id, 'en_saisie', 15),
      (new.organisation_id, 'soumise', 25), (new.organisation_id, 'entretien_planifie', 35), (new.organisation_id, 'en_analyse', 45),
      (new.organisation_id, 'cadrage_envoye', 55), (new.organisation_id, 'cadrage_a_revoir', 50), (new.organisation_id, 'cadrage_valide', 65),
      (new.organisation_id, 'proposition_envoyee', 75), (new.organisation_id, 'gagnee', 100), (new.organisation_id, 'perdue', 0),
      (new.organisation_id, 'reorientee', 0), (new.organisation_id, 'abandonnee', 0)
    on conflict (organisation_id, statut) do nothing;
  end if;
  return null;
end $$;
create trigger crm_amorcer after insert or update on public.app_organisation_modules for each row execute function app_private.crm_amorcer_organisation();
revoke all on function app_private.crm_amorcer_organisation() from public, anon, authenticated;

-- Droits : les aides sont appelées par les politiques, donc par authenticated.
revoke all on function public.crm_org_courante(), public.crm_fn_org_defaut(), public.crm_est_admin(uuid), public.crm_est_staff(uuid),
  public.crm_a_acces_module(), public.crm_a_acces_staff_module(), public.crm_est_mon_email(text), public.crm_personne_est_staff(uuid, uuid),
  public.crm_membre_staff_valide(uuid, uuid), public.crm_ids_admins(uuid), public.crm_destinataires_staff(uuid, uuid) from public, anon;
-- Appelées par les politiques (donc par authenticated). Les aides internes (crm_personne_est_staff, crm_ids_admins,
-- crm_destinataires_staff) ne sont appelées que par des fonctions security definer : pas de droit pour l'API.
grant execute on function public.crm_org_courante(), public.crm_est_admin(uuid), public.crm_est_staff(uuid),
  public.crm_a_acces_module(), public.crm_a_acces_staff_module(), public.crm_est_mon_email(text), public.crm_membre_staff_valide(uuid, uuid) to authenticated;
-- Retirer, pas seulement ne pas accorder : les droits par défaut de Supabase donnent l'exécution à authenticated.
revoke all on function public.crm_personne_est_staff(uuid, uuid), public.crm_ids_admins(uuid), public.crm_destinataires_staff(uuid, uuid), public.crm_fn_org_defaut() from authenticated;
