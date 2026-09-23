// Rendu lecture seule des réponses par section et du journal - partagé entre
// la vue 360 et le dossier de preuves (Lot 5).
import { formaterReponse } from '../engine/formatage.js';

export function rendreReponsesParSection(questionnaire, reponses, visibilite) {
  const conteneur = document.createElement('div');
  const reponseParId = new Map(reponses.map((r) => [r.question_id, r]));
  const sections = questionnaire.sections
    .filter((s) => visibilite.sectionsVisibles.has(s.id))
    .sort((a, b) => a.ordre - b.ordre);

  for (const section of sections) {
    const questions = questionnaire.questions
      .filter((q) => q.section === section.id && visibilite.questionsVisibles.has(q.id))
      .sort((a, b) => a.ordre - b.ordre);
    if (questions.length === 0) continue;

    const blocSection = document.createElement('section');
    blocSection.className = 'carte recap-section';
    const h2 = document.createElement('h2');
    h2.textContent = section.titre;
    blocSection.appendChild(h2);

    const dl = document.createElement('dl');
    for (const q of questions) {
      const dt = document.createElement('dt');
      dt.textContent = q.libelle.replace(/\\\*/g, '');
      const dd = document.createElement('dd');
      dd.textContent = formaterReponse(q, reponseParId.get(q.id));
      dl.append(dt, dd);
    }
    blocSection.appendChild(dl);
    conteneur.appendChild(blocSection);
  }

  return conteneur;
}

export function rendreJournal(journal) {
  const bloc = document.createElement('section');
  bloc.className = 'carte';
  const h2 = document.createElement('h2');
  h2.textContent = 'Journal';
  bloc.appendChild(h2);
  const liste = document.createElement('ul');
  if (journal.length === 0) {
    liste.innerHTML = '<li class="texte-doux">Aucun événement.</li>';
  }
  for (const e of journal) {
    const li = document.createElement('li');
    const date = new Date(e.created_at).toLocaleString('fr-FR');
    li.textContent = `${date} — ${e.de ?? '∅'} → ${e.vers ?? e.type}`;
    liste.appendChild(li);
  }
  bloc.appendChild(liste);
  return bloc;
}
