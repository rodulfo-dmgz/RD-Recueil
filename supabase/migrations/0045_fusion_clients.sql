-- CRM, lot E etape 1 : fusion de clients en doublon (docs/changes.md).
--
-- A la suppression d'un client, ses contacts, echanges et taches partent avec
-- lui (on delete cascade) et ses demandes bloquent la suppression : la fusion
-- doit donc tout deplacer avant de supprimer l'ancienne fiche, dans une seule
-- transaction. Reservee a l'admin : seul lui voit tous les clients.

-- Couples que l'admin a decide de ne pas fusionner (ils ne sont plus proposes).
create table doublons_ignores (
  client_a uuid not null references clients on delete cascade,
  client_b uuid not null references clients on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users on delete set null default auth.uid(),
  primary key (client_a, client_b),
  check (client_a < client_b)
);

alter table doublons_ignores enable row level security;

create policy doublons_ignores_admin on doublons_ignores for all to authenticated
  using (est_admin()) with check (est_admin());

-- Fusionne p_absorber dans p_garder et renvoie ce qui a ete deplace.
--  - demandes, echanges et taches passent sur la fiche gardee ;
--  - un contact absorbe dont l'e-mail existe deja sur la fiche gardee est
--    fusionne avec lui (ses echanges et taches sont rattaches au contact garde,
--    ses champs vides completent le contact garde), sinon il est deplace ; il
--    perd son statut de contact principal si la fiche gardee en a deja un ;
--  - les champs vides de la fiche gardee sont completes par ceux de l'autre,
--    sans rien ecraser (SIRET compris) ; un prospect devient client si l'autre
--    l'etait ; les notes sont concatenees ;
--  - la fusion est inscrite dans l'historique de la fiche gardee ;
--  - l'ancienne fiche est supprimee en dernier.
create or replace function rpc_fusionner_clients(p_garder uuid, p_absorber uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_garde clients%rowtype;
  v_absorbe clients%rowtype;
  v_demandes int;
  v_activites int;
  v_taches int;
  v_contacts_deplaces int := 0;
  v_contacts_fusionnes int := 0;
  v_dup record;
  v_garde_contact contacts%rowtype;
  v_notes text;
begin
  if not est_admin() then
    raise exception 'Reserve a l''administrateur';
  end if;
  if p_garder is null or p_absorber is null or p_garder = p_absorber then
    raise exception 'Choisissez deux clients differents';
  end if;

  -- Verrou dans un ordre fixe : deux fusions croisees ne se bloquent pas.
  perform 1 from clients where id in (p_garder, p_absorber) order by id for update;
  select * into v_garde from clients where id = p_garder;
  select * into v_absorbe from clients where id = p_absorber;
  if v_garde.id is null or v_absorbe.id is null then
    raise exception 'Client introuvable';
  end if;

  -- Contacts : fusion des e-mails communs, deplacement des autres.
  for v_dup in
    select k.* from contacts k where k.client_id = p_absorber order by k.created_at
  loop
    select * into v_garde_contact from contacts g
      where g.client_id = p_garder and v_dup.email is not null and lower(g.email) = lower(v_dup.email);
    if v_garde_contact.id is not null then
      update activites set contact_id = v_garde_contact.id where contact_id = v_dup.id;
      update taches set contact_id = v_garde_contact.id where contact_id = v_dup.id;
      update contacts set
        prenom = coalesce(nullif(trim(prenom), ''), v_dup.prenom),
        fonction = coalesce(nullif(trim(fonction), ''), v_dup.fonction),
        telephone = coalesce(nullif(trim(telephone), ''), v_dup.telephone),
        notes = case
          when nullif(trim(v_dup.notes), '') is null then notes
          when nullif(trim(notes), '') is null then v_dup.notes
          else notes || E'\n\n' || v_dup.notes
        end
      where id = v_garde_contact.id;
      delete from contacts where id = v_dup.id;
      v_contacts_fusionnes := v_contacts_fusionnes + 1;
    else
      update contacts set
        client_id = p_garder,
        principal = principal and not exists (select 1 from contacts g where g.client_id = p_garder and g.principal)
      where id = v_dup.id;
      v_contacts_deplaces := v_contacts_deplaces + 1;
    end if;
    v_garde_contact := null;
  end loop;

  update demandes set client_id = p_garder where client_id = p_absorber;
  get diagnostics v_demandes = row_count;
  update activites set client_id = p_garder where client_id = p_absorber;
  get diagnostics v_activites = row_count;
  update taches set client_id = p_garder where client_id = p_absorber;
  get diagnostics v_taches = row_count;

  -- L'ancienne fiche part avant la mise a jour de la fiche gardee : son SIRET,
  -- unique, redevient disponible. Ses notes sont lues avant.
  delete from clients where id = p_absorber;

  v_notes := case
    when nullif(trim(v_absorbe.notes), '') is null then v_garde.notes
    when nullif(trim(v_garde.notes), '') is null then v_absorbe.notes
    else v_garde.notes || E'\n\n--- Notes de ' || v_absorbe.raison_sociale || ' (fusion du ' || to_char(now(), 'DD/MM/YYYY') || E') ---\n' || v_absorbe.notes
  end;

  update clients set
    siret = coalesce(nullif(trim(siret), ''), v_absorbe.siret),
    nom_commercial = coalesce(nullif(trim(nom_commercial), ''), v_absorbe.nom_commercial),
    forme_juridique = coalesce(nullif(trim(forme_juridique), ''), v_absorbe.forme_juridique),
    code_naf = coalesce(nullif(trim(code_naf), ''), v_absorbe.code_naf),
    secteur = coalesce(nullif(trim(secteur), ''), v_absorbe.secteur),
    adresse = coalesce(nullif(trim(adresse), ''), v_absorbe.adresse),
    code_postal = coalesce(nullif(trim(code_postal), ''), v_absorbe.code_postal),
    ville = coalesce(nullif(trim(ville), ''), v_absorbe.ville),
    telephone = coalesce(nullif(trim(telephone), ''), v_absorbe.telephone),
    email_general = coalesce(nullif(trim(email_general), ''), v_absorbe.email_general),
    site_web = coalesce(nullif(trim(site_web), ''), v_absorbe.site_web),
    effectif = coalesce(nullif(trim(effectif), ''), v_absorbe.effectif),
    opco = coalesce(nullif(trim(opco), ''), v_absorbe.opco),
    source = coalesce(nullif(trim(source), ''), v_absorbe.source),
    statut = case when statut = 'prospect' and v_absorbe.statut = 'client' then 'client' else statut end,
    responsable_id = coalesce(responsable_id, v_absorbe.responsable_id),
    notes = v_notes
  where id = p_garder;

  insert into activites (client_id, type, objet, description)
  values (
    p_garder,
    'note',
    'Fusion avec ' || v_absorbe.raison_sociale,
    'La fiche "' || v_absorbe.raison_sociale || '" (SIRET ' || coalesce(nullif(trim(v_absorbe.siret), ''), 'non renseigne') || ', identifiant ' || v_absorbe.id
      || ') a ete fusionnee dans celle-ci : ' || v_demandes || ' demande(s), ' || v_contacts_deplaces || ' contact(s) deplace(s), '
      || v_contacts_fusionnes || ' contact(s) fusionne(s), ' || v_activites || ' echange(s), ' || v_taches || ' tache(s).'
  );

  return jsonb_build_object(
    'demandes', v_demandes,
    'contacts_deplaces', v_contacts_deplaces,
    'contacts_fusionnes', v_contacts_fusionnes,
    'activites', v_activites,
    'taches', v_taches
  );
end;
$$;

revoke all on function rpc_fusionner_clients(uuid, uuid) from public, anon, authenticated;
grant execute on function rpc_fusionner_clients(uuid, uuid) to authenticated;
