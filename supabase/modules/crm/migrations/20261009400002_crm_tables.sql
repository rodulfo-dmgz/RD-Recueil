-- =====================================================================
-- MODULE crm_ 2 : tables, contraintes, index
-- Genere depuis supabase/migrations/20261007000000_crm_install.sql par le script de transformation, puis relu.
-- Cles etrangeres : seulement vers app_ et crm_. Aucune reference a un autre module.
-- =====================================================================

CREATE SEQUENCE public.crm_demande_seq AS bigint START WITH 1 INCREMENT BY 1 MINVALUE 1 NO CYCLE;

CREATE TABLE public.crm_activites (
  organisation_id uuid NOT NULL,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  client_id uuid NOT NULL,
  contact_id uuid,
  demande_id uuid,
  auteur uuid DEFAULT public.app_personne_id(),
  type text NOT NULL,
  objet text NOT NULL,
  description text,
  date_activite timestamp with time zone DEFAULT now() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.crm_audit_log (
  organisation_id uuid NOT NULL,
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  user_id uuid,
  auteur text NOT NULL,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  client_id uuid,
  demande_id uuid,
  libelle text,
  changes jsonb NOT NULL
);
CREATE TABLE public.crm_clients (
  organisation_id uuid NOT NULL,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  raison_sociale text NOT NULL,
  siret text,
  created_at timestamp with time zone DEFAULT now(),
  nom_commercial text,
  forme_juridique text,
  code_naf text,
  secteur text,
  adresse text,
  code_postal text,
  ville text,
  telephone text,
  email_general text,
  site_web text,
  effectif text,
  opco text,
  source text,
  statut text DEFAULT 'client'::text NOT NULL,
  responsable_id uuid,
  notes text,
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.crm_commentaires (
  organisation_id uuid NOT NULL,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  demande_id uuid,
  cible text NOT NULL,
  auteur uuid,
  texte text NOT NULL,
  interne boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.crm_consentements (
  organisation_id uuid NOT NULL,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  contact_id uuid NOT NULL,
  type text NOT NULL,
  statut text NOT NULL,
  date_consentement date DEFAULT CURRENT_DATE NOT NULL,
  source text,
  preuve text,
  date_expiration date,
  date_retrait date,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.crm_contacts (
  organisation_id uuid NOT NULL,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  client_id uuid NOT NULL,
  prenom text,
  nom text NOT NULL,
  fonction text,
  email text,
  telephone text,
  roles text[] DEFAULT '{}'::text[] NOT NULL,
  principal boolean DEFAULT false NOT NULL,
  actif boolean DEFAULT true NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.crm_demande_acces (
  organisation_id uuid NOT NULL,
  demande_id uuid NOT NULL,
  email text NOT NULL,
  user_id uuid,
  droit text DEFAULT 'editeur'::text NOT NULL,
  invite_le timestamp with time zone DEFAULT now()
);
CREATE TABLE public.crm_demande_enjeux (
  organisation_id uuid NOT NULL,
  demande_id uuid NOT NULL,
  montant_estime numeric(12,2),
  probabilite smallint,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.crm_demandes (
  organisation_id uuid NOT NULL,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  reference text NOT NULL,
  client_id uuid,
  questionnaire_id text NOT NULL,
  statut text DEFAULT 'brouillon'::text NOT NULL,
  types text[] DEFAULT '{}'::text[],
  consultant_id uuid,
  date_limite date,
  soumise_le timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  archivee boolean DEFAULT false NOT NULL,
  archivee_le timestamp with time zone
);
CREATE TABLE public.crm_doublons_ignores (
  organisation_id uuid NOT NULL,
  client_a uuid NOT NULL,
  client_b uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid DEFAULT public.app_personne_id()
);
CREATE TABLE public.crm_entretien_creneaux (
  organisation_id uuid NOT NULL,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  demande_id uuid,
  debut timestamp with time zone NOT NULL,
  fin timestamp with time zone NOT NULL,
  choisi boolean DEFAULT false NOT NULL
);
CREATE TABLE public.crm_evenements (
  organisation_id uuid NOT NULL,
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  demande_id uuid,
  type text NOT NULL,
  de text,
  vers text,
  auteur uuid,
  commentaire text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.crm_factures (
  organisation_id uuid NOT NULL,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  demande_id uuid NOT NULL,
  numero text,
  libelle text,
  montant_ht numeric(12,2) NOT NULL,
  date_emission date DEFAULT CURRENT_DATE NOT NULL,
  date_paiement date,
  source text DEFAULT 'manuelle'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.crm_fichiers (
  organisation_id uuid NOT NULL,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  demande_id uuid,
  question_id text NOT NULL,
  chemin text NOT NULL,
  nom text NOT NULL,
  taille integer NOT NULL,
  mime text NOT NULL,
  depose_par uuid,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.crm_financements (
  organisation_id uuid NOT NULL,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  demande_id uuid NOT NULL,
  type text NOT NULL,
  organisme text,
  reference_dossier text,
  montant numeric(12,2) NOT NULL,
  statut text DEFAULT 'en_attente'::text NOT NULL,
  note text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.crm_glossaire (
  questionnaire_id text NOT NULL,
  id text NOT NULL,
  libelle text NOT NULL,
  categorie text NOT NULL,
  definition text NOT NULL,
  exemple text NOT NULL
);
CREATE TABLE public.crm_notes_cadrage (
  organisation_id uuid NOT NULL,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  demande_id uuid,
  version smallint NOT NULL,
  contenu_md text NOT NULL,
  statut text NOT NULL,
  envoyee_le timestamp with time zone,
  validee_le timestamp with time zone,
  validee_par uuid,
  validation_ip inet,
  signature_image text,
  signature_credential text
);
CREATE TABLE public.crm_notifications (
  organisation_id uuid NOT NULL,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  destinataire uuid NOT NULL,
  demande_id uuid,
  reference text NOT NULL,
  type text NOT NULL,
  titre text NOT NULL,
  lu boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  lien text
);
CREATE TABLE public.crm_probabilites_statut (
  organisation_id uuid NOT NULL,
  statut text NOT NULL,
  pourcentage smallint NOT NULL
);
CREATE TABLE public.crm_proposition_lignes (
  organisation_id uuid NOT NULL,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  proposition_id uuid,
  ordre smallint DEFAULT 0 NOT NULL,
  designation text NOT NULL,
  quantite numeric DEFAULT 1 NOT NULL,
  prix_unitaire numeric DEFAULT 0 NOT NULL,
  total numeric GENERATED ALWAYS AS ((quantite * prix_unitaire)) STORED
);
CREATE TABLE public.crm_propositions (
  organisation_id uuid NOT NULL,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  demande_id uuid,
  justification_md text DEFAULT ''::text NOT NULL,
  statut text DEFAULT 'brouillon'::text NOT NULL,
  envoyee_le timestamp with time zone,
  decidee_le timestamp with time zone,
  decidee_par uuid,
  commentaire_client text,
  signature_image text,
  signature_credential text
);
CREATE TABLE public.crm_questionnaires (
  id text NOT NULL,
  statut text NOT NULL,
  source_hash text NOT NULL,
  publie_le timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  gabarit_cadrage_md text
);
CREATE TABLE public.crm_questions (
  questionnaire_id text NOT NULL,
  id text NOT NULL,
  section_id text NOT NULL,
  ordre smallint NOT NULL,
  libelle text NOT NULL,
  type text NOT NULL,
  options jsonb DEFAULT '[]'::jsonb,
  obligatoire boolean NOT NULL,
  rempli_par text NOT NULL,
  condition text DEFAULT '-'::text,
  glossaire text[] DEFAULT '{}'::text[],
  nsp_autorise boolean DEFAULT true
);
CREATE TABLE public.crm_reclamations (
  organisation_id uuid NOT NULL,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  client_id uuid NOT NULL,
  demande_id uuid,
  date_reception date DEFAULT CURRENT_DATE NOT NULL,
  objet text NOT NULL,
  description text,
  gravite text DEFAULT 'mineure'::text NOT NULL,
  statut text DEFAULT 'ouverte'::text NOT NULL,
  responsable_id uuid,
  action_corrective text,
  date_cloture date,
  created_by uuid DEFAULT public.app_personne_id(),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  origine text DEFAULT 'equipe'::text NOT NULL
);
CREATE TABLE public.crm_reponses (
  organisation_id uuid NOT NULL,
  demande_id uuid NOT NULL,
  question_id text NOT NULL,
  valeur jsonb,
  nsp boolean DEFAULT false,
  annotation_consultant text,
  saisi_par uuid,
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.crm_reponses_historique (
  organisation_id uuid NOT NULL,
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  demande_id uuid,
  question_id text,
  ancienne_valeur jsonb,
  nouvelle_valeur jsonb,
  auteur uuid,
  modifie_le timestamp with time zone DEFAULT now()
);
CREATE TABLE public.crm_satisfactions (
  organisation_id uuid NOT NULL,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  demande_id uuid NOT NULL,
  client_id uuid NOT NULL,
  moment text NOT NULL,
  statut text DEFAULT 'demandee'::text NOT NULL,
  note smallint,
  commentaire text,
  date_envoi date DEFAULT CURRENT_DATE NOT NULL,
  date_reponse date,
  origine text,
  demande_par uuid DEFAULT public.app_personne_id(),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.crm_sections (
  questionnaire_id text NOT NULL,
  id text NOT NULL,
  partie smallint NOT NULL,
  titre text NOT NULL,
  ordre smallint NOT NULL,
  condition text DEFAULT '-'::text,
  visible_client boolean DEFAULT true
);
CREATE TABLE public.crm_tache_membres (
  organisation_id uuid NOT NULL,
  tache_id uuid NOT NULL,
  user_id uuid NOT NULL,
  ajoute_par uuid DEFAULT public.app_personne_id(),
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.crm_tache_pieces_jointes (
  organisation_id uuid NOT NULL,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  tache_id uuid NOT NULL,
  nom text NOT NULL,
  chemin text NOT NULL,
  taille bigint NOT NULL,
  created_by uuid DEFAULT public.app_personne_id(),
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.crm_taches (
  organisation_id uuid NOT NULL,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  client_id uuid NOT NULL,
  contact_id uuid,
  demande_id uuid,
  assignee_id uuid,
  created_by uuid DEFAULT public.app_personne_id(),
  titre text NOT NULL,
  description text,
  type text DEFAULT 'autre'::text NOT NULL,
  echeance date NOT NULL,
  statut text DEFAULT 'a_faire'::text NOT NULL,
  terminee_le timestamp with time zone,
  terminee_par uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  urgence text DEFAULT 'moyenne'::text NOT NULL
);
CREATE TABLE public.crm_vues_enregistrees (
  organisation_id uuid NOT NULL,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid DEFAULT public.app_personne_id() NOT NULL,
  ecran text NOT NULL,
  nom text NOT NULL,
  filtres jsonb DEFAULT '[]'::jsonb NOT NULL,
  tri jsonb,
  recherche text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.crm_activites ADD CONSTRAINT crm_activites_pkey PRIMARY KEY (id);
ALTER TABLE public.crm_audit_log ADD CONSTRAINT crm_audit_log_pkey PRIMARY KEY (id);
ALTER TABLE public.crm_clients ADD CONSTRAINT crm_clients_pkey PRIMARY KEY (id);
ALTER TABLE public.crm_commentaires ADD CONSTRAINT crm_commentaires_pkey PRIMARY KEY (id);
ALTER TABLE public.crm_consentements ADD CONSTRAINT crm_consentements_pkey PRIMARY KEY (id);
ALTER TABLE public.crm_contacts ADD CONSTRAINT crm_contacts_pkey PRIMARY KEY (id);
ALTER TABLE public.crm_demande_acces ADD CONSTRAINT crm_demande_acces_pkey PRIMARY KEY (demande_id, email);
ALTER TABLE public.crm_demande_enjeux ADD CONSTRAINT crm_demande_enjeux_pkey PRIMARY KEY (demande_id);
ALTER TABLE public.crm_demandes ADD CONSTRAINT crm_demandes_pkey PRIMARY KEY (id);
ALTER TABLE public.crm_doublons_ignores ADD CONSTRAINT crm_doublons_ignores_pkey PRIMARY KEY (client_a, client_b);
ALTER TABLE public.crm_entretien_creneaux ADD CONSTRAINT crm_entretien_creneaux_pkey PRIMARY KEY (id);
ALTER TABLE public.crm_evenements ADD CONSTRAINT crm_evenements_pkey PRIMARY KEY (id);
ALTER TABLE public.crm_factures ADD CONSTRAINT crm_factures_pkey PRIMARY KEY (id);
ALTER TABLE public.crm_fichiers ADD CONSTRAINT crm_fichiers_pkey PRIMARY KEY (id);
ALTER TABLE public.crm_financements ADD CONSTRAINT crm_financements_pkey PRIMARY KEY (id);
ALTER TABLE public.crm_glossaire ADD CONSTRAINT crm_glossaire_pkey PRIMARY KEY (questionnaire_id, id);
ALTER TABLE public.crm_notes_cadrage ADD CONSTRAINT crm_notes_cadrage_pkey PRIMARY KEY (id);
ALTER TABLE public.crm_notifications ADD CONSTRAINT crm_notifications_pkey PRIMARY KEY (id);
ALTER TABLE public.crm_probabilites_statut ADD CONSTRAINT crm_probabilites_statut_pkey PRIMARY KEY (organisation_id, statut);
ALTER TABLE public.crm_proposition_lignes ADD CONSTRAINT crm_proposition_lignes_pkey PRIMARY KEY (id);
ALTER TABLE public.crm_propositions ADD CONSTRAINT crm_propositions_pkey PRIMARY KEY (id);
ALTER TABLE public.crm_questionnaires ADD CONSTRAINT crm_questionnaires_pkey PRIMARY KEY (id);
ALTER TABLE public.crm_questions ADD CONSTRAINT crm_questions_pkey PRIMARY KEY (questionnaire_id, id);
ALTER TABLE public.crm_reclamations ADD CONSTRAINT crm_reclamations_pkey PRIMARY KEY (id);
ALTER TABLE public.crm_reponses ADD CONSTRAINT crm_reponses_pkey PRIMARY KEY (demande_id, question_id);
ALTER TABLE public.crm_reponses_historique ADD CONSTRAINT crm_reponses_historique_pkey PRIMARY KEY (id);
ALTER TABLE public.crm_satisfactions ADD CONSTRAINT crm_satisfactions_pkey PRIMARY KEY (id);
ALTER TABLE public.crm_sections ADD CONSTRAINT crm_sections_pkey PRIMARY KEY (questionnaire_id, id);
ALTER TABLE public.crm_tache_membres ADD CONSTRAINT crm_tache_membres_pkey PRIMARY KEY (tache_id, user_id);
ALTER TABLE public.crm_tache_pieces_jointes ADD CONSTRAINT crm_tache_pieces_jointes_pkey PRIMARY KEY (id);
ALTER TABLE public.crm_taches ADD CONSTRAINT crm_taches_pkey PRIMARY KEY (id);
ALTER TABLE public.crm_vues_enregistrees ADD CONSTRAINT crm_vues_enregistrees_pkey PRIMARY KEY (id);
ALTER TABLE public.crm_consentements ADD CONSTRAINT crm_consentements_contact_id_type_key UNIQUE (contact_id, type);
ALTER TABLE public.crm_demandes ADD CONSTRAINT crm_demandes_reference_key UNIQUE (reference);
ALTER TABLE public.crm_notes_cadrage ADD CONSTRAINT crm_notes_cadrage_demande_id_version_key UNIQUE (demande_id, version);
ALTER TABLE public.crm_propositions ADD CONSTRAINT crm_propositions_demande_id_key UNIQUE (demande_id);
ALTER TABLE public.crm_satisfactions ADD CONSTRAINT crm_satisfactions_demande_id_moment_key UNIQUE (demande_id, moment);
ALTER TABLE public.crm_tache_pieces_jointes ADD CONSTRAINT crm_tache_pieces_jointes_chemin_key UNIQUE (chemin);
ALTER TABLE public.crm_activites ADD CONSTRAINT crm_activites_type_check CHECK ((type = ANY (ARRAY['note'::text, 'appel'::text, 'email'::text, 'rendez_vous'::text, 'autre'::text])));
ALTER TABLE public.crm_audit_log ADD CONSTRAINT crm_audit_log_action_check CHECK ((action = ANY (ARRAY['insert'::text, 'update'::text, 'delete'::text])));
ALTER TABLE public.crm_clients ADD CONSTRAINT crm_clients_statut_check CHECK ((statut = ANY (ARRAY['prospect'::text, 'client'::text, 'archive'::text])));
ALTER TABLE public.crm_consentements ADD CONSTRAINT crm_consentements_check CHECK (((date_expiration IS NULL) OR (date_expiration >= date_consentement)));
ALTER TABLE public.crm_consentements ADD CONSTRAINT crm_consentements_statut_check CHECK ((statut = ANY (ARRAY['accorde'::text, 'refuse'::text, 'retire'::text])));
ALTER TABLE public.crm_consentements ADD CONSTRAINT crm_consentements_type_check CHECK ((type = ANY (ARRAY['email_commercial'::text, 'telephone'::text, 'lettre_information'::text])));
ALTER TABLE public.crm_demande_acces ADD CONSTRAINT crm_demande_acces_droit_check CHECK ((droit = ANY (ARRAY['editeur'::text, 'lecteur'::text])));
ALTER TABLE public.crm_demande_enjeux ADD CONSTRAINT crm_demande_enjeux_montant_estime_check CHECK (((montant_estime IS NULL) OR (montant_estime >= (0)::numeric)));
ALTER TABLE public.crm_demande_enjeux ADD CONSTRAINT crm_demande_enjeux_probabilite_check CHECK (((probabilite IS NULL) OR ((probabilite >= 0) AND (probabilite <= 100))));
ALTER TABLE public.crm_doublons_ignores ADD CONSTRAINT crm_doublons_ignores_check CHECK ((client_a < client_b));
ALTER TABLE public.crm_factures ADD CONSTRAINT crm_factures_montant_ht_check CHECK ((montant_ht >= (0)::numeric));
ALTER TABLE public.crm_factures ADD CONSTRAINT crm_factures_numero_check CHECK (((numero IS NULL) OR (btrim(numero) <> ''::text)));
ALTER TABLE public.crm_factures ADD CONSTRAINT crm_factures_source_check CHECK ((source = ANY (ARRAY['manuelle'::text, 'import'::text])));
ALTER TABLE public.crm_financements ADD CONSTRAINT crm_financements_montant_check CHECK ((montant >= (0)::numeric));
ALTER TABLE public.crm_financements ADD CONSTRAINT crm_financements_statut_check CHECK ((statut = ANY (ARRAY['en_attente'::text, 'accorde'::text, 'refuse'::text, 'verse'::text])));
ALTER TABLE public.crm_financements ADD CONSTRAINT crm_financements_type_check CHECK ((type = ANY (ARRAY['opco'::text, 'cpf'::text, 'france_travail'::text, 'region'::text, 'entreprise'::text, 'autre'::text])));
ALTER TABLE public.crm_notes_cadrage ADD CONSTRAINT crm_notes_cadrage_statut_check CHECK ((statut = ANY (ARRAY['brouillon'::text, 'envoyee'::text, 'a_revoir'::text, 'validee'::text])));
ALTER TABLE public.crm_probabilites_statut ADD CONSTRAINT crm_probabilites_statut_pourcentage_check CHECK (((pourcentage >= 0) AND (pourcentage <= 100)));
ALTER TABLE public.crm_propositions ADD CONSTRAINT crm_propositions_statut_check CHECK ((statut = ANY (ARRAY['brouillon'::text, 'envoyee'::text, 'acceptee'::text, 'refusee'::text])));
ALTER TABLE public.crm_questionnaires ADD CONSTRAINT crm_questionnaires_statut_check CHECK ((statut = ANY (ARRAY['brouillon'::text, 'publie'::text, 'archive'::text])));
ALTER TABLE public.crm_questions ADD CONSTRAINT crm_questions_rempli_par_check CHECK ((rempli_par = ANY (ARRAY['C'::text, 'F'::text, 'C/F'::text])));
ALTER TABLE public.crm_reclamations ADD CONSTRAINT crm_reclamations_check CHECK (((statut <> 'cloturee'::text) OR ((NULLIF(btrim(action_corrective), ''::text) IS NOT NULL) AND (date_cloture IS NOT NULL))));
ALTER TABLE public.crm_reclamations ADD CONSTRAINT crm_reclamations_check1 CHECK (((date_cloture IS NULL) OR (date_cloture >= date_reception)));
ALTER TABLE public.crm_reclamations ADD CONSTRAINT crm_reclamations_gravite_check CHECK ((gravite = ANY (ARRAY['mineure'::text, 'majeure'::text, 'critique'::text])));
ALTER TABLE public.crm_reclamations ADD CONSTRAINT crm_reclamations_objet_check CHECK ((btrim(objet) <> ''::text));
ALTER TABLE public.crm_reclamations ADD CONSTRAINT crm_reclamations_origine_check CHECK ((origine = ANY (ARRAY['equipe'::text, 'client'::text])));
ALTER TABLE public.crm_reclamations ADD CONSTRAINT crm_reclamations_statut_check CHECK ((statut = ANY (ARRAY['ouverte'::text, 'en_cours'::text, 'cloturee'::text])));
ALTER TABLE public.crm_satisfactions ADD CONSTRAINT crm_satisfactions_check CHECK (((statut <> 'recue'::text) OR ((note IS NOT NULL) AND (date_reponse IS NOT NULL))));
ALTER TABLE public.crm_satisfactions ADD CONSTRAINT crm_satisfactions_moment_check CHECK ((moment = ANY (ARRAY['chaud'::text, 'froid'::text])));
ALTER TABLE public.crm_satisfactions ADD CONSTRAINT crm_satisfactions_note_check CHECK (((note >= 1) AND (note <= 5)));
ALTER TABLE public.crm_satisfactions ADD CONSTRAINT crm_satisfactions_origine_check CHECK ((origine = ANY (ARRAY['client'::text, 'staff'::text])));
ALTER TABLE public.crm_satisfactions ADD CONSTRAINT crm_satisfactions_statut_check CHECK ((statut = ANY (ARRAY['demandee'::text, 'recue'::text, 'sans_reponse'::text])));
ALTER TABLE public.crm_tache_pieces_jointes ADD CONSTRAINT crm_tache_pieces_jointes_nom_check CHECK (((char_length(btrim(nom)) >= 1) AND (char_length(btrim(nom)) <= 200)));
ALTER TABLE public.crm_tache_pieces_jointes ADD CONSTRAINT crm_tache_pieces_jointes_taille_check CHECK (((taille >= 0) AND (taille <= 20971520)));
ALTER TABLE public.crm_taches ADD CONSTRAINT crm_taches_statut_check CHECK ((statut = ANY (ARRAY['a_faire'::text, 'en_cours'::text, 'a_reviser'::text, 'terminee'::text, 'annulee'::text])));
ALTER TABLE public.crm_taches ADD CONSTRAINT crm_taches_type_check CHECK ((type = ANY (ARRAY['appel'::text, 'email'::text, 'relance'::text, 'rendez_vous'::text, 'autre'::text])));
ALTER TABLE public.crm_taches ADD CONSTRAINT crm_taches_urgence_check CHECK ((urgence = ANY (ARRAY['faible'::text, 'moyenne'::text, 'haute'::text])));
ALTER TABLE public.crm_vues_enregistrees ADD CONSTRAINT crm_vues_enregistrees_ecran_check CHECK ((ecran = ANY (ARRAY['clients'::text, 'demandes'::text])));
ALTER TABLE public.crm_vues_enregistrees ADD CONSTRAINT crm_vues_enregistrees_filtres_check CHECK (((jsonb_typeof(filtres) = 'array'::text) AND (jsonb_array_length(filtres) <= 20)));
ALTER TABLE public.crm_vues_enregistrees ADD CONSTRAINT crm_vues_enregistrees_nom_check CHECK (((char_length(btrim(nom)) >= 1) AND (char_length(btrim(nom)) <= 60)));
ALTER TABLE public.crm_vues_enregistrees ADD CONSTRAINT crm_vues_enregistrees_recherche_check CHECK (((recherche IS NULL) OR (char_length(recherche) <= 200)));
ALTER TABLE public.crm_vues_enregistrees ADD CONSTRAINT crm_vues_enregistrees_tri_check CHECK (((tri IS NULL) OR (jsonb_typeof(tri) = 'object'::text)));
ALTER TABLE public.crm_activites ADD CONSTRAINT crm_activites_auteur_fkey FOREIGN KEY (auteur) REFERENCES public.app_personnes(id) ON DELETE SET NULL;
ALTER TABLE public.crm_activites ADD CONSTRAINT crm_activites_client_id_fkey FOREIGN KEY (client_id) REFERENCES crm_clients(id) ON DELETE CASCADE;
ALTER TABLE public.crm_activites ADD CONSTRAINT crm_activites_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE SET NULL;
ALTER TABLE public.crm_activites ADD CONSTRAINT crm_activites_demande_id_fkey FOREIGN KEY (demande_id) REFERENCES crm_demandes(id) ON DELETE SET NULL;
ALTER TABLE public.crm_clients ADD CONSTRAINT crm_clients_responsable_id_fkey FOREIGN KEY (responsable_id) REFERENCES public.app_personnes(id) ON DELETE SET NULL;
ALTER TABLE public.crm_commentaires ADD CONSTRAINT crm_commentaires_auteur_fkey FOREIGN KEY (auteur) REFERENCES public.app_personnes(id) ON DELETE SET NULL;
ALTER TABLE public.crm_commentaires ADD CONSTRAINT crm_commentaires_demande_id_fkey FOREIGN KEY (demande_id) REFERENCES crm_demandes(id) ON DELETE CASCADE;
ALTER TABLE public.crm_consentements ADD CONSTRAINT crm_consentements_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE CASCADE;
ALTER TABLE public.crm_contacts ADD CONSTRAINT crm_contacts_client_id_fkey FOREIGN KEY (client_id) REFERENCES crm_clients(id) ON DELETE CASCADE;
ALTER TABLE public.crm_demande_acces ADD CONSTRAINT crm_demande_acces_demande_id_fkey FOREIGN KEY (demande_id) REFERENCES crm_demandes(id) ON DELETE CASCADE;
ALTER TABLE public.crm_demande_acces ADD CONSTRAINT crm_demande_acces_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_personnes(id) ON DELETE SET NULL;
ALTER TABLE public.crm_demande_enjeux ADD CONSTRAINT crm_demande_enjeux_demande_id_fkey FOREIGN KEY (demande_id) REFERENCES crm_demandes(id) ON DELETE CASCADE;
ALTER TABLE public.crm_demandes ADD CONSTRAINT crm_demandes_client_id_fkey FOREIGN KEY (client_id) REFERENCES crm_clients(id);
ALTER TABLE public.crm_demandes ADD CONSTRAINT crm_demandes_consultant_id_fkey FOREIGN KEY (consultant_id) REFERENCES public.app_personnes(id);
ALTER TABLE public.crm_demandes ADD CONSTRAINT crm_demandes_questionnaire_id_fkey FOREIGN KEY (questionnaire_id) REFERENCES crm_questionnaires(id);
ALTER TABLE public.crm_doublons_ignores ADD CONSTRAINT crm_doublons_ignores_client_a_fkey FOREIGN KEY (client_a) REFERENCES crm_clients(id) ON DELETE CASCADE;
ALTER TABLE public.crm_doublons_ignores ADD CONSTRAINT crm_doublons_ignores_client_b_fkey FOREIGN KEY (client_b) REFERENCES crm_clients(id) ON DELETE CASCADE;
ALTER TABLE public.crm_doublons_ignores ADD CONSTRAINT crm_doublons_ignores_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.app_personnes(id) ON DELETE SET NULL;
ALTER TABLE public.crm_entretien_creneaux ADD CONSTRAINT crm_entretien_creneaux_demande_id_fkey FOREIGN KEY (demande_id) REFERENCES crm_demandes(id) ON DELETE CASCADE;
ALTER TABLE public.crm_evenements ADD CONSTRAINT crm_evenements_auteur_fkey FOREIGN KEY (auteur) REFERENCES public.app_personnes(id) ON DELETE SET NULL;
ALTER TABLE public.crm_evenements ADD CONSTRAINT crm_evenements_demande_id_fkey FOREIGN KEY (demande_id) REFERENCES crm_demandes(id) ON DELETE CASCADE;
ALTER TABLE public.crm_factures ADD CONSTRAINT crm_factures_demande_id_fkey FOREIGN KEY (demande_id) REFERENCES crm_demandes(id) ON DELETE RESTRICT;
ALTER TABLE public.crm_fichiers ADD CONSTRAINT crm_fichiers_demande_id_fkey FOREIGN KEY (demande_id) REFERENCES crm_demandes(id) ON DELETE CASCADE;
ALTER TABLE public.crm_fichiers ADD CONSTRAINT crm_fichiers_depose_par_fkey FOREIGN KEY (depose_par) REFERENCES public.app_personnes(id) ON DELETE SET NULL;
ALTER TABLE public.crm_financements ADD CONSTRAINT crm_financements_demande_id_fkey FOREIGN KEY (demande_id) REFERENCES crm_demandes(id) ON DELETE CASCADE;
ALTER TABLE public.crm_glossaire ADD CONSTRAINT crm_glossaire_questionnaire_id_fkey FOREIGN KEY (questionnaire_id) REFERENCES crm_questionnaires(id) ON DELETE CASCADE;
ALTER TABLE public.crm_notes_cadrage ADD CONSTRAINT crm_notes_cadrage_demande_id_fkey FOREIGN KEY (demande_id) REFERENCES crm_demandes(id) ON DELETE CASCADE;
ALTER TABLE public.crm_notes_cadrage ADD CONSTRAINT crm_notes_cadrage_validee_par_fkey FOREIGN KEY (validee_par) REFERENCES public.app_personnes(id) ON DELETE SET NULL;
ALTER TABLE public.crm_notifications ADD CONSTRAINT crm_notifications_demande_id_fkey FOREIGN KEY (demande_id) REFERENCES crm_demandes(id) ON DELETE CASCADE;
ALTER TABLE public.crm_notifications ADD CONSTRAINT crm_notifications_destinataire_fkey FOREIGN KEY (destinataire) REFERENCES public.app_personnes(id) ON DELETE CASCADE;
ALTER TABLE public.crm_proposition_lignes ADD CONSTRAINT crm_proposition_lignes_proposition_id_fkey FOREIGN KEY (proposition_id) REFERENCES crm_propositions(id) ON DELETE CASCADE;
ALTER TABLE public.crm_propositions ADD CONSTRAINT crm_propositions_decidee_par_fkey FOREIGN KEY (decidee_par) REFERENCES public.app_personnes(id) ON DELETE SET NULL;
ALTER TABLE public.crm_propositions ADD CONSTRAINT crm_propositions_demande_id_fkey FOREIGN KEY (demande_id) REFERENCES crm_demandes(id) ON DELETE CASCADE;
ALTER TABLE public.crm_questions ADD CONSTRAINT crm_questions_questionnaire_id_fkey FOREIGN KEY (questionnaire_id) REFERENCES crm_questionnaires(id) ON DELETE CASCADE;
ALTER TABLE public.crm_questions ADD CONSTRAINT crm_questions_questionnaire_id_section_id_fkey FOREIGN KEY (questionnaire_id, section_id) REFERENCES crm_sections(questionnaire_id, id);
ALTER TABLE public.crm_reclamations ADD CONSTRAINT crm_reclamations_client_id_fkey FOREIGN KEY (client_id) REFERENCES crm_clients(id) ON DELETE RESTRICT;
ALTER TABLE public.crm_reclamations ADD CONSTRAINT crm_reclamations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.app_personnes(id) ON DELETE SET NULL;
ALTER TABLE public.crm_reclamations ADD CONSTRAINT crm_reclamations_demande_id_fkey FOREIGN KEY (demande_id) REFERENCES crm_demandes(id) ON DELETE SET NULL;
ALTER TABLE public.crm_reclamations ADD CONSTRAINT crm_reclamations_responsable_id_fkey FOREIGN KEY (responsable_id) REFERENCES public.app_personnes(id) ON DELETE SET NULL;
ALTER TABLE public.crm_reponses ADD CONSTRAINT crm_reponses_demande_id_fkey FOREIGN KEY (demande_id) REFERENCES crm_demandes(id) ON DELETE CASCADE;
ALTER TABLE public.crm_reponses ADD CONSTRAINT crm_reponses_saisi_par_fkey FOREIGN KEY (saisi_par) REFERENCES public.app_personnes(id) ON DELETE SET NULL;
ALTER TABLE public.crm_satisfactions ADD CONSTRAINT crm_satisfactions_client_id_fkey FOREIGN KEY (client_id) REFERENCES crm_clients(id) ON DELETE RESTRICT;
ALTER TABLE public.crm_satisfactions ADD CONSTRAINT crm_satisfactions_demande_id_fkey FOREIGN KEY (demande_id) REFERENCES crm_demandes(id) ON DELETE RESTRICT;
ALTER TABLE public.crm_satisfactions ADD CONSTRAINT crm_satisfactions_demande_par_fkey FOREIGN KEY (demande_par) REFERENCES public.app_personnes(id) ON DELETE SET NULL;
ALTER TABLE public.crm_sections ADD CONSTRAINT crm_sections_questionnaire_id_fkey FOREIGN KEY (questionnaire_id) REFERENCES crm_questionnaires(id) ON DELETE CASCADE;
ALTER TABLE public.crm_tache_membres ADD CONSTRAINT crm_tache_membres_ajoute_par_fkey FOREIGN KEY (ajoute_par) REFERENCES public.app_personnes(id) ON DELETE SET NULL;
ALTER TABLE public.crm_tache_membres ADD CONSTRAINT crm_tache_membres_tache_id_fkey FOREIGN KEY (tache_id) REFERENCES crm_taches(id) ON DELETE CASCADE;
ALTER TABLE public.crm_tache_membres ADD CONSTRAINT crm_tache_membres_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_personnes(id) ON DELETE CASCADE;
ALTER TABLE public.crm_tache_pieces_jointes ADD CONSTRAINT crm_tache_pieces_jointes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.app_personnes(id) ON DELETE SET NULL;
ALTER TABLE public.crm_tache_pieces_jointes ADD CONSTRAINT crm_tache_pieces_jointes_tache_id_fkey FOREIGN KEY (tache_id) REFERENCES crm_taches(id) ON DELETE CASCADE;
ALTER TABLE public.crm_taches ADD CONSTRAINT crm_taches_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES public.app_personnes(id) ON DELETE SET NULL;
ALTER TABLE public.crm_taches ADD CONSTRAINT crm_taches_client_id_fkey FOREIGN KEY (client_id) REFERENCES crm_clients(id) ON DELETE CASCADE;
ALTER TABLE public.crm_taches ADD CONSTRAINT crm_taches_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE SET NULL;
ALTER TABLE public.crm_taches ADD CONSTRAINT crm_taches_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.app_personnes(id) ON DELETE SET NULL;
ALTER TABLE public.crm_taches ADD CONSTRAINT crm_taches_demande_id_fkey FOREIGN KEY (demande_id) REFERENCES crm_demandes(id) ON DELETE SET NULL;
ALTER TABLE public.crm_taches ADD CONSTRAINT crm_taches_terminee_par_fkey FOREIGN KEY (terminee_par) REFERENCES public.app_personnes(id) ON DELETE SET NULL;
ALTER TABLE public.crm_vues_enregistrees ADD CONSTRAINT crm_vues_enregistrees_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_personnes(id) ON DELETE CASCADE;

ALTER TABLE public.crm_propositions ADD CONSTRAINT crm_propositions_signature_taille_check CHECK (signature_image IS NULL OR length(signature_image) <= 1000000);
ALTER TABLE public.crm_notes_cadrage ADD CONSTRAINT crm_notes_cadrage_signature_taille_check CHECK (signature_image IS NULL OR length(signature_image) <= 1000000);

ALTER TABLE public.crm_activites ADD CONSTRAINT crm_activites_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.app_organisations(id);
ALTER TABLE public.crm_audit_log ADD CONSTRAINT crm_audit_log_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.app_organisations(id);
ALTER TABLE public.crm_clients ADD CONSTRAINT crm_clients_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.app_organisations(id);
ALTER TABLE public.crm_commentaires ADD CONSTRAINT crm_commentaires_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.app_organisations(id);
ALTER TABLE public.crm_consentements ADD CONSTRAINT crm_consentements_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.app_organisations(id);
ALTER TABLE public.crm_contacts ADD CONSTRAINT crm_contacts_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.app_organisations(id);
ALTER TABLE public.crm_demande_acces ADD CONSTRAINT crm_demande_acces_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.app_organisations(id);
ALTER TABLE public.crm_demande_enjeux ADD CONSTRAINT crm_demande_enjeux_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.app_organisations(id);
ALTER TABLE public.crm_demandes ADD CONSTRAINT crm_demandes_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.app_organisations(id);
ALTER TABLE public.crm_doublons_ignores ADD CONSTRAINT crm_doublons_ignores_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.app_organisations(id);
ALTER TABLE public.crm_entretien_creneaux ADD CONSTRAINT crm_entretien_creneaux_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.app_organisations(id);
ALTER TABLE public.crm_evenements ADD CONSTRAINT crm_evenements_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.app_organisations(id);
ALTER TABLE public.crm_factures ADD CONSTRAINT crm_factures_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.app_organisations(id);
ALTER TABLE public.crm_fichiers ADD CONSTRAINT crm_fichiers_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.app_organisations(id);
ALTER TABLE public.crm_financements ADD CONSTRAINT crm_financements_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.app_organisations(id);
ALTER TABLE public.crm_notes_cadrage ADD CONSTRAINT crm_notes_cadrage_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.app_organisations(id);
ALTER TABLE public.crm_notifications ADD CONSTRAINT crm_notifications_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.app_organisations(id);
ALTER TABLE public.crm_probabilites_statut ADD CONSTRAINT crm_probabilites_statut_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.app_organisations(id);
ALTER TABLE public.crm_proposition_lignes ADD CONSTRAINT crm_proposition_lignes_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.app_organisations(id);
ALTER TABLE public.crm_propositions ADD CONSTRAINT crm_propositions_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.app_organisations(id);
ALTER TABLE public.crm_reclamations ADD CONSTRAINT crm_reclamations_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.app_organisations(id);
ALTER TABLE public.crm_reponses ADD CONSTRAINT crm_reponses_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.app_organisations(id);
ALTER TABLE public.crm_reponses_historique ADD CONSTRAINT crm_reponses_historique_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.app_organisations(id);
ALTER TABLE public.crm_satisfactions ADD CONSTRAINT crm_satisfactions_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.app_organisations(id);
ALTER TABLE public.crm_tache_membres ADD CONSTRAINT crm_tache_membres_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.app_organisations(id);
ALTER TABLE public.crm_tache_pieces_jointes ADD CONSTRAINT crm_tache_pieces_jointes_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.app_organisations(id);
ALTER TABLE public.crm_taches ADD CONSTRAINT crm_taches_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.app_organisations(id);
ALTER TABLE public.crm_vues_enregistrees ADD CONSTRAINT crm_vues_enregistrees_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.app_organisations(id);

CREATE INDEX crm_idx_activites_client ON public.crm_activites USING btree (client_id, date_activite DESC);
CREATE INDEX crm_idx_audit_log_client ON public.crm_audit_log USING btree (client_id, created_at DESC);
CREATE INDEX crm_idx_audit_log_date ON public.crm_audit_log USING btree (created_at DESC);
CREATE INDEX crm_idx_audit_log_table ON public.crm_audit_log USING btree (table_name, created_at DESC);
CREATE UNIQUE INDEX crm_clients_siret_unique ON public.crm_clients USING btree (organisation_id, regexp_replace(siret, '\s'::text, ''::text, 'g'::text)) WHERE (NULLIF(TRIM(BOTH FROM siret), ''::text) IS NOT NULL);
CREATE INDEX crm_idx_commentaires_demande ON public.crm_commentaires USING btree (demande_id);
CREATE UNIQUE INDEX crm_contacts_email_unique ON public.crm_contacts USING btree (client_id, lower(email)) WHERE (email IS NOT NULL);
CREATE UNIQUE INDEX crm_contacts_un_principal ON public.crm_contacts USING btree (client_id) WHERE principal;
CREATE INDEX crm_idx_contacts_client ON public.crm_contacts USING btree (client_id);
CREATE INDEX crm_idx_demande_acces_user ON public.crm_demande_acces USING btree (user_id);
CREATE INDEX crm_idx_demandes_client ON public.crm_demandes USING btree (client_id);
CREATE INDEX crm_idx_demandes_consultant ON public.crm_demandes USING btree (consultant_id);
CREATE INDEX crm_idx_demandes_statut ON public.crm_demandes USING btree (statut);
CREATE INDEX crm_idx_evenements_demande ON public.crm_evenements USING btree (demande_id);
CREATE INDEX crm_idx_factures_demande ON public.crm_factures USING btree (demande_id);
CREATE UNIQUE INDEX crm_uq_factures_numero ON public.crm_factures USING btree (organisation_id, numero) WHERE (numero IS NOT NULL);
CREATE INDEX crm_idx_fichiers_demande ON public.crm_fichiers USING btree (demande_id);
CREATE INDEX crm_idx_financements_demande ON public.crm_financements USING btree (demande_id);
CREATE INDEX crm_notifications_destinataire_idx ON public.crm_notifications USING btree (destinataire, lu, created_at DESC);
CREATE INDEX crm_idx_reclamations_client ON public.crm_reclamations USING btree (client_id, date_reception DESC);
CREATE INDEX crm_idx_reclamations_statut ON public.crm_reclamations USING btree (statut);
CREATE INDEX crm_idx_reponses_demande ON public.crm_reponses USING btree (demande_id);
CREATE INDEX crm_idx_satisfactions_client ON public.crm_satisfactions USING btree (client_id);
CREATE INDEX crm_idx_satisfactions_statut ON public.crm_satisfactions USING btree (statut);
CREATE INDEX crm_idx_tache_membres_user ON public.crm_tache_membres USING btree (user_id);
CREATE INDEX crm_idx_tache_pieces_tache ON public.crm_tache_pieces_jointes USING btree (tache_id);
CREATE INDEX crm_idx_taches_assignee ON public.crm_taches USING btree (assignee_id, statut, echeance);
CREATE INDEX crm_idx_taches_client ON public.crm_taches USING btree (client_id);
CREATE UNIQUE INDEX crm_uq_vues_enregistrees_nom ON public.crm_vues_enregistrees USING btree (organisation_id, user_id, ecran, lower(btrim(nom)));

CREATE INDEX crm_activites_organisation_idx ON public.crm_activites (organisation_id);
CREATE INDEX crm_audit_log_organisation_idx ON public.crm_audit_log (organisation_id);
CREATE INDEX crm_clients_organisation_idx ON public.crm_clients (organisation_id);
CREATE INDEX crm_commentaires_organisation_idx ON public.crm_commentaires (organisation_id);
CREATE INDEX crm_consentements_organisation_idx ON public.crm_consentements (organisation_id);
CREATE INDEX crm_contacts_organisation_idx ON public.crm_contacts (organisation_id);
CREATE INDEX crm_demande_acces_organisation_idx ON public.crm_demande_acces (organisation_id);
CREATE INDEX crm_demande_enjeux_organisation_idx ON public.crm_demande_enjeux (organisation_id);
CREATE INDEX crm_demandes_organisation_idx ON public.crm_demandes (organisation_id);
CREATE INDEX crm_doublons_ignores_organisation_idx ON public.crm_doublons_ignores (organisation_id);
CREATE INDEX crm_entretien_creneaux_organisation_idx ON public.crm_entretien_creneaux (organisation_id);
CREATE INDEX crm_evenements_organisation_idx ON public.crm_evenements (organisation_id);
CREATE INDEX crm_factures_organisation_idx ON public.crm_factures (organisation_id);
CREATE INDEX crm_fichiers_organisation_idx ON public.crm_fichiers (organisation_id);
CREATE INDEX crm_financements_organisation_idx ON public.crm_financements (organisation_id);
CREATE INDEX crm_notes_cadrage_organisation_idx ON public.crm_notes_cadrage (organisation_id);
CREATE INDEX crm_notifications_organisation_idx ON public.crm_notifications (organisation_id);
CREATE INDEX crm_probabilites_statut_organisation_idx ON public.crm_probabilites_statut (organisation_id);
CREATE INDEX crm_proposition_lignes_organisation_idx ON public.crm_proposition_lignes (organisation_id);
CREATE INDEX crm_propositions_organisation_idx ON public.crm_propositions (organisation_id);
CREATE INDEX crm_reclamations_organisation_idx ON public.crm_reclamations (organisation_id);
CREATE INDEX crm_reponses_organisation_idx ON public.crm_reponses (organisation_id);
CREATE INDEX crm_reponses_historique_organisation_idx ON public.crm_reponses_historique (organisation_id);
CREATE INDEX crm_satisfactions_organisation_idx ON public.crm_satisfactions (organisation_id);
CREATE INDEX crm_tache_membres_organisation_idx ON public.crm_tache_membres (organisation_id);
CREATE INDEX crm_tache_pieces_jointes_organisation_idx ON public.crm_tache_pieces_jointes (organisation_id);
CREATE INDEX crm_taches_organisation_idx ON public.crm_taches (organisation_id);
CREATE INDEX crm_vues_enregistrees_organisation_idx ON public.crm_vues_enregistrees (organisation_id);
