-- Reparation ponctuelle de RDF-2026-0004 : la version 2 de sa note de
-- cadrage avait ete marquee "envoyee" avant que rpc_changer_statut
-- n'autorise la transition cadrage_a_revoir -> cadrage_envoye (voir
-- migration 0019). Le statut de la demande etait donc reste bloque a
-- cadrage_a_revoir, empechant toute validation cote client. Realigne le
-- statut sur celui de la note et journalise l'evenement, comme l'aurait
-- fait un envoi reussi.

update demandes
set statut = 'cadrage_envoye', updated_at = now()
where reference = 'RDF-2026-0004' and statut = 'cadrage_a_revoir';

insert into evenements (demande_id, type, de, vers, auteur, commentaire)
select id, 'statut', 'cadrage_a_revoir', 'cadrage_envoye', null,
  'Reparation manuelle : la version 2 de la note avait ete marquee envoyee avant que la transition cadrage_a_revoir -> cadrage_envoye ne soit autorisee.'
from demandes
where reference = 'RDF-2026-0004';
