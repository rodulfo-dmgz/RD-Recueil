-- Notifications internes a chaque etape validee (soumission, note de
-- cadrage, proposition, entretien) - 01_ARCHITECTURE.md section 16.
-- Centralise sur evenements plutot que sur chaque RPC : toute transition de
-- statut passe deja par rpc_changer_statut, qui ecrit dans evenements ; un
-- seul trigger AFTER INSERT y suffit pour toutes les etapes concernees.
-- L'email associe est envoye a part par le client (app/js/services/
-- notifications.js -> Edge Function envoyer-notification-email), pour
-- garder la cle du fournisseur d'e-mail hors de la base.

create table notifications (
  id uuid primary key default gen_random_uuid(),
  destinataire uuid not null references auth.users on delete cascade,
  demande_id uuid references demandes on delete cascade,
  reference text not null,
  type text not null,
  titre text not null,
  lu boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_destinataire_idx on notifications (destinataire, lu, created_at desc);

alter table notifications enable row level security;

create policy notifications_lecture on notifications for select to authenticated
  using (destinataire = auth.uid());

create policy notifications_maj on notifications for update to authenticated
  using (destinataire = auth.uid())
  with check (destinataire = auth.uid());

-- Libelle par statut cible ; les transitions absentes de cette liste (a
-- l'initiative interne du consultant : en_analyse, reorientee, abandonnee)
-- ne generent pas de notification.
create or replace function fn_notifier_evenement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_titre text;
  v_vers_staff boolean;
  v_reference text;
begin
  if new.type <> 'statut' then
    return new;
  end if;

  v_titre := case new.vers
    when 'soumise' then 'Nouvelles réponses soumises'
    when 'cadrage_envoye' then 'Note de cadrage envoyée'
    when 'cadrage_a_revoir' then 'Modification demandée sur la note de cadrage'
    when 'cadrage_valide' then 'Note de cadrage validée'
    when 'proposition_envoyee' then 'Proposition commerciale envoyée'
    when 'gagnee' then 'Proposition acceptée'
    when 'perdue' then 'Proposition refusée'
    when 'entretien_planifie' then 'Entretien planifié'
    else null
  end;

  if v_titre is null then
    return new;
  end if;

  select reference into v_reference from demandes where id = new.demande_id;
  v_vers_staff := new.vers in ('soumise', 'cadrage_a_revoir', 'cadrage_valide', 'gagnee', 'perdue', 'entretien_planifie');

  if v_vers_staff then
    insert into notifications (destinataire, demande_id, reference, type, titre)
    select p.user_id, new.demande_id, v_reference, new.vers, v_titre
    from profils p
    where p.role in ('admin', 'consultant');
  else
    insert into notifications (destinataire, demande_id, reference, type, titre)
    select da.user_id, new.demande_id, v_reference, new.vers, v_titre
    from demande_acces da
    where da.demande_id = new.demande_id and da.user_id is not null;
  end if;

  return new;
end;
$$;

create trigger trg_notifier_evenement
after insert on evenements
for each row execute function fn_notifier_evenement();
