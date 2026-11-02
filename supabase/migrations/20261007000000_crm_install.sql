-- ============================================================================
-- RD Recueil (CRM RD Formation) : installation complete de la base de donnees
-- Tous les objets portent le prefixe « crm_ » : tables, vues, fonctions, index et contraintes.
-- A executer une seule fois dans un projet Supabase vide (editeur SQL ou `supabase db push`),
-- puis charger supabase/seed/seed_v1.sql (questionnaire, glossaire, probabilites).
-- Genere le 2026-10-07 a partir de la base de production (schema public, stockage, declencheur
-- sur auth.users). Voir docs/INSTALLATION_SUPABASE.md.
-- ============================================================================

set check_function_bodies = off;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

-- ─── Sequence ──────────────────────────────────────────────────────────────

CREATE SEQUENCE public.crm_demande_seq AS bigint START WITH 1 INCREMENT BY 1 MINVALUE 1 NO CYCLE;

-- ─── Tables ───────────────────────────────────────────────────────────────

CREATE TABLE public.crm_activites (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  client_id uuid NOT NULL,
  contact_id uuid,
  demande_id uuid,
  auteur uuid DEFAULT auth.uid(),
  type text NOT NULL,
  objet text NOT NULL,
  description text,
  date_activite timestamp with time zone DEFAULT now() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.crm_audit_log (
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
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  demande_id uuid,
  cible text NOT NULL,
  auteur uuid,
  texte text NOT NULL,
  interne boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.crm_consentements (
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
  demande_id uuid NOT NULL,
  email text NOT NULL,
  user_id uuid,
  droit text DEFAULT 'editeur'::text NOT NULL,
  invite_le timestamp with time zone DEFAULT now()
);

CREATE TABLE public.crm_demande_enjeux (
  demande_id uuid NOT NULL,
  montant_estime numeric(12,2),
  probabilite smallint,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.crm_demandes (
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
  client_a uuid NOT NULL,
  client_b uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid DEFAULT auth.uid()
);

CREATE TABLE public.crm_entretien_creneaux (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  demande_id uuid,
  debut timestamp with time zone NOT NULL,
  fin timestamp with time zone NOT NULL,
  choisi boolean DEFAULT false NOT NULL
);

CREATE TABLE public.crm_evenements (
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
  statut text NOT NULL,
  pourcentage smallint NOT NULL
);

CREATE TABLE public.crm_profils (
  user_id uuid NOT NULL,
  role text NOT NULL,
  nom text,
  email text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  doit_changer_mot_de_passe boolean DEFAULT false NOT NULL
);

CREATE TABLE public.crm_proposition_lignes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  proposition_id uuid,
  ordre smallint DEFAULT 0 NOT NULL,
  designation text NOT NULL,
  quantite numeric DEFAULT 1 NOT NULL,
  prix_unitaire numeric DEFAULT 0 NOT NULL,
  total numeric GENERATED ALWAYS AS ((quantite * prix_unitaire)) STORED
);

CREATE TABLE public.crm_propositions (
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
  created_by uuid DEFAULT auth.uid(),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  origine text DEFAULT 'equipe'::text NOT NULL
);

CREATE TABLE public.crm_reponses (
  demande_id uuid NOT NULL,
  question_id text NOT NULL,
  valeur jsonb,
  nsp boolean DEFAULT false,
  annotation_consultant text,
  saisi_par uuid,
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.crm_reponses_historique (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  demande_id uuid,
  question_id text,
  ancienne_valeur jsonb,
  nouvelle_valeur jsonb,
  auteur uuid,
  modifie_le timestamp with time zone DEFAULT now()
);

CREATE TABLE public.crm_satisfactions (
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
  demande_par uuid DEFAULT auth.uid(),
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
  tache_id uuid NOT NULL,
  user_id uuid NOT NULL,
  ajoute_par uuid DEFAULT auth.uid(),
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.crm_tache_pieces_jointes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  tache_id uuid NOT NULL,
  nom text NOT NULL,
  chemin text NOT NULL,
  taille bigint NOT NULL,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.crm_taches (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  client_id uuid NOT NULL,
  contact_id uuid,
  demande_id uuid,
  assignee_id uuid,
  created_by uuid DEFAULT auth.uid(),
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
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid DEFAULT auth.uid() NOT NULL,
  ecran text NOT NULL,
  nom text NOT NULL,
  filtres jsonb DEFAULT '[]'::jsonb NOT NULL,
  tri jsonb,
  recherche text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);


-- ─── Contraintes (cles primaires, uniques, controles, cles etrangeres) ───

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
ALTER TABLE public.crm_probabilites_statut ADD CONSTRAINT crm_probabilites_statut_pkey PRIMARY KEY (statut);
ALTER TABLE public.crm_profils ADD CONSTRAINT crm_profils_pkey PRIMARY KEY (user_id);
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
ALTER TABLE public.crm_profils ADD CONSTRAINT crm_profils_email_key UNIQUE (email);
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
ALTER TABLE public.crm_profils ADD CONSTRAINT crm_profils_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'consultant'::text, 'client'::text])));
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
ALTER TABLE public.crm_activites ADD CONSTRAINT crm_activites_auteur_fkey FOREIGN KEY (auteur) REFERENCES crm_profils(user_id) ON DELETE SET NULL;
ALTER TABLE public.crm_activites ADD CONSTRAINT crm_activites_client_id_fkey FOREIGN KEY (client_id) REFERENCES crm_clients(id) ON DELETE CASCADE;
ALTER TABLE public.crm_activites ADD CONSTRAINT crm_activites_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE SET NULL;
ALTER TABLE public.crm_activites ADD CONSTRAINT crm_activites_demande_id_fkey FOREIGN KEY (demande_id) REFERENCES crm_demandes(id) ON DELETE SET NULL;
ALTER TABLE public.crm_clients ADD CONSTRAINT crm_clients_responsable_id_fkey FOREIGN KEY (responsable_id) REFERENCES crm_profils(user_id) ON DELETE SET NULL;
ALTER TABLE public.crm_commentaires ADD CONSTRAINT crm_commentaires_auteur_fkey FOREIGN KEY (auteur) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.crm_commentaires ADD CONSTRAINT crm_commentaires_demande_id_fkey FOREIGN KEY (demande_id) REFERENCES crm_demandes(id) ON DELETE CASCADE;
ALTER TABLE public.crm_consentements ADD CONSTRAINT crm_consentements_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE CASCADE;
ALTER TABLE public.crm_contacts ADD CONSTRAINT crm_contacts_client_id_fkey FOREIGN KEY (client_id) REFERENCES crm_clients(id) ON DELETE CASCADE;
ALTER TABLE public.crm_demande_acces ADD CONSTRAINT crm_demande_acces_demande_id_fkey FOREIGN KEY (demande_id) REFERENCES crm_demandes(id) ON DELETE CASCADE;
ALTER TABLE public.crm_demande_acces ADD CONSTRAINT crm_demande_acces_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.crm_demande_enjeux ADD CONSTRAINT crm_demande_enjeux_demande_id_fkey FOREIGN KEY (demande_id) REFERENCES crm_demandes(id) ON DELETE CASCADE;
ALTER TABLE public.crm_demandes ADD CONSTRAINT crm_demandes_client_id_fkey FOREIGN KEY (client_id) REFERENCES crm_clients(id);
ALTER TABLE public.crm_demandes ADD CONSTRAINT crm_demandes_consultant_id_fkey FOREIGN KEY (consultant_id) REFERENCES crm_profils(user_id);
ALTER TABLE public.crm_demandes ADD CONSTRAINT crm_demandes_questionnaire_id_fkey FOREIGN KEY (questionnaire_id) REFERENCES crm_questionnaires(id);
ALTER TABLE public.crm_doublons_ignores ADD CONSTRAINT crm_doublons_ignores_client_a_fkey FOREIGN KEY (client_a) REFERENCES crm_clients(id) ON DELETE CASCADE;
ALTER TABLE public.crm_doublons_ignores ADD CONSTRAINT crm_doublons_ignores_client_b_fkey FOREIGN KEY (client_b) REFERENCES crm_clients(id) ON DELETE CASCADE;
ALTER TABLE public.crm_doublons_ignores ADD CONSTRAINT crm_doublons_ignores_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.crm_entretien_creneaux ADD CONSTRAINT crm_entretien_creneaux_demande_id_fkey FOREIGN KEY (demande_id) REFERENCES crm_demandes(id) ON DELETE CASCADE;
ALTER TABLE public.crm_evenements ADD CONSTRAINT crm_evenements_auteur_fkey FOREIGN KEY (auteur) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.crm_evenements ADD CONSTRAINT crm_evenements_demande_id_fkey FOREIGN KEY (demande_id) REFERENCES crm_demandes(id) ON DELETE CASCADE;
ALTER TABLE public.crm_factures ADD CONSTRAINT crm_factures_demande_id_fkey FOREIGN KEY (demande_id) REFERENCES crm_demandes(id) ON DELETE RESTRICT;
ALTER TABLE public.crm_fichiers ADD CONSTRAINT crm_fichiers_demande_id_fkey FOREIGN KEY (demande_id) REFERENCES crm_demandes(id) ON DELETE CASCADE;
ALTER TABLE public.crm_fichiers ADD CONSTRAINT crm_fichiers_depose_par_fkey FOREIGN KEY (depose_par) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.crm_financements ADD CONSTRAINT crm_financements_demande_id_fkey FOREIGN KEY (demande_id) REFERENCES crm_demandes(id) ON DELETE CASCADE;
ALTER TABLE public.crm_glossaire ADD CONSTRAINT crm_glossaire_questionnaire_id_fkey FOREIGN KEY (questionnaire_id) REFERENCES crm_questionnaires(id) ON DELETE CASCADE;
ALTER TABLE public.crm_notes_cadrage ADD CONSTRAINT crm_notes_cadrage_demande_id_fkey FOREIGN KEY (demande_id) REFERENCES crm_demandes(id) ON DELETE CASCADE;
ALTER TABLE public.crm_notes_cadrage ADD CONSTRAINT crm_notes_cadrage_validee_par_fkey FOREIGN KEY (validee_par) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.crm_notifications ADD CONSTRAINT crm_notifications_demande_id_fkey FOREIGN KEY (demande_id) REFERENCES crm_demandes(id) ON DELETE CASCADE;
ALTER TABLE public.crm_notifications ADD CONSTRAINT crm_notifications_destinataire_fkey FOREIGN KEY (destinataire) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.crm_profils ADD CONSTRAINT crm_profils_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.crm_proposition_lignes ADD CONSTRAINT crm_proposition_lignes_proposition_id_fkey FOREIGN KEY (proposition_id) REFERENCES crm_propositions(id) ON DELETE CASCADE;
ALTER TABLE public.crm_propositions ADD CONSTRAINT crm_propositions_decidee_par_fkey FOREIGN KEY (decidee_par) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.crm_propositions ADD CONSTRAINT crm_propositions_demande_id_fkey FOREIGN KEY (demande_id) REFERENCES crm_demandes(id) ON DELETE CASCADE;
ALTER TABLE public.crm_questions ADD CONSTRAINT crm_questions_questionnaire_id_fkey FOREIGN KEY (questionnaire_id) REFERENCES crm_questionnaires(id) ON DELETE CASCADE;
ALTER TABLE public.crm_questions ADD CONSTRAINT crm_questions_questionnaire_id_section_id_fkey FOREIGN KEY (questionnaire_id, section_id) REFERENCES crm_sections(questionnaire_id, id);
ALTER TABLE public.crm_reclamations ADD CONSTRAINT crm_reclamations_client_id_fkey FOREIGN KEY (client_id) REFERENCES crm_clients(id) ON DELETE RESTRICT;
ALTER TABLE public.crm_reclamations ADD CONSTRAINT crm_reclamations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.crm_reclamations ADD CONSTRAINT crm_reclamations_demande_id_fkey FOREIGN KEY (demande_id) REFERENCES crm_demandes(id) ON DELETE SET NULL;
ALTER TABLE public.crm_reclamations ADD CONSTRAINT crm_reclamations_responsable_id_fkey FOREIGN KEY (responsable_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.crm_reponses ADD CONSTRAINT crm_reponses_demande_id_fkey FOREIGN KEY (demande_id) REFERENCES crm_demandes(id) ON DELETE CASCADE;
ALTER TABLE public.crm_reponses ADD CONSTRAINT crm_reponses_saisi_par_fkey FOREIGN KEY (saisi_par) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.crm_satisfactions ADD CONSTRAINT crm_satisfactions_client_id_fkey FOREIGN KEY (client_id) REFERENCES crm_clients(id) ON DELETE RESTRICT;
ALTER TABLE public.crm_satisfactions ADD CONSTRAINT crm_satisfactions_demande_id_fkey FOREIGN KEY (demande_id) REFERENCES crm_demandes(id) ON DELETE RESTRICT;
ALTER TABLE public.crm_satisfactions ADD CONSTRAINT crm_satisfactions_demande_par_fkey FOREIGN KEY (demande_par) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.crm_sections ADD CONSTRAINT crm_sections_questionnaire_id_fkey FOREIGN KEY (questionnaire_id) REFERENCES crm_questionnaires(id) ON DELETE CASCADE;
ALTER TABLE public.crm_tache_membres ADD CONSTRAINT crm_tache_membres_ajoute_par_fkey FOREIGN KEY (ajoute_par) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.crm_tache_membres ADD CONSTRAINT crm_tache_membres_tache_id_fkey FOREIGN KEY (tache_id) REFERENCES crm_taches(id) ON DELETE CASCADE;
ALTER TABLE public.crm_tache_membres ADD CONSTRAINT crm_tache_membres_user_id_fkey FOREIGN KEY (user_id) REFERENCES crm_profils(user_id) ON DELETE CASCADE;
ALTER TABLE public.crm_tache_pieces_jointes ADD CONSTRAINT crm_tache_pieces_jointes_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.crm_tache_pieces_jointes ADD CONSTRAINT crm_tache_pieces_jointes_tache_id_fkey FOREIGN KEY (tache_id) REFERENCES crm_taches(id) ON DELETE CASCADE;
ALTER TABLE public.crm_taches ADD CONSTRAINT crm_taches_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES crm_profils(user_id) ON DELETE SET NULL;
ALTER TABLE public.crm_taches ADD CONSTRAINT crm_taches_client_id_fkey FOREIGN KEY (client_id) REFERENCES crm_clients(id) ON DELETE CASCADE;
ALTER TABLE public.crm_taches ADD CONSTRAINT crm_taches_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE SET NULL;
ALTER TABLE public.crm_taches ADD CONSTRAINT crm_taches_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.crm_taches ADD CONSTRAINT crm_taches_demande_id_fkey FOREIGN KEY (demande_id) REFERENCES crm_demandes(id) ON DELETE SET NULL;
ALTER TABLE public.crm_taches ADD CONSTRAINT crm_taches_terminee_par_fkey FOREIGN KEY (terminee_par) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.crm_vues_enregistrees ADD CONSTRAINT crm_vues_enregistrees_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ─── Index ─────────────────────────────────────────────────────────────────

CREATE INDEX crm_idx_activites_client ON public.crm_activites USING btree (client_id, date_activite DESC);
CREATE INDEX crm_idx_audit_log_client ON public.crm_audit_log USING btree (client_id, created_at DESC);
CREATE INDEX crm_idx_audit_log_date ON public.crm_audit_log USING btree (created_at DESC);
CREATE INDEX crm_idx_audit_log_table ON public.crm_audit_log USING btree (table_name, created_at DESC);
CREATE UNIQUE INDEX crm_clients_siret_unique ON public.crm_clients USING btree (regexp_replace(siret, '\s'::text, ''::text, 'g'::text)) WHERE (NULLIF(TRIM(BOTH FROM siret), ''::text) IS NOT NULL);
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
CREATE UNIQUE INDEX crm_uq_factures_numero ON public.crm_factures USING btree (numero) WHERE (numero IS NOT NULL);
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
CREATE UNIQUE INDEX crm_uq_vues_enregistrees_nom ON public.crm_vues_enregistrees USING btree (user_id, ecran, lower(btrim(nom)));

-- ─── Fonctions (droits, declencheurs, flux de la demande) ─────────────────

CREATE OR REPLACE FUNCTION public.crm_a_acces(p_demande_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from crm_demande_acces
    where demande_id = p_demande_id and user_id = auth.uid()
  );
$function$;

CREATE OR REPLACE FUNCTION public.crm_acces_demande(p_demande_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select crm_peut_voir_demande(p_demande_id)
    or exists (select 1 from crm_demande_acces da where da.demande_id = p_demande_id and da.user_id = auth.uid());
$function$;

CREATE OR REPLACE FUNCTION public.crm_client_peut_ecrire_reponse(p_demande_id uuid, p_question_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from crm_demande_acces da
    join crm_demandes d on d.id = p_demande_id
    join crm_questions q on q.questionnaire_id = d.questionnaire_id and q.id = p_question_id
    where da.demande_id = p_demande_id
      and da.user_id = auth.uid()
      and da.droit = 'editeur'
      and q.rempli_par in ('C', 'C/F')
      and d.statut in ('envoyee', 'en_saisie')
  );
$function$;

CREATE OR REPLACE FUNCTION public.crm_est_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from crm_profils where user_id = auth.uid() and role = 'admin');
$function$;

CREATE OR REPLACE FUNCTION public.crm_est_membre_tache(p_tache uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from crm_tache_membres m where m.tache_id = p_tache and m.user_id = auth.uid());
$function$;

CREATE OR REPLACE FUNCTION public.crm_est_staff()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from crm_profils where user_id = auth.uid() and role in ('admin', 'consultant')
  );
$function$;

CREATE OR REPLACE FUNCTION public.crm_fn_attribuer_client()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.responsable_id is null and auth.uid() is not null and not crm_est_admin() then
    new.responsable_id := auth.uid();
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_fn_attribuer_demande()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.consultant_id is null and auth.uid() is not null and not crm_est_admin() then
    new.consultant_id := auth.uid();
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_fn_audit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_table text := regexp_replace(tg_table_name, '^crm_', '');
  v_ancien jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_nouveau jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_ligne jsonb := coalesce(to_jsonb(new), to_jsonb(old));
  v_changes jsonb := '{}'::jsonb;
  v_cle text;
  v_avant jsonb;
  v_apres jsonb;
  v_demande uuid;
  v_client uuid;
  v_libelle text;
  v_auteur text;
begin
  for v_cle in select jsonb_object_keys(v_ligne) loop
    continue when v_cle in ('created_at', 'updated_at');
    v_avant := coalesce(v_ancien -> v_cle, 'null'::jsonb);
    v_apres := coalesce(v_nouveau -> v_cle, 'null'::jsonb);
    if v_avant <> v_apres then
      v_changes := v_changes || jsonb_build_object(v_cle, jsonb_build_array(v_avant, v_apres));
    end if;
  end loop;

  if tg_op = 'UPDATE' and v_changes = '{}'::jsonb then
    return null;
  end if;

  v_demande := case v_table when 'demandes' then (v_ligne ->> 'id')::uuid else (v_ligne ->> 'demande_id')::uuid end;
  v_client := case v_table
    when 'clients' then (v_ligne ->> 'id')::uuid
    when 'financements' then (select d.client_id from crm_demandes d where d.id = v_demande)
    when 'factures' then (select d.client_id from crm_demandes d where d.id = v_demande)
    when 'demande_enjeux' then (select d.client_id from crm_demandes d where d.id = v_demande)
    when 'consentements' then (select k.client_id from crm_contacts k where k.id = (v_ligne ->> 'contact_id')::uuid)
    else (v_ligne ->> 'client_id')::uuid
  end;
  v_libelle := case v_table
    when 'clients' then v_ligne ->> 'raison_sociale'
    when 'contacts' then nullif(btrim(concat_ws(' ', v_ligne ->> 'prenom', v_ligne ->> 'nom')), '')
    when 'demandes' then v_ligne ->> 'reference'
    when 'taches' then v_ligne ->> 'titre'
    when 'activites' then v_ligne ->> 'objet'
    when 'financements' then nullif(btrim(concat_ws(' ', v_ligne ->> 'type', v_ligne ->> 'organisme')), '')
    when 'factures' then coalesce('n° ' || nullif(v_ligne ->> 'numero', ''), v_ligne ->> 'libelle')
    when 'consentements' then concat_ws(' : ', (select nullif(btrim(concat_ws(' ', k.prenom, k.nom)), '') from crm_contacts k where k.id = (v_ligne ->> 'contact_id')::uuid), v_ligne ->> 'type')
    when 'reclamations' then v_ligne ->> 'objet'
    when 'satisfactions' then v_ligne ->> 'moment'
    else null
  end;

  if auth.uid() is null then
    v_auteur := 'Système';
  else
    select coalesce(nullif(btrim(p.nom), ''), p.email) into v_auteur from crm_profils p where p.user_id = auth.uid();
    v_auteur := coalesce(v_auteur, 'Compte inconnu');
  end if;

  insert into crm_audit_log (user_id, auteur, action, table_name, record_id, client_id, demande_id, libelle, changes)
  values (
    auth.uid(),
    v_auteur,
    lower(tg_op),
    v_table,
    coalesce((v_ligne ->> 'id')::uuid, (v_ligne ->> 'demande_id')::uuid),
    v_client,
    v_demande,
    v_libelle,
    v_changes
  );
  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_fn_consentement_maj()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.statut = 'retire' then
    new.date_retrait := coalesce(new.date_retrait, current_date);
  else
    new.date_retrait := null;
  end if;
  new.updated_at := now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_fn_gerer_nouvel_utilisateur()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update crm_demande_acces set user_id = new.id where email = new.email and user_id is null;

  if not exists (select 1 from crm_profils where user_id = new.id)
     and exists (select 1 from crm_demande_acces where email = new.email) then
    insert into crm_profils (user_id, role, email) values (new.id, 'client', new.email);
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_fn_historiser_reponse()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if old.valeur is distinct from new.valeur then
    insert into crm_reponses_historique (demande_id, question_id, ancienne_valeur, nouvelle_valeur, auteur)
    values (old.demande_id, old.question_id, old.valeur, new.valeur, new.saisi_par);
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_fn_notifier_evenement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_titre text;
  v_vers_staff boolean;
  v_reference text;
begin
  if new.type <> 'statut' then
    return new;
  end if;

  v_titre := case new.vers
    when 'soumise' then 'Nouvelles réponses soumises'
    when 'cadrage_envoye' then 'Note de cadrage envoyée'
    when 'cadrage_a_revoir' then 'Modification demandée sur la note de cadrage'
    when 'cadrage_valide' then 'Note de cadrage validée'
    when 'proposition_envoyee' then 'Proposition commerciale envoyée'
    when 'gagnee' then 'Proposition acceptée'
    when 'perdue' then 'Proposition refusée'
    when 'entretien_planifie' then 'Entretien planifié'
    else null
  end;

  if v_titre is null then
    return new;
  end if;

  select reference into v_reference from crm_demandes where id = new.demande_id;
  v_vers_staff := new.vers in ('soumise', 'cadrage_a_revoir', 'cadrage_valide', 'gagnee', 'perdue', 'entretien_planifie');

  if v_vers_staff then
    insert into crm_notifications (destinataire, demande_id, reference, type, titre)
    select p.user_id, new.demande_id, v_reference, new.vers, v_titre
    from crm_profils p
    where p.role = 'admin'
       or (p.role = 'consultant' and p.user_id = (select d.consultant_id from crm_demandes d where d.id = new.demande_id));
  else
    insert into crm_notifications (destinataire, demande_id, reference, type, titre)
    select da.user_id, new.demande_id, v_reference, new.vers, v_titre
    from crm_demande_acces da
    where da.demande_id = new.demande_id and da.user_id is not null;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_fn_notifier_membre_tache()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_titre text;
begin
  if new.user_id is not distinct from auth.uid() then
    return new;
  end if;

  select titre into v_titre from crm_taches where id = new.tache_id;
  insert into crm_notifications (destinataire, reference, type, titre, lien)
  values (new.user_id, 'Tâche', 'tache', 'Vous êtes ajouté à la tâche : ' || coalesce(v_titre, ''), '/taches');
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_fn_notifier_satisfaction()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_reference text;
begin
  if new.statut <> 'demandee' then
    return null;
  end if;
  select d.reference into v_reference from crm_demandes d where d.id = new.demande_id;
  insert into crm_notifications (destinataire, demande_id, reference, type, titre, lien)
  select distinct da.user_id, new.demande_id, v_reference, 'satisfaction', 'Votre avis nous intéresse', '#/accueil'
  from crm_demande_acces da
  join crm_profils p on p.user_id = da.user_id
  where da.demande_id = new.demande_id and da.user_id is not null and p.role = 'client';
  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_fn_notifier_tache()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_client text;
begin
  if new.assignee_id is null or new.assignee_id is not distinct from auth.uid() then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.assignee_id is not distinct from old.assignee_id then
    return new;
  end if;

  select raison_sociale into v_client from crm_clients where id = new.client_id;
  insert into crm_notifications (destinataire, demande_id, reference, type, titre, lien)
  values (new.assignee_id, new.demande_id, coalesce(v_client, 'Client'), 'tache', 'Nouvelle tâche : ' || new.titre, '/clients/' || new.client_id || '/activite');
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_fn_premiere_saisie()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_role text;
  v_statut text;
begin
  select role into v_role from crm_profils where user_id = new.saisi_par;
  select statut into v_statut from crm_demandes where id = new.demande_id;

  if v_role = 'client' and v_statut = 'envoyee' then
    update crm_demandes set statut = 'en_saisie', updated_at = now() where id = new.demande_id;
    insert into crm_evenements (demande_id, type, de, vers, auteur, commentaire)
    values (new.demande_id, 'statut', 'envoyee', 'en_saisie', new.saisi_par, 'Première réponse du client');
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_fn_proteger_assignation_client()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.responsable_id is distinct from old.responsable_id and auth.uid() is not null and not crm_est_admin() then
    raise exception 'Seul l''administrateur peut changer le responsable d''un client.';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_fn_proteger_assignation_demande()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.consultant_id is distinct from old.consultant_id and auth.uid() is not null and not crm_est_admin() then
    raise exception 'Seul l''administrateur peut changer le consultant d''une demande.';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_fn_reclamation_maj()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.statut = 'cloturee' then
    new.date_cloture := coalesce(new.date_cloture, current_date);
  else
    new.date_cloture := null;
  end if;
  if new.demande_id is not null
     and not exists (select 1 from crm_demandes d where d.id = new.demande_id and d.client_id = new.client_id) then
    raise exception 'La demande n''appartient pas a ce client';
  end if;
  if tg_op = 'INSERT' and new.responsable_id is null and crm_est_staff() then
    new.responsable_id := auth.uid();
  end if;
  new.updated_at := now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_fn_reference()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.reference is null then
    new.reference := 'RDF-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('crm_demande_seq')::text, 4, '0');
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_fn_satisfaction_maj()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' then
    select d.client_id into new.client_id from crm_demandes d where d.id = new.demande_id;
    if new.client_id is null then
      raise exception 'Cette demande n''est rattachee a aucun client';
    end if;
  elsif new.demande_id <> old.demande_id or new.moment <> old.moment then
    raise exception 'La demande et le moment d''un avis ne se modifient pas';
  end if;
  if new.statut = 'recue' then
    new.date_reponse := coalesce(new.date_reponse, current_date);
    new.origine := coalesce(new.origine, case when crm_est_staff() then 'staff' else 'client' end);
  else
    new.note := null;
    new.date_reponse := null;
    new.origine := null;
  end if;
  new.updated_at := now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_fn_tache_maj()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at := now();
  if new.statut = 'terminee' and old.statut <> 'terminee' then
    new.terminee_le := now();
    new.terminee_par := auth.uid();
  elsif new.statut <> 'terminee' then
    new.terminee_le := null;
    new.terminee_par := null;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_fn_touch()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_peut_voir_client(p_client_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select crm_est_admin() or (crm_est_staff() and (
    exists (select 1 from crm_clients c where c.id = p_client_id and c.responsable_id = auth.uid())
    or exists (select 1 from crm_demandes d where d.client_id = p_client_id and d.consultant_id = auth.uid())
  ));
$function$;

CREATE OR REPLACE FUNCTION public.crm_peut_voir_demande(p_demande_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select crm_est_admin() or exists (
    select 1 from crm_demandes d
    where d.id = p_demande_id and d.consultant_id = auth.uid() and crm_est_staff()
  );
$function$;

CREATE OR REPLACE FUNCTION public.crm_peut_voir_tache(p_tache uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select crm_est_admin() or (crm_est_staff() and exists (
    select 1 from crm_taches t
    where t.id = p_tache and (t.assignee_id = auth.uid() or crm_est_membre_tache(t.id))
  ));
$function$;

CREATE OR REPLACE FUNCTION public.crm_peut_voir_tache_chemin(p_nom text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when (storage.foldername(p_nom))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then crm_peut_voir_tache(((storage.foldername(p_nom))[1])::uuid)
    else false
  end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_rpc_accepter_proposition(p_proposition_id uuid, p_signature_image text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_demande_id uuid;
  v_credential text;
begin
  if p_signature_image is null or length(trim(p_signature_image)) = 0 then
    raise exception 'La signature est obligatoire pour accepter la proposition';
  end if;

  select demande_id into v_demande_id from crm_propositions where id = p_proposition_id;
  if v_demande_id is null or not crm_acces_demande(v_demande_id) then
    raise exception 'Proposition introuvable : %', p_proposition_id;
  end if;

  v_credential := to_char(floor(random() * 1000000)::int, 'FM000000')
    || '-' || to_char(floor(random() * 1000000)::int, 'FM000000');

  update crm_propositions
  set statut = 'acceptee',
      decidee_le = now(),
      decidee_par = auth.uid(),
      signature_image = p_signature_image,
      signature_credential = v_credential
  where id = p_proposition_id;

  perform set_config('app.transition_client_via_rpc', 'on', true);
  perform crm_rpc_changer_statut(v_demande_id, 'gagnee', 'Proposition acceptée par le client');
  perform set_config('app.transition_client_via_rpc', 'off', true);
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_rpc_archiver_demande(p_demande_id uuid, p_archiver boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not crm_peut_voir_demande(p_demande_id) then
    raise exception 'Demande introuvable : %', p_demande_id;
  end if;

  update crm_demandes
  set archivee = p_archiver, archivee_le = case when p_archiver then now() else null end
  where id = p_demande_id;

  insert into crm_evenements (demande_id, type, vers, auteur)
  values (p_demande_id, 'archive', case when p_archiver then 'archivee' else 'desarchivee' end, auth.uid());
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_rpc_assigner_demande(p_demande_id uuid, p_consultant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_nom text;
  v_reference text;
begin
  if not crm_est_admin() then
    raise exception 'Réservé à l''administrateur.';
  end if;

  select coalesce(nullif(trim(nom), ''), email) into v_nom
  from crm_profils where user_id = p_consultant_id and role in ('admin', 'consultant');
  if v_nom is null then
    raise exception 'Consultant introuvable.';
  end if;

  update crm_demandes set consultant_id = p_consultant_id where id = p_demande_id returning reference into v_reference;
  if v_reference is null then
    raise exception 'Demande introuvable : %', p_demande_id;
  end if;

  insert into crm_evenements (demande_id, type, vers, auteur, commentaire)
  values (p_demande_id, 'assignation', 'assignee', auth.uid(), v_nom);

  if p_consultant_id is distinct from auth.uid() then
    insert into crm_notifications (destinataire, demande_id, reference, type, titre)
    values (p_consultant_id, p_demande_id, v_reference, 'assignation', 'Demande attribuée');
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_rpc_changer_statut(p_demande_id uuid, p_vers text, p_commentaire text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_statut_actuel text;
  v_role text;
  v_transitions_valides text[];
  v_via_fonction boolean := coalesce(current_setting('app.transition_client_via_rpc', true), '') = 'on';
begin
  if not crm_acces_demande(p_demande_id) then
    raise exception 'Demande introuvable : %', p_demande_id;
  end if;

  select statut into v_statut_actuel from crm_demandes where id = p_demande_id;
  if v_statut_actuel is null then
    raise exception 'Demande introuvable : %', p_demande_id;
  end if;

  select role into v_role from crm_profils where user_id = auth.uid();
  if v_role is null then
    raise exception 'Profil introuvable pour l''utilisateur courant';
  end if;

  v_transitions_valides := case v_statut_actuel
    when 'brouillon'            then array['envoyee', 'abandonnee']
    when 'envoyee'               then array['en_saisie', 'abandonnee']
    when 'en_saisie'             then array['soumise', 'abandonnee']
    when 'soumise'               then array['entretien_planifie', 'en_saisie', 'abandonnee']
    when 'entretien_planifie'    then array['en_analyse', 'abandonnee']
    when 'en_analyse'            then array['cadrage_envoye', 'reorientee', 'abandonnee']
    when 'cadrage_envoye'        then array['cadrage_valide', 'cadrage_a_revoir', 'abandonnee']
    when 'cadrage_a_revoir'      then array['en_saisie', 'cadrage_envoye', 'abandonnee']
    when 'cadrage_valide'        then array['proposition_envoyee', 'abandonnee']
    when 'proposition_envoyee'   then array['gagnee', 'perdue', 'abandonnee']
    else array[]::text[]
  end;

  if not (p_vers = any(v_transitions_valides)) then
    raise exception 'Transition non autorisée : % -> %', v_statut_actuel, p_vers;
  end if;

  if v_role = 'client'
     and not (p_vers = 'abandonnee'
              or (v_via_fonction and p_vers in ('soumise', 'cadrage_valide', 'cadrage_a_revoir', 'gagnee', 'perdue', 'entretien_planifie'))) then
    raise exception 'Rôle "%" non autorisé pour la transition vers "%"', v_role, p_vers;
  end if;

  update crm_demandes set statut = p_vers, updated_at = now() where id = p_demande_id;

  insert into crm_evenements (demande_id, type, de, vers, auteur, commentaire)
  values (p_demande_id, 'statut', v_statut_actuel, p_vers, auth.uid(), p_commentaire);
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_rpc_confirmer_reservation_calcom(p_demande_id uuid, p_debut timestamp with time zone, p_fin timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not crm_acces_demande(p_demande_id) then
    raise exception 'Demande introuvable : %', p_demande_id;
  end if;

  if exists (select 1 from crm_entretien_creneaux where demande_id = p_demande_id and choisi = true) then
    raise exception 'Un entretien est déjà confirmé pour cette demande';
  end if;

  insert into crm_entretien_creneaux (demande_id, debut, fin, choisi)
  values (p_demande_id, p_debut, p_fin, true);

  perform set_config('app.transition_client_via_rpc', 'on', true);
  perform crm_rpc_changer_statut(p_demande_id, 'entretien_planifie', 'Rendez-vous confirmé via Cal.com');
  perform set_config('app.transition_client_via_rpc', 'off', true);
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_rpc_demander_modification(p_note_id uuid, p_commentaire text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_demande_id uuid;
begin
  select demande_id into v_demande_id from crm_notes_cadrage where id = p_note_id;
  if v_demande_id is null or not crm_acces_demande(v_demande_id) then
    raise exception 'Note de cadrage introuvable : %', p_note_id;
  end if;

  update crm_notes_cadrage set statut = 'a_revoir' where id = p_note_id;

  perform set_config('app.transition_client_via_rpc', 'on', true);
  perform crm_rpc_changer_statut(v_demande_id, 'cadrage_a_revoir', p_commentaire);
  perform set_config('app.transition_client_via_rpc', 'off', true);
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_rpc_deposer_reclamation(p_demande_id uuid, p_objet text, p_description text DEFAULT NULL::text, p_date_reception date DEFAULT CURRENT_DATE, p_gravite text DEFAULT 'mineure'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_demande crm_demandes%rowtype;
  v_id uuid;
begin
  select * into v_demande from crm_demandes where id = p_demande_id;
  if v_demande.id is null or not crm_acces_demande(p_demande_id) then
    raise exception 'Demande introuvable';
  end if;
  if v_demande.client_id is null then
    raise exception 'Cette demande n''est rattachee a aucun client';
  end if;
  if nullif(btrim(p_objet), '') is null then
    raise exception 'Indiquez l''objet de votre reclamation';
  end if;
  if length(p_objet) > 200 or length(coalesce(p_description, '')) > 4000 then
    raise exception 'Texte trop long';
  end if;
  if p_gravite is null or p_gravite not in ('mineure', 'majeure', 'critique') then
    raise exception 'Importance inconnue';
  end if;
  if p_date_reception is null or p_date_reception > current_date or p_date_reception < current_date - 366 then
    raise exception 'La date du probleme doit etre comprise dans les douze derniers mois';
  end if;
  if (select count(*) from crm_reclamations r where r.created_by = auth.uid() and r.created_at > now() - interval '1 day') >= 5 then
    raise exception 'Trop de reclamations deposees aujourd''hui : contactez-nous directement';
  end if;

  insert into crm_reclamations (client_id, demande_id, objet, description, origine, responsable_id, date_reception, gravite)
  values (
    v_demande.client_id,
    p_demande_id,
    btrim(p_objet),
    nullif(btrim(p_description), ''),
    case when crm_est_staff() then 'equipe' else 'client' end,
    v_demande.consultant_id,
    p_date_reception,
    p_gravite
  )
  returning id into v_id;

  insert into crm_notifications (destinataire, demande_id, reference, type, titre, lien)
  select distinct x.u, p_demande_id, v_demande.reference, 'reclamation', 'Nouvelle réclamation', '#/reclamations'
  from (
    select v_demande.consultant_id as u
    union
    select p.user_id from crm_profils p where p.role = 'admin'
  ) x
  where x.u is not null and x.u is distinct from auth.uid();

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_rpc_fusionner_clients(p_garder uuid, p_absorber uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_garde crm_clients%rowtype;
  v_absorbe crm_clients%rowtype;
  v_demandes int;
  v_activites int;
  v_taches int;
  v_qualite int := 0;
  v_n int;
  v_table text;
  v_contacts_deplaces int := 0;
  v_contacts_fusionnes int := 0;
  v_dup record;
  v_garde_contact crm_contacts%rowtype;
  v_notes text;
begin
  if not crm_est_admin() then
    raise exception 'Reserve a l''administrateur';
  end if;
  if p_garder is null or p_absorber is null or p_garder = p_absorber then
    raise exception 'Choisissez deux clients differents';
  end if;

  perform 1 from crm_clients where id in (p_garder, p_absorber) order by id for update;
  select * into v_garde from crm_clients where id = p_garder;
  select * into v_absorbe from crm_clients where id = p_absorber;
  if v_garde.id is null or v_absorbe.id is null then
    raise exception 'Client introuvable';
  end if;

  for v_dup in
    select k.* from crm_contacts k where k.client_id = p_absorber order by k.created_at
  loop
    select * into v_garde_contact from crm_contacts g
      where g.client_id = p_garder and v_dup.email is not null and lower(g.email) = lower(v_dup.email);
    if v_garde_contact.id is not null then
      update crm_activites set contact_id = v_garde_contact.id where contact_id = v_dup.id;
      update crm_taches set contact_id = v_garde_contact.id where contact_id = v_dup.id;
      update crm_contacts set
        prenom = coalesce(nullif(trim(prenom), ''), v_dup.prenom),
        fonction = coalesce(nullif(trim(fonction), ''), v_dup.fonction),
        telephone = coalesce(nullif(trim(telephone), ''), v_dup.telephone),
        notes = case
          when nullif(trim(v_dup.notes), '') is null then notes
          when nullif(trim(notes), '') is null then v_dup.notes
          else notes || E'\n\n' || v_dup.notes
        end
      where id = v_garde_contact.id;
      delete from crm_contacts where id = v_dup.id;
      v_contacts_fusionnes := v_contacts_fusionnes + 1;
    else
      update crm_contacts set
        client_id = p_garder,
        principal = principal and not exists (select 1 from crm_contacts g where g.client_id = p_garder and g.principal)
      where id = v_dup.id;
      v_contacts_deplaces := v_contacts_deplaces + 1;
    end if;
    v_garde_contact := null;
  end loop;

  update crm_demandes set client_id = p_garder where client_id = p_absorber;
  get diagnostics v_demandes = row_count;
  update crm_activites set client_id = p_garder where client_id = p_absorber;
  get diagnostics v_activites = row_count;
  update crm_taches set client_id = p_garder where client_id = p_absorber;
  get diagnostics v_taches = row_count;

  foreach v_table in array array['crm_reclamations', 'crm_satisfactions'] loop
    if to_regclass('public.' || v_table) is not null then
      execute format('update %I set client_id = $1 where client_id = $2', v_table) using p_garder, p_absorber;
      get diagnostics v_n = row_count;
      v_qualite := v_qualite + v_n;
    end if;
  end loop;

  delete from crm_clients where id = p_absorber;

  v_notes := case
    when nullif(trim(v_absorbe.notes), '') is null then v_garde.notes
    when nullif(trim(v_garde.notes), '') is null then v_absorbe.notes
    else v_garde.notes || E'\n\n--- Notes de ' || v_absorbe.raison_sociale || ' (fusion du ' || to_char(now(), 'DD/MM/YYYY') || E') ---\n' || v_absorbe.notes
  end;

  update crm_clients set
    siret = coalesce(nullif(trim(siret), ''), v_absorbe.siret),
    nom_commercial = coalesce(nullif(trim(nom_commercial), ''), v_absorbe.nom_commercial),
    forme_juridique = coalesce(nullif(trim(forme_juridique), ''), v_absorbe.forme_juridique),
    code_naf = coalesce(nullif(trim(code_naf), ''), v_absorbe.code_naf),
    secteur = coalesce(nullif(trim(secteur), ''), v_absorbe.secteur),
    adresse = coalesce(nullif(trim(adresse), ''), v_absorbe.adresse),
    code_postal = coalesce(nullif(trim(code_postal), ''), v_absorbe.code_postal),
    ville = coalesce(nullif(trim(ville), ''), v_absorbe.ville),
    telephone = coalesce(nullif(trim(telephone), ''), v_absorbe.telephone),
    email_general = coalesce(nullif(trim(email_general), ''), v_absorbe.email_general),
    site_web = coalesce(nullif(trim(site_web), ''), v_absorbe.site_web),
    effectif = coalesce(nullif(trim(effectif), ''), v_absorbe.effectif),
    opco = coalesce(nullif(trim(opco), ''), v_absorbe.opco),
    source = coalesce(nullif(trim(source), ''), v_absorbe.source),
    statut = case when statut = 'prospect' and v_absorbe.statut = 'client' then 'client' else statut end,
    responsable_id = coalesce(responsable_id, v_absorbe.responsable_id),
    notes = v_notes
  where id = p_garder;

  insert into crm_activites (client_id, type, objet, description)
  values (
    p_garder,
    'note',
    'Fusion avec ' || v_absorbe.raison_sociale,
    'La fiche "' || v_absorbe.raison_sociale || '" (SIRET ' || coalesce(nullif(trim(v_absorbe.siret), ''), 'non renseigne') || ', identifiant ' || v_absorbe.id
      || ') a ete fusionnee dans celle-ci : ' || v_demandes || ' demande(s), ' || v_contacts_deplaces || ' contact(s) deplace(s), '
      || v_contacts_fusionnes || ' contact(s) fusionne(s), ' || v_activites || ' echange(s), ' || v_taches || ' tache(s), '
      || v_qualite || ' reclamation(s) ou avis.'
  );

  return jsonb_build_object(
    'demandes', v_demandes,
    'contacts_deplaces', v_contacts_deplaces,
    'contacts_fusionnes', v_contacts_fusionnes,
    'activites', v_activites,
    'taches', v_taches,
    'reclamations_et_avis', v_qualite
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_rpc_jalons()
 RETURNS TABLE(demande_id uuid, reference text, client text, type text, date timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with visibles as (
    select d.id, d.reference, c.raison_sociale as client, d.created_at, d.date_limite
    from crm_demandes d
    left join crm_clients c on c.id = d.client_id
    where d.archivee = false and crm_acces_demande(d.id)
  ),
  statuts_valides as (
    select e.demande_id, e.vers, e.created_at
    from crm_evenements e
    where e.type = 'statut' and e.vers is not null
      and not exists (
        select 1 from crm_evenements c
        where c.demande_id = e.demande_id
          and c.type = 'correction'
          and c.created_at > e.created_at
          and e.created_at > coalesce(
            (select max(p.created_at) from crm_evenements p
             where p.demande_id = e.demande_id and p.type = 'statut'
               and p.vers = c.vers and p.created_at < c.created_at),
            '-infinity'::timestamptz)
      )
  )
  select v.id, v.reference, v.client, 'creation'::text, v.created_at from visibles v
  union all
  select v.id, v.reference, v.client, 'echeance'::text, v.date_limite::timestamptz
  from visibles v where v.date_limite is not null
  union all
  select v.id, v.reference, v.client, s.vers, s.created_at
  from visibles v join statuts_valides s on s.demande_id = v.id
  union all
  select v.id, v.reference, v.client, 'entretien'::text, k.debut
  from visibles v join crm_entretien_creneaux k on k.demande_id = v.id and k.choisi
$function$;

CREATE OR REPLACE FUNCTION public.crm_rpc_marquer_mot_de_passe_change()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update crm_profils set doit_changer_mot_de_passe = false where user_id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.crm_rpc_mes_reclamations()
 RETURNS TABLE(id uuid, demande_id uuid, reference text, date_reception date, objet text, description text, gravite text, etat text, interlocuteur text, date_cloture date, reponse text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    r.id,
    r.demande_id,
    d.reference,
    r.date_reception,
    r.objet,
    r.description,
    r.gravite,
    case r.statut when 'ouverte' then 'recue' when 'en_cours' then 'en_cours' else 'traitee' end,
    (select nullif(btrim(p.nom), '') from crm_profils p where p.user_id = r.responsable_id),
    r.date_cloture,
    case when r.statut = 'cloturee' then r.action_corrective end
  from crm_reclamations r
  join crm_demandes d on d.id = r.demande_id
  where r.origine = 'client' and crm_acces_demande(r.demande_id)
  order by r.created_at desc;
$function$;

CREATE OR REPLACE FUNCTION public.crm_rpc_refuser_proposition(p_proposition_id uuid, p_commentaire text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_demande_id uuid;
begin
  select demande_id into v_demande_id from crm_propositions where id = p_proposition_id;
  if v_demande_id is null or not crm_acces_demande(v_demande_id) then
    raise exception 'Proposition introuvable : %', p_proposition_id;
  end if;

  update crm_propositions
  set statut = 'refusee', decidee_le = now(), decidee_par = auth.uid(), commentaire_client = p_commentaire
  where id = p_proposition_id;

  perform set_config('app.transition_client_via_rpc', 'on', true);
  perform crm_rpc_changer_statut(v_demande_id, 'perdue', p_commentaire);
  perform set_config('app.transition_client_via_rpc', 'off', true);
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_rpc_repondre_satisfaction(p_id uuid, p_note integer, p_commentaire text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_avis crm_satisfactions%rowtype;
  v_reference text;
  v_consultant uuid;
begin
  select * into v_avis from crm_satisfactions where id = p_id for update;
  if v_avis.id is null or not crm_acces_demande(v_avis.demande_id) then
    raise exception 'Avis introuvable';
  end if;
  if v_avis.statut <> 'demandee' then
    raise exception 'Cet avis a deja recu une reponse';
  end if;
  if p_note is null or p_note not between 1 and 5 then
    raise exception 'La note est un entier de 1 a 5';
  end if;

  update crm_satisfactions set
    statut = 'recue',
    note = p_note,
    commentaire = nullif(btrim(p_commentaire), ''),
    date_reponse = current_date,
    origine = case when crm_est_staff() then 'staff' else 'client' end
  where id = p_id;

  select d.reference, d.consultant_id into v_reference, v_consultant from crm_demandes d where d.id = v_avis.demande_id;
  if v_consultant is not null and v_consultant is distinct from auth.uid() then
    insert into crm_notifications (destinataire, demande_id, reference, type, titre, lien)
    values (v_consultant, v_avis.demande_id, v_reference, 'satisfaction', 'Avis de satisfaction reçu', '#/demandes/' || v_reference);
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_rpc_soumettre(p_demande_id uuid, p_ids_obligatoires text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_manquantes integer;
begin
  if not crm_acces_demande(p_demande_id) then
    raise exception 'Demande introuvable : %', p_demande_id;
  end if;

  select count(*) into v_manquantes
  from unnest(p_ids_obligatoires) as pertinente(question_id)
  left join crm_reponses r on r.demande_id = p_demande_id and r.question_id = pertinente.question_id
  where r.demande_id is null or (r.valeur is null and r.nsp is not true);

  if v_manquantes > 0 then
    raise exception '% question(s) obligatoire(s) sans réponse', v_manquantes;
  end if;

  update crm_demandes set soumise_le = now() where id = p_demande_id;
  perform set_config('app.transition_client_via_rpc', 'on', true);
  perform crm_rpc_changer_statut(p_demande_id, 'soumise', 'Envoi des réponses par le client');
  perform set_config('app.transition_client_via_rpc', 'off', true);
end;
$function$;

CREATE OR REPLACE FUNCTION public.crm_rpc_valider_cadrage(p_note_id uuid, p_signature_image text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_demande_id uuid;
  v_credential text;
begin
  if p_signature_image is null or length(trim(p_signature_image)) = 0 then
    raise exception 'La signature est obligatoire pour valider la note de cadrage';
  end if;

  select demande_id into v_demande_id from crm_notes_cadrage where id = p_note_id;
  if v_demande_id is null or not crm_acces_demande(v_demande_id) then
    raise exception 'Note de cadrage introuvable : %', p_note_id;
  end if;

  v_credential := to_char(floor(random() * 1000000)::int, 'FM000000')
    || '-' || to_char(floor(random() * 1000000)::int, 'FM000000');

  update crm_notes_cadrage
  set statut = 'validee',
      validee_le = now(),
      validee_par = auth.uid(),
      validation_ip = inet_client_addr(),
      signature_image = p_signature_image,
      signature_credential = v_credential
  where id = p_note_id;

  perform set_config('app.transition_client_via_rpc', 'on', true);
  perform crm_rpc_changer_statut(v_demande_id, 'cadrage_valide', 'Validation de la note de cadrage par le client');
  perform set_config('app.transition_client_via_rpc', 'off', true);
end;
$function$;

-- ─── Vues ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.crm_v_demandes_montants WITH (security_invoker=true) AS
 SELECT d.id AS demande_id,
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
     LEFT JOIN crm_probabilites_statut ps ON ps.statut = d.statut
     LEFT JOIN LATERAL ( SELECT pr.statut,
            pr.decidee_le,
            COALESCE(sum(l.total), 0::numeric) AS total
           FROM crm_propositions pr
             LEFT JOIN crm_proposition_lignes l ON l.proposition_id = pr.id
          WHERE pr.demande_id = d.id
          GROUP BY pr.id) p ON true
  WHERE crm_est_staff();

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

-- ─── Declencheurs ──────────────────────────────────────────────────────────

CREATE TRIGGER trg_audit_activites AFTER INSERT OR DELETE OR UPDATE ON public.crm_activites FOR EACH ROW EXECUTE FUNCTION crm_fn_audit();
CREATE TRIGGER trg_rd_recueil_nouvel_utilisateur AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION crm_fn_gerer_nouvel_utilisateur();
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

-- ─── Securite par ligne (RLS) ───────────────────────────────────────────────

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
ALTER TABLE public.crm_glossaire ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_notes_cadrage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_probabilites_statut ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_profils ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_proposition_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_propositions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_questionnaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_reclamations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_reponses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_reponses_historique ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_satisfactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_tache_membres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_tache_pieces_jointes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_taches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_vues_enregistrees ENABLE ROW LEVEL SECURITY;

-- ─── Politiques ────────────────────────────────────────────────────────────

CREATE POLICY activites_creation ON public.crm_activites AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (crm_peut_voir_client(client_id));
CREATE POLICY activites_lecture ON public.crm_activites AS PERMISSIVE FOR SELECT TO authenticated USING (crm_peut_voir_client(client_id));
CREATE POLICY activites_modification ON public.crm_activites AS PERMISSIVE FOR UPDATE TO authenticated USING ((crm_est_admin() OR (crm_peut_voir_client(client_id) AND (auteur = auth.uid())))) WITH CHECK ((crm_est_admin() OR (crm_peut_voir_client(client_id) AND (auteur = auth.uid()))));
CREATE POLICY activites_suppression ON public.crm_activites AS PERMISSIVE FOR DELETE TO authenticated USING ((crm_est_admin() OR (crm_peut_voir_client(client_id) AND (auteur = auth.uid()))));
CREATE POLICY audit_log_lecture ON public.crm_audit_log AS PERMISSIVE FOR SELECT TO authenticated USING (crm_est_admin());
CREATE POLICY clients_admin_suppression ON public.crm_clients AS PERMISSIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM crm_profils
  WHERE ((crm_profils.user_id = auth.uid()) AND (crm_profils.role = 'admin'::text)))));
CREATE POLICY clients_staff_creation ON public.crm_clients AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((crm_est_admin() OR (crm_est_staff() AND (responsable_id = auth.uid()))));
CREATE POLICY clients_staff_lecture ON public.crm_clients AS PERMISSIVE FOR SELECT TO authenticated USING ((crm_est_admin() OR (crm_est_staff() AND ((responsable_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM crm_demandes d
  WHERE ((d.client_id = crm_clients.id) AND (d.consultant_id = auth.uid()))))))));
CREATE POLICY clients_staff_modification ON public.crm_clients AS PERMISSIVE FOR UPDATE TO authenticated USING ((crm_est_admin() OR (crm_est_staff() AND ((responsable_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM crm_demandes d
  WHERE ((d.client_id = crm_clients.id) AND (d.consultant_id = auth.uid())))))))) WITH CHECK ((crm_est_admin() OR (crm_est_staff() AND ((responsable_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM crm_demandes d
  WHERE ((d.client_id = crm_clients.id) AND (d.consultant_id = auth.uid()))))))));
CREATE POLICY commentaires_client_ecriture ON public.crm_commentaires AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((crm_a_acces(demande_id) AND (interne = false) AND (auteur = auth.uid())));
CREATE POLICY commentaires_client_lecture ON public.crm_commentaires AS PERMISSIVE FOR SELECT TO authenticated USING ((crm_a_acces(demande_id) AND (interne = false)));
CREATE POLICY commentaires_staff ON public.crm_commentaires AS PERMISSIVE FOR ALL TO authenticated USING (crm_peut_voir_demande(demande_id)) WITH CHECK (crm_peut_voir_demande(demande_id));
CREATE POLICY consentements_staff ON public.crm_consentements AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM crm_contacts k
  WHERE ((k.id = crm_consentements.contact_id) AND crm_peut_voir_client(k.client_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM crm_contacts k
  WHERE ((k.id = crm_consentements.contact_id) AND crm_peut_voir_client(k.client_id)))));
CREATE POLICY contacts_staff ON public.crm_contacts AS PERMISSIVE FOR ALL TO authenticated USING (crm_peut_voir_client(client_id)) WITH CHECK (crm_peut_voir_client(client_id));
CREATE POLICY demande_acces_soi ON public.crm_demande_acces AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY demande_acces_staff ON public.crm_demande_acces AS PERMISSIVE FOR ALL TO authenticated USING (crm_peut_voir_demande(demande_id)) WITH CHECK (crm_peut_voir_demande(demande_id));
CREATE POLICY demande_enjeux_staff ON public.crm_demande_enjeux AS PERMISSIVE FOR ALL TO authenticated USING (crm_peut_voir_demande(demande_id)) WITH CHECK (crm_peut_voir_demande(demande_id));
CREATE POLICY demandes_client_lecture ON public.crm_demandes AS PERMISSIVE FOR SELECT TO authenticated USING (crm_a_acces(id));
CREATE POLICY demandes_staff ON public.crm_demandes AS PERMISSIVE FOR ALL TO authenticated USING ((crm_est_admin() OR (crm_est_staff() AND (consultant_id = auth.uid())))) WITH CHECK ((crm_est_admin() OR (crm_est_staff() AND (consultant_id = auth.uid()))));
CREATE POLICY doublons_ignores_admin ON public.crm_doublons_ignores AS PERMISSIVE FOR ALL TO authenticated USING (crm_est_admin()) WITH CHECK (crm_est_admin());
CREATE POLICY entretien_creneaux_client_lecture ON public.crm_entretien_creneaux AS PERMISSIVE FOR SELECT TO authenticated USING (crm_a_acces(demande_id));
CREATE POLICY entretien_creneaux_staff ON public.crm_entretien_creneaux AS PERMISSIVE FOR ALL TO authenticated USING (crm_peut_voir_demande(demande_id)) WITH CHECK (crm_peut_voir_demande(demande_id));
CREATE POLICY evenements_staff ON public.crm_evenements AS PERMISSIVE FOR SELECT TO authenticated USING (crm_peut_voir_demande(demande_id));
CREATE POLICY factures_admin ON public.crm_factures AS PERMISSIVE FOR ALL TO authenticated USING (crm_est_admin()) WITH CHECK (crm_est_admin());
CREATE POLICY fichiers_client_depot ON public.crm_fichiers AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (crm_a_acces(demande_id));
CREATE POLICY fichiers_client_lecture ON public.crm_fichiers AS PERMISSIVE FOR SELECT TO authenticated USING (crm_a_acces(demande_id));
CREATE POLICY fichiers_staff ON public.crm_fichiers AS PERMISSIVE FOR ALL TO authenticated USING (crm_peut_voir_demande(demande_id)) WITH CHECK (crm_peut_voir_demande(demande_id));
CREATE POLICY financements_staff ON public.crm_financements AS PERMISSIVE FOR ALL TO authenticated USING (crm_peut_voir_demande(demande_id)) WITH CHECK (crm_peut_voir_demande(demande_id));
CREATE POLICY glossaire_lecture ON public.crm_glossaire AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY notes_cadrage_client_lecture ON public.crm_notes_cadrage AS PERMISSIVE FOR SELECT TO authenticated USING ((crm_a_acces(demande_id) AND (statut <> 'brouillon'::text)));
CREATE POLICY notes_cadrage_staff ON public.crm_notes_cadrage AS PERMISSIVE FOR ALL TO authenticated USING (crm_peut_voir_demande(demande_id)) WITH CHECK (crm_peut_voir_demande(demande_id));
CREATE POLICY notifications_lecture ON public.crm_notifications AS PERMISSIVE FOR SELECT TO authenticated USING ((destinataire = auth.uid()));
CREATE POLICY notifications_maj ON public.crm_notifications AS PERMISSIVE FOR UPDATE TO authenticated USING ((destinataire = auth.uid())) WITH CHECK ((destinataire = auth.uid()));
CREATE POLICY probabilites_lecture ON public.crm_probabilites_statut AS PERMISSIVE FOR SELECT TO authenticated USING (crm_est_staff());
CREATE POLICY probabilites_modification ON public.crm_probabilites_statut AS PERMISSIVE FOR UPDATE TO authenticated USING (crm_est_admin()) WITH CHECK (crm_est_admin());
CREATE POLICY profils_soi ON public.crm_profils AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY profils_staff_lecture ON public.crm_profils AS PERMISSIVE FOR SELECT TO authenticated USING ((crm_est_admin() OR (crm_est_staff() AND ((role = ANY (ARRAY['admin'::text, 'consultant'::text])) OR (EXISTS ( SELECT 1
   FROM crm_demande_acces da
  WHERE (da.user_id = crm_profils.user_id)))))));
CREATE POLICY proposition_lignes_client_lecture ON public.crm_proposition_lignes AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM crm_propositions p
  WHERE ((p.id = crm_proposition_lignes.proposition_id) AND crm_a_acces(p.demande_id) AND (p.statut <> 'brouillon'::text)))));
CREATE POLICY proposition_lignes_staff ON public.crm_proposition_lignes AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM crm_propositions p
  WHERE ((p.id = crm_proposition_lignes.proposition_id) AND crm_peut_voir_demande(p.demande_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM crm_propositions p
  WHERE ((p.id = crm_proposition_lignes.proposition_id) AND crm_peut_voir_demande(p.demande_id)))));
CREATE POLICY propositions_client_lecture ON public.crm_propositions AS PERMISSIVE FOR SELECT TO authenticated USING ((crm_a_acces(demande_id) AND (statut <> 'brouillon'::text)));
CREATE POLICY propositions_staff ON public.crm_propositions AS PERMISSIVE FOR ALL TO authenticated USING (crm_peut_voir_demande(demande_id)) WITH CHECK (crm_peut_voir_demande(demande_id));
CREATE POLICY questionnaires_lecture ON public.crm_questionnaires AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY questions_client ON public.crm_questions AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM crm_sections s
  WHERE ((s.questionnaire_id = crm_questions.questionnaire_id) AND (s.id = crm_questions.section_id) AND (s.visible_client = true)))));
CREATE POLICY questions_staff ON public.crm_questions AS PERMISSIVE FOR SELECT TO authenticated USING (crm_est_staff());
CREATE POLICY reclamations_staff ON public.crm_reclamations AS PERMISSIVE FOR ALL TO authenticated USING (crm_peut_voir_client(client_id)) WITH CHECK (crm_peut_voir_client(client_id));
CREATE POLICY reponses_client_insertion ON public.crm_reponses AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (crm_client_peut_ecrire_reponse(demande_id, question_id));
CREATE POLICY reponses_client_lecture ON public.crm_reponses AS PERMISSIVE FOR SELECT TO authenticated USING ((crm_a_acces(demande_id) AND (EXISTS ( SELECT 1
   FROM (crm_questions q
     JOIN crm_demandes d ON ((d.questionnaire_id = q.questionnaire_id)))
  WHERE ((d.id = crm_reponses.demande_id) AND (q.id = crm_reponses.question_id) AND (q.rempli_par <> 'F'::text))))));
CREATE POLICY reponses_client_maj ON public.crm_reponses AS PERMISSIVE FOR UPDATE TO authenticated USING (crm_client_peut_ecrire_reponse(demande_id, question_id)) WITH CHECK (crm_client_peut_ecrire_reponse(demande_id, question_id));
CREATE POLICY reponses_staff ON public.crm_reponses AS PERMISSIVE FOR ALL TO authenticated USING (crm_peut_voir_demande(demande_id)) WITH CHECK (crm_peut_voir_demande(demande_id));
CREATE POLICY reponses_historique_staff ON public.crm_reponses_historique AS PERMISSIVE FOR SELECT TO authenticated USING (crm_peut_voir_demande(demande_id));
CREATE POLICY satisfactions_client ON public.crm_satisfactions AS PERMISSIVE FOR SELECT TO authenticated USING (crm_acces_demande(demande_id));
CREATE POLICY satisfactions_staff ON public.crm_satisfactions AS PERMISSIVE FOR ALL TO authenticated USING (crm_peut_voir_client(client_id)) WITH CHECK (crm_peut_voir_client(client_id));
CREATE POLICY sections_client ON public.crm_sections AS PERMISSIVE FOR SELECT TO authenticated USING ((visible_client = true));
CREATE POLICY sections_staff ON public.crm_sections AS PERMISSIVE FOR SELECT TO authenticated USING (crm_est_staff());
CREATE POLICY tache_membres_ajout ON public.crm_tache_membres AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((crm_peut_voir_tache(tache_id) AND (EXISTS ( SELECT 1
   FROM crm_profils p
  WHERE ((p.user_id = crm_tache_membres.user_id) AND (p.role = ANY (ARRAY['admin'::text, 'consultant'::text])))))));
CREATE POLICY tache_membres_lecture ON public.crm_tache_membres AS PERMISSIVE FOR SELECT TO authenticated USING (crm_peut_voir_tache(tache_id));
CREATE POLICY tache_membres_retrait ON public.crm_tache_membres AS PERMISSIVE FOR DELETE TO authenticated USING (crm_peut_voir_tache(tache_id));
CREATE POLICY tache_pieces_ajout ON public.crm_tache_pieces_jointes AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (crm_peut_voir_tache(tache_id));
CREATE POLICY tache_pieces_lecture ON public.crm_tache_pieces_jointes AS PERMISSIVE FOR SELECT TO authenticated USING (crm_peut_voir_tache(tache_id));
CREATE POLICY tache_pieces_retrait ON public.crm_tache_pieces_jointes AS PERMISSIVE FOR DELETE TO authenticated USING (crm_peut_voir_tache(tache_id));
CREATE POLICY taches_creation ON public.crm_taches AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((crm_est_admin() OR (crm_est_staff() AND (assignee_id = auth.uid()) AND crm_peut_voir_client(client_id))));
CREATE POLICY taches_lecture ON public.crm_taches AS PERMISSIVE FOR SELECT TO authenticated USING ((crm_est_admin() OR (crm_est_staff() AND ((assignee_id = auth.uid()) OR crm_est_membre_tache(id)))));
CREATE POLICY taches_modification ON public.crm_taches AS PERMISSIVE FOR UPDATE TO authenticated USING ((crm_est_admin() OR (crm_est_staff() AND ((assignee_id = auth.uid()) OR crm_est_membre_tache(id))))) WITH CHECK ((crm_est_admin() OR (crm_est_staff() AND ((assignee_id = auth.uid()) OR crm_est_membre_tache(id)))));
CREATE POLICY taches_suppression ON public.crm_taches AS PERMISSIVE FOR DELETE TO authenticated USING ((crm_est_admin() OR (crm_est_staff() AND (assignee_id = auth.uid()))));
CREATE POLICY vues_enregistrees_perso ON public.crm_vues_enregistrees AS PERMISSIVE FOR ALL TO authenticated USING (((user_id = auth.uid()) AND crm_est_staff())) WITH CHECK (((user_id = auth.uid()) AND crm_est_staff()));

-- ─── Droits sur les tables et les vues ─────────────────────────────────────

REVOKE ALL ON public.crm_activites FROM anon, authenticated, service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_activites TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_activites TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_activites TO service_role;
REVOKE ALL ON public.crm_audit_log FROM anon, authenticated, service_role;
GRANT SELECT ON public.crm_audit_log TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_audit_log TO service_role;
REVOKE ALL ON public.crm_clients FROM anon, authenticated, service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_clients TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_clients TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_clients TO service_role;
REVOKE ALL ON public.crm_commentaires FROM anon, authenticated, service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_commentaires TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_commentaires TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_commentaires TO service_role;
REVOKE ALL ON public.crm_consentements FROM anon, authenticated, service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_consentements TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_consentements TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_consentements TO service_role;
REVOKE ALL ON public.crm_contacts FROM anon, authenticated, service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_contacts TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_contacts TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_contacts TO service_role;
REVOKE ALL ON public.crm_demande_acces FROM anon, authenticated, service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_demande_acces TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_demande_acces TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_demande_acces TO service_role;
REVOKE ALL ON public.crm_demande_enjeux FROM anon, authenticated, service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_demande_enjeux TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_demande_enjeux TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_demande_enjeux TO service_role;
REVOKE ALL ON public.crm_demandes FROM anon, authenticated, service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_demandes TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_demandes TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_demandes TO service_role;
REVOKE ALL ON public.crm_doublons_ignores FROM anon, authenticated, service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_doublons_ignores TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_doublons_ignores TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_doublons_ignores TO service_role;
REVOKE ALL ON public.crm_entretien_creneaux FROM anon, authenticated, service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_entretien_creneaux TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_entretien_creneaux TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_entretien_creneaux TO service_role;
REVOKE ALL ON public.crm_evenements FROM anon, authenticated, service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_evenements TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_evenements TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_evenements TO service_role;
REVOKE ALL ON public.crm_factures FROM anon, authenticated, service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_factures TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_factures TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_factures TO service_role;
REVOKE ALL ON public.crm_fichiers FROM anon, authenticated, service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_fichiers TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_fichiers TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_fichiers TO service_role;
REVOKE ALL ON public.crm_financements FROM anon, authenticated, service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_financements TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_financements TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_financements TO service_role;
REVOKE ALL ON public.crm_glossaire FROM anon, authenticated, service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_glossaire TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_glossaire TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_glossaire TO service_role;
REVOKE ALL ON public.crm_notes_cadrage FROM anon, authenticated, service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_notes_cadrage TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_notes_cadrage TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_notes_cadrage TO service_role;
REVOKE ALL ON public.crm_notifications FROM anon, authenticated, service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_notifications TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_notifications TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_notifications TO service_role;
REVOKE ALL ON public.crm_probabilites_statut FROM anon, authenticated, service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_probabilites_statut TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_probabilites_statut TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_probabilites_statut TO service_role;
REVOKE ALL ON public.crm_profils FROM anon, authenticated, service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_profils TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_profils TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_profils TO service_role;
REVOKE ALL ON public.crm_proposition_lignes FROM anon, authenticated, service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_proposition_lignes TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_proposition_lignes TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_proposition_lignes TO service_role;
REVOKE ALL ON public.crm_propositions FROM anon, authenticated, service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_propositions TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_propositions TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_propositions TO service_role;
REVOKE ALL ON public.crm_questionnaires FROM anon, authenticated, service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_questionnaires TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_questionnaires TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_questionnaires TO service_role;
REVOKE ALL ON public.crm_questions FROM anon, authenticated, service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_questions TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_questions TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_questions TO service_role;
REVOKE ALL ON public.crm_reclamations FROM anon, authenticated, service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_reclamations TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_reclamations TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_reclamations TO service_role;
REVOKE ALL ON public.crm_reponses FROM anon, authenticated, service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_reponses TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_reponses TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_reponses TO service_role;
REVOKE ALL ON public.crm_reponses_historique FROM anon, authenticated, service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_reponses_historique TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_reponses_historique TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_reponses_historique TO service_role;
REVOKE ALL ON public.crm_satisfactions FROM anon, authenticated, service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_satisfactions TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_satisfactions TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_satisfactions TO service_role;
REVOKE ALL ON public.crm_sections FROM anon, authenticated, service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_sections TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_sections TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_sections TO service_role;
REVOKE ALL ON public.crm_tache_membres FROM anon, authenticated, service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_tache_membres TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_tache_membres TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_tache_membres TO service_role;
REVOKE ALL ON public.crm_tache_pieces_jointes FROM anon, authenticated, service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_tache_pieces_jointes TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_tache_pieces_jointes TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_tache_pieces_jointes TO service_role;
REVOKE ALL ON public.crm_taches FROM anon, authenticated, service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_taches TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_taches TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_taches TO service_role;
REVOKE ALL ON public.crm_vues_enregistrees FROM anon, authenticated, service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_vues_enregistrees TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_vues_enregistrees TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_vues_enregistrees TO service_role;
REVOKE ALL ON public.crm_v_clients FROM anon, authenticated, service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_v_clients TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_v_clients TO service_role;
REVOKE ALL ON public.crm_v_demandes_montants FROM anon, authenticated, service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_v_demandes_montants TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_v_demandes_montants TO service_role;
REVOKE ALL ON public.crm_v_reponses_client FROM anon, authenticated, service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_v_reponses_client TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_v_reponses_client TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_v_reponses_client TO service_role;

-- ─── Droits d'execution des fonctions ─────────────────────────────────────

REVOKE ALL ON FUNCTION public.crm_a_acces(p_demande_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_a_acces(p_demande_id uuid) TO PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.crm_acces_demande(p_demande_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_acces_demande(p_demande_id uuid) TO service_role, authenticated;
REVOKE ALL ON FUNCTION public.crm_client_peut_ecrire_reponse(p_demande_id uuid, p_question_id text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_client_peut_ecrire_reponse(p_demande_id uuid, p_question_id text) TO PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.crm_est_admin() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_est_admin() TO service_role, authenticated;
REVOKE ALL ON FUNCTION public.crm_est_membre_tache(p_tache uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_est_membre_tache(p_tache uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.crm_est_staff() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_est_staff() TO PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.crm_fn_attribuer_client() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_fn_attribuer_client() TO PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.crm_fn_attribuer_demande() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_fn_attribuer_demande() TO PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.crm_fn_audit() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_fn_audit() TO service_role;
REVOKE ALL ON FUNCTION public.crm_fn_consentement_maj() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_fn_consentement_maj() TO PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.crm_fn_gerer_nouvel_utilisateur() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_fn_gerer_nouvel_utilisateur() TO service_role;
REVOKE ALL ON FUNCTION public.crm_fn_historiser_reponse() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_fn_historiser_reponse() TO service_role;
REVOKE ALL ON FUNCTION public.crm_fn_notifier_evenement() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_fn_notifier_evenement() TO service_role;
REVOKE ALL ON FUNCTION public.crm_fn_notifier_membre_tache() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_fn_notifier_membre_tache() TO service_role;
REVOKE ALL ON FUNCTION public.crm_fn_notifier_satisfaction() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_fn_notifier_satisfaction() TO service_role;
REVOKE ALL ON FUNCTION public.crm_fn_notifier_tache() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_fn_notifier_tache() TO service_role;
REVOKE ALL ON FUNCTION public.crm_fn_premiere_saisie() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_fn_premiere_saisie() TO service_role;
REVOKE ALL ON FUNCTION public.crm_fn_proteger_assignation_client() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_fn_proteger_assignation_client() TO PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.crm_fn_proteger_assignation_demande() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_fn_proteger_assignation_demande() TO PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.crm_fn_reclamation_maj() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_fn_reclamation_maj() TO PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.crm_fn_reference() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_fn_reference() TO PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.crm_fn_satisfaction_maj() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_fn_satisfaction_maj() TO PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.crm_fn_tache_maj() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_fn_tache_maj() TO PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.crm_fn_touch() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_fn_touch() TO PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.crm_peut_voir_client(p_client_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_peut_voir_client(p_client_id uuid) TO service_role, authenticated;
REVOKE ALL ON FUNCTION public.crm_peut_voir_demande(p_demande_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_peut_voir_demande(p_demande_id uuid) TO service_role, authenticated;
REVOKE ALL ON FUNCTION public.crm_peut_voir_tache(p_tache uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_peut_voir_tache(p_tache uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.crm_peut_voir_tache_chemin(p_nom text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_peut_voir_tache_chemin(p_nom text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.crm_rpc_accepter_proposition(p_proposition_id uuid, p_signature_image text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_rpc_accepter_proposition(p_proposition_id uuid, p_signature_image text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.crm_rpc_archiver_demande(p_demande_id uuid, p_archiver boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_rpc_archiver_demande(p_demande_id uuid, p_archiver boolean) TO service_role, authenticated;
REVOKE ALL ON FUNCTION public.crm_rpc_assigner_demande(p_demande_id uuid, p_consultant_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_rpc_assigner_demande(p_demande_id uuid, p_consultant_id uuid) TO service_role, authenticated;
REVOKE ALL ON FUNCTION public.crm_rpc_changer_statut(p_demande_id uuid, p_vers text, p_commentaire text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_rpc_changer_statut(p_demande_id uuid, p_vers text, p_commentaire text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.crm_rpc_confirmer_reservation_calcom(p_demande_id uuid, p_debut timestamp with time zone, p_fin timestamp with time zone) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_rpc_confirmer_reservation_calcom(p_demande_id uuid, p_debut timestamp with time zone, p_fin timestamp with time zone) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.crm_rpc_demander_modification(p_note_id uuid, p_commentaire text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_rpc_demander_modification(p_note_id uuid, p_commentaire text) TO service_role, authenticated;
REVOKE ALL ON FUNCTION public.crm_rpc_deposer_reclamation(p_demande_id uuid, p_objet text, p_description text, p_date_reception date, p_gravite text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_rpc_deposer_reclamation(p_demande_id uuid, p_objet text, p_description text, p_date_reception date, p_gravite text) TO service_role, authenticated;
REVOKE ALL ON FUNCTION public.crm_rpc_fusionner_clients(p_garder uuid, p_absorber uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_rpc_fusionner_clients(p_garder uuid, p_absorber uuid) TO service_role, authenticated;
REVOKE ALL ON FUNCTION public.crm_rpc_jalons() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_rpc_jalons() TO service_role, authenticated;
REVOKE ALL ON FUNCTION public.crm_rpc_marquer_mot_de_passe_change() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_rpc_marquer_mot_de_passe_change() TO service_role, authenticated;
REVOKE ALL ON FUNCTION public.crm_rpc_mes_reclamations() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_rpc_mes_reclamations() TO service_role, authenticated;
REVOKE ALL ON FUNCTION public.crm_rpc_refuser_proposition(p_proposition_id uuid, p_commentaire text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_rpc_refuser_proposition(p_proposition_id uuid, p_commentaire text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.crm_rpc_repondre_satisfaction(p_id uuid, p_note integer, p_commentaire text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_rpc_repondre_satisfaction(p_id uuid, p_note integer, p_commentaire text) TO service_role, authenticated;
REVOKE ALL ON FUNCTION public.crm_rpc_soumettre(p_demande_id uuid, p_ids_obligatoires text[]) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_rpc_soumettre(p_demande_id uuid, p_ids_obligatoires text[]) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.crm_rpc_valider_cadrage(p_note_id uuid, p_signature_image text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_rpc_valider_cadrage(p_note_id uuid, p_signature_image text) TO authenticated, service_role;

-- ─── Stockage (seaux prives et politiques) ─────────────────────────────────

INSERT INTO storage.buckets (id, name, public) VALUES ('demandes', 'demandes', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit) VALUES ('taches', 'taches', false, 20971520) ON CONFLICT (id) DO NOTHING;

CREATE POLICY stockage_client_depot ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'demandes'::text) AND (EXISTS ( SELECT 1
   FROM crm_demandes d
  WHERE ((d.reference = (storage.foldername(objects.name))[2]) AND crm_a_acces(d.id))))));
CREATE POLICY stockage_client_lecture ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'demandes'::text) AND (EXISTS ( SELECT 1
   FROM crm_demandes d
  WHERE ((d.reference = (storage.foldername(objects.name))[2]) AND crm_a_acces(d.id))))));
CREATE POLICY stockage_staff ON storage.objects AS PERMISSIVE FOR ALL TO authenticated USING (((bucket_id = 'demandes'::text) AND (crm_est_admin() OR (crm_est_staff() AND (EXISTS ( SELECT 1
   FROM crm_demandes d
  WHERE ((d.reference = (storage.foldername(objects.name))[2]) AND (d.consultant_id = auth.uid())))))))) WITH CHECK (((bucket_id = 'demandes'::text) AND (crm_est_admin() OR (crm_est_staff() AND (EXISTS ( SELECT 1
   FROM crm_demandes d
  WHERE ((d.reference = (storage.foldername(objects.name))[2]) AND (d.consultant_id = auth.uid()))))))));
CREATE POLICY stockage_taches ON storage.objects AS PERMISSIVE FOR ALL TO authenticated USING (((bucket_id = 'taches'::text) AND crm_peut_voir_tache_chemin(name))) WITH CHECK (((bucket_id = 'taches'::text) AND crm_peut_voir_tache_chemin(name) AND (lower(storage.extension(name)) = ANY (ARRAY['pdf'::text, 'docx'::text, 'xlsx'::text, 'pptx'::text, 'png'::text, 'jpg'::text, 'jpeg'::text]))));

set check_function_bodies = on;
