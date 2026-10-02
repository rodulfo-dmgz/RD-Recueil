-- CRM, lot A etape 1b : un SIRET ne peut appartenir qu'a un seul client
-- (espaces ignores). Les clients sans SIRET restent autorises. Le doublon
-- ANATOLCONSEIL / ANATOL FORMATION a ete fusionne avant (demande
-- RDF-2026-0006 rattachee a ANATOLCONSEIL), cf. docs/changes.md.

create unique index clients_siret_unique
  on clients (regexp_replace(siret, '\s', '', 'g'))
  where nullif(trim(siret), '') is not null;
