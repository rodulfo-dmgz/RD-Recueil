-- Retrait des objets du LMS du projet Supabase rd-flow : la base ne doit contenir que
-- RD Recueil. Sauvegarde prealable (schema, donnees, politiques, droits, comptes de test) :
-- dossier hors git sauvegardes/rd-flow-lms-2026-10-05 (copie sur le Bureau).
--
-- Supprime :
--  - le declencheur on_auth_user_created (sur auth.users) et sa fonction handle_new_user,
--    qui creaient une ligne dans profils_utilisateurs a chaque inscription ;
--  - les 12 tables du LMS (avec leurs politiques, index et contraintes) : wall_ideas,
--    wall_sessions, jurys_sessions, examens_blancs, documents_generes, inscriptions_session,
--    profils_utilisateurs, sessions, stagiaires, groupes, jurys, titres ;
--  - la fonction get_my_role (lisait profils_utilisateurs, utilisee par les politiques du LMS)
--    et update_updated_at_column (aucun declencheur ne l'utilisait) ;
--  - les 10 comptes de connexion de test du LMS (test.compta1 a 10 @example.com), sans lien
--    avec RD Recueil (verifie : aucun acces, tache, journal ni profil rattache).
-- Les comptes de RD Recueil (auth.users, profils) et toutes ses tables sont inchanges.

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

drop table if exists
  public.wall_ideas,
  public.wall_sessions,
  public.jurys_sessions,
  public.examens_blancs,
  public.documents_generes,
  public.inscriptions_session,
  public.profils_utilisateurs,
  public.sessions,
  public.stagiaires,
  public.groupes,
  public.jurys,
  public.titres;

drop function if exists public.get_my_role();
drop function if exists public.update_updated_at_column();

delete from auth.users where email like 'test.compta%@example.com';
