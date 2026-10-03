-- Taches : urgence, plusieurs membres, pieces jointes (formulaire "Creer une
-- nouvelle tache" du Kanban).
--
-- Membres : le responsable (taches.assignee_id) reste l'auteur ou celui que
-- l'admin designe ; les autres membres de l'equipe sont dans tache_membres. Un
-- membre voit la tache et peut la faire avancer (statut, echeance, urgence), meme
-- si le client ne lui est pas attribue (comme une tache confiee par l'admin, 0039) :
-- il ne voit alors ni la fiche ni le nom du client, mais le titre, le message et
-- les pieces jointes. Seul le responsable (ou l'admin) peut supprimer la tache.
-- Tout le personnel peut ajouter des collegues (decision de l'utilisateur).
--
-- Pieces jointes : bucket prive 'taches', chemin {tache_id}/{horodatage}-{nom},
-- 20 Mo et memes extensions que les fichiers des demandes (pdf, docx, xlsx, pptx,
-- png, jpg, jpeg). L'acces suit celui de la tache.

-- ─── Urgence ────────────────────────────────────────────────────────────────

alter table taches add column urgence text not null default 'moyenne'
  check (urgence in ('faible', 'moyenne', 'haute'));

-- ─── Membres ────────────────────────────────────────────────────────────────

create table tache_membres (
  tache_id uuid not null references taches on delete cascade,
  user_id uuid not null references profils (user_id) on delete cascade,
  ajoute_par uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (tache_id, user_id)
);

create index idx_tache_membres_user on tache_membres (user_id);

alter table tache_membres enable row level security;

-- Fonctions "definer" : elles lisent taches et tache_membres sans repasser par
-- leurs politiques (sinon taches et tache_membres se referenceraient en boucle).
create or replace function est_membre_tache(p_tache uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from tache_membres m where m.tache_id = p_tache and m.user_id = auth.uid());
$$;

create or replace function peut_voir_tache(p_tache uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select est_admin() or (est_staff() and exists (
    select 1 from taches t
    where t.id = p_tache and (t.assignee_id = auth.uid() or est_membre_tache(t.id))
  ));
$$;

revoke all on function est_membre_tache(uuid) from public, anon;
revoke all on function peut_voir_tache(uuid) from public, anon;
grant execute on function est_membre_tache(uuid) to authenticated;
grant execute on function peut_voir_tache(uuid) to authenticated;

-- Lecture et modification : le responsable ou un membre (l'admin voit tout).
drop policy taches_lecture on taches;
create policy taches_lecture on taches for select to authenticated
  using (est_admin() or (est_staff() and (assignee_id = auth.uid() or est_membre_tache(id))));

drop policy taches_modification on taches;
create policy taches_modification on taches for update to authenticated
  using (est_admin() or (est_staff() and (assignee_id = auth.uid() or est_membre_tache(id))))
  with check (est_admin() or (est_staff() and (assignee_id = auth.uid() or est_membre_tache(id))));

create policy tache_membres_lecture on tache_membres for select to authenticated
  using (peut_voir_tache(tache_id));

create policy tache_membres_ajout on tache_membres for insert to authenticated
  with check (
    peut_voir_tache(tache_id)
    and exists (select 1 from profils p where p.user_id = tache_membres.user_id and p.role in ('admin', 'consultant'))
  );

create policy tache_membres_retrait on tache_membres for delete to authenticated
  using (peut_voir_tache(tache_id));

-- ─── Pieces jointes ─────────────────────────────────────────────────────────

create table tache_pieces_jointes (
  id uuid primary key default gen_random_uuid(),
  tache_id uuid not null references taches on delete cascade,
  nom text not null check (char_length(btrim(nom)) between 1 and 200),
  chemin text not null unique,
  taille bigint not null check (taille between 0 and 20971520),
  created_by uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index idx_tache_pieces_tache on tache_pieces_jointes (tache_id);

alter table tache_pieces_jointes enable row level security;

create policy tache_pieces_lecture on tache_pieces_jointes for select to authenticated
  using (peut_voir_tache(tache_id));
create policy tache_pieces_ajout on tache_pieces_jointes for insert to authenticated
  with check (peut_voir_tache(tache_id));
create policy tache_pieces_retrait on tache_pieces_jointes for delete to authenticated
  using (peut_voir_tache(tache_id));

-- ─── Stockage ───────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit)
values ('taches', 'taches', false, 20971520)
on conflict (id) do nothing;

-- Le premier dossier du chemin est l'identifiant de la tache (verifie avant le
-- transtypage, pour qu'un chemin quelconque ne leve pas d'erreur).
create or replace function peut_voir_tache_chemin(p_nom text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when (storage.foldername(p_nom))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then peut_voir_tache(((storage.foldername(p_nom))[1])::uuid)
    else false
  end;
$$;

revoke all on function peut_voir_tache_chemin(text) from public, anon;
grant execute on function peut_voir_tache_chemin(text) to authenticated;

create policy stockage_taches on storage.objects for all to authenticated
  using (bucket_id = 'taches' and peut_voir_tache_chemin(name))
  with check (
    bucket_id = 'taches'
    and peut_voir_tache_chemin(name)
    and lower(storage.extension(name)) in ('pdf', 'docx', 'xlsx', 'pptx', 'png', 'jpg', 'jpeg')
  );
