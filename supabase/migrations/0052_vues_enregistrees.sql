-- Refonte de l'interface, phase 6 : vues enregistrees (filtres et tri d'une liste).
--
-- Une vue appartient a son auteur et n'est visible que de lui. Reservees au
-- personnel (admin et consultant) : un client n'a pas ces listes. Les filtres
-- sont stockes tels que l'interface les decrit (liste de { cle, operateur,
-- valeur }) ; l'interface ignore les cles inconnues, ce qui permet de faire
-- evoluer les colonnes sans migration.

create table vues_enregistrees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  ecran text not null check (ecran in ('clients', 'demandes')),
  nom text not null check (char_length(btrim(nom)) between 1 and 60),
  filtres jsonb not null default '[]' check (jsonb_typeof(filtres) = 'array' and jsonb_array_length(filtres) <= 20),
  tri jsonb check (tri is null or jsonb_typeof(tri) = 'object'),
  recherche text check (recherche is null or char_length(recherche) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Un nom ne sert qu'une fois par personne et par liste.
create unique index uq_vues_enregistrees_nom on vues_enregistrees (user_id, ecran, lower(btrim(nom)));

alter table vues_enregistrees enable row level security;

create policy vues_enregistrees_perso on vues_enregistrees for all to authenticated
  using (user_id = auth.uid() and est_staff())
  with check (user_id = auth.uid() and est_staff());

create trigger trg_vues_enregistrees_touch
  before update on vues_enregistrees
  for each row execute function fn_touch();
