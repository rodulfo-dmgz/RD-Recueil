import { getEtatDemande, mettreAJourReponse, surEtatDemande } from '../../store.js';
import { rendreChamp } from '../../components/champ.js';
import { televerserFichier } from '../../services/fichiers.js';
import { afficherToast } from '../../components/toast.js';
import { navigate } from '../../router.js';

const LIBELLE_STATUT = {
  'en-attente': 'Modifications non enregistrées…',
  'en-cours': 'Enregistrement…',
  enregistre: 'Enregistré',
  erreur: 'Échec de l’enregistrement',
};

function questionsVisiblesDeLaSection(etat, sectionId) {
  return etat.questionnaire.questions
    .filter((q) => q.section === sectionId && etat.visibilite.questionsVisibles.has(q.id) && q.rempli_par !== 'F')
    .sort((a, b) => a.ordre - b.ordre);
}

export function vueSection(reference, sectionId) {
  const etatInitial = getEtatDemande();
  if (!etatInitial || etatInitial.demande.reference !== reference) {
    navigate(`/d/${reference}`);
    return;
  }
  if (!etatInitial.visibilite.sectionsVisibles.has(sectionId)) {
    navigate(`/d/${reference}`);
    return;
  }

  let idsAffiches = null;
  let elementStatut = null;

  function rendre() {
    const app = document.getElementById('app');
    const etat = getEtatDemande();
    const section = etat.questionnaire.sections.find((s) => s.id === sectionId);
    const questions = questionsVisiblesDeLaSection(etat, sectionId);
    idsAffiches = questions.map((q) => q.id).join(',');

    app.innerHTML = '';
    const main = document.createElement('main');
    main.className = 'conteneur';

    const retour = document.createElement('a');
    retour.href = `#/d/${reference}`;
    retour.textContent = '← Retour à la demande';
    main.appendChild(retour);

    const titre = document.createElement('h1');
    titre.textContent = section.titre;
    main.appendChild(titre);

    elementStatut = document.createElement('p');
    elementStatut.className = 'texte-doux section-questions__statut';
    elementStatut.textContent = LIBELLE_STATUT[etat.statutEnregistrement] || '';
    main.appendChild(elementStatut);

    for (const question of questions) {
      const reponse = etat.reponses.get(question.id) || {};
      const champ = rendreChamp(question, reponse, {
        indexGlossaire: etat.glossaireIndex,
        onChange: (nouvelleReponse) => mettreAJourReponse(question.id, nouvelleReponse),
        televerser:
          question.type === 'fichier'
            ? async (fichier, questionId) => {
                try {
                  return await televerserFichier({
                    demandeId: etat.demande.id,
                    reference,
                    questionId,
                    fichier,
                  });
                } catch (err) {
                  afficherToast(err.message, { type: 'erreur' });
                  return null;
                }
              }
            : undefined,
      });
      main.appendChild(champ);
    }

    const suivant = document.createElement('a');
    suivant.className = 'btn btn--primaire';
    suivant.href = `#/d/${reference}`;
    suivant.textContent = 'Retour à la demande';
    main.appendChild(suivant);

    app.appendChild(main);
  }

  // Un changement de store ne redessine la section que si l'ensemble des
  // questions visibles a changé (conditions), pour ne jamais faire perdre le
  // focus clavier pendant la frappe. Sinon, seul le texte "Enregistré" bouge.
  const desabonner = surEtatDemande((etat) => {
    const nouveauxIds = questionsVisiblesDeLaSection(etat, sectionId)
      .map((q) => q.id)
      .join(',');
    if (nouveauxIds !== idsAffiches) {
      rendre();
    } else if (elementStatut) {
      elementStatut.textContent = LIBELLE_STATUT[etat.statutEnregistrement] || '';
    }
  });

  rendre();

  window.addEventListener('hashchange', desabonner, { once: true });
}
