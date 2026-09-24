// Calcul de la progression - 01_ARCHITECTURE.md section 6.6.
//
// Progression client  = questions visibles, rempli_par ∈ {C, C/F}, obligatoires,
//                        renseignées ou nsp ÷ total de ces questions.
// Progression dossier = même calcul en incluant les questions F (consultant).

function estRenseignee(reponseParId, id) {
  const r = reponseParId.get(id);
  if (!r) return false;
  if (r.nsp) return true;
  const v = r.valeur;
  if (v == null || v === '') return false;
  if (Array.isArray(v) && v.length === 0) return false;
  return true;
}

function ratio(liste, predicat) {
  const total = liste.length;
  const renseignees = liste.filter(predicat).length;
  return { total, renseignees, pourcentage: total === 0 ? 100 : Math.round((renseignees / total) * 100) };
}

// Questions obligatoires actuellement pertinentes (visibles compte tenu des
// réponses déjà saisies) - sert au calcul de progression ci-dessous, et à
// rpc_soumettre pour vérifier côté serveur exactement les mêmes questions
// que celles utilisées côté client (la visibilité conditionnelle n'existe
// que dans ce moteur JS, jamais dupliquée en SQL).
export function listerQuestionsPertinentes(questionnaire, visibilite, { inclureFormateur = false } = {}) {
  return questionnaire.questions.filter(
    (q) => visibilite.questionsVisibles.has(q.id) && q.obligatoire && (inclureFormateur || q.rempli_par !== 'F')
  );
}

export function calculerProgression(questionnaire, visibilite, reponses, options = {}) {
  const reponseParId = new Map(reponses.map((r) => [r.question_id, r]));
  const predicat = (q) => estRenseignee(reponseParId, q.id);

  const pertinentes = listerQuestionsPertinentes(questionnaire, visibilite, options);

  const global = ratio(pertinentes, predicat);

  const parSection = new Map();
  for (const section of questionnaire.sections) {
    if (!visibilite.sectionsVisibles.has(section.id)) continue;
    parSection.set(
      section.id,
      ratio(
        pertinentes.filter((q) => q.section === section.id),
        predicat
      )
    );
  }

  return { global, parSection };
}

// Questions cochées "Je ne sais pas / à définir ensemble" : alimente la liste
// des points d'entretien (01_ARCHITECTURE.md section 4.3 et 14.1).
export function listerPointsEntretien(questionnaire, visibilite, reponses) {
  const reponseParId = new Map(reponses.map((r) => [r.question_id, r]));
  return questionnaire.questions.filter(
    (q) => visibilite.questionsVisibles.has(q.id) && reponseParId.get(q.id)?.nsp === true
  );
}
