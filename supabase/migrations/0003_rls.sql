-- Politiques RLS : 01_ARCHITECTURE.md section 8.2.
-- Toutes les policies sont restreintes au rôle "authenticated" (pas d'accès anonyme,
-- l'authentification se fait uniquement par lien magique, section 8.1).

alter table profils enable row level security;
alter table questionnaires enable row level security;
alter table sections enable row level security;
alter table questions enable row level security;
alter table glossaire enable row level security;
alter table clients enable row level security;
alter table demandes enable row level security;
alter table demande_acces enable row level security;
alter table reponses enable row level security;
alter table reponses_historique enable row level security;
alter table fichiers enable row level security;
alter table commentaires enable row level security;
alter table notes_cadrage enable row level security;
alter table evenements enable row level security;

-- ─── profils ─────────────────────────────────────────────────────────────
-- Non listé explicitement dans le tableau 8.2 : chacun lit son propre profil,
-- le staff lit et gère tous les profils (nécessaire pour les écrans consultant/admin).

create policy profils_soi on profils for select to authenticated
  using (user_id = auth.uid());

create policy profils_staff on profils for all to authenticated
  using (est_staff()) with check (est_staff());

-- ─── questionnaires, glossaire ──────────────────────────────────────────────
-- Lecture pour tout utilisateur authentifié. Aucune écriture via l'anon key :
-- la publication d'une nouvelle version passe par le seed SQL exécuté côté admin.

create policy questionnaires_lecture on questionnaires for select to authenticated
  using (true);

create policy glossaire_lecture on glossaire for select to authenticated
  using (true);

-- ─── sections ────────────────────────────────────────────────────────────
-- Non listé explicitement dans le tableau 8.2, mais nécessaire à la navigation
-- client (même restriction visible_client que pour "questions").

create policy sections_staff on sections for select to authenticated
  using (est_staff());

create policy sections_client on sections for select to authenticated
  using (visible_client = true);

-- ─── questions ───────────────────────────────────────────────────────────
-- Client : uniquement les questions des sections visible_client = true.

create policy questions_staff on questions for select to authenticated
  using (est_staff());

create policy questions_client on questions for select to authenticated
  using (
    exists (
      select 1 from sections s
      where s.questionnaire_id = questions.questionnaire_id
        and s.id = questions.section_id
        and s.visible_client = true
    )
  );

-- ─── clients ─────────────────────────────────────────────────────────────
-- Non listé dans le tableau 8.2 : réservé au staff (fiche interne, distincte
-- des réponses TC-1.*).

create policy clients_staff on clients for all to authenticated
  using (est_staff()) with check (est_staff());

-- ─── demandes ────────────────────────────────────────────────────────────

create policy demandes_staff on demandes for all to authenticated
  using (est_staff()) with check (est_staff());

create policy demandes_client_lecture on demandes for select to authenticated
  using (a_acces(id));

-- ─── demande_acces ───────────────────────────────────────────────────────
-- Non listé dans le tableau 8.2 : le staff gère les invitations, chacun lit
-- sa propre ligne d'accès (pour connaître son droit editeur/lecteur).

create policy demande_acces_staff on demande_acces for all to authenticated
  using (est_staff()) with check (est_staff());

create policy demande_acces_soi on demande_acces for select to authenticated
  using (user_id = auth.uid());

-- ─── reponses ────────────────────────────────────────────────────────────
-- Lecture client : demande accessible et question non réservée au staff (F).
-- Écriture client : droit editeur, question C ou C/F, statut envoyee|en_saisie.
-- La colonne annotation_consultant est masquée par la vue v_reponses_client
-- ci-dessous : l'application cliente lit cette vue plutôt que la table.

create policy reponses_staff on reponses for all to authenticated
  using (est_staff()) with check (est_staff());

create policy reponses_client_lecture on reponses for select to authenticated
  using (
    a_acces(demande_id)
    and exists (
      select 1 from questions q
      join demandes d on d.questionnaire_id = q.questionnaire_id
      where d.id = reponses.demande_id and q.id = reponses.question_id and q.rempli_par <> 'F'
    )
  );

create policy reponses_client_insertion on reponses for insert to authenticated
  with check (client_peut_ecrire_reponse(demande_id, question_id));

create policy reponses_client_maj on reponses for update to authenticated
  using (client_peut_ecrire_reponse(demande_id, question_id))
  with check (client_peut_ecrire_reponse(demande_id, question_id));

create view v_reponses_client
with (security_invoker = true) as
select demande_id, question_id, valeur, nsp, saisi_par, updated_at
from reponses;

grant select on v_reponses_client to authenticated;

-- ─── reponses_historique ─────────────────────────────────────────────────
-- Non listé dans le tableau 8.2 : journal interne, réservé au staff.

create policy reponses_historique_staff on reponses_historique for select to authenticated
  using (est_staff());

-- ─── fichiers ────────────────────────────────────────────────────────────

create policy fichiers_staff on fichiers for all to authenticated
  using (est_staff()) with check (est_staff());

create policy fichiers_client_lecture on fichiers for select to authenticated
  using (a_acces(demande_id));

create policy fichiers_client_depot on fichiers for insert to authenticated
  with check (a_acces(demande_id));

-- Bucket de stockage 'demandes', chemin des objets : {reference}/{question_id}/{nom}.

insert into storage.buckets (id, name, public)
values ('demandes', 'demandes', false)
on conflict (id) do nothing;

create policy stockage_staff on storage.objects for all to authenticated
  using (bucket_id = 'demandes' and est_staff())
  with check (bucket_id = 'demandes' and est_staff());

create policy stockage_client_lecture on storage.objects for select to authenticated
  using (
    bucket_id = 'demandes'
    and exists (
      select 1 from demandes d
      where d.reference = (storage.foldername(name))[1] and a_acces(d.id)
    )
  );

create policy stockage_client_depot on storage.objects for insert to authenticated
  with check (
    bucket_id = 'demandes'
    and exists (
      select 1 from demandes d
      where d.reference = (storage.foldername(name))[1] and a_acces(d.id)
    )
  );

-- ─── commentaires ────────────────────────────────────────────────────────

create policy commentaires_staff on commentaires for all to authenticated
  using (est_staff()) with check (est_staff());

create policy commentaires_client_lecture on commentaires for select to authenticated
  using (a_acces(demande_id) and interne = false);

create policy commentaires_client_ecriture on commentaires for insert to authenticated
  with check (a_acces(demande_id) and interne = false and auteur = auth.uid());

-- ─── notes_cadrage ───────────────────────────────────────────────────────
-- Pas d'écriture client via RLS : la validation passe par rpc_valider_cadrage
-- (security definer), qui contourne RLS pour l'update contrôlé.

create policy notes_cadrage_staff on notes_cadrage for all to authenticated
  using (est_staff()) with check (est_staff());

create policy notes_cadrage_client_lecture on notes_cadrage for select to authenticated
  using (a_acces(demande_id) and statut <> 'brouillon');

-- ─── evenements ──────────────────────────────────────────────────────────
-- Lecture staff uniquement ; aucun accès client. Écriture uniquement via les
-- fonctions security definer (rpc_changer_statut et consorts).

create policy evenements_staff on evenements for select to authenticated
  using (est_staff());
