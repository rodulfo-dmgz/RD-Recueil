-- Nouveau type de champ "code_rncp" (02_MODELE_RECUEIL_BESOINS.md,
-- 01_ARCHITECTURE.md section 6.2) : vérifie le code RNCP/CFD saisi contre
-- l'API officielle France Compétences (Edge Function rncp-lookup) et
-- affiche l'intitulé officiel de la certification.
update public.questions set type = 'code_rncp' where id in ('TC-7.04', 'CER.02');
