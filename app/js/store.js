import { calculerVisibilite } from './engine/conditions.js';
import { calculerProgression } from './engine/completion.js';
import { enregistrerReponse } from './services/reponses.js';

// État "profil" (utilisateur connecté).

let profil = null;
const abonnesProfil = new Set();

export function getProfil() {
  return profil;
}

export function setProfil(nouveauProfil) {
  profil = nouveauProfil;
  abonnesProfil.forEach((fn) => fn(profil));
}

export function surProfil(fn) {
  abonnesProfil.add(fn);
  return () => abonnesProfil.delete(fn);
}

// État "demande en cours" (questionnaire + réponses de la demande consultée).

let etatDemande = null; // { demande, questionnaire, glossaireIndex, reponses: Map, visibilite, progression, statutEnregistrement }
const abonnesDemande = new Set();
const minuteries = new Map(); // question_id -> timer d'autosave

function recalculerDemande() {
  if (!etatDemande) return;
  const reponses = [...etatDemande.reponses.values()];
  etatDemande.visibilite = calculerVisibilite(etatDemande.questionnaire, reponses);
  etatDemande.progression = calculerProgression(etatDemande.questionnaire, etatDemande.visibilite, reponses);
  notifierDemande();
}

function notifierDemande() {
  abonnesDemande.forEach((fn) => fn(etatDemande));
}

export function initialiserDemande({ demande, questionnaire, glossaireIndex, reponses }) {
  const reponsesMap = new Map(reponses.map((r) => [r.question_id, r]));
  etatDemande = {
    demande,
    questionnaire,
    glossaireIndex,
    reponses: reponsesMap,
    visibilite: null,
    progression: null,
    statutEnregistrement: 'enregistre',
  };
  recalculerDemande();
}

export function getEtatDemande() {
  return etatDemande;
}

export function surEtatDemande(fn) {
  abonnesDemande.add(fn);
  return () => abonnesDemande.delete(fn);
}

// Met à jour la réponse localement (rendu immédiat des conditions/progression)
// puis l'enregistre côté serveur 800 ms après la dernière frappe
// (01_ARCHITECTURE.md section 12.2).
export function mettreAJourReponse(questionId, { valeur, nsp }) {
  if (!etatDemande) return;
  etatDemande.reponses.set(questionId, { question_id: questionId, valeur, nsp });
  etatDemande.statutEnregistrement = 'en-attente';
  recalculerDemande();

  clearTimeout(minuteries.get(questionId));
  const minuterie = setTimeout(async () => {
    etatDemande.statutEnregistrement = 'en-cours';
    notifierDemande();
    try {
      await enregistrerReponse(etatDemande.demande.id, questionId, { valeur, nsp });
      etatDemande.statutEnregistrement = 'enregistre';
    } catch (err) {
      etatDemande.statutEnregistrement = 'erreur';
      console.error('Échec de l’enregistrement automatique :', err);
    }
    notifierDemande();
  }, 800);
  minuteries.set(questionId, minuterie);
}
