// Kanban des demandes (refonte, phase 7) : colonnes et déplacements autorisés.
// Un glisser-déposer ne peut faire que les changements de statut que le consultant
// fait aujourd'hui d'un simple clic (cf. vue-360.js) : rouvrir la saisie d'une demande
// soumise, réorienter une demande en analyse, abandonner. Toutes les autres étapes ont
// leur écran (créneaux, note de cadrage, proposition) et la décision gagnée ou perdue
// revient au client. La base (rpc_changer_statut) reste l'arbitre final. Fonctions pures.

export const COLONNES_DEMANDES = [
  { valeur: 'a_demarrer', libelle: 'À démarrer', statuts: ['brouillon', 'envoyee', 'en_saisie'], couleur: 'neutre' },
  { valeur: 'soumises', libelle: 'Soumises', statuts: ['soumise', 'entretien_planifie'], couleur: 'info' },
  { valeur: 'analyse', libelle: 'En analyse', statuts: ['en_analyse'], couleur: 'info' },
  { valeur: 'cadrage', libelle: 'Cadrage', statuts: ['cadrage_envoye', 'cadrage_a_revoir', 'cadrage_valide'], couleur: 'attention' },
  { valeur: 'proposition', libelle: 'Proposition', statuts: ['proposition_envoyee'], couleur: 'attention' },
  { valeur: 'gagnee', libelle: 'Gagnées', statuts: ['gagnee'], couleur: 'succes' },
  { valeur: 'perdue', libelle: 'Perdues', statuts: ['perdue'], couleur: 'cloture' },
  { valeur: 'reorientee', libelle: 'Réorientées', statuts: ['reorientee'], couleur: 'cloture' },
  { valeur: 'abandonnee', libelle: 'Abandonnées', statuts: ['abandonnee'], couleur: 'cloture' },
];

const FINAUX = new Set(['gagnee', 'perdue', 'reorientee', 'abandonnee']);

export const estStatutFinal = (statut) => FINAUX.has(statut);

export function colonneDeStatut(statut) {
  return COLONNES_DEMANDES.find((c) => c.statuts.includes(statut))?.valeur ?? null;
}

// Changements faisables d'un glisser-déposer depuis ce statut :
// [{ vers, colonne, libelle, confirmation? }].
export function transitionsRapides(statut) {
  if (estStatutFinal(statut)) return [];
  const liste = [];
  if (statut === 'soumise') liste.push({ vers: 'en_saisie', colonne: 'a_demarrer', libelle: 'Réouvrir la saisie' });
  if (statut === 'en_analyse') liste.push({ vers: 'reorientee', colonne: 'reorientee', libelle: 'Réorientée' });
  liste.push({ vers: 'abandonnee', colonne: 'abandonnee', libelle: 'Abandonnée', confirmation: 'Confirmer l’abandon de cette demande ?' });
  return liste;
}

// Résultat du dépôt d'une carte (statut actuel) dans une colonne :
//  { type: 'meme' }                         même colonne, rien à faire ;
//  { type: 'ok', vers, confirmation? }      changement à envoyer au serveur ;
//  { type: 'refus', message }               déplacement impossible, avec l'explication.
export function deplacerDemande(statut, colonneCible) {
  if (colonneDeStatut(statut) === colonneCible) return { type: 'meme' };
  if (estStatutFinal(statut)) return { type: 'refus', message: 'Une demande terminée ne peut plus changer de statut.' };
  const transition = transitionsRapides(statut).find((t) => t.colonne === colonneCible);
  if (transition) return { type: 'ok', vers: transition.vers, confirmation: transition.confirmation };
  if (colonneCible === 'gagnee' || colonneCible === 'perdue') return { type: 'refus', message: 'Gagnée ou perdue : c’est la décision du client (signature ou refus de la proposition).' };
  if (colonneCible === 'reorientee') return { type: 'refus', message: 'Seule une demande en analyse peut être réorientée.' };
  return { type: 'refus', message: 'Cette étape se fait depuis la demande (créneaux, note de cadrage, proposition…) : ouvrez-la pour continuer.' };
}

// Colonnes remplies : { ...colonne, demandes } dans l'ordre des colonnes, les demandes les plus récentes d'abord.
export function colonnesKanbanDemandes(demandes) {
  return COLONNES_DEMANDES.map((colonne) => ({
    ...colonne,
    demandes: (demandes || []).filter((d) => colonne.statuts.includes(d.statut)).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))),
  }));
}
