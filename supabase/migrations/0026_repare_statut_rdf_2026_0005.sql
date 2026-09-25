-- Reparation ponctuelle de RDF-2026-0005 : le compte client a ete cree
-- depuis l'ecran "Creer un compte" (creation-compte.js), qui rattachait
-- deja l'acces (demande_acces) mais n'appelait jamais rpc_changer_statut,
-- contrairement a inviterClient (vue-360.js) - corrige dans le code
-- (services/demandes.js). La demande etait donc restee bloquee a brouillon
-- alors qu'un compte client y avait deja acces, empechant toute reponse
-- (client_peut_ecrire_reponse exige envoyee/en_saisie). Realigne le statut
-- et journalise l'evenement, comme l'aurait fait une invitation reussie.

update demandes
set statut = 'envoyee', updated_at = now()
where reference = 'RDF-2026-0005' and statut = 'brouillon';

insert into evenements (demande_id, type, de, vers, auteur, commentaire)
select id, 'statut', 'brouillon', 'envoyee', (select user_id from profils where email = 'rodulfo_dominguez@live.com'),
  'Reparation manuelle : le compte client avait ete cree via "Creer un compte" (creation-compte.js), qui ne declenchait pas la transition envoyee.'
from demandes
where reference = 'RDF-2026-0005';
