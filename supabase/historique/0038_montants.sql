-- CRM, lot C etape 1 : montants, probabilites et pipeline en euros
-- (docs/changes.md). Tout est en HT : RD Formation est en franchise de TVA
-- (art. 293 B du CGI, cf. components/devis-imprimable.js).
--
-- Le montant estime et la probabilite propres a une demande sont dans une
-- table a part, reservee au staff : un client lit ses propres demandes
-- ligne par ligne (RLS) et verrait sinon ces colonnes internes.

-- Probabilite par defaut de chaque statut (modifiable par l'admin).
create table probabilites_statut (
  statut text primary key,
  pourcentage smallint not null check (pourcentage between 0 and 100)
);

insert into probabilites_statut (statut, pourcentage) values
  ('brouillon', 5),
  ('envoyee', 10),
  ('en_saisie', 15),
  ('soumise', 25),
  ('entretien_planifie', 35),
  ('en_analyse', 45),
  ('cadrage_envoye', 55),
  ('cadrage_a_revoir', 50),
  ('cadrage_valide', 65),
  ('proposition_envoyee', 75),
  ('gagnee', 100),
  ('perdue', 0),
  ('reorientee', 0),
  ('abandonnee', 0);

alter table probabilites_statut enable row level security;

create policy probabilites_lecture on probabilites_statut for select to authenticated
  using (est_staff());

create policy probabilites_modification on probabilites_statut for update to authenticated
  using (est_admin()) with check (est_admin());

-- Estimation saisie par le consultant avant que la proposition existe, et
-- probabilite propre a la demande (vide : celle du statut).
create table demande_enjeux (
  demande_id uuid primary key references demandes on delete cascade,
  montant_estime numeric(12, 2) check (montant_estime is null or montant_estime >= 0),
  probabilite smallint check (probabilite is null or probabilite between 0 and 100),
  updated_at timestamptz not null default now()
);

alter table demande_enjeux enable row level security;

create policy demande_enjeux_staff on demande_enjeux for all to authenticated
  using (est_staff()) with check (est_staff());

create trigger trg_demande_enjeux_touch
  before update on demande_enjeux
  for each row execute function fn_touch();

-- Montants par demande (staff uniquement, selon les droits de l'appelant).
-- montant_retenu : total de la proposition quand il est chiffre, sinon
-- l'estimation, sinon 0. Probabilite : 100 pour une demande gagnee, 0 pour
-- une demande perdue, reorientee ou abandonnee, sinon celle de la demande,
-- sinon celle du statut. date_decision : date de reponse du client a la
-- proposition (sert a dater le CA signe).
create view v_demandes_montants with (security_invoker = true) as
select
  d.id as demande_id,
  d.reference,
  d.client_id,
  d.statut,
  d.archivee,
  d.created_at,
  e.montant_estime,
  p.total as montant_propose,
  p.statut as proposition_statut,
  case when coalesce(p.total, 0) > 0 then p.total else coalesce(e.montant_estime, 0) end as montant_retenu,
  case
    when coalesce(p.total, 0) > 0 then 'proposition'
    when e.montant_estime is not null then 'estimation'
    else 'aucun'
  end as source_montant,
  case
    when d.statut = 'gagnee' then 100
    when d.statut in ('perdue', 'reorientee', 'abandonnee') then 0
    else coalesce(e.probabilite, ps.pourcentage, 0)
  end as probabilite,
  round(
    (case when coalesce(p.total, 0) > 0 then p.total else coalesce(e.montant_estime, 0) end)
    * (case
         when d.statut = 'gagnee' then 100
         when d.statut in ('perdue', 'reorientee', 'abandonnee') then 0
         else coalesce(e.probabilite, ps.pourcentage, 0)
       end) / 100.0,
    2
  ) as montant_pondere,
  p.decidee_le as date_decision
from demandes d
left join demande_enjeux e on e.demande_id = d.id
left join probabilites_statut ps on ps.statut = d.statut
left join lateral (
  select pr.statut, pr.decidee_le, coalesce(sum(l.total), 0) as total
  from propositions pr
  left join proposition_lignes l on l.proposition_id = pr.id
  where pr.demande_id = d.id
  group by pr.id
) p on true
where est_staff();

revoke all on v_demandes_montants from anon;

-- v_clients : CA signe (demandes gagnees) et pipeline pondere (demandes en cours).
create or replace view v_clients with (security_invoker = true) as
select
  c.*,
  (select count(*) from demandes d where d.client_id = c.id and not d.archivee) as nb_demandes,
  (select count(*) from demandes d where d.client_id = c.id and not d.archivee
     and d.statut not in ('gagnee', 'perdue', 'reorientee', 'abandonnee')) as nb_actives,
  (select count(*) from demandes d where d.client_id = c.id and d.statut = 'gagnee') as nb_gagnees,
  greatest(
    c.updated_at,
    (select max(d.updated_at) from demandes d where d.client_id = c.id),
    (select max(a.date_activite) from activites a where a.client_id = c.id)
  ) as derniere_activite,
  (select nullif(trim(concat_ws(' ', k.prenom, k.nom)), '') from contacts k
     where k.client_id = c.id and k.principal limit 1) as contact_principal,
  (select count(*) from taches t where t.client_id = c.id and t.statut = 'a_faire') as nb_taches_ouvertes,
  (select min(t.echeance) from taches t where t.client_id = c.id and t.statut = 'a_faire') as prochaine_echeance,
  (select coalesce(sum(m.montant_retenu), 0) from v_demandes_montants m
     where m.client_id = c.id and m.statut = 'gagnee') as ca_signe,
  (select coalesce(sum(m.montant_pondere), 0) from v_demandes_montants m
     where m.client_id = c.id and not m.archivee
       and m.statut not in ('gagnee', 'perdue', 'reorientee', 'abandonnee')) as pipeline_pondere
from clients c;

revoke all on v_clients from anon;
