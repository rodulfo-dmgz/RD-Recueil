-- Corrige rpc_soumettre : la vérification "questions obligatoires sans
-- réponse" comptait TOUTES les questions obligatoires C/C-F du
-- questionnaire, y compris celles des volets (V-FOR, V-PON, V-MOD, V-ING,
-- V-CER) non pertinents pour la demande (TC-0.01 ne les contient pas), et
-- même certaines questions conditionnelles au sein du tronc commun
-- (TC-1.13/14, TC-3.05). La visibilité conditionnelle n'existe que dans
-- app/js/engine/conditions.js (grammaire non portée en SQL) : le client,
-- seule source de vérité pour la visibilité, transmet donc désormais la
-- liste des questions obligatoires actuellement pertinentes, et le serveur
-- vérifie que chacune a bien une réponse enregistrée.

drop function if exists rpc_soumettre(uuid);

create function rpc_soumettre(p_demande_id uuid, p_ids_obligatoires text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manquantes integer;
begin
  select count(*) into v_manquantes
  from unnest(p_ids_obligatoires) as pertinente(question_id)
  left join reponses r on r.demande_id = p_demande_id and r.question_id = pertinente.question_id
  where r.demande_id is null or (r.valeur is null and r.nsp is not true);

  if v_manquantes > 0 then
    raise exception '% question(s) obligatoire(s) sans réponse', v_manquantes;
  end if;

  update demandes set soumise_le = now() where id = p_demande_id;
  perform rpc_changer_statut(p_demande_id, 'soumise', 'Envoi des réponses par le client');
end;
$$;

revoke execute on function rpc_soumettre(uuid, text[]) from public, anon;
grant execute on function rpc_soumettre(uuid, text[]) to authenticated;
