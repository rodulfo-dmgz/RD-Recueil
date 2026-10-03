// Journal d'audit du CRM (lot F) : libellés lisibles des entrées de
// `audit_log` (table, action, colonnes, valeurs). Fonctions pures.
//
// Une entrée : { action: 'insert' | 'update' | 'delete', table_name, libelle,
// changes: { colonne: [avant, apres] } } ; les valeurs vides sont null.

export const TABLES_AUDIT = [
  { valeur: 'clients', libelle: 'Clients' },
  { valeur: 'contacts', libelle: 'Contacts' },
  { valeur: 'demandes', libelle: 'Demandes' },
  { valeur: 'taches', libelle: 'Tâches' },
  { valeur: 'activites', libelle: 'Échanges' },
  { valeur: 'financements', libelle: 'Financements' },
  { valeur: 'factures', libelle: 'Factures' },
  { valeur: 'demande_enjeux', libelle: 'Enjeux des demandes' },
  { valeur: 'consentements', libelle: 'Consentements' },
  { valeur: 'reclamations', libelle: 'Réclamations' },
  { valeur: 'satisfactions', libelle: 'Satisfactions' },
];

// L'objet d'une phrase ("a modifié un client"), avec son article.
const OBJETS = {
  clients: 'un client',
  contacts: 'un contact',
  demandes: 'une demande',
  taches: 'une tâche',
  activites: 'un échange',
  financements: 'un financement',
  factures: 'une facture',
  demande_enjeux: "l'enjeu d'une demande",
  consentements: 'un consentement',
  reclamations: 'une réclamation',
  satisfactions: 'un avis de satisfaction',
};

const ACTIONS = {
  insert: { libelle: 'Création', verbe: 'a créé' },
  update: { libelle: 'Modification', verbe: 'a modifié' },
  delete: { libelle: 'Suppression', verbe: 'a supprimé' },
};

export function libelleTable(table) {
  return TABLES_AUDIT.find((t) => t.valeur === table)?.libelle ?? table;
}

export function libelleAction(action) {
  return ACTIONS[action]?.libelle ?? action;
}

// "Rodulfo Dominguez a modifié un client : ABC Formation".
export function phraseEntree(entree) {
  const verbe = ACTIONS[entree.action]?.verbe ?? 'a changé';
  const objet = OBJETS[entree.table_name] ?? `un élément (${entree.table_name})`;
  const nom = entree.libelle ? ` : ${entree.libelle}` : '';
  return `${entree.auteur || 'Quelqu’un'} ${verbe} ${objet}${nom}`;
}

const COLONNES = {
  raison_sociale: 'Raison sociale',
  nom_commercial: 'Nom commercial',
  siret: 'SIRET',
  forme_juridique: 'Forme juridique',
  code_naf: 'Code NAF',
  secteur: 'Secteur d’activité',
  effectif: 'Effectif',
  opco: 'OPCO',
  adresse: 'Adresse',
  code_postal: 'Code postal',
  ville: 'Ville',
  telephone: 'Téléphone',
  email_general: 'E-mail général',
  site_web: 'Site web',
  source: 'Source',
  statut: 'Statut',
  responsable_id: 'Responsable',
  consultant_id: 'Consultant',
  assignee_id: 'Responsable de la tâche',
  notes: 'Notes',
  prenom: 'Prénom',
  nom: 'Nom',
  fonction: 'Fonction',
  email: 'E-mail',
  roles: 'Rôles',
  principal: 'Contact principal',
  actif: 'Actif',
  reference: 'Référence',
  types: 'Types de prestation',
  date_limite: 'Date limite',
  archivee: 'Archivée',
  archivee_le: 'Archivée le',
  soumise_le: 'Soumise le',
  titre: 'Titre',
  description: 'Description',
  type: 'Type',
  echeance: 'Échéance',
  terminee_le: 'Terminée le',
  objet: 'Objet',
  date_activite: 'Date de l’échange',
  montant: 'Montant',
  montant_ht: 'Montant HT',
  montant_estime: 'Montant estimé',
  probabilite: 'Probabilité',
  numero: 'Numéro',
  libelle: 'Libellé',
  date_emission: 'Date d’émission',
  date_paiement: 'Date de paiement',
  organisme: 'Organisme',
  reference_dossier: 'Référence du dossier',
  note: 'Note',
  client_id: 'Fiche client',
  demande_id: 'Demande',
  contact_id: 'Contact',
  questionnaire_id: 'Questionnaire',
  created_by: 'Créé par',
  terminee_par: 'Terminée par',
  auteur: 'Auteur',
  id: 'Identifiant',
  // consentements, réclamations, satisfactions (étapes F2 à F4)
  date_consentement: 'Date du consentement',
  date_expiration: 'Date d’expiration',
  date_retrait: 'Date de retrait',
  preuve: 'Preuve',
  gravite: 'Gravité',
  action_corrective: 'Action corrective',
  date_reception: 'Date de réception',
  date_cloture: 'Date de clôture',
  note_satisfaction: 'Note',
  commentaire: 'Commentaire',
  moment: 'Moment',
  date_envoi: 'Date d’envoi',
  date_reponse: 'Date de réponse',
};

export function libelleColonne(colonne) {
  if (COLONNES[colonne]) return COLONNES[colonne];
  const texte = String(colonne).replace(/_/g, ' ');
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

// Colonnes qui contiennent un identifiant de compte : le nom se lit dans
// `noms` ({ identifiant: nom }) quand l'écran le fournit.
const COLONNES_COMPTE = new Set(['responsable_id', 'consultant_id', 'assignee_id', 'created_by', 'terminee_par', 'auteur']);
const COLONNES_LONGUES = new Set(['notes', 'description', 'commentaire', 'preuve', 'action_corrective']);

// Valeur d'une colonne pour l'affichage.
export function formaterValeurAudit(colonne, valeur, noms = {}) {
  if (valeur === null || valeur === undefined || valeur === '') return 'vide';
  if (typeof valeur === 'boolean') return valeur ? 'oui' : 'non';
  if (Array.isArray(valeur)) return valeur.length === 0 ? 'vide' : valeur.join(', ');
  if (COLONNES_COMPTE.has(colonne) && typeof valeur === 'string') return noms[valeur] ?? `compte ${valeur.slice(0, 8)}`;
  if (typeof valeur === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(valeur)) return `${valeur.slice(0, 8)}…`;
  if (typeof valeur === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(valeur)) {
    const d = new Date(valeur);
    return Number.isNaN(d.getTime()) ? valeur : d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  }
  if (typeof valeur === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valeur)) return `${valeur.slice(8, 10)}/${valeur.slice(5, 7)}/${valeur.slice(0, 4)}`;
  const texte = String(valeur);
  return COLONNES_LONGUES.has(colonne) && texte.length > 140 ? `${texte.slice(0, 140)}…` : texte;
}

// Détail des changements d'une entrée : [{ colonne, libelle, avant, apres }].
// `avant` ou `apres` vaut null quand la colonne n'existait pas (création) ou a
// disparu (suppression) ; l'écran montre alors une seule valeur.
export function resumerChangements(entree, noms = {}) {
  return Object.entries(entree.changes ?? {})
    .filter(([colonne]) => colonne !== 'id')
    .map(([colonne, [avant, apres]]) => ({
      colonne,
      libelle: libelleColonne(colonne),
      avant: entree.action === 'insert' ? null : formaterValeurAudit(colonne, avant, noms),
      apres: entree.action === 'delete' ? null : formaterValeurAudit(colonne, apres, noms),
    }));
}

// Lien vers la fiche concernée quand elle existe encore (null sinon).
export function lienEntree(entree) {
  if (entree.action === 'delete') return entree.client_id && entree.table_name !== 'clients' ? `#/clients/${entree.client_id}` : null;
  if (entree.table_name === 'clients') return `#/clients/${entree.record_id}`;
  if (entree.table_name === 'demandes' && entree.libelle) return `#/demandes/${entree.libelle}`;
  if (entree.client_id) return `#/clients/${entree.client_id}`;
  return null;
}
