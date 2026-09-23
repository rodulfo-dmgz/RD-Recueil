// Mode entretien - 01_ARCHITECTURE.md section 4.3.
import { obtenirDemandeParReference, changerStatut } from '../../services/demandes.js';
import { chargerQuestionnaire, chargerGlossaire } from '../../services/questionnaire.js';
import { chargerReponsesStaff, enregistrerReponse, enregistrerAnnotation } from '../../services/reponses.js';
import { indexerGlossaire } from '../../engine/glossary.js';
import { calculerVisibilite } from '../../engine/conditions.js';
import { listerPointsEntretien } from '../../engine/completion.js';
import { formaterReponse } from '../../engine/formatage.js';
import { rendreChamp } from '../../components/champ.js';
import { initGlossaryTooltip } from '../../components/glossary-tooltip.js';
import { afficherToast } from '../../components/toast.js';
import { navigate } from '../../router.js';

export async function vueEntretien(reference) {
  const app = document.getElementById('app');
  app.innerHTML = '<main class="conteneur"><p>Chargement…</p></main>';

  try {
    const demande = await obtenirDemandeParReference(reference);
    if (!demande) {
      app.innerHTML = '<main class="conteneur"><h1>Demande introuvable</h1></main>';
      return;
    }

    const [questionnaire, glossaireTermes, reponses] = await Promise.all([
      chargerQuestionnaire(demande.questionnaire_id),
      chargerGlossaire(demande.questionnaire_id),
      chargerReponsesStaff(demande.id),
    ]);

    const glossaireIndex = indexerGlossaire(glossaireTermes);
    initGlossaryTooltip(glossaireIndex);

    // Horodatage automatique de l'entretien (ANA.01), une seule fois.
    const dejaHorodate = reponses.find((r) => r.question_id === 'ANA.01' && r.valeur);
    if (!dejaHorodate) {
      const horodatage = new Date().toLocaleString('fr-FR');
      await enregistrerReponse(demande.id, 'ANA.01', { valeur: horodatage, nsp: false });
      reponses.push({ demande_id: demande.id, question_id: 'ANA.01', valeur: horodatage, nsp: false });
    }

    rendre({ demande, questionnaire, reponses, glossaireIndex });
  } catch (err) {
    afficherToast(err.message, { type: 'erreur' });
    app.innerHTML = '<main class="conteneur"><h1>Impossible de charger l’entretien</h1></main>';
  }
}

function rendre({ demande, questionnaire, reponses, glossaireIndex }) {
  const app = document.getElementById('app');
  app.innerHTML = '';
  const visibilite = calculerVisibilite(questionnaire, reponses);
  const reponseParId = new Map(reponses.map((r) => [r.question_id, r]));

  const main = document.createElement('main');
  main.className = 'conteneur';

  const retour = document.createElement('a');
  retour.href = `#/demandes/${demande.reference}`;
  retour.textContent = '← Retour à la demande';
  main.appendChild(retour);

  const titre = document.createElement('h1');
  titre.textContent = `Entretien — ${demande.reference}`;
  main.appendChild(titre);

  // En tête : NSP + obligatoires manquantes (§4.3 point 1).
  const nsp = listerPointsEntretien(questionnaire, visibilite, reponses);
  const manquantes = questionnaire.questions.filter(
    (q) => visibilite.questionsVisibles.has(q.id) && q.obligatoire && q.rempli_par !== 'F' && !reponseParId.get(q.id)
  );
  if (nsp.length > 0 || manquantes.length > 0) {
    const bloc = document.createElement('div');
    bloc.className = 'carte recap-manquantes';
    const h2 = document.createElement('h2');
    h2.textContent = 'À aborder en entretien';
    bloc.appendChild(h2);
    const liste = document.createElement('ul');
    for (const q of [...nsp, ...manquantes]) {
      const li = document.createElement('li');
      li.textContent = q.libelle.replace(/\\\*/g, '');
      liste.appendChild(li);
    }
    bloc.appendChild(liste);
    main.appendChild(bloc);
  }

  // Questions F et C/F, section par section, réponse client + annotation
  // consultant (§4.3 point 2).
  const sections = questionnaire.sections
    .filter((s) => s.partie !== 3 && visibilite.sectionsVisibles.has(s.id))
    .sort((a, b) => a.ordre - b.ordre);

  for (const section of sections) {
    const questions = questionnaire.questions
      .filter((q) => q.section === section.id && visibilite.questionsVisibles.has(q.id) && q.rempli_par !== 'C')
      .sort((a, b) => a.ordre - b.ordre);
    if (questions.length === 0) continue;

    const blocSection = document.createElement('section');
    blocSection.className = 'carte recap-section';
    const h2 = document.createElement('h2');
    h2.textContent = section.titre;
    blocSection.appendChild(h2);

    for (const q of questions) {
      const r = reponseParId.get(q.id);
      const blocQuestion = document.createElement('div');
      blocQuestion.className = 'entretien-question';

      const label = document.createElement('p');
      label.className = 'champ-question__libelle';
      label.textContent = q.libelle.replace(/\\\*/g, '');
      blocQuestion.appendChild(label);

      const reponseClient = document.createElement('p');
      reponseClient.className = 'texte-doux';
      reponseClient.textContent = 'Réponse client : ' + formaterReponse(q, r);
      blocQuestion.appendChild(reponseClient);

      const annotation = document.createElement('textarea');
      annotation.className = 'champ-saisie champ-saisie--zone';
      annotation.placeholder = 'Annotation consultant';
      annotation.value = r?.annotation_consultant ?? '';
      let minuterie;
      annotation.addEventListener('input', () => {
        clearTimeout(minuterie);
        minuterie = setTimeout(() => {
          enregistrerAnnotation(demande.id, q.id, annotation.value).catch((err) =>
            afficherToast(err.message, { type: 'erreur' })
          );
        }, 800);
      });
      blocQuestion.appendChild(annotation);

      blocSection.appendChild(blocQuestion);
    }
    main.appendChild(blocSection);
  }

  // Partie 3 : analyse du consultant (ANA.*), avec aide QQOQCP.
  const blocAna = document.createElement('section');
  blocAna.className = 'carte';
  const titreAna = document.createElement('h2');
  titreAna.textContent = 'Analyse du consultant';
  blocAna.appendChild(titreAna);
  const aide = document.createElement('p');
  aide.className = 'texte-doux';
  aide.textContent = 'Aide QQOQCP : Qui, Quoi, Où, Quand, Comment, Pourquoi.';
  blocAna.appendChild(aide);

  const questionsAna = questionnaire.questions.filter((q) => q.section === 'ANA').sort((a, b) => a.ordre - b.ordre);
  for (const q of questionsAna) {
    const r = reponseParId.get(q.id) || {};
    const champ = rendreChamp(q, r, {
      indexGlossaire: glossaireIndex,
      onChange: (nouvelleReponse) => {
        enregistrerReponse(demande.id, q.id, nouvelleReponse).catch((err) =>
          afficherToast(err.message, { type: 'erreur' })
        );
      },
    });
    blocAna.appendChild(champ);
  }
  main.appendChild(blocAna);

  const boutonTerminer = document.createElement('button');
  boutonTerminer.type = 'button';
  boutonTerminer.className = 'btn btn--primaire';
  boutonTerminer.textContent = 'Terminer l’analyse';
  boutonTerminer.addEventListener('click', async () => {
    boutonTerminer.disabled = true;
    try {
      if (demande.statut === 'soumise') {
        await changerStatut(demande.id, 'entretien_planifie');
      }
      await changerStatut(demande.id, 'en_analyse');
      afficherToast('Analyse terminée.', { type: 'succes' });
      navigate(`/demandes/${demande.reference}`);
    } catch (err) {
      afficherToast(err.message, { type: 'erreur' });
      boutonTerminer.disabled = false;
    }
  });
  main.appendChild(boutonTerminer);

  app.appendChild(main);
}
