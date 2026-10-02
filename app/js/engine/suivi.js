// Suivi d'une demande côté client : étapes visibles et prochaine action
// attendue, déduites du statut - 01_ARCHITECTURE.md section 3. Fonctions
// pures, partagées par le tableau de bord et ses tests.

export const ETAPES_SUIVI = [
  { id: 'reponses', libelle: 'Vos réponses', statuts: ['brouillon', 'envoyee', 'en_saisie'] },
  { id: 'entretien', libelle: 'Entretien', statuts: ['soumise', 'entretien_planifie', 'en_analyse'] },
  { id: 'cadrage', libelle: 'Note de cadrage', statuts: ['cadrage_envoye', 'cadrage_a_revoir', 'cadrage_valide'] },
  { id: 'proposition', libelle: 'Proposition', statuts: ['proposition_envoyee'] },
  { id: 'decision', libelle: 'Décision', statuts: ['gagnee', 'perdue', 'reorientee', 'abandonnee'] },
];

// Index de l'étape en cours (statut inconnu : première étape).
export function etapeCourante(statut) {
  const index = ETAPES_SUIVI.findIndex((e) => e.statuts.includes(statut));
  return index === -1 ? 0 : index;
}

// type : 'action' (le client doit agir), 'attente' (RD Formation agit) ou
// 'termine' (rien à faire). href seulement pour une action ou un suivi utile.
export function prochaineAction(statut, reference) {
  const base = `#/d/${reference}`;
  switch (statut) {
    case 'brouillon':
      return { type: 'attente', libelle: 'RD Formation prépare votre accès.', href: null };
    case 'envoyee':
    case 'en_saisie':
      return { type: 'action', libelle: 'Compléter vos réponses', href: base };
    case 'soumise':
      return { type: 'action', libelle: 'Choisir un créneau d’entretien', href: `${base}/creneaux` };
    case 'entretien_planifie':
      return { type: 'attente', libelle: 'Votre entretien est planifié.', href: `${base}/creneaux` };
    case 'en_analyse':
      return { type: 'attente', libelle: 'RD Formation analyse votre besoin.', href: null };
    case 'cadrage_envoye':
      return { type: 'action', libelle: 'Signer la note de cadrage', href: `${base}/cadrage` };
    case 'cadrage_a_revoir':
      return { type: 'attente', libelle: 'RD Formation modifie la note de cadrage.', href: null };
    case 'cadrage_valide':
      return { type: 'attente', libelle: 'RD Formation prépare votre proposition.', href: null };
    case 'proposition_envoyee':
      return { type: 'action', libelle: 'Répondre à la proposition', href: `${base}/proposition` };
    default:
      return { type: 'termine', libelle: 'Cette demande est terminée.', href: null };
  }
}
