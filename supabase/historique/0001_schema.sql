-- Schéma initial : 01_ARCHITECTURE.md section 7.

-- Profils et rôles
create table profils (
  user_id uuid primary key references auth.users on delete cascade,
  role text not null check (role in ('admin','consultant','client')),
  nom text,
  email text not null unique,
  created_at timestamptz default now()
);

-- Versions du référentiel
create table questionnaires (
  id text primary key,                 -- 'v1'
  statut text not null check (statut in ('brouillon','publie','archive')),
  source_hash text not null,
  publie_le timestamptz,
  created_at timestamptz default now()
);

create table sections (
  questionnaire_id text references questionnaires on delete cascade,
  id text,                             -- 'TC-4', 'V-MOD', 'ANA'
  partie smallint not null,
  titre text not null,
  ordre smallint not null,
  condition text default '-',
  visible_client boolean default true,
  primary key (questionnaire_id, id)
);

create table questions (
  questionnaire_id text references questionnaires on delete cascade,
  id text,                             -- 'TC-4.01'
  section_id text not null,
  ordre smallint not null,
  libelle text not null,
  type text not null,
  options jsonb default '[]',
  obligatoire boolean not null,
  rempli_par text not null check (rempli_par in ('C','F','C/F')),
  condition text default '-',
  glossaire text[] default '{}',
  nsp_autorise boolean default true,
  primary key (questionnaire_id, id),
  foreign key (questionnaire_id, section_id) references sections (questionnaire_id, id)
);

create table glossaire (
  questionnaire_id text references questionnaires on delete cascade,
  id text,                             -- 'opco'
  libelle text not null,
  categorie text not null,
  definition text not null,
  exemple text not null,
  primary key (questionnaire_id, id)
);

-- Clients et demandes
create table clients (
  id uuid primary key default gen_random_uuid(),
  raison_sociale text not null,
  siret text,
  created_at timestamptz default now()
);

create sequence demande_seq;

create table demandes (
  id uuid primary key default gen_random_uuid(),
  reference text unique not null,      -- 'RDF-2026-0001', généré par trigger
  client_id uuid references clients,
  questionnaire_id text references questionnaires not null,
  statut text not null default 'brouillon',
  types text[] default '{}',           -- copie de TC-0.01, puis ANA.06
  consultant_id uuid references profils(user_id),
  date_limite date,                    -- copie de TC-13.02
  soumise_le timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table demande_acces (
  demande_id uuid references demandes on delete cascade,
  email text not null,
  user_id uuid references auth.users,
  droit text not null default 'editeur' check (droit in ('editeur','lecteur')),
  invite_le timestamptz default now(),
  primary key (demande_id, email)
);

-- Réponses
create table reponses (
  demande_id uuid references demandes on delete cascade,
  question_id text not null,
  valeur jsonb,
  nsp boolean default false,
  annotation_consultant text,          -- jamais visible du client
  saisi_par uuid references auth.users,
  updated_at timestamptz default now(),
  primary key (demande_id, question_id)
);

create table reponses_historique (
  id bigint generated always as identity primary key,
  demande_id uuid, question_id text,
  ancienne_valeur jsonb, nouvelle_valeur jsonb,
  auteur uuid, modifie_le timestamptz default now()
);

create table fichiers (
  id uuid primary key default gen_random_uuid(),
  demande_id uuid references demandes on delete cascade,
  question_id text not null,
  chemin text not null,                -- bucket 'demandes'
  nom text not null,
  taille integer not null,
  mime text not null,
  depose_par uuid references auth.users,
  created_at timestamptz default now()
);

create table commentaires (
  id uuid primary key default gen_random_uuid(),
  demande_id uuid references demandes on delete cascade,
  cible text not null,                 -- ID de question ou 'cadrage:section-3'
  auteur uuid references auth.users,
  texte text not null,
  interne boolean default false,       -- true = invisible pour le client
  created_at timestamptz default now()
);

-- Note de cadrage
create table notes_cadrage (
  id uuid primary key default gen_random_uuid(),
  demande_id uuid references demandes on delete cascade,
  version smallint not null,
  contenu_md text not null,            -- gabarit rendu puis retouché
  statut text not null check (statut in ('brouillon','envoyee','a_revoir','validee')),
  envoyee_le timestamptz,
  validee_le timestamptz,
  validee_par uuid references auth.users,
  validation_ip inet,
  unique (demande_id, version)
);

-- Journal
create table evenements (
  id bigint generated always as identity primary key,
  demande_id uuid references demandes on delete cascade,
  type text not null,                  -- 'statut', 'invitation', 'soumission', 'cadrage'…
  de text, vers text,
  auteur uuid references auth.users,
  commentaire text,
  created_at timestamptz default now()
);

create index idx_demandes_client on demandes (client_id);
create index idx_demandes_consultant on demandes (consultant_id);
create index idx_demandes_statut on demandes (statut);
create index idx_demande_acces_user on demande_acces (user_id);
create index idx_reponses_demande on reponses (demande_id);
create index idx_fichiers_demande on fichiers (demande_id);
create index idx_commentaires_demande on commentaires (demande_id);
create index idx_evenements_demande on evenements (demande_id);
