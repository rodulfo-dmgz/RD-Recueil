-- Corrige fn_historiser_reponse() : le trigger d'historisation des réponses
-- échouait (42501) sur toute modification d'une réponse déjà enregistrée,
-- pour tous les rôles (client et staff), car reponses_historique n'a qu'une
-- policy SELECT (staff) et aucune policy INSERT. Le trigger doit s'exécuter
-- en SECURITY DEFINER : il journalise un changement que l'utilisateur vient
-- de faire via reponses (déjà autorisé par le RLS de cette table), donc
-- contourner le RLS de reponses_historique pour cette seule insertion
-- contrôlée est correct.
create or replace function public.fn_historiser_reponse()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.valeur is distinct from new.valeur then
    insert into reponses_historique (demande_id, question_id, ancienne_valeur, nouvelle_valeur, auteur)
    values (old.demande_id, old.question_id, old.valeur, new.valeur, new.saisi_par);
  end if;
  return new;
end;
$$;
