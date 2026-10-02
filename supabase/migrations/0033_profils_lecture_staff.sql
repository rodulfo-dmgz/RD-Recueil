-- Faille corrigee (CRM, lot B, docs/changes.md) : `profils_staff` (for all)
-- laissait tout membre du staff, donc un simple consultant, modifier, creer
-- ou supprimer n'importe quel profil depuis son navigateur, notamment se
-- donner le role admin. L'application ne fait que lire `profils` : les
-- creations, changements de role et suppressions passent par les Edge
-- Functions (creer-compte, supprimer-utilisateur) avec la cle service_role,
-- qui ignore la RLS. La politique devient une simple lecture.

drop policy profils_staff on profils;

create policy profils_staff_lecture on profils for select to authenticated
  using (est_staff());
