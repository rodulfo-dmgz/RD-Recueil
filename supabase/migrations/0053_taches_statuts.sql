-- Refonte de l'interface : Kanban des taches. Deux statuts s'ajoutent a
-- a_faire / terminee / annulee : en_cours et a_reviser (colonnes du Kanban :
-- A faire, En cours, A reviser, Complet). Les taches existantes ne changent pas.
-- Une tache est "ouverte" tant qu'elle n'est ni terminee ni annulee : le compteur
-- et la prochaine echeance de v_clients doivent donc compter les trois statuts
-- ouverts (le declencheur fn_tache_maj ne regarde que 'terminee', rien a changer).

alter table taches drop constraint taches_statut_check;
alter table taches add constraint taches_statut_check
  check (statut in ('a_faire', 'en_cours', 'a_reviser', 'terminee', 'annulee'));

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
  (select count(*) from taches t where t.client_id = c.id and t.statut in ('a_faire', 'en_cours', 'a_reviser')) as nb_taches_ouvertes,
  (select min(t.echeance) from taches t where t.client_id = c.id and t.statut in ('a_faire', 'en_cours', 'a_reviser')) as prochaine_echeance,
  (select coalesce(sum(m.montant_retenu), 0) from v_demandes_montants m
     where m.client_id = c.id and m.statut = 'gagnee') as ca_signe,
  (select coalesce(sum(m.montant_pondere), 0) from v_demandes_montants m
     where m.client_id = c.id and not m.archivee
       and m.statut not in ('gagnee', 'perdue', 'reorientee', 'abandonnee')) as pipeline_pondere
from clients c;

revoke all on v_clients from anon;
