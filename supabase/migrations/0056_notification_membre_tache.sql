-- Notification quand on est ajoute comme membre d'une tache (tache_membres, migration 0054).
-- Meme principe que fn_notifier_tache (responsable) : pas de notification pour soi-meme.
-- Le message ne nomme pas le client (un membre peut ne pas voir sa fiche) : « Tache » en
-- reference, titre de la tache dans le texte, lien vers la liste des taches.

create or replace function fn_notifier_membre_tache()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_titre text;
begin
  if new.user_id is not distinct from auth.uid() then
    return new;
  end if;

  select titre into v_titre from taches where id = new.tache_id;
  insert into notifications (destinataire, reference, type, titre, lien)
  values (new.user_id, 'Tâche', 'tache', 'Vous êtes ajouté à la tâche : ' || coalesce(v_titre, ''), '/taches');
  return new;
end;
$$;

revoke all on function fn_notifier_membre_tache() from public, anon, authenticated;

create trigger trg_notifier_membre_tache
  after insert on tache_membres
  for each row execute function fn_notifier_membre_tache();
