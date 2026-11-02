-- =====================================================================
-- MODULE crm_ 4 : vues et declencheurs
-- Genere depuis supabase/migrations/20261007000000_crm_install.sql par le script de transformation, puis relu.
-- Cles etrangeres : seulement vers app_ et crm_. Aucune reference a un autre module.
-- =====================================================================

CREATE OR REPLACE VIEW public.crm_v_demandes_montants WITH (security_invoker=true) AS
 SELECT d.id AS demande_id,
    d.organisation_id,
    d.reference,
    d.client_id,
    d.statut,
    d.archivee,
    d.created_at,
    e.montant_estime,
    p.total AS montant_propose,
    p.statut AS proposition_statut,
        CASE
            WHEN COALESCE(p.total, 0::numeric) > 0::numeric THEN p.total
            ELSE COALESCE(e.montant_estime, 0::numeric)
        END AS montant_retenu,
        CASE
            WHEN COALESCE(p.total, 0::numeric) > 0::numeric THEN 'proposition'::text
            WHEN e.montant_estime IS NOT NULL THEN 'estimation'::text
            ELSE 'aucun'::text
        END AS source_montant,
        CASE
            WHEN d.statut = 'gagnee'::text THEN 100
            WHEN d.statut = ANY (ARRAY['perdue'::text, 'reorientee'::text, 'abandonnee'::text]) THEN 0
            ELSE COALESCE(e.probabilite::integer, ps.pourcentage::integer, 0)
        END AS probabilite,
    round(
        CASE
            WHEN COALESCE(p.total, 0::numeric) > 0::numeric THEN p.total
            ELSE COALESCE(e.montant_estime, 0::numeric)
        END *
        CASE
            WHEN d.statut = 'gagnee'::text THEN 100
            WHEN d.statut = ANY (ARRAY['perdue'::text, 'reorientee'::text, 'abandonnee'::text]) THEN 0
            ELSE COALESCE(e.probabilite::integer, ps.pourcentage::integer, 0)
        END::numeric / 100.0, 2) AS montant_pondere,
    p.decidee_le AS date_decision
   FROM crm_demandes d
     LEFT JOIN crm_demande_enjeux e ON e.demande_id = d.id
     LEFT JOIN crm_probabilites_statut ps ON ps.statut = d.statut AND ps.organisation_id = d.organisation_id
     LEFT JOIN LATERAL ( SELECT pr.statut,
            pr.decidee_le,
            COALESCE(sum(l.total), 0::numeric) AS total
           FROM crm_propositions pr
             LEFT JOIN crm_proposition_lignes l ON l.proposition_id = pr.id
          WHERE pr.demande_id = d.id
          GROUP BY pr.id) p ON true
  WHERE crm_est_staff(d.organisation_id);
CREATE OR REPLACE VIEW public.crm_v_clients WITH (security_invoker=true) AS
 SELECT id,
    raison_sociale,
    siret,
    created_at,
    nom_commercial,
    forme_juridique,
    code_naf,
    secteur,
    adresse,
    code_postal,
    ville,
    telephone,
    email_general,
    site_web,
    effectif,
    opco,
    source,
    statut,
    responsable_id,
    notes,
    updated_at,
    ( SELECT count(*) AS count
           FROM crm_demandes d
          WHERE d.client_id = c.id AND NOT d.archivee) AS nb_demandes,
    ( SELECT count(*) AS count
           FROM crm_demandes d
          WHERE d.client_id = c.id AND NOT d.archivee AND (d.statut <> ALL (ARRAY['gagnee'::text, 'perdue'::text, 'reorientee'::text, 'abandonnee'::text]))) AS nb_actives,
    ( SELECT count(*) AS count
           FROM crm_demandes d
          WHERE d.client_id = c.id AND d.statut = 'gagnee'::text) AS nb_gagnees,
    GREATEST(updated_at, ( SELECT max(d.updated_at) AS max
           FROM crm_demandes d
          WHERE d.client_id = c.id), ( SELECT max(a.date_activite) AS max
           FROM crm_activites a
          WHERE a.client_id = c.id)) AS derniere_activite,
    ( SELECT NULLIF(TRIM(BOTH FROM concat_ws(' '::text, k.prenom, k.nom)), ''::text) AS "nullif"
           FROM crm_contacts k
          WHERE k.client_id = c.id AND k.principal
         LIMIT 1) AS contact_principal,
    ( SELECT count(*) AS count
           FROM crm_taches t
          WHERE t.client_id = c.id AND (t.statut = ANY (ARRAY['a_faire'::text, 'en_cours'::text, 'a_reviser'::text]))) AS nb_taches_ouvertes,
    ( SELECT min(t.echeance) AS min
           FROM crm_taches t
          WHERE t.client_id = c.id AND (t.statut = ANY (ARRAY['a_faire'::text, 'en_cours'::text, 'a_reviser'::text]))) AS prochaine_echeance,
    ( SELECT COALESCE(sum(m.montant_retenu), 0::numeric) AS "coalesce"
           FROM crm_v_demandes_montants m
          WHERE m.client_id = c.id AND m.statut = 'gagnee'::text) AS ca_signe,
    ( SELECT COALESCE(sum(m.montant_pondere), 0::numeric) AS "coalesce"
           FROM crm_v_demandes_montants m
          WHERE m.client_id = c.id AND NOT m.archivee AND (m.statut <> ALL (ARRAY['gagnee'::text, 'perdue'::text, 'reorientee'::text, 'abandonnee'::text]))) AS pipeline_pondere
   FROM crm_clients c;
CREATE OR REPLACE VIEW public.crm_v_reponses_client WITH (security_invoker=true) AS
 SELECT demande_id,
    question_id,
    valeur,
    nsp,
    saisi_par,
    updated_at
   FROM crm_reponses;

CREATE TRIGGER trg_audit_activites AFTER INSERT OR DELETE OR UPDATE ON public.crm_activites FOR EACH ROW EXECUTE FUNCTION crm_fn_audit();
CREATE TRIGGER trg_audit_clients AFTER INSERT OR DELETE OR UPDATE ON public.crm_clients FOR EACH ROW EXECUTE FUNCTION crm_fn_audit();
CREATE TRIGGER trg_clients_attribuer BEFORE INSERT ON public.crm_clients FOR EACH ROW EXECUTE FUNCTION crm_fn_attribuer_client();
CREATE TRIGGER trg_clients_proteger_assignation BEFORE UPDATE ON public.crm_clients FOR EACH ROW EXECUTE FUNCTION crm_fn_proteger_assignation_client();
CREATE TRIGGER trg_clients_touch BEFORE UPDATE ON public.crm_clients FOR EACH ROW EXECUTE FUNCTION crm_fn_touch();
CREATE TRIGGER trg_audit_consentements AFTER INSERT OR DELETE OR UPDATE ON public.crm_consentements FOR EACH ROW EXECUTE FUNCTION crm_fn_audit();
CREATE TRIGGER trg_consentements_maj BEFORE INSERT OR UPDATE ON public.crm_consentements FOR EACH ROW EXECUTE FUNCTION crm_fn_consentement_maj();
CREATE TRIGGER trg_audit_contacts AFTER INSERT OR DELETE OR UPDATE ON public.crm_contacts FOR EACH ROW EXECUTE FUNCTION crm_fn_audit();
CREATE TRIGGER trg_contacts_touch BEFORE UPDATE ON public.crm_contacts FOR EACH ROW EXECUTE FUNCTION crm_fn_touch();
CREATE TRIGGER trg_audit_demande_enjeux AFTER INSERT OR DELETE OR UPDATE ON public.crm_demande_enjeux FOR EACH ROW EXECUTE FUNCTION crm_fn_audit();
CREATE TRIGGER trg_demande_enjeux_touch BEFORE UPDATE ON public.crm_demande_enjeux FOR EACH ROW EXECUTE FUNCTION crm_fn_touch();
CREATE TRIGGER trg_audit_demandes AFTER INSERT OR DELETE OR UPDATE ON public.crm_demandes FOR EACH ROW EXECUTE FUNCTION crm_fn_audit();
CREATE TRIGGER trg_demandes_attribuer BEFORE INSERT ON public.crm_demandes FOR EACH ROW EXECUTE FUNCTION crm_fn_attribuer_demande();
CREATE TRIGGER trg_demandes_proteger_assignation BEFORE UPDATE ON public.crm_demandes FOR EACH ROW EXECUTE FUNCTION crm_fn_proteger_assignation_demande();
CREATE TRIGGER trg_demandes_reference BEFORE INSERT ON public.crm_demandes FOR EACH ROW EXECUTE FUNCTION crm_fn_reference();
CREATE TRIGGER trg_demandes_touch BEFORE UPDATE ON public.crm_demandes FOR EACH ROW EXECUTE FUNCTION crm_fn_touch();
CREATE TRIGGER trg_notifier_evenement AFTER INSERT ON public.crm_evenements FOR EACH ROW EXECUTE FUNCTION crm_fn_notifier_evenement();
CREATE TRIGGER trg_audit_factures AFTER INSERT OR DELETE OR UPDATE ON public.crm_factures FOR EACH ROW EXECUTE FUNCTION crm_fn_audit();
CREATE TRIGGER trg_factures_touch BEFORE UPDATE ON public.crm_factures FOR EACH ROW EXECUTE FUNCTION crm_fn_touch();
CREATE TRIGGER trg_audit_financements AFTER INSERT OR DELETE OR UPDATE ON public.crm_financements FOR EACH ROW EXECUTE FUNCTION crm_fn_audit();
CREATE TRIGGER trg_financements_touch BEFORE UPDATE ON public.crm_financements FOR EACH ROW EXECUTE FUNCTION crm_fn_touch();
CREATE TRIGGER trg_audit_reclamations AFTER INSERT OR DELETE OR UPDATE ON public.crm_reclamations FOR EACH ROW EXECUTE FUNCTION crm_fn_audit();
CREATE TRIGGER trg_reclamations_maj BEFORE INSERT OR UPDATE ON public.crm_reclamations FOR EACH ROW EXECUTE FUNCTION crm_fn_reclamation_maj();
CREATE TRIGGER trg_reponses_historique AFTER UPDATE ON public.crm_reponses FOR EACH ROW EXECUTE FUNCTION crm_fn_historiser_reponse();
CREATE TRIGGER trg_reponses_premiere_saisie AFTER INSERT ON public.crm_reponses FOR EACH ROW EXECUTE FUNCTION crm_fn_premiere_saisie();
CREATE TRIGGER trg_reponses_touch BEFORE UPDATE ON public.crm_reponses FOR EACH ROW EXECUTE FUNCTION crm_fn_touch();
CREATE TRIGGER trg_audit_satisfactions AFTER INSERT OR DELETE OR UPDATE ON public.crm_satisfactions FOR EACH ROW EXECUTE FUNCTION crm_fn_audit();
CREATE TRIGGER trg_satisfactions_maj BEFORE INSERT OR UPDATE ON public.crm_satisfactions FOR EACH ROW EXECUTE FUNCTION crm_fn_satisfaction_maj();
CREATE TRIGGER trg_satisfactions_notifier AFTER INSERT ON public.crm_satisfactions FOR EACH ROW EXECUTE FUNCTION crm_fn_notifier_satisfaction();
CREATE TRIGGER trg_notifier_membre_tache AFTER INSERT ON public.crm_tache_membres FOR EACH ROW EXECUTE FUNCTION crm_fn_notifier_membre_tache();
CREATE TRIGGER trg_audit_taches AFTER INSERT OR DELETE OR UPDATE ON public.crm_taches FOR EACH ROW EXECUTE FUNCTION crm_fn_audit();
CREATE TRIGGER trg_notifier_tache AFTER INSERT OR UPDATE OF assignee_id ON public.crm_taches FOR EACH ROW EXECUTE FUNCTION crm_fn_notifier_tache();
CREATE TRIGGER trg_taches_maj BEFORE UPDATE ON public.crm_taches FOR EACH ROW EXECUTE FUNCTION crm_fn_tache_maj();
CREATE TRIGGER trg_vues_enregistrees_touch BEFORE UPDATE ON public.crm_vues_enregistrees FOR EACH ROW EXECUTE FUNCTION crm_fn_touch();

CREATE TRIGGER a0_org_defaut BEFORE INSERT ON public.crm_activites FOR EACH ROW EXECUTE FUNCTION public.crm_fn_org_defaut('demande_id', 'crm_demandes', 'client_id', 'crm_clients', 'contact_id', 'crm_contacts');
CREATE TRIGGER a1_meme_organisation_1 BEFORE INSERT OR UPDATE ON public.crm_activites FOR EACH ROW EXECUTE FUNCTION app_private.verifier_meme_organisation('demande_id', 'crm_demandes');
CREATE TRIGGER a1_meme_organisation_2 BEFORE INSERT OR UPDATE ON public.crm_activites FOR EACH ROW EXECUTE FUNCTION app_private.verifier_meme_organisation('client_id', 'crm_clients');
CREATE TRIGGER a1_meme_organisation_3 BEFORE INSERT OR UPDATE ON public.crm_activites FOR EACH ROW EXECUTE FUNCTION app_private.verifier_meme_organisation('contact_id', 'crm_contacts');
CREATE TRIGGER a0_org_defaut BEFORE INSERT ON public.crm_audit_log FOR EACH ROW EXECUTE FUNCTION public.crm_fn_org_defaut();
CREATE TRIGGER a0_org_defaut BEFORE INSERT ON public.crm_clients FOR EACH ROW EXECUTE FUNCTION public.crm_fn_org_defaut();
CREATE TRIGGER a0_org_defaut BEFORE INSERT ON public.crm_commentaires FOR EACH ROW EXECUTE FUNCTION public.crm_fn_org_defaut('demande_id', 'crm_demandes');
CREATE TRIGGER a1_meme_organisation_1 BEFORE INSERT OR UPDATE ON public.crm_commentaires FOR EACH ROW EXECUTE FUNCTION app_private.verifier_meme_organisation('demande_id', 'crm_demandes');
CREATE TRIGGER a0_org_defaut BEFORE INSERT ON public.crm_consentements FOR EACH ROW EXECUTE FUNCTION public.crm_fn_org_defaut('contact_id', 'crm_contacts');
CREATE TRIGGER a1_meme_organisation_1 BEFORE INSERT OR UPDATE ON public.crm_consentements FOR EACH ROW EXECUTE FUNCTION app_private.verifier_meme_organisation('contact_id', 'crm_contacts');
CREATE TRIGGER a0_org_defaut BEFORE INSERT ON public.crm_contacts FOR EACH ROW EXECUTE FUNCTION public.crm_fn_org_defaut('client_id', 'crm_clients');
CREATE TRIGGER a1_meme_organisation_1 BEFORE INSERT OR UPDATE ON public.crm_contacts FOR EACH ROW EXECUTE FUNCTION app_private.verifier_meme_organisation('client_id', 'crm_clients');
CREATE TRIGGER a0_org_defaut BEFORE INSERT ON public.crm_demande_acces FOR EACH ROW EXECUTE FUNCTION public.crm_fn_org_defaut('demande_id', 'crm_demandes');
CREATE TRIGGER a1_meme_organisation_1 BEFORE INSERT OR UPDATE ON public.crm_demande_acces FOR EACH ROW EXECUTE FUNCTION app_private.verifier_meme_organisation('demande_id', 'crm_demandes');
CREATE TRIGGER a0_org_defaut BEFORE INSERT ON public.crm_demande_enjeux FOR EACH ROW EXECUTE FUNCTION public.crm_fn_org_defaut('demande_id', 'crm_demandes');
CREATE TRIGGER a1_meme_organisation_1 BEFORE INSERT OR UPDATE ON public.crm_demande_enjeux FOR EACH ROW EXECUTE FUNCTION app_private.verifier_meme_organisation('demande_id', 'crm_demandes');
CREATE TRIGGER a0_org_defaut BEFORE INSERT ON public.crm_demandes FOR EACH ROW EXECUTE FUNCTION public.crm_fn_org_defaut('client_id', 'crm_clients');
CREATE TRIGGER a1_meme_organisation_1 BEFORE INSERT OR UPDATE ON public.crm_demandes FOR EACH ROW EXECUTE FUNCTION app_private.verifier_meme_organisation('client_id', 'crm_clients');
CREATE TRIGGER a0_org_defaut BEFORE INSERT ON public.crm_doublons_ignores FOR EACH ROW EXECUTE FUNCTION public.crm_fn_org_defaut('client_a', 'crm_clients', 'client_b', 'crm_clients');
CREATE TRIGGER a1_meme_organisation_1 BEFORE INSERT OR UPDATE ON public.crm_doublons_ignores FOR EACH ROW EXECUTE FUNCTION app_private.verifier_meme_organisation('client_a', 'crm_clients');
CREATE TRIGGER a1_meme_organisation_2 BEFORE INSERT OR UPDATE ON public.crm_doublons_ignores FOR EACH ROW EXECUTE FUNCTION app_private.verifier_meme_organisation('client_b', 'crm_clients');
CREATE TRIGGER a0_org_defaut BEFORE INSERT ON public.crm_entretien_creneaux FOR EACH ROW EXECUTE FUNCTION public.crm_fn_org_defaut('demande_id', 'crm_demandes');
CREATE TRIGGER a1_meme_organisation_1 BEFORE INSERT OR UPDATE ON public.crm_entretien_creneaux FOR EACH ROW EXECUTE FUNCTION app_private.verifier_meme_organisation('demande_id', 'crm_demandes');
CREATE TRIGGER a0_org_defaut BEFORE INSERT ON public.crm_evenements FOR EACH ROW EXECUTE FUNCTION public.crm_fn_org_defaut('demande_id', 'crm_demandes');
CREATE TRIGGER a1_meme_organisation_1 BEFORE INSERT OR UPDATE ON public.crm_evenements FOR EACH ROW EXECUTE FUNCTION app_private.verifier_meme_organisation('demande_id', 'crm_demandes');
CREATE TRIGGER a0_org_defaut BEFORE INSERT ON public.crm_factures FOR EACH ROW EXECUTE FUNCTION public.crm_fn_org_defaut('demande_id', 'crm_demandes');
CREATE TRIGGER a1_meme_organisation_1 BEFORE INSERT OR UPDATE ON public.crm_factures FOR EACH ROW EXECUTE FUNCTION app_private.verifier_meme_organisation('demande_id', 'crm_demandes');
CREATE TRIGGER a0_org_defaut BEFORE INSERT ON public.crm_fichiers FOR EACH ROW EXECUTE FUNCTION public.crm_fn_org_defaut('demande_id', 'crm_demandes');
CREATE TRIGGER a1_meme_organisation_1 BEFORE INSERT OR UPDATE ON public.crm_fichiers FOR EACH ROW EXECUTE FUNCTION app_private.verifier_meme_organisation('demande_id', 'crm_demandes');
CREATE TRIGGER a0_org_defaut BEFORE INSERT ON public.crm_financements FOR EACH ROW EXECUTE FUNCTION public.crm_fn_org_defaut('demande_id', 'crm_demandes');
CREATE TRIGGER a1_meme_organisation_1 BEFORE INSERT OR UPDATE ON public.crm_financements FOR EACH ROW EXECUTE FUNCTION app_private.verifier_meme_organisation('demande_id', 'crm_demandes');
CREATE TRIGGER a0_org_defaut BEFORE INSERT ON public.crm_notes_cadrage FOR EACH ROW EXECUTE FUNCTION public.crm_fn_org_defaut('demande_id', 'crm_demandes');
CREATE TRIGGER a1_meme_organisation_1 BEFORE INSERT OR UPDATE ON public.crm_notes_cadrage FOR EACH ROW EXECUTE FUNCTION app_private.verifier_meme_organisation('demande_id', 'crm_demandes');
CREATE TRIGGER a0_org_defaut BEFORE INSERT ON public.crm_notifications FOR EACH ROW EXECUTE FUNCTION public.crm_fn_org_defaut('demande_id', 'crm_demandes');
CREATE TRIGGER a1_meme_organisation_1 BEFORE INSERT OR UPDATE ON public.crm_notifications FOR EACH ROW EXECUTE FUNCTION app_private.verifier_meme_organisation('demande_id', 'crm_demandes');
CREATE TRIGGER a0_org_defaut BEFORE INSERT ON public.crm_probabilites_statut FOR EACH ROW EXECUTE FUNCTION public.crm_fn_org_defaut();
CREATE TRIGGER a0_org_defaut BEFORE INSERT ON public.crm_proposition_lignes FOR EACH ROW EXECUTE FUNCTION public.crm_fn_org_defaut('proposition_id', 'crm_propositions');
CREATE TRIGGER a1_meme_organisation_1 BEFORE INSERT OR UPDATE ON public.crm_proposition_lignes FOR EACH ROW EXECUTE FUNCTION app_private.verifier_meme_organisation('proposition_id', 'crm_propositions');
CREATE TRIGGER a0_org_defaut BEFORE INSERT ON public.crm_propositions FOR EACH ROW EXECUTE FUNCTION public.crm_fn_org_defaut('demande_id', 'crm_demandes');
CREATE TRIGGER a1_meme_organisation_1 BEFORE INSERT OR UPDATE ON public.crm_propositions FOR EACH ROW EXECUTE FUNCTION app_private.verifier_meme_organisation('demande_id', 'crm_demandes');
CREATE TRIGGER a0_org_defaut BEFORE INSERT ON public.crm_reclamations FOR EACH ROW EXECUTE FUNCTION public.crm_fn_org_defaut('demande_id', 'crm_demandes', 'client_id', 'crm_clients');
CREATE TRIGGER a1_meme_organisation_1 BEFORE INSERT OR UPDATE ON public.crm_reclamations FOR EACH ROW EXECUTE FUNCTION app_private.verifier_meme_organisation('demande_id', 'crm_demandes');
CREATE TRIGGER a1_meme_organisation_2 BEFORE INSERT OR UPDATE ON public.crm_reclamations FOR EACH ROW EXECUTE FUNCTION app_private.verifier_meme_organisation('client_id', 'crm_clients');
CREATE TRIGGER a0_org_defaut BEFORE INSERT ON public.crm_reponses FOR EACH ROW EXECUTE FUNCTION public.crm_fn_org_defaut('demande_id', 'crm_demandes');
CREATE TRIGGER a1_meme_organisation_1 BEFORE INSERT OR UPDATE ON public.crm_reponses FOR EACH ROW EXECUTE FUNCTION app_private.verifier_meme_organisation('demande_id', 'crm_demandes');
CREATE TRIGGER a0_org_defaut BEFORE INSERT ON public.crm_reponses_historique FOR EACH ROW EXECUTE FUNCTION public.crm_fn_org_defaut();
CREATE TRIGGER a0_org_defaut BEFORE INSERT ON public.crm_satisfactions FOR EACH ROW EXECUTE FUNCTION public.crm_fn_org_defaut('demande_id', 'crm_demandes', 'client_id', 'crm_clients');
CREATE TRIGGER a1_meme_organisation_1 BEFORE INSERT OR UPDATE ON public.crm_satisfactions FOR EACH ROW EXECUTE FUNCTION app_private.verifier_meme_organisation('demande_id', 'crm_demandes');
CREATE TRIGGER a1_meme_organisation_2 BEFORE INSERT OR UPDATE ON public.crm_satisfactions FOR EACH ROW EXECUTE FUNCTION app_private.verifier_meme_organisation('client_id', 'crm_clients');
CREATE TRIGGER a0_org_defaut BEFORE INSERT ON public.crm_tache_membres FOR EACH ROW EXECUTE FUNCTION public.crm_fn_org_defaut('tache_id', 'crm_taches');
CREATE TRIGGER a1_meme_organisation_1 BEFORE INSERT OR UPDATE ON public.crm_tache_membres FOR EACH ROW EXECUTE FUNCTION app_private.verifier_meme_organisation('tache_id', 'crm_taches');
CREATE TRIGGER a0_org_defaut BEFORE INSERT ON public.crm_tache_pieces_jointes FOR EACH ROW EXECUTE FUNCTION public.crm_fn_org_defaut('tache_id', 'crm_taches');
CREATE TRIGGER a1_meme_organisation_1 BEFORE INSERT OR UPDATE ON public.crm_tache_pieces_jointes FOR EACH ROW EXECUTE FUNCTION app_private.verifier_meme_organisation('tache_id', 'crm_taches');
CREATE TRIGGER a0_org_defaut BEFORE INSERT ON public.crm_taches FOR EACH ROW EXECUTE FUNCTION public.crm_fn_org_defaut('demande_id', 'crm_demandes', 'client_id', 'crm_clients', 'contact_id', 'crm_contacts');
CREATE TRIGGER a1_meme_organisation_1 BEFORE INSERT OR UPDATE ON public.crm_taches FOR EACH ROW EXECUTE FUNCTION app_private.verifier_meme_organisation('demande_id', 'crm_demandes');
CREATE TRIGGER a1_meme_organisation_2 BEFORE INSERT OR UPDATE ON public.crm_taches FOR EACH ROW EXECUTE FUNCTION app_private.verifier_meme_organisation('client_id', 'crm_clients');
CREATE TRIGGER a1_meme_organisation_3 BEFORE INSERT OR UPDATE ON public.crm_taches FOR EACH ROW EXECUTE FUNCTION app_private.verifier_meme_organisation('contact_id', 'crm_contacts');
CREATE TRIGGER a0_org_defaut BEFORE INSERT ON public.crm_vues_enregistrees FOR EACH ROW EXECUTE FUNCTION public.crm_fn_org_defaut();

-- ---------- Intégrité des signatures ----------
-- Une décision ou une signature ne s'enregistre que par les fonctions prévues (drapeau de transaction
-- app.signature_via_rpc posé par crm_rpc_accepter_proposition, crm_rpc_refuser_proposition,
-- crm_rpc_valider_cadrage, crm_rpc_demander_modification). Un document signé ou refusé ne bouge plus.
create function public.crm_fn_proteger_proposition()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_via boolean := coalesce(current_setting('app.signature_via_rpc', true), '') = 'on';
begin
  if tg_op = 'DELETE' then
    if old.statut in ('acceptee', 'refusee') then
      raise exception 'Une proposition signée ou refusée ne se supprime pas';
    end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    if new.statut <> 'brouillon' or new.decidee_le is not null or new.decidee_par is not null
       or new.signature_image is not null or new.signature_credential is not null or new.commentaire_client is not null then
      raise exception 'Une proposition se crée en brouillon, sans décision ni signature';
    end if;
    return new;
  end if;
  if old.statut in ('acceptee', 'refusee') then
    raise exception 'Une proposition signée ou refusée ne se modifie plus';
  end if;
  if not v_via and (new.decidee_le is distinct from old.decidee_le or new.decidee_par is distinct from old.decidee_par
       or new.signature_image is distinct from old.signature_image or new.signature_credential is distinct from old.signature_credential
       or new.commentaire_client is distinct from old.commentaire_client
       or (new.statut is distinct from old.statut and not (old.statut = 'brouillon' and new.statut = 'envoyee'))) then
    raise exception 'La décision et la signature ne s''enregistrent que par les fonctions prévues';
  end if;
  if old.statut <> 'brouillon' and (new.justification_md is distinct from old.justification_md or new.envoyee_le is distinct from old.envoyee_le) then
    raise exception 'Une proposition envoyée ne se modifie plus';
  end if;
  return new;
end $$;
create trigger b0_proteger before insert or update or delete on public.crm_propositions for each row execute function public.crm_fn_proteger_proposition();

create function public.crm_fn_proteger_lignes()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_statut text;
begin
  select statut into v_statut from public.crm_propositions where id = coalesce(new.proposition_id, old.proposition_id);
  if v_statut is not null and v_statut <> 'brouillon' then
    raise exception 'Les lignes d''une proposition envoyée ne se modifient plus';
  end if;
  return coalesce(new, old);
end $$;
create trigger b0_proteger before insert or update or delete on public.crm_proposition_lignes for each row execute function public.crm_fn_proteger_lignes();

create function public.crm_fn_proteger_note()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_via boolean := coalesce(current_setting('app.signature_via_rpc', true), '') = 'on';
begin
  if tg_op = 'DELETE' then
    if old.statut <> 'brouillon' then
      raise exception 'Une note envoyée ou signée ne se supprime pas';
    end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    if new.statut <> 'brouillon' or new.validee_le is not null or new.validee_par is not null or new.validation_ip is not null
       or new.signature_image is not null or new.signature_credential is not null then
      raise exception 'Une note se crée en brouillon, sans validation ni signature';
    end if;
    return new;
  end if;
  if old.statut = 'validee' then
    raise exception 'Une note validée ne se modifie plus';
  end if;
  if not v_via and (new.validee_le is distinct from old.validee_le or new.validee_par is distinct from old.validee_par
       or new.validation_ip is distinct from old.validation_ip or new.signature_image is distinct from old.signature_image
       or new.signature_credential is distinct from old.signature_credential
       or (new.statut is distinct from old.statut and not (old.statut = 'brouillon' and new.statut = 'envoyee'))) then
    raise exception 'La validation et la signature ne s''enregistrent que par les fonctions prévues';
  end if;
  if old.statut <> 'brouillon' and (new.contenu_md is distinct from old.contenu_md or new.envoyee_le is distinct from old.envoyee_le) then
    raise exception 'Une note envoyée ne se modifie plus : créez une nouvelle version';
  end if;
  return new;
end $$;
create trigger b0_proteger before insert or update or delete on public.crm_notes_cadrage for each row execute function public.crm_fn_proteger_note();

revoke all on function public.crm_fn_proteger_proposition(), public.crm_fn_proteger_lignes(), public.crm_fn_proteger_note() from public, anon, authenticated;
