// Rendu lecture seule des réponses par section et du journal - partagé entre
// la vue 360 et le dossier de preuves (Lot 5). construireValeurReponse est
// aussi réutilisée par le récapitulatif client (recap.js).
import { formaterReponse } from '../engine/formatage.js';
import { construireFicheRncp, construireFicheCertifInfo } from './fiche-certification.js';

// code_rncp avec une fiche mise en cache (sélection faite dans le champ,
// 01_ARCHITECTURE.md section 6.2) : affiche la fiche complète plutôt que le
// simple texte, y compris à l'impression (dossier de preuves Qualiopi).
export function construireValeurReponse(question, reponse) {
  const valeur = reponse?.valeur;
  if (question.type === 'code_rncp' && valeur && typeof valeur === 'object' && valeur.detail) {
    return valeur.source === 'certifinfo' ? construireFicheCertifInfo(valeur.detail) : construireFicheRncp(valeur.detail);
  }
  const texte = document.createElement('span');
  texte.textContent = formaterReponse(question, reponse);
  return texte;
}

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
      dd.appendChild(construireValeurReponse(q, reponseParId.get(q.id)));
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
