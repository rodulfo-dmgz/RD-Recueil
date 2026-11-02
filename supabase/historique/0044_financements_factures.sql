-- CRM, lot D etape 1 : financements et references de factures
-- (docs/changes.md). Tout est en HT : RD Formation est en franchise de TVA.
--
-- Les factures restent emises dans Shine : le CRM n'en garde que la
-- reference (numero, libelle, montant, dates), saisie a la main ou importee
-- d'un export CSV (etape D6). Elles sont reservees a l'admin. Les
-- financements (OPCO, region...) suivent l'acces a la demande : un
-- consultant voit ceux de ses propres demandes.

-- ─── Financements ───────────────────────────────────────────────────────────

create table financements (
  id uuid primary key default gen_random_uuid(),
  demande_id uuid not null references demandes on delete cascade,
  type text not null check (type in ('opco', 'cpf', 'france_travail', 'region', 'entreprise', 'autre')),
  organisme text,
  reference_dossier text,
  montant numeric(12, 2) not null check (montant >= 0),
  statut text not null default 'en_attente' check (statut in ('en_attente', 'accorde', 'refuse', 'verse')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_financements_demande on financements (demande_id);

alter table financements enable row level security;

create policy financements_staff on financements for all to authenticated
  using (peut_voir_demande(demande_id)) with check (peut_voir_demande(demande_id));

create trigger trg_financements_touch
  before update on financements
  for each row execute function fn_touch();

-- ─── Factures (references) ──────────────────────────────────────────────────

-- demande_id : on ne supprime pas une demande qui porte des factures (trace
-- comptable) ; l'archivage reste possible.
create table factures (
  id uuid primary key default gen_random_uuid(),
  demande_id uuid not null references demandes on delete restrict,
  numero text check (numero is null or btrim(numero) <> ''),
  libelle text,
  montant_ht numeric(12, 2) not null check (montant_ht >= 0),
  date_emission date not null default current_date,
  date_paiement date,
  source text not null default 'manuelle' check (source in ('manuelle', 'import')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_factures_demande on factures (demande_id);

-- Un numero de facture ne peut etre saisi qu'une fois (l'import s'appuie
-- dessus pour ne rien dupliquer).
create unique index uq_factures_numero on factures (numero) where numero is not null;

alter table factures enable row level security;

create policy factures_admin on factures for all to authenticated
  using (est_admin()) with check (est_admin());

create trigger trg_factures_touch
  before update on factures
  for each row execute function fn_touch();
