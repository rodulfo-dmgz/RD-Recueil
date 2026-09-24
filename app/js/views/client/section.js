import { getEtatDemande, mettreAJourReponse, surEtatDemande } from '../../store.js';
import { rendreChamp, mettreAJourErreurChamp } from '../../components/champ.js';
import { televerserFichier } from '../../services/fichiers.js';
import { rechercherEntreprise } from '../../services/entreprises.js';
import { afficherToast } from '../../components/toast.js';
import { creerBoutonRetour } from '../../components/bouton-retour.js';
import { navigate } from '../../router.js';

const LIBELLE_STATUT = {
  'en-attente': 'Modifications non enregistrées…',
  'en-cours': 'Enregistrement…',
  enregistre: 'Enregistré',
  erreur: 'Échec de l’enregistrement',
};

// Depuis le SIRET saisi sur cette question, quels autres champs de la même
// demande sont pré-remplis (annuaire public des entreprises) - remplace
// systématiquement la valeur existante par la donnée officielle.
const AUTO_REMPLISSAGE_SIRET = {
  'TC-1.03': {
    raisonSociale: 'TC-1.01',
    formeJuridique: 'TC-1.02',
    codeNaf: 'TC-1.04',
    secteurActivite: 'TC-1.05',
    adresse: 'TC-1.06',
    effectif: 'TC-1.08',
    conventionCollective: 'TC-1.09',
    estOrganismeFormation: 'TC-1.12',
    nda: 'TC-1.13',
    estQualiopi: 'TC-1.14',
  },
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

    main.appendChild(creerBoutonRetour(`#/d/${reference}`, 'Retour à la demande'));

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
        onAutoRemplir: AUTO_REMPLISSAGE_SIRET[question.id]
          ? async (siret, statut, donneesPreChargees) => {
              const donnees = donneesPreChargees || (await rechercherEntreprise(siret));
              if (!donnees) {
                statut.textContent = 'Aucun établissement trouvé pour ce SIRET.';
                return;
              }
              const cibles = AUTO_REMPLISSAGE_SIRET[question.id];
              let nbRemplis = 0;
              for (const [cle, idCible] of Object.entries(cibles)) {
                const valeurTrouvee = donnees[cle];
                if (valeurTrouvee == null || valeurTrouvee === '') continue;
                mettreAJourReponse(idCible, { valeur: valeurTrouvee, nsp: false });
                nbRemplis++;
              }
              const message =
                nbRemplis > 0
                  ? `${donnees.raisonSociale || 'Établissement trouvé'} - ${nbRemplis} champ(s) pré-rempli(s).`
                  : `${donnees.raisonSociale || 'Établissement trouvé'} (aucune donnée exploitable).`;
              statut.textContent = message;
              if (nbRemplis > 0) {
                afficherToast(message, { type: 'succes' });
                rendre();
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
    if (window.lucide) window.lucide.createIcons();
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
      return;
    }
    if (elementStatut) {
      elementStatut.textContent = LIBELLE_STATUT[etat.statutEnregistrement] || '';
    }
    // Le champ de saisie n'est pas reconstruit (focus préservé), mais le
    // message d'erreur, lui, doit refléter la valeur actuelle - sinon une
    // erreur reste affichée après correction (ou l'inverse).
    for (const question of questionsVisiblesDeLaSection(etat, sectionId)) {
      const conteneurQuestion = document.getElementById(`champ-${question.id}`);
      if (conteneurQuestion?.contains(document.activeElement)) continue; // ne pas gêner la saisie en cours
      mettreAJourErreurChamp(question, etat.reponses.get(question.id));
    }
  });

  rendre();

  window.addEventListener('hashchange', desabonner, { once: true });
}
