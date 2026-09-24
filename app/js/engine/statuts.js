// Libellés des statuts de demande - 01_ARCHITECTURE.md section 7 (cycle de
// vie). Source unique pour toutes les vues (client et consultant).
export const LIBELLES_STATUT = {
  brouillon: 'Brouillon',
  envoyee: 'Envoyée',
  en_saisie: 'En saisie',
  soumise: 'Soumise',
  entretien_planifie: 'Entretien planifié',
  en_analyse: 'En analyse',
  cadrage_envoye: 'Note envoyée',
  cadrage_a_revoir: 'Note à revoir',
  cadrage_valide: 'Note validée',
  proposition_envoyee: 'Proposition envoyée',
  gagnee: 'Gagnée',
  perdue: 'Perdue',
  reorientee: 'Réorientée',
  abandonnee: 'Abandonnée',
};

export const STATUTS_FINAUX = new Set(['gagnee', 'perdue', 'reorientee', 'abandonnee']);

// Seuls ces statuts autorisent le client à modifier ses réponses (RLS,
// fonction client_peut_ecrire_reponse - 0002_functions.sql). Une fois la
// demande soumise, l'écriture est déjà bloquée côté serveur : ces vues
// reflètent simplement cette règle pour ne pas montrer un formulaire
// éditable qui échouerait silencieusement à l'enregistrement.
export const STATUTS_MODIFIABLES_CLIENT = new Set(['envoyee', 'en_saisie']);

// Catégorie visuelle (couleur du badge) par statut.
const CATEGORIES_STATUT = {
  cadrage_valide: 'succes',
  proposition_envoyee: 'succes',
  gagnee: 'succes',
  cadrage_a_revoir: 'attention',
  perdue: 'cloture',
  reorientee: 'cloture',
  abandonnee: 'cloture',
};

export function categorieStatut(statut) {
  return CATEGORIES_STATUT[statut] || 'neutre';
}
