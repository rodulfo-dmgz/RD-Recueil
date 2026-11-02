-- =====================================================================
-- MODULE crm_ 5 : securite par ligne, politiques, droits
-- Genere depuis supabase/migrations/20261007000000_crm_install.sql par le script de transformation, puis relu.
-- Cles etrangeres : seulement vers app_ et crm_. Aucune reference a un autre module.
-- =====================================================================

ALTER TABLE public.crm_activites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_commentaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_consentements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_demande_acces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_demande_enjeux ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_demandes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_doublons_ignores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_entretien_creneaux ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_evenements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_factures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_fichiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_financements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_notes_cadrage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_probabilites_statut ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_proposition_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_propositions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_reclamations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_reponses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_reponses_historique ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_satisfactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_tache_membres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_tache_pieces_jointes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_taches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_vues_enregistrees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_questionnaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_glossaire ENABLE ROW LEVEL SECURITY;

CREATE POLICY crm_activites_creation ON public.crm_activites AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (crm_peut_voir_client(client_id));
CREATE POLICY crm_activites_lecture ON public.crm_activites AS PERMISSIVE FOR SELECT TO authenticated USING (crm_peut_voir_client(client_id));
CREATE POLICY crm_activites_modification ON public.crm_activites AS PERMISSIVE FOR UPDATE TO authenticated USING ((crm_est_admin(crm_activites.organisation_id) OR (crm_peut_voir_client(client_id) AND (auteur = public.app_personne_id())))) WITH CHECK ((crm_est_admin(crm_activites.organisation_id) OR (crm_peut_voir_client(client_id) AND (auteur = public.app_personne_id()))));
CREATE POLICY crm_activites_suppression ON public.crm_activites AS PERMISSIVE FOR DELETE TO authenticated USING ((crm_est_admin(crm_activites.organisation_id) OR (crm_peut_voir_client(client_id) AND (auteur = public.app_personne_id()))));
CREATE POLICY crm_audit_log_lecture ON public.crm_audit_log AS PERMISSIVE FOR SELECT TO authenticated USING (crm_est_admin(crm_audit_log.organisation_id));
CREATE POLICY crm_clients_admin_suppression ON public.crm_clients AS PERMISSIVE FOR DELETE TO authenticated USING (crm_est_admin(crm_clients.organisation_id));
CREATE POLICY crm_clients_staff_creation ON public.crm_clients AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((crm_est_admin(crm_clients.organisation_id) OR (crm_est_staff(crm_clients.organisation_id) AND (responsable_id = public.app_personne_id()))));
CREATE POLICY crm_clients_staff_lecture ON public.crm_clients AS PERMISSIVE FOR SELECT TO authenticated USING ((crm_est_admin(crm_clients.organisation_id) OR (crm_est_staff(crm_clients.organisation_id) AND ((responsable_id = public.app_personne_id()) OR (EXISTS ( SELECT 1
   FROM crm_demandes d
  WHERE ((d.client_id = crm_clients.id) AND (d.consultant_id = public.app_personne_id()))))))));
CREATE POLICY crm_clients_staff_modification ON public.crm_clients AS PERMISSIVE FOR UPDATE TO authenticated USING ((crm_est_admin(crm_clients.organisation_id) OR (crm_est_staff(crm_clients.organisation_id) AND ((responsable_id = public.app_personne_id()) OR (EXISTS ( SELECT 1
   FROM crm_demandes d
  WHERE ((d.client_id = crm_clients.id) AND (d.consultant_id = public.app_personne_id())))))))) WITH CHECK ((crm_est_admin(crm_clients.organisation_id) OR (crm_est_staff(crm_clients.organisation_id) AND ((responsable_id = public.app_personne_id()) OR (EXISTS ( SELECT 1
   FROM crm_demandes d
  WHERE ((d.client_id = crm_clients.id) AND (d.consultant_id = public.app_personne_id()))))))));
CREATE POLICY crm_commentaires_client_ecriture ON public.crm_commentaires AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((crm_a_acces(demande_id) AND (interne = false) AND (auteur = public.app_personne_id())));
CREATE POLICY crm_commentaires_client_lecture ON public.crm_commentaires AS PERMISSIVE FOR SELECT TO authenticated USING ((crm_a_acces(demande_id) AND (interne = false)));
CREATE POLICY crm_commentaires_staff ON public.crm_commentaires AS PERMISSIVE FOR ALL TO authenticated USING (crm_peut_voir_demande(demande_id)) WITH CHECK (crm_peut_voir_demande(demande_id));
CREATE POLICY crm_consentements_staff ON public.crm_consentements AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM crm_contacts k
  WHERE ((k.id = crm_consentements.contact_id) AND crm_peut_voir_client(k.client_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM crm_contacts k
  WHERE ((k.id = crm_consentements.contact_id) AND crm_peut_voir_client(k.client_id)))));
CREATE POLICY crm_contacts_staff ON public.crm_contacts AS PERMISSIVE FOR ALL TO authenticated USING (crm_peut_voir_client(client_id)) WITH CHECK (crm_peut_voir_client(client_id));
CREATE POLICY crm_demande_acces_soi ON public.crm_demande_acces AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = public.app_personne_id()) OR crm_est_mon_email(email)));
CREATE POLICY crm_demande_acces_staff ON public.crm_demande_acces AS PERMISSIVE FOR ALL TO authenticated USING (crm_peut_voir_demande(demande_id)) WITH CHECK (crm_peut_voir_demande(demande_id));
CREATE POLICY crm_demande_enjeux_staff ON public.crm_demande_enjeux AS PERMISSIVE FOR ALL TO authenticated USING (crm_peut_voir_demande(demande_id)) WITH CHECK (crm_peut_voir_demande(demande_id));
CREATE POLICY crm_demandes_client_lecture ON public.crm_demandes AS PERMISSIVE FOR SELECT TO authenticated USING (crm_a_acces(id));
CREATE POLICY crm_demandes_staff ON public.crm_demandes AS PERMISSIVE FOR ALL TO authenticated USING ((crm_est_admin(crm_demandes.organisation_id) OR (crm_est_staff(crm_demandes.organisation_id) AND (consultant_id = public.app_personne_id())))) WITH CHECK ((crm_est_admin(crm_demandes.organisation_id) OR (crm_est_staff(crm_demandes.organisation_id) AND (consultant_id = public.app_personne_id()))));
CREATE POLICY crm_doublons_ignores_admin ON public.crm_doublons_ignores AS PERMISSIVE FOR ALL TO authenticated USING (crm_est_admin(crm_doublons_ignores.organisation_id)) WITH CHECK (crm_est_admin(crm_doublons_ignores.organisation_id));
CREATE POLICY crm_entretien_creneaux_client_lecture ON public.crm_entretien_creneaux AS PERMISSIVE FOR SELECT TO authenticated USING (crm_a_acces(demande_id));
CREATE POLICY crm_entretien_creneaux_staff ON public.crm_entretien_creneaux AS PERMISSIVE FOR ALL TO authenticated USING (crm_peut_voir_demande(demande_id)) WITH CHECK (crm_peut_voir_demande(demande_id));
CREATE POLICY crm_evenements_staff ON public.crm_evenements AS PERMISSIVE FOR SELECT TO authenticated USING (crm_peut_voir_demande(demande_id));
CREATE POLICY crm_factures_admin ON public.crm_factures AS PERMISSIVE FOR ALL TO authenticated USING (crm_est_admin(crm_factures.organisation_id)) WITH CHECK (crm_est_admin(crm_factures.organisation_id));
CREATE POLICY crm_fichiers_client_depot ON public.crm_fichiers AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (crm_a_acces(demande_id));
CREATE POLICY crm_fichiers_client_lecture ON public.crm_fichiers AS PERMISSIVE FOR SELECT TO authenticated USING (crm_a_acces(demande_id));
CREATE POLICY crm_fichiers_staff ON public.crm_fichiers AS PERMISSIVE FOR ALL TO authenticated USING (crm_peut_voir_demande(demande_id)) WITH CHECK (crm_peut_voir_demande(demande_id));
CREATE POLICY crm_financements_staff ON public.crm_financements AS PERMISSIVE FOR ALL TO authenticated USING (crm_peut_voir_demande(demande_id)) WITH CHECK (crm_peut_voir_demande(demande_id));
CREATE POLICY crm_glossaire_lecture ON public.crm_glossaire AS PERMISSIVE FOR SELECT TO authenticated USING (crm_a_acces_module());
CREATE POLICY crm_notes_cadrage_client_lecture ON public.crm_notes_cadrage AS PERMISSIVE FOR SELECT TO authenticated USING ((crm_a_acces(demande_id) AND (statut <> 'brouillon'::text)));
CREATE POLICY crm_notes_cadrage_staff ON public.crm_notes_cadrage AS PERMISSIVE FOR ALL TO authenticated USING (crm_peut_voir_demande(demande_id)) WITH CHECK (crm_peut_voir_demande(demande_id));
CREATE POLICY crm_notifications_lecture ON public.crm_notifications AS PERMISSIVE FOR SELECT TO authenticated USING ((destinataire = public.app_personne_id()));
CREATE POLICY crm_notifications_maj ON public.crm_notifications AS PERMISSIVE FOR UPDATE TO authenticated USING ((destinataire = public.app_personne_id())) WITH CHECK ((destinataire = public.app_personne_id()));
CREATE POLICY crm_probabilites_lecture ON public.crm_probabilites_statut AS PERMISSIVE FOR SELECT TO authenticated USING (crm_est_staff(crm_probabilites_statut.organisation_id));
CREATE POLICY crm_probabilites_modification ON public.crm_probabilites_statut AS PERMISSIVE FOR UPDATE TO authenticated USING (crm_est_admin(crm_probabilites_statut.organisation_id)) WITH CHECK (crm_est_admin(crm_probabilites_statut.organisation_id));
CREATE POLICY crm_proposition_lignes_client_lecture ON public.crm_proposition_lignes AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM crm_propositions p
  WHERE ((p.id = crm_proposition_lignes.proposition_id) AND crm_a_acces(p.demande_id) AND (p.statut <> 'brouillon'::text)))));
CREATE POLICY crm_proposition_lignes_staff ON public.crm_proposition_lignes AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM crm_propositions p
  WHERE ((p.id = crm_proposition_lignes.proposition_id) AND crm_peut_voir_demande(p.demande_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM crm_propositions p
  WHERE ((p.id = crm_proposition_lignes.proposition_id) AND crm_peut_voir_demande(p.demande_id)))));
CREATE POLICY crm_propositions_client_lecture ON public.crm_propositions AS PERMISSIVE FOR SELECT TO authenticated USING ((crm_a_acces(demande_id) AND (statut <> 'brouillon'::text)));
CREATE POLICY crm_propositions_staff ON public.crm_propositions AS PERMISSIVE FOR ALL TO authenticated USING (crm_peut_voir_demande(demande_id)) WITH CHECK (crm_peut_voir_demande(demande_id));
CREATE POLICY crm_questionnaires_lecture ON public.crm_questionnaires AS PERMISSIVE FOR SELECT TO authenticated USING (crm_a_acces_module());
CREATE POLICY crm_questions_client ON public.crm_questions AS PERMISSIVE FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM crm_sections s
  WHERE ((s.questionnaire_id = crm_questions.questionnaire_id) AND (s.id = crm_questions.section_id) AND (s.visible_client = true))))) AND crm_a_acces_module());
CREATE POLICY crm_questions_staff ON public.crm_questions AS PERMISSIVE FOR SELECT TO authenticated USING (crm_a_acces_staff_module());
CREATE POLICY crm_reclamations_staff ON public.crm_reclamations AS PERMISSIVE FOR ALL TO authenticated USING (crm_peut_voir_client(client_id)) WITH CHECK (crm_peut_voir_client(client_id));
CREATE POLICY crm_reponses_client_insertion ON public.crm_reponses AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (crm_client_peut_ecrire_reponse(demande_id, question_id));
CREATE POLICY crm_reponses_client_lecture ON public.crm_reponses AS PERMISSIVE FOR SELECT TO authenticated USING ((crm_a_acces(demande_id) AND (EXISTS ( SELECT 1
   FROM (crm_questions q
     JOIN crm_demandes d ON ((d.questionnaire_id = q.questionnaire_id)))
  WHERE ((d.id = crm_reponses.demande_id) AND (q.id = crm_reponses.question_id) AND (q.rempli_par <> 'F'::text))))));
CREATE POLICY crm_reponses_client_maj ON public.crm_reponses AS PERMISSIVE FOR UPDATE TO authenticated USING (crm_client_peut_ecrire_reponse(demande_id, question_id)) WITH CHECK (crm_client_peut_ecrire_reponse(demande_id, question_id));
CREATE POLICY crm_reponses_staff ON public.crm_reponses AS PERMISSIVE FOR ALL TO authenticated USING (crm_peut_voir_demande(demande_id)) WITH CHECK (crm_peut_voir_demande(demande_id));
CREATE POLICY crm_reponses_historique_staff ON public.crm_reponses_historique AS PERMISSIVE FOR SELECT TO authenticated USING (crm_peut_voir_demande(demande_id));
CREATE POLICY crm_satisfactions_client ON public.crm_satisfactions AS PERMISSIVE FOR SELECT TO authenticated USING (crm_acces_demande(demande_id));
CREATE POLICY crm_satisfactions_staff ON public.crm_satisfactions AS PERMISSIVE FOR ALL TO authenticated USING (crm_peut_voir_client(client_id)) WITH CHECK (crm_peut_voir_client(client_id));
CREATE POLICY crm_sections_client ON public.crm_sections AS PERMISSIVE FOR SELECT TO authenticated USING (((visible_client = true)) AND crm_a_acces_module());
CREATE POLICY crm_sections_staff ON public.crm_sections AS PERMISSIVE FOR SELECT TO authenticated USING (crm_a_acces_staff_module());
CREATE POLICY crm_tache_membres_ajout ON public.crm_tache_membres AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((crm_peut_voir_tache(tache_id) AND crm_membre_staff_valide(crm_tache_membres.organisation_id, crm_tache_membres.user_id)));
CREATE POLICY crm_tache_membres_lecture ON public.crm_tache_membres AS PERMISSIVE FOR SELECT TO authenticated USING (crm_peut_voir_tache(tache_id));
CREATE POLICY crm_tache_membres_retrait ON public.crm_tache_membres AS PERMISSIVE FOR DELETE TO authenticated USING (crm_peut_voir_tache(tache_id));
CREATE POLICY crm_tache_pieces_ajout ON public.crm_tache_pieces_jointes AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (crm_peut_voir_tache(tache_id));
CREATE POLICY crm_tache_pieces_lecture ON public.crm_tache_pieces_jointes AS PERMISSIVE FOR SELECT TO authenticated USING (crm_peut_voir_tache(tache_id));
CREATE POLICY crm_tache_pieces_retrait ON public.crm_tache_pieces_jointes AS PERMISSIVE FOR DELETE TO authenticated USING (crm_peut_voir_tache(tache_id));
CREATE POLICY crm_taches_creation ON public.crm_taches AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((crm_est_admin(crm_taches.organisation_id) OR (crm_est_staff(crm_taches.organisation_id) AND (assignee_id = public.app_personne_id()) AND crm_peut_voir_client(client_id))));
CREATE POLICY crm_taches_lecture ON public.crm_taches AS PERMISSIVE FOR SELECT TO authenticated USING ((crm_est_admin(crm_taches.organisation_id) OR (crm_est_staff(crm_taches.organisation_id) AND ((assignee_id = public.app_personne_id()) OR crm_est_membre_tache(id)))));
CREATE POLICY crm_taches_modification ON public.crm_taches AS PERMISSIVE FOR UPDATE TO authenticated USING ((crm_est_admin(crm_taches.organisation_id) OR (crm_est_staff(crm_taches.organisation_id) AND ((assignee_id = public.app_personne_id()) OR crm_est_membre_tache(id))))) WITH CHECK ((crm_est_admin(crm_taches.organisation_id) OR (crm_est_staff(crm_taches.organisation_id) AND ((assignee_id = public.app_personne_id()) OR crm_est_membre_tache(id)))));
CREATE POLICY crm_taches_suppression ON public.crm_taches AS PERMISSIVE FOR DELETE TO authenticated USING ((crm_est_admin(crm_taches.organisation_id) OR (crm_est_staff(crm_taches.organisation_id) AND (assignee_id = public.app_personne_id()))));
CREATE POLICY crm_vues_enregistrees_perso ON public.crm_vues_enregistrees AS PERMISSIVE FOR ALL TO authenticated USING (((user_id = public.app_personne_id()) AND crm_est_staff(crm_vues_enregistrees.organisation_id))) WITH CHECK (((user_id = public.app_personne_id()) AND crm_est_staff(crm_vues_enregistrees.organisation_id)));

GRANT insert, select, update, delete ON public.crm_activites TO authenticated;
GRANT select ON public.crm_audit_log TO authenticated;
GRANT delete, insert, select, update ON public.crm_clients TO authenticated;
GRANT insert, select, update, delete ON public.crm_commentaires TO authenticated;
GRANT select, insert, update, delete ON public.crm_consentements TO authenticated;
GRANT select, insert, update, delete ON public.crm_contacts TO authenticated;
GRANT select, insert, update, delete ON public.crm_demande_acces TO authenticated;
GRANT select, insert, update, delete ON public.crm_demande_enjeux TO authenticated;
GRANT select, insert, update, delete ON public.crm_demandes TO authenticated;
GRANT select, insert, update, delete ON public.crm_doublons_ignores TO authenticated;
GRANT select, insert, update, delete ON public.crm_entretien_creneaux TO authenticated;
GRANT select ON public.crm_evenements TO authenticated;
GRANT select, insert, update, delete ON public.crm_factures TO authenticated;
GRANT insert, select, update, delete ON public.crm_fichiers TO authenticated;
GRANT select, insert, update, delete ON public.crm_financements TO authenticated;
GRANT select, insert, update, delete ON public.crm_notes_cadrage TO authenticated;
GRANT select, update ON public.crm_notifications TO authenticated;
GRANT select, update ON public.crm_probabilites_statut TO authenticated;
GRANT select, insert, update, delete ON public.crm_proposition_lignes TO authenticated;
GRANT select, insert, update, delete ON public.crm_propositions TO authenticated;
GRANT select, insert, update, delete ON public.crm_reclamations TO authenticated;
GRANT insert, select, update, delete ON public.crm_reponses TO authenticated;
GRANT select ON public.crm_reponses_historique TO authenticated;
GRANT select, insert, update, delete ON public.crm_satisfactions TO authenticated;
GRANT insert, select, delete ON public.crm_tache_membres TO authenticated;
GRANT insert, select, delete ON public.crm_tache_pieces_jointes TO authenticated;
GRANT insert, select, update, delete ON public.crm_taches TO authenticated;
GRANT select, insert, update, delete ON public.crm_vues_enregistrees TO authenticated;
GRANT select ON public.crm_questionnaires TO authenticated;
GRANT select ON public.crm_sections TO authenticated;
GRANT select ON public.crm_questions TO authenticated;
GRANT select ON public.crm_glossaire TO authenticated;
GRANT SELECT ON public.crm_v_clients TO authenticated;
GRANT SELECT ON public.crm_v_demandes_montants TO authenticated;
GRANT SELECT ON public.crm_v_reponses_client TO authenticated;
GRANT USAGE ON SEQUENCE public.crm_demande_seq TO authenticated;

-- ---------- Stockage : seaux privés et politiques ----------
INSERT INTO storage.buckets (id, name, public) VALUES ('crm-demandes', 'crm-demandes', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit) VALUES ('crm-taches', 'crm-taches', false, 20971520) ON CONFLICT (id) DO NOTHING;

-- Chemin des pièces d'une demande : <client>/<référence>/...  (la référence, 2e segment, porte le droit)
CREATE POLICY crm_stockage_client_depot ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'crm-demandes' AND EXISTS (
    SELECT 1 FROM public.crm_demandes d WHERE d.reference = (storage.foldername(objects.name))[2] AND public.crm_a_acces(d.id)));
CREATE POLICY crm_stockage_client_lecture ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING (bucket_id = 'crm-demandes' AND EXISTS (
    SELECT 1 FROM public.crm_demandes d WHERE d.reference = (storage.foldername(objects.name))[2] AND public.crm_a_acces(d.id)));
CREATE POLICY crm_stockage_staff ON storage.objects AS PERMISSIVE FOR ALL TO authenticated
  USING (bucket_id = 'crm-demandes' AND EXISTS (
    SELECT 1 FROM public.crm_demandes d WHERE d.reference = (storage.foldername(objects.name))[2]
      AND (public.crm_est_admin(d.organisation_id) OR (public.crm_est_staff(d.organisation_id) AND d.consultant_id = public.app_personne_id()))))
  WITH CHECK (bucket_id = 'crm-demandes' AND EXISTS (
    SELECT 1 FROM public.crm_demandes d WHERE d.reference = (storage.foldername(objects.name))[2]
      AND (public.crm_est_admin(d.organisation_id) OR (public.crm_est_staff(d.organisation_id) AND d.consultant_id = public.app_personne_id()))));
CREATE POLICY crm_stockage_taches ON storage.objects AS PERMISSIVE FOR ALL TO authenticated
  USING (bucket_id = 'crm-taches' AND public.crm_peut_voir_tache_chemin(name))
  WITH CHECK (bucket_id = 'crm-taches' AND public.crm_peut_voir_tache_chemin(name)
    AND lower(storage.extension(name)) = ANY (ARRAY['pdf', 'docx', 'xlsx', 'pptx', 'png', 'jpg', 'jpeg']));
