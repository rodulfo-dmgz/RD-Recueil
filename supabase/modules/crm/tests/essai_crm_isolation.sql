-- =====================================================================
-- ESSAI DU MODULE crm_ : rôles, isolation entre deux organisations, parcours complet d'une demande jusqu'à la
-- signature du devis, événements émis, notifications et journal.
-- À exécuter APRÈS les migrations du noyau et de crm, dans la MÊME transaction, et à annuler
-- (fin par « raise exception 'RESULTATS … »). Lanceur : supabase/outils/essai_local.js --modules crm
-- =====================================================================
create function pg_temp.moi(p_uid uuid, p_role text default 'authenticated')
returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', p_role)::text, true);
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  perform set_config('request.jwt.claim.role', p_role, true);
  execute format('set local role %I', p_role);
end $$;

-- Nombre de lignes renvoyées par une requête, sous le rôle courant.
create function pg_temp.nb(p_sql text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute 'select count(*) from (' || p_sql || ') t' into n;
  return n;
end $$;

-- Vrai si l'instruction est refusée (erreur ou aucune ligne touchée).
create function pg_temp.refuse(p_sql text) returns boolean language plpgsql as $$
declare n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n = 0;
exception when others then
  return true;
end $$;

do $essai$
declare
  res text[] := '{}';
  n bigint;
  org_a uuid := gen_random_uuid();
  org_b uuid := gen_random_uuid();
  u_adm uuid := gen_random_uuid(); u_c1 uuid := gen_random_uuid(); u_c2 uuid := gen_random_uuid();
  u_cli uuid := gen_random_uuid(); u_out uuid := gen_random_uuid(); u_admb uuid := gen_random_uuid(); u_clib uuid := gen_random_uuid();
  p_adm uuid; p_c1 uuid; p_c2 uuid; p_cli uuid; p_out uuid; p_admb uuid; p_clib uuid;
  v_cl uuid; v_cl2 uuid; v_dem uuid; v_ref text; v_note uuid; v_prop uuid; v_statut text; v_tot numeric; v_org uuid;
  v_ok boolean; v_dem2 uuid; v_prop2 uuid; v_dem3 uuid; v_dem4 uuid;
  u_lec uuid := gen_random_uuid(); p_lec uuid;
begin
  -- ---------- Mise en place (propriétaire de la base) ----------
  insert into public.app_organisations (id, nom) values (org_a, 'Organisme A'), (org_b, 'Organisme B');
  insert into auth.users (id, email, aud, role)
  select x, x::text || '@test.fr', 'authenticated', 'authenticated' from unnest(array[u_adm, u_c1, u_c2, u_cli, u_out, u_admb, u_clib]) x;
  insert into public.app_personnes (auth_user_id, email, nom, prenom) values (u_adm, 'adm@test.fr', 'Adm', 'A') returning id into p_adm;
  insert into public.app_personnes (auth_user_id, email, nom, prenom) values (u_c1, 'c1@test.fr', 'Un', 'Consultant') returning id into p_c1;
  insert into public.app_personnes (auth_user_id, email, nom, prenom) values (u_c2, 'c2@test.fr', 'Deux', 'Consultant') returning id into p_c2;
  insert into public.app_personnes (auth_user_id, email, nom, prenom) values (u_cli, 'cli@test.fr', 'Client', 'A') returning id into p_cli;
  insert into public.app_personnes (auth_user_id, email, nom, prenom) values (u_out, 'out@test.fr', 'Hors', 'CRM') returning id into p_out;
  insert into public.app_personnes (auth_user_id, email, nom, prenom) values (u_admb, 'admb@test.fr', 'Adm', 'B') returning id into p_admb;
  insert into public.app_personnes (auth_user_id, email, nom, prenom) values (u_clib, 'clib@test.fr', 'Client', 'B') returning id into p_clib;
  insert into auth.users (id, email, aud, role) values (u_lec, 'lec@test.fr', 'authenticated', 'authenticated');
  insert into public.app_personnes (auth_user_id, email, nom, prenom) values (u_lec, 'lec@test.fr', 'Lecteur', 'A') returning id into p_lec;
  insert into public.app_membres (organisation_id, personne_id, est_admin) values
    (org_a, p_adm, true), (org_a, p_c1, false), (org_a, p_c2, false), (org_a, p_cli, false), (org_a, p_out, false),
    (org_b, p_admb, true), (org_b, p_clib, false), (org_a, p_lec, false);
  insert into public.app_organisation_modules (organisation_id, module_code) values (org_a, 'crm'), (org_b, 'crm');
  insert into public.app_droits (organisation_id, personne_id, role_code) values
    (org_a, p_c1, 'crm_consultant'), (org_a, p_c2, 'crm_consultant'), (org_a, p_cli, 'crm_client'), (org_b, p_clib, 'crm_client'), (org_a, p_lec, 'crm_client');
  -- Questionnaire minimal (en production : supabase/modules/crm/seed/seed_v1.sql)
  insert into public.crm_questionnaires (id, statut, source_hash) values ('v1', 'publie', 'essai');
  insert into public.crm_sections (questionnaire_id, id, partie, titre, ordre) values ('v1', 'TC-0', 1, 'Cadrage', 1), ('v1', 'ANA', 3, 'Analyse', 2);
  update public.crm_sections set visible_client = false where questionnaire_id = 'v1' and id = 'ANA';
  insert into public.crm_questions (questionnaire_id, id, section_id, ordre, libelle, type, obligatoire, rempli_par) values
    ('v1', 'TC-0.02', 'TC-0', 1, 'Décrivez votre demande', 'texte_long', true, 'C'),
    ('v1', 'ANA.03', 'ANA', 1, 'Reformulation', 'texte_long', true, 'F');

  -- ---------- R1 : module, rôles, amorçage ----------
  select count(*) into n from public.app_roles where module_code = 'crm';
  res := res || (case when n = 3 then 'OK' else 'ÉCHEC' end || ' R1a trois rôles crm_ enregistrés : ' || n);
  select count(*) into n from public.crm_probabilites_statut where organisation_id in (org_a, org_b);
  res := res || (case when n = 28 then 'OK' else 'ÉCHEC' end || ' R1b probabilités créées à l''activation, 14 par organisation : ' || n);

  -- Liste exacte des fonctions crm_ appelables par un utilisateur connecté (les droits par défaut de Supabase donnent
  -- l'exécution à authenticated : il faut retirer, pas seulement ne pas accorder).
  select count(*) into n from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname like 'crm\_%' and has_function_privilege('authenticated', p.oid, 'execute')
     and p.proname <> all (array[
       'crm_a_acces', 'crm_a_acces_module', 'crm_a_acces_staff_module', 'crm_acces_demande', 'crm_client_peut_ecrire_reponse',
       'crm_est_admin', 'crm_est_membre_tache', 'crm_est_mon_email', 'crm_est_staff', 'crm_membre_staff_valide', 'crm_org_courante',
       'crm_peut_voir_client', 'crm_peut_voir_demande', 'crm_peut_voir_tache', 'crm_peut_voir_tache_chemin',
       'crm_rpc_accepter_proposition', 'crm_rpc_archiver_demande', 'crm_rpc_assigner_demande', 'crm_rpc_changer_statut',
       'crm_rpc_confirmer_reservation_calcom', 'crm_rpc_demander_modification', 'crm_rpc_deposer_reclamation', 'crm_rpc_fusionner_clients',
       'crm_rpc_jalons', 'crm_rpc_mes_reclamations', 'crm_rpc_refuser_proposition', 'crm_rpc_repondre_satisfaction', 'crm_rpc_soumettre',
       'crm_rpc_valider_cadrage', 'crm_rpc_mon_profil', 'crm_rpc_equipe', 'crm_rpc_personnes', 'crm_rpc_comptes', 'crm_rpc_emails_avec_compte']);
  res := res || (case when n = 0 then 'OK' else 'ÉCHEC' end || ' R1c seules les aides de politiques et les 14 crm_rpc_* sont appelables par un utilisateur connecté (fonctions en trop : ' || n || ')');

  -- Fonctions du schéma privé propres au module (hors noyau) : jamais appelables par anon ni authenticated.
  select count(*) into n from pg_proc p
   where p.pronamespace = 'app_private'::regnamespace and p.proname like 'crm\_%'
     and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'));
  res := res || (case when n = 0 then 'OK' else 'ÉCHEC' end || ' R1d aucune fonction app_private.crm_* appelable par anon ou authenticated : ' || n);
  select count(*) into n from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname like 'crm\_%' and has_function_privilege('anon', p.oid, 'execute');
  res := res || (case when n = 0 then 'OK' else 'ÉCHEC' end || ' R1e aucune fonction crm_ appelable par anon : ' || n);

  -- ---------- R2 : création sous l'organisation courante ----------
  perform pg_temp.moi(u_adm);
  insert into public.crm_clients (raison_sociale, siret) values ('ACME', '13053306000013') returning id, organisation_id into v_cl, v_org;
  res := res || (case when v_org = org_a then 'OK' else 'ÉCHEC' end || ' R2a un client créé sans organisation reçoit celle de l''administrateur');
  insert into public.crm_demandes (client_id, questionnaire_id, types, consultant_id) values (v_cl, 'v1', array['FOR'], p_c1)
    returning id, reference, organisation_id into v_dem, v_ref, v_org;
  res := res || (case when v_org = org_a and v_ref ~ '^RDF-\d{4}-\d{4}$' then 'OK' else 'ÉCHEC' end || ' R2b demande : organisation du client héritée, référence automatique ' || v_ref);
  res := res || (case when pg_temp.refuse(format('update public.crm_demandes set organisation_id = %L where id = %L', org_b, v_dem)) then 'OK' else 'ÉCHEC' end || ' R2c on ne déplace pas une demande vers une autre organisation');
  res := res || (case when pg_temp.refuse(format('insert into public.crm_activites (client_id, organisation_id, type, objet) values (%L, %L, ''note'', ''x'')', v_cl, org_b)) then 'OK' else 'ÉCHEC' end || ' R2d une activité ne vise pas un client d''une autre organisation');

  -- ---------- R3 : isolation entre organisations et entre rôles ----------
  perform pg_temp.moi(u_admb);
  res := res || (case when pg_temp.nb('select 1 from public.crm_clients') = 0 and pg_temp.nb('select 1 from public.crm_demandes') = 0 then 'OK' else 'ÉCHEC' end || ' R3a l''administrateur de B ne voit rien de A');
  res := res || (case when pg_temp.refuse(format('insert into public.crm_clients (organisation_id, raison_sociale) values (%L, ''Intrus'')', org_a)) then 'OK' else 'ÉCHEC' end || ' R3b l''administrateur de B ne crée rien chez A');
  res := res || (case when pg_temp.refuse(format('select public.crm_rpc_changer_statut(%L, ''envoyee'')', v_dem)) then 'OK' else 'ÉCHEC' end || ' R3c ni ne change le statut d''une demande de A');
  perform pg_temp.moi(u_c1);
  res := res || (case when pg_temp.nb('select 1 from public.crm_demandes') = 1 and pg_temp.nb('select 1 from public.crm_clients') = 1 then 'OK' else 'ÉCHEC' end || ' R3d le consultant attribué voit sa demande et son client');
  perform pg_temp.moi(u_c2);
  res := res || (case when pg_temp.nb('select 1 from public.crm_demandes') = 0 and pg_temp.nb('select 1 from public.crm_clients') = 0 then 'OK' else 'ÉCHEC' end || ' R3e l''autre consultant de A ne voit ni la demande ni le client');
  perform pg_temp.moi(u_out);
  res := res || (case when pg_temp.nb('select 1 from public.crm_demandes') = 0 and pg_temp.nb('select 1 from public.crm_clients') = 0 and pg_temp.nb('select 1 from public.crm_questions') = 0 then 'OK' else 'ÉCHEC' end || ' R3f un membre sans rôle crm_ ne voit rien (questionnaire compris)');
  perform pg_temp.moi(u_c1);
  res := res || (case when pg_temp.refuse(format('update public.crm_demandes set consultant_id = %L where id = %L', p_c2, v_dem)) then 'OK' else 'ÉCHEC' end || ' R3g un consultant ne se défait pas lui-même d''une demande');
  res := res || (case when pg_temp.refuse(format('insert into public.crm_factures (demande_id, montant_ht) values (%L, 100)', v_dem)) then 'OK' else 'ÉCHEC' end || ' R3h un consultant n''écrit pas de facture');
  res := res || (case when pg_temp.nb('select 1 from public.crm_audit_log') = 0 then 'OK' else 'ÉCHEC' end || ' R3i ni ne lit le journal d''audit');

  -- ---------- R4 : invitation et accès du client ----------
  perform pg_temp.moi(u_adm);
  insert into public.crm_demande_acces (demande_id, email, droit) values (v_dem, 'cli@test.fr', 'editeur'), (v_dem, 'out@test.fr', 'editeur');
  perform pg_temp.moi(u_cli);
  res := res || (case when pg_temp.nb('select 1 from public.crm_demandes') = 1 and pg_temp.nb('select 1 from public.crm_clients') = 0 then 'OK' else 'ÉCHEC' end || ' R4a le client invité (par e-mail) voit la demande mais pas la fiche client');
  perform pg_temp.moi(u_out);
  res := res || (case when pg_temp.nb('select 1 from public.crm_demandes') = 0 then 'OK' else 'ÉCHEC' end || ' R4b une invitation ne suffit pas sans le droit crm_client');
  perform pg_temp.moi(u_clib);
  res := res || (case when pg_temp.nb('select 1 from public.crm_demandes') = 0 then 'OK' else 'ÉCHEC' end || ' R4c un client de B ne voit pas la demande de A');
  perform pg_temp.moi(u_cli);
  res := res || (case when pg_temp.refuse(format('update public.crm_demandes set statut = ''gagnee'' where id = %L', v_dem)) then 'OK' else 'ÉCHEC' end || ' R4d un client ne change pas le statut directement');

  -- Le questionnaire n'est pas ouvert à tout le monde : le client ne lit que ce qui lui est destiné.
  perform pg_temp.moi(u_cli);
  res := res || (case when pg_temp.nb('select 1 from public.crm_sections') = 1 and pg_temp.nb('select 1 from public.crm_questions') = 1 and pg_temp.nb('select 1 from public.crm_sections where id = ''ANA''') = 0 and pg_temp.nb('select 1 from public.crm_questions where section_id = ''ANA''') = 0 then 'OK' else 'ÉCHEC' end || ' R4e un client ne lit pas une section ni des questions réservées au personnel (visible_client = false)');
  perform pg_temp.moi(u_c1);
  res := res || (case when pg_temp.nb('select 1 from public.crm_sections') = 2 and pg_temp.nb('select 1 from public.crm_questions') = 2 then 'OK' else 'ÉCHEC' end || ' R4f le consultant lit tout le questionnaire');
  perform pg_temp.moi(u_cli);
  res := res || (case when pg_temp.refuse('select public.crm_ids_admins(gen_random_uuid())') and pg_temp.refuse('select public.crm_personne_est_staff(gen_random_uuid(), gen_random_uuid())') and pg_temp.refuse('select public.crm_peut_signer(gen_random_uuid())') then 'OK' else 'ÉCHEC' end || ' R4g les aides internes ne sont pas appelables par l''API');

  -- ---------- R5 : parcours complet, de la création à la signature du devis ----------
  perform pg_temp.moi(u_c1);
  perform public.crm_rpc_changer_statut(v_dem, 'envoyee');
  perform pg_temp.moi(u_cli);
  insert into public.crm_reponses (demande_id, question_id, valeur, saisi_par) values (v_dem, 'TC-0.02', '"Besoin de formation"'::jsonb, p_cli);
  select statut into v_statut from public.crm_demandes where id = v_dem;
  res := res || (case when v_statut = 'en_saisie' then 'OK' else 'ÉCHEC' end || ' R5a la première réponse du client passe la demande en saisie : ' || v_statut);
  res := res || (case when pg_temp.refuse(format('insert into public.crm_reponses (demande_id, question_id, valeur) values (%L, ''ANA.03'', ''"x"''::jsonb)', v_dem)) then 'OK' else 'ÉCHEC' end || ' R5b le client n''écrit pas une question réservée au consultant');
  perform public.crm_rpc_soumettre(v_dem, array['TC-0.02']);
  perform public.crm_rpc_confirmer_reservation_calcom(v_dem, now() + interval '2 days', now() + interval '2 days 1 hour');
  select statut into v_statut from public.crm_demandes where id = v_dem;
  res := res || (case when v_statut = 'entretien_planifie' then 'OK' else 'ÉCHEC' end || ' R5c réponses envoyées puis entretien réservé : ' || v_statut);
  perform pg_temp.moi(u_c1);
  perform public.crm_rpc_changer_statut(v_dem, 'en_analyse');
  insert into public.crm_notes_cadrage (demande_id, version, contenu_md, statut) values (v_dem, 1, '# Note', 'brouillon') returning id into v_note;
  update public.crm_notes_cadrage set statut = 'envoyee', envoyee_le = now() where id = v_note;
  perform public.crm_rpc_changer_statut(v_dem, 'cadrage_envoye');
  perform pg_temp.moi(u_cli);
  perform public.crm_rpc_valider_cadrage(v_note, 'data:image/png;base64,AAAA');
  select statut into v_statut from public.crm_demandes where id = v_dem;
  res := res || (case when v_statut = 'cadrage_valide' then 'OK' else 'ÉCHEC' end || ' R5d le client signe la note de cadrage : ' || v_statut);
  perform pg_temp.moi(u_c1);
  insert into public.crm_propositions (demande_id) values (v_dem) returning id into v_prop;
  insert into public.crm_proposition_lignes (proposition_id, ordre, designation, quantite, prix_unitaire) values (v_prop, 0, 'Conception', 2, 500), (v_prop, 1, 'Animation', 3, 400);
  update public.crm_propositions set statut = 'envoyee', envoyee_le = now() where id = v_prop;
  perform public.crm_rpc_changer_statut(v_dem, 'proposition_envoyee');
  select sum(total) into v_tot from public.crm_proposition_lignes where proposition_id = v_prop;
  res := res || (case when v_tot = 2200 then 'OK' else 'ÉCHEC' end || ' R5e le devis totalise ses lignes : ' || v_tot);
  perform pg_temp.moi(u_cli);
  perform public.crm_rpc_accepter_proposition(v_prop, 'data:image/png;base64,BBBB');
  select statut into v_statut from public.crm_demandes where id = v_dem;
  res := res || (case when v_statut = 'gagnee' then 'OK' else 'ÉCHEC' end || ' R5f le client signe le devis : ' || v_statut);
  perform pg_temp.moi(u_c1);
  select count(*) into n from public.crm_propositions where id = v_prop and statut = 'acceptee' and signature_credential ~ '^\d{6}-\d{6}$';
  res := res || (case when n = 1 then 'OK' else 'ÉCHEC' end || ' R5g signature enregistrée avec son code de vérification');

  -- ---------- R6 : montants, notifications, événements, journal ----------
  select count(*) into n from public.crm_v_demandes_montants where demande_id = v_dem and montant_retenu = 2200 and probabilite = 100 and organisation_id = org_a;
  res := res || (case when n = 1 then 'OK' else 'ÉCHEC' end || ' R6a vue des montants : 2 200 € à 100 % pour le staff');
  perform pg_temp.moi(u_cli);
  res := res || (case when pg_temp.nb('select 1 from public.crm_v_demandes_montants') = 0 then 'OK' else 'ÉCHEC' end || ' R6b invisible pour le client');
  perform pg_temp.moi(u_adm);
  res := res || (case when pg_temp.nb('select 1 from public.crm_notifications') >= 3 then 'OK' else 'ÉCHEC' end || ' R6c l''administrateur est notifié des étapes (soumission, signatures)');
  perform pg_temp.moi(u_cli);
  res := res || (case when pg_temp.nb('select 1 from public.crm_notifications where type in (''cadrage_envoye'', ''proposition_envoyee'')') = 2 then 'OK' else 'ÉCHEC' end || ' R6d le client est notifié de la note et du devis envoyés');
  perform pg_temp.moi(u_admb);
  res := res || (case when pg_temp.nb('select 1 from public.crm_notifications') = 0 and pg_temp.nb('select 1 from public.crm_audit_log') = 0 then 'OK' else 'ÉCHEC' end || ' R6e rien ne fuit vers l''organisation B');
  perform pg_temp.moi(u_adm);
  res := res || (case when pg_temp.nb('select 1 from public.crm_audit_log where organisation_id is not null') >= 3 and pg_temp.nb(format('select 1 from public.crm_audit_log where organisation_id <> %L', org_a)) = 0 then 'OK' else 'ÉCHEC' end || ' R6f journal d''audit rattaché à l''organisation');
  reset role;
  select count(*) into n from public.app_evenements where sujet = 'crm.devis.signe' and organisation_id = org_a;
  res := res || (case when n = 1 then 'OK' else 'ÉCHEC' end || ' R6g événement crm.devis.signe émis, sans montant');
  select count(*) into n from public.app_evenements where sujet = 'crm.devis.signe' and donnees::text ~* 'montant|prix|total';
  res := res || (case when n = 0 then 'OK' else 'ÉCHEC' end || ' R6h aucun montant dans les événements');
  select count(*) into n from public.app_evenements where sujet = 'crm.demande.statut_change' and organisation_id = org_a;
  res := res || (case when n = 9 then 'OK' else 'ÉCHEC' end || ' R6i un événement par changement de statut, y compris la première saisie (attendu 9) : ' || n);
  select count(*) into n from public.app_evenements where organisation_id = org_b and sujet like 'crm.%';
  res := res || (case when n = 0 then 'OK' else 'ÉCHEC' end || ' R6j aucun événement crm pour l''organisation B');

  -- ---------- R7 : administration ----------
  perform pg_temp.moi(u_adm);
  perform public.crm_rpc_assigner_demande(v_dem, p_c2);
  perform pg_temp.moi(u_c2);
  res := res || (case when pg_temp.nb('select 1 from public.crm_demandes') = 1 then 'OK' else 'ÉCHEC' end || ' R7a l''administrateur réattribue la demande, le nouveau consultant la voit');
  perform pg_temp.moi(u_c1);
  res := res || (case when pg_temp.nb('select 1 from public.crm_demandes') = 0 then 'OK' else 'ÉCHEC' end || ' R7b l''ancien consultant ne la voit plus');
  perform pg_temp.moi(u_adm);
  res := res || (case when pg_temp.refuse(format('select public.crm_rpc_assigner_demande(%L, %L)', v_dem, p_out)) then 'OK' else 'ÉCHEC' end || ' R7c on n''attribue pas une demande à quelqu''un sans rôle crm_');
  insert into public.crm_clients (raison_sociale) values ('ACME bis') returning id into v_cl2;
  perform public.crm_rpc_fusionner_clients(v_cl, v_cl2);
  res := res || (case when pg_temp.nb(format('select 1 from public.crm_clients where id = %L', v_cl2)) = 0 then 'OK' else 'ÉCHEC' end || ' R7d fusion de deux clients de la même organisation');
  perform pg_temp.moi(u_admb);
  res := res || (case when pg_temp.refuse(format('select public.crm_rpc_fusionner_clients(%L, %L)', v_cl, v_cl)) then 'OK' else 'ÉCHEC' end || ' R7e l''administrateur de B ne fusionne pas les clients de A');

  -- ---------- R9 : intégrité des documents signés ----------
  -- Le devis et la note de la première demande sont signés : plus rien ne les modifie, pas même le personnel.
  perform pg_temp.moi(u_adm);
  res := res || (case when pg_temp.refuse(format('update public.crm_propositions set justification_md = ''modifiée'' where id = %L', v_prop)) then 'OK' else 'ÉCHEC' end || ' R9a un devis signé ne se modifie plus');
  res := res || (case when pg_temp.refuse(format('update public.crm_propositions set statut = ''refusee'' where id = %L', v_prop)) and pg_temp.refuse(format('update public.crm_propositions set signature_credential = ''000000-000000'' where id = %L', v_prop)) then 'OK' else 'ÉCHEC' end || ' R9b ni son statut ni son code de vérification');
  res := res || (case when pg_temp.refuse(format('delete from public.crm_propositions where id = %L', v_prop)) and pg_temp.refuse(format('insert into public.crm_proposition_lignes (proposition_id, designation, quantite, prix_unitaire) values (%L, ''Ajout'', 1, 1)', v_prop)) and pg_temp.refuse(format('delete from public.crm_proposition_lignes where proposition_id = %L', v_prop)) then 'OK' else 'ÉCHEC' end || ' R9c ni sa suppression ni ses lignes');
  res := res || (case when pg_temp.refuse(format('update public.crm_notes_cadrage set signature_image = ''data:image/png;base64,ZZZZ'' where id = %L', v_note)) and pg_temp.refuse(format('update public.crm_notes_cadrage set contenu_md = ''autre'' where id = %L', v_note)) and pg_temp.refuse(format('delete from public.crm_notes_cadrage where id = %L', v_note)) then 'OK' else 'ÉCHEC' end || ' R9d une note validée non plus');
  res := res || (case when pg_temp.refuse(format('insert into public.crm_propositions (demande_id, statut, signature_image) values (%L, ''acceptee'', ''data:image/png;base64,XX'')', v_dem)) then 'OK' else 'ÉCHEC' end || ' R9e on ne crée pas un devis déjà signé');
  perform pg_temp.moi(u_cli);
  res := res || (case when pg_temp.refuse(format('select public.crm_rpc_accepter_proposition(%L, ''data:image/png;base64,CCCC'')', v_prop)) and pg_temp.refuse(format('select public.crm_rpc_refuser_proposition(%L, ''non'')', v_prop)) then 'OK' else 'ÉCHEC' end || ' R9f le client ne re-signe ni ne refuse un devis déjà signé');
  res := res || (case when pg_temp.refuse(format('select public.crm_rpc_valider_cadrage(%L, ''data:image/png;base64,CCCC'')', v_note)) then 'OK' else 'ÉCHEC' end || ' R9g ni ne re-signe une note validée');
  -- Seconde demande : un devis en brouillon, puis envoyé.
  perform pg_temp.moi(u_adm);
  insert into public.crm_demandes (client_id, questionnaire_id, types, consultant_id) values (v_cl, 'v1', array['FOR'], p_c2) returning id into v_dem2;
  insert into public.crm_demande_acces (demande_id, email) values (v_dem2, 'cli@test.fr');
  insert into public.crm_demande_acces (demande_id, email, droit) values (v_dem2, 'lec@test.fr', 'lecteur');
  insert into public.crm_propositions (demande_id) values (v_dem2) returning id into v_prop2;
  res := res || (case when pg_temp.refuse(format('update public.crm_propositions set statut = ''acceptee'' where id = %L', v_prop2)) and pg_temp.refuse(format('update public.crm_propositions set signature_image = ''data:image/png;base64,XX'' where id = %L', v_prop2)) then 'OK' else 'ÉCHEC' end || ' R9h le personnel ne marque pas lui-même un devis comme accepté ni ne dépose de signature');
  perform pg_temp.moi(u_cli);
  res := res || (case when pg_temp.refuse(format('select public.crm_rpc_accepter_proposition(%L, ''data:image/png;base64,CCCC'')', v_prop2)) then 'OK' else 'ÉCHEC' end || ' R9i le client ne signe pas un devis encore en brouillon');
  perform pg_temp.moi(u_c2);
  res := res || (case when pg_temp.refuse(format('select public.crm_rpc_accepter_proposition(%L, ''data:image/png;base64,CCCC'')', v_prop2)) then 'OK' else 'ÉCHEC' end || ' R9j le consultant ne signe pas à la place du client');
  perform pg_temp.moi(u_adm);
  update public.crm_propositions set statut = 'envoyee', envoyee_le = now() where id = v_prop2;
  update public.crm_demandes set statut = 'proposition_envoyee' where id = v_dem2;
  perform pg_temp.moi(u_adm);
  res := res || (case when pg_temp.refuse(format('select public.crm_rpc_accepter_proposition(%L, ''data:image/png;base64,CCCC'')', v_prop2)) then 'OK' else 'ÉCHEC' end || ' R9k ni l''administrateur');
  res := res || (case when pg_temp.refuse(format('update public.crm_propositions set justification_md = ''changé après envoi'' where id = %L', v_prop2)) then 'OK' else 'ÉCHEC' end || ' R9l un devis envoyé ne change plus de contenu');
  perform pg_temp.moi(u_lec);
  res := res || (case when pg_temp.nb('select 1 from public.crm_demandes') = 1 then 'OK' else 'ÉCHEC' end || ' R9p un invité en lecture seule voit la demande');
  res := res || (case when pg_temp.refuse(format('select public.crm_rpc_accepter_proposition(%L, ''data:image/png;base64,CCCC'')', v_prop2)) and pg_temp.refuse(format('select public.crm_rpc_refuser_proposition(%L, ''non'')', v_prop2)) then 'OK' else 'ÉCHEC' end || ' R9q mais ne signe ni ne refuse le devis');
  perform pg_temp.moi(u_adm);
  res := res || (case when pg_temp.refuse(format('update public.crm_propositions set envoyee_le = now() - interval ''30 days'' where id = %L', v_prop2)) then 'OK' else 'ÉCHEC' end || ' R9r la date d''envoi d''un devis envoyé ne se change plus');
  perform pg_temp.moi(u_cli);
  res := res || (case when pg_temp.refuse(format('select public.crm_rpc_accepter_proposition(%L, ''pas une image'')', v_prop2)) then 'OK' else 'ÉCHEC' end || ' R9m une signature qui n''est pas une image est refusée');
  perform public.crm_rpc_accepter_proposition(v_prop2, 'data:image/png;base64,DDDD');
  perform pg_temp.moi(u_adm);
  select count(*) into n from public.crm_propositions where id = v_prop2 and statut = 'acceptee' and signature_credential ~ '^\d{6}-\d{6}$' and decidee_par = p_cli;
  res := res || (case when n = 1 then 'OK' else 'ÉCHEC' end || ' R9n le client invité signe un devis envoyé : signataire et code enregistrés');
  res := res || (case when pg_temp.refuse(format('select public.crm_rpc_accepter_proposition(%L, ''data:image/png;base64,EEEE'')', v_prop2)) then 'OK' else 'ÉCHEC' end || ' R9o et personne ne signe une seconde fois');

  -- ---------- R10 : réservation de l'entretien ----------
  perform pg_temp.moi(u_adm);
  insert into public.crm_demandes (client_id, questionnaire_id, types, consultant_id) values (v_cl, 'v1', array['FOR'], p_c1) returning id into v_dem3;
  insert into public.crm_demandes (client_id, questionnaire_id, types, consultant_id) values (v_cl, 'v1', array['FOR'], p_c1) returning id into v_dem4;
  insert into public.crm_demande_acces (demande_id, email, droit) values (v_dem3, 'cli@test.fr', 'editeur'), (v_dem3, 'lec@test.fr', 'lecteur');
  reset role;
  update public.crm_demandes set statut = 'soumise' where id in (v_dem3, v_dem4);
  perform pg_temp.moi(u_lec);
  res := res || (case when pg_temp.refuse(format('select public.crm_rpc_confirmer_reservation_calcom(%L, now() + interval ''2 days'', now() + interval ''2 days 1 hour'')', v_dem3)) then 'OK' else 'ÉCHEC' end || ' R10a un invité en lecture seule ne réserve pas l''entretien');
  perform pg_temp.moi(u_cli);
  res := res || (case when pg_temp.refuse(format('select public.crm_rpc_confirmer_reservation_calcom(%L, now() + interval ''2 days 1 hour'', now() + interval ''2 days'')', v_dem3)) and pg_temp.refuse(format('select public.crm_rpc_confirmer_reservation_calcom(%L, now() + interval ''2 days'', now() + interval ''2 days'')', v_dem3)) then 'OK' else 'ÉCHEC' end || ' R10b une plage inversée ou nulle est refusée');
  res := res || (case when pg_temp.refuse(format('select public.crm_rpc_confirmer_reservation_calcom(%L, now() - interval ''3 days'', now() - interval ''3 days'' + interval ''1 hour'')', v_dem3)) then 'OK' else 'ÉCHEC' end || ' R10c un début plus ancien qu''un jour est refusé');
  res := res || (case when pg_temp.refuse(format('select public.crm_rpc_confirmer_reservation_calcom(%L, now() + interval ''2 days'', now() + interval ''2 days 1 hour'')', v_dem2)) then 'OK' else 'ÉCHEC' end || ' R10d et l''état de la demande reste contrôlé (pas de réservation hors état soumise)');
  perform public.crm_rpc_confirmer_reservation_calcom(v_dem3, now() + interval '2 days', now() + interval '2 days 1 hour');
  perform pg_temp.moi(u_adm);
  select statut into v_statut from public.crm_demandes where id = v_dem3;
  res := res || (case when v_statut = 'entretien_planifie' and pg_temp.nb(format('select 1 from public.crm_entretien_creneaux where demande_id = %L and choisi', v_dem3)) = 1 then 'OK' else 'ÉCHEC' end || ' R10e le client invité (editeur) réserve : créneau enregistré, demande en entretien planifié');
  perform pg_temp.moi(u_cli);
  res := res || (case when pg_temp.refuse(format('select public.crm_rpc_confirmer_reservation_calcom(%L, now() + interval ''3 days'', now() + interval ''3 days 1 hour'')', v_dem3)) then 'OK' else 'ÉCHEC' end || ' R10f pas de seconde réservation');
  perform pg_temp.moi(u_c1);
  perform public.crm_rpc_confirmer_reservation_calcom(v_dem4, now() + interval '1 day', now() + interval '1 day 1 hour');
  perform pg_temp.moi(u_adm);
  select statut into v_statut from public.crm_demandes where id = v_dem4;
  res := res || (case when v_statut = 'entretien_planifie' then 'OK' else 'ÉCHEC' end || ' R10g le consultant de la demande peut réserver pour son client');
  perform pg_temp.moi(u_admb);
  res := res || (case when pg_temp.refuse(format('select public.crm_rpc_confirmer_reservation_calcom(%L, now() + interval ''2 days'', now() + interval ''2 days 1 hour'')', v_dem4)) then 'OK' else 'ÉCHEC' end || ' R10h l''administrateur d''une autre organisation ne réserve rien');

  -- ---------- R11 : profil, équipe et noms des personnes ----------
  perform pg_temp.moi(u_c1);
  res := res || (case when pg_temp.nb(format('select 1 from public.crm_rpc_mon_profil() where role = ''consultant'' and organisation_id = %L and user_id = %L', org_a, p_c1)) = 1 and pg_temp.nb('select 1 from public.crm_rpc_mon_profil()') = 1 then 'OK' else 'ÉCHEC' end || ' R11a le consultant lit son profil : un rôle, une organisation');
  perform pg_temp.moi(u_cli);
  res := res || (case when pg_temp.nb('select 1 from public.crm_rpc_mon_profil() where role = ''client''') = 1 then 'OK' else 'ÉCHEC' end || ' R11b le client lit son profil');
  perform pg_temp.moi(u_adm);
  res := res || (case when pg_temp.nb('select 1 from public.crm_rpc_mon_profil() where role = ''admin''') = 1 then 'OK' else 'ÉCHEC' end || ' R11c l''administrateur d''organisation est administrateur du CRM');
  perform pg_temp.moi(u_out);
  res := res || (case when pg_temp.nb('select 1 from public.crm_rpc_mon_profil()') = 0 then 'OK' else 'ÉCHEC' end || ' R11d un membre sans rôle crm_ n''a pas de profil CRM');
  perform pg_temp.moi(u_c1);
  res := res || (case when pg_temp.nb('select 1 from public.crm_rpc_equipe()') = 3 and pg_temp.nb('select 1 from public.crm_rpc_equipe() where role = ''consultant''') = 2 then 'OK' else 'ÉCHEC' end || ' R11e l''équipe (administrateur et 2 consultants) est lisible par le personnel');
  res := res || (case when pg_temp.nb(format('select 1 from public.crm_rpc_personnes(array[%L, %L]::uuid[])', p_c2, p_adm)) = 2 and pg_temp.nb(format('select 1 from public.crm_rpc_personnes(array[%L]::uuid[])', p_admb)) = 0 then 'OK' else 'ÉCHEC' end || ' R11f le personnel lit le nom d''un collègue, pas celui d''une autre organisation');
  perform pg_temp.moi(u_cli);
  res := res || (case when pg_temp.nb('select 1 from public.crm_rpc_equipe()') = 0 and pg_temp.nb(format('select 1 from public.crm_rpc_personnes(array[%L]::uuid[])', p_c1)) = 0 and pg_temp.nb('select 1 from public.crm_rpc_comptes()') = 0 then 'OK' else 'ÉCHEC' end || ' R11g le client ne lit ni l''équipe ni les comptes');
  perform pg_temp.moi(u_c2);
  res := res || (case when pg_temp.nb('select 1 from public.crm_rpc_comptes()') = 0 then 'OK' else 'ÉCHEC' end || ' R11h les comptes sont réservés à l''administrateur');
  perform pg_temp.moi(u_adm);
  res := res || (case when pg_temp.nb('select 1 from public.crm_rpc_comptes()') = 5 and pg_temp.nb('select 1 from public.crm_rpc_comptes() where role = ''client''') = 2 then 'OK' else 'ÉCHEC' end || ' R11i l''administrateur lit les 5 comptes de son organisation (1 administrateur, 2 consultants, 2 clients)');
  perform pg_temp.moi(u_c1);
  res := res || (case when pg_temp.nb('select 1 from public.crm_rpc_emails_avec_compte(array[''CLI@test.fr'', ''out@test.fr'', ''c2@test.fr'', ''inconnu@test.fr''])') = 1 then 'OK' else 'ÉCHEC' end || ' R11k seules les adresses de comptes clients de l''organisation sont reconnues (insensible à la casse)');
  perform pg_temp.moi(u_cli);
  res := res || (case when pg_temp.nb('select 1 from public.crm_rpc_emails_avec_compte(array[''cli@test.fr''])') = 0 then 'OK' else 'ÉCHEC' end || ' R11l le client ne sonde pas les comptes');
  perform pg_temp.moi(u_admb);
  res := res || (case when pg_temp.nb('select 1 from public.crm_rpc_comptes()') = 2 and pg_temp.nb(format('select 1 from public.crm_rpc_personnes(array[%L]::uuid[])', p_c1)) = 0 then 'OK' else 'ÉCHEC' end || ' R11j l''organisation B ne voit que ses propres comptes');

  -- ---------- R8 : module désactivé ----------
  reset role;
  update public.app_organisation_modules set est_actif = false where organisation_id = org_a and module_code = 'crm';
  perform pg_temp.moi(u_adm);
  res := res || (case when pg_temp.nb('select 1 from public.crm_demandes') = 0 and pg_temp.nb('select 1 from public.crm_clients') = 0 then 'OK' else 'ÉCHEC' end || ' R8 module désactivé pour A : plus aucune donnée crm_ visible, même par son administrateur');

  raise exception 'RESULTATS % lignes%', array_length(res, 1), E'\n' || array_to_string(res, E'\n');
end
$essai$;
