-- docs/04_MODELE_NOTE_DE_CADRAGE.md n'est pas publié sur GitHub Pages (seul
-- app/ l'est) : le gabarit doit être accessible depuis la base, comme le
-- reste du référentiel (sections, questions, glossaire).

alter table questionnaires add column if not exists gabarit_cadrage_md text;
