-- Lot Acces, etape 3 : dossier de fichiers (bucket demandes). Le personnel
-- n'avait qu'une regle "tout le staff, tout le bucket". Un consultant n'accede
-- plus qu'aux fichiers de ses demandes : le 2e segment du chemin
-- (demandes/{client}/{reference}/...) est la reference de la demande (cf.
-- 0027) ; l'admin garde tout, y compris les anciens chemins qui commencent
-- directement par la reference.

drop policy stockage_staff on storage.objects;

create policy stockage_staff on storage.objects for all to authenticated
  using (
    bucket_id = 'demandes' and (
      est_admin() or (est_staff() and exists (
        select 1 from demandes d
        where d.reference = (storage.foldername(objects.name))[2] and d.consultant_id = auth.uid()
      ))
    )
  )
  with check (
    bucket_id = 'demandes' and (
      est_admin() or (est_staff() and exists (
        select 1 from demandes d
        where d.reference = (storage.foldername(objects.name))[2] and d.consultant_id = auth.uid()
      ))
    )
  );
