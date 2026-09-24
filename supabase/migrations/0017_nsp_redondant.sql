-- Retire la case "Je ne sais pas / à définir ensemble" pour les questions
-- dont les options proposent déjà un choix "Je ne sais pas" équivalent
-- (redondant, signalé sur TC-5.13 - 01_ARCHITECTURE.md section 6.2).
update public.questions
set nsp_autorise = false
where id in (
  'TC-0.01', 'TC-0.02', 'TC-1.01', 'TC-1.05', 'TC-1.10', 'TC-4.05',
  'TC-5.13', 'TC-8.12', 'TC-10.01', 'TC-11.04', 'FOR.05', 'CER.04', 'CER.05'
);
