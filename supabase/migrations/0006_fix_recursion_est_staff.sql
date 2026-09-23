-- Bug trouvé lors du test RLS manuel (Lot 1) : est_staff() lit "profils", mais
-- la politique "profils_staff" appelle est_staff() -> récursion infinie
-- ("stack depth limit exceeded") dès qu'un rôle authentifié interroge profils.
-- Fix standard Supabase : la fonction passe en security definer, donc sa
-- lecture interne de "profils" contourne le RLS (le propriétaire de la table
-- n'est pas soumis à ses propres politiques, sauf FORCE ROW LEVEL SECURITY).

alter function est_staff() security definer;
