-- CRM, lot B cloture : l'audit de securite Supabase signalait que
-- fn_tache_maj() (trigger de 0034) n'avait pas de search_path fixe. Il est
-- fixe a `public`, comme les autres fonctions du projet.

alter function fn_tache_maj() set search_path = public;
